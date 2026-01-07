importScripts(chrome.runtime.getURL('src/js/core/scanner.js'));

self.addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.type !== 'scan') return;
    const id = data.id;

    try {
        const words = scanTextForKeywords(data.keywords, data.text);
        self.postMessage({ type: 'scan_result', id, words });
    } catch (e) {
        self.postMessage({ type: 'scan_error', id, error: e.message || 'scan_failed' });
    }
});
