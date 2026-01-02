document.addEventListener('DOMContentLoaded', function () {

    updateViews();

    // Add Website
    document.getElementById("add_sites").addEventListener("click", function () {
        const input = document.getElementById("website_input");
        const website = trimAndClean(input.value);

        if (website.length > 0) {
            let websites_list = [];

            if (website.includes(",")) {
                websites_list = website.split(",");
            } else {
                websites_list.push(website);
            }

            getFromStorage("wordspotting_website_list").then((items) => {
                let stored_list_obj = items.wordspotting_website_list;

                if (isValidObj(stored_list_obj)) {
                    // Push all new items
                    websites_list.forEach(w => stored_list_obj.push(w));
                } else {
                    stored_list_obj = websites_list;
                }

                return saveToStorage({"wordspotting_website_list": stored_list_obj});
            }).then(() => {
                input.value = "";
                updateWebListDisplay();
                showAlert("Website added to list!", "Success", true);
            }).catch(e => {
                console.error(e);
                showAlert("Failed to save.", "Error", false);
            });

        } else {
            showAlert("Please add in something!", "Failed!", false);
        }
    });

    // Add Word
    document.getElementById("add_bl_word").addEventListener("click", function () {
        const input = document.getElementById("bl_word_input");
        const word = input.value.trim();

        if (word.length > 0) {
            let word_list = [];

            if (word.includes(",")) {
                word_list = word.split(",");
            } else {
                word_list.push(word);
            }

            getFromStorage("wordspotting_word_list").then((items) => {
                let stored_list_obj = items.wordspotting_word_list;

                if (isValidObj(stored_list_obj)) {
                    word_list.forEach(w => stored_list_obj.push(w));
                } else {
                    stored_list_obj = word_list;
                }

                return saveToStorage({"wordspotting_word_list": stored_list_obj});
            }).then(() => {
                input.value = "";
                updateBLWordListDisplay();
                showAlert("Word added to list!", "Success", true);
            }).catch(e => {
                console.error(e);
                showAlert("Failed to save.", "Error", false);
            });

        } else {
            showAlert("Please add in something!", "Failed!", false);
        }
    });

    // Notifications Switch
    document.getElementById("notifications_switch").addEventListener("change", function () {
        const status = this.checked;
        saveToStorage({"wordspotting_notifications_on": status}).then(() => {
            showAlert("Notifications turned " + (status ? "ON" : "OFF"), "Done!", true);
        });
    });

    // Extension Switch
    document.getElementById("extension_switch").addEventListener("change", function () {
        const status = this.checked;
        saveToStorage({"wordspotting_extension_on": status}).then(() => {
            showAlert("Extension turned " + (status ? "ON" : "OFF"), "Done!", true);
        });
    });

});

// Event Delegation for removing items (since buttons are dynamic)
document.addEventListener('click', function(e) {
    if (e.target && e.target.classList.contains('weblistitem')) {
        const index = parseInt(e.target.dataset.index);

        getFromStorage("wordspotting_website_list").then((items) => {
            const stored_list_obj = items.wordspotting_website_list;
            if (isValidObj(stored_list_obj)) {
                stored_list_obj.splice(index, 1);
                return saveToStorage({"wordspotting_website_list": stored_list_obj});
            }
        }).then(() => {
            updateWebListDisplay();
        });
    }

    if (e.target && e.target.classList.contains('wordlistitem')) {
        const index = parseInt(e.target.dataset.index);

        getFromStorage("wordspotting_word_list").then((items) => {
            const stored_list_obj = items.wordspotting_word_list;
            if (isValidObj(stored_list_obj)) {
                stored_list_obj.splice(index, 1);
                return saveToStorage({"wordspotting_word_list": stored_list_obj});
            }
        }).then(() => {
            updateBLWordListDisplay();
        });
    }
});


function updateViews() {
    updateWebListDisplay();
    updateNotifSwitchDisplay();
    updateExtSwitchDisplay();
    updateBLWordListDisplay();
}

function updateWebListDisplay() {
    getFromStorage("wordspotting_website_list").then((items) => {
        const stored_list_obj = items.wordspotting_website_list;
        if (isValidObj(stored_list_obj)) {
            updateDisplayList("#website_list_container", stored_list_obj, "weblistitem");
        } else {
            document.querySelector("#website_list_container").innerHTML = "<small>No sites added.</small>";
        }
    });
}

function updateDisplayList(selector, data_list, item_class) {
    const container = document.querySelector(selector);
    container.innerHTML = "";

    data_list.forEach((item, index) => {
        const chip = document.createElement("span");
        chip.className = `chip ${item_class}`;
        chip.textContent = item;
        chip.dataset.index = index;
        container.appendChild(chip);
    });
}

function updateNotifSwitchDisplay() {
    getFromStorage("wordspotting_notifications_on").then((items) => {
        const status = items.wordspotting_notifications_on;
        // Default to true if undefined
        document.getElementById("notifications_switch").checked = (status !== false);
    });
}

function updateExtSwitchDisplay() {
    getFromStorage("wordspotting_extension_on").then((items) => {
        const status = items.wordspotting_extension_on;
        // Default to true if undefined
        document.getElementById("extension_switch").checked = (status !== false);
    });
}

function updateBLWordListDisplay() {
    getFromStorage("wordspotting_word_list").then((items) => {
        const stored_list_obj = items.wordspotting_word_list;
        if (isValidObj(stored_list_obj)) {
            updateDisplayList("#bl_word_list_container", stored_list_obj, "wordlistitem");
        } else {
            document.querySelector("#bl_word_list_container").innerHTML = "<small>No keywords added.</small>";
        }
    });
}
