/**
 A background page:
 Runs in the extension process.
 Holds main logic of the extension.
 Exists for the lifetime of the extension.
 Only triggered based on events as opposed to persistent bg pages. (persistent:false)
 Handles state and state changes of UI elements.
 */


chrome.runtime.onInstalled.addListener(function () {

    getFromStorage("is_first_start", function (item) {
        var is_first_start = item.is_first_start;

        //Hack: oninstalled is messed up. runs even on update. so we use this
        //to run only when it actually starts for the first time.
        //if the item is not valid, means its empty and hasnt been set before.
        //i.e. the extension never started before.
        //hence, we initialize storage values now. (aka. The Real Oninstalled.)
        if (is_first_start === null || typeof is_first_start === 'undefined') {
            logit("isfirstnotvalid");
            //initialize storage values on installation.
            saveToStorage({"wordspotting_notifications_on": true}, function () {
                //do nothing
            });
            saveToStorage({"wordspotting_extension_on": true}, function () {
                //do nothing
            });
            saveToStorage({"wordspotting_website_list": []}, function () {
                //nada
            });
            saveToStorage({"wordspotting_word_list": []}, function () {
                //nada
            });


            //and then set is_first_start as false, cos its starting now.
            saveToStorage({"is_first_start": false}, function () {
                logit("first start complete.")
            });

            //and then redirect user to options and tutorial.
            chrome.tabs.create({url: "options.html"});
            // chrome.tabs.create({ url: "http://www.viseshprasad.com/Wordspotting" });
        }
    });

});


//this listens to events fired by the contentscript
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {

        if (request.wordfound !== null) {

            sendResponse({
                ack: "gotcha", tab_url: sender.tab ?
                    "from a content script:" + sender.tab.url :
                    "from the extension"
            });
            //responds synchronously, after everything is done

            //set badgetext only for that tab
            //todo: get number of occurences and pass to text.
            chrome.browserAction.setBadgeText({text: "1", tabId: sender.tab.id});

            if (request.wordfound === true) {

                //first check if notifications are turned on
                getFromStorage("wordspotting_notifications_on", function (items) {
                    var status = items.wordspotting_notifications_on;
                    if (status) {
                        //fire
                        logit("firing notification!");
                        showNotification("img/48.png", 'basic',
                            'Keyword found!', sender.tab.title, 1);
                    } else {
                        logit("Notifications are " + status);
                        //do something else, like update a badge on browser action.
                    }
                });

            }

        }
    });


chrome.browserAction.onClicked.addListener(function (mql) {

});


//use chrome notifications api to fire notifications when a word is found in
//a web page.
function showNotification(iconUrl, type, title, message, priority) {

    var opt = {
        iconUrl: iconUrl,
        type: type,
        title: title,
        message: message,
        priority: priority
    };

    chrome.notifications.create('', opt, function () {
    });

}