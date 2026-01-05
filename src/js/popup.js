document.addEventListener('DOMContentLoaded', () => {

    // UI References
    const keywordContainer = document.getElementById("keyword_container");
    const addSiteBtn = document.getElementById("add_current_site");
    const siteScopeRadios = document.querySelectorAll('input[name="site_scope"]');
    const sitePreview = document.getElementById("site_preview");

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
            updateSitePreview(currTab.url);
        }
    });

    addSiteBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            const tab = tabs[0];
            if (!tab || !tab.url) return;

            const scope = getSelectedScope();
            const pattern = buildPatternForTab(tab.url, scope);

            try {
                const items = await getFromStorage("wordspotting_website_list");
                const existing = Array.isArray(items.wordspotting_website_list) ? items.wordspotting_website_list : [];
                const merged = mergeUnique(existing, [pattern]);
                await saveToStorage({ wordspotting_website_list: merged });
                showAlert(`Added "${pattern}" to allowlist`, "Saved", true);
            } catch (e) {
                console.error("Failed to add site to allowlist", e);
                showAlert("Could not save site.", "Error", false);
            }
        });
    });

    siteScopeRadios.forEach((radio) => {
        radio.addEventListener('change', () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (tab?.url) {
                    updateSitePreview(tab.url);
                }
            });
        });
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
            updateSitePreview(tab.url);
            return { allowed, hasPermission: true };
        } catch (e) {
            console.error("Activation check failed:", e);
            return { allowed: false, hasPermission: false };
        }
    }

    function getSelectedScope() {
        const selected = Array.from(siteScopeRadios).find((r) => r.checked);
        return selected ? selected.value : 'root';
    }

    function buildPatternForTab(urlString, scope) {
        const url = new URL(urlString);
        const host = url.hostname;
        if (!host) throw new Error("Invalid URL");
        if (scope === 'full') {
            return url.href.split('#')[0];
        }
        if (scope === 'subdomain') {
            return host;
        }
        const parts = host.split('.').filter(Boolean);
        if (parts.length <= 2) return host;
        return parts.slice(-2).join('.');
    }

    function updateSitePreview(urlString) {
        try {
            const scope = getSelectedScope();
            const pattern = buildPatternForTab(urlString, scope);
            sitePreview.textContent = `Will add: ${pattern}`;
        } catch (_e) {
            sitePreview.textContent = '';
        }
    }

    function mergeUnique(existing, additions) {
        return Array.from(new Set([...(existing || []), ...(additions || [])]));
    }

});
