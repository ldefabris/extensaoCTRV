// inject_ua.js - Spoofing completo de identidade do navegador
// Executado em document_start para interceptar antes de qualquer script da página

chrome.storage.local.get(['uaConfig'], (result) => {
    if (result.uaConfig && result.uaConfig.active) {
        const { uaString, browser, version, os } = result.uaConfig;
        
        const code = `
            (function() {
                const ua = ${JSON.stringify(uaString)};
                const browser = ${JSON.stringify(browser)};
                const version = ${JSON.stringify(version)};
                const os = ${JSON.stringify(os)};
                
                // =============================================
                // 1. Sobrescreve navigator.userAgent
                // =============================================
                Object.defineProperty(navigator, 'userAgent', {
                    get: () => ua,
                    configurable: true
                });
                
                // =============================================
                // 2. Sobrescreve navigator.appVersion
                // =============================================
                Object.defineProperty(navigator, 'appVersion', {
                    get: () => ua.replace('Mozilla/', ''),
                    configurable: true
                });

                // =============================================
                // 3. Sobrescreve navigator.platform
                // =============================================
                let platformValue = 'Win32';
                if (os === 'ubuntu') platformValue = 'Linux x86_64';
                else if (os === 'chromeos') platformValue = 'Linux x86_64';

                Object.defineProperty(navigator, 'platform', {
                    get: () => platformValue,
                    configurable: true
                });

                // =============================================
                // 4. Sobrescreve navigator.vendor
                // =============================================
                let vendorValue = 'Google Inc.';
                if (browser === 'firefox') vendorValue = '';

                Object.defineProperty(navigator, 'vendor', {
                    get: () => vendorValue,
                    configurable: true
                });

                // =============================================
                // 5. Sobrescreve navigator.appName
                // =============================================
                Object.defineProperty(navigator, 'appName', {
                    get: () => 'Netscape',
                    configurable: true
                });

                // =============================================
                // 6. Sobrescreve navigator.product
                // =============================================
                Object.defineProperty(navigator, 'product', {
                    get: () => 'Gecko',
                    configurable: true
                });

                // =============================================
                // 7. Sobrescreve navigator.productSub
                // =============================================
                let productSubValue = '20030107';
                if (browser === 'firefox') productSubValue = '20100101';
                
                Object.defineProperty(navigator, 'productSub', {
                    get: () => productSubValue,
                    configurable: true
                });

                // =============================================
                // 8. Remove rastros do Opera (window.opr)
                // =============================================
                try {
                    if (window.opr) {
                        Object.defineProperty(window, 'opr', {
                            get: () => undefined,
                            configurable: true
                        });
                    }
                } catch(e) {}

                try {
                    if (window.opera) {
                        Object.defineProperty(window, 'opera', {
                            get: () => undefined,
                            configurable: true
                        });
                    }
                } catch(e) {}

                // =============================================
                // 9. Sobrescreve navigator.userAgentData 
                //    (Client Hints API moderna)
                // =============================================
                if (navigator.userAgentData || browser !== 'firefox') {
                    const brands = [];
                    if (browser === 'chrome') {
                        brands.push({ brand: 'Google Chrome', version: version });
                        brands.push({ brand: 'Not/A)Brand', version: '8' });
                        brands.push({ brand: 'Chromium', version: version });
                    } else if (browser === 'edge') {
                        brands.push({ brand: 'Microsoft Edge', version: version });
                        brands.push({ brand: 'Not/A)Brand', version: '8' });
                        brands.push({ brand: 'Chromium', version: version });
                    } else if (browser === 'firefox') {
                        // Firefox não implementa userAgentData
                        try {
                            Object.defineProperty(navigator, 'userAgentData', {
                                get: () => undefined,
                                configurable: true
                            });
                        } catch(e) {}
                    }
                    
                    if (browser !== 'firefox') {
                        let uadPlatform = 'Windows';
                        if (os === 'ubuntu') uadPlatform = 'Linux';
                        else if (os === 'chromeos') uadPlatform = 'Chrome OS';

                        const mockUserAgentData = {
                            brands: brands,
                            mobile: false,
                            platform: uadPlatform,
                            getHighEntropyValues: function(hints) {
                                return Promise.resolve({
                                    brands: brands,
                                    mobile: false,
                                    platform: uadPlatform,
                                    platformVersion: os === 'windows' ? '15.0.0' : '6.5.0',
                                    architecture: 'x86',
                                    bitness: '64',
                                    model: '',
                                    uaFullVersion: version + '.0.0.0',
                                    fullVersionList: brands.map(b => ({
                                        brand: b.brand,
                                        version: b.version + '.0.0.0'
                                    }))
                                });
                            },
                            toJSON: function() {
                                return {
                                    brands: this.brands,
                                    mobile: this.mobile,
                                    platform: this.platform
                                };
                            }
                        };

                        Object.defineProperty(navigator, 'userAgentData', {
                            get: () => mockUserAgentData,
                            configurable: true
                        });
                    }
                }

                // =============================================
                // 10. Sobrescreve navigator.plugins para 
                //     remover rastros do Opera e manter 
                //     apenas plugins padrão do Chrome
                // =============================================
                if (browser !== 'firefox') {
                    const fakePlugins = {
                        0: { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 1 },
                        1: { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 1 },
                        2: { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 1 },
                        3: { name: 'Native Client', filename: 'internal-nacl-plugin', description: '', length: 2 },
                        length: 4,
                        item: function(i) { return this[i] || null; },
                        namedItem: function(name) {
                            for (let i = 0; i < this.length; i++) {
                                if (this[i] && this[i].name === name) return this[i];
                            }
                            return null;
                        },
                        refresh: function() {}
                    };
                    // Tornar iterável
                    fakePlugins[Symbol.iterator] = function*() {
                        for (let i = 0; i < this.length; i++) yield this[i];
                    };

                    try {
                        Object.defineProperty(navigator, 'plugins', {
                            get: () => fakePlugins,
                            configurable: true
                        });
                    } catch(e) {}
                }

                // =============================================
                // 11. Sobrescreve navigator.mimeTypes 
                //     para consistência
                // =============================================
                if (browser !== 'firefox') {
                    const fakeMimeTypes = {
                        0: { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
                        1: { type: 'text/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
                        length: 2,
                        item: function(i) { return this[i] || null; },
                        namedItem: function(name) {
                            for (let i = 0; i < this.length; i++) {
                                if (this[i] && this[i].type === name) return this[i];
                            }
                            return null;
                        }
                    };
                    fakeMimeTypes[Symbol.iterator] = function*() {
                        for (let i = 0; i < this.length; i++) yield this[i];
                    };

                    try {
                        Object.defineProperty(navigator, 'mimeTypes', {
                            get: () => fakeMimeTypes,
                            configurable: true
                        });
                    } catch(e) {}
                }

            })();
        `;
        
        const script = document.createElement('script');
        script.textContent = code;
        (document.head || document.documentElement).appendChild(script);
        script.remove();
    }
});
