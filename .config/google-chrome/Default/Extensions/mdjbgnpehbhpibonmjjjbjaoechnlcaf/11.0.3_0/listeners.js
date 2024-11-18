var csListener = async (details) => {
	// Listener that insert content scripts by listening to webnavigation onCompleted

	var url = details.url;
	var domain = uri.extractRootDomain(url);
	var tabId = details.tabId;

	log.info('[FEAT] In csListener for ' + url);

	if(!env.config.init) {
		log.info('[FEAT] Waiting for inti');
		await waitForInit();
		log.info('[FEAT] In csListener for ' + url);
	}

	if(env.config.alldDomains.indexOf(domain) !== -1) {
		// Insert communication script in whitelisted domains, aka Alldebrid domains for now
		log.info('[COM] Inserting communication CS on ' + details.url);

		browser.scripting.executeScript({
		  target: {
			tabId: details.tabId,
			allFrames: true,
		  },
		  files: ["/content-scripts/messaging.js"]
		}).catch( (result) =>  {
			log.info('[COM] Error inserting messaging CS', result)
		});

		// browser.scripting(details.tabId, {
		// 	file: "/content-scripts/messaging.js",
		// 	runAt: "document_end",
		// }).catch( (result) =>  {
		// 	log.info('[COM] Error inserting messaging CS', result)
		// });
	}

	if(url.indexOf("chrome://") !== -1 || url.indexOf("about:") !== -1)
		return;

	if(!env.config.isLoggued) {
		log.info('[FEAT] In csListener : not loggued');
		return;
	}

	if(!env.config.boot) {
		log.info('[FEAT] Waiting for bootstrap');
		await waitForBootstrap();
	}
		
	// Link detector CS, responsible for a lot of features. Communicate with webpages to display icones, quick button, ect...
	// Do not include on Alldebrid domains
	if(env.config.alldDomains.indexOf(domain) === -1) {
		log.info('[FEAT] Inserting link detector CS', url);

		browser.scripting.executeScript({
		  target: {
			tabId: details.tabId,
			allFrames: true,
		  },
		  files: ["/content-scripts/link-detector.js"]
		}).catch( (result) =>  {
			log.info('Error inserting content script : ', result)
		});

		// browser.tabs.executeScript(details.tabId, {
		// 	file: "/content-scripts/link-detector.js",
		// 	runAt: "document_end",
		// 	allFrames: true
		// }).catch( (result) =>  {
		// 	log.info('Error inserting content script : ', result)
		// });
	}
		

	// Other than link detector, only insert script on top frame
	if(details.frameId !== 0)
		return;

	for(var i in env.config.hosts.hardRedirect) {
		if(url.indexOf('://' + env.config.hosts.hardRedirect[i] + '/download') !== -1) {
			url = url.substr(0, url.length - 8) + env.config.hiddenID;
			log.info('[CORE] Virtual url for', env.config.hosts.hardRedirect[i], 'switched to', url);
		}
	}

	// Only insert blackbar content script on supported urls and if user want this feature
	if(isValidHostLink(url) && env.options.blackBar == true) {
		log.info('[FEAT] Inserting black bar CS on ' + url);
		browser.scripting.executeScript({
			target: {
			  tabId: tabId,
			  allFrames: true,
			},
			injectImmediately: true,
			files: ["/content-scripts/blackbar.js"]
		  }).catch( (result) =>  {
			  log.info('[FEAT] Error inserting blackbar CS', result)
		  });

		// browser.tabs.executeScript(tabId, {
		// 	file: "/content-scripts/blackbar.js",
		// 	allFrames: false
		// }).catch( (result) =>  {
		// 	log.info('[FEAT] Error inserting blackbar CS', result)
		// });
	}

	// Only insert stream button content script on supported urls and if user want this feature
	if(isValidStreamLink(url) && env.options.blackBarStream == true) {
		// Inserting top balck bar content script
		log.info('[FEAT] Inserting black bar stream CS on', url);
		browser.scripting.executeScript({
			target: {
			  tabId: tabId,
			  allFrames: true,
			},
			files: ["/content-scripts/blackbar.stream.js"]
		  }).catch( (result) =>  {
			  log.info('[FEAT] Error inserting blackbar stream CS', result)
		  });

		// browser.tabs.executeScript(tabId, {
		// 	file: "/content-scripts/blackbar.stream.js",
		// 	runAt: "document_idle",
		// 	allFrames: false
		// }).catch( (result) =>  {
		// 	log.info('[FEAT] Error inserting blackbar stream CS', result)
		// });
	}
}

var redirectionListener = async (details) => {
	// Listener that insert content scripts by listening to webnavigation onCompleted
	// ONly used for the changeLink feature, aka automatic redirection, if the user enabled this feature

	var url = details.url;
	var domain = uri.extractRootDomain(url);
	var tabId = details.tabId;

	if(url.indexOf("chrome://") !== -1 || url.indexOf("about:") !== -1 || env.config.alldDomains.indexOf(domain) !== -1 || env.options.changeLink !== true)
		return;

	// Other than link detector, only insert script on top frame
	if(details.frameId !== 0)
		return;

	for(var i in env.config.hosts.hardRedirect) {
		if(url.indexOf('://' + env.config.hosts.hardRedirect[i] + '/download') !== -1) {
			url = url.substr(0, url.length - 8) + env.config.hiddenID;
			log.info('[CORE] Virtual url for', env.config.hosts.hardRedirect[i], 'switched to', url);
		}
	}

	if(isValidHostLink(url)) {
		log.info('[FEAT] Redirecting to Alldebrid with url', url);
		
		// Redirection user to Alldebrid									
		browser.tabs.update(
			tabId, 
			{url: 'https://alldebrid.' + env.config.domain + '/service/?url=' + encodeURIComponent(url)}
		);
	}
}

