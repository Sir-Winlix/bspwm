if(!window.alldExtensionBlackbarStream) {
    window.alldExtensionBlackbarStream = true;

    // Display a download button on top of video to quickly send to Alldebrid
    // You can enable or disable this feture at will in the extension settings

	chrome.runtime.sendMessage({command: 'env', keys: ['config.imgs', 'config.domain', 'langStore.webext_download_with'], from: 'blackbarstream'}, (response) => {

		if(!response.imgs)
            return;

        if(!response.domain) // Fallback
        	response.domain = 'com';

	    var currentUrl = window.location.href;
	    
	    var config = {
	    	imgs: response.imgs,
	    	domain: response.domain
	    };

	    var hiddenBtn = false;

	    setTimeout(function() {
			var videos = document.getElementsByTagName('video');

		    if(videos.length == 0)
		    	return;

		    var video = videos[0];

		    console.log('Creating stream black bar');

			var streamDiv = document.createElement("div");
			streamDiv.setAttribute("style","position: absolute; display: flex;justify-content: center; align-items: center; border-radius: 9px; cursor: pointer; width: 200px; line-height: 20px; font-size:10px;font-family: Helvetica, Tahoma, Arial, Verdana, sans-serif;color:#fff;font-weight:bold;height:20px;background:#000 url('" + config.imgs.blackbarBlock + "');z-index:10000;opacity: 0.90;");
			streamDiv.setAttribute("id","alldebrid_horiz_div");
			streamDiv.innerText = response['webext_download_with'];

			var logoImg = document.createElement("img");
			logoImg.setAttribute("style","margin-left:8px; height: 19px");
			logoImg.src = config.imgs.alldLogo;

			var quitSpan = document.createElement("div");
			quitSpan.id = 'alldHideVideoBtn';
			quitSpan.setAttribute("style","cursor: pointer; cursor: pointer; font-size: 12px; right: 5px; position: absolute; width: 20px;margin-right: -5px; text-align: center;");
			quitSpan.innerText = '✖';

			streamDiv.appendChild(logoImg);
			streamDiv.appendChild(quitSpan);
			streamDiv.addEventListener("click", function(event) { 
				if(event.target.id == 'alldHideVideoBtn')
					return;

				window.location = "http://alldebrid." + config.domain + "/service/?url=" + encodeURIComponent(currentUrl);
			}, false);

			quitSpan.addEventListener("click", function(event) { 
				// Hide button
				hiddenBtn = true;
				streamDiv.remove();
			}, false);

			var videoPos = video.getBoundingClientRect();

			streamDiv.style.top = (videoPos.top - 21) + 'px';
			streamDiv.style.left = videoPos.left + 'px';

			document.body.insertBefore(streamDiv, document.body.firstChild);


			// Setup a timer
			var timeout;

			// Listen for resize events, to adjust the button position
			window.addEventListener('resize', function ( event ) {
				if(hiddenBtn)
					return;
				// If there's a timer, cancel it
				if (timeout) {
					window.cancelAnimationFrame(timeout);
				}

			    // Setup the new requestAnimationFrame()
				timeout = window.requestAnimationFrame(function () {
			        // Run our scroll functions
			        var videoPos = video.getBoundingClientRect();

					streamDiv.style.top = (videoPos.top - 21) + 'px';
					streamDiv.style.left = videoPos.left + 'px';
				});
			}, false);

			// hide button when fullscreen is ON
			document.addEventListener("fullscreenchange", function() {
				if(hiddenBtn)
					return;

				if(document.fullscreenElement)
					streamDiv.style.display = 'none';
				else
					streamDiv.style.display = 'flex';
			});

			// Some webiste have weird JS modifying video position and size, hooking into MutationObserver to react to those changes
			var observerConfig = { attributes: true, childList: true };
			var callback = function(mutationsList) {
				if(hiddenBtn)
					return;

				var videoPos = video.getBoundingClientRect();

				streamDiv.style.top = (videoPos.top - 21) + 'px';
				streamDiv.style.left = videoPos.left + 'px';
			};

			var observer = new MutationObserver(callback);
			observer.observe(video, observerConfig);

			return;
	    }, 1000);
    });
}