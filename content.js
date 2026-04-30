let snippets = [];

// Carregar snippets inicialmente
chrome.storage.local.get(['snippets'], (result) => {
    snippets = result.snippets || [];
});

// Atualizar lista se houver mudança no storage
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.snippets) {
        snippets = changes.snippets.newValue || [];
    }
});

// Container para o menu de snippets
const menu = document.createElement('div');
menu.className = 'snippet-injector-menu';
document.body.appendChild(menu);

let currentTargetInput = null;

// Fechar menu ao clicar fora
document.addEventListener('click', (e) => {
    if (!e.target.closest('.snippet-injector-menu') && !e.target.closest('.snippet-injector-btn')) {
        menu.style.display = 'none';
    }
});

// Função para inserir texto na posição do cursor
function insertTextAtCursor(inputElement, text) {
    if (inputElement.selectionStart || inputElement.selectionStart === 0) {
        const startPos = inputElement.selectionStart;
        const endPos = inputElement.selectionEnd;
        const value = inputElement.value;
        inputElement.value = value.substring(0, startPos) + text + value.substring(endPos, value.length);
        inputElement.selectionStart = startPos + text.length;
        inputElement.selectionEnd = startPos + text.length;
    } else {
        inputElement.value += text;
    }

    // Disparar eventos para garantir compatibilidade com React, Vue, Gmail, etc.
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
}

// Abrir o menu flutuante
function openMenu(button, inputElement) {
    currentTargetInput = inputElement;
    menu.innerHTML = '';
    
    if (snippets.length === 0) {
        const item = document.createElement('div');
        item.className = 'snippet-injector-menu-empty';
        item.textContent = 'Nenhum snippet salvo';
        menu.appendChild(item);
    } else {
        snippets.forEach(snippetText => {
            const item = document.createElement('div');
            item.className = 'snippet-injector-menu-item';
            item.textContent = snippetText;
            item.addEventListener('click', () => {
                insertTextAtCursor(currentTargetInput, snippetText);
                menu.style.display = 'none';
                currentTargetInput.focus();
            });
            menu.appendChild(item);
        });
    }

    const rect = button.getBoundingClientRect();
    menu.style.top = `${rect.bottom + window.scrollY + 5}px`;
    menu.style.left = `${rect.left + window.scrollX}px`;
    menu.style.display = 'block';
}

const activeButtons = new Map();

// Atualizar a posição do botão com base no input
function positionButton(inputElement, btn) {
    const rect = inputElement.getBoundingClientRect();
    
    // Se o elemento estiver invisível ou com tamanho zero, ocultar o botão
    if (rect.width === 0 || rect.height === 0 || window.getComputedStyle(inputElement).display === 'none') {
        btn.style.display = 'none';
        return;
    }
    
    btn.style.display = 'flex';
    btn.style.top = `${rect.top + window.scrollY + 5}px`;
    btn.style.left = `${rect.right + window.scrollX - 30}px`; // 30px da borda direita
}

// Injetar o botão "S" em um elemento
function injectButton(inputElement) {
    if (inputElement.dataset.hasSnippetBtn || inputElement.readOnly || inputElement.disabled) return;
    inputElement.dataset.hasSnippetBtn = "true";

    const btn = document.createElement('button');
    btn.className = 'snippet-injector-btn';
    btn.textContent = 'S';
    btn.title = 'Injetar Snippet';
    
    document.body.appendChild(btn);
    positionButton(inputElement, btn);
    activeButtons.set(inputElement, btn);

    // Ajustar posição se o elemento redimensionar
    const resizeObserver = new ResizeObserver(() => {
        positionButton(inputElement, btn);
    });
    resizeObserver.observe(inputElement);

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openMenu(btn, inputElement);
    });
}

// Atualizar botões ao rolar a página para mantê-los ancorados aos inputs
window.addEventListener('scroll', () => {
    activeButtons.forEach((btn, inputElement) => {
        positionButton(inputElement, btn);
    });
    if (menu.style.display === 'block') {
        menu.style.display = 'none';
    }
}, true); // Capturing phase para scrolls em contêineres internos

window.addEventListener('resize', () => {
    activeButtons.forEach((btn, inputElement) => {
        positionButton(inputElement, btn);
    });
});

// Processar nós adicionados via MutationObserver
function processNode(node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.tagName === 'TEXTAREA' || (node.tagName === 'INPUT' && node.type === 'text')) {
            injectButton(node);
        }
        
        // Buscar dentro do nó se for um contêiner
        const inputs = node.querySelectorAll('textarea, input[type="text"]');
        inputs.forEach(injectButton);
    }
}

// Escanear inicialmente a página
document.querySelectorAll('textarea, input[type="text"]').forEach(injectButton);

// Observar mudanças no DOM para elementos dinâmicos (ex: React, Vue)
const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
        mutation.addedNodes.forEach(processNode);
    });
});

observer.observe(document.body, { childList: true, subtree: true });