var learn = (info) => {
	// Already learned ?
	if(env.config.rivers.learnLinks.indexOf(info.linkUrl) != -1)
		return;

	env.config.rivers.learnLinks.push(info.linkUrl);

	log.info('[FEAT] Learning link', info.linkUrl, env.config.rivers.learnLinks);	
}

var getHiddenId = (requestDetails) => {
	// Get hidden page id for website that force redirection on generic url

	var isMatch = false,
	    match = false;

	for(var i in env.config.hosts.hardRedirect) {
		var host = env.config.hosts.hardRedirect[i];
		var regexp = new RegExp(env.config.hosts.hardRedirectRegexps[host]);

		if( (match = requestDetails.url.match(regexp) ) !== null) {
			log.info('[CORE] Saved hiddenID', match[1], 'for', host);
			env.config.hiddenID = match[1];
		}
	}	
}


var download = (info) => {
	log.info('[FEAT] Sending links to Alldebrid', info.linkUrl);

	info.linkUrl = decodeURI(info.linkUrl)

	sendToAlld(info.linkUrl)
}

var downloadSelection = (selection, checkOnly) => {
	// If checkOnly, parse selection, return boolean
	
	// If not, it comes from context menu action
	// We use saved selection from check, no need to requery it
	// And we trigger the download

	var validLinks = [];

    var hosts = env.config.hosts.hostsRegexp;
    var folders = env.config.hosts.foldersRegexp;

    var match;

    // Get saved selection
    if(checkOnly !== true)
    	selection = env.config.currentSelection;

    for(var host in hosts) {	
		if(env.options.disabledHosts == true && env.options.disabledHostsList.indexOf(host) != -1)
			continue;

		for(var reg in hosts[host]) {
			try {
				var regexp = hosts[host][reg];
				XRegExp.forEach(selection, XRegExp(regexp), (match, i) => {
					if(validLinks.indexOf(match[0]) == -1)
						validLinks.push(match[0]);
				});
			} catch (err) {
				log.warn('[CORE] Regexp error on', host, err, regexp);
				continue;	
			}
		}
	}

	for(var host in folders) {
		if(env.options.disabledHosts == true && env.options.disabledHostsList.indexOf(host) != -1)
			continue;

		for(var reg in folders[host]) {
			try {
				var regexp = folders[host][reg];
				XRegExp.forEach(selection, XRegExp(regexp), (match, i) => {
					if(validLinks.indexOf(match[0]) == -1)
						validLinks.push(match[0]);
				});
			} catch (err) {
				log.warn('[CORE] Regexp error on', host, err, regexp);
				continue;	
			}
		}
	}

	if(env.options.enabledStream && env.options.enabledStreamList.length > 0) {

		var streams = env.options.enabledStreamList;

		for(var stream in streams) {
			for(var reg in env.config.hosts.streamRegexp[streams[stream]]) {
				try {
					var regexp = env.config.hosts.streamRegexp[streams[stream]][reg];
					XRegExp.forEach(selection, XRegExp(regexp), (match, i) => {
						if(validLinks.indexOf(match[0]) == -1)
							validLinks.push(match[0]);
					});
				} catch (err) {
					log.warn('[CORE] Regexp error on', host, err, regexp);
					continue;	
				}
			}
		}
	}
	if(checkOnly === true) {
		if(validLinks.length == 0) {
			return false;
		}

		return true;
	}

	if(validLinks.length > 0) {
		log.info('[FEAT] Sending selected links to Alldebrid', validLinks);
		sendToAlld(validLinks.join("\n"));
	} else {
		//log.info('SYS: no link found')      // //document.getElementById('form').submit();
	}
}


