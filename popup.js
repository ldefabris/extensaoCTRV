document.addEventListener('DOMContentLoaded', () => {
    const snippetInput = document.getElementById('snippetInput');
    const addBtn = document.getElementById('addBtn');
    const snippetList = document.getElementById('snippetList');

    function renderEmptyMessage() {
        if (snippetList.children.length === 0) {
            const li = document.createElement('li');
            li.className = 'empty-msg';
            li.textContent = 'Nenhum snippet salvo.';
            snippetList.appendChild(li);
        }
    }

    function removeEmptyMessage() {
        const emptyMsg = snippetList.querySelector('.empty-msg');
        if (emptyMsg) {
            emptyMsg.remove();
        }
    }

    // Carregar snippets existentes
    chrome.storage.local.get(['snippets'], (result) => {
        const snippets = result.snippets || [];
        if (snippets.length > 0) {
            snippets.forEach(addSnippetToList);
        } else {
            renderEmptyMessage();
        }
    });

    addBtn.addEventListener('click', () => {
        const text = snippetInput.value.trim();
        if (text) {
            chrome.storage.local.get(['snippets'], (result) => {
                const snippets = result.snippets || [];
                // Evitar duplicatas (opcional)
                if (!snippets.includes(text)) {
                    snippets.push(text);
                    chrome.storage.local.set({ snippets }, () => {
                        removeEmptyMessage();
                        addSnippetToList(text);
                        snippetInput.value = '';
                    });
                } else {
                    alert('Este snippet já existe!');
                }
            });
        }
    });

    function addSnippetToList(text) {
        const li = document.createElement('li');
        
        const span = document.createElement('span');
        span.textContent = text;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'X';
        deleteBtn.className = 'delete-btn';
        deleteBtn.title = 'Excluir snippet';
        
        deleteBtn.addEventListener('click', () => {
            chrome.storage.local.get(['snippets'], (result) => {
                let snippets = result.snippets || [];
                snippets = snippets.filter(s => s !== text);
                chrome.storage.local.set({ snippets }, () => {
                    li.remove();
                    renderEmptyMessage();
                });
            });
        });

        li.appendChild(span);
        li.appendChild(deleteBtn);
        snippetList.appendChild(li);
    }
});
