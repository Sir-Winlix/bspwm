// Usefull utils

var supportedLocalStreamExt = ['mp4', 'mpg', 'mpeg', 'vob', 'avi', 'mkv', 'webm', 'flv', 'mov', 'wmv', 'wav', 'mp3', 'aac', 'flac', 'mka', 'm4a', 'm4b', 'ogg', 'ts', 'mts', 'm2ts'];

const timestamp = () => { return Math.floor(Date.now() / 1000); }

const time = (date) => {
	if(typeof date !== 'object')
		date = new Date();

	return date.getDate() + '/' + date.getMonth() + ' @ ' + date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();
}

const capitalizeFirstLetter = (string) => { return string.charAt(0).toUpperCase() + string.slice(1); }

const exists = (variable) => { return (typeof(variable) != 'undefined'); }

const objForEach = (obj, callback) => {
  	for(var key in obj) {
	    // skip loop if the property is from prototype
	    if (!obj.hasOwnProperty(key)) continue;

	    callback(obj[key], key);
	}
};

const objForEachAsync = async (obj, callback) => {
	for(var key in obj) {
	  // skip loop if the property is from prototype
	  if (!obj.hasOwnProperty(key)) continue;

	  await callback(obj[key], key);
  }
};

const objLen = (obj) => {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) 
        	size++;
    }
    return size;
};

const to = (promise) => {
   return promise.then(data => {
      return [null, data];
   })
   .catch(err => [err]);
}

const sharedStart = (array) => {
	var A= array.concat().sort(), 
	a1= A[0], a2= A[A.length-1], L= a1.length, i= 0;
	while(i<L && a1.charAt(i)=== a2.charAt(i)) i++;
	return a1.substring(0, i);
}

const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const waitForInit = async () => {
	for (let wait = 0; wait < 50; wait++) {
		await sleep(100);
		if(env && env.config && env.config.init && env.config.init === true) {
			log.info('[CORE] Extension is ready');
			return;
		}
	}
	log.info('[CORE] Extension did not get ready after 5s');
}

const waitForBootstrap = async () => {
	for (let wait = 0; wait < 50; wait++) {
		await sleep(100);
		if(env && env.config && env.config.boot && env.config.boot === true) {
			log.info('[CORE] Extension is bootstrapped');
			return;
		}
	}
	log.info('[CORE] Extension did not get bootstrapped after 5s');
}


// i18n helper
const lang = (key) => {
	//return browser.i18n.getMessage(key);

	key = 'webext_' + key;

	if(!exists(env.langStore[key])) {
		log.warn('[LANG] Missing key', key);
		return key;
	}

	return env.langStore[key];
}

// set debug state
const setDebug = (enabled) => {
	if(enabled == true) {
		log.setLevel('trace');
		log.echo = true;
		//setupLoggingHistory();
	} else {
		setupLoggingHistory();
	}
}


const slashEscape = (contents) => {
	if(typeof contents != 'string')
		return contents;

    return contents
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n');
}


const sendToAlld = async (links) => {
	var currentTabInfo = await browser.tabs.get(env.config.currentTab);

	if(currentTabInfo) {
		tabIndex = currentTabInfo.index + 1;
		var createTab = await browser.tabs.create({ url: 'https://alldebrid.' + env.config.domain + '/service/', index: tabIndex});
	} else {
		var createTab = await browser.tabs.create({ url: 'https://alldebrid.' + env.config.domain + '/service/'});
	}

	env.config.dlLinksTab = createTab.id;
	env.config.dlLinks = links;


		// browser.tabs.executeScript(
		// 	tab.id, 
		// 	{code: "document.getElementById('links').value = '" + slashEscape(links) + "'; document.getElementById('giveMeMyLinks').click()"}
		// ).then( (result) =>  {
		// 	if (browser.runtime.lastError)
		// 		log.info('[FEAT] Error inserting posting CS', browser.runtime.lastError);
		// });
	//});
}

