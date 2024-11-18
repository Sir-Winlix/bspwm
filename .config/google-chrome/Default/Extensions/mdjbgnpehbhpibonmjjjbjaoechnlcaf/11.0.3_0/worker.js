importScripts('libs/browser-polyfill.min.js');
importScripts('libs/loglevel.js');
importScripts('libs/xregexp.js');

importScripts('utils.js');
importScripts('helpers.js');
importScripts('listeners.js');

importScripts('_locales/base.lang.js');

// Main env variable, accessible everywhere
var env = {
	'type': 'worker',
	'user': {},
	'options': {},
	'config': {
		init: false,
		boot: false,
		debug: true,
		isLoggued: false,
		lastCheck: 0,
		apiUrl: 'https://api.alldebrid.com/',
		apiLogs: [],
		apiSlowUrl: 'https://apislow.alldebrid.com/',
		alldDomains: ['alldebrid.com', 'alldebrid.fr', 'alldebrid.org', 'alldebrid.de', 'alldebrid.it', 'alldebrid.es'],
		domain: 'com',
		isLoggued: false,
		client: false,
		hosts: {},
		rivers: {
			list: false,
			session: getRandomInt(1, 100000),
			counter: 0,
			hasRunning: false,
			running: {},
			liveNotif: [],
			closedNotif: [],
			links: {},
			isLearning: false,
			learnLinks: [],
			lastUpdate: timestamp() - 3600
		},
		imgs: {
			'logo': browser.runtime.getURL('/img/logo.png'),
			'blackbarBlock': browser.runtime.getURL('/img/block_head.png'),
			'alldLogo': browser.runtime.getURL('/img/logo_alldebrid.png'),
			'icon': browser.runtime.getURL('/img/icon.png')
		},
		hiddenID: '', // for hardRedirection hosts
		lastSource: '',
		disabledSourceID: '',
		contextUnlock: false,
		contextMagnet: false,
		currentSelection: false,
		currentTab: false,
		tabLinks: {},
		tabFiles: {},
		tabFilesProcessing: {},
		dlLinksTab: false,
		dlLinks: [],
	},
	langStore: {}
};

setDebug(false);

log.info('[CORE] Setting listener');
setupContentScripts();

chrome.notifications.onClicked.addListener( (notificationId) => {
	log.info('Notification click', notificationId);
	if(notificationId.indexOf('river-') === 0) {
		riverID = parseInt(notificationId.substring(6));
		log.info('[RIVERS] Real ID', notificationId, riverID, env.config.rivers);

		if(!exists(env.config.rivers.links[riverID])) { // env.config.client.features.liveNotif == true || // Browser has rich notification, so has button, no need to trigguer on main notification
			chrome.tabs.create({ url: 'https://alldebrid.' + env.config.domain + '/magnets/'});
		} else {
			// Browser has no rich notification. Click on magnet completion notification => send user to Alldebrid with related magnet files

			var links = env.config.rivers.links[riverID];

			log.info('[RIVERS] Mutliple links', links);

			sendToAlld(links.map((file) => file.l).join("\n"));

			delete env.config.rivers.links[riverID];
		}
	}

	if(notificationId.indexOf('alldNotLoggued') === 0) {
		// USer clocked on not-loggued notification, open Alldebrid login page
		chrome.tabs.create({ url: 'https://alldebrid.com/register/'});
	}

	if(notificationId.indexOf('alldPrivacyNotReviewed') === 0) {
		// USer clocked on not-loggued notification, open Alldebrid login page
		chrome.tabs.create({url: chrome.runtime.getURL('popup/privacy.html')});
	}
});


// Advanced notification button where available
chrome.notifications.onButtonClicked.addListener( (notificationId, buttonIndex) => {
	log.info('Notification button click', notificationId);
	if(notificationId.indexOf('river-') === 0) {
		riverID = parseInt(notificationId.substring(6));
		log.info('[RIVERS] Real ID', notificationId, riverID, env.config.rivers);
		// React to 'open link' buttons
		if(exists(env.config.rivers.links[riverID])) {
			var links = env.config.rivers.links[riverID];

			log.info('[RIVERS] Mutliple links', links);

			sendToAlld(links.map((file) => file.l).join("\n"));

			delete env.config.rivers.links[riverID];
		}
	}
	else if(notificationId == 'premiumRemainder') {
		// User clicked on renew 
		chrome.tabs.create({ url: 'https://alldebrid.' + env.config.domain + '/offer/'});
		chrome.notifications.clear('premiumRemainder');
	}
});

