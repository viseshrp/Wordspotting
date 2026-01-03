document.addEventListener('DOMContentLoaded', function () {

    // UI References
    const extSwitch = document.getElementById("extension_switch");
    const keywordContainer = document.getElementById("keyword_container");
    const resultsWrapper = document.getElementById("results_wrapper");

    // Initialize Switch State
    getFromStorage("wordspotting_extension_on").then((items) => {
        const status = items.wordspotting_extension_on;
        extSwitch.checked = (status !== false);
        toggleResultsOpacity(status !== false);
    });

    // Handle Switch Change
    extSwitch.addEventListener("change", function () {
        const isChecked = this.checked;
        saveToStorage({"wordspotting_extension_on": isChecked}).then(() => {
            toggleResultsOpacity(isChecked);
            // Optionally reload current tab to reflect changes immediately?
            // chrome.tabs.reload();
        });
    });

    function toggleResultsOpacity(enabled) {
        if (enabled) {
            resultsWrapper.classList.remove("disabled-overlay");
        } else {
            resultsWrapper.classList.add("disabled-overlay");
        }
    }

    // Connect to Content Script
    chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
        var currTab = tabs[0];
        if (currTab) {
            chrome.tabs.sendMessage(
                currTab.id,
                {from: 'popup', subject: 'word_list_request'},
                function (response) {
                   if(chrome.runtime.lastError) {
                       // Content script might not be injected
                       renderEmpty("Not active on this page.");
                       return;
                   }

                   if(response){
                       renderKeywords(response.word_list);

                       // Set badge text (sync with what we see)
                       const count = response.word_list ? response.word_list.length : 0;
                       chrome.action.setBadgeText({
                            text: count > 0 ? count.toString() : "",
                            tabId: currTab.id
                       });
                   }
                });
        }
    });

    // Options Button
    document.getElementById("options_btn").addEventListener("click", function () {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL('options.html'));
        }
    });

    function renderKeywords(list) {
        keywordContainer.innerHTML = "";

        if (!list || list.length === 0) {
            renderEmpty("No keywords found.");
            return;
        }

        // Unique keywords
        const uniqueList = [...new Set(list)];

        uniqueList.forEach(word => {
            const chip = document.createElement("span");
            chip.className = "chip";
            chip.textContent = word;
            keywordContainer.appendChild(chip);
        });
    }

    function renderEmpty(msg) {
        keywordContainer.innerHTML = `<div class="empty-state">${msg}</div>`;
    }

});