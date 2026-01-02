document.addEventListener('DOMContentLoaded', function () {

    chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
        var currTab = tabs[0];
        if (currTab) {
            chrome.tabs.sendMessage(
                currTab.id,
                {from: 'popup', subject: 'word_list_request'},
                function (response) {
                   if(chrome.runtime.lastError) {
                       // Content script might not be injected (e.g. chrome:// URL)
                       console.log("Could not connect to content script");
                       return;
                   }

                   if(response){
                       setWordList(response.word_list);

                       // Set badge text
                       if (response.word_list && response.word_list.length > 0) {
                            chrome.action.setBadgeText({
                                text: response.word_list.length.toString(),
                                tabId: currTab.id
                            });
                       } else {
                           chrome.action.setBadgeText({
                               text: "",
                               tabId: currTab.id
                           });
                       }
                   }
                });

        }
    });

    document.getElementById("options_btn").addEventListener("click", function () {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL('options.html'));
        }
    });

    function setWordList(list) {
        const container = document.getElementById("keyword_count");
        if (list && list.length > 0) {
            container.innerHTML = list.join(", ");
        } else {
            container.innerHTML = "None.";
        }
    }

});