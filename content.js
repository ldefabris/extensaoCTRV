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

function migrateSnippets(snippets) {
    return (snippets || []).map(s => {
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

let btnOffsetX = -25;
let btnOffsetY = 5;

// Carregar snippets e preferências de posicionamento inicialmente
chrome.storage.local.get(['snippets', 'btnOffsetX', 'btnOffsetY'], (result) => {
    const rawSnippets = result.snippets || [];
    const migrated = migrateSnippets(rawSnippets);
    allSnippets = getValidSnippets(migrated);
    
    if (result.btnOffsetX !== undefined) btnOffsetX = result.btnOffsetX;
    if (result.btnOffsetY !== undefined) btnOffsetY = result.btnOffsetY;
    
    // Se houve migração, salva de volta
    if (JSON.stringify(rawSnippets) !== JSON.stringify(migrated)) {
        chrome.storage.local.set({ snippets: migrated });
    }
});

// Atualizar lista e preferências se houver mudança no storage
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        if (changes.snippets) {
            const migrated = migrateSnippets(changes.snippets.newValue || []);
            allSnippets = getValidSnippets(migrated);
        }
        if (changes.btnOffsetX || changes.btnOffsetY) {
            if (changes.btnOffsetX) btnOffsetX = changes.btnOffsetX.newValue;
            if (changes.btnOffsetY) btnOffsetY = changes.btnOffsetY.newValue;
            activeButtons.forEach((btn, inputElement) => {
                btn.dataset.offsetX = btnOffsetX;
                btn.dataset.offsetY = btnOffsetY;
                positionButton(inputElement, btn);
            });
        }
    }
});

// Container para o menu de snippets
const menu = document.createElement('div');
menu.className = 'snippet-injector-menu';
document.body.appendChild(menu);

// Previne que cliques e scroll no menu interajam com os elementos da página (ex: WhatsApp Web)
['mousedown', 'mouseup', 'click', 'wheel', 'keydown', 'keyup'].forEach(eventName => {
    menu.addEventListener(eventName, (e) => {
        e.stopPropagation();
    });
});

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
            let snippetText = '';
            if (typeof snippet === 'string') {
                snippetText = snippet;
            } else if (snippet && typeof snippet.text === 'string') {
                snippetText = snippet.text;
            } else if (snippet && snippet.text) {
                // Caso snippet.text seja algo inesperado, converte para string
                snippetText = String(snippet.text);
            } else {
                snippetText = 'Snippet sem conteúdo';
            }

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

    // Show menu invisibly to calculate its dimensions
    menu.style.visibility = 'hidden';
    menu.style.display = 'block';

    const rect = button.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();

    let topPos = rect.bottom + window.scrollY + 5;
    let leftPos = rect.left + window.scrollX;

    // Boundary detection - Vertical
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < menuRect.height + 10 && rect.top > menuRect.height) {
        // If not enough space below, but enough above, position above the button
        topPos = rect.top + window.scrollY - menuRect.height - 5;
    }

    // Boundary detection - Horizontal
    const spaceRight = window.innerWidth - rect.left;
    if (spaceRight < menuRect.width + 10) {
        // If not enough space to the right, shift it left (aligning right edges roughly)
        leftPos = rect.right + window.scrollX - menuRect.width;
        // Ensure it doesn't go off the left side
        if (leftPos < window.scrollX) leftPos = window.scrollX + 5;
    }

    menu.style.top = `${topPos}px`;
    menu.style.left = `${leftPos}px`;
    menu.style.visibility = 'visible';
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
    
    // Usa as coordenadas salvas no dataset ou as globais
    const offsetX = btn.dataset.offsetX !== undefined ? parseFloat(btn.dataset.offsetX) : btnOffsetX;
    const offsetY = btn.dataset.offsetY !== undefined ? parseFloat(btn.dataset.offsetY) : btnOffsetY;
    
    btn.style.display = 'flex';
    btn.style.top = `${rect.top + window.scrollY + offsetY}px`;
    btn.style.left = `${rect.right + window.scrollX + offsetX}px`;
}

function injectButton(inputElement) {
    if (inputElement.dataset.hasSnippetBtn || inputElement.readOnly || inputElement.disabled) return;
    inputElement.dataset.hasSnippetBtn = "true";

    const btn = document.createElement('button');
    btn.className = 'snippet-injector-btn';
    btn.textContent = 'S';
    btn.title = 'Injetar Snippet (Arraste com o botão esquerdo para reposicionar)';
    
    // Configura o dataset inicial com o offset global atual
    btn.dataset.offsetX = btnOffsetX;
    btn.dataset.offsetY = btnOffsetY;
    
    document.body.appendChild(btn);
    
    positionButton(inputElement, btn);
    setTimeout(() => positionButton(inputElement, btn), 100);
    setTimeout(() => positionButton(inputElement, btn), 500);

    activeButtons.set(inputElement, btn);

    const resizeObserver = new ResizeObserver(() => {
        positionButton(inputElement, btn);
    });
    resizeObserver.observe(inputElement);

    // Lógica de arrastar e soltar (Drag and Drop)
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startOffsetX = -25;
    let startOffsetY = 5;
    const dragThreshold = 5; // pixels mínimos de movimento para considerar arraste
    let hasMoved = false;

    btn.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Apenas botão esquerdo
        
        isDragging = true;
        hasMoved = false;
        startX = e.clientX;
        startY = e.clientY;
        startOffsetX = parseFloat(btn.dataset.offsetX || btnOffsetX);
        startOffsetY = parseFloat(btn.dataset.offsetY || btnOffsetY);
        
        btn.style.cursor = 'grabbing';
        
        e.preventDefault();
        e.stopPropagation();
        
        const onMouseMove = (moveEvent) => {
            if (!isDragging) return;
            
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;
            
            if (Math.abs(deltaX) > dragThreshold || Math.abs(deltaY) > dragThreshold) {
                hasMoved = true;
            }
            
            if (hasMoved) {
                btn.dataset.wasDragged = 'true';
                btn.dataset.offsetX = startOffsetX + deltaX;
                btn.dataset.offsetY = startOffsetY + deltaY;
                positionButton(inputElement, btn);
            }
        };
        
        const onMouseUp = () => {
            isDragging = false;
            btn.style.cursor = '';
            
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            
            if (hasMoved) {
                const finalOffsetX = parseFloat(btn.dataset.offsetX);
                const finalOffsetY = parseFloat(btn.dataset.offsetY);
                
                // Salva a nova preferência global no storage
                chrome.storage.local.set({ 
                    btnOffsetX: finalOffsetX, 
                    btnOffsetY: finalOffsetY 
                });
            }
        };
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (btn.dataset.wasDragged === 'true') {
            btn.dataset.wasDragged = 'false';
            return; // Ignora o clique se veio de um arraste
        }
        
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

window.addEventListener('scroll', (e) => {
    // Se o scroll foi originado dentro do nosso menu, não faça nada
    if (e.target === menu || menu.contains(e.target)) return;

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
