let allSnippets = [];
let currentTagFilter = 'all';

// Função para limpar snippets expirados
function getValidSnippets(snippets) {
    const now = Date.now();
    return (snippets || []).filter(s => {
        if (typeof s === 'string') return true; 
        if (s.ttl === 0) return true;
        return (now - s.createdAt) < (s.ttl * 1000);
    });
}

// Carregar snippets inicialmente
chrome.storage.local.get(['snippets'], (result) => {
    allSnippets = getValidSnippets(result.snippets || []);
});

// Atualizar lista se houver mudança no storage
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.snippets) {
        allSnippets = getValidSnippets(changes.snippets.newValue || []);
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
    if (inputElement.isContentEditable || inputElement.getAttribute('contenteditable') === 'true') {
        inputElement.focus();
        document.execCommand('insertText', false, text);
    } else {
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
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

function renderMenu() {
    menu.innerHTML = '';
    
    // Header com filtro de tags
    const tags = new Set();
    allSnippets.forEach(s => {
        if (s.tags) s.tags.forEach(t => tags.add(t));
    });

    if (tags.size > 0) {
        const filterRow = document.createElement('div');
        filterRow.className = 'snippet-injector-filter-row';
        
        const allBtn = document.createElement('button');
        allBtn.textContent = 'Todas';
        allBtn.className = currentTagFilter === 'all' ? 'active' : '';
        allBtn.onclick = (e) => { e.stopPropagation(); currentTagFilter = 'all'; renderMenu(); };
        filterRow.appendChild(allBtn);

        Array.from(tags).sort().forEach(tag => {
            const btn = document.createElement('button');
            btn.textContent = tag;
            btn.className = currentTagFilter === tag ? 'active' : '';
            btn.onclick = (e) => { e.stopPropagation(); currentTagFilter = tag; renderMenu(); };
            filterRow.appendChild(btn);
        });
        menu.appendChild(filterRow);
    }

    const filteredSnippets = allSnippets.filter(s => {
        const sTags = typeof s === 'string' ? [] : (s.tags || []);
        if (currentTagFilter === 'all') return true;
        return sTags.includes(currentTagFilter);
    });

    if (filteredSnippets.length === 0) {
        const item = document.createElement('div');
        item.className = 'snippet-injector-menu-empty';
        item.textContent = 'Nenhum snippet';
        menu.appendChild(item);
    } else {
        filteredSnippets.forEach(snippet => {
            const snippetText = typeof snippet === 'string' ? snippet : snippet.text;
            const item = document.createElement('div');
            item.className = 'snippet-injector-menu-item';
            
            const textSpan = document.createElement('span');
            textSpan.textContent = snippetText;
            item.appendChild(textSpan);

            if (currentTagFilter === 'all' && snippet.tags && snippet.tags.length > 0) {
                const tagSpan = document.createElement('div');
                tagSpan.className = 'snippet-item-tags';
                snippet.tags.forEach(t => {
                    const b = document.createElement('span');
                    b.textContent = t;
                    tagSpan.appendChild(b);
                });
                item.appendChild(tagSpan);
            }

            item.addEventListener('click', () => {
                insertTextAtCursor(currentTargetInput, snippetText);
                menu.style.display = 'none';
                currentTargetInput.focus();
            });
            menu.appendChild(item);
        });
    }
}

// Abrir o menu flutuante
function openMenu(button, inputElement) {
    currentTargetInput = inputElement;
    renderMenu();

    const rect = button.getBoundingClientRect();
    menu.style.top = `${rect.bottom + window.scrollY + 5}px`;
    menu.style.left = `${rect.left + window.scrollX}px`;
    menu.style.display = 'block';
}

// ==========================================
// Módulo: Injeção de Botões
// ==========================================

const textInputsSelector = 'textarea, input[type="text"], input[type="search"], input[type="email"], input[type="url"], input:not([type]), [contenteditable="true"]';
const activeButtons = new Map();

function positionButton(inputElement, btn) {
    const rect = inputElement.getBoundingClientRect();
    
    // Verificação de visibilidade mais robusta
    const style = window.getComputedStyle(inputElement);
    if (rect.width === 0 || rect.height === 0 || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        btn.style.display = 'none';
        return;
    }
    
    btn.style.display = 'flex';
    btn.style.top = `${rect.top + window.scrollY + 5}px`;
    btn.style.left = `${rect.right + window.scrollX - 35}px`;
}

function injectButton(inputElement) {
    if (inputElement.dataset.hasSnippetBtn || inputElement.readOnly || inputElement.disabled) return;
    inputElement.dataset.hasSnippetBtn = "true";

    const btn = document.createElement('button');
    btn.className = 'snippet-injector-btn';
    btn.textContent = 'S';
    btn.title = 'Injetar Snippet';
    
    document.body.appendChild(btn);
    
    positionButton(inputElement, btn);
    setTimeout(() => positionButton(inputElement, btn), 100);
    setTimeout(() => positionButton(inputElement, btn), 500);

    activeButtons.set(inputElement, btn);

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

function findInputsInShadows(root) {
    if (root.querySelectorAll) {
        root.querySelectorAll(textInputsSelector).forEach(injectButton);
    }
    
    const all = root.querySelectorAll ? root.querySelectorAll('*') : [];
    all.forEach(el => {
        if (el.shadowRoot) {
            findInputsInShadows(el.shadowRoot);
        }
    });
}

function processNode(node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.matches && node.matches(textInputsSelector)) injectButton(node);
        node.querySelectorAll(textInputsSelector).forEach(injectButton);
        
        if (node.shadowRoot) findInputsInShadows(node.shadowRoot);
        node.querySelectorAll('*').forEach(el => {
            if (el.shadowRoot) findInputsInShadows(el.shadowRoot);
        });
    }
}

function init() {
    findInputsInShadows(document);
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => mutation.addedNodes.forEach(processNode));
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

if (document.body) {
    init();
} else {
    document.addEventListener('DOMContentLoaded', init);
}

window.addEventListener('scroll', () => {
    activeButtons.forEach((btn, inputElement) => positionButton(inputElement, btn));
    if (menu.style.display === 'block') menu.style.display = 'none';
}, true);

window.addEventListener('resize', () => {
    activeButtons.forEach((btn, inputElement) => positionButton(inputElement, btn));
});

// ==========================================
// Módulo: Calculadora de Ponto
// ==========================================

function calculateTimeDifference(timeStr) {
    const parts = timeStr.split(':');
    if (parts.length !== 2) return null;
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes)) return null;
    const totalMinutes = hours * 60 + minutes;
    const targetMinutes = 8 * 60;
    if (totalMinutes >= targetMinutes) return null;
    const missingMinutesTotal = targetMinutes - totalMinutes;
    const missingHours = Math.floor(missingMinutesTotal / 60);
    const missingMinutes = missingMinutesTotal % 60;
    return `${missingHours.toString().padStart(2, '0')}:${missingMinutes.toString().padStart(2, '0')}`;
}

