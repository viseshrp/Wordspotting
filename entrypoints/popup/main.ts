import './popup.css';
import { getFromStorage, saveToStorage, showAlert, isUrlAllowed, buildPatternsForTab, mergeUnique } from '@/utils/utils';
import { browser } from 'wxt/browser';

document.addEventListener('DOMContentLoaded', () => {

    // UI References
    const keywordContainer = document.getElementById("keyword_container");
    const addSiteBtn = document.getElementById("add_current_site");
    const addSiteSection = document.getElementById("add_site_section");
    const siteScopeSelect = document.getElementById("site_scope_select") as HTMLSelectElement;
    const refreshOnAddToggle = document.getElementById("refresh_on_add") as HTMLInputElement;
    const scopeOptions = [
        { value: 'root', label: 'Root domain' },
        { value: 'subdomain', label: 'This subdomain' },
        { value: 'path', label: 'URL path' },
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
    browser.tabs.query({active: true, currentWindow: true}).then((tabs) => {
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

                if (!currTab.id) return;
                browser.tabs.sendMessage(currTab.id, {from: 'popup', subject: 'word_list_request'})
                    .then((response: any) => {
                       if(response){
                           renderKeywords(response.word_list);

                           // Set badge text (sync with what we see)
                            const count = response.word_list ? response.word_list.length : 0;
                           browser.action.setBadgeText({
                                text: count > 0 ? count.toString() : "0",
                                tabId: currTab.id
                           });
                       }
                    })
                    .catch((err) => {
                        // Content script might not be injected yet
                        renderEmpty("Not active on this page.");
                        console.warn(err);
                    });
            });
            if (currTab.url) {
                updateSitePreview(currTab.url);
            }
        }
    });

    if (addSiteBtn) {
        addSiteBtn.addEventListener('click', () => {
            browser.tabs.query({ active: true, currentWindow: true }).then(async (tabs) => {
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
                    setAddSiteVisibility(false);
                    window.close();
                    if (refreshOnAddToggle?.checked && tab.id) {
                        browser.tabs.reload(tab.id);
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
            browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
                const tab = tabs[0];
                if (tab?.url) {
                    updateSitePreview(tab.url);
                }
            });
        });
    }

    // Options Button
    const optionsBtn = document.getElementById("options_btn");
    if (optionsBtn) {
        optionsBtn.addEventListener("click", () => {
            if (browser.runtime.openOptionsPage) {
                browser.runtime.openOptionsPage();
            } else {
                window.open(browser.runtime.getURL('/options.html'));
            }
        });
    }

    function renderKeywords(list: string[]) {
        if (!keywordContainer) return;
        keywordContainer.innerHTML = "";

        if (!list || list.length === 0) {
            renderEmpty("No keywords found.");
            return;
        }

        const uniqueList = [...new Set(list)];

        uniqueList.forEach(word => {
            const chip = document.createElement("span");
            chip.className = "chip";
            chip.textContent = word;
            keywordContainer.appendChild(chip);
        });
    }

    function renderEmpty(msg: string) {
        if (!keywordContainer) return;
        keywordContainer.innerHTML = `<div class="empty-state">${msg}</div>`;
    }

    function applyTheme(value: string) {
        const root = document.documentElement;
        if (value === 'light') {
            root.setAttribute('data-theme', 'light');
        } else if (value === 'dark') {
            root.setAttribute('data-theme', 'dark');
        } else {
            root.removeAttribute('data-theme');
        }
    }

    async function checkActivation(tab: any) {
        try {
            if (!tab.url) return { allowed: false, hasPermission: false };
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

    function buildPatternForTab(urlString: string, scope: string) {
        const patterns: any = buildPatternsForTab(urlString);
        const pattern = patterns[scope];
        if (!pattern) {
            throw new Error("Invalid URL");
        }
        return pattern;
    }

    function updateSitePreview(urlString: string) {
        try {
            updateScopeOptions(urlString);
        } catch (e) {
            console.warn("Failed to update scope options", e);
        }
    }

    function updateScopeOptions(urlString: string) {
        if (!siteScopeSelect) return;
        const selectedValue = siteScopeSelect.value || 'root';
        const uniquePatterns = new Set();
        const optionsToRender: any[] = [];
        const patterns: any = buildPatternsForTab(urlString);

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

    function setAddSiteVisibility(isVisible: boolean) {
        if (!addSiteSection) return;
        addSiteSection.style.display = isVisible ? '' : 'none';
    }

});