var humanFileSize = function(bytes) {
    
    if(lang('lang') == 'fr')
    	var units = ['octets', 'ko','Mo','Go','To','Po','Eo','Zo','Yo'];
    else
    	var units = ['Bytes', 'kB','MB','GB','TB','PB','EB','ZB','YB'];

    if(Math.abs(bytes) < 1024)
        return bytes + ' ' + units[0];
    
    var u = 0;
    do {
        bytes /= 1024;
        ++u;
    } while(Math.abs(bytes) >= 1024 && u < units.length - 1);

    return bytes.toFixed(1) + ' ' + units[u];
}


// Get extension background env variables content for use in content scripts and popup
const getEnv = (key) => {
	var keyParts = key.split('.');
	var allowedVariables = ['config', 'user', 'options', 'langStore']; // Shared variables

	if(allowedVariables.indexOf(keyParts[0]) === -1)
		return null; // Not allowed

	var payload = env[keyParts[0]];

	if(keyParts.length == 1)
		return payload;

	keyParts.shift(); // Remove main key name, let's get requested subkey

	for(var i = 0, len = keyParts.length; i < len; i++) { // each level at a time
		if(!exists(payload[keyParts[i]]))// bad path
			continue;

		payload = payload[keyParts[i]];
	}

	return payload;
}

const isValidHostLink = (link)  => {

	// Strip https?:// from link
	var linkCleaned = link.replace(/(^\w+:|^)\/\/(www\.)?/, '');

	// If link not valid, early return
	if(typeof link !== 'string' || link == '') {
		log.info('[CORE] Invalid link', link);

	   return false;
	}

	// Get regexps
	var hosts = env.config.hosts.hostsRegexp;

	log.info('[CORE] Checking link ', linkCleaned);

	for(var host in hosts) {
		// Skip user disabled hosts
		if(env.options.disabledHosts == true && env.options.disabledHostsList.indexOf(host) != -1) {
			continue;
		}
		for(var reg in hosts[host]) {
			try {
				var regexp = hosts[host][reg];
				if(XRegExp(regexp).test(linkCleaned)){
					log.info('[CORE] Matched', linkCleaned, 'with', host, 'regexp', regexp);
					return true;
				}
			} catch (err) {
				log.warn('[CORE] Regexp error on', host, err, regexp);
				continue;	
			}
		}	
	}

	// Get regexps
	var folders = env.config.hosts.foldersRegexp;

	for(var folder in folders) {
		//log.info('[CORE] Trying redirector ', folder);
		// Skip user disabled hosts
		if(env.options.disabledHosts == true && env.options.disabledHostsList.indexOf(folder) != -1) {
			log.info('[CORE] skip');
			continue;
		}
		for(var reg in folders[folder]) {
			try {
				//log.info('[CORE] Trying regexp ', regexp);
				var regexp = folders[folder][reg];
				if(XRegExp(regexp).test(linkCleaned)){
					log.info('[CORE] Matched', linkCleaned, 'with', folder, 'regexp', regexp);
					return true;
				}
			} catch (err) {
				log.warn('[CORE] Regexp error on', folder, err, regexp);
				continue;	
			}
		}	
	}

	// check enabled steam hosts
	if(env.options.enabledStream && env.options.enabledStreamList.length > 0) {

		var streams = env.options.enabledStreamList;
		
		for(var stream in streams) {
			for(var reg in env.config.hosts.streamRegexp[streams[stream]]) {
				try {
					var regexp = env.config.hosts.streamRegexp[streams[stream]][reg];
					if(XRegExp(regexp).test(link)){
						log.info('[CORE] Matched', link, 'with', streams[stream], 'regexp', regexp);
						return true;
					}
				} catch (err) {
					log.warn('[CORE] Regexp error on', streams[stream], err, regexp);
					continue;	
				}
			}
		}
	}

	return false;
}