var findLinks = async (content, tab) => {
	// Find supported link in arbitrary content

	var validLinks = [];
	var rawValidLinks = [];

    var hosts = env.config.hosts.hostsRegexp;
    var folders = env.config.hosts.foldersRegexp;

    var match;

    for(var host in hosts) {	
		if(env.options.disabledHosts == true && env.options.disabledHostsList.indexOf(host) != -1)
			continue;

		for(var reg in hosts[host]) {
			try {
				var regexp = hosts[host][reg];
				XRegExp.forEach(content, XRegExp(regexp), (match, i) => {
					if(validLinks.indexOf(match[0]) == -1 && rawValidLinks.indexOf(match[0]) === -1) {
						rawValidLinks.push(match[0]);
						validLinks.push({type: 'host', url: match[0]});
					}
				});
			} catch (err) {
				log.warn('[CORE] Regexp error on', host, err, regexp);
				continue;	
			}
		}
	}

	for(var host in folders) {	
		if(env.options.disabledHosts == true && env.options.disabledHostsList.indexOf(host) != -1)
			continue;

		for(var reg in folders[host]) {
			try {
				var regexp = folders[host][reg];
				XRegExp.forEach(content, XRegExp(regexp), (match, i) => {
					if(validLinks.indexOf(match[0]) == -1 && rawValidLinks.indexOf(match[0]) === -1) {
						rawValidLinks.push(match[0]);
						validLinks.push({type: 'folder', url: match[0]});
					}
				});
			} catch (err) {
				log.warn('[CORE] Regexp error on', host, err, regexp);
				continue;	
			}
		}
	}

	if(env.options.enabledStream && env.options.enabledStreamList.length > 0) {

		var streams = env.options.enabledStreamList;

		for(var stream in streams) {
			for(var reg in env.config.hosts.streamRegexp[streams[stream]]) {
				try {
					var regexp = env.config.hosts.streamRegexp[streams[stream]][reg];
					XRegExp.forEach(content, XRegExp(regexp), (match, i) => {
						if(validLinks.indexOf(match[0]) == -1 && rawValidLinks.indexOf(match[0]) === -1) {
							rawValidLinks.push(match[0]);
							validLinks.push({type: 'stream', url: match[0]});
						}
					});
				} catch (err) {
					log.warn('[CORE] Regexp error on', host, err, regexp);
					continue;	
				}
			}
		}
	}

	env.config.tabLinks[tab.id] = validLinks;

	return (validLinks.length > 0);
}


