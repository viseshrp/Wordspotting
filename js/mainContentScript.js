//contentscript to inject into websites.

//get extension status from storage then proceed to notifications.
getFromStorage("wordspotting_extension_on", function (items) {
    logit("checking if extension is on..");
    var status = items.wordspotting_extension_on;
    if (status) {
        proceedWithSiteListCheck();
    }

});

//listener for requests from popup.
chrome.runtime.onMessage.addListener(function (msg, sender, setWordList) {

    // First, validate the message's structure
    if ((msg.from === 'popup') && (msg.subject === 'word_list_request')) {

        getFromStorage("wordspotting_word_list", function (items) {
            //  items = [ { "yourBody": "myBody" } ]
            var keyword_list = items.wordspotting_word_list;

            if (isValidObj(keyword_list) && keyword_list.length > 0) {

                var occurring_word_list = getWordList(keyword_list);

                // Directly respond to the sender (popup),
                // through the specified callback */
                setWordList({word_list: occurring_word_list});
            }
        });
    }

    /*
    setWordList callback:
    This function becomes invalid when the event listener returns (synchronous),
     unless you return true from the event listener to indicate
      you wish to send a response asynchronously.
     (this will keep the message channel open to the other end until sendResponse is called).
     Since, getFromStorage runs and returns async-ly it takes time for the word_list to be
     populated. return true makes sure channel is open until the wordlist is obtained through
     getFromStorage and the response is sent.
    * */
    return true;
});

function getWordList(keyword_list) {

    var keyword_count = 0;

    var keywords_found = [];

    for (var key in keyword_list) {

        var word = keyword_list[key];

        // $("*:contains('" + word.toLowerCase() + "')")
        //get list of elements matching the word or regex,
        //whatever is in the key list.
        var filtered_elements = $("body").filter(function () {
            var regex = new RegExp(word, "ig");
            return regex.test($(this).text());
        });

        //if returned list length is greater than 0,
        //we know the doc's got the word somewhere,
        //now set bool and break.
        if (filtered_elements.length > 0) {

            keywords_found.push(word);

            // break; //dont break, because we need number of keywords found.
            keyword_count++;
        }
    }

    return keywords_found
}

function proceedWithSiteListCheck() {
    // get user specified list. If list exists/object exists/not empty - run using it.
    //else run and show browser-action badge on all websites.
    // todo: But don't run notifications on all sites, thats just annoying.
    getFromStorage("wordspotting_website_list", function (items) {
        var allowed_sites = items.wordspotting_website_list;
        if (isValidObj(allowed_sites) && allowed_sites.length > 0) { //always valid obj because I initialize storage.
            for (var key in allowed_sites) {
                var site = allowed_sites[key];
                var regex = new RegExp(site, "ig");

                //if one of the allowed sites matches regex, talk to the bgscript
                //to send a notification
                // and exit loop. Else keep looping.
                if (regex.test(location.href)) {
                    talkToBackgroundScript();
                    break;
                }
            }
        } else {
            //todo: do something if there is no user list.
            //send a message to bgscript and update browser action.
            logit("No site list object.");
        }
    });
}

function talkToBackgroundScript() {

    getFromStorage("wordspotting_word_list", function (items) {
        //  items = [ { "yourBody": "myBody" } ]
        var keyword_list = items.wordspotting_word_list;

        if (isValidObj(keyword_list) && keyword_list.length > 0) {

            var occurring_word_list = getWordList(keyword_list);

            logit("firing message from content script...");
            chrome.runtime.sendMessage({
                    wordfound: occurring_word_list.length > 0,
                    keyword_count: occurring_word_list.length
                },
                //this is the sendResponse method called from event/bg page.
                //the 'response argument' down here is the response_args
                //that are sent from eventpage through the sendResponse call.
                function (response) {
                    logit("eventPage acking: " + response.ack);
                });

        } else {
            //todo: do something if there is no user list.
            //send a message to bgscript and update browser action.
            logit("No word list object.");
        }
    });
}