chrome.notifications.onClosed.addListener( (notificationId, byUser) => {
	if(byUser == true && notificationId.indexOf('river-') === 0) {
		// Tracked closed live notif to prevent re-diplaying it to the user
		notificationId = parseInt(notificationId.substring(6));

		env.config.rivers.liveNotif.splice(env.config.rivers.liveNotif.indexOf(notificationId), 1);
		env.config.rivers.closedNotif.push(notificationId);
	}
});

// Ok let's go : INIT
(async function() {

	var localDataVersion = await storage.get('localDataVersion');

	// Init extension, aka get lang data, user and user prefs from local storage
	env.langStore = await storage.get('langStore');

	if(typeof env.langStore != 'object')
		await refreshLangStore(true);

	// Try getting user data & options from local storage
	env.user = (await storage.get('user')) || {};
	env.options = (await storage.get('options')) || { 
		disabledHosts: false,
		disabledHostsList: [],
		enabledStream: false,
		enabledStreamList: [],
		displayIcons: false,
		changeLink: false,
		blackBar: true,
		blackBarStream: true,
		autoPopup: true,
		findPageLinks: false,
		findPageWhitelisted: false,
		findPageWhitelist: [],
		riverLiveNotif: false,
		riverCompletionNotif: true,
		riverCustomSource: false,
		customSources: [],
		localPlayer: '',
		localPlayerPath: '',
		forcedLang: false
	};

	// Added in v.10.2.0
	if(!exists(env.options.findPageLinks))
		env.options.findPageLinks = true;

	// Added in v.10.4.0
	if(!exists(env.options.displayIcons)) {
		env.options.displayIcons = true;
		env.options.findPageWhitelisted = false;
		env.options.findPageWhitelist = [];
		env.options.blackBarStream = true;
	}

	if(!exists(env.options.privacyOptIns)) {
		env.options.privacyOptIns = {
			remote: false,
			local: false,
			reviewed: false
		};
	}

	

	// Added in 10.6.0
	if(!exists(env.options.forcedLang))
		env.options.forcedLang = false;


	const currentConfig = await storage.get('config');

	if(currentConfig) {
		currentConfig.init = false;
		currentConfig.boot = false;

		currentConfig.debug = env.config.debug;

		currentConfig.apiUrl = 'https://api.alldebrid.com/';
		currentConfig.apiSlowUrl = 'https://apislow.alldebrid.com/';

		currentConfig.rivers.liveNotif = [];

		env.config.client
		
		currentConfig.client = await getClientInfos();

		env.config = currentConfig;
		log.info('[CORE] Loaded saved config, current login status : ' + (env.config.isLoggued ? 'loggued' : 'not loggued'));
	} else {
		env.config.client = await getClientInfos();
	}

	const [tab] = await chrome.tabs.query( { active: true, lastFocusedWindow: true });

	if(tab) {
		env.config.currentTab = tab.id;
	}

	// Setup cs listener even if not loggued, need communication script
	
	setupContentScripts();
	log.info('Setting up notification click listener');

	// Setup notification callbacks right away, to handle not-loggued-in notification
	

	// Check if user is loggued
	

	if(env.config.lastCheck < timestamp() - 3600 || !env.config.isLoggued) {
		log.info('[CORE] Waiting for user status');
		await api.login(true);
		env.config.lastCheck = timestamp();
	} else {
		api.login(true);
	}

	env.config.init = true;

	if(!env.config.isLoggued) {
		console.log(env.config)
		console.log(env.config.isLoggued)
		log.warn('[USER] Not loggued');
		notification(lang("notif_not_loggued"), lang("notif_not_loggued_desc"), 'alldNotLoggued');
		return;
	}

	storage.set({config: env.config});

	if(env.options.privacyOptIns.reviewed === false) {
		log.warn('[USER] Privacy policy not accepted, not bootstrapping');
		return;
	}

	// Bootstrap extension once loggued
	log.info('[CORE] Service worker bootstrap');
	await bootstrap();
})();

