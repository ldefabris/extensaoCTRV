// Utility for Google Drive Sync

const SYNC_FILE_NAME = 'snippet_injector_pro_backup.json';

async function getAuthToken(interactive = true) {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive }, (token) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(token);
            }
        });
    });
}

async function findSyncFile(token) {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${SYNC_FILE_NAME}' and trashed=false`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    return data.files && data.files.length > 0 ? data.files[0] : null;
}

async function uploadToDrive(token, snippets) {
    const file = await findSyncFile(token);
    const metadata = {
        name: SYNC_FILE_NAME,
        mimeType: 'application/json'
    };
    
    const body = JSON.stringify(snippets);
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([body], { type: 'application/json' }));

    let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    let method = 'POST';

    if (file) {
        url = `https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=multipart`;
        method = 'PATCH';
    }

    const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}` },
        body: form
    });

    return response.json();
}

async function downloadFromDrive(token) {
    const file = await findSyncFile(token);
    if (!file) return null;

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.json();
}

export { getAuthToken, uploadToDrive, downloadFromDrive };
