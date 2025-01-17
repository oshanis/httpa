if (typeof CS == "undefined") {
    CS = function() {
        this.initialize();
    };

    CS.prototype = {
        initialize: function() {
            this.targetImageUrls = new Array();
            this.isHoverZoom = false;
        },
        start: function() {
            this.fetchAndSendImages();
            chrome.extension.onMessage.addListener(
                this.hitch(function(message, sender) {
                    this.onReceiveMessage(message, sender);
                })
            );
        },
        onReceiveMessage: function(message, sender) {
            var operation = message.operation;
            if (operation == "download_local") {
                var container = document.getElementById("ics_container");
                if (!container) {
                    container = document.createElement("div");
                    container.id = "ics_container";
                    container.style.display = "none";
                    document.body.appendChild(container);
                }
                for (var i = 0; i < message.images.length; i++) {
                    var url = message.images[i];
                    var link = document.createElement("a");
                    link.href = url;
                    link.download = "";
                    container.appendChild(link);
                    link.click();
                }
                document.body.removeChild(container);
            } else if (operation == "go_to_image") {
                var pos = message.pos;
                //alert(pos);
                window.scrollTo(-1, pos);
            } else if (operation == "preview_images") {

                var images = message.images;
                var position = message.position;
                var tabId = message.tabId;
                this.previewImages(images, position, tabId);
            } else if (operation == "reload_images") {
                this.fetchAndSendImages();
            } else if (operation == "store_target_images") {
                this.targetImageUrls = message.urls;
                this.isHoverZoom = message.isHoverZoom;
            }
            
        },
        fetchAndSendImages: function() {
            var images = this.getImages();
            this.sendImagesMessage(images);
        },
        getImages: function() {
            var imgs = document.getElementsByTagName("img");
            var images = new Array();
            for (var i = 0; i < imgs.length; i++) {
                if (imgs[i].dataset.ics) {
                    continue;
                }
                var imgSrc = imgs[i].src;
                var width = Math.max(imgs[i].width, imgs[i].naturalWidth);
                var height = Math.max(imgs[i].height, imgs[i].naturalHeight);
                var top = imgs[i].getBoundingClientRect().top;
                var url = imgSrc;
                var img = {
                    tag: "img",
                    url: imgSrc,
                    width: width,
                    height: height,
                    hasLink: false,
                    pos: top
                };
                var parent = imgs[i].parentNode;
                if (parent.nodeType == Node.ELEMENT_NODE
                    && parent.nodeName.toLowerCase() == "a") {
                    var href = parent.href;
                    if (href != imgSrc) {
                        images.push({
                            tag: "a",
                            url: href,
                            width: Number.MAX_VALUE,
                            height: Number.MAX_VALUE,
                            pos:top
                        });
                        img.hasLink = true;
                        url = href;
                    }
                }
                images.push(img);
                var eventHandlingTarget = img.hasLink ? parent : imgs[i];
                eventHandlingTarget.addEventListener(
                    "mouseover",
                    (function(self, imageUrl) {
                        return function(evt) {
                            if (evt.shiftKey) {
                                self.onMouseOverImg(imageUrl);
                            }
                        };
                    })(this, url),
                    false);
            }
            return images;
        },
        onMouseOverImg: function(url) {
            if (this.isHoverZoom && this.isTargetImage(url)) {
                var img = document.getElementById("ics_hover_zoom");
                if (img) {
                    document.body.removeChild(img);
                }
                var clientWidth = document.documentElement.clientWidth;
                var clientHeight = document.documentElement.clientHeight;
                img = document.createElement("img");
                img.id = "ics_hover_zoom";
                img.style.position = "fixed";
                img.style.border = "5px solid darkgray";
                img.addEventListener("load", this.hitch(function(evt) {
                    var imageWidth = Math.max(img.width, img.naturalWidth);
                    var imageHeight = Math.max(img.height, img.naturalHeight);
                    var rateWidth = clientWidth / imageWidth;
                    var rateHeight = clientHeight / imageHeight;
                    var rate = Math.min(rateWidth, rateHeight) * 0.95;
                    img.width = imageWidth * rate;
                    img.height = imageHeight * rate;
                    img.style.top = String((clientHeight - img.height) / 2) + "px";
                    img.style.left = String((clientWidth - img.width) / 2) + "px";
                }), false);
                img.src = url;
                document.body.appendChild(img);
                img.addEventListener("click", function(evt) {
                    document.body.removeChild(img);
                }, false);
            }
        },
        isTargetImage: function(url) {
            for (var i = 0; i < this.targetImageUrls.length; i++) {
                if (this.targetImageUrls[i] == url) {
                    return true;
                }
            }
            return false;
        },
        sendImagesMessage: function(images) {
            var message = {
                type: "parsed_images",
                images: images
            };
            chrome.extension.sendMessage(message);
        },
        previewImages: function(images, position, tabId) {
            //Only show the preview panel if the document URL displays an image
            if (document.URL.match(/\.(jpeg|jpg|gif|png)$/) != null){
                var panel = this.createPreviewPanel(position);
                document.body.appendChild(panel);
                this.createPreviewClose(panel);
                //this.createPreviewOption(panel);
                this.createPreviewImages(images, panel, tabId);
                this.createImageInfo(panel);

                this.createAuditResource(panel);
                this.createSeperator(panel);

                this.createPreviewModify(panel);
                this.createSeperator(panel);

            }
        },

        createSeperator : function(panel){
            var hr = document.createElement("hr");
            panel.appendChild(hr);

        },
        createImageInfo : function(panel){

            //Include "meta" information including usage restrictions about this image
            var meta = document.createElement("div");

            var xhr = new XMLHttpRequest();
            xhr.open('GET', "http://provenance-tracker.herokuapp.com/logs_temp/" + encodeURIComponent(document.URL), true); 
            xhr.onreadystatechange = function() {
                if (this.readyState == 4) {
                    var response = JSON.parse(xhr.response);
          
                    // Check for error.
                    if (response.error) {
                        alert('Error: ' + response.error.message);
                        return;
                    }

                    var user_div =  document.createElement("div");
                    user_div.style['font-size'] = "smaller";
                    var user_p = document.createElement("p");
                    user_p.appendChild(document.createTextNode("Your are modifying image by "));
                    var user_a = document.createElement("a");
                    user_a.href = response.meta.user;
                    user_a.appendChild(document.createTextNode(response.meta.name)); //Todo if possible append name
                    user_p.appendChild(user_a);


                    user_div.appendChild(user_p);

                    //console.log(typeof(response.meta.usage_restrictions)); <-- string!, should be array object

                    if (response.meta.usage_restrictions.length > 0){
                        
                        var ur_div = document.createElement("div");
                        ur_div.appendChild(document.createTextNode("Usage Restrictions: "));
                        ur_div.appendChild(document.createElement("br"));
                        
                        for (var i=0; i<response.meta.usage_restrictions.length; i++){
                            var ur_a = document.createElement("a");
                            ur_a.href = response.meta.usage_restrictions[i].url;
                            ur_a.appendChild(document.createTextNode(response.meta.usage_restrictions[i].label));
                            ur_div.appendChild(ur_a);
                            ur_div.appendChild(document.createElement("br"));
                        }

                        user_div.appendChild(ur_div);

                    }


                    meta.appendChild(user_div);
                    
                }
            };
            xhr.send();
            panel.appendChild(meta);
        },

        createAuditResource : function(panel){

            var auditResource = this.createButtonDiv("Audit Resource");
            
            auditResource.onclick = function(evt){

                var message = {
                    type: "audit",
                    resource: window.location.href,
                };
                chrome.extension.sendMessage(message);

            };

            panel.appendChild(auditResource);


        },

        createPreviewPanel: function(position) {
            var panel = document.getElementById("ics_preview_panel");
            if (panel) {
                panel.innerHTML = "";
            } else {

                //for standalone images, there is not preview panel previously defined
                panel = document.createElement("div");
                panel.id = "ics_preview_panel";
                panel.title = "HTTPA Modifications Dialog Box";

                //Other css

                panel.style.position = "fixed";
                panel.style.background = "#B0B0B0";
                panel.style.color = "black";
                panel.style['font-family'] = "Arial,Helvetica,sans-serif";
            
                panel.style.width = "300px";
                panel.style.height = document.innerHeight;
                if (position.indexOf("top") != -1) {
                    panel.style.top = 0;
                }
                if (position.indexOf("bottom") != -1) {
                    panel.style.bottom = 0;
                }
                if (position.indexOf("left") != -1) {
                    panel.style.left = 0;
                }
                if (position.indexOf("right") != -1) {
                    panel.style.right = 0;
                }
                panel.style.overflow = "auto";
                panel.style.paddingBottom = "5px";
                panel.style.border = "2px solid";
                panel.style['border-radius'] = "25px";
                panel.style.padding = "25px";
                panel.style.margin = "25px";
                   
            }
            return panel;
        },
        createPreviewImages: function(images, panel, tabId) {

            var failedImageCount = 0;
            for (var i = 0; i < images.length; i++) {
                var img = document.createElement("img");
                img.src = images[i].url;
                img.style.width = "45px";
                img.style.marginLeft = "5px";
                img.style.marginRight = "5px";
                img.style.marginTop = "5px";
                img.style.cursor = "pointer";
                img.dataset.ics = "true";
                img.onclick = (function(image) {
                    return function(evt) {
                        var pos = image.pos;
                        window.scrollTo(-1, pos);
                    };
                })(images[i]);
                img.onerror = this.hitch((function(img) {
                    return function() {
                        panel.removeChild(img);
                        failedImageCount++;
                        if (failedImageCount >= images.length) {
                            document.body.removeChild(panel);
                            this.sendDisableButtonMessage(tabId);
                        }
                    }
                })(img));
                if (i == images.length - 1) {
                    img.onload = this.hitch(function() {
                        this.adjustPreviewPanelHeight(panel);
                    });
                }

                panel.appendChild(img);
            }
        },
        sendDisableButtonMessage: function(tabId) {
            var message = {
                type: "disable_button",
                tabId: tabId
            };
            chrome.extension.sendMessage(message);
        },
        sendDismissHotPreviewMessage: function() {
            var message = {
                type: "dismiss_hotpreview"
            };
            chrome.extension.sendMessage(message);
        },
        adjustPreviewPanelHeight: function(panel) {
            var clientHeight = document.documentElement.clientHeight;
            if (panel.clientHeight > (clientHeight / 2)) {
//                panel.style.height = String(clientHeight / 2) + "px";
            }
        },

        createPreviewModify: function(panel) {
        
            var textinput = this.createTextInput();
            panel.appendChild(textinput);
            
            var modify = this.createButtonDiv("Modify Image");
            panel.appendChild(modify);

            var modify_clicked = false;
            
            modify.onclick = function(evt) {


                document.body.innerHTML ='';
                document.body.appendChild(panel);
                
                var canvas = document.createElement('canvas');
                canvas.id = 'imageModifyCanvas';
                var ctx = canvas.getContext('2d');

                // var canvas;
                // var ctx;

                var x = 75;
                var y = 50;
                var dx = 5;
                var dy = 3;
                var WIDTH = 400;
                var HEIGHT = 300;

                var dragok = false,
                    text = document.getElementById('modifytext').value,
                    textLength = (text.length * 14)/2;
                
                var imageObj = new Image();
                

                function rect(x,y,w,h) {
                    ctx.fillStyle = "#FF0000";
                    ctx.font = "bold 16px Arial";
                    ctx.fillText(text,x, y);
                
                }

                function clear() {

                    var clientWidth = document.documentElement.clientWidth;
                    var clientHeight = document.documentElement.clientHeight;
                    var imageWidth = Math.max(imageObj.width, imageObj.naturalWidth);
                    var imageHeight = Math.max(imageObj.height, imageObj.naturalHeight);
                    var rateWidth = clientWidth / imageWidth;
                    var rateHeight = clientHeight / imageHeight;
                    var rate = Math.min(rateWidth, rateHeight) * 0.95;
                    imageObj.style.top = String((clientHeight - imageObj.height) / 2) + "px";
                    imageObj.style.left = String((clientWidth - imageObj.width) / 2) + "px";


                    canvas.width = imageWidth * rate;
                    canvas.height = imageHeight * rate;
                    
                    ctx.clearRect(0,0, imageObj.width, imageObj.height);
                    
                    ctx.drawImage(imageObj, 0, 0, imageObj.width, imageObj.height, 0, 0, canvas.width, canvas.height);

                }

                function draw() {
                    clear();
                    rect(x - 15, y + 15, textLength, 30);
                }

                function myMove(e){
                    if (dragok){
                        x = e.pageX - canvas.offsetLeft;
                        y = e.pageY - canvas.offsetTop;
                    }
                }
                

                imageObj.onload = function() {

                    var clientWidth = document.documentElement.clientWidth;
                    var clientHeight = document.documentElement.clientHeight;
                    var imageWidth = Math.max(imageObj.width, imageObj.naturalWidth);
                    var imageHeight = Math.max(imageObj.height, imageObj.naturalHeight);
                    var rateWidth = clientWidth / imageWidth;
                    var rateHeight = clientHeight / imageHeight;
                    var rate = Math.min(rateWidth, rateHeight) * 0.95;
                    imageObj.style.top = String((clientHeight - imageObj.height) / 2) + "px";
                    imageObj.style.left = String((clientWidth - imageObj.width) / 2) + "px";


                    canvas.width = imageWidth * rate;
                    canvas.height = imageHeight * rate;
                    
                    
                    ctx.drawImage(imageObj, 0, 0, imageObj.width, imageObj.height, 0, 0, canvas.width, canvas.height);
                    setInterval(draw, 10);
                };

                imageObj.src = document.URL;

                canvas.onmousedown = function(e){
                    if (e.pageX < x + textLength + canvas.offsetLeft && 
                        e.pageX > x - textLength + canvas.offsetLeft && 
                        e.pageY < y + 15 + canvas.offsetTop &&
                        e.pageY > y -15 + canvas.offsetTop){
                        x = e.pageX - canvas.offsetLeft;
                        y = e.pageY - canvas.offsetTop;
                        dragok = true;
                        canvas.onmousemove = myMove;
                    }
                }

                canvas.onmouseup = function (){
                    dragok = false;
                    canvas.onmousemove = null;
                }
                    
                document.body.appendChild(canvas);

                //All the rest of the functions should appear afterwards

                function createButtonDiv(label) {
                    var buttondiv = document.createElement("div");
                    var button = document.createElement("button");
                    button.style.textAlign = "center";
                    button.style.cursor = "pointer";
                    button.style.fontSize = "14px";
                    button.style.marginTop = "10px";
                    button.style['border-radius'] = "25px";
                    button.appendChild(document.createTextNode(label));
                    buttondiv.appendChild(button);
                    return buttondiv;
                }

                //create Usage Restriction Options
                var selectDiv = document.createElement("div");
                var selectP = document.createElement("p");
                selectP.appendChild(document.createTextNode("Select License(s) or Usage Restriction(s) for your Meme:"));

                selectDiv.appendChild(selectP);

                var selectOptions = document.createElement("select");
                selectOptions.multiple = true;
                selectOptions.id = "select_options";

                var usage_restrictions = [
                    {   "label" : "Attribution" ,       
                        "url": "http://creativecommons.org/licenses/by/4.0" },
                    {   "label" : "Attribution-ShareAlike" ,            
                        "url": "https://creativecommons.org/licenses/by-sa/4.0" },
                    {   "label" : "Attribution-NoDerivs" ,    
                        "url": "https://creativecommons.org/licenses/by-nd/4.0" },
                    {   "label" : "Attribution-NonCommercial" ,     
                        "url": "https://creativecommons.org/licenses/by-nc/4.0" },
                    {   "label" : "Attribution-NonCommercial-ShareAlike" ,        
                        "url": "https://creativecommons.org/licenses/by-nc-sa/4.0" },
                    {   "label" : "Attribution-NonCommercial-NoDerivs",
                        "url"   : "https://creativecommons.org/licenses/by-nc-nd/4.0" }

                ];

                // var usage_restrictions = [
                //     {   "label" : "No modification" ,       
                //         "url": "http://no-modifications" },
                //     {   "label" : "No sharing" ,            
                //         "url": "http://no-sharing" },
                //     {   "label" : "No commercial uses" ,    
                //         "url": "http://no-commercial-uses" },
                //     {   "label" : "No text additions" ,     
                //         "url": "http://no-text-additions" },
                //     {   "label" : "No downloading" ,        
                //         "url": "http://no-downloading" }
                // ];
                
                

                //selectOptions.size = usage_restrictions.length; 
                
                for (var i=0; i< usage_restrictions.length; i++){
                    var optionVal = document.createElement("option");
                    optionVal.width = "200px";
                    optionVal.value = JSON.stringify(usage_restrictions[i]);
                    optionVal.appendChild(document.createTextNode(usage_restrictions[i].label));
                    selectOptions.appendChild(optionVal);
                }

                selectDiv.appendChild(selectOptions);
                

                var setUsageRestrictions = createButtonDiv("OK");
                
                var selected_usage_restrictions = [];
                    
                setUsageRestrictions.onclick = function(evt){

                    var select = document.getElementById("select_options");
                    for (var i=0; i <select.options.length; i++){
                        if (select.options[i].selected){
                            selected_usage_restrictions.push(JSON.parse(select.options[i].value));
                        }
                    }

                    alert("Usage restrictions for this modified image saved.");

                };

                
                //Ask from the user if they would like to give a new name
                var modified_name_div = document.createElement("div");
                modified_name_div.appendChild(document.createTextNode("Enter New Image Name: "));
                var modified_name_input = document.createElement("input");
                modified_name_input.id = "modified_name_input";
                modified_name_input.type = "text";
                modified_name_input.size = "30";
                modified_name_input.value = "modified_" + document.URL.replace(/^.*[\\\/]/, '');
                modified_name_div.appendChild(modified_name_input);
                

                var saveImage = createButtonDiv("Download modified image");
                
                getImageData = function(){
                    var canvas = document.getElementById("imageModifyCanvas");


                    // Convert that back to a dataURL
                    var dataURL = canvas.toDataURL('image/png').replace("image/png", "image/octet-stream");;
                    return dataURL.replace(/data:image\/png;base64,/, '');
                };   

                saveImage.onclick = function(evt){

                    if (selected_usage_restrictions.length == 0){
                        console.log('No usage restrictions selected');
                    }

                    var canvas = document.getElementById("imageModifyCanvas");


                    var link = document.createElement('a');
                    link.download = document.getElementById('modified_name_input').value;
                    link.href = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");;
                    link.click();


                    //Update the PTN with the information
                    var xhr = new XMLHttpRequest();
                    xhr.open('PUT', "http://provenance-tracker.herokuapp.com/logs_temp/download/" + encodeURIComponent(document.URL), true); 
                    xhr.setRequestHeader('Content-Type', 'application/json');
                    xhr.onreadystatechange = function() {
                        if (this.readyState == 4) {
                            var response = JSON.parse(xhr.response);
                  
                            // Check for error.
                            if (response.error) {
                                alert('Error: ' + response.error.message);
                                return;
                            }
                        }
                    };

                    chrome.storage.sync.get('user', function(data){
                        

                        var data = {
                            //sadly no email
                            "user" : data.user.url,
                            "name" : data.user.displayName,
                            "derivative" : document.getElementById('modified_name_input').value,
                            "usage_restrictions" : selected_usage_restrictions

                        };
                        alert(JSON.stringify(data));
                        xhr.send(JSON.stringify(data));
                        //xhr.send(data);

                    });



                };

                function postToPTN(derivative){
                    //Update the provenance tracker with the new update
                    var ptn_xhr = new XMLHttpRequest();
                    ptn_xhr.open('POST', "http://provenance-tracker.herokuapp.com/logs_temp/", true); 
                    ptn_xhr.setRequestHeader('Content-Type', 'application/json');
                    ptn_xhr.onreadystatechange = function() {
                        if (this.readyState == 4) {
//                            var response = JSON.parse(ptn_xhr.response);
                            var response = ptn_xhr.response;
                  
                            // Check for error.
                            if (response.error) {
                                alert('Error: ' + response.error.message);
                                return;
                            }
                        }
                    };
                    
                    chrome.storage.sync.get('user', function(data){
                    
                        var data = {
                            "_id" : derivative,
                            "sources": [document.URL],
                            "derivatives": [],
                            "meta" : {
                                //sadly no email
                                "user" : data.user.url,
                                "name" : data.user.displayName,
                                "usage_restrictions" : selected_usage_restrictions
                            }

                        };
                        ptn_xhr.send(JSON.stringify(data));

                    });

                }



                var uploadImage = createButtonDiv("Share on imgur.com");
                
                uploadImage.onclick = function (evt){

                    
                    var canvas = document.getElementById("imageModifyCanvas");
                    var image64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
          
                    //Properly escape the contents of the image. And post it.
                    var post_data =  unescape(encodeURIComponent(image64));
                    
                    var xhr = new XMLHttpRequest(); 
                    xhr.open("POST", "https://api.imgur.com/3/image.json"); 
                    xhr.onload = function () {
                        var derivative = JSON.parse(xhr.response).data.link;
                        alert("Your image is at "+ derivative);

                        postToPTN(derivative);

                        
                    }
                    xhr.setRequestHeader('Authorization', 'Client-ID d702179326fa144');

                    xhr.send(post_data);

                };


                function shareOnHTTPASite(server_url){

                    var xhr = new XMLHttpRequest();
                    
                    xhr.open('POST', server_url, true); 
                    
                    xhr.setRequestHeader('usage_restrictions', JSON.stringify(selected_usage_restrictions));
                    xhr.setRequestHeader('extension', 'true');

                    xhr.onreadystatechange = function() {
                        if (this.readyState == 4) {
                            alert("Your image is at " + xhr.response);
                            postToPTN(xhr.response)
                        }
                    };
          
                    // Get the base64 image using HTML5 Canvas.
                    var canvas = document.getElementById("imageModifyCanvas");

                    var image64 = canvas.toDataURL('image/png', 0.9).split(',')[1];

                    var blobBin = atob(image64);
                    var array = [];
                    for(var i = 0; i < blobBin.length; i++) {
                        array.push(blobBin.charCodeAt(i));
                    }
                    var file=new Blob([new Uint8Array(array)], {type: 'image/png'});

                    var formdata = new FormData();
                    formdata.append("upload", file);

                    xhr.send(formdata); 


                }

                var uploadImagePhotorm = createButtonDiv("Share on photorm.org");
                
                uploadImagePhotorm.onclick = function (evt){
                    shareOnHTTPASite('http://localhost:8080/upload');
                };


                var uploadImageImagehare = createButtonDiv("Share on imagehare.com");
                
                uploadImageImagehare.onclick = function (evt){
                    shareOnHTTPASite('http://localhost:8080/upload');
                };
                
                if (!modify_clicked){
                    panel.appendChild(selectDiv);
                    panel.appendChild(setUsageRestrictions);
                    panel.appendChild(document.createElement("br"));
                    panel.appendChild(modified_name_div);
                    panel.appendChild(document.createElement("hr"));
                    panel.appendChild(saveImage);
                    panel.appendChild(uploadImage);
                    panel.appendChild(uploadImagePhotorm);
                    panel.appendChild(uploadImageImagehare);

                }
                modify_clicked = true;
                
            };


            
        },
        createPreviewClose: function(panel) {

            var title = document.createElement("div");
            var title_head = document.createElement("b");
            title_head.appendChild(document.createTextNode("HTTPA Meme Generator"));
            title_head.style.float = "left";
            title.appendChild(title_head);
            var x = document.createElement("span");
            x.title = "Close"
            x.style['text-align'] = "right";
            x.style.float = "right";
            x.style.textDecoration = "underline";
                    
            x.appendChild(document.createTextNode(" X "));
            panel.appendChild(title);
            panel.appendChild(x);
            panel.appendChild(document.createElement("br"));
            x.onclick = function(evt) {
                document.body.removeChild(panel);
            };
        },
        createPreviewOption: function(panel) {
            var option = this.createLinkDiv("Options");
            panel.appendChild(option);
            option.onclick = function(evt) {
                var url = chrome.extension.getURL("options.html");
                location.href = url;
            };
            var dismiss = this.createLinkDiv("Do not show this again");
            panel.appendChild(dismiss);
            dismiss.onclick = this.hitch(function(evt) {
                this.sendDismissHotPreviewMessage();
                document.body.removeChild(panel);
            });
        },
        createLinkDiv: function(label) {
            var link = document.createElement("div");
            link.style.textAlign = "left";
            link.style.textDecoration = "underline";
            link.style.cursor = "pointer";
            link.style.fontSize = "14px";
            link.style.marginTop = "10px";
            link.appendChild(document.createTextNode(label));
            return link;
        }, 
        createButtonDiv: function(label) {
            var button = document.createElement("button");
            button.style.textAlign = "center";
            button.style.cursor = "pointer";
            button.style.fontSize = "14px";
            button.style.marginTop = "10px";
            button.style['border-radius'] = "25px";
            button.appendChild(document.createTextNode(label));
            return button;
        }, 
        createTextInput: function() {
            var div = document.createElement("div");
            div.appendChild(document.createElement("br"));
            div.appendChild(document.createTextNode("Meme Text:"));
            div.appendChild(document.createElement("br"));

            var helpText = document.createElement("p");
            helpText.style['font-size'] = 'smaller';
            helpText.appendChild(document.createTextNode('(You can drag the text to place it any where on the image)'));
            div.appendChild(helpText);

            var text = document.createElement("input");
            text.id = "modifytext";
            text.type = "text";
            text.size = "50";
            text.value = " Insert your cool meme here ";
            div.appendChild(document.createElement("br"));

            div.appendChild(text);


            return div;
        },
        hitch: function(f) {
            var self = this;
            return function() {
                f.apply(self, arguments);
            };
        }
    };
}

var cs = new CS();
cs.start();
