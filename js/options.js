document.addEventListener('DOMContentLoaded', function () {

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
            showAlert("Notifications turned " + (status ? "ON" : "OFF"), "Settings Saved", true);
        });
    });

    document.getElementById("extension_switch").addEventListener("change", function () {
        const status = this.checked;
        saveToStorage({"wordspotting_extension_on": status}).then(() => {
            showAlert("Extension turned " + (status ? "ON" : "OFF"), "Settings Saved", true);
        });
    });

    // Delegate click for removing items
    document.body.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('chip')) {
            const type = e.target.dataset.type; // 'site' or 'word'
            const index = parseInt(e.target.dataset.index);
            removeIndex(type, index);
        }
    });

});

// --- Logic ---

function addSite(input) {
    const rawValue = input.value;
    if (!rawValue || !rawValue.trim()) {
        shakeInput(input);
        return;
    }

    // Split and Clean
    let list = rawValue.split(",").map(s => s.trim()).filter(s => s.length > 0);

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
        let stored = items.wordspotting_website_list;
        if (isValidObj(stored)) {
            valid.forEach(w => stored.push(w));
        } else {
            stored = valid;
        }
        return saveToStorage({"wordspotting_website_list": stored});
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
    let list = rawValue.split(",").map(s => s.trim()).filter(s => s.length > 0);

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
        let stored = items.wordspotting_word_list;
        if (isValidObj(stored)) {
            valid.forEach(w => stored.push(w));
        } else {
            stored = valid;
        }
        return saveToStorage({"wordspotting_word_list": stored});
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
        if (type === 'site') updateWebListDisplay();
        else updateBLWordListDisplay();
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
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = text;
    chip.dataset.index = index;
    chip.dataset.type = type;
    chip.title = "Click to remove";
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

function partitionKeywordPatterns(list) {
    const valid = [];
    const invalid = [];

    list.forEach((item) => {
        try {
            // Validate regex
            new RegExp(item);
            valid.push(item);
        } catch (e) {
            invalid.push(item);
        }
    });

    return { valid, invalid };
}

function partitionSitePatterns(list) {
    const valid = [];
    const invalid = [];

    list.forEach((item) => {
        const regex = buildSiteRegex(item);
        if (regex) {
            valid.push(item);
        } else {
            invalid.push(item);
        }
    });

    return { valid, invalid };
}