var fetchPageLinksInfos = async (tabId) => {
	// With a list of link, get information on those links, and generate the corresponding env.config.tabFiles data
	// Only used when user enabled automatic scan or trigguer a manual scan

	chrome.action.setBadgeText({text: ''});

	env.config.tabFilesProcessing[tabId] = true;

	var links = env.config.tabLinks[tabId];

	env.config.tabFiles[tabId] = {};
	
	var linksBuffer = [];


	for(var i = 0, len = links.length; i < len; i++) {
		if(linksBuffer.length >= 10) {
			var response = await api.fetch('link/infos', {link: linksBuffer});

			linksBuffer = [];
			
			if(response.status == 'success') {
				var index = 0;
				response.data.infos.forEach((info) => {

					if(objLen(env.config.tabFiles[tabId]) > 0) {
						browser.action.setBadgeText({text: objLen(env.config.tabFiles[tabId]).toString()});
					}

					link = info.link;

					for (var i = env.config.tabLinks[tabId].length - 1; i >= 0; i--) {
						if(env.config.tabLinks[tabId][i].url == link) {
							if(exists(info.error)) {
								env.config.tabLinks[tabId][i].status = 'error';
								env.config.tabLinks[tabId][i].error = info.error;
							} else {
								env.config.tabLinks[tabId][i].status = 'ok';
								env.config.tabLinks[tabId][i].filename = info.filename;
								env.config.tabLinks[tabId][i].localStream = false;

								if(env.options.localPlayerPath.length > 0 && supportedLocalStreamExt.indexOf(info.filename.split('.').pop()) !== -1) {
									env.config.tabLinks[tabId][i].localStream = true;
								}
							}
						}
					}

					if(exists(info.error)) {
						return;
					}

					var isMultipart = /(.+)\.part[0-9]+\.rar$/.exec(info.filename);

					if(isMultipart !== null) {

						var cleanName = isMultipart[1];

						if(exists(env.config.tabFiles[tabId][cleanName])) {

							if(exists(env.config.tabFiles[tabId][cleanName].parts[info.filename])) {
								env.config.tabFiles[tabId][cleanName].parts[info.filename].links.push({host: info.hostDomain, link: info.link});
							} else {
								env.config.tabFiles[tabId][cleanName].nbParts++;
								env.config.tabFiles[tabId][cleanName].size = env.config.tabFiles[tabId][cleanName].size + info.size;

								env.config.tabFiles[tabId][cleanName].parts[info.filename] = {
									links : [{host: info.hostDomain, link: info.link}]
								};
							}
						} else {
							env.config.tabFiles[tabId][cleanName] = {
								size: info.size,
								nbParts: 1,
								parts: {
								}
							};

							env.config.tabFiles[tabId][cleanName].parts[info.filename] = {
								links: [{host: info.hostDomain, link: info.link}]
							};
						}
					} else {
						if(exists(env.config.tabFiles[tabId][info.filename])) {
							env.config.tabFiles[tabId][info.filename].links.push({host: info.hostDomain, link: info.link});
						} else {
							env.config.tabFiles[tabId][info.filename] = {
								size: info.size,
								links: [{host: info.hostDomain, link: info.link}]
							}
						}
					}	
				});
				
				
				if(true /* browser.extension.getViews({ type: "popup" }).length > 0 */)
					browser.runtime.sendMessage({command: 'syncPageLinks', files: env.config.tabFiles[tabId], processing: env.config.tabFilesProcessing[tabId] });
			} else {
				//console.log('Bad req', response);
			}
		}

		var linkInfos = links[i];

		if(linkInfos.type == 'folder') {
			var response = await api.fetch('link/redirector', {link: linkInfos.url});

			if(response.status == 'success') {
				response.data.links.forEach((link) => {
					linksBuffer.push(link);
				});
			}
		} else {
			linksBuffer.push(linkInfos.url);
		}
	}

	if(linksBuffer.length > 0) {
		var response = await api.fetch('link/infos', {link: linksBuffer});
		if(response.status == 'success') {

			response.data.infos.forEach((info) => {

					if(objLen(env.config.tabFiles[tabId]) > 0) {
						browser.action.setBadgeText({text: objLen(env.config.tabFiles[tabId]).toString()});
					}

					link = info.link;

					for (var i = env.config.tabLinks[tabId].length - 1; i >= 0; i--) {
						if(env.config.tabLinks[tabId][i].url == link) {
							console.log(info)
		
							if(exists(info.error)) {
								env.config.tabLinks[tabId][i].status = 'error';
								env.config.tabLinks[tabId][i].error = info.error;
								return;
							} else {
								env.config.tabLinks[tabId][i].status = 'ok';
								env.config.tabLinks[tabId][i].filename = info.filename;
								env.config.tabLinks[tabId][i].localStream = false;

								if(env.options.localPlayerPath.length > 0 && supportedLocalStreamExt.indexOf(info.filename.split('.').pop()) !== -1) {
									env.config.tabLinks[tabId][i].localStream = true;
								}
							}
						}
					}

					var isMultipart = /(.+)\.part[0-9]+\.rar$/.exec(info.filename);

					if(isMultipart !== null) {

						var cleanName = isMultipart[1];

						if(exists(env.config.tabFiles[tabId][cleanName])) {

							if(exists(env.config.tabFiles[tabId][cleanName].parts[info.filename])) {
								env.config.tabFiles[tabId][cleanName].parts[info.filename].links.push({host: info.hostDomain, link: info.link});
							} else {
								env.config.tabFiles[tabId][cleanName].nbParts++;
								env.config.tabFiles[tabId][cleanName].size = env.config.tabFiles[tabId][cleanName].size + info.size;

								env.config.tabFiles[tabId][cleanName].parts[info.filename] = {
									links : [{host: info.hostDomain, link: info.link}]
								};
							}
						} else {
							env.config.tabFiles[tabId][cleanName] = {
								size: info.size,
								nbParts: 1,
								parts: {
								}
							};

							env.config.tabFiles[tabId][cleanName].parts[info.filename] = {
								links: [{host: info.hostDomain, link: info.link}]
							};
						}
					} else {
						if(exists(env.config.tabFiles[tabId][info.filename])) {
							env.config.tabFiles[tabId][info.filename].links.push({host: info.hostDomain, link: info.link});
						} else {
							env.config.tabFiles[tabId][info.filename] = {
								size: info.size,
								links: [{host: info.hostDomain, link: info.link}]
							}
						}
					}	
				});

			env.config.tabFilesProcessing[tabId] = false;
		}
	}

	env.config.tabFilesProcessing[tabId] = false;

	// Some files may only have 1 part. In those cases, we re-pack the file as unique.
	objForEach(env.config.tabFiles[tabId], (file, index) => {
		if(exists(file.nbParts) && file.nbParts == 1) {
			objForEach(file.parts, (singleFile, filename) => {
				// Only one file here...
				env.config.tabFiles[tabId][filename] = {
					size: file.size,
					links: singleFile.links
				}
			});
			delete env.config.tabFiles[tabId][index];
		}
	});

	// Send the result to the popup
	if(true /*browser.extension.getViews({ type: "popup" }).length > 0*/)
		browser.runtime.sendMessage({command: 'syncPageLinks', files: env.config.tabFiles[tabId], processing: env.config.tabFilesProcessing[tabId]});

	if(objLen(env.config.tabFiles[tabId]) > 0) {
		log.info('[FEAT] Files found on tab', tabId, env.config.tabFiles[tabId]);
	}

	if(env.config.currentTab == tabId) {
		browser.action.setBadgeText({text: objLen(env.config.tabFiles[tabId]).toString()});
	}
	
	browser.tabs.sendMessage(tabId, {command: 'linkInfos', links: env.config.tabLinks[tabId]});

	return (objLen(env.config.tabFiles[tabId]) > 0);	
}


