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
    if (inputElement.isContentEditable || inputElement.getAttribute('contenteditable') === 'true') {
        inputElement.focus();
        // execCommand é obsoleto para formatação geral, mas ainda é a maneira mais confiável de inserir texto em editores ricos como WhatsApp sem quebrar o estado interno deles (React/Lexical).
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

        // Disparar eventos para garantir compatibilidade com React, Vue, Gmail, etc.
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));
    }
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

const textInputsSelector = 'textarea, input[type="text"], input[type="search"], input[type="email"], input[type="url"], input:not([type]), [contenteditable="true"]';

// Processar nós adicionados via MutationObserver
function processNode(node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.matches && node.matches(textInputsSelector)) {
            injectButton(node);
        }
        
        // Buscar dentro do nó se for um contêiner
        const inputs = node.querySelectorAll(textInputsSelector);
        inputs.forEach(injectButton);
    }
}

// Escanear inicialmente a página
document.querySelectorAll(textInputsSelector).forEach(injectButton);

// Observar mudanças no DOM para elementos dinâmicos (ex: React, Vue)
const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
        mutation.addedNodes.forEach(processNode);
    });
});

observer.observe(document.body, { childList: true, subtree: true });

// ==========================================
// Módulo: Calculadora de Ponto (Assistência Visual)
// ==========================================

function calculateTimeDifference(timeStr) {
    const parts = timeStr.split(':');
    if (parts.length !== 2) return null;
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes)) return null;
    
    const totalMinutes = hours * 60 + minutes;
    const targetMinutes = 8 * 60; // Jornada de 8h
    
    if (totalMinutes >= targetMinutes) return null; // Não falta nada
    
    const missingMinutesTotal = targetMinutes - totalMinutes;
    const missingHours = Math.floor(missingMinutesTotal / 60);
    const missingMinutes = missingMinutesTotal % 60;
    
    return `${missingHours.toString().padStart(2, '0')}:${missingMinutes.toString().padStart(2, '0')}`;
}

function processTimesheet() {
    // Busca todos os dias vermelhos (classe day-danger)
    const dangerDays = document.querySelectorAll('li.day-danger');
    
    dangerDays.forEach(dayElement => {
        // Previne processar o mesmo dia duas vezes
        if (dayElement.hasAttribute('data-ctrv-processed')) return;
        
        // Tenta encontrar o texto de horas lançadas
        let horasLancadasText = "";
        
        // Estratégia 1: Pelo ID repetido (como visto no HTML da imagem)
        const elLancadas = dayElement.querySelector('div#horas-lancadas');
        if (elLancadas) {
            horasLancadasText = elLancadas.textContent;
        } else {
            // Estratégia 2: Pela classe event-desc procurando a palavra "Lançadas"
            const eventDescs = dayElement.querySelectorAll('.event-desc');
            eventDescs.forEach(el => {
                if (el.textContent.includes('Lançadas')) {
                    horasLancadasText = el.textContent;
                }
            });
        }
        
        if (horasLancadasText) {
            // Extrai apenas o formato H:MM ou HH:MM do texto
            const match = horasLancadasText.match(/(\d{1,2}:\d{2})/);
            if (match) {
                const timeStr = match[1];
                const missing = calculateTimeDifference(timeStr);
                
                if (missing) {
                    // Marca o dia como processado para não duplicar o badge
                    dayElement.setAttribute('data-ctrv-processed', 'true');
                    
                    // Encontra o container .event para adicionar o badge lá dentro
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

// Executar após um pequeno delay para garantir que a tabela carregou
setTimeout(processTimesheet, 1500);

// Observar o DOM para processar novamente caso você mude de mês ou a página atualize via AJAX
const timesheetObserver = new MutationObserver((mutations) => {
    if (window.timesheetTimeout) clearTimeout(window.timesheetTimeout);
    window.timesheetTimeout = setTimeout(processTimesheet, 800);
});

timesheetObserver.observe(document.body, { childList: true, subtree: true });
