document.addEventListener('DOMContentLoaded', () => {

    // UI References
    const keywordContainer = document.getElementById("keyword_container");
    const addSiteBtn = document.getElementById("add_current_site");
    const addSiteSection = document.getElementById("add_site_section");
    const siteScopeSelect = document.getElementById("site_scope_select");
    const refreshOnAddToggle = document.getElementById("refresh_on_add");
    const scopeOptions = [
        { value: 'root', label: 'Root domain' },
        { value: 'subdomain', label: 'This subdomain' },
        { value: 'full', label: 'Full URL (exact match)' }
    ];
    const refreshPrefKey = "wordspotting_refresh_on_add";

    // Theme
    getFromStorage("wordspotting_theme").then((items) => {
        const theme = items.wordspotting_theme || 'system';
        applyTheme(theme);
    });
    getFromStorage(refreshPrefKey).then((items) => {
        if (refreshOnAddToggle) {
            refreshOnAddToggle.checked = items[refreshPrefKey] !== false;
        }
    });

    // Connect to Content Script
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        var currTab = tabs[0];
        if (currTab) {
            checkActivation(currTab).then((activation) => {
                if (!activation.allowed) {
                    setAddSiteVisibility(true);
                    renderEmpty("This site is not in your allowed list.");
                    return;
                }
                setAddSiteVisibility(false);

                if (!activation.hasPermission) {
                    setAddSiteVisibility(true);
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

    if (addSiteBtn) {
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
                if (refreshOnAddToggle?.checked) {
                    chrome.tabs.reload(tab.id);
                }
            } catch (e) {
                console.error("Failed to add site to allowlist", e);
                showAlert("Could not save site.", "Error", false);
            }
        });
        });
    }

    if (refreshOnAddToggle) {
        refreshOnAddToggle.addEventListener('change', () => {
            saveToStorage({ [refreshPrefKey]: refreshOnAddToggle.checked })
                .catch((e) => console.error("Failed to save refresh setting", e));
        });
    }

    if (siteScopeSelect) {
        siteScopeSelect.addEventListener('change', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (tab?.url) {
                updateSitePreview(tab.url);
            }
        });
        });
    }

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
        return siteScopeSelect?.value || 'root';
    }

    function buildPatternForTab(urlString, scope) {
        const patterns = buildPatternsForTab(urlString);
        const pattern = patterns[scope];
        if (!pattern) {
            throw new Error("Invalid URL");
        }
        return pattern;
    }

    function updateSitePreview(urlString) {
        try {
            updateScopeOptions(urlString);
        } catch (_e) {
        }
    }

    function buildPatternsForTab(urlString) {
        const url = new URL(urlString);
        const host = url.hostname;
        if (!host) throw new Error("Invalid URL");
        const full = url.href.split('#')[0];
        const subdomain = `*${host}*`;
        const parts = host.split('.').filter(Boolean);
        const rootHost = parts.length <= 2 ? host : parts.slice(-2).join('.');
        const root = `*${rootHost}*`;
        return { root, subdomain, full };
    }

    function updateScopeOptions(urlString) {
        if (!siteScopeSelect) return;
        const selectedValue = siteScopeSelect.value || 'root';
        const uniquePatterns = new Set();
        const optionsToRender = [];
        const patterns = buildPatternsForTab(urlString);

        scopeOptions.forEach((scopeOption) => {
            const pattern = patterns[scopeOption.value] || '';
            if (!pattern || uniquePatterns.has(pattern)) {
                return;
            }
            uniquePatterns.add(pattern);
            optionsToRender.push({
                value: scopeOption.value,
                text: `${scopeOption.label} (${pattern})`
            });
        });

        siteScopeSelect.innerHTML = '';
        optionsToRender.forEach((optionData) => {
            const option = document.createElement('option');
            option.value = optionData.value;
            option.textContent = optionData.text;
            siteScopeSelect.appendChild(option);
        });

        const hasSelected = optionsToRender.some((option) => option.value === selectedValue);
        if (hasSelected) {
            siteScopeSelect.value = selectedValue;
            return;
        }
        const rootOption = optionsToRender.find((option) => option.value === 'root');
        siteScopeSelect.value = rootOption ? rootOption.value : (optionsToRender[0]?.value || 'root');
    }

    function mergeUnique(existing, additions) {
        return Array.from(new Set([...(existing || []), ...(additions || [])]));
    }

    function setAddSiteVisibility(isVisible) {
        if (!addSiteSection) return;
        addSiteSection.style.display = isVisible ? '' : 'none';
    }

});
