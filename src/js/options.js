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

    const { valid, invalid } = partitionSitePatterns(list);

    if (invalid.length > 0) {
        showAlert(`Skipped invalid pattern(s): ${invalid.join(", ")}`, "Validation", false);
    }

    if (valid.length === 0) {
        shakeInput(input);
        return;
    }

    getFromStorage("wordspotting_website_list").then((items) => {
        const stored = Array.isArray(items.wordspotting_website_list) ? items.wordspotting_website_list : [];
        const merged = mergeUnique(stored, valid);
        return saveToStorage({"wordspotting_website_list": merged});
    }).then(() => {
        input.value = "";
        updateWebListDisplay();
        showAlert("Website(s) added.", "Success", true);
    }).catch(console.error);
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
            stored.splice(index, 1);
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
        saveToStorage({[key]: []}).then(() => {
            updateFn();
            showAlert("List cleared.", "Success", true);
        });
    }
}

function updateViews() {
    updateWebListDisplay();
    updateNotifSwitchDisplay();
    updateExtSwitchDisplay();
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