async function bootstrap () {
	log.info('[USER] Loggued as', env.user);

	// Remainder
	if(env.user.isPremium && !env.user.isSubscribed && env.user.premiumUntil < (timestamp() + 60 * 60 * 24 * 3) ) {
		var lastRemainder = await storage.get('lastPremiumRemainder');

		if(lastRemainder == undefined || (new Date).getDate() != lastRemainder) {

			storage.set({'lastPremiumRemainder': (new Date).getDate()});

			var notifOpts = {
				type: "basic",
				iconUrl: env.config.imgs.logo,
				title: lang("notif_premium_remainder"),
				message: lang("notif_premium_remainder_desc"),
				isClickable: false,
				buttons: [{title: lang("notif_premium_remainder_btn")}],
				requireInteraction: true
			};

			browser.notifications.create(
				"premiumRemainder", 
				notifOpts
			).then((notifId) => { setTimeout(() => {browser.notifications.clear(notifId);}, 15000); }); // , function(notID) {}
		}
	}

	if(!env.user.isPremium)
		log.warn('[CORE] User not premium, only usable features activated');


	if(!env.config.hosts.lastUpdate || env.config.hosts.lastUpdate < timestamp() - 3600) {
		// Get host data from api
		var response = await api.fetch('user/hosts');

		if(response.error) {
			//notification(lang("error"), lang("notif_generic_error_desc"));
			return;
		}

		// Ok we have hosts data, let's setup everything
		setupRegexps(response.data, true);
	}

	//setupContentScripts();
	setupContextMenu(true);

	if(env.user.isPremium) { // Even the funky stuff
		setupInterception();
	}

	if(env.user.lang != env.langStore.lang) {
		log.info('[CORE] Refreshing lang');
		refreshLangStore(false);
	}

	env.config.rivers.lastUpdate = 0;
	env.config.boot = true;

	// Start cron job, responsible for periodically updating supported host, lang data and stuff
	cronRegexp();
	cronRiver();

	log.info('[CORE] Bootstrapping OK');
}

function unbootstrap() {
	// Unregister the various handler we have setup
	browser.contextMenus.removeAll();

	if(browser.webNavigation.onBeforeNavigate.hasListener(redirectionListener)) {
		browser.webNavigation.onBeforeNavigate.removeListener(redirectionListener);
	}

	if(browser.webRequest.onBeforeRedirect.hasListener(getHiddenId)) {
		browser.webRequest.onBeforeRedirect.removeListener(getHiddenId);
	}

	env.config.hosts = {};
	env.config.boot = false;
	log.info('[CORE] Unootstrapping OK');
}

async function cronRegexp() {
	// Periodically check regexp and lang data
	
	// Stop cron if unbootstrapped

	log.info('[CRON] Executing regexp cron');

	// Prevent concurrent cron
	if(await chrome.alarms.get('regexp')) {
		await chrome.alarms.clear('regexp');
	}

	if(env.config.boot == false)
		return;

	var currentTime = timestamp();

	if(!env.config.hosts.folderList || currentTime > env.config.hosts.lastFullUpdate + (23 * 60 * 60)) {
		await refreshRegexps(true);
		await refreshLangStore(false);
	} else {
		await refreshRegexps();
	}

	if(env.config.apiLogs.length > 0) {
		//console.log('Before cleanup, ', env.config.apiLogs.length, 'logs', env.config.apiLogs);
		env.config.apiLogs = env.config.apiLogs.filter( (log) => {
			return (Math.round(+new Date() / 1000) - log.date) <  120;
		});
		//console.log('After cleanup, ', env.config.apiLogs.length, 'logs', env.config.apiLogs);
	}
	
	log.info('[CRON] Setting regexp alarm in 15 min');

	browser.alarms.create('regexp', {
		delayInMinutes: 15,
	});
}

var cronRiverTimer = false;

async function cronRiver(force = false) {
	// Periodically check stuff

	log.info('[CRON] Executing river cron');

	// Prevent concurrent cron
	if(cronRiverTimer) {
		clearTimeout(cronRiverTimer);
		cronRiverTimer = false;
	}

	if(await chrome.alarms.get('river')) {
		await chrome.alarms.clear('river');
	}

	if(!env.options.riverCompletionNotif && !env.options.riverLiveNotif) // User doesn't want any notif
		return;

	// Stop cron if unbootstrapped
	if(env.config.boot == false)
		return;

	var currentTime = timestamp();

	if(env.user.isPremium) {

		var riversCheckDelay = 110; // Every 2 min
		var nextCheckIn = 120;

		if(env.config.rivers.hasRunning) { // User have river running, check more often
			riversCheckDelay = 19;
		}

		if(env.options.riverLiveNotif == true && env.config.rivers.liveNotif.length > 0) {
			riversCheckDelay = 1; // Live notif in progress, every 2 seconds
		}

		if(force || currentTime > env.config.rivers.lastUpdate + riversCheckDelay) {
			await checkRivers();
		}

		if(env.config.rivers.hasRunning) { // User have river running, check more often
			nextCheckIn = 20;
		}

		if(env.options.riverLiveNotif == true && env.config.rivers.liveNotif.length > 0) {
			nextCheckIn = 2; // Trigger cron more often
		}
	}
	
	// We used await, so async tasks are blocking, no risk to DOS us if something go to shit (and it will !)
	

	if(nextCheckIn < 25) {
		log.info('[CRON] Setting river timeout to ' + nextCheckIn);
		cronRiverTimer = setTimeout(cronRiver, nextCheckIn * 1000);
	} else {
		log.info('[CRON] Setting river alarm in ' + Math.max(1, Math.floor(nextCheckIn / 60)) + ' min');
		browser.alarms.create('river', {
			delayInMinutes: Math.max(1, Math.floor(nextCheckIn / 60)),
		});
	}
}

