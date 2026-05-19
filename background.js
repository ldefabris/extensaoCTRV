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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'setUA') {
        const uaString = buildUAString(request.config);
        updateUARule(uaString).then(() => sendResponse({ success: true }));
        return true; // Maintain message channel open for async response
    } else if (request.action === 'resetUA') {
        removeUARule().then(() => sendResponse({ success: true }));
        return true;
    }
});

function buildUAString(config) {
    const { os, browser, version } = config;
    let osString = "Windows NT 10.0; Win64; x64"; 
    
    if (os === 'ubuntu') {
        osString = "X11; Ubuntu; Linux x86_64";
    } else if (os === 'chromeos') {
        osString = "X11; CrOS x86_64 14541.0.0";
    }

    if (browser === 'firefox') {
        return `Mozilla/5.0 (${osString}; rv:${version}.0) Gecko/20100101 Firefox/${version}.0`;
    } else if (browser === 'edge') {
        return `Mozilla/5.0 (${osString}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36 Edg/${version}.0.0.0`;
    } else {
        // default chrome
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

// Ao iniciar o service worker, garantir que a regra está sincronizada com o storage
chrome.storage.local.get(['uaConfig'], (result) => {
    if (result.uaConfig && result.uaConfig.active) {
        const uaString = buildUAString(result.uaConfig);
        updateUARule(uaString);
    } else {
        removeUARule();
    }
});
