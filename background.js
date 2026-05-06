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