browser.alarms.onAlarm.addListener((alarm) => {
	if(alarm.name == "regexp") {
		log.info('[CRON] Got regexp alarm');
		
		if(env.config.boot)
			cronRegexp();
	} 
	if(alarm.name == "river") {
		log.info('[CRON] Got river alarm');
		
		if(env.config.boot)
			cronRiver();
	} 
});

async function setupRegexps(response, isFullSync) {

	// Parse regexps from API
	var hosts = response.hosts;

	env.config.hosts.hostList = [];
	env.config.hosts.hostsRegexp = {};

	env.config.hosts.hardRedirect = [];
	env.config.hosts.hardRedirectRegexps = {};
	env.config.hosts.hardRedirectPatterns = [];

	env.config.hosts.priority = {};

	for(var host in hosts) {
		env.config.hosts.hostList.push(host);
		env.config.hosts.hostsRegexp[host] = [];

		hosts[host]['regexps'].forEach( (regexp) => {
			env.config.hosts.hostsRegexp[host].push(regexp);
		});

		// Some hosts have hard redirection in place, we need patterns for them to setup the webrequest listener
		if(exists(hosts[host]['hardRedirect'])) {
			hosts[host]['domains'].forEach( (domain) => {
				env.config.hosts.hardRedirect.push(domain);
				env.config.hosts.hardRedirectRegexps[domain] = hosts[host]['hardRedirect'];
				env.config.hosts.hardRedirectPatterns.push('*://' + domain + '/*');
			});
		}
	}

	if(isFullSync) {

		var streams = response.streams;
		var redirectors = response.redirectors;

		env.config.hosts.folderList = [];
		env.config.hosts.streamList = [];

		env.config.hosts.foldersRegexp = {};
		env.config.hosts.streamRegexp = {};

		


		for(var stream in streams) {
			env.config.hosts.streamList.push(stream);
			env.config.hosts.streamRegexp[stream] = [];

			streams[stream]['regexps'].forEach( (regexp) => {
				env.config.hosts.streamRegexp[stream].push(regexp);
			});
		}

		for(var redirector in redirectors) {
			env.config.hosts.folderList.push(redirector);
			env.config.hosts.foldersRegexp[redirector] = [];

			redirectors[redirector]['regexps'].forEach( (regexp) => {
				env.config.hosts.foldersRegexp[redirector].push(regexp);
			});
		}
	}

	var response = await api.fetch('hosts/priority');

	if(response.status == 'success') {
		env.config.hosts.priority = response.data.hosts;
	}

	env.config.hosts.lastUpdate = timestamp();

	if(isFullSync) {
		env.config.hosts.lastFullUpdate = timestamp();
		log.info('[CORE] Regexp OK, got', env.config.hosts.hostList.length, 'hosts,', env.config.hosts.folderList.length , 'folders and', env.config.hosts.streamList.length, 'streams ');
	} else {
		log.info('[CORE] Regexp OK, got', env.config.hosts.hostList.length, 'hosts');
	}

	storage.set({config: env.config});
}

async function refreshRegexps(fullSync)  {

	if(fullSync) {
		var response = await api.fetch('user/hosts');
	} else {
		var response = await api.fetch('user/hosts', {hostsOnly: '1'});
	}

	if(response.error) {
		//notification(lang("notif_generic_error"), lang("notif_generic_error_desc"));
		return;
	}

	setupRegexps(response.data, fullSync);
	setupContextMenu(); // Need to reset context menus for them to register new patterns
}

async function initLangStore() {
	
	env.langStore = baseLang;

	log.info('[CORE] Lang initialized');

	return;
}

