var env = {
	'user': {},
	'options': {},
	'config': {},
	'langStore': {},
	'logHistory': [],
};

// Goddamn front-end shitty JS. Go die. 
// Don't expect too much comm'



(async function() {

	// Get needed env data
	var response = await browser.runtime.sendMessage({command: 'env', keys: ['config', 'user', 'langStore', 'options'], from: 'popup'});

	env.config = response.config;
	env.user  = response.user;
	env.options  = response.options;
	env.langStore  = response.langStore;

	//env.logHistory  = response.logHistory;
	//synclogHistory();
	
	
	syncLang();

	//var [error, isLoggued] = await browser.runtime.sendMessage({command: 'isLoggued', from: 'popup'});

	if(!env.config.isLoggued) {
		// Not loggued, displaying guest content
		hide('.loggued');
		show('.guest');
		return;
	} else {
		// Loggued

		if(env.options.privacyOptIns.reviewed === false) {

			const privacyUrl = chrome.runtime.getURL('popup/privacy.html');
			const existingTabs = await chrome.tabs.query({url: privacyUrl});

			if(existingTabs.length == 0) {
				chrome.tabs.create({url: chrome.runtime.getURL('popup/privacy.html')});
				window.close();
			} else {
				chrome.tabs.update(existingTabs[0].id, {active: true});
				window.close();
			}

			return;
		}

		if(!exists(env.config.hosts.lastUpdate)) {// We loggued for first time, let's bootstrap the extension
			var response = await browser.runtime.sendMessage({command: 'bootstrap', from: 'popup'});

			env.config = response.config;
			env.user  = response.user;
			env.options  = response.options;
			env.langStore  = response.langStore;
		}	
	}

	var username = env.user.username;

	if(username.length > 16)
		username = username.substring(0, 13) + '...';

	dom('#username').innerText = username;
	dom('#accountLink').href = 'https://alldebrid.' + env.config.domain + '/account/';

	if(env.options.forcedLang == 'fr' || env.config.domain == 'fr') {
		dom('#streamHelpLink').href = 'https://help.alldebrid.com/fr/Outils%20Alldebrid/streaming';
	} else {
		dom('#streamHelpLink').href = 'https://help.alldebrid.com/en/Alldebrid%20tools/streaming';
	}

	dom('#userDefaultLang').innerText = 'User default (' + env.user.lang + ')';
	
	var currentHostname;

	browser.tabs.query({'active': true, 'lastFocusedWindow': true}).then((tabs) =>  {
		if(tabs.length == 0)
			return;

		var url = tabs[0].url;
		currentHostname = uri.extractHostname(url);

		if(isValidHostLink(url)) {
			hide('#logoLink');
			show('#logoSendToAlld', true);

			listen('#logoSendToAlld', 'click', () => {
				browser.tabs.create({ url: 'https://alldebrid.' + env.config.domain + '/service/?url=' + encodeURIComponent(url)});
			});
		}

		dom('.pageLinksSiteName', (node) => {
			node.innerText = currentHostname;
		});

		if(env.options.findPageWhitelist.indexOf(currentHostname) === -1) {
			show('#pageLinksSiteNotWhitelisted');
		} else {
			show('#pageLinksSiteWhitelisted');
		}
	});

	dom('#logoLink').href = 'https://alldebrid.' + env.config.domain;

	if(env.user.isPremium == false) {
	 	document.getElementById('notPremium').style.display = 'block';
		var elem = document.getElementById('premiumUntil');
		elem.textContent = lang('premium_expired');
		var a = document.createElement('a');
		elem.appendChild(a);
		a.target = '_blank';
		a.textContent = ' ' + lang('premium_renew') + ' ?';
		a.href = "https://alldebrid." + env.config.domain + "/offer/";
		show('.disabledFeatures');
	} else {
		var remainingPremiumDays = Math.round((env.user.premiumUntil - Math.floor(Date.now() / 1000) ) / 60 / 60 / 24);
		dom('#premiumUntil').innerText = lang('premium_expire_in') + ' ' + remainingPremiumDays + ' ' + lang('days');
	}

	// Init UI
	var select = document.getElementById('hosts');
	if(env.config.hosts.hostList) {
		env.config.hosts.hostList.forEach( (host) => {
			var opt = document.createElement('option');
			opt.value = host;
			opt.appendChild(document.createTextNode(host));
			select.appendChild(opt);
	
			if(env.options.disabledHosts == true && env.options.disabledHostsList.indexOf(host) !== -1) {
				opt.hidden = true;
				dom('#disabledHostList').appendChild(createChip('host', host));
			}	
		});
	}
	if(env.config.hosts.folderList) {
		env.config.hosts.folderList.forEach( (host) => {
			var opt = document.createElement('option');
			opt.value = host;
			opt.appendChild(document.createTextNode(host));
			select.appendChild(opt);
	
			if(env.options.disabledHosts == true && env.options.disabledHostsList.indexOf(host) !== -1) {
				opt.hidden = true;
				dom('#disabledHostList').appendChild(createChip('host', host));
			}	
		});
	}

	if(env.config.hosts.streamList) {
		select = document.getElementById('streams');
		env.config.hosts.streamList.forEach( (stream) => {
			var opt = document.createElement('option');
			opt.value = stream;
			opt.appendChild(document.createTextNode(stream));
			select.appendChild(opt);
			if(env.options.enabledStreamList.indexOf(stream) !== -1) {
				opt.hidden = true;
				dom('#enabledStreamList').appendChild(createChip('stream', stream));
			}		
		});
	}

    if(env.options.customSources.length > 0) {
		env.options.customSources.forEach((pattern) => {
			var li = document.createElement('li');
				
			var deleteBtn = document.createElement('span');
			deleteBtn.classList.add("delete");
			deleteBtn.addEventListener('click', onCustomSourceDelete);

			li.innerText = pattern;
			li.prepend(deleteBtn);

			dom('#currentCustomPatterns ul').appendChild(li);	
		});
	} else {
		var li = document.createElement('li');
		li.innerText = '(No custom source yet)';
		dom('#currentCustomPatterns ul').appendChild(li);	
	}

	if(env.config.client.features.liveNotif == false)
		hide('.liveNotifEnabled');

	if(env.options.displayIcons == true)
		dom('#displayIcons').checked = true;
	if(env.options.changeLink == true)
		dom('#changeLink').checked = true;
	if(env.options.blackBar == true)
		dom('#blackBar').checked = true;
	if(env.options.blackBarStream == true)
		dom('#blackBarStream').checked = true;
	if(env.options.autoPopup == true)
		dom('#autoPopup').checked = true;
	if(env.options.findPageLinks == true) {
		dom('#findPageLinks').checked = true;
	}

	if(env.options.forcedLang !== false) {
		dom('#forcedLang').value = env.options.forcedLang;
	}

	if(env.options.findPageWhitelisted == true) {
		dom('#findPageWhitelisted').checked = true;
		show('#pageLinksWhitelist');
	}

	if(env.options.riverLiveNotif == true)
		dom('#riverLiveNotif').checked = true;
	if(env.options.riverCompletionNotif == true)
		dom('#riverCompletionNotif').checked = true;

	if(env.options.riverCustomSource == true) {
		dom('#riverCustomSource').checked = true;
		if(env.config.rivers.isLearning == true) {
			show('#addCustomSource, #customRiverSourceList, #customSourceLearning, #currentCustomPatterns');

			if(env.config.rivers.learnLinks.length < 2) {
				show('#needMoreSources');

				env.config.rivers.learnLinks.forEach((link) => {
					var li = document.createElement('li');
					li.innerText = link;
					dom('#needMoreSources ul').appendChild(li);	
				});
				dom('#nbCustomSources').innerText = env.config.rivers.learnLinks.length;
			} else {
				show('#resultsFromLearning');

				env.config.rivers.learnLinks.forEach((link) => {
					var li = document.createElement('li');
					li.innerText = link;
					dom('#resultsFromLearning ul').appendChild(li);	
				});

				var common = sharedStart(env.config.rivers.learnLinks);

				if(common.length > 10) {
					dom('#resultsFromLearning input').value = common + '*';
					show('#resultsFromLearningAdd', true);
				} else {
					show('#notCommonFound', true);
				}
			}
		}
		else {
			show('#addCustomSource, #customRiverSourceList, #customSourceNotLearning, #currentCustomPatterns');
		}
	}

	if(env.options.disabledHosts == true) {
		dom('#disabledHosts').checked = true;
		show('#disabledHostersBox, #disabledHostList');
	}
	if(env.options.enabledStream == true) {
		dom('#enabledStream').checked = true;
		show('#enabledStreamBox, #enabledStreamList');
	}


	var currentTab = await storage.get('popupTab');

	if( (env.options.findPageLinks == true && Array.isArray(env.config.tabLinks[env.config.currentTab]) && env.config.tabLinks[env.config.currentTab].length > 0) || objLen(env.config.tabFiles[env.config.currentTab]) > 0) {
		renderPageFiles(env.config.tabFiles[env.config.currentTab]);
		dom('#tab0').checked = true;
	}
	else if(currentTab !== undefined)
		dom('#' + currentTab).checked = true;
	else
		dom('#tab1').checked = true;

	listen('.tabHead', 'click', (event) => {
		var label = event.target;

		if(typeof label.dataset.id == 'undefined')
			label = label.parentNode;

		if(label.dataset.id == 'tab3' && env.options.privacyOptIns.local == false) {
			show('.privacySubTitleLocal');
			hide('.privacySubTitleRemote');
			show('.privacy');
			show('.privacySubtitleLocal');

			dom('.privacyLocal', (node) => { node.scrollIntoView({behavior: "smooth"}); });

			show('#localStreamPrivacy');
			hide('#localStreamContent');
			return;
		}

		hide('#localStreamPrivacy');
		show('#localStreamContent');

		storage.set({popupTab: label.dataset.id});
	});



	listen('#pageLinksSiteAdd', 'click', (event) => {
		env.options.findPageWhitelist.push(currentHostname);
		settings({'findPageWhitelist': env.options.findPageWhitelist});

		hide('#pageLinksSiteNotWhitelisted');
		show('#pageLinksSiteWhitelisted');

	});

	listen('#pageLinksSiteRemove', 'click', (event) => {
		env.options.findPageWhitelist.splice(env.options.findPageWhitelist.indexOf(currentHostname), 1);
		settings({'findPageWhitelist': env.options.findPageWhitelist});
		hide('#pageLinksSiteWhitelisted');
		show('#pageLinksSiteNotWhitelisted');
	});

	listen('#pageLinksScanBtn', 'click', async (event) => {

		hide('#pageLinksScanReload');
		hide('#fileListTitle');

		dom('#fileListTitle fileListTitle').innerText = "";

		show('#fileListLoading');

		var fileList = dom('#pageLinksList #fileList');

		while (fileList.firstChild) {
		    fileList.removeChild(fileList.firstChild);
		}

		var now = Date.now();

		dom('#pageLinksScanBtn').innerText = 'Scanning...';

		var response = await browser.runtime.sendMessage({command: 'manualFindLinks', from: 'popup'});

		if(!Array.isArray(response)) {
			if(response.error == 'reload') {
				show('#pageLinksScanReload');
				dom('#pageLinksScanBtn').innerText = 'Re-scan page';
				return;
			}
		}

		env.config.tabLinks[env.config.currentTab] = response;
		
		if(env.config.tabLinks[env.config.currentTab].length > 0) {
			renderPageFiles(env.config.tabFiles[env.config.currentTab]);
		} else {
			var elapsed = Date.now() - now;

			if(elapsed > 500)
				dom('#pageLinksScanBtn').innerText = 'Re-scan page';
			else
				setTimeout(() => {
					dom('#pageLinksScanBtn').innerText = 'Re-scan page';
				}, (500 - elapsed));
		}
	});

	listen('#pageLinksOpenBtn', 'click', async (event) => {
		browser.runtime.sendMessage({command: 'sendPageAllLinks', infos: env.config.tabFiles[env.config.currentTab], from: 'popup'});
	});

	listen('#displayIcons', 'change', () => {

		var checked = dom('#displayIcons').checked;

		if(checked && env.options.privacyOptIns.remote == false) {
			show('.privacy');
			hide('.privacySubTitleLocal');
			show('.privacySubTitleRemote');
			dom('#displayIcons').checked = false;
			dom('#displayIcons').parentNode.classList.add('disabled');
			dom('.privacyRemote', (node) => { node.scrollIntoView({behavior: "smooth"}); });
			return;
		}

		settings({'displayIcons': checked});
		env.options.displayIcons = checked;
	});

	listen('#changeLink', 'change', () => {
		var checked = dom('#changeLink').checked;
		settings({'changeLink': checked});
		env.options.changeLink = checked;
	});

	listen('#blackBar', 'change', () => {
		var checked = dom('#blackBar').checked;
		settings({'blackBar': checked});
		env.options.blackBar = checked;
	});

	listen('#blackBarStream', 'change', () => {
		var checked = dom('#blackBarStream').checked;
		settings({'blackBarStream': checked});
		env.options.blackBarStream = checked;
	});

	listen('#autoPopup', 'change', () => {
		var checked = dom('#autoPopup').checked;
		settings({'autoPopup': checked});
		env.options.autoPopup = checked;
	});

	listen('#findPageLinks', 'change', () => {

		var checked = dom('#findPageLinks').checked;

		if(checked && env.options.privacyOptIns.remote == false) {
			show('.privacy');
			show('.privacySubTitleRemote');
			hide('.privacySubTitleLocal');
			dom('#findPageLinks').checked = false;
			dom('#findPageLinks').parentNode.classList.add('disabled');
			dom('.privacyRemote', (node) => { node.scrollIntoView({behavior: "smooth"}); });
			return;
		}

		settings({'findPageLinks': checked});
		env.options.findPageLinks = checked;

		if(checked) {
			if(env.options.findPageWhitelisted == true) {
				show('#pageLinksWhitelist');
			} else {
				hide('#pageLinksWhitelist');
			}
		} else {
			hide('#pageLinksWhitelist');
		}
	});

	listen('#findPageWhitelisted', 'change', () => {

		var checked = dom('#findPageWhitelisted').checked;

		if(checked && env.options.privacyOptIns.remote == false) {
			show('.privacy');
			show('.privacySubTitleRemote');
			hide('.privacySubTitleLocal');
			dom('#findPageWhitelisted').checked = false;
			dom('#findPageWhitelisted').parentNode.classList.add('disabled');
			dom('.privacyRemote', (node) => { node.scrollIntoView({behavior: "smooth"}); });
			return;
		}
		
		settings({'findPageWhitelisted': checked});
		env.options.findPageWhitelisted = checked;

		if(checked) {
			show('#pageLinksWhitelist');
		} else {
			hide('#pageLinksWhitelist');
		}
	});


	listen('#riverLiveNotif', 'change', () => {
		var checked = dom('#riverLiveNotif').checked;
		settings({'riverLiveNotif': checked});
		env.options.riverLiveNotif = checked;
	});

	listen('#riverCompletionNotif', 'change', () => {
		var checked = dom('#riverCompletionNotif').checked;
		settings({'riverCompletionNotif': checked});
		env.options.riverCompletionNotif = checked;
	});

	listen('#riverCustomSource', 'change', () => {
		var checked = dom('#riverCustomSource').checked;
		settings({'riverCustomSource': checked});
		env.options.riverCustomSource = checked;

		if(checked) {
			show('#addCustomSource, #customRiverSourceList, #customSourceNotLearning, #currentCustomPatterns');
		}
		else {
			hide('#addCustomSource, #customRiverSourceList, #customSourceNotLearning, #currentCustomPatterns');

			if(env.config.rivers.isLearning == true) {
				env.config.rivers.isLearning = false;
				env.config.rivers.learnLinks = [];
				hide('#customSourceLearning');
				browser.runtime.sendMessage({command: 'toggleLearning', value: false, from: 'popup'});
			}	
		}
	});

	listen('#customSourceNotLearning button', 'click', () => {
		hide('#customSourceNotLearning');
		show('#customSourceLearning');
		env.config.rivers.isLearning = true;
		browser.runtime.sendMessage({command: 'toggleLearning', value: true, from: 'popup'});
	});

	listen('#customSourceLearning button', 'click', () => {
		hide('#customSourceLearning');
		show('#customSourceNotLearning');
		env.config.rivers.isLearning = false;
		env.config.rivers.learnLinks = [];
		dom('#resultsFromLearning input').value = '';
		hide('#notCommonFound');
		var customSourceUl = dom('#resultsFromLearning ul');
		while (customSourceUl.firstChild) {
		    customSourceUl.removeChild(customSourceUl.firstChild);
		}
		browser.runtime.sendMessage({command: 'toggleLearning', value: false, from: 'popup'});
	});

	listen('#resultsFromLearning .add', 'click', async () => {
		var pattern = dom('#resultsFromLearning input').value;

		var isPatternValid = await browser.runtime.sendMessage({command: 'testPattern', pattern});

		if(!isPatternValid) {
			show('#patternNotValid');
			setTimeout(() => { hide('#patternNotValid'); }, 5000);
			return;
		}

		var response = await browser.runtime.sendMessage({command: 'addCustomSource', pattern, from: 'popup'});

		hide('#customSourceLearning');
		show('#customSourceNotLearning');

		if(response == true) {
			env.options.customSources.push(pattern);
			// Added with success
			var customSourceUl = dom('#currentCustomPatterns ul');
			while (customSourceUl.firstChild) {
			    customSourceUl.removeChild(customSourceUl.firstChild);
			}
			if(env.options.customSources.length > 0) {
				env.options.customSources.forEach((pattern) => {
					var li = document.createElement('li');
					
					var deleteBtn = document.createElement('span');
					deleteBtn.classList.add("delete");
					deleteBtn.addEventListener('click', onCustomSourceDelete);

					li.innerText = pattern;
					li.prepend(deleteBtn);

					customSourceUl.appendChild(li);	
				});
			} else {
				var li = document.createElement('li');
				li.innerText = '(No custom source yet)';
				customSourceUl.appendChild(li);	
			}
		}
	});

	listen('#disabledHosts', 'change', () => {
		var checked = dom('#disabledHosts').checked;
		settings({'disabledHosts': checked});
		env.options.disabledHosts = checked;
		
		if(checked)
			show('#disabledHostersBox, #disabledHostList');
		else
			hide('#disabledHostersBox, #disabledHostList');
	});

	listen('#enabledStream', 'change', () => {
		var checked = dom('#enabledStream').checked;
		settings({'enabledStream': checked});
		env.options.changeLink = checked;

		if(checked)
			show('#enabledStreamBox, #enabledStreamList');
		else
			hide('#enabledStreamBox, #enabledStreamList');
	});

	listen('#disabledHostersBox .add', 'click', () => {
		var host = dom('#hosts').value;

		settings({'disabledHostsList': {'add' : host}});
		env.options.disabledHostsList.push(host);

		dom('#hosts').options[dom('#hosts').selectedIndex].hidden = true;
		dom('#disabledHostList').appendChild(createChip('host', host));

		var i = 0;
		do {
			if(dom('#hosts').options[i].hidden == false) {
				dom('#hosts').selectedIndex = i;
				break;
			}
			i++;
		} while(i < dom('#hosts').options.length);
	});

	listen('#enabledStreamBox .add', 'click', () => {
		var stream = dom('#streams').value;

		settings({'enabledStreamList': {'add' : stream}});
		env.options.enabledStreamList.push(stream);

		dom('#streams').options[dom('#streams').selectedIndex].hidden = true;
		dom('#enabledStreamList').appendChild(createChip('stream', stream));

		var i = 0;
		do {
			if(dom('#streams').options[i].hidden == false) {
				dom('#streams').selectedIndex = i;
				break;
			}
			i++;
		} while(i < dom('#streams').options.length);
	});

	listen('#customPlayerAdd', 'click', async () => {

		if(env.options.privacyOptIns.local == false) {
			show('.privacy');
			hide('.privacySubTitleRemote');
			show('.privacySubTitleLocal');
			return;
		}

		var path = dom('#customPlayerInput').value;

		var isPathValid = await native.checkPath(path);

		if(!isPathValid) {
			show('#localPlayersInvalidPath');
			setTimeout(() => { hide('#localPlayersInvalidPath'); }, 5000);
			return;
		}

		var playerName = formatName(path);

		dom('#customPlayerName').innerText = playerName;
		dom('#customPlayerPath').innerText = path;

		hide('#localPlayerNotSet');
		show('#localPlayerSet');
		
		settings({'localPlayer': playerName, 'localPlayerPath': path});
		env.options.localPlayer = playerName;
		env.options.localPlayerPath = path;

		dom('#customPlayerInput').value = '';
	});

	listen('#localPlayersScan', 'click', async () => {

		if(env.options.privacyOptIns.local == false) {
			show('.privacy');
			hide('.privacySubTitleRemote');
			show('.privacySubTitleLocal');
			return;
		}

		opacity('.loading', 1);
		var localPlayers = await native.scanLocalPlayers();
		opacity('.loading', 0);

		if(localPlayers.length == 0) {
			show('#localPlayersNotFound');
			return;
		}

		if(localPlayers.length == 1) {
			var path = localPlayers[0];
			var playerName = formatName(path);

			dom('#customPlayerName').innerText = playerName;
			dom('#localPlayersFoundOneName').innerText = playerName;
			dom('#customPlayerPath').innerText = path;

			hide('#localPlayerNotSet');
			show('#localPlayerSet');

			settings({'localPlayer': playerName, 'localPlayerPath': path});
			
			env.options.localPlayer = playerName;
			env.options.localPlayerPath = path;

			show('#localPlayersFoundOne');

			setTimeout(() => { hide('#localPlayersFoundOne'); }, 5000);

			return;
		}

		var customSourceUl = dom('#localPlayersFound ul');
		while (customSourceUl.firstChild) {
		    customSourceUl.removeChild(customSourceUl.firstChild);
		}

		localPlayers.forEach( (playerPath) => {
			var span = document.createElement('span');
			span.append(createIcon('plus', '#90c76f'));
			span.classList.add("add");
			span.addEventListener('click', onLocalPlayerChoose);

			var li = document.createElement('li');
			li.dataset.path = playerPath;
			li.innerText = formatName(playerPath);
			li.prepend(span);

			dom('#localPlayersFound ul').appendChild(li);
		});

		show('#localPlayersFound');
	});

	listen('#disabledHostList .close', 'click', onHostChipClose);
	listen('#enabledStreamList .close', 'click', onStreamChipClose);


	listen('#forcedLang', 'change', async () => {
		if(dom('#forcedLang').value == 'default') {
			env.options.forcedLang = false;
		} else {
			env.options.forcedLang = dom('#forcedLang').value;
		}

		await settings({'forcedLang': env.options.forcedLang});

		var response = await browser.runtime.sendMessage({command: 'env', keys: ['langStore'], from: 'popup'});

		env.langStore  = response.langStore;

		syncLang();
	});


	listen('.exitPolicy', 'click', () => {
		hide('.privacy');
	});

	listen('#openPrivacy', 'click', () => {
		hide('.privacySubTitleRemote');
		hide('.privacySubTitleLocal');
		show('.privacy');
		dom('.exitPolicy', (node) => { node.scrollIntoView(); });
	});

	listen('#openPrivacyLocal', 'click', () => {
		hide('.privacySubTitleRemote');
		show('.privacySubTitleLocal');
		show('.privacy');
	});

	console.log('privacyOptIns', env.options.privacyOptIns);
	if(env.options.privacyOptIns.reviewed === false) {
		document.getElementById('remoteUse-state-null').checked = true;
		document.getElementById('localUse-state-null').checked = true;
	} else {
		const submitBtn = document.querySelector('.privacySubmit');
		submitBtn.classList.remove('grayBtn');
		submitBtn.classList.add('greenBtn');

		if(env.options.privacyOptIns.remote) {
			console.log('Setting remote ON');
			document.getElementById('remoteUse-state-on').checked = true;
		} else {
			console.log('Setting remote OFF');
			document.getElementById('remoteUse-state-off').checked = true;
			dom('#displayIcons').parentNode.classList.add('disabled');
			dom('#findPageLinks').parentNode.classList.add('disabled');
			dom('#findPageWhitelisted').parentNode.classList.add('disabled');
		}

		if(env.options.privacyOptIns.local) {
			console.log('Setting local ON');
			document.getElementById('localUse-state-on').checked = true;
		} else {
			console.log('Setting local OFF');
			document.getElementById('localUse-state-off').checked = true;
			show('#localStreamPrivacy');
			hide('#localStreamContent');
		}
	}

	listen('.privacyRemote .tristate-switcher', 'click', (e) => {
		e.preventDefault();
		e.stopPropagation();

		const checkedNodes = document.querySelectorAll('.privacyRemote .tristate-switcher input');
		var currentNode;
		checkedNodes.forEach((node) => {
			if(node.checked) {
				currentNode = node;
			}
		})

		console.log('privacyRemote click', currentNode.value);

		if(currentNode.value == 0 || currentNode.value == -1) {
			currentNode.checked = false;
			document.getElementById('remoteUse-state-on').checked = true;

			// Enable all related features
			env.options.privacyOptIns.remote = true;
			settings({'displayIcons': true, 'findPageLinks': true});
			env.options.displayIcons = env.options.findPageLinks = true;

			dom('#displayIcons').checked = true;
			dom('#findPageLinks').checked = true;

			dom('#displayIcons').parentNode.classList.remove('disabled');
			dom('#findPageLinks').parentNode.classList.remove('disabled');
			dom('#findPageWhitelisted').parentNode.classList.remove('disabled');
		} else {
			document.getElementById('remoteUse-state-off').checked = true;
			document.getElementById('remoteUse-state-on').checked = false;

			dom('#displayIcons').checked = false;
			dom('#findPageLinks').checked = false;
			dom('#findPageWhitelisted').checked = false;
			dom('#displayIcons').parentNode.classList.add('disabled');
			dom('#findPageLinks').parentNode.classList.add('disabled');
			dom('#findPageWhitelisted').parentNode.classList.add('disabled');

			// Disable all related features
			env.options.privacyOptIns.remote = false;
			settings({'displayIcons': false, 'findPageLinks': false, 'findPageWhitelisted': false});
			env.options.displayIcons = env.options.findPageLinks = env.options.findPageWhitelisted = false;
		}

		const checkedNodesLocal = document.querySelectorAll('.privacyLocal .tristate-switcher input');
		var currentNodeLocal;
		checkedNodesLocal.forEach((node) => {
			if(node.checked) {
				currentNodeLocal = node;
			}
		})

		if(currentNodeLocal.value != 0) {
			const submitBtn = document.querySelector('.privacySubmit');
			submitBtn.classList.remove('grayBtn');
			submitBtn.classList.add('greenBtn');
			env.options.privacyOptIns.reviewed = true;
		}

		settings({'privacyOptIns': env.options.privacyOptIns});

		return false;
	});

	listen('.privacyLocal .tristate-switcher', 'click', (e) => {
		e.preventDefault();
		e.stopPropagation();

		const checkedNodes = document.querySelectorAll('.privacyLocal .tristate-switcher input');
		var currentNode;
		checkedNodes.forEach((node) => {
			if(node.checked) {
				currentNode = node;
			}
		})

		console.log('privacyLocal click', currentNode.value);

		if(currentNode.value == 0 || currentNode.value == -1) {
			currentNode.checked = false;
			document.getElementById('localUse-state-on').checked = true;
			env.options.privacyOptIns.local = true;
			hide('#localStreamPrivacy');
			show('#localStreamContent');
		} else {
			document.getElementById('localUse-state-off').checked = true;
			document.getElementById('localUse-state-on').checked = false;
			env.options.privacyOptIns.local = false;
			show('#localStreamPrivacy');
			hide('#localStreamContent');
		}

		const checkedNodesRemote = document.querySelectorAll('.privacyRemote .tristate-switcher input');
		var currentNodeRemote;
		checkedNodesRemote.forEach((node) => {
			if(node.checked) {
				currentNodeRemote = node;
			}
		})

		if(currentNodeRemote.value != 0) {
			const submitBtn = document.querySelector('.privacySubmit');
			submitBtn.classList.remove('grayBtn');
			submitBtn.classList.add('greenBtn');
			env.options.privacyOptIns.reviewed = true;
		}

		settings({'privacyOptIns': env.options.privacyOptIns});

		return false;
	});

	listen('.privacySubmit', 'click', () => {
		hide('.privacy');
	});

	listen('.privacySeeData', 'click', () => {
		hide('.privacySeeData');
		show('.privacyHideData');
		show('.privacyRawData');
	});

	listen('.privacyHideData', 'click', () => {
		hide('.privacyHideData');
		hide('.privacyRawData');
		show('.privacySeeData');
	});

	if(env.config.apiLogs.length > 0) {
		var lines = logs = linksLogs = magnetsLogs = sysLogs = 0;
		var privacyRawData = '';
		env.config.apiLogs.reverse().forEach((log) => {
			logs++;

			if(log.type == 'links')
				linksLogs++;
			else if(log.type == 'magnets')
				magnetsLogs++;
			else if(log.type == 'system')
				sysLogs++;

			if(objLen(log.payload) == 0) {
				privacyRawData += (new Date(log.date * 1000)).toISOString().split('.')[0]+"Z" + ' > ' + env.config.apiUrl + log.endpoint + "\n";
			} else {
				privacyRawData += (new Date(log.date * 1000)).toISOString().split('.')[0]+"Z" + ' > ' + env.config.apiUrl + log.endpoint + ", data : \n";
				objForEach(log.payload, (value, key) => {
					privacyRawData += ' - ' + key + ' : ' + value + "\n";
					lines++;
				});
			}
			lines++;
			//var textNode = document.createTextNode(text);
			
		});
		dom('.privacyRawData').value += privacyRawData;
		dom('.privacyRawData').style.height = (15 * lines + 15) + 'px';

		dom('.logsCount').innerText = logs;
		dom('.linksLogs').innerText = linksLogs;
		dom('.magnetsLogs').innerText = magnetsLogs;
		dom('.systemLogs').innerText = sysLogs;
	}


	

	var localStreamVersion = await native.getVersion();

	if(localStreamVersion === false) {
		show('#localStreamDown');
	} else {
		dom('#localScriptVersion').innerText = localStreamVersion.version;
		dom('#nodeVersion').innerText = localStreamVersion.nodeVersion.substring(1);

		if(env.options.localPlayerPath.length > 0) {
			dom('#customPlayerName').innerText = env.options.localPlayer;
			dom('#customPlayerPath').innerText = env.options.localPlayerPath;
			show('#localPlayerSet');
		} else {
			show('#localPlayerNotSet');
		}

		show('#localStreamUp, #localPlayerSelection');
	}


	browser.runtime.onMessage.addListener((request, sender) => {
		if(request.command == 'syncPageLinks') {
			env.config.tabFiles[env.config.currentTab] = request.files;
			env.config.tabFilesProcessing[env.config.currentTab] = request.processing;
			renderPageFiles(env.config.tabFiles[env.config.currentTab]);
		}
	});

})();

