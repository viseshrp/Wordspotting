//contentscript to inject into websites.

var allowed_sites = [];

//get extension status from storage then proceed to notifications.
getFromStorage("wordspotting_extension_on", function (items) {
    var status = items.wordspotting_extension_on;
    if (status)
        proceedWithSiteListCheck();
});


function proceedWithSiteListCheck() {
    // get user specified list. If list exists/object exists/not empty - run using it.
    //else run and show browser-action badge on all websites.
    // todo: But don't run notifications on all sites, thats just annoying.
    getFromStorage("wordspotting_website_list", function (items) {
        var valid_site_list = items.wordspotting_website_list;
        if (isValidObj(valid_site_list)) {
            allowed_sites = items.wordspotting_website_list;
        } else
            allowed_sites = [];

        if (allowed_sites.length > 0) {
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
            logit("Not doing anything at the moment.");
        }
    });
}

function talkToBackgroundScript() {

    var isFound = false;

    getFromStorage("wordspotting_word_list", function (items) {
        //  items = [ { "yourBody": "myBody" } ]
        var keyword_list = items.wordspotting_word_list;

        if (isValidObj(keyword_list)) {

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
                    isFound = true;
                    logit("firing message from content script...");
                    //todo: put this inside is wordfound.
                    chrome.runtime.sendMessage({wordfound: isFound}, function (response) {
                        logit("eventPage acking: " + response.ack);
                    });

                    break;
                }
            }

        } else {
            logit("Word list empty.");
        }
    });
}