async function refreshLangStore(initStore) {
	
	var lang = env.user.lang;

	if(env.options.forcedLang !== false)
		lang = env.options.forcedLang;

	if(typeof lang == 'undefined')
		lang = 'en';

	if(initStore) {
		env.langStore = baseLang;
	}

	var response = await api.fetch('lang', {prefix: 'webext', lang});

	if(!exists(response.data) || !exists(response.data.lang) || response.data.lang.webext !== 'true') {
		log.info('[CORE] Could not get lang data');
		return;
	}

	env.langStore = response.data.lang;
	env.lang = lang;

	log.info('[CORE] Lang refreshed');

	return;
}

// Setup content scripts for black bar, popup on selection and messaging features
function setupContentScripts()  {

	// Listen to navigation event onComplete to dynamically insert content scripts if user activated related features
	// Even if not loggued, need messaging in place for the website to communicate with the extension
	if(!browser.webNavigation.onCompleted.hasListener(csListener)) {
		log.info('[CORE] CS listeners OK');
		browser.webNavigation.onCompleted.addListener(csListener);
	}

	if(!env.config.isLoggued)
		return;

	var hasRedirectionListener = browser.webNavigation.onBeforeNavigate.hasListener(redirectionListener);
	if(env.options.changeLink == true) {
		if(!hasRedirectionListener) {
			// User want redirection and listener not setup, creating it
			log.info('[CORE] Redirection listeners OK');
			browser.webNavigation.onBeforeNavigate.addListener(redirectionListener);
		}
	} else {
		if(hasRedirectionListener) {
			// User doesn't want redirection and listener is setup, removing it
			browser.webNavigation.onBeforeNavigate.removeListener(redirectionListener);
		}
	}

	browser.tabs.onActivated.addListener(onTabChange);
	browser.windows.onFocusChanged.addListener(onWindowChange);
	browser.tabs.onRemoved.addListener(onTabRemove);
	browser.tabs.onUpdated.addListener(onTabUpdate);
}

async function setupContextMenu(firstInit) {

	//Reset right-click handlers with updated domain list
	browser.contextMenus.removeAll();

	// Hidden by default
	

	if(env.config.contextUnlock !== false) {
		// Show the menu
		browser.contextMenus.create({
			"title": lang("context_unlock"), 
			"contexts": ["link"], 
			//"onclick": download, 
			"id": 'downloadLink'
		});
	}

	if(env.config.contextMagnet !== false) {
		// Show the menu
		browser.contextMenus.create({
			"title": lang("context_river"), 
			"contexts":["link"], 
			//"onclick": downloadRiver, 
			"id": 'uploadYNWForced'
		});
	}

	if(env.config.currentSelection !== false) {
		// Show the menu
		browser.contextMenus.create({
			"title": lang("context_unlock_multiple"), 
			"contexts": ["selection"],
			//"onclick": downloadSelection, 
			"id": 'downloadLinks'
		});
	}

	if(env.user.isPremium) {
		// No river support if no subscription, no need for those options
		if(env.config.rivers.isLearning == true) {
			browser.contextMenus.create({
				"title": lang("context_learn"), 
				"contexts":["link"], 
				//"onclick": learn, 
				"id": 'learnLink'
			});
		}

		var patterns = ['*://*/*.torrent', '*://*/*torrent*', "*://*/*.torrent?*", "*://*/*.torrent#*"];

		if(env.config.client.features.extendedPattern == true)
			patterns.push('magnet:*'); 

		// Add user custom sources
		if(env.options.riverCustomSource == true && env.options.customSources.length > 0)
			patterns = patterns.concat(env.options.customSources);

		log.info('[CORE] River patterns', patterns);
		browser.contextMenus.create({
			"title": lang("context_river"), 
			"contexts":["link"], 
			//"onclick": downloadRiver, 
			"id": 'uploadYNW',						                      
			'targetUrlPatterns': patterns
		});
	}

	const contextMenuListener = (info, tab) => {
		//console.log(info, tab);
		if(info.menuItemId == 'downloadLink') {
			download(info, tab);
		} else if(info.menuItemId == 'uploadYNWForced') {
			downloadRiver(info, tab);
		} else if(info.menuItemId == 'downloadLinks') {
			downloadSelection(info, tab);
		} else if(info.menuItemId == 'learnLink') {
			learn(info, tab);
		} else if(info.menuItemId == 'uploadYNW') {
			downloadRiver(info, tab);
		}
	}

	//browser.contextMenus.onClicked.removeListener(contextMenuListener);
	if(firstInit) {
		browser.contextMenus.onClicked.addListener(contextMenuListener);
	}

	log.info('[CORE] Context menus OK');
}