var renderPageFiles = async (files) => {
	if(typeof files != 'object')
		return;

	dom('#pageLinksScan span.greenBtn').innerText = 'Re-scan page';
	hide('#pageLinksNotFound');
	
	hide('#pageLinksOpenBtn');
	if(objLen(files) > 1) {
		show('#pageLinksOpenBtn', true);
	}

	if(env.config.tabFilesProcessing[env.config.currentTab] == false) {
		hide('#fileListLoading');
		show('#fileListTitle');
		dom('#fileListNbFiles').innerText = objLen(files);
	} else {
		if(objLen(files) > 0) {
			show('#fileListTitle');
			dom('#fileListNbFiles').innerText = objLen(files);
		}	
	}

	var fileList = dom('#pageLinksList #fileList');

	while (fileList.firstChild) {
	    fileList.removeChild(fileList.firstChild);
	}

	var orderedFiles = {};
	Object.keys(files).sort().forEach(function(key) {
	  orderedFiles[key] = files[key];
	});

	objForEach(orderedFiles, async (infos, filename) => {
		if(filename == 'undefined') {
			return;
		}
		console.log(infos, filename)
		var div = document.createElement('div');
		div.classList.add("file");

		var divInfos = document.createElement('div');
		divInfos.classList.add("fileInfos");
		divInfos.innerText = filename;

		var spanSize = document.createElement('span');
		spanSize.classList.add("fileSize");
		spanSize.innerText = ' (' + humanFileSize(infos.size) + ')';

		divInfos.append(spanSize);
		
		if(exists(infos.nbParts) && infos.nbParts > 1) {
			var spanParts = document.createElement('span');
			spanParts.classList.add("fileParts");
			spanParts.innerText = ' (in ' + infos.nbParts + ' parts)';
			divInfos.append(spanParts);
		}

		div.append(divInfos);

		if( !(exists(infos.nbParts) && infos.nbParts > 1) ) {
			var divDl = document.createElement('div');
			divDl.classList.add("fileDl");
			var dlIcon = createIcon('download', '#6fb025');

			dlIcon.addEventListener('click', async (event) => {

				event.target.classList.remove('fa-download');
				event.target.classList.add('fa-spinner', 'fa-spin');

				var [error, result] = await to(browser.runtime.sendMessage({command: 'download', url: infos.links[0].link , from: 'popup'}));

				if(result.status == 'success') {
					setTimeout(() => {
						event.target.classList.add('fa-download');
						event.target.classList.remove('fa-spinner', 'fa-spin');
					}, 1000);
				} else {

					var errorNode = event.target.parentNode.nextSibling.nextSibling;

					errorNode.innerHTML = ''; 
					
					var errorIcon = createIcon('exclamation-triangle', '#d83e3e');
					var errorSpan = document.createElement('span');
					errorSpan.innerText = ' ' + result.error.message;

					errorNode.append(errorIcon);
					errorNode.append(errorSpan);

					errorNode.style.display = 'block';

					setTimeout(() => {
						errorNode.style.display = 'none';
						event.target.classList.add('fa-download');
						event.target.classList.remove('fa-spinner', 'fa-spin');
					}, 5000);
				}
			});

			divDl.append(dlIcon);
			div.append(divDl);

			var divSave = document.createElement('div');
			divSave.classList.add("fileSave");
			var saveIcon = createIcon('save', '#6fb025');

			saveIcon.addEventListener('click', async (event) => {

				event.target.classList.remove('fa-save');
				event.target.classList.add('fa-spinner', 'fa-spin');

				var [error, result] = await to(browser.runtime.sendMessage({command: 'save', url: infos.links[0].link , from: 'popup'}));

				if(result.status == 'success') {
					event.target.classList.add('fa-check');
					event.target.classList.remove('fa-spinner', 'fa-spin');
					setTimeout(() => {
						event.target.classList.add('fa-save');
						event.target.classList.remove('fa-check');
					}, 2000);
				} else {

					var errorNode = event.target.parentNode.nextSibling.nextSibling;

					errorNode.innerHTML = ''; 
					
					var errorIcon = createIcon('exclamation-triangle', '#d83e3e');
					var errorSpan = document.createElement('span');
					errorSpan.innerText = ' ' + result.error.message;

					errorNode.append(errorIcon);
					errorNode.append(errorSpan);

					errorNode.style.display = 'block';

					setTimeout(() => {
						errorNode.style.display = 'none';
						event.target.classList.add('fa-save');
						event.target.classList.remove('fa-spinner', 'fa-spin');
					}, 5000);
				}
			});

			divSave.append(saveIcon);
			div.append(divSave);
		}
		

		var divOpen = document.createElement('div');
		divOpen.classList.add("fileOpen");
		var openIcon = createIcon('external-link', '#6fb025');

		openIcon.addEventListener('click', (event) => {
			browser.runtime.sendMessage({command: 'sendPageLink', infos: infos, from: 'popup'});
		});

		divOpen.append(openIcon);
		div.append(divOpen);

		var divError = document.createElement('div');
		divError.classList.add("fileError");

		div.append(divError);

		fileList.appendChild(div);	
	});

	show('#pageLinksList');
}