const isValidStreamLink = (link)  => {

	// Strip https?:// from link
	var linkCleaned = link.replace(/(^\w+:|^)\/\/(www\.)?/, '');

	// If link not valid, early return
	if(typeof link !== 'string' || link == '') {
		log.info('[CORE] Invalid link', link);

	   return false;
	}


	var streams = env.config.hosts.streamRegexp;
		
	for(var stream in streams) {
		for(var reg in streams[stream]) {
			try {
				var regexp = streams[stream][reg];
				if(XRegExp(regexp).test(link)){
					console.log('[CORE] Matched', link, 'with', stream, 'regexp', regexp);
					log.info('[CORE] Matched', link, 'with', stream, 'regexp', regexp);
					return true;
				}
			} catch (err) {
				//log.warn('[CORE] Regexp error on', stream, err, regexp);
				continue;	
			}
		}
	}


	return false;
}

// Get user client infos, to dynamically enable/disable features and make native messaging work smoothly.
const getClientInfos = async () => {

	let client = {};

	if(/opera|opr\/|opios/i.test(navigator.userAgent)) {
		client.nav = 'opera';
		client.agent = 'operaExt';
		client.features = {
			liveNotif: true, 
			extendedPattern: true
		};
	} else if(/edg([ea]|ios)/i.test(navigator.userAgent)) {
		client.nav = 'edge';
		client.agent = 'edgeExt';
		client.features = {
			liveNotif: false, 
			extendedPattern: false
		};
	} else if(/firefox|iceweasel|fxios/i.test(navigator.userAgent)) {
		client.nav = 'ff';
		client.agent = 'ffExt';
		client.version = +(/Firefox\/([0-9]+)/.exec(navigator.userAgent) || [,0])[1];
		client.features = {
			liveNotif: false, // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/notifications/NotificationOptions
			extendedPattern: false
		};
		if(client.version > 63) // https://bugzilla.mozilla.org/show_bug.cgi?id=1280370#c38
			client.features.extendedPattern = true;
	} else /*if(chrome|crios|crmo/i.test(navigator.userAgent)) */ {
		client.nav = 'chrome';
		client.agent = 'chromeExt';
		client.version = +(/Chrome\/([0-9]+)/.exec(navigator.userAgent) || [,0])[1];
		client.features = {
			liveNotif: true, 
			extendedPattern: true
		};
		if(client.version > 79) // extendedPattern was broken on chromium 80
			client.features.extendedPattern = false;
	}

	// Needed for local streaming via native messaging
	if(navigator.userAgent.indexOf('Mac') !== -1)
		client.os = 'mac'
	else if (navigator.userAgent.indexOf('Linux') !== -1)
		client.os = 'linux'
	else
		client.os = 'win'


	let manifest = chrome.runtime.getManifest(); 
	client.version = manifest.version;

	// signed version
	client.fullVersion = client.version + '-' + await Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder('utf-8').encode('0zq0RgPeqR' + client.agent +  'YB4aGYWILR' + client.version)))).map(b => ('00' + b.toString(16)).slice(-2)).join('').substring(0, 8);

	client.localStream = await native.getVersion();

	console.log('getClientInfos', client)

	return client;
}


// Basic notif
const notification = async (title, message, id) => {
	var notifOpts = {
		"type" : "basic",
		"title": title,
		"message": message,
		"iconUrl": env.config.imgs.logo
	};

	if(id != null) {
		browser.notifications.create(id, notifOpts).then((notificationId) => {
		}).catch((error) => { log.error(error)});
	} else {
		browser.notifications.create(notifOpts).then((notificationId) => {
		}).catch((error) => { log.error(error)});
	}	
}

