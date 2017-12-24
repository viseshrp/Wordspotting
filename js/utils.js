/*
* Utils to abstract API calls.
* */

function saveToStorage(obj, callback) {
    chrome.storage.sync.set(obj, callback);
}

function getFromStorage(obj_key, callback) {
    chrome.storage.sync.get(obj_key, callback);
}

function showAlert(message, title, isSuccess) {

    toastr.options.escapeHtml = true;
    toastr.options.closeButton = true;

    if (isSuccess)
        toastr.success(message, title);
    else
        toastr.error(message, title);
}

function isValidObj(obj) {
    return !jQuery.isEmptyObject(obj) && typeof obj !== 'undefined' && obj !== null;
}

function trimAndClean(string) {
    return string.trim().replace(/\s+/g, '');
}

function logit(message) {
    var dt = new Date();
    var utcDate = dt.toUTCString();

    console.log("[" + utcDate + "]" + "\t" + message);
}