/**
 A background page:
 Runs in the extension process.
 Holds main logic of the extension.
 Exists for the lifetime of the extension.
 Only triggered based on events as opposed to persistent bg pages. (persistent:false)
 Handles state and state changes of UI elements.
 */

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

function getRandomInt(maximum, minimum) {
    return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}