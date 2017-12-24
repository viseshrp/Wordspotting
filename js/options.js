$(document).ready(function () {
    $('body').bootstrapMaterialDesign();

    updateWebListDisplay();

    //on 'add' clicked, get the value, store it and then display it.
    $("#add_sites").click(function () {
        var website = trimAndClean($("#website_input").val());


        if (website.length > 0) {
            var websites_list = [];

            //check if it is a list.
            if (website.includes(",")) {
                websites_list = website.split(",");
            } else
                websites_list.push(website);

            getFromStorage("wordspotting_website_list", function (items) {
                var stored_list_obj = items.wordspotting_website_list;

                if (isValidObj(stored_list_obj)) {
                    //if the object exists already, use it.
                    // logit("oldlist=" + stored_list_obj);
                    Array.prototype.push.apply(stored_list_obj, websites_list);
                    // logit("newlist=" + stored_list_obj);
                    saveToStorage({"wordspotting_website_list": stored_list_obj}, function () {
                        // notify user.
                        // showAlert("Website added to list!", "Success!", true);
                    });
                } else {
                    // if not, create a new one
                    saveToStorage({"wordspotting_website_list": websites_list}, function () {
                        // notify user.
                        // showAlert("Website added to list!", "Success!", true);
                    });
                }

                location.reload();
            });

            // updateWebListDisplay(); //todo fix bug where getfromstorage returns the old list
            //and not the updated/recently saved one.


        } else {
            showAlert("Please add in something!", "Failed!", false);
        }

    });

});

//removes itself if we try to delete an item in a list.
$(document).on('click', '.weblistitem', function () {

    var item_index = this.id;
    //get from storage, delete list item and save.
    getFromStorage("wordspotting_website_list", function (items) {
        var stored_list_obj = items.wordspotting_website_list;

        if (isValidObj(stored_list_obj)) {

            // logit("oldlist=" + stored_list_obj);

            stored_list_obj.splice(item_index, 1);

            // logit("newlist=" + stored_list_obj);

            saveToStorage({"wordspotting_website_list": stored_list_obj}, function () {
                // notify user.
                // showAlert("Website added to list!", "Success!", true);
                location.reload();
            });

            // showAlert("Item removed!", "Success!", true);
        } else {
            showAlert("Something went wrong! Please try again.", "Error!", false);
        }
    });

    $(this).remove();
});

function updateWebListDisplay() {
    //update the UI
    getFromStorage("wordspotting_website_list", function (items) {
        //  items = [ { "yourBody": "myBody" } ]
        var stored_list_obj = items.wordspotting_website_list;
        // logit("websitelist=" + stored_list_obj);

        if (isValidObj(stored_list_obj)) {
            updateDisplayList("#website_list_container", stored_list_obj);
            // logit(stored_list_obj)
        } else {
            logit("Website list empty.");
        }
    });

}

function updateDisplayList(list_dom_id, data_list) {
    $(list_dom_id).html("");
    for (var key in data_list) {
        $(list_dom_id).append("<button id=\"" + key + "\" type=\"button\"" +
            " class=\"btn weblistitem btn-outline-secondary\">" + data_list[key] + "</button>&nbsp;");
    }
}