// Setup extension commincation, for content scripts, popup and native messaging
var handleMessage = async (request, sender) => {
		
	var command = request.command;

	if( !(env && env.config && env.config.init && env.config.init === true) ) {
		log.info('[COMM] Extension not ready, waiting for init first');

		await waitForInit();
	}

	if(command != "checkLink")
		log.info('[COMM] New command', request);


	if(command == "sendPageLink") {
		// User trigguer a file download from popup
		// Let's get the best link available for this file, and send the user with it to Alldebrid

		var linksToSend = [];
		var linksToProcess = [];

		if(!exists(request.infos.nbParts)) {
			linksToProcess.push(request.infos.links);
		} else {
			objForEach(request.infos.parts, (infos, filename) => {
				linksToProcess.push(infos.links);
			});
		}

		linksToProcess.forEach((links) => {
			var bestLink = {priority: 1000};

			if(links.length > 1) {
				links.forEach( (link) => {
					if(exists(env.config.hosts.priority[link.host])) {
						if(env.config.hosts.priority[link.host] < bestLink.priority) {
							bestLink = {priority: env.config.hosts.priority[link.host], link: link.link}
						}
					}
					else {
						if(bestLink.priority == 1000) {
							bestLink = {priority: 999, link: link.link}
						}
					}
				});
			} else {
				bestLink.link = links[0].link
			}

			linksToSend.push(bestLink.link);
		});

		sendToAlld(linksToSend.join("\n"));
		return;
    }

    if(command == "sendPageAllLinks") {
    	// User trigguer all files download from popup
		// Let's get the best link available for all the files, and send the user with the final links to Alldebrid

		var linksToSend = [];

		objForEach(request.infos, (infos, filename) => {
			var linksToProcess = [];

			if(!exists(infos.nbParts)) {
				linksToProcess.push(infos.links);
			} else {
				objForEach(infos.parts, (partInfos, filename) => {
					linksToProcess.push(partInfos.links);
				});
			}

			linksToProcess.forEach((links) => {
				var bestLink = {priority: 1000};

				if(links.length > 1) {
					links.forEach( (link) => {
						if(exists(env.config.hosts.priority[link.host])) {
							if(env.config.hosts.priority[link.host] < bestLink.priority) {
								bestLink = {priority: env.config.hosts.priority[link.host], link: link.link}
							}
						}
						else {
							if(bestLink.priority == 1000) {
								bestLink = {priority: 999, link: link.link}
							}
						}
					});
				} else {
					bestLink.link = links[0].link
				}

				linksToSend.push(bestLink.link);
			});
		});

		sendToAlld(linksToSend.join("\n"));
		return;
    }

    if(command == "sendToAlld") {
    	// Open links on Alldebrid. Like 90% of user action finish here.
    	log.info('[COMM] Sending links to Alldebrid', request.urls);

		var urls = request.urls;

		sendToAlld(urls.join("\n"));
		return true;
    }

    if(command == "download") {
    	// New feature 10.4.0
    	// Direct download of a link, through our API, without opening the Alldebrid service page

    	log.info('[COMM] Downloading link ', request.url);

		var url = request.url;

		return new Promise( async (resolve, reject) => {
			try {

				var response = await api.fetch('link/unlock', {'link': url});

				if(response.status == 'success') {
					var dlLink = response.data.link;

					if(dlLink.length > 0) {

						if(env.config.client.nav = 'ff') {
							browser.tabs.sendMessage(env.config.currentTab, {command: 'triggerPageDL', link: dlLink}, {frameId: 0});
						} else {
							var tabIndex = false;

							// Try to open the download next to the current active tab
							// Download action from page itself, sender is tab
							if(exists(sender.tab) && exists(sender.tab.index)) {
								tabIndex = sender.tab.index + 1;
							}
							// Download action from popup, let's get index of active tab
							if(exists(sender.id) && sender.id == browser.runtime.id) {
								// From popup
								if(env.config.currentTab !== false) {
									var currentTabInfo = await browser.tabs.get(env.config.currentTab);

									if(currentTabInfo) {
										tabIndex = currentTabInfo.index + 1;
									}
								}
							}

							if(tabIndex) {
								browser.tabs.create({ url: dlLink, active: false, index: tabIndex});
							}
							else {
								browser.tabs.create({ url: dlLink, active: false });
							}
						}
					}
					resolve({status: 'success'});
				} else {
					resolve({status: 'error', error: response.error});
				}
			}
			catch(error) {
				resolve({status: 'error', error: error});
			}
	    });	

		
    }

    if(command == "save") {
    	// New feature 10.4.0
    	// Direct download of a link, through our API, without opening the Alldebrid service page

    	log.info('[COMM] SAving link ', request.url);

		var url = request.url;

		return new Promise( async (resolve, reject) => {
			try {

				var response = await api.fetch('user/links/save', {'links[]': url});

				if(response.status == 'success') {
					var dlLink = response.data.link;

					resolve({status: 'success'});
				} else {
					resolve({status: 'error', error: response.error});
				}
			}
			catch(error) {
				resolve({status: 'error', error: error});
			}
	    });		
    }


    

    if(command == "stream") {
    	// Same as above, but do not trigger a download, but send the download link to the native handler to open in the user media player
    	log.info('[COMM] Downloading link ', request.url);

    	if(env.options.localPlayerPath.length == 0)
		    return {status: 'error', error: 'No local player set'};

		var url = request.url;

		var response = await api.fetch('link/unlock', {'link': url});

		if(response.status == 'success') {
			var dlLink = response.data.link;

			if(dlLink.length > 0) {
		    	if(env.config.client.os == 'mac')
		    		native.localStream(env.options.localPlayer, dlLink);
		    	else
		    		native.localStream(env.options.localPlayerPath, dlLink);
			}
			return {status: 'success'};
		} else {
			return {status: 'error', error: response.error};
		}
    }

	
	if(command == "manualFindLinks") {
		// User ask for a webpage file scan, let's tell that to the link-detector CS
		if(env.config.currentTab == false) {
			var tabInfos = await browser.tabs.query({active: true, currentWindow: true});

			if(tabInfos.length != 1)
				return {error: 'reload'};

			env.config.currentTab = tabInfos[0].id;
		}

		log.info('[COMM] User-triggued finding links from page content');
		log.info('[COMM] Sending command to tab', env.config.currentTab);

		return new Promise( async (resolve, reject) => {

			var result;
			try {
				result = await browser.tabs.sendMessage(env.config.currentTab, {command: 'manualScan'}, {frameId: 0});
			} catch(error) {
				try {
					log.info('[COMM] Re-injecting scripts on', env.config.currentTab);
					await browser.scripting.executeScript({
						target: {
							tabId: env.config.currentTab,
							allFrames: true,
							
						},
						injectImmediately: true,
						files: ["/content-scripts/messaging.js"]
					});

					await browser.scripting.executeScript({
						target: {
							tabId: env.config.currentTab,
							allFrames: true,
							
						},
						injectImmediately: true,
						files: ["/content-scripts/link-detector.js"]
					});


					result = await browser.tabs.sendMessage(env.config.currentTab, {command: 'manualScan'}, {frameId: 0})
				} catch(error) {
					log.info('[RIVER] Upload error', error);
					notification(lang("notif_river_upload_error"), lang("notif_river_upload_error_desc"));
					return;	
				}
			}

			try {

				var hasValidLinks = await findLinks(result.payload, {id: env.config.currentTab, active: true});

				if(hasValidLinks) {
					// Ok we have links
					log.info('[FEAT] Links found on tab', env.config.currentTab, env.config.tabLinks[env.config.currentTab]);

					// User-trigguered manual scan, user want file info, so let's get them
					var hasFiles = await fetchPageLinksInfos(env.config.currentTab);

					if(hasFiles) {
						chrome.action.setBadgeText({text: objLen(env.config.tabFiles[env.config.currentTab]).toString()});
						
					}
					else {
						chrome.action.setBadgeText({text: ''});
						
					}

					resolve(env.config.tabFiles[env.config.currentTab]);
				} else {
					browser.action.setBadgeText({text: ''});
					resolve({});
				}
			}
			catch(error) {
				var error = {error: 'reload'};
				resolve(error);
			}
	    });	
    }


    if(command == "findLinks") {
    	// Sent from content-script link-detector.js
		log.info('[COMM] Finding links from page content'); 

		var hostname = uri.extractHostname(sender.tab.url);

		// User have issue on facebook with this feature. Hard disabling on those websites for now.
		if(hostname && ['facebook.com', 'www.facebook.com', 'static.xx.fbcdn.net'].indexOf(hostname) !== -1) {
			log.info('[FEAT] Not scanning page, blacklisted domain');
			browser.action.setBadgeText({text: ''});
			resolve(false);
		}

		return new Promise( async (resolve, reject) => {
			var hasValidLinks = await findLinks(request.payload, sender.tab);

			if(hasValidLinks === true) {
				// Ok, we have supported links !
				browser.action.setBadgeText({text: objLen(env.config.tabFiles[env.config.currentTab]).toString()});
				
				// Only get link infos if the user enabled this feature
				if(env.options.findPageLinks == true &&  
					(env.options.findPageWhitelisted == false || env.options.findPageWhitelist.indexOf(hostname) !== -1 )
				) {
					// No need to block on this, async call. File infos will be sent to popup and webpage as need when info come back.
					fetchPageLinksInfos(sender.tab.id);
				} else {
					log.info('[FEAT] Website not whitelisted, skipping scan');
				}
			} else {
				browser.action.setBadgeText({text: ''});
			}
			
			resolve(env.config.tabLinks[env.config.currentTab]);
		});	
    }

    
	if(command == "checkLink") {
		// Test link href, enable context menu if link is supported
		// Waiting for Chrome to implement browser.contextMenus.onShown to get ride of this hacky thing

		if(env.config.client.features.extendedPattern == false) {
			if(request.payload.indexOf('magnet:?xt=urn:btih') === 0) {
				if(env.config.contextMagnet !== true) {
					log.info('[COMM] Enabling magnet unlock context menu');
					browser.contextMenus.create({
						"title": lang("context_river"), 
						"contexts":["link"], 
						//"onclick": downloadRiver, 
						"id": 'uploadYNWForced'
					});
				}

				env.config.contextMagnet = true;
				//return true;
			} else {
				if(env.config.contextMagnet === true) {
					log.info('[COMM] Disabling magnet unlock context menu');
					browser.contextMenus.remove('uploadYNWForced').then(
						() => {},
						() => {},
					);
				}

				env.config.contextMagnet = false;
				//return true;
			}
		} 

		var isValid = isValidHostLink(request.payload);

		if(isValid == true) {
    		if(env.config.contextUnlock == false) {
    			log.info('[COMM] Enabling single link unlock context menu');
    			browser.contextMenus.create({
					"title": lang("context_unlock"), 
					"contexts": ["link"], 
					//"onclick": download, 
					"id": 'downloadLink'
				});
    		}

    		env.config.contextUnlock = true;
    		return true;
    	}
    	else {
    		if(env.config.contextUnlock == true) {
    			log.info('[COMM] Disabling single link unlock context menu');
    			browser.contextMenus.remove('downloadLink').then(
					() => {},
					() => {},
				);
    		}

    		env.config.contextUnlock = false;
    		return false;
    	}

    }

    
    if(command == "checkSelection") {
    	// Check user selection for supported links
    	var isValidSelection = downloadSelection(request.payload, true);

    	log.info('[COMM] Checking selection', isValidSelection, request.payload);
    	
    	if(isValidSelection == true) {
    		if(env.config.currentSelection === false) {
    			log.info('[COMM] Enabling selection unlock context menu');
    			browser.contextMenus.create({
					"title": lang("context_unlock_multiple"), 
					"contexts": ["selection"],
					//"onclick": downloadSelection, 
					"id": 'downloadLinks'
				});
    		}

    		env.config.currentSelection = request.payload;
    		return true;
    	}
    	else {
    		log.info('[COMM] Disabling selection unlock context menu', env.config.currentSelection);
    		if(env.config.currentSelection !== false) {
    			
    			browser.contextMenus.remove('downloadLinks').then(
					() => {},
					() => {},
				);
    		}

    		env.config.currentSelection = false;
    		return false;
    	}	
    }

    // Disable selection context menu
    if(command == "emptySelection") {
    	log.info('[COMM] Emptying selection');

    	if(env.config.currentSelection !== false) {
    		log.info('[COMM] Disabling selection unlock context menu');
			browser.contextMenus.remove('downloadLinks').then(
				() => {},
				() => {},
			);
		}
		env.config.currentSelection = false;
		return true;
    } 


	if(command == 'env') {

		if(env.config.dlLinksTab) {
			log.info('[COMM] Sending links', env.config.dlLinksTab, env.config.dlLinks);
			browser.tabs.sendMessage(env.config.dlLinksTab, {command: 'downloadLinks', links: env.config.dlLinks}, {frameId: 0});
			env.config.dlLinksTab = false;
			env.config.dlLinks = [];
		}
		
		// Return env variables for content scripts and popup
		if(typeof(request.key) == 'string') {
			// Only a single key requested, let's return it
			//log.info('[COMM] Sending env variable', request.key, 'to', request.from);
			log.info('[COMM] Sending env variables', request.key, 'to', request.from, getEnv(request.key));
			return getEnv(request.key);
		} 

		if(Array.isArray(request.keys)) {
			var payload = {
				//logHistory: log.history.map((log) => [log[0], log[1]])
			};

			for(var i = 0, len = request.keys.length; i < len; i++) {
				var value = getEnv(request.keys[i]);
				if(value !== null) {
					// Get request element name. 'config' => 'config', 'config.hosts.last_update' => 'last_update'
					var key = request.keys[i].split('.').pop(); 

					payload[key] = value;
				}
			}
			log.info('[COMM] Sending env variables', request.keys, 'to', request.from, payload);
			return payload;
		}

		return {error: 'No valid key string or keys array given', command}; // Bad arguments
	}

	if(command == 'settings') {
		// Change settings, from popup
		var refreshLang = false;
		var toBootstrap = false;
		objForEach(request.updates, async (value, key) => {
			if(key == 'disabledHostsList' || key == 'enabledStreamList' || key == 'customSources') {
				if(value.add) {
					log.info('[COMM] Updated setting, adding', value.add, 'to', key, 'from', request.from);
					env.options[key].push(value.add);
				}
				if(value.delete) {
					log.info('[COMM] Updated setting, deleting', value.delete, 'to', key, 'from', request.from);
					env.options[key].splice(env.options[key].indexOf(value.delete), 1);
				}
				if(key == 'customSources') {
					setupContextMenu();
				} else {
					refreshRegexps();
				}
			} else {
				log.info('[COMM] Updated setting', key, 'to', value, 'from', request.from);
				env.options[key] = value;

				if(key == 'riverCompletionNotif' || key == 'riverLiveNotif')
					cronRiver(true);
				if(key == 'enabledStream' || key == 'disabledHosts')
					refreshRegexps();
				if(key == 'riverCustomSource')
					setupContextMenu();
				if(key == 'replaceStreamSource')
					setupInterception();
				if(key == 'changeLink')
					setupContentScripts();
				if(key == 'findPageLinks') {
					if(value == false) {
						chrome.action.setBadgeText({text: ''});
						
						env.config.tabLinks = {};
						env.config.tabFiles = {};
						env.config.tabFilesProcessing = {};
					}
				}

				if(key == 'forcedLang')
					refreshLang = true;

				if(key == 'privacyOptIns') {
					if(env.config.boot == false && value.reviewed == true) {
						// Privacy policy were review, can bootstrap the extension accordingly
						toBootstrap = true;
					}
				}
			}	
		});

		if(refreshLang === true) {
			await refreshLangStore();
		}

		if(toBootstrap === true) {
			log.info('[CORE] Privacy policies accepted, bootstrapping');
			await bootstrap();
		}

		storage.set({options: env.options});
		return;
	}

	if(command == 'disableSourceStream') {
		let match;
		if( (match = request.url.match(/https:\/\/streamango\.com\/(f|embed)\/([a-zA-Z0-9_\-]{16})/) ) !== null) {
			log.info('[COMM] Disabling source replacement for', match[2]);
			env.config.disabledSourceID = match[2];
		}
		else if( (match = request.url.match(/https:\/\/openload\.co\/(f|embed)\/([a-zA-Z0-9_\-]{11})/) ) !== null) {
			log.info('[COMM] Disabling source replacement for', match[2]);
			env.config.disabledSourceID = match[2];
		} 

		return;
	}

	if(command == 'toggleLearning') {
		if(request.value == true) { // Enable learning context menu option
			log.info('[FEAT] Enabling custom source learning');
			browser.contextMenus.create({
				"title": 'Learn torrent link', 
				"contexts":["link"], 
				//"onclick": learn, 
				"id": 'learnLink'
			});
			env.config.rivers.isLearning = true;
			env.config.rivers.learnLinks = [];
		} else {
			log.info('[FEAT] Disabling custom source learning');
			browser.contextMenus.remove('learnLink').then(
				() => {},
				() => {},
			);
			env.config.rivers.isLearning = false;
			env.config.rivers.learnLinks = [];
		}

		return;
	}

	if(command == 'addCustomSource') {
		var pattern = request.pattern;

		if(env.options.customSources.indexOf(pattern) !== -1)
			return false; // Pattern already exists

		log.info('[FEAT] Add custom source pattern', pattern);

		env.options.customSources.push(pattern);
		env.config.rivers.learnLinks = [];
		env.config.rivers.isLearning = false;
		setupContextMenu();

		storage.set({options: env.options});

		return true;
	}
	
	// From popup content script
	if(command == "processSelection") {
    	log.info('[COMM] Processing selection', request.payload)

    	downloadSelection(request.payload);
    	return;
    } 

    // Initiate local stream to native player
    if(command == "localStream") {
    	if(env.options.localPlayerPath.length == 0)
    		return {error: 'No local player set'};

    	if(env.config.client.os == 'mac')
    		native.localStream(env.options.localPlayer, request.url);
    	else
    		native.localStream(env.options.localPlayerPath, request.url);
    	
    	return true;
    }

    // test weither user provider pattern is valid or not
    if(command == "testPattern") {
    	var pattern = request.pattern;

    	// return Promise, shit I look like I know what I'm doing
    	// Does that even works ?
    	return new Promise(resolve => {
	      	var coucou = browser.contextMenus.create({
				"title": 'Testing user pattern', 
				"contexts": ["link"], 
				//"onclick": () => {}, 
				"id": 'userPatternCheck',
				"targetUrlPatterns": [pattern]
			}, () => {
				if (browser.runtime.lastError) {
					log.warn(browser.runtime.lastError);
					return resolve(false);
				}
				browser.contextMenus.remove('userPatternCheck');
				return resolve(true);
			});
	     });
    } 

    if(command == "isLoggued") {
    	if(env.langStore.webext != 'true')
    		await refreshLangStore();
    	
    	env.config.client = await getClientInfos();
    	return await api.login();
    }

    if(command == "syncLogguedState") {
    	if( (env.config.isLoggued && request.isLoggued == false) || 
    		(!env.config.isLoggued && request.isLoggued == true) ) {

    		log.info('[COMM] Syncing loggued state');

    		env.config.client = await getClientInfos();
    		api.login();
    	}   	
    }

    if(command == "debugHistory") {
    	return log.history;
    } 

    // Bootsrap app features, if loggued from popup
    if(command == "bootstrap") {
    	log.info('[COMM] Bootstraping extension');
    	await bootstrap();
    	return env;
    } 
	
	// example async response
	if(command == 'infosDelayed') {
		return new Promise(resolve => {
	      	setTimeout(() => {
	        	resolve({version: '0.0.1', nodeAvailable: false});
	      	}, 500);
	    });
	}
	
	return {error: 'Unknown command', command}; // Noob
}