function processTimesheet() {
    const dangerDays = document.querySelectorAll('li.day-danger');
    dangerDays.forEach(dayElement => {
        if (dayElement.hasAttribute('data-ctrv-processed')) return;
        let horasLancadasText = "";
        const elLancadas = dayElement.querySelector('div#horas-lancadas');
        if (elLancadas) {
            horasLancadasText = elLancadas.textContent;
        } else {
            const eventDescs = dayElement.querySelectorAll('.event-desc');
            eventDescs.forEach(el => {
                if (el.textContent.includes('Lançadas')) horasLancadasText = el.textContent;
            });
        }
        if (horasLancadasText) {
            const match = horasLancadasText.match(/(\d{1,2}:\d{2})/);
            if (match) {
                const missing = calculateTimeDifference(match[1]);
                if (missing) {
                    dayElement.setAttribute('data-ctrv-processed', 'true');
                    const eventContainer = dayElement.querySelector('.event');
                    if (eventContainer) {
                        const badge = document.createElement('div');
                        badge.className = 'ctrv-missing-time-badge';
                        badge.innerHTML = `⏳ <strong>Falta:</strong> ${missing}`;
                        eventContainer.appendChild(badge);
                    }
                }
            }
        }
    });
}

setTimeout(processTimesheet, 1500);
const timesheetObserver = new MutationObserver(() => {
    if (window.timesheetTimeout) clearTimeout(window.timesheetTimeout);
    window.timesheetTimeout = setTimeout(processTimesheet, 800);
});
timesheetObserver.observe(document.body, { childList: true, subtree: true });
