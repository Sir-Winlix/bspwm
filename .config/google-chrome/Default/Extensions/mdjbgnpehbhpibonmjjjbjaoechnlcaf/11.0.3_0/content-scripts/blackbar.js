if(!window.alldExtensionBlackbar) {
    window.alldExtensionBlackbar = true;

    // Display a black bar on top of webpage to quickly send to Alldebrid
    // You can enable or disable this feture at will in the extension settings

	chrome.runtime.sendMessage({command: 'env', keys: ['config.imgs', 'config.domain', 'config.hosts.hardRedirect', 'langStore.webext_download_with'], from: 'blackbar'}, (response) => {

		if(!response.imgs)
            return;

        if(!response.domain) // Fallback
        	response.domain = 'com';

        var hardRedirect = response.hardRedirect;
	    var currentUrl = window.location.href;
	    
	    var config = {
	    	imgs: response.imgs,
	    	domain: response.domain
	    };

	    // Forced redirection hosts handling
	    for(var i in hardRedirect) {
			if(currentUrl.indexOf('://' + hardRedirect[i] + '/download') !== -1) {
				currentUrl = currentUrl.substr(0, currentUrl.length - 8) + getCookie('file_code');
			}
		}

		console.log('Creating black bar');

		var blackBarDiv = document.createElement("div");
		
		blackBarDiv.setAttribute("style","padding: 0px 10px;border-radius: 5px;display: flex;justify-content: left; align-items: center; cursor: pointer;position:absolute;top:10px;left:10px;font-size:11px;font-family: Helvetica, Tahoma, Arial, Verdana, sans-serif;color:#fff;font-weight:bold;height:25px;line-height:25px;background:#000 url('" + config.imgs.blackbarBlock + "');z-index:10000;opacity: 0.90;");
		blackBarDiv.setAttribute("id","alldebrid_horiz_div");
		var alldText = document.createElement("span");
		alldText.innerText = response['webext_download_with'];
		blackBarDiv.appendChild(alldText);
		
		var alldImg = document.createElement("img");
		alldImg.setAttribute("style","margin-left:8px; height: 24px");
		alldImg.src = config.imgs.alldLogo;
		blackBarDiv.appendChild(alldImg);

		var alldMove = document.createElement("img");
		alldMove.src = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iaXNvLTg4NTktMSI/PjxzdmcgdmVyc2lvbj0iMS4xIiBpZD0iQ2FwYV8xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4PSIwcHgiIHk9IjBweCIgdmlld0JveD0iMCAwIDMyIDMyIiBzdHlsZT0iZW5hYmxlLWJhY2tncm91bmQ6bmV3IDAgMCAzMiAzMjsiIHhtbDpzcGFjZT0icHJlc2VydmUiPjxnPjxnIGlkPSJtb3ZlIj48Zz48cG9seWdvbiBzdHlsZT0iZmlsbDojZmVmZWZlOyIgcG9pbnRzPSIxOCwyMCAxOCwyNiAyMiwyNiAxNiwzMiAxMCwyNiAxNCwyNiAxNCwyMCAiLz48cG9seWdvbiBzdHlsZT0iZmlsbDojZmVmZWZlOyIgcG9pbnRzPSIxNCwxMiAxNCw2IDEwLDYgMTYsMCAyMiw2IDE4LDYgMTgsMTIgIi8+PHBvbHlnb24gc3R5bGU9ImZpbGw6I2ZlZmVmZTsiIHBvaW50cz0iMTIsMTggNiwxOCA2LDIyIDAsMTYgNiwxMCA2LDE0IDEyLDE0ICIvPjxwb2x5Z29uIHN0eWxlPSJmaWxsOiNmZWZlZmU7IiBwb2ludHM9IjIwLDE0IDI2LDE0IDI2LDEwIDMyLDE2IDI2LDIyIDI2LDE4IDIwLDE4ICIvPjwvZz48L2c+PC9nPjxnPjwvZz48Zz48L2c+PGc+PC9nPjxnPjwvZz48Zz48L2c+PGc+PC9nPjxnPjwvZz48Zz48L2c+PGc+PC9nPjxnPjwvZz48Zz48L2c+PGc+PC9nPjxnPjwvZz48Zz48L2c+PGc+PC9nPjwvc3ZnPg==";
		alldMove.style.height = "15px";
		alldMove.style.fontSize = "15px";
		alldMove.style.margin = "0px 8px 0px 6px";
		alldMove.style.cursor = "move";
		blackBarDiv.appendChild(alldMove);
		
		var alldClose = document.createElement("span");
		alldClose.innerText = "✖";
		alldClose.style.fontSize = "15px";
		blackBarDiv.appendChild(alldClose);

		alldText.addEventListener("click", function() { 
			window.location.assign("http://alldebrid." + config.domain + "/service/?url=" + encodeURIComponent(currentUrl)); 
		}, false);
		alldImg.addEventListener("click", function() { 
			window.location.assign("http://alldebrid." + config.domain + "/service/?url=" + encodeURIComponent(currentUrl)); 
		}, false);
		alldClose.addEventListener("click", function() { 
			blackBarDiv.remove(); 
		}, false);

		document.body.insertBefore(blackBarDiv, document.body.getElementsByTagName("*")[0]);


		let offsetX, offsetY;

		alldMove.addEventListener('mousedown', startDragging);
		alldMove.addEventListener('mouseup', stopDragging);

		function startDragging(e) {
			e.preventDefault();
			offsetX = e.clientX - blackBarDiv.getBoundingClientRect().left;
			offsetY = e.clientY - blackBarDiv.getBoundingClientRect().top;
			blackBarDiv.classList.add('dragging');
			document.addEventListener('mousemove', dragElement);
		}

		function dragElement(e) {
			e.preventDefault();
			let x = e.clientX - offsetX;
			let y = e.clientY - offsetY;
			blackBarDiv.style.left = x + 'px';
			blackBarDiv.style.top = y + 'px';
		}

		function stopDragging() {
			blackBarDiv.classList.remove('dragging');
			document.removeEventListener('mousemove', dragElement);
		}


    });

    var getCookie = function(name) {
	    var v = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
	    return v ? v[2] : null;
	}
}

