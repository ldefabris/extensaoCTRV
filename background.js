// Background script for Snippet Injector Pro

chrome.runtime.onInstalled.addListener(() => {
    // Criar um alarme para limpar snippets expirados a cada 10 minutos
    chrome.alarms.create('cleanupSnippets', { periodInMinutes: 10 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'cleanupSnippets') {
        cleanupExpiredSnippets();
    }
});

function cleanupExpiredSnippets() {
    chrome.storage.local.get(['snippets'], (result) => {
        let snippets = result.snippets || [];
        const now = Date.now();
        
        const initialCount = snippets.length;
        const validSnippets = snippets.filter(s => {
            if (typeof s === 'string') return true; // Aguarda migração no popup
            if (s.ttl === 0) return true;
            return (now - s.createdAt) < (s.ttl * 1000);
        });

        if (validSnippets.length !== initialCount) {
            chrome.storage.local.set({ snippets: validSnippets });
            console.log(`[Background] Limpeza concluída: ${initialCount - validSnippets.length} snippets removidos.`);
        }
    });
}

// --- User-Agent Switcher Logic ---

// Configuração em memória (evita leitura assíncrona no content script)
let currentUAConfig = null;

// Carregar config ao iniciar o service worker
chrome.storage.local.get(['uaConfig'], (result) => {
    if (result.uaConfig && result.uaConfig.active) {
        currentUAConfig = result.uaConfig;
        const uaString = buildUAString(currentUAConfig);
        updateUARule(uaString);
    } else {
        removeUARule();
    }
});

// Escuta mudanças no storage para manter em sincronia
chrome.storage.onChanged.addListener((changes) => {
    if (changes.uaConfig) {
        const newConfig = changes.uaConfig.newValue;
        if (newConfig && newConfig.active) {
            currentUAConfig = newConfig;
        } else {
            currentUAConfig = null;
        }
    }
});

// Mensagens do popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'setUA') {
        currentUAConfig = request.config;
        const uaString = buildUAString(request.config);
        updateUARule(uaString).then(() => {
            // Injetar em todas as abas abertas imediatamente
            injectInAllTabs();
            sendResponse({ success: true });
        });
        return true;
    } else if (request.action === 'resetUA') {
        currentUAConfig = null;
        removeUARule().then(() => sendResponse({ success: true }));
        return true;
    }
});

// =============================================
// INJEÇÃO NO MAIN WORLD VIA webNavigation
// Injeta ANTES de qualquer script da página
// =============================================

chrome.webNavigation.onCommitted.addListener((details) => {
    if (!currentUAConfig || !currentUAConfig.active) return;
    injectSpoofInTab(details.tabId, details.frameId);
});

function injectSpoofInTab(tabId, frameId) {
    const config = currentUAConfig;
    if (!config) return;

    const ua = config.uaString || buildUAString(config);
    const browser = config.browser;
    const version = config.version;
    const os = config.os;

    chrome.scripting.executeScript({
        target: { tabId: tabId, frameIds: [frameId] },
        world: 'MAIN',
        func: spoofNavigatorFull,
        args: [ua, browser, version, os]
    }).catch(() => {
        // Fallback para navegadores que não suportam world:'MAIN' (Chrome < 111)
        // Nesse caso, inject_ua.js content script serve de fallback
    });
}

function injectInAllTabs() {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
                injectSpoofInTab(tab.id, 0);
            }
        });
    });
}