// Live notif with live updating informations and progressbar where supported
const liveNotification = (id, progress, title, message, links) => {

	console.log('Creating liveNotification', links)

	// If user has manually closed this notification and we don't have the final links, do nothing 
	if(!links && env.config.rivers.closedNotif.indexOf(id) !== -1) {
		return;
	}

	if(message.length > 36)
		message = message.substr(0, 33) + "...";

	var opt = {
		progress: Math.max(0, progress),
		type: "progress",
		iconUrl: env.config.imgs.logo,
		title: title,
		message: message,
		isClickable: false,
		requireInteraction: true
	};
	

	// Display  quick download or open buttons
	if(links) {
		console.log('Adding button', chrome.i18n.getMessage("ykw_open_on_alld"))

		opt.buttons = [{title: chrome.i18n.getMessage("ykw_open_on_alld")}];
	}

	if(env.config.rivers.liveNotif.indexOf(id) == -1) {
		// New live notif, let's add it to track its status elsewhere
		env.config.rivers.liveNotif.push(id);
		chrome.notifications.create('river-' + id, opt);
	} else {
		browser.notifications.update('river-' + id, opt);
	}
}


const getRandomInt = (min, max) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

const fileTypes = {
	'video': {
	  'ext' : ['mp4', 'avi', 'mkv', '3gp', 'mpg', 'mpeg', 'divx', 'wmv', 'flv', 'mov', 'm4v', 'ts', 'webm', 'rmvb'],
	  'icon': 'fas fa-play-circle',
	  'prio': 100,
	},
	'audio': {
	  'ext' : ['mp3', 'aac', 'flac', 'wave'],
	  'icon': 'fas fa-music',
	  'prio': 80,
	},
	'subs': {
	  'ext' : ['srt', 'ssa', 'ass', 'sub', 'vtt', 'smi'],
	  'icon': 'fas fa-language',
	  'prio': 20,
	},
	'disc': {
	  'ext' : ['iso', 'vob', 'bup', 'ifo'],
	  'icon': 'fas fa-compact-disc',
	  'prio': 80,
	},
	'archive': {
	  'ext' : ['rar', 'zip', '7z', 'gz', 'tar'],
	  'icon': 'fas fa-file-archive',
	  'prio': 30,
	},
	'book': {
	  'ext' : ['epub', 'pdf', 'opf'],
	  'icon': 'fas fa-book-open',
	  'prio': 50,
	},
	'bd': {
	  'ext' : ['cbz', 'cbr'],
	  'icon': 'fas fa-books',
	  'prio': 50,
	},
	'infos': {
	  'ext' : ['nfo', 'txt', 'url', 'rtf', 'md5', 'sfv', 'sha', 'website', 'release'],
	  'icon': 'fas fa-info-circle',
	  'prio': 1,
	},
	'images': {
	  'ext' : ['jpg', 'jpeg', 'png', 'gif', 'psd', 'svg'],
	  'icon': 'fas fa-image',
	  'prio': 5,
	},
  
	'code': {
	  'ext' : ['asp', 'css', 'html', 'js', 'php', 'ts', 'json', 'java'],
	  'icon': 'fas fa-code',
	  'prio': 50,
	},
  
	'doc': {
	  'ext' : ['doc', 'docx', 'csv', 'ppt', 'pttx'],
	  'icon': 'fas fa-file-alt',
	  'prio': 50,
	},
  
	'sheet': {
	  'ext' : ['xls', 'xlsx', 'csv'],
	  'icon': 'far fa-file-spreadsheet',
	  'prio': 50,
	},
  
	'win': {
	  'ext' : ['exe', 'bat', 'msi'],
	  'icon': 'fab fa-windows',
	  'prio': 50,
	},
  
	'mac': {
	  'ext' : ['dmg'],
	  'icon': 'fab fa-apple',
	  'prio': 50,
	},
  
	'android': {
	  'ext' : ['apk'],
	  'icon': 'fab fa-android',
	  'prio': 50,
	},
  
	'software': {
	  'ext' : ['bin', 'dll', 'ini', 'jar', 'dxn', 'db'],
	  'icon': 'fas fa-cogs',
	  'prio': 3,
	},
  
	'default': {
	  'ext' : [],
	  'icon': 'fas fa-file',
	  'prio': 0,
	},
	'folder': {
	  'ext' : [],
	  'icon': 'fas fa-folder',
	  'prio': 150,
	}
  }