// Some helpers so we don't kill ourself just yet
var dom = (selector, transformation) => {

	var elements = document.querySelectorAll(selector);

	if(transformation == null) {
		if(elements.length == 1)
			return elements[0];

		return elements;
	}


	if(elements == null)
		return;

	elements.forEach(transformation);
}

var show = (selector, inline) => {dom(selector, (el) => { 
	if(inline)
		el.style.display = 'inline';
	else
		el.style.display = 'block';
});}
var hide = (selector) => {dom(selector, (el) => { el.style.display = 'none'; });}
var opacity = (selector, opacity) => {dom(selector, (el) => { el.style.opacity = opacity; });}

var listen = (selector, type, callback) => {dom(selector, (el) => { el.addEventListener(type, callback); });}

var createChip = (type, text) => {
	var chip = document.createElement('div');
	chip.classList.add("chip");
	chip.appendChild(document.createTextNode(text));

	var closeBtn = document.createElement('i');
	closeBtn.classList.add("close");
	closeBtn.classList.add("far");
	closeBtn.classList.add("fa-times-octagon");
	
	if(type == 'host')
		closeBtn.addEventListener('click', onHostChipClose);
	else
		closeBtn.addEventListener('click', onStreamChipClose);
	chip.appendChild(closeBtn);

	return chip;
}