// =============================================
// Função injetada diretamente no MAIN WORLD
// Roda no contexto Javascript da página
// =============================================
function spoofNavigatorFull(ua, browser, version, os) {
    // 1. userAgent
    Object.defineProperty(navigator, 'userAgent', {
        get: () => ua, configurable: true
    });

    // 2. appVersion
    Object.defineProperty(navigator, 'appVersion', {
        get: () => ua.replace('Mozilla/', ''), configurable: true
    });

    // 3. platform
    let platformValue = 'Win32';
    if (os === 'ubuntu') platformValue = 'Linux x86_64';
    else if (os === 'chromeos') platformValue = 'Linux x86_64';
    Object.defineProperty(navigator, 'platform', {
        get: () => platformValue, configurable: true
    });

    // 4. vendor
    let vendorValue = 'Google Inc.';
    if (browser === 'firefox') vendorValue = '';
    Object.defineProperty(navigator, 'vendor', {
        get: () => vendorValue, configurable: true
    });

    // 5. appName
    Object.defineProperty(navigator, 'appName', {
        get: () => 'Netscape', configurable: true
    });

    // 6. product & productSub
    Object.defineProperty(navigator, 'product', {
        get: () => 'Gecko', configurable: true
    });
    let productSubValue = '20030107';
    if (browser === 'firefox') productSubValue = '20100101';
    Object.defineProperty(navigator, 'productSub', {
        get: () => productSubValue, configurable: true
    });

    // 7. Remover rastros do Opera
    try {
        Object.defineProperty(window, 'opr', {
            get: () => undefined, configurable: true, enumerable: false
        });
    } catch(e) {}
    try {
        Object.defineProperty(window, 'opera', {
            get: () => undefined, configurable: true, enumerable: false
        });
    } catch(e) {}

    // 8. userAgentData (Client Hints API)
    if (browser !== 'firefox') {
        const brands = [];
        if (browser === 'chrome') {
            brands.push({ brand: 'Google Chrome', version: version });
            brands.push({ brand: 'Not/A)Brand', version: '8' });
            brands.push({ brand: 'Chromium', version: version });
        } else if (browser === 'edge') {
            brands.push({ brand: 'Microsoft Edge', version: version });
            brands.push({ brand: 'Not/A)Brand', version: '8' });
            brands.push({ brand: 'Chromium', version: version });
        }

        let uadPlatform = 'Windows';
        if (os === 'ubuntu') uadPlatform = 'Linux';
        else if (os === 'chromeos') uadPlatform = 'Chrome OS';

        const mockUAData = {
            brands: brands,
            mobile: false,
            platform: uadPlatform,
            getHighEntropyValues: function(hints) {
                return Promise.resolve({
                    brands: brands, mobile: false, platform: uadPlatform,
                    platformVersion: os === 'windows' ? '15.0.0' : '6.5.0',
                    architecture: 'x86', bitness: '64', model: '',
                    uaFullVersion: version + '.0.0.0',
                    fullVersionList: brands.map(b => ({ brand: b.brand, version: b.version + '.0.0.0' }))
                });
            },
            toJSON: function() {
                return { brands: this.brands, mobile: this.mobile, platform: this.platform };
            }
        };

        try {
            Object.defineProperty(navigator, 'userAgentData', {
                get: () => mockUAData, configurable: true
            });
        } catch(e) {}
    } else {
        // Firefox não tem userAgentData
        try {
            Object.defineProperty(navigator, 'userAgentData', {
                get: () => undefined, configurable: true
            });
        } catch(e) {}
    }

    // 9. Plugins (remover plugins exclusivos do Opera)
    if (browser !== 'firefox') {
        const fakePlugins = {
            0: { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 1 },
            1: { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 1 },
            2: { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 1 },
            3: { name: 'Native Client', filename: 'internal-nacl-plugin', description: '', length: 2 },
            length: 4,
            item: function(i) { return this[i] || null; },
            namedItem: function(name) {
                for (let i = 0; i < this.length; i++) { if (this[i] && this[i].name === name) return this[i]; }
                return null;
            },
            refresh: function() {}
        };
        fakePlugins[Symbol.iterator] = function*() { for (let i = 0; i < this.length; i++) yield this[i]; };
        try {
            Object.defineProperty(navigator, 'plugins', {
                get: () => fakePlugins, configurable: true
            });
        } catch(e) {}
    }

    // 10. mimeTypes
    if (browser !== 'firefox') {
        const fakeMimeTypes = {
            0: { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
            1: { type: 'text/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
            length: 2,
            item: function(i) { return this[i] || null; },
            namedItem: function(name) {
                for (let i = 0; i < this.length; i++) { if (this[i] && this[i].type === name) return this[i]; }
                return null;
            }
        };
        fakeMimeTypes[Symbol.iterator] = function*() { for (let i = 0; i < this.length; i++) yield this[i]; };
        try {
            Object.defineProperty(navigator, 'mimeTypes', {
                get: () => fakeMimeTypes, configurable: true
            });
        } catch(e) {}
    }
}

// =============================================
// Regras de Rede (Header HTTP)
// =============================================

function buildUAString(config) {
    const { os, browser, version } = config;
    let osString = "Windows NT 10.0; Win64; x64"; 
    if (os === 'ubuntu') osString = "X11; Ubuntu; Linux x86_64";
    else if (os === 'chromeos') osString = "X11; CrOS x86_64 14541.0.0";

    if (browser === 'firefox') {
        return `Mozilla/5.0 (${osString}; rv:${version}.0) Gecko/20100101 Firefox/${version}.0`;
    } else if (browser === 'edge') {
        return `Mozilla/5.0 (${osString}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36 Edg/${version}.0.0.0`;
    } else {
        return `Mozilla/5.0 (${osString}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36`;
    }
}

const UA_RULE_ID = 1001;

async function updateUARule(uaString) {
    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [UA_RULE_ID],
        addRules: [{
            id: UA_RULE_ID,
            priority: 1,
            action: {
                type: 'modifyHeaders',
                requestHeaders: [{ header: 'user-agent', operation: 'set', value: uaString }]
            },
            condition: {
                urlFilter: '|http*',
                resourceTypes: ['main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'object', 'xmlhttprequest', 'ping', 'csp_report', 'media', 'websocket', 'other']
            }
        }]
    });
}

async function removeUARule() {
    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [UA_RULE_ID]
    });
}
