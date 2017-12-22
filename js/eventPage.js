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
            }

        }
    });