function setupInterception(fullReload)  {

	// Get id from some redirection-heavy hosts
	if(env.config.hosts.hardRedirectPatterns.length > 0 && !browser.webRequest.onBeforeRedirect.hasListener(getHiddenId)) {
		log.info('[CORE] hiddenID listener OK');
		browser.webRequest.onBeforeRedirect.addListener(
		  	getHiddenId,
		  	{urls: env.config.hosts.hardRedirectPatterns}
		);
	}
}



async function downloadRiver  (info, tab, forward) {

	// TODO rewrite with fetch. One day...

	var riverErrors = {
		'MAGNET_INVALID_ID': 'This magnet ID does not exists or is invalid',
	    'MAGNET_INVALID_URI': lang('river_error_not_a_magnet'),
	    'MAGNET_INVALID_FILE': lang('river_error_invalid_river'),
	    'MAGNET_FILE_UPLOAD_FAILED': lang('river_error_upload_failed'),
	    'MAGNET_NO_URI': "No magnet sent",
	    'MAGNET_PROCESSING': "Magnet is processing or completed",
	    'MAGNET_TOO_MANY_ACTIVE': lang('river_error_max_queue_reached'),
	    'MAGNET_MUST_BE_PREMIUM': "You must be premium to use this feature",
	    'MAGNET_NO_SERVER': "Server are not allowed to use this feature",
	    'MAGNET_TOO_LARGE': lang('river_error_river_too_large'),
	};

	if(info.linkUrl.slice(0,6).toUpperCase() == 'MAGNET') {
		
		log.info('[FEAT] Magnet detected, sending to Alldebrid');

		var response = await api.fetch('magnet/upload', {'magnet[]': info.linkUrl});

		if(response.status == 'error') {
			log.info('Error during upload', response.error);
			notification(lang("notif_river_upload_error"), lang("notif_river_upload_error_desc"));
		}
			
		var result = response.data.magnets[0];

		if(exists(result.error)) {
			if(rxists(riverErrors[result.error.code]))
				var error = riverErrors[result.error.code];
			else
				var error = lang('river_error_upload_failed');

			log.info('Server returned an error', result.error);
			notification(lang("error"), error);
			return;
		}

		var id = result.id;
		log.info('[FEAT] Magnet uploaded, id', id);

		env.config.rivers.running[parseInt(id)] = 0;

		cronRiver(true);
		notification(lang("notif_river_uploaded"), lang("notif_river_uploaded_desc"), 'river-' + id);
		return;
	} else {
		log.info('[COMM] Sending command to tab', env.config.currentTab);
		try {

			var result;
			try {
				result = await browser.tabs.sendMessage(env.config.currentTab, {command: 'downloadMag', link: info.linkUrl, api: api.getUrl('magnet/upload/file')}, {frameId: 0});
			} catch(error) {
				log.info('[COMM] Re-injecting scripts on', env.config.currentTab);
				try {
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
						},
						injectImmediately: true,
						files: ["/content-scripts/link-detector.js"]
					});

					result = await browser.tabs.sendMessage(env.config.currentTab, {command: 'downloadMag', link: info.linkUrl, api: api.getUrl('magnet/upload/file')}, {frameId: 0})
				} catch(error) {
					log.info('[RIVER] Upload error', error);
					notification(lang("notif_river_upload_error"), lang("notif_river_upload_error_desc"));
					return;	
				}
			}
			
			if(result.error) {
				log.info('[RIVER] Upload result error', error);
				notification(lang("error"), lang("result.error"));
				return;
			}

			log.info('[RIVER] Got downloadMag response', result);

			const base64Req = await fetch(result.payload);
			const blob = await base64Req.blob();

			var fd = new FormData();
			fd.append("files[]", blob, 'alld.torrent');

			fetch(api.getUrl('magnet/upload/file'), {
				//mode: 'no-cors',
				method: 'POST',
				// headers: {
				// 	'Accept': 'application/json, application/xml, text/plain, text/html, *.*',
				// 	'Content-Type': 'multipart/form-data'
				// },
				body: fd,
			})
			.then(res => res.json())
			.then(response => {
				log.info('[RIVER] magnet/upload/file response', response);

				if(response.status == 'error') {
					log.info('[RIVER] Upload error', response.error);

					notification(lang("notif_river_upload_error"), lang("notif_river_upload_error_desc"));
					return;	
				}

				var result = response.data.files[0];

				if(exists(result.error)) {
					if(rxists(riverErrors[result.error.code]))
						var error = riverErrors[result.error.code];
					else
						var error = lang('river_error_upload_failed');

					log.info('[RIVER] Server returned an error', result.error);
					notification(lang("notif_river_upload_error"), error);
					return;
				}

				var id = result.id;
				log.info('[FEAT] River uploaded, id', id);

				notification(lang("notif_river_uploaded"), lang("notif_river_uploaded_desc"), 'river-' + id);

				env.config.rivers.running[parseInt(result.id)] = 0;

				cronRiver(true);

			})
			.catch(err => {
				log.info('[RIVER] JSON error', err);
				notification(lang("notif_river_upload_error"), lang("notif_river_upload_error_desc"));
				return;	
			});
		}
		catch(error) {
			console.log('downloadMag error', error);
		}
		return;


		//console.info(info.menuItemId);
		var xhr = new XMLHttpRequest();
		xhr.open('GET', info.linkUrl, true);
		xhr.withCredentials = true;
		xhr.responseType = 'arraybuffer';

		xhr.onreadystatechange = function() {
			if(this.readyState == 2) {
				try {
					if (this.status == '404') {
						notification(lang("error"), lang("notif_river_404"));
						return;
					}
					var size = this.getResponseHeader("Content-Length");

					if(size >  15000000) {
						notification(lang("error"), lang("notif_river_too_big"));
						this.abort();
					}
				} catch(err) {
				}
			}
			if(this.readyState == 4 && this.status == '200') {
				var contentDispo = this.getResponseHeader("Content-Disposition");
				var type = this.getResponseHeader("Content-Type");

				if(contentDispo == null)
					contentDispo = '';

			    if( contentDispo.indexOf('torrent') > -1 || type.indexOf("application/x-bit" + 'torrent') > -1)  {

			    	log.info('[FEAT] River detected, sending to Alldebrid');

			     	var blob = new Blob([this.response], {type: 'application/x-bit' + 'torrent'});

			    	
			    } else {
			    	log.info('[RIVER] Error, not a valid river');

			    	notification(lang("error"), lang("notif_river_invalid"));
			    }
			}
		};
		xhr.send();	
	}	
}

