document.addEventListener('DOMContentLoaded', () => {
    const snippetInput = document.getElementById('snippetInput');
    const tagInput = document.getElementById('tagInput');
    const addBtn = document.getElementById('addBtn');
    const snippetList = document.getElementById('snippetList');
    const tagFilter = document.getElementById('tagFilter');
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const fileInput = document.getElementById('fileInput');

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
