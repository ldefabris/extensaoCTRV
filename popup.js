document.addEventListener('DOMContentLoaded', () => {
    const snippetInput = document.getElementById('snippetInput');
    const tagInput = document.getElementById('tagInput');
    const addBtn = document.getElementById('addBtn');
    const snippetList = document.getElementById('snippetList');
    const tagFilter = document.getElementById('tagFilter');
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const fileInput = document.getElementById('fileInput');

    // Elementos do User-Agent
    const osSelect = document.getElementById('osSelect');
    const browserSelect = document.getElementById('browserSelect');
    const versionSelect = document.getElementById('versionSelect');
    const applyUABtn = document.getElementById('applyUABtn');
    const resetUABtn = document.getElementById('resetUABtn');
    const uaStatusIndicator = document.getElementById('uaStatusIndicator');

    // Configurações Hardcoded de Versões
    const browserVersions = {
        chrome: ['124', '123', '122', '121', '120'],
        firefox: ['125', '124', '123', '122'],
        edge: ['124', '123', '122', '121']
    };

    function populateVersions() {
        const browser = browserSelect.value;
        const versions = browserVersions[browser] || [];
        versionSelect.innerHTML = '';
        versions.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v;
            opt.textContent = `Versão ${v}`;
            versionSelect.appendChild(opt);
        });
    }

    browserSelect.addEventListener('change', populateVersions);
    
    // Inicializa as versões
    populateVersions();

    function updateUAStatusUI(isActive) {
        if (isActive) {
            uaStatusIndicator.textContent = '🟢 Ativo';
            uaStatusIndicator.style.color = 'var(--success)';
        } else {
            uaStatusIndicator.textContent = '⚪ Padrão';
            uaStatusIndicator.style.color = 'var(--text-light)';
        }
    }

    function loadUAState() {
        chrome.storage.local.get(['uaConfig'], (result) => {
            if (result.uaConfig) {
                osSelect.value = result.uaConfig.os || 'windows';
                browserSelect.value = result.uaConfig.browser || 'chrome';
                populateVersions();
                if (result.uaConfig.version) {
                    versionSelect.value = result.uaConfig.version;
                }
                updateUAStatusUI(result.uaConfig.active);
            }
        });
    }

    function buildUAString(os, browser, version) {
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

    applyUABtn.addEventListener('click', () => {
        const config = {
            os: osSelect.value,
            browser: browserSelect.value,
            version: versionSelect.value,
            active: true,
            uaString: buildUAString(osSelect.value, browserSelect.value, versionSelect.value)
        };
        chrome.storage.local.set({ uaConfig: config }, () => {
            chrome.runtime.sendMessage({ action: 'setUA', config: config }, (response) => {
                if (response && response.success) {
                    updateUAStatusUI(true);
                }
            });
        });
    });

    resetUABtn.addEventListener('click', () => {
        chrome.storage.local.get(['uaConfig'], (result) => {
            let config = result.uaConfig || {};
            config.active = false;
            chrome.storage.local.set({ uaConfig: config }, () => {
                chrome.runtime.sendMessage({ action: 'resetUA' }, (response) => {
                    if (response && response.success) {
                        updateUAStatusUI(false);
                    }
                });
            });
        });
    });

    loadUAState();

    let allSnippets = [];

    function renderEmptyMessage() {
        if (snippetList.children.length === 0) {
            const li = document.createElement('li');
            li.className = 'empty-msg';
            li.textContent = 'Nenhum snippet encontrado.';
            snippetList.appendChild(li);
        }
    }

    function removeEmptyMessage() {
        const emptyMsg = snippetList.querySelector('.empty-msg');
        if (emptyMsg) {
            emptyMsg.remove();
        }
    }

    function updateTagFilterOptions() {
        const tags = new Set();
        allSnippets.forEach(s => {
            if (s.tags) s.tags.forEach(t => tags.add(t));
        });
        
        const currentFilter = tagFilter.value;
        tagFilter.innerHTML = '<option value="all">Todas as tags</option>';
        Array.from(tags).sort().forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;
            tagFilter.appendChild(option);
        });
        tagFilter.value = currentFilter;
    }

    function cleanupExpiredSnippets(snippets) {
        const now = Date.now();
        return (snippets || []).filter(s => {
            if (typeof s === 'string') return true; 
            if (s.ttl === 0) return true; 
            return (now - s.createdAt) < (s.ttl * 1000);
        });
    }

    function migrateSnippets(snippets) {
        return snippets.map(s => {
            if (typeof s === 'string') {
                return {
                    id: 'migrated_' + Math.random().toString(36).substr(2, 9),
                    text: s,
                    createdAt: Date.now(),
                    ttl: 0,
                    tags: []
                };
            }
            return s;
        });
    }

    function loadSnippets() {
        chrome.storage.local.get(['snippets'], (result) => {
            let snippets = result.snippets || [];
            
            const cleaned = cleanupExpiredSnippets(snippets);
            const migrated = migrateSnippets(cleaned);
            
            if (JSON.stringify(snippets) !== JSON.stringify(migrated)) {
                chrome.storage.local.set({ snippets: migrated });
            }
            
            allSnippets = migrated;
            renderList();
            updateTagFilterOptions();
        });
    }

    function renderList() {
        snippetList.innerHTML = '';
        const filter = tagFilter.value;
        
        const filtered = allSnippets.filter(s => {
            if (filter === 'all') return true;
            return s.tags && s.tags.includes(filter);
        });

        if (filtered.length > 0) {
            filtered.forEach(addSnippetToDOM);
        } else {
            renderEmptyMessage();
        }
    }

    addBtn.addEventListener('click', () => {
        const text = snippetInput.value.trim();
        const tagsRaw = tagInput.value.trim();
        const ttl = parseInt(document.querySelector('input[name="ttl"]:checked').value);
        
        if (text) {
            const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(t => t !== '') : [];
            const newSnippet = {
                id: Date.now().toString(),
                text: text,
                createdAt: Date.now(),
                ttl: ttl,
                tags: tags
            };

            allSnippets.push(newSnippet);
            chrome.storage.local.set({ snippets: allSnippets }, () => {
                renderList();
                updateTagFilterOptions();
                snippetInput.value = '';
                tagInput.value = '';
            });
        }
    });

    tagFilter.addEventListener('change', renderList);

    function addSnippetToDOM(snippet) {
        const li = document.createElement('li');
        li.dataset.id = snippet.id;
        
        const content = document.createElement('div');
        content.className = 'snippet-content';
        content.textContent = snippet.text;
        
        const meta = document.createElement('div');
        meta.className = 'snippet-meta';
        
        if (snippet.tags && snippet.tags.length > 0) {
            snippet.tags.forEach(tag => {
                const badge = document.createElement('span');
                badge.className = 'tag-badge';
                badge.textContent = tag;
                meta.appendChild(badge);
            });
        }
        
        const ttlBadge = document.createElement('span');
        ttlBadge.className = 'ttl-badge';
        if (snippet.ttl === 0) {
            ttlBadge.textContent = '♾️ Permanente';
        } else {
            const expiresAt = snippet.createdAt + (snippet.ttl * 1000);
            const remainingSec = Math.round((expiresAt - Date.now()) / 1000);
            if (remainingSec > 3600) {
                ttlBadge.textContent = `⏳ ~${Math.round(remainingSec / 3600)}h resta`;
            } else if (remainingSec > 60) {
                ttlBadge.textContent = `⏳ ~${Math.round(remainingSec / 60)}min resta`;
            } else {
                ttlBadge.textContent = `⏳ <1min resta`;
            }
        }
        meta.appendChild(ttlBadge);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '&times;';
        deleteBtn.className = 'delete-btn';
        deleteBtn.title = 'Excluir snippet';
        
        deleteBtn.addEventListener('click', () => {
            allSnippets = allSnippets.filter(s => s.id !== snippet.id);
            chrome.storage.local.set({ snippets: allSnippets }, () => {
                li.remove();
                updateTagFilterOptions();
                renderEmptyMessage();
            });
        });

        li.appendChild(content);
        li.appendChild(meta);
        li.appendChild(deleteBtn);
        snippetList.appendChild(li);
    }

    // EXPORTAR
    exportBtn.addEventListener('click', () => {
        const dataStr = JSON.stringify(allSnippets, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `snippets_backup_${new Date().toISOString().slice(0,10)}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
    });

    // IMPORTAR
    importBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const imported = JSON.parse(event.target.result);
                if (Array.isArray(imported)) {
                    // Mesclar sem duplicatas por ID
                    const existingIds = new Set(allSnippets.map(s => s.id));
                    const newSnippets = imported.filter(s => {
                        const isNew = s.id && !existingIds.has(s.id);
                        const hasValidText = s.text && typeof s.text === 'string';
                        return isNew && hasValidText;
                    });
                    
                    if (newSnippets.length > 0) {
                        allSnippets = [...allSnippets, ...newSnippets];
                        chrome.storage.local.set({ snippets: allSnippets }, () => {
                            loadSnippets();
                            alert(`${newSnippets.length} novos snippets importados!`);
                        });
                    } else {
                        alert('Nenhum snippet novo encontrado no arquivo.');
                    }
                } else {
                    alert('Formato de arquivo inválido.');
                }
            } catch (err) {
                alert('Erro ao ler o arquivo JSON.');
            }
            fileInput.value = ''; // Reset para permitir re-importar o mesmo arquivo
        };
        reader.readAsText(file);
    });

    loadSnippets();
});
