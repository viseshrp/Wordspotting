if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        updateViews();

        // --- Event Listeners ---

        // Sites
        const siteInput = document.getElementById("website_input");
        const siteBtn = document.getElementById("add_sites");
        const siteClearBtn = document.getElementById("clear_sites");

        siteBtn.addEventListener("click", () => addSite(siteInput));
        siteInput.addEventListener("keypress", (e) => {
            if (e.key === 'Enter') addSite(siteInput);
        });
        siteClearBtn.addEventListener("click", () => clearList("wordspotting_website_list", updateWebListDisplay));

        // Keywords
        const wordInput = document.getElementById("bl_word_input");
        const wordBtn = document.getElementById("add_bl_word");
        const wordClearBtn = document.getElementById("clear_keywords");

        wordBtn.addEventListener("click", () => addWord(wordInput));
        wordInput.addEventListener("keypress", (e) => {
            if (e.key === 'Enter') addWord(wordInput);
        });
        wordClearBtn.addEventListener("click", () => clearList("wordspotting_word_list", updateBLWordListDisplay));

        // Switches
        document.getElementById("notifications_switch").addEventListener("change", function () {
            const status = this.checked;
            saveToStorage({"wordspotting_notifications_on": status}).then(() => {
                showAlert(`Notifications turned ${status ? "ON" : "OFF"}`, "Settings Saved", true);
            });
        });

        document.getElementById("extension_switch").addEventListener("change", function () {
            const status = this.checked;
            saveToStorage({"wordspotting_extension_on": status}).then(() => {
                showAlert(`Extension turned ${status ? "ON" : "OFF"}`, "Settings Saved", true);
            });
        });

        // Highlight Switch
        const highlightSwitch = document.getElementById("highlight_switch");
        const colorRow = document.getElementById("highlight_color_row");
        highlightSwitch.addEventListener("change", function () {
            const status = this.checked;
            colorRow.style.display = status ? "flex" : "none";
            saveToStorage({"wordspotting_highlight_on": status}).then(() => {
                showAlert(`Highlighting turned ${status ? "ON" : "OFF"}`, "Settings Saved", true);
            });
        });

        // Highlight Color
        const colorInput = document.getElementById("highlight_color_input");
        colorInput.addEventListener("change", function () {
            const color = this.value;
            saveToStorage({"wordspotting_highlight_color": color}).then(() => {
                // No alert needed for every color change, maybe just save silently
            });
        });

        // Theme select
        const themeSelect = document.getElementById("theme_select");
        themeSelect.addEventListener("change", () => {
            const value = themeSelect.value;
            applyTheme(value);
            saveToStorage({"wordspotting_theme": value});
        });

        // Delegate click for removing items
        document.body.addEventListener('click', (e) => {
            if (e.target?.classList.contains('chip')) {
                const type = e.target.dataset.type; // 'site' or 'word'
                const index = parseInt(e.target.dataset.index, 10);
                removeIndex(type, index);
            }
        });
    });
}

// --- Logic ---

function addSite(input) {
    const rawValue = input.value;
    if (!rawValue || !rawValue.trim()) {
        shakeInput(input);
        return;
    }

    // Split and Clean
    const list = rawValue.split(",").map((s) => s.trim()).filter((s) => s.length > 0);

    if (list.length === 0) {
        shakeInput(input);
        return;
    }

    // Convert user input into Chrome match patterns and request permissions.
    const expanded = [];
    const invalid = [];
    list.forEach((entry) => {
        const patterns = normalizeToMatchPatterns(entry);
        if (!patterns || patterns.length === 0) {
            invalid.push(entry);
        } else {
            expanded.push(...patterns);
        }
    });

    const uniqueExpanded = Array.from(new Set(expanded)).filter((p) => isValidMatchPattern(p));
    const valid = uniqueExpanded;

    if (invalid.length > 0) {
        showAlert(`Skipped invalid pattern(s): ${invalid.join(", ")}`, "Validation", false);
    }

    if (valid.length === 0) {
        shakeInput(input);
        return;
    }

    getFromStorage("wordspotting_website_list").then(async (items) => {
        const stored = Array.isArray(items.wordspotting_website_list) ? items.wordspotting_website_list : [];
        const merged = mergeUnique(stored, valid);

        // Request optional host permissions from a user gesture.
        const requested = await new Promise((resolve) => {
            chrome.permissions.request({ origins: valid }, (granted) => resolve(Boolean(granted)));
        });

        if (!requested) {
            showAlert("Permission request was denied. Nothing was added.", "Permission", false);
            return;
        }

        await saveToStorage({"wordspotting_website_list": merged});
    }).then(() => {
        input.value = "";
        updateWebListDisplay();
        showAlert("Website permission granted and saved.", "Success", true);
    }).catch((e) => {
        console.error(e);
        showAlert("Failed to request/save permissions.", "Error", false);
    });
}

function addWord(input) {
    const rawValue = input.value;
    if (!rawValue || !rawValue.trim()) {
        shakeInput(input);
        return;
    }

    // Split and Clean
    const list = rawValue.split(",").map((s) => s.trim()).filter((s) => s.length > 0);

    if (list.length === 0) {
        shakeInput(input);
        return;
    }

    const { valid, invalid } = partitionKeywordPatterns(list);

    if (invalid.length > 0) {
        showAlert(`Skipped invalid regex: ${invalid.join(", ")}`, "Validation", false);
    }

    if (valid.length === 0) {
        shakeInput(input);
        return;
    }

    getFromStorage("wordspotting_word_list").then((items) => {
        const stored = Array.isArray(items.wordspotting_word_list) ? items.wordspotting_word_list : [];
        const merged = mergeUnique(stored, valid);
        return saveToStorage({"wordspotting_word_list": merged});
    }).then(() => {
        input.value = "";
        updateBLWordListDisplay();
        showAlert("Keyword(s) added.", "Success", true);
    }).catch(console.error);
}

