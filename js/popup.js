$(document).ready(function () {

    chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
        var currTab = tabs[0];
        if (currTab) { // Sanity check
            chrome.tabs.sendMessage(
                tabs[0].id,
                {from: 'popup', subject: 'word_list_request'},
                // ...also specifying a callback to be called
                //    from the receiving end (content script)
                function (response) {
                    //error handling if it cant connect to the tab
                   if(response){
                       //set wordlist on popup
                       setWordList(response.word_list);
                       //set badgetext only for that tab
                       chrome.browserAction.setBadgeText({
                           text: response.word_list.length.toString(),
                           tabId: currTab.id
                       });
                   } else {
                       logit("Error occured. Try again.")
                   }
                });

        }
    });

    $("#options_btn").click(function () {
        if (chrome.runtime.openOptionsPage) {
            // New way to open options pages, if supported (Chrome 42+).
            chrome.runtime.openOptionsPage();
        } else {
            // Reasonable fallback.
            window.open(chrome.runtime.getURL('options.html'));
        }
    });

    function setWordList(list) {
        if (list.length > 0)
            $("#keyword_count").html("<strong>" + list + "</strong>");
    }

});