var formatName = (path) => {
	var playerName = capitalizeFirstLetter(path.split(/[\\/]/).pop());

	if(env.config.client.os == 'win') {
		playerName = playerName.split('.')[0];
	}
	if(env.config.client.os == 'mac') {
		playerName = playerName.split('.')[0].toLowerCase();
	}


	if(playerName.toLowerCase() == 'vlc')
		playerName = 'VLC';

	if(playerName.toLowerCase() == 'mpc-hc')
		playerName = 'Media Player Classic HC';

	if(playerName.toLowerCase() == 'potplayermini64')
		playerName = 'Pot Player';

	

	return playerName;
}

var createIcon = (name, color) => {

	var icon = document.createElement('i');
	icon.classList.add("fas");
	icon.classList.add("fa-" + name);
	icon.style.marginRight = '4px';

	if(color != null)
		icon.style.color = color;

	return icon;
}

var onHostChipClose = (event) => {
	var chip = event.target.parentElement;
	var host = chip.innerText;

	browser.runtime.sendMessage({command: 'settings', updates: {'disabledHostsList': {'delete' : host}}, from: 'popup'});
	env.options.disabledHostsList.splice(env.options.disabledHostsList.indexOf(host), 1);

	chip.remove();
	dom('#hosts option[value="' + host + '"]').hidden = false;
};

