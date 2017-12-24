/*
* Utils to abstract API calls.
* */

function saveToStorage(obj, callback) {
    chrome.storage.sync.set(obj, callback);
}

function getFromStorage(obj_key, callback) {
    chrome.storage.sync.get(obj_key, callback);
}
