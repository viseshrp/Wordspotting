document.addEventListener('DOMContentLoaded', () => {

    // UI References
    const keywordContainer = document.getElementById("keyword_container");

    // Theme
    getFromStorage("wordspotting_theme").then((items) => {
        const theme = items.wordspotting_theme || 'system';
        applyTheme(theme);
    });

    // Connect to Content Script
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        var currTab = tabs[0];
        if (currTab) {
            checkActivation(currTab).then((activation) => {
                if (!activation.allowed) {
                    renderEmpty("This site is not in your allowed list.");
                    return;
                }

                if (!activation.hasPermission) {
                    renderEmpty("Permission not granted for this site.");
                    return;
                }

                chrome.tabs.sendMessage(
                    currTab.id,
                    {from: 'popup', subject: 'word_list_request'},
                    (response) => {
                       if(chrome.runtime.lastError) {
                           // Content script might not be injected yet
                           renderEmpty("Not active on this page.");
                           return;
                       }

                       if(response){
                           renderKeywords(response.word_list);

                           // Set badge text (sync with what we see)
                            const count = response.word_list ? response.word_list.length : 0;
                            chrome.action.setBadgeText({
                                text: count > 0 ? count.toString() : "0",
                                tabId: currTab.id
                           });
                       }
                    });
            });
        }
    });

    // Options Button
    document.getElementById("options_btn").addEventListener("click", () => {
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

    function applyTheme(value) {
        const root = document.documentElement;
        if (value === 'light') {
            root.setAttribute('data-theme', 'light');
        } else if (value === 'dark') {
            root.setAttribute('data-theme', 'dark');
        } else {
            root.removeAttribute('data-theme');
        }
    }

    async function checkActivation(tab) {
        try {
            const items = await getFromStorage("wordspotting_website_list");
            const allowedSites = items.wordspotting_website_list || [];
            const allowed = isUrlAllowed(tab.url, allowedSites);
            return { allowed, hasPermission: true };
        } catch (e) {
            console.error("Activation check failed:", e);
            return { allowed: false, hasPermission: false };
        }
    }

});