var onStreamChipClose = (event) => {
	var chip = event.target.parentElement;
	var stream = chip.innerText;

	browser.runtime.sendMessage({command: 'settings', updates: {'enabledStreamList': {'delete' : stream}}, from: 'popup'});
	env.options.enabledStreamList.splice(env.options.enabledStreamList.indexOf(stream), 1);

	chip.remove();
};

var onCustomSourceDelete = (event) => {
	var li = event.target.parentElement;
	var customSource = li.innerText;

	browser.runtime.sendMessage({command: 'settings', updates: {'customSources': {'delete' : customSource}}, from: 'popup'});
	env.options.customSources.splice(env.options.customSources.indexOf(customSource), 1);

	li.remove();
};

var onLocalPlayerChoose = (event) => {
	var li = event.target.parentElement.parentElement;
	var path = li.dataset.path;

	var playerName = formatName(path);

	dom('#customPlayerName').innerText = playerName;
	dom('#customPlayerPath').innerText = path;

	hide('#localPlayerNotSet');
	show('#localPlayerSet');

	settings({'localPlayer': playerName, 'localPlayerPath': path});
	
	env.options.localPlayer = playerName;
	env.options.localPlayerPath = path;

	hide('#localPlayersFound');
};

var settings = async (updates) => {
	await browser.runtime.sendMessage({command: 'settings', updates, from: 'popup'});
}