var onTabChange = (tabInfo) => {
	console.log('Current tab', tabInfo)
	env.config.currentTab = tabInfo.tabId;
	if(exists(env.config.tabFiles[tabInfo.tabId]) && objLen(env.config.tabFiles[tabInfo.tabId]) > 0) {
		chrome.action.setBadgeText({text: objLen(env.config.tabFiles[tabInfo.tabId]).toString()});
		
		return;
	} else if(env.config.tabFilesProcessing[tabInfo.tabId] == true) {
		chrome.action.setBadgeText({text: ''});
		
		return;
	}
	chrome.action.setBadgeText({text: ''});
}

var onWindowChange = async (windowId) => {
	const [tab] = await chrome.tabs.query( { active: true, lastFocusedWindow: true });

	if(tab) {
		console.log('Current tab after onWindowChange', tab)
		env.config.currentTab = tab.id;
		if(exists(env.config.tabFiles[env.config.currentTab]) && objLen(env.config.tabFiles[env.config.currentTab]) > 0) {
			chrome.action.setBadgeText({text: objLen(env.config.tabFiles[env.config.currentTab]).toString()});
			
			return;
		} else if(env.config.tabFilesProcessing[env.config.currentTab] == true) {
			chrome.action.setBadgeText({text: ''});
			
			return;
		}
		chrome.action.setBadgeText({text: ''});
	}
}



var onTabRemove = (tabId) => {
	delete env.config.tabLinks[tabId];
	delete env.config.tabFiles[tabId];
}

var onTabUpdate = (tabId, changeInfo) => {
	if(exists(changeInfo.url)) {
		delete env.config.tabLinks[tabId];
		delete env.config.tabFiles[tabId];
		chrome.action.setBadgeText({text: ''});
	}
}
