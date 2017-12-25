$(document).ready(function () {
    chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
        var currTab = tabs[0];
        if (currTab) { // Sanity check
            chrome.browserAction.getBadgeText({tabId: currTab.id}, function (result) {
                if (result > 0)
                    $("#keyword_count").html("<h1><strong>" + result + "</strong></h1>");
            });
        }
    });
});