async function checkRivers() {

	if(!env.config.isLoggued)
		return;

	if(!env.options.riverCompletionNotif) // User doesn't want any notif
		return;

	env.config.rivers.lastUpdate = timestamp();

	log.info('[RIVERS] Session ' + env.config.rivers.session + ' counter ' + env.config.rivers.counter);

	var rivers = await api.rivers();

	if(env.config.rivers.list == false) { // First sync, init stuff
		log.info('[RIVERS] First sync');
		firstHit = true;
		env.config.rivers.list = rivers;
	}
	rivers.forEach(function(torrent) {
		if(!('id' in torrent)) {
			return;
		}

		if(torrent.id in env.config.rivers.list) {
			// We already have data for this torrent
			var keys = Object.keys(torrent);

			if('deleted' in torrent) {
				// Torrent was deleted
				delete env.config.rivers.list[torrent.id];
			} else {
				// Sync diff values
				keys.forEach(function(key) {
					env.config.rivers.list[torrent.id][key] = torrent[key];
				});
			}	
		} else {
			// New torrent, let's add it
			env.config.rivers.list[torrent.id] = torrent;
		}
	});
	
	var riversIDs = [];
	var runningRiversIDs = [];

	log.info('[RIVERS] Checking rivers updates, we have ' + objLen(env.config.rivers.running) + ' running rivers');

	//rivers.forEach( (river) => {
	await objForEachAsync(env.config.rivers.list, async (river) => {
		//log.info('[RIVERS] Processing ', river)

		if(river.statusCode < 4) { // Running river
			runningRiversIDs.push(river.id);

			if(!exists(env.config.rivers.running[river.id])) { // First time we see it. 
				log.info('[RIVER] Adding river ' + river.id + 'to running array');
				env.config.rivers.running[river.id] = river.statusCode; // Saving state, we display notif on state change. Skipping
				//return log.info('Saving state, we display notif on state change. Skipping');
			}

			if(!env.options.riverLiveNotif) // If no live notif, user doesn't care for running state.
				return log.info('[RIVER] If no live notif, user doesnt care for running state.');
		} else if(!exists(env.config.rivers.running[river.id])) {
			return ; //log.info('[RIVER] Old river already processed, skipping');
		}

		if(exists(env.config.rivers.running[river.id]) && env.config.rivers.running[river.id] == river.statusCode && !env.options.riverLiveNotif)  // Same status as before. Skipping
			return log.info('[RIVER] Same status as before. Skipping');

		var links = false;
		var progress = 0;

		switch (river.statusCode) {
		  case 0: // Queued
		    var title = lang("notif_river_live_queue"); 
			var message = river.filename + ' ' + lang("notif_river_live_queue_desc"); 
		    break;
		  case 1: // DLing
		    var title = lang("notif_river_live_downloading") + ' (' + humanFileSize(river.downloadSpeed) + '/s)';
			var message = river.seeders + ' ' + lang("notif_river_live_seeders") + ' ' + river.filename;
			
			progress = 0;
			if(river.size != 0)
				progress = Math.floor(river.downloaded / river.size * 100);
			
		    break;
		  case 2: // Processing - TODO add progress
		    var title = lang("notif_river_live_moving");
			var message = lang("notif_river_live_moving_desc") + ' ' + river.filename;
		    break;
		  case 3: // Uploading
		    var title = lang("notif_river_live_uploading") + ' (' + humanFileSize(river.uploadSpeed) + '/s)';
			var message = river.filename + ' ' + lang("notif_river_live_uploading_desc");
			progress = Math.floor(river.uploaded / river.size * 100);
		    break;
		  case 4: // Ready
			var title = lang("notif_river_live_ready");
			var message = river.filename + ' ' + lang("notif_river_live_ready_desc");
			progress = 100;

			var riversFiles = await api.riversFiles(river.id);

			if(rivers.length > 0) {

				//console.log('Got files', riversFiles);

				var files = [];

				const parseNode = (node, path = "") => {
					var nodeFiles = [];
					if(node.e) {
						if(node.z === 2) {
							node.fn = path + node;
							node.t = 'archive';
							nodeFiles.push(node);
						} else {
							node.e.forEach((subNode) => {
								nodeFiles = nodeFiles.concat(parseNode(subNode, path + node.n + "/"));
							});
						}
					} else {
		
						var ext = node.n.split('.').pop();
			
						if(ext) {
							ext = ext.toLowerCase();
						} else {
							ext = "";
						}
			
						var type = 'default';
			
						for(const filetype in fileTypes) {
							if(fileTypes[filetype]['ext'].indexOf(ext) !== -1) {
								type = filetype;
								break;
							}
						}
			
						if(['infos', 'images'].indexOf(type) !== -1) {
							node.l = node.l.concat('?optional=1');
						}
			
						node.t = type;
						node.fn = path + node.n;
						nodeFiles.push(node);
					}
		
					return nodeFiles;
				}
				  
				  
				riversFiles.forEach((node) => {
					const parsedNode = parseNode(node);
					files = files.concat(parsedNode);
				});

				env.config.rivers.links[river.id] = files;
				links = files;

				log.info('[RIVERS] New files', riversFiles);
			} else {
				log.info('[RIVERS] Could not get files');
			}
			
		    break;
		  case 5: // Error states
		  case 6:
		  case 7:
		  case 8:
		  case 9:
		  case 10:
		  	var title = lang("error");
			var message = river.filename + ' : ' + river.status;
		    break;
		  default:
		  	log.info('Weird river', river);
		  	return;
		    break;
		}

		if(river.notified == true)
			return; 

		if(river.statusCode < 4) {// User still here so has live notif enabled
			if(env.config.client.features.liveNotif != true)
				return;

			liveNotification(river.id, progress, title, message, links);
			return;
		}

		log.info('[RIVER] Done', river.filename);

		delete env.config.rivers.running[river.id]; // Either Ready or error, not running anymore

		if(river.statusCode == 4) { 
			if(env.config.client.features.liveNotif == true) {
				// display notif with button if supported

				return liveNotification(river.id, progress, title, message, links);	
			} 
			
			return notification(title, message, 'river-' + river.id);
		}

		if(river.statusCode > 4)
			return notification(title, message, 'river-' + river.id);

	});

	env.config.rivers.hasRunning = false;

	// Cross check river list and our state array tracking running and closed river
	objForEach(env.config.rivers.running, (riverStatus, index) => {
		index = parseInt(index);
		if(runningRiversIDs.indexOf(index) === -1) {
			// Dead running river
			log.info('[RIVER] Purging stale river', index);
			
			delete env.config.rivers.running[index];
		} else {
			env.config.rivers.hasRunning = true;
		}
	});

	if(env.config.rivers.hasRunning) {
		log.info('[RIVERS] We have active rivers');
	}

	env.config.rivers.closedNotif.forEach( (riverID, index) => {
		if(runningRiversIDs.indexOf(riverID) === -1) {
			// Dead running river
			log.info('[RIVER] Purging stale river closed notif', riverID);

			env.config.rivers.closedNotif.splice(index, 1);
		}
	});	

	storage.set({config: env.config});
}

// Setup extension messaging to communication with native messaging, popup, content scripts and websites
browser.runtime.onMessage.addListener(handleMessage);