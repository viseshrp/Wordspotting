//global variables

//fire event

chrome.runtime.sendMessage({wordfound: isWordFound()}, function (response) {
    console.log(response.tab_url);
    console.log("contentscript ack: " + response.ack);
});

// other functions

function isWordFound() {
    var isFound = false;
    var keyword_list = ['Citizenship', 'us citizen', 'clearance', 'security clearance', 'sponsorship', 'contract'];
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

console.log(isWordFound());