var syncLang = () => {
	var objects = document.getElementsByTagName('*'), i;
	
	for(i = 0; i < objects.length; i++) {
		if (objects[i].dataset && objects[i].dataset.lang) {
			objects[i].innerText = lang(objects[i].dataset.lang);
		}
	}

	if(env.user.isPremium == false) {
		document.getElementById('notPremium').style.display = 'block';
	   var elem = document.getElementById('premiumUntil');
	   elem.textContent = lang('premium_expired');
	   var a = document.createElement('a');
	   elem.appendChild(a);
	   a.target = '_blank';
	   a.textContent = ' ' + lang('premium_renew') + ' ?';
	   a.href = "https://alldebrid." + env.config.domain + "/offer/";
	   show('.disabledFeatures');
   } else {
	   var remainingPremiumDays = Math.round((env.user.premiumUntil - Math.floor(Date.now() / 1000) ) / 60 / 60 / 24);
	   dom('#premiumUntil').innerText = lang('premium_expire_in') + ' ' + remainingPremiumDays + ' ' + lang('days');
   }

}

var synclogHistory = () => {

	var logNode = document.getElementById('logHistory');

	var content = "";

	env.logHistory.forEach((log) => {
		content = content.concat(log.join(" ") + "<br />");
	});
	
	logNode.innerHTML = content;
}