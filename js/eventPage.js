/**
 A background page:
 Runs in the extension process.
 Holds main logic of the extension.
 Exists for the lifetime of the extension.
 Only triggered based on events as opposed to persistent bg pages. (persistent:false)
 Handles state and state changes of UI elements.
 */


chrome.runtime.onInstalled.addListener(function () {

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

            if (request.wordfound === true) {
                //fire notification.
                showNotification("img/48.png", 'basic',
                    'Keyword found!', sender.tab.title, 1);

            }

        }
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

    // var randomnumber = getRandomInt(1,5000000000);

    chrome.notifications.create('', opt, function () {
        logit('created!');
    });

}