function removeIndex(type, index) {
    const key = (type === 'site') ? "wordspotting_website_list" : "wordspotting_word_list";

    getFromStorage(key).then((items) => {
        const stored = items[key];
        if (isValidObj(stored)) {
            const removed = stored.splice(index, 1);
            // Best-effort: remove permission for removed site pattern.
            if (type === 'site' && removed && removed[0]) {
                chrome.permissions.remove({ origins: [removed[0]] }, () => {
                    void chrome.runtime.lastError;
                });
            }
            return saveToStorage({[key]: stored});
        }
    }).then(() => {
        if (type === 'site') {
            updateWebListDisplay();
        } else {
            updateBLWordListDisplay();
        }
    });
}

function clearList(key, updateFn) {
    if (confirm("Are you sure you want to clear this list?")) {
        getFromStorage(key).then(async (items) => {
            const existing = Array.isArray(items[key]) ? items[key] : [];
            if (key === 'wordspotting_website_list' && existing.length > 0) {
                chrome.permissions.remove({ origins: existing }, () => {
                    void chrome.runtime.lastError;
                });
            }
            await saveToStorage({[key]: []});
        }).then(() => {
            updateFn();
            showAlert("List cleared.", "Success", true);
        });
    }
}

function updateViews() {
    updateWebListDisplay();
    updateNotifSwitchDisplay();
    updateExtSwitchDisplay();
    updateHighlightSettingsDisplay();
    updateBLWordListDisplay();
    updateThemeDisplay();
}

function updateWebListDisplay() {
    getFromStorage("wordspotting_website_list").then((items) => {
        const stored = items.wordspotting_website_list;
        const container = document.getElementById("website_list_container");
        container.innerHTML = "";

        if (isValidObj(stored) && stored.length > 0) {
            stored.forEach((item, index) => {
                const chip = createChip(item, index, 'site');
                container.appendChild(chip);
            });
        } else {
            container.innerHTML = "<small>No sites added.</small>";
        }
    });
}

function updateBLWordListDisplay() {
    getFromStorage("wordspotting_word_list").then((items) => {
        const stored = items.wordspotting_word_list;
        const container = document.getElementById("bl_word_list_container");
        container.innerHTML = "";

        if (isValidObj(stored) && stored.length > 0) {
            stored.forEach((item, index) => {
                const chip = createChip(item, index, 'word');
                container.appendChild(chip);
            });
        } else {
            container.innerHTML = "<small>No keywords added.</small>";
        }
    });
}

function createChip(text, index, type) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = text;
    chip.dataset.index = index;
    chip.dataset.type = type;
    chip.title = "Click to remove";
    chip.setAttribute('aria-label', `Remove ${text}`);
    return chip;
}

function updateNotifSwitchDisplay() {
    getFromStorage("wordspotting_notifications_on").then((items) => {
        const status = items.wordspotting_notifications_on;
        document.getElementById("notifications_switch").checked = (status !== false);
    });
}

function updateExtSwitchDisplay() {
    getFromStorage("wordspotting_extension_on").then((items) => {
        const status = items.wordspotting_extension_on;
        document.getElementById("extension_switch").checked = (status !== false);
    });
}

function updateHighlightSettingsDisplay() {
    getFromStorage(["wordspotting_highlight_on", "wordspotting_highlight_color"]).then((items) => {
        const status = items.wordspotting_highlight_on === true;
        const color = items.wordspotting_highlight_color || "#FFFF00";

        document.getElementById("highlight_switch").checked = status;
        document.getElementById("highlight_color_input").value = color;
        document.getElementById("highlight_color_row").style.display = status ? "flex" : "none";
    });
}

function shakeInput(input) {
    input.style.borderColor = "var(--danger-color)";
    setTimeout(() => {
        input.style.borderColor = "var(--border-color)";
    }, 500);
}

function updateThemeDisplay() {
    getFromStorage("wordspotting_theme").then((items) => {
        const theme = items.wordspotting_theme || 'system';
        const select = document.getElementById("theme_select");
        select.value = theme;
        applyTheme(theme);
    });
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

function partitionKeywordPatterns(list) {
    const valid = [];
    const invalid = [];

    list.forEach((item) => {
        try {
            // Validate regex
            new RegExp(item);
            valid.push(item);
        } catch (_e) {
            invalid.push(item);
        }
    });

    return { valid, invalid };
}

function partitionSitePatterns(list, siteRegexBuilder = buildSiteRegex) {
    const valid = [];
    const invalid = [];

    list.forEach((item) => {
        const regex = siteRegexBuilder(item);
        if (regex) {
            valid.push(item);
        } else {
            invalid.push(item);
        }
    });

    return { valid, invalid };
}

function mergeUnique(existing, additions) {
    return Array.from(new Set([...(existing || []), ...(additions || [])]));
}

/* istanbul ignore next */
if (typeof module !== 'undefined') {
    module.exports = {
        partitionSitePatterns,
        partitionKeywordPatterns,
        mergeUnique
    };
}
