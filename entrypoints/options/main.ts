import './options.css';
import { getFromStorage, saveToStorage, showAlert, isValidObj, partitionSitePatterns, partitionKeywordPatterns, mergeUnique } from '@/utils/utils';

document.addEventListener('DOMContentLoaded', () => {
    updateViews();

    // --- Event Listeners ---

    // Sites
    const siteInput = document.getElementById("website_input") as HTMLInputElement;
    const siteBtn = document.getElementById("add_sites");
    const siteClearBtn = document.getElementById("clear_sites");

    if (siteBtn && siteInput) {
        siteBtn.addEventListener("click", () => addSite(siteInput));
        siteInput.addEventListener("keypress", (e) => {
            if (e.key === 'Enter') addSite(siteInput);
        });
    }
    if (siteClearBtn) {
        siteClearBtn.addEventListener("click", () => clearList("wordspotting_website_list", updateWebListDisplay));
    }

    // Keywords
    const wordInput = document.getElementById("bl_word_input") as HTMLInputElement;
    const wordBtn = document.getElementById("add_bl_word");
    const wordClearBtn = document.getElementById("clear_keywords");

    if (wordBtn && wordInput) {
        wordBtn.addEventListener("click", () => addWord(wordInput));
        wordInput.addEventListener("keypress", (e) => {
            if (e.key === 'Enter') addWord(wordInput);
        });
    }
    if (wordClearBtn) {
        wordClearBtn.addEventListener("click", () => clearList("wordspotting_word_list", updateBLWordListDisplay));
    }

    // Switches
    document.getElementById("notifications_switch")?.addEventListener("change", function (this: HTMLInputElement) {
        const status = this.checked;
        saveToStorage({"wordspotting_notifications_on": status}).then(() => {
            showAlert(`Notifications turned ${status ? "ON" : "OFF"}`, "Settings Saved", true);
        });
    });

    document.getElementById("extension_switch")?.addEventListener("change", function (this: HTMLInputElement) {
        const status = this.checked;
        saveToStorage({"wordspotting_extension_on": status}).then(() => {
            showAlert(`Extension turned ${status ? "ON" : "OFF"}`, "Settings Saved", true);
        });
    });

    // Highlight Switch
    const highlightSwitch = document.getElementById("highlight_switch") as HTMLInputElement;
    const colorRow = document.getElementById("highlight_color_row");
    if (highlightSwitch && colorRow) {
        highlightSwitch.addEventListener("change", function (this: HTMLInputElement) {
            const status = this.checked;
            colorRow.style.display = status ? "flex" : "none";
            saveToStorage({"wordspotting_highlight_on": status}).then(() => {
                showAlert(`Highlighting turned ${status ? "ON" : "OFF"}`, "Settings Saved", true);
            });
        });
    }

    // Highlight Color
    const colorInput = document.getElementById("highlight_color_input") as HTMLInputElement;
    if (colorInput) {
        colorInput.addEventListener("change", function (this: HTMLInputElement) {
            const color = this.value;
            saveToStorage({"wordspotting_highlight_color": color}).then(() => {
                // No alert
            });
        });
    }

    // Theme select
    const themeSelect = document.getElementById("theme_select") as HTMLSelectElement;
    if (themeSelect) {
        themeSelect.addEventListener("change", () => {
            const value = themeSelect.value;
            applyTheme(value);
            saveToStorage({"wordspotting_theme": value});
        });
    }

    // Delegate click for removing items
    document.body.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target?.classList.contains('chip')) {
            const type = target.dataset.type; // 'site' or 'word'
            const indexStr = target.dataset.index;
            if (type && indexStr) {
                const index = parseInt(indexStr, 10);
                removeIndex(type, index);
            }
        }
    });
});

// --- Logic ---

function addSite(input: HTMLInputElement) {
    const rawValue = input.value;
    if (!rawValue || !rawValue.trim()) {
        shakeInput(input);
        return;
    }

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

function addWord(input: HTMLInputElement) {
    const rawValue = input.value;
    if (!rawValue || !rawValue.trim()) {
        shakeInput(input);
        return;
    }

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

function removeIndex(type: string, index: number) {
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

function clearList(key: string, updateFn: () => void) {
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
    updateHighlightSettingsDisplay();
    updateBLWordListDisplay();
    updateThemeDisplay();
}

function updateWebListDisplay() {
    getFromStorage("wordspotting_website_list").then((items) => {
        const stored = items.wordspotting_website_list;
        const container = document.getElementById("website_list_container");
        if (!container) return;
        container.innerHTML = "";

        if (isValidObj(stored) && stored.length > 0) {
            stored.forEach((item: string, index: number) => {
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
        if (!container) return;
        container.innerHTML = "";

        if (isValidObj(stored) && stored.length > 0) {
            stored.forEach((item: string, index: number) => {
                const chip = createChip(item, index, 'word');
                container.appendChild(chip);
            });
        } else {
            container.innerHTML = "<small>No keywords added.</small>";
        }
    });
}

function createChip(text: string, index: number, type: string) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = text;
    chip.dataset.index = String(index);
    chip.dataset.type = type;
    chip.title = "Click to remove";
    chip.setAttribute('aria-label', `Remove ${text}`);
    return chip;
}

function updateNotifSwitchDisplay() {
    getFromStorage("wordspotting_notifications_on").then((items) => {
        const status = items.wordspotting_notifications_on;
        const el = document.getElementById("notifications_switch") as HTMLInputElement;
        if (el) el.checked = (status !== false);
    });
}

function updateExtSwitchDisplay() {
    getFromStorage("wordspotting_extension_on").then((items) => {
        const status = items.wordspotting_extension_on;
        const el = document.getElementById("extension_switch") as HTMLInputElement;
        if (el) el.checked = (status !== false);
    });
}

function updateHighlightSettingsDisplay() {
    getFromStorage(["wordspotting_highlight_on", "wordspotting_highlight_color"]).then((items) => {
        const status = items.wordspotting_highlight_on === true;
        const color = items.wordspotting_highlight_color || "#FFFF00";

        const sw = document.getElementById("highlight_switch") as HTMLInputElement;
        const ci = document.getElementById("highlight_color_input") as HTMLInputElement;
        const row = document.getElementById("highlight_color_row");

        if (sw) sw.checked = status;
        if (ci) ci.value = color;
        if (row) row.style.display = status ? "flex" : "none";
    });
}

function shakeInput(input: HTMLInputElement) {
    input.style.borderColor = "var(--danger-color)";
    setTimeout(() => {
        input.style.borderColor = "var(--border-color)";
    }, 500);
}

function updateThemeDisplay() {
    getFromStorage("wordspotting_theme").then((items) => {
        const theme = items.wordspotting_theme || 'system';
        const select = document.getElementById("theme_select") as HTMLSelectElement;
        if (select) select.value = theme;
        applyTheme(theme);
    });
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
