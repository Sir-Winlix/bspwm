var env = {
	'user': {},
	'options': {},
	'config': {},
	'langStore': {}
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

	syncLang();

	//var [error, isLoggued] = await browser.runtime.sendMessage({command: 'isLoggued', from: 'popup'});

	if(env.options.privacyOptIns.reviewed === false) {
		document.getElementById('remoteUse-state-null').checked = true;
		document.getElementById('localUse-state-null').checked = true;
	} else {
		const submitBtn = document.querySelector('.privacySubmit');
		submitBtn.classList.remove('grayBtn');
		submitBtn.classList.add('greenBtn');

		document.querySelector('.privacySubmitWarn').remove();

		if(env.options.privacyOptIns.remote) {
			document.getElementById('remoteUse-state-on').checked = true;
		} else {
			document.getElementById('remoteUse-state-off').checked = true;
		}

		if(env.options.privacyOptIns.local) {
			document.getElementById('localUse-state-on').checked = true;
		} else {
			document.getElementById('localUse-state-off').checked = true;
		}
	}

	listen('.privacyDisableAll', 'click', () => {

		privacyDisable('Remote');
		privacyDisable('Local');

		env.options.privacyOptIns.reviewed = true;
		env.options.privacyOptIns.remote = false;
		env.options.privacyOptIns.local = false;

		settings({'privacyOptIns': env.options.privacyOptIns});

		// Disable all related features
		settings({'displayIcons': false, 'findPageLinks': false, 'findPageWhitelisted': false});
		env.options.displayIcons = env.options.findPageLinks = env.options.findPageWhitelisted = false;

		dom('#displayIcons').checked = false;
		dom('#findPageLinks').checked = false;
		dom('#findPageWhitelisted').checked = false;

		window.close();
	});

	listen('.privacyEnableAll', 'click', () => {
		privacyEnable('Remote');
		privacyEnable('Local');

		env.options.privacyOptIns.reviewed = true;
		env.options.privacyOptIns.remote = true;
		env.options.privacyOptIns.local = true;

		settings({'privacyOptIns': env.options.privacyOptIns});

		// Enable all related features
		settings({'displayIcons': true, 'findPageLinks': true});
		env.options.displayIcons = env.options.findPageLinks = false;

		dom('#displayIcons').checked = true;
		dom('#findPageLinks').checked = true;

		hide('.privacy');

		window.close();
	});


	listen('.privacyDisableRemote', 'click', () => {
		privacyDisable('Remote');
		env.options.privacyOptIns.remote = false;
		env.options.privacyOptIns.reviewed = true;
		settings({'privacyOptIns': env.options.privacyOptIns});

		// Disable all related features
		settings({'displayIcons': false, 'findPageLinks': false, 'findPageWhitelisted': false});
		env.options.displayIcons = env.options.findPageLinks = env.options.findPageWhitelisted = false;

		dom('#displayIcons').checked = false;
		dom('#findPageLinks').checked = false;
		dom('#findPageWhitelisted').checked = false;
	});

	listen('.privacyEnableRemote', 'click', () => {
		privacyEnable('Remote');
		env.options.privacyOptIns.remote = true;
		env.options.privacyOptIns.reviewed = true;
		settings({'privacyOptIns': env.options.privacyOptIns});

		// Enable all related features
		settings({'displayIcons': true, 'findPageLinks': true});
		env.options.displayIcons = env.options.findPageLinks = false;

		dom('#displayIcons').checked = true;
		dom('#findPageLinks').checked = true;
	});


	listen('.privacySubmit', 'click', () => {
		window.close();
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

		env.options.privacyOptIns.remote = false;
		env.options.privacyOptIns.reviewed = true;
		settings({'privacyOptIns': env.options.privacyOptIns});

		// Disable all related features
		settings({'displayIcons': false, 'findPageLinks': false, 'findPageWhitelisted': false});
		env.options.displayIcons = env.options.findPageLinks = env.options.findPageWhitelisted = false;

		dom('#displayIcons').checked = false;
		dom('#findPageLinks').checked = false;
		dom('#findPageWhitelisted').checked = false;

		if(currentNode.value == 0 || currentNode.value == -1) {
			currentNode.checked = false;
			document.getElementById('remoteUse-state-on').checked = true;

			// Enable all related features
			env.options.privacyOptIns.remote = true;
			settings({'displayIcons': true, 'findPageLinks': true});
			env.options.displayIcons = env.options.findPageLinks = true;
		} else {
			document.getElementById('remoteUse-state-off').checked = true;
			document.getElementById('remoteUse-state-on').checked = false;

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
			if(document.querySelector('.privacySubmitWarn')) {
				document.querySelector('.privacySubmitWarn').remove();
			}
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

		if(currentNode.value == 0 || currentNode.value == -1) {
			currentNode.checked = false;
			document.getElementById('localUse-state-on').checked = true;
			env.options.privacyOptIns.local = true;
		} else {
			document.getElementById('localUse-state-off').checked = true;
			document.getElementById('localUse-state-on').checked = false;
			env.options.privacyOptIns.local = false;
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
			if(document.querySelector('.privacySubmitWarn')) {
				document.querySelector('.privacySubmitWarn').remove();
			}
			
			env.options.privacyOptIns.reviewed = true;
		}

		settings({'privacyOptIns': env.options.privacyOptIns});

		return false;
	});

	listen('#langFr', 'click', async (e) => {
		await settings({'forcedLang': 'fr'});
		var response = await browser.runtime.sendMessage({command: 'env', keys: ['langStore'], from: 'popup'});
		env.langStore  = response.langStore;
		syncLang();
	})

	listen('#langEn', 'click', async (e) => {
		await settings({'forcedLang': 'en'});
		var response = await browser.runtime.sendMessage({command: 'env', keys: ['langStore'], from: 'popup'});
		env.langStore  = response.langStore;
		syncLang();
	})

	
	
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
})();

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
}