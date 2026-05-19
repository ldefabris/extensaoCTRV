chrome.storage.local.get(['uaConfig'], (result) => {
    if (result.uaConfig && result.uaConfig.active) {
        const { uaString, browser, version, os } = result.uaConfig;
        
        const code = `
            (function() {
                const ua = ${JSON.stringify(uaString)};
                const browser = ${JSON.stringify(browser)};
                const version = ${JSON.stringify(version)};
                const os = ${JSON.stringify(os)};
                
                // Sobrescreve navigator.userAgent
                Object.defineProperty(navigator, 'userAgent', {
                    get: () => ua,
                    configurable: true
                });
                
                // Sobrescreve navigator.appVersion
                Object.defineProperty(navigator, 'appVersion', {
                    get: () => ua,
                    configurable: true
                });

                // Sobrescreve navigator.userAgentData se existir no navegador hospedeiro
                if (navigator.userAgentData) {
                    const brands = [];
                    if (browser === 'chrome') {
                        brands.push({ brand: 'Google Chrome', version: version });
                        brands.push({ brand: 'Not/A)Brand', version: '8' });
                        brands.push({ brand: 'Chromium', version: version });
                    } else if (browser === 'edge') {
                        brands.push({ brand: 'Microsoft Edge', version: version });
                        brands.push({ brand: 'Not/A)Brand', version: '8' });
                        brands.push({ brand: 'Chromium', version: version });
                        brands.push({ brand: 'Google Chrome', version: version });
                    }
                    
                    let platform = 'Windows';
                    if (os === 'ubuntu') platform = 'Linux';
                    else if (os === 'chromeos') platform = 'Chrome OS';

                    const mockUserAgentData = {
                        brands: brands,
                        mobile: false,
                        platform: platform,
                        getHighEntropyValues: function(hints) {
                            return Promise.resolve({
                                brands: brands,
                                mobile: false,
                                platform: platform,
                                platformVersion: "10.0.0",
                                architecture: "x86",
                                bitness: "64",
                                model: "",
                                uaFullVersion: version + ".0.0.0",
                                fullVersionList: brands.map(b => ({ brand: b.brand, version: b.version + ".0.0.0" }))
                            });
                        }
                    };

                    Object.defineProperty(navigator, 'userAgentData', {
                        get: () => mockUserAgentData,
                        configurable: true
                    });
                }
            })();
        `;
        
        const script = document.createElement('script');
        script.textContent = code;
        (document.head || document.documentElement).appendChild(script);
        script.remove();
    }
});
