//contentscript to inject into websites.

var allowed_sites = [];
var isSiteValid = false;

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

            //if one of the allowed sites matches regex, set true
            // and exit loop. Else keep looping.
            if (regex.test(location.href)) {
                isSiteValid = true;
                break;
            }
        }
    }

    if (isSiteValid) {
        logit("firing message from content script...");
        //fire event
        chrome.runtime.sendMessage({wordfound: isWordFound()}, function (response) {
            logit("eventPage acking: " + response.ack);
        });
    }
});

function isWordFound() {
    var isFound = false;
    var keyword_list = ['Citizenship', 'us citizen', 'clearance', 'security clearance'];
    //todo get it from options page. //might have to use message passing to get it.

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
            return isFound;
        }
    }

    return isFound;
}
