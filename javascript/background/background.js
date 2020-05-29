/*
    Copyright Jeremiah Megel and Benjamin Cunningham 2012-2014
    
    Incognito This! is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Incognito This! is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
    
    You should have received a copy of the GNU General Public License
    along with Incognito This!. If not, see <http://www.gnu.org/licenses/>.
*/
var mostRecent = {true: [], false: []};
var mostRecentTemp = {true: [], false: []};
var mrQueue = {true: [], false: []};
var isProcessing = false;
var defaultOpenTime = new Date().getTime();
var openTime = {};
var updatedTimes = {};
var isClosing = {};
var itTabs = [];
var singleClick = null;
var queuedTabs = {true: [], false: []};
var blankPageUrl = chrome.extension.getURL("html/blank.html");
var isAllowed = false;
var ignoredTabs = {};
var dnWins = {};

// Check if the extension has been allowed to run in Incognito mode via the
//		extension-manager.
chrome.extension.isAllowedIncognitoAccess(function(isIt){
	isAllowed = isIt;
});

// Turn on the context (right-click) menu option if the user has enabled it.
var context;
if (localStorage["useContext"] == "yes") {
	setContext(true);
}

// Check if there are any tabs that contain keywords the user specified for
//		auto-switching.
startAutoClose();

// Fires when the user clicks the toolbar button.
chrome.browserAction.onClicked.addListener(function(clickedTab){
	if (localStorage["doubleClick"] != "yes") {
		switchTabs("multiple");
	}
	else {
		// If the user has enabled the double-click option in the Options page,
		//		delay the first click 500 milliseconds to see if the user clicks
		//		it again. If the user clicks the button twice within 500
		//		milliseconds, switch all the tabs in the window instead of just
		//		the ones that the user has selected.
		if (singleClick == null) {
			singleClick = setTimeout(function(){
				singleClick = null;
				switchTabs("multiple");
			}, 500);
		}
		else {
			clearTimeout(singleClick);
			singleClick = null;
			switchTabs("window");
		}
	}
});

// If a new tab is created (either by the user or by an extension), add the tab's
//		Incognito value (Boolean) to [ignoredTabs] (array of Boolean) to be used
//		later by the chrome.webRequest.onBeforeRequest listener, and then pass its
//		details to the autoClose() function.
chrome.tabs.onCreated.addListener(function(newTab){
	ignoredTabs[newTab.id] = newTab.incognito;
	autoClose(newTab);
});

// If a tab's URL, loading/complete status, etc. changes, pass its details to the
//		cheackAnyTab() an autoClose() functions.
chrome.tabs.onUpdated.addListener(function(updatedTabId, updatedInfo, updatedTab){
	checkAnyTab(updatedTab);
	autoClose(updatedTab);
});

// If a tab is closed, stop any of its auto-close times from the [updatedTimes] array.
chrome.tabs.onRemoved.addListener(function(removedTabId, removedTabInfo){
	if ((updatedTimes[removedTabId] != undefined) && (updatedTimes[removedTabId] != null)) {
		clearTimeout(updatedTimes[removedTabId]);
		updatedTimes[removedTabId] = null;
	}
});

// If the user changes their window focus (to a Chrome window), pass the window's
//		Incognito value (Boolean) and ID to updateMostRecent() (so that when a user
//		switches a tab, the extension knows which window of a specified type was
//		used most recently - the window into which the new tab will be placed), and
//		pass the details of the window's active tab to checkAnyTab(). Also, if there
//		is a desktop notification telling the user to switch to the newly focused
//		window, close the notification, because the user just did so.
chrome.windows.onFocusChanged.addListener(function(incogWinId){
	chrome.windows.get(incogWinId, {populate: false}, function(mrWin){
		if (incogWinId >= 0) {
				updateMostRecent(mrWin.incognito, mrWin.id, mrWin.type);
		}
		if (incogWinId != chrome.windows.WINDOW_ID_NONE) {
			chrome.tabs.query({windowId: incogWinId, active: true}, function(activeTabs){
				for (var activeTab in activeTabs) {
					updateMostRecent(activeTabs[activeTab].incognito, incogWinId, mrWin.type);
					checkAnyTab(activeTabs[activeTab]);
				}
			});
		}
	});
	cancelDN(incogWinId);
});

// If a window is closed, remove it from the [mostRecent] array, so that the
//		extension will not try to place any new tabs in this now nonexistent
//		window, and close any desktop notifications that are telling the user
//		to switch to this window.
chrome.windows.onRemoved.addListener(function(winId){
	if (mostRecent[true].indexOf(winId) != -1) {
		removeMostRecent(true, winId);
	}
	else if (mostRecent[false].indexOf(winId) != -1) {
		removeMostRecent(false, winId);
	}
	cancelDN(winId);
});

// Fires when a message is sent from a content script or another part of the extension.
chrome.extension.onMessage.addListener(function(request, sender, respond){
	if ((request == "switchTabs") && (localStorage["useKey"] == "yes")) {
	// If the user types Ctrl+B, and the relevant option is enabled, switch any
	//		tabs that the user has selected.
		switchTabs("multiple");
	}
	else if (request == "autoClose") {
	// This message is sent by [javascript/content/key.js], a content script,
	//		and passes the details of the tab that sent the message to
	//		autoClose() to let the extension know that the tab is active
	//		and not idle to prevent it from being auto-closed.
		autoClose(sender.tab);
	}
	else if (request == "autoCloseAll") {
	// It would appear that this message is no longer sent to the extension by
	//		any script. It could probably be removed, but I'm not entirely
	//		sure.
		startAutoClose();
	}
	else if (request == "context") {
	// This message is sent by [javascript/visible/options.js], the script
	//		for the Options page, and fires setContext() to enable or disable
	//		the context (right-click) menu option based on the user's
	//		preference.
		setContext(localStorage["useContext"]=="yes");
	}
});

// If the active tab in a window changes, pass its details to checkAnyTab();
chrome.tabs.onActivated.addListener(function(activeInfo){
	chrome.tabs.get(activeInfo.tabId, function(itsATab){
		checkAnyTab(itsATab);
	});
});

// Fires when the user types something into the Omnibox under the extension's
//		keyword. (See the extension's manifest for the keyword.)
chrome.omnibox.onInputChanged.addListener(function(omniText, suggest){
	// Check if the text they've entered is a command for switching a tab(s).
	var switchType = areYouSure(omniText);
	
	// Check if the different potential commands for switching a tab(s) can
	//		ACTUALLY be performed.
	textAvail(switchType, function(incognito, totalUsable) {
		// Search the user's bookmarks and history for potential URLs that they
		//		might want to open in Incognito mode (or in normal mode if they
		//		are using the Omnibox in an Incognito window).
		chrome.bookmarks.search(omniText, function(bookmarks){
			chrome.history.search({text: omniText, maxResults: 10}, function(history){
				var suggestions = [];
				if (totalUsable.all > 0) {
				// If there are any tabs at all that can be switched.
					if (totalUsable.window > 0) {
					//	If there are any tabs in the current window that can be switched.
						if ((switchType.single) && (totalUsable.single > 0)) {
						// If the user has typed a command that could be interpreted to mean that
						//		they want to switch the active tab, suggest the command.
							suggestions.push({content: "tab ", description: ((!incognito)?"":"De-") + "Incognito this tab!"});
						}
						if ((switchType.multiple) && (((totalUsable.multiple + totalUsable.single) > 0) || (!switchType.single))) {
						// If the user has typed a command that could be interpreted to mean that
						//		they want to switch the selected tab(s), suggest the command.
							suggestions.push({content: ((totalUsable.multiple > 0)?"tabs ":"tab "), description: ((!(incognito))?"":"De-") + "Incognito " + ((totalUsable.multiple > 0)?"these tabs":"this tab") + "!"});
						}
						if (switchType.window) {
						// If the user has typed a command that could be interpreted to mean that
						//		they want to switch all the tabs in the current window, suggest the
						//		command.
							suggestions.push({content: "window ", description: ((!incognito)?"":"De-") + "Incognito this window!"});
						}
					}
					if (switchType.all) {
					// If the user has typed a command that could be interpreted to mean that
					//		they want to switch all tabs in all windows (with the same Incognito
					//		value as the current window), suggest the command.
						suggestions.push({content: "all ", description: ((!incognito)?"":"De-") + "Incognito all tabs!"});
					}
				}
				if (checkIt([[["options", "preferences", "settings"]]], omniText)) {
				// If the user has typed a command that could be interpreted to mean that
				//		they want to open the Options page, suggest the command.
					suggestions.push({content: "options ", description: "⚙ Options"});
				}
				if (checkIt([[["faq", "information"]], [["frequently"], ["asked"], ["questions"]]], omniText)) {
				// If the user has typed a command that could be interpreted to mean that
				//		they want to open the FAQ, suggest the command.
					suggestions.push({content: "faq ", description: "؟ Frequently Asked Questions"});
				}
				if (omniText != "") {
					// Check if the user has typed a URL.
					var reu = regExUrl(omniText);
					if (reu.url) {
					// If the user has typed a URL, suggest opening it.
						if ((reu.scheme) && (checkUrl(omniText))) {
							suggestions.push({content: omniText + " ", description: "Open \""+omniText+"\" in " + ((!incognito)?"an Incognito":"a normal") + " window."});
						}
						else {
							suggestions.push({content: "http://" + omniText + " ", description: "Open \"http://" + omniText + "\" in " + ((!incognito)?"an Incognito":"a normal") + " window."});
						}
					}
					// Suggest searching Google for the text they typed.
					suggestions.push({content: "https://www.google.com/#q=" + encodeURIComponent(omniText) + " ", description: "Google \"" + omniText.replace(/&/g, "&amp;") + "\" in " + ((!incognito)?"an Incognito":"a normal") + " window."});
					
					// Search their bookmarks for something similar to what they typed,
					//		and suggest opening any results.
					for (b in bookmarks) {
						if (checkUrl(bookmarks[b].url)) {
							suggestions.push({content: bookmarks[b].url + " ", description: "☆ Open "+((bookmarks[b].title != "")?("\"" + bookmarks[b].title.replace(/&/g, "&amp;") + "\" (<url>" + bookmarks[b].url.replace(/&/g, "&amp;") + "</url>)"):("<url>" + bookmarks[b].url.replace(/&/g, "&amp;") + "</url>"))+" in " + ((!incognito)?"an Incognito":"a normal") + " window."});
						}
					}
					
					// Search their history for something similar to what they typed,
					//		and suggest opening any results.
					for (h in history) {
						if (checkUrl(history[h].url)) {
							suggestions.push({content: history[h].url + " ", description: "⌚ Open "+((history[h].title != "")?("\"" + history[h].title.replace(/&/g, "&amp;") + "\" (<url>" + history[h].url.replace(/&/g, "&amp;") + "</url>)"):("<url>" + history[h].url.replace(/&/g, "&amp;") + "</url>"))+" in " + ((!incognito)?"an Incognito":"a normal") + " window."});
						}
					}
				}
				
				// Sends all of the suggestions to the Omnibox.
				suggest(suggestions);
			});
		});
	});
});

// Fires when the user sends a command to the extension via the Omnibox.
chrome.omnibox.onInputEntered.addListener(function(omniText){
	omniText = omniText.trim();
	
	// Check if the text they've entered is a command for switching a tab(s).
	var switchType = areYouSure(omniText);
	textAvail(switchType, function(incognito, totalUsable) {
		if ((switchType.single) && (totalUsable.single > 0)) {
		// If the user has sent a command that could be interpreted to mean that
		//		they want to switch the active tab, do so.
			switchTabs("single");
		}
		else if ((switchType.multiple) && (totalUsable.multiple > 0)) {
		// If the user has sent a command that could be interpreted to mean that
		//		they want to switch the selected tab(s), do so.
			switchTabs("multiple");
		}
		else if ((switchType.window) && (totalUsable.window > 0)) {
		// If the user has sent a command that could be interpreted to mean that
		//		they want to switch all the tabs in the current window, do so.
			switchTabs("window");
		}
		else if ((switchType.all) && (totalUsable.all > 0)) {
		// If the user has sent a command that could be interpreted to mean that
		//		they want to switch every tab in every window (with the same
		//		Incognito value as the current window), do so.
			switchTabs("all");
		}
		else {
			chrome.tabs.query({lastFocusedWindow: true, active: true}, function(tabInUse){
				// Check if the active tab in the last focused window is the New Tab page.
				var newTabId = null;
				if (tabInUse[0].url.replace(/\/$/, "") == "chrome://newtab") {
					newTabId = tabInUse[0].id;
				}
				
				if (checkIt([[["options", "preferences", "settings"]]], omniText)) {
				// If the user has sent a command that could be interpreted to mean that
				//		they want to open the Options page, do so.
					queuedTabs[false].push({url: chrome.extension.getURL("html/options.html"), idToClose: newTabId});
					createTab(incognito);
				}
				else if (checkIt([[["faq", "information"]], [["frequently"], ["asked"], ["questions"]]], omniText)) {
				// If the user has sent a command that could be interpreted to mean that
				//		they want to open the FAQ, do so.
					queuedTabs[false].push({url: chrome.extension.getURL("html/options.html#faq"), idToClose: newTabId});
					createTab(incognito);
				}
				else {
					chrome.windows.getLastFocused(function(currentWin){
						var reu = regExUrl(omniText);
						if ((reu.scheme) && (checkUrl(omniText))) {
						// If the user has sent a command that is a URL with a scheme, open it.
							queuedTabs[!incognito].push({url: omniText, idToClose: newTabId});
						}
						else if (reu.url) {
						// If the user has sent a command that is a URL without a scheme, add an
						//		"http://" scheme, and then open it.
							queuedTabs[!incognito].push({url: "http://" + omniText, idToClose: newTabId});
						}
						else {
						// If user has not entered anything that could be interpreted as any sort
						//		of command or URL, assume that they want to Google the command text.
							queuedTabs[!incognito].push({url: "https://www.google.com/#q=" + encodeURIComponent(omniText), idToClose: newTabId});
						}
						createTab(!incognito);
					});
				}
			});
		}
	});
});

// Set the default backgroud color for any text that would be displayed on
//		the extension's toolbar button. At the moment, the only text
//		displayed on the toolbar button is an "X" if the tab cannot be
//		opened in Incognito based on its URL via checkURL().
chrome.browserAction.setBadgeBackgroundColor({color: [255, 0, 0, 64]});

// Pass the details of every tab in every window to checkAnyTab().
chrome.windows.getAll({populate: true}, function(allWins){
	for (var win in allWins) {
		for (var winTab in allWins[win].tabs) {
			checkAnyTab(allWins[win].tabs[winTab]);
		}
	}
});

// Check any web requests before they're sent to make sure that they don't
//		contain any keywords that the user specified for auto-switching so
//		that auto-switched tabs don't get added to the user's history.
chrome.webRequest.onBeforeRequest.addListener(
	function(details){
		if ((isAuto(details.url)) && (isClosing[details.tabId] == undefined)) {
		// If the requested URL contains auto-switching keywords and if the tab
		//		isn't already being closed by the extension.
			if (!ignoredTabs[details.tabId]) {
			// If the tab is NOT running in Incognito mode.
				
				// Pass the tab's details to doTheAutoThing().
				chrome.tabs.get(details.tabId, function(someTab){
					doTheAutoThing(someTab);
				});
				
				if (localStorage["recent"] == "yes") {
				// If the user has checked the preference to block auto-switched
				//		tabs from being reopened and to hide them from the
				//		"Recently Closed" list, redirect the tab to
				//		[html/blank.html].
					return {redirectUrl: blankPageUrl};
				}
				else {
				// If not, simply prevent the web request from being completed.
					return {cancel: true};
				}
			}
			else {
				return {};
			}
		}
	},
	{types: ["main_frame"], urls: ["<all_urls>"]},
	["blocking"]
);

function isAuto(someUrl) {
	// Checks if [someUrl] (a URL) contains keywords that the user specified
	//		should be auto-switched.
	if ((checkUrl(someUrl)) && (localStorage["autoIncog"] == "yes") && (localStorage["autoTerms"] != undefined)) {
	// If the [someUrl] CAN be be auto-switched and the auto-switch option is
	//		checked.
		var autoTerms = localStorage["autoTerms"].split(",");
		for (var term in autoTerms) {
			var theTerm = encodeURI(autoTerms[term].replace(/(?:(?:^|\n)\s+|\s+(?:$|\n))/g,"").replace(/\s+/g," ").toLowerCase());
			if ((theTerm != "") && (someUrl.toLowerCase().indexOf(theTerm) != -1)) {
				return true;
			}
		}
	}
	return false;
}

function doTheAutoThing(someTab) {
// Set up [someTab] (Tab) to be auto-switched. Tabs that have URLs that the
//		user has specified for auto-switching are passed to this function.
	
	// Put the tab's ID into the [isClosing] array so that other functions know
	//		that the tab is already going to be closed so that these other
	//		functions don't try to close it.
	isClosing[someTab.id] = true;
	
	chrome.windows.getLastFocused({}, function(potentialWin){
		if ((potentialWin.focused) && (someTab.windowId == potentialWin.id) && (someTab.active)) {
		// If the last-focused window is still focused (the user has this window
		//		in focus and not one from another applcation) AND [someTab] is the
		//		active tab in this window, pass its details to indivSwitch() with
		//		the [forceClose] parameter set to [true] (because it is being auto-
		//		switched and not manually switched, the user probably does not want
		//		two copies of the same tab) and the [refocus] parameter set to
		//		[false] (because the user currently has this tab in focus and
		//		probably wants to keep having this tab in focus after it has been
		//		auto-switched).
			indivSwitch(someTab, true, false);
		}
		else {
		// If the user does NOT currently have this tab in focus, do the same as
		//		above, but with the [refocus] parameter set to [true], because
		//		[someTab] is therefore a tab running somewhere in the background,
		//		and the user probably does not want a window popping up with this
		//		tab while they are trying to do work in some other tab/window.
			indivSwitch(someTab, true, true);
		}
		
		createTab(!someTab.incognito);
	});
}

function checkATab(someTab) {
// Checks if [someTab] contains keywords that the user specified should be auto-
//		switched (via the isAuto() function), that it CAN be auto-switched (via
//		the checkUrl() function), and that the tab is not already about to be
//		closed by another function within the extension (via the [isClosing]
//		array). If all of these things are true, pass the details of the tab
//		to doTheAutoThing(); if not, do nothing with the tab. When finished,
//		return the results of checkUrl().
	if (checkUrl(someTab.url)) {
		if ((isClosing[someTab.id] == undefined) && (isAuto(someTab.url))) {
			doTheAutoThing(someTab);
		}
		return true;
	}
	else {
		return false;
	}
}

function checkAnyTab(aTab) {
// Sets up the toolbar button and context menu to display the correct
//		information while the user is browsing [aTab] (Tab). Also checks if
//		the tab needs to be auto-switched via checkATab().
	if (aTab != undefined) {
		if (!aTab.incognito) {
			if (checkATab(aTab)) {
				chrome.browserAction.setTitle({title: "Incognito This!", tabId: aTab.id});
				chrome.browserAction.setBadgeText({text: "", tabId: aTab.id});
			}
			else {
				chrome.browserAction.setTitle({title: "This page cannot be opened in Incognito mode.", tabId: aTab.id});
				chrome.browserAction.setBadgeText({text: "X", tabId: aTab.id});
			}
		}
		else {
			chrome.browserAction.setTitle({title: "De-Incognito This!", tabId: aTab.id});
			chrome.browserAction.setBadgeText({text: "", tabId: aTab.id});
		}
		if (context != undefined) {
			chrome.contextMenus.update(context, {title: ((!aTab.incognito)?"":"De-")+"Incognito This!", enabled: checkUrl(aTab.url)});
		}
	}
}

function autoClose(incogTab) {
// Sets activity timers for Incognito tabs so that if they have been idle
//		for the amount of time specified by the user, they will be auto-
//		closed (whether or not they should be auto-closed is checked at the
//		end of the timer by the actuallyAutoClose() function). If
//		[incogTab] is NOT an Incognito tab and if the tab's URL is the
//		[html/blank.html], this means that the tab was automatically
//		closed by the extension (because the user had enabled the option to
//		block tabs closed by the extension from being reopened) and that
//		the tab has been reopnened by the user or the tab has JUST been
//		switched and redirected to the blank page. If this option is still
//		enabled, close the tab to prevent it from being reopened. If not,
//		send the message "back" to the tab, which is received by
//		[javascript/visible/back.js], which sends the user back to the
//		original content of the tab.
	if (incogTab.incognito) {
		if (updatedTimes[incogTab.id] != undefined) {
			clearTimeout(updatedTimes[incogTab.id]);
		}
		updatedTimes[incogTab.id] = setTimeout((function(tabToRemove){
			return function(){
				actuallyAutoClose(tabToRemove.id, tabToRemove.incognito);
			};
		})(incogTab), (localStorage["autoCloseTime"]!=undefined)?localStorage["autoCloseTime"]:600000);
	}
	else if (incogTab.url == blankPageUrl) {
		if (localStorage["recent"] == "yes") {
			chrome.tabs.remove(incogTab.id, (function(closedTabId){
				return function(){
					isClosing[closedTabId] = undefined;
				};
			})(incogTab.id));
		}
		else {
			chrome.tabs.sendMessage(incogTab.id, "back");
		}
	}
}

function startAutoClose() {
// Starts the autoClose() function for every tab in every Incognito window.
	chrome.windows.getAll({populate: true}, function(allWins){
		for (var win in allWins) {
			if (allWins[win].incognito) {
				for (var incogTab in allWins[win].tabs) {
					autoClose(allWins[win].tabs[incogTab]);
				}
			}
		}
	});
}

function actuallyAutoClose(tabIdToClose, incognito) {
// Checks whether a tab should or should not be auto-closed, and then
//		does so.
	if ((localStorage["autoClose"] == "yes") && ((localStorage["autoCloseAll"] != "no") || (itTabs.indexOf(tabIdToClose) != -1)) && ((updatedTimes[tabIdToClose] != undefined) && (updatedTimes[tabIdToClose] != null))) {
	// If the auto-close option is enabled AND either the auto-close-all-Incognito-Tabs
	//		options is checked or the tab is one that was auto-closed by the extension
	//		AND the tab's ID is in the [updatedTimes] array (which means that the timer
	//		isn't being deleted by another function in the extension, which in turn
	//		means that the tab is active and not idle), close the tab via closeTab().
		closeTab(tabIdToClose, incognito);
	}
}

function switchTabs(group) {
// Find all the tabs in the given group and switch them (if they are in
//		normal mode, switch them to Incognito; if they are in Incognito
//		switch them to normal). Because this function can only be
//		invoked by something the user does (clicks the toolbar button,
//		sends a command via the Omnibox, or clicks the context-menu option)
//		it's alright to use the [lastFocusedWindow] parameter, because
//		the user can only be invoking this through a Chrome window, which
//		would mean that the window that they are using is in focus. "all"
//		means every tab in every window that has the same Incognito value
//		as the last-focused window. "window" means every tab in the last-
//		focused window. "single" means the active tab in the last-focused
//		window. "multiple" (default) means every selected tab in the
//		last-focused window.
	if (group == "all") {
		var switchQuery = {};
	}
	else if (group == "window") {
		var switchQuery = {lastFocusedWindow: true};
	}
	else if (group == "single") {
		var switchQuery = {lastFocusedWindow: true, active: true};
	}
	else { // (group == "multiple")
		var switchQuery = {lastFocusedWindow: true, highlighted: true};
	}
	chrome.windows.getLastFocused({populate: false}, function(focusedWin){
		chrome.tabs.query(switchQuery, function(activeTabArr){
			for (var activeTab in activeTabArr) {
				if (activeTabArr[activeTab].incognito == focusedWin.incognito) {
					indivSwitch(activeTabArr[activeTab], false, false);
				}
			}
			createTab(!focusedWin.incognito);
		});
	});
}

function indivSwitch(tab, forceClose, refocus) {
// Removes cookies and clears browsing history (if the user enabled those
//		options) and queues [tab] (Tab) to be switched. If [forceClose] is
//		set to true, [tab] will be closed even if the user has disabled the
//		option to close the original tab. If [refocus] is set to false,
//		Chrome will bring the window in which the new tab is create into
//		focus.
	if (checkUrl(tab.url)) {
		if ((localStorage["clearSession"] == "yes") && (!tab.incognito)) {
			chrome.cookies.getAll({url: tab.url, session: ((localStorage["clearCookies"] == "yes")?undefined:true)}, function(allCookies){
				for (var cookie in allCookies) {
					chrome.cookies.remove({url: tab.url, name: allCookies[cookie].name, storeId: allCookies[cookie].storeId});
				}
			});
		}
		queuedTabs[!tab.incognito].push({url: tab.url, idToClose: (((localStorage["closeWin"] != "no") || (forceClose))?(tab.id):undefined), refocus: refocus});
		if ((localStorage["clearHist"] == "yes") && (!tab.incognito)) {
			if (localStorage["clearTab"] != "no") {
				if (openTime[tab.id] != undefined) {
					chrome.history.deleteRange({startTime: openTime[tab.id], endTime: new Date().getTime()}, function(){});
				}
				else {
					chrome.history.deleteRange({startTime: defaultOpenTime, endTime: new Date().getTime()}, function(){});
				}
			}
			else {
				chrome.history.deleteUrl({url: tab.url});
			}
		}
	}
}

function closeTab(tabId, incognito) {
// Either sends the tab to [blankPageUrl] (which Chrome will detect and
//		automatically close) so that the tab cannot be reopened, if the
//		user has specified this option, or sends [tabId] to
//		okayImFinallyActuallyReallyClosingTheTabForRealThisTime() to be
//		closed.
	if ((!incognito) && (localStorage["recent"] == "yes")) {
		chrome.tabs.get(tabId, function(theTab){
			chrome.tabs.update(tabId, {url: blankPageUrl});
		});
	}
	else {
		okayImFinallyActuallyReallyClosingTheTabForRealThisTime(tabId);
	}
}

function okayImFinallyActuallyReallyClosingTheTabForRealThisTime(theStupidIdOfTheStupidTab) {
// Closes the tab with the id [theStupidIdOfTheStupidTab] and removes it
//		from the [isClosing] array.
	chrome.tabs.remove(theStupidIdOfTheStupidTab, function(){
		isClosing[theStupidIdOfTheStupidTab] = undefined;
	});
}

function updateMostRecent(incognito, winId, winType) {
// Places [winId] at the beginning of the corresponding [mostRecent] array
//		to specify that it was the most recently used window for its
//		Incognito value ([incognito]). This only applies to "normal" type
//		windows.
	if (winType == "normal") {
		mrInd = mostRecent[incognito].indexOf(winId);
		mostRecent[incognito].unshift(winId);
		if (mrInd != -1) {
			mostRecent[incognito].splice(mrInd, 1);
		}
	}
}

function removeMostRecent(incognito, winId) {
// Removes [winId] from its corresponding [mostRecent] array (based on its
//		Incognito value ([incognito]).
	mrInd = mostRecent[incognito].indexOf(winId);
	if (mrInd != -1) {
		mostRecent[incognito].splice(mrInd, 1);
	}
}

function createTab(incognito) {
// Creates any queued tab(s) one at a time in the [queuedTabs] array that
//		have the same Incognito value as [incognito].
	if (queuedTabs[incognito].length > 0) {
	// If there are any queued tab(s) to create.
		chrome.windows.getAll({populate: false}, function(allWindows){
			mostRecentTemp = mostRecent;
			var noobWindows = {true: [], false: []};
			var trueWins = [];
			var focusedWin = -1;
			for (var w in allWindows) {
				if (mostRecent[allWindows[w].incognito].indexOf(allWindows[w].id) == -1) {
				// If the window wasn't previously detected by the extension and added to the
				//		corresponding [mostRecent] array, put it in the corresponding
				//		[noobWindows] array so that it will be added to the end of the
				//		corresponding [mostRecent] array (instead of the beginning/middle).
					noobWindows[allWindows[w].incognito].push(allWindows[w].id);
				}
				
				if (allWindows[w].focused == true) {
					// This window is in focus.
					focusedWin = allWindows[w].id;
				}
				
				trueWins.push(allWindows[w].id);
			}
			
			for (var i in mostRecentTemp) {
				for (var w in mostRecentTemp[i]) {
					if (trueWins.indexOf(mostRecentTemp[i][w]) == -1) {
						mostRecentTemp[i].splice(w, 1);
					}
				}
			}
						
			// Join the sub-arrays of the [mostRecentTemp] and [noobWindows] arrays, and replace
			//		the contents of the [mostRecent] array with the resulting joined array.
			mostRecentTemp[true] = mostRecentTemp[true].concat(noobWindows[true]);
			mostRecentTemp[false] = mostRecentTemp[false].concat(noobWindows[false]);
			mostRecent = mostRecentTemp;
			
			// If there is an open window with the same Incognito value as [incognito], choose
			//		the most recently used one to open the queued tab(s) in. If not, set [mrWin]
			//		to -1 so that a new window will be created for the tab.
			if (mostRecent[incognito].length > 0) {
				var mrWin = mostRecent[incognito][0];
			}
			else {
				var mrWin = -1;
			}
			
			if ((mrWin != -1) && (localStorage["alwaysNewWin"] != "yes")) {
			// If there is an existing window in which to create the queued tab and if the user
			//		has NOT enabled the option to open all tabs in a new window.
				
				// If the first queuedTab's [refocus] parameter is set to false, bring the window in
				//		which the queued tab will be created into focus. If not, draw attention to the
				//		window (but do not bring it into focus) and pass its details to desktopNotify().
				//		I know this seems backwards, but I haven't gotten around to changing all the
				//		code so that it seems more intuitive.
				if (!queuedTabs[incognito][0].refocus) {
					chrome.windows.update(mrWin, {focused: true});
				}
				else {
					chrome.windows.update(mrWin, {drawAttention: true});
					desktopNotify(mrWin, incognito);
				}
				
				// Actually create the tab in the necessary window.
				chrome.tabs.create({windowId: mrWin, url: queuedTabs[incognito][0].url}, function(createdTab){
					// Set up the tab to be automatically closed if it fits the correct parameters.
					updatedTimes[createdTab.id] = -1;
					autoClose(createdTab);
					
					if (queuedTabs[incognito][0].idToClose != undefined) {
					// If there is a specified tab to close in response to opening the queued tab,
					//		send its details to closeTab() to be closed.
						closeTab(queuedTabs[incognito][0].idToClose, !incognito);
					}
					
					// Remove the queued tab's details from the [queuedTabs] array.
					queuedTabs[incognito].shift();
					
					// Move on to the next queued tab (if there is one).
					createTab(createdTab.incognito);
				});
			}
			else {
				// Create an entirely new window in which to place the tab.
				chrome.windows.create({url: queuedTabs[incognito][0].url,
						        type: "panel",
    height: 400,
    width: 800, incognito: incognito, focused: true}, function(createdWin){
					if (isAllowed){
					// If the extension has been allowed to run in Incognito mode, do the following.
					//		If not, the tab being created is Incognito, because since the extension
					//		cannot run in Incognito mode, the user will not be able to run any
					//		commands to switch the tab to normal mode.
						
						// Set the created window as the most recently used window for its Incognito
						//		value.
						updateMostRecent(createdWin.incognito, createdWin.id, "normal");
						
						// Set up the tab to be automatically closed if it fits the correct parameters.
						updatedTimes[createdWin.tabs[0].id] = -1;
						itTabs[itTabs.length] = createdWin.tabs[0].id;
						autoClose(createdWin.tabs[0]);
						
						if ((queuedTabs[incognito][0].refocus) && (focusedWin != -1)) {
						// If the new window should NOT be brought into focus and if there is a Chrome
						//		window that is already focused, draw attention to the new window and
						//		then bring the previously focused window back into focus.
							
							// If the user has enabled the option to maximize windows created by the
							//		extension, do so. If not, do not do so.
							if (localStorage["maximize"] == "yes") {
								chrome.windows.update(createdWin.id, {drawAttention: true, state: "maximized"});
							}
							else {
								chrome.windows.update(createdWin.id, {drawAttention: true});
							}
							
							// Bring the previously focused window back into focus.
							chrome.windows.update(focusedWin, {focused: true});
							
							// Pass the new window's details to desktopNotify().
							desktopNotify(createdWin.id, incognito);
						}
						else if (localStorage["maximize"] == "yes") {
						// If the new window either SHOULD be brought into focus or cannot help but be
						//		brought into focus (because there is no window to give the focus back
						//		to), simply maximize the window if the user has enabled the option to
						//		maximize windows created by the extension.
							chrome.windows.update(createdWin.id, {state: "maximized"});
						}
					}
					
					if (queuedTabs[incognito][0].idToClose != undefined) {
					// If there is a specified tab to close in response to opening the queued tab,
					//		send its details to closeTab() to be closed.
						closeTab(queuedTabs[incognito][0].idToClose, !incognito);
					}
					
					// Remove the queued tab's details from the [queuedTabs] array.
					queuedTabs[incognito].shift();
					
					// Move on to the next queued tab (if there is one).
					createTab(incognito);
				});
			}
		});
	}
}

function desktopNotify(windowId, incognito) {
// Notify the user that a new tab was opened in [windowId] in the
//		background, and prompt them to switch to that window.
	if (dnWins[windowId] == undefined) {
	// If a notification does not already exist for [windowId].
		dnWins[windowId] = {};
		
		// Create and show the notification. If the user clicks the notification,
		//		switch to the corresponding window and pass its details to cancelDN().
		//		If the user closes the notification, simply pass its details to
		//		cancelDN().
		dnWins[windowId].notif = webkitNotifications.createNotification(chrome.extension.getURL("images/logo/48.png"), "New "+((incognito)?"Incognito":"Non-Incognito")+" Tab", "A new "+((incognito)?"Incognito":"non-Incognito")+" tab was opened in the background. Click here to view it.");
		dnWins[windowId].notif.addEventListener("click", function(){
			chrome.windows.update(windowId, {focused: true});
			cancelDN(windowId);
		});
		dnWins[windowId].notif.addEventListener("close", function(){
			cancelDN(windowId);
		});
		dnWins[windowId].notif.show();
		
		// After 10 seconds, automatically pass the details of the notification
		//		to cancelDN().
		dnWins[windowId].timeout = setTimeout(function(){
			cancelDN(windowId);
		}, 10000);
	}
	else {
	// If a notification already exists for [windowId], reset the notification's
	//		auto-close timer.
		clearTimeout(dnWins[windowId].timeout);
		dnWins[windowId].timeout = setTimeout(function(){
			cancelDN(windowId);
		}, 10000);
	}
}

function cancelDN(windowId) {
// Closes a notification created by desktopNotify().
	if ((dnWins[windowId] != undefined) && (dnWins[windowId].closing != true)) {
	// If there is, in fact, a notification for [windowId] and the notification is
	//		not already closing, close it.
		dnWins[windowId].closing = true;
		dnWins[windowId].notif.cancel();
		clearTimeout(dnWins[windowId].timeout);
		dnWins[windowId] = undefined;
	}
}

function textAvail(valid, callback) {
// Check if certain certain groups of tabs contain enough valid tabs to be
//		switched. "all" means every tab in every window that has the same
//		Incognito value as the last-focused window. "window" means every
//		tab in the last-focused window. "single" means the active tab in
//		the last-focused window. "multiple" (default) means every selected
//		tab in the last-focused window.
	chrome.windows.getLastFocused(function(currentWin){
		if (valid.all) {
			var queryProps = {};
		}
		else if (valid.window) {
			var queryProps = {lastFocusedWindow: true};
		}
		else if (valid.multiple) {
			var queryProps = {lastFocusedWindow: true, highlighted: true};
		}
		else if (valid.single) {
			var queryProps = {lastFocusedWindow: true, active: true};
		}
		else { // Default to "multiple".
			var queryProps = {lastFocusedWindow: true, highlighted: true};
		}
		
		chrome.tabs.query(queryProps, function(selectedTabs) {
			// Initialize the number of tabs that are valid for each scenario.
			var totalUsable = {single: 0, multiple: 0, window: 0, all: 0};
			
			for (var tab in selectedTabs) {
				if ((selectedTabs[tab].incognito == currentWin.incognito) && (checkATab(selectedTabs[tab]))) {
				// If the tab has the same Incognito value as the current window and
				//		passes the checkATab() test.
					totalUsable.all++;
					if (selectedTabs[tab].windowId == currentWin.id) {
						totalUsable.window++;
						if (selectedTabs[tab].highlighted) {
							if (selectedTabs[tab].active) {
								totalUsable.single++;
							}
							else {
								totalUsable.multiple++;
							}
						}
					}
				}
			}
			callback(currentWin.incognito, totalUsable);
		});
	});
}

function setContext(on) {
// Turn the context menu on or off, depending on the user's preference.
	if ((on == true) && (context == undefined)) {
		chrome.tabs.query({lastFocusedWindow: true, active: true}, function(tabArr) {
			context = chrome.contextMenus.create({title: "Incognito This!", enabled: ((tabArr[0] != undefined)?checkUrl(tabArr[0].url):true), onclick: function(cInf, cTab){
				switchTabs("multiple");
			}});
		});
	}
	else if ((on == false) && (context != undefined)) {
		chrome.contextMenus.remove(context);
		context = undefined;
	}
}

function regExUrl(url) {
// Check if a string is a URL with a scheme, a URL without a sheme, or not
//		a URL at all.
	if (/^(https?|ftp|file)\:\/*([a-z0-9+!*(),;?&=\$_.-]+(\:[a-z0-9+!*(),;?&=\$_.-]+)?@)?([a-z0-9-.]*)(\.([a-z]{2,3}))?(\:[0-9]{2,5})?\/?(\/*[a-z0-9\.+\$_-]+)*\/?(\?[a-z+&\$_.-][a-z0-9;:@&%=+\/\$_.-]*)?(#[a-z_.-][a-z0-9+\$_.-]*)?$/i.test(url)) {
		return {url: true, scheme: true};
	}
	else if (/^([a-z0-9+!*(),;?&=\$_.-]+(\:[a-z0-9+!*(),;?&=\$_.-]+)?@)?([a-z0-9-.]*)\.([a-z]{2,3})(\:[0-9]{2,5})?\/?(\/*[a-z0-9\.+\$_-]+)*\/?(\?[a-z+&\$_.-][a-z0-9;:@&%=+\/\$_.-]*)?(#[a-z_.-][a-z0-9+\$_.-]*)?$/i.test(url)) {
		return {url: true, scheme: false};
	}
	else {
		return {url: false, scheme: false};
	}
}

function areYouSure(text) {
// Utilizes the checkIt() function to determine if the text the user typed
//		in the Omnibox can be interpreted to mean that they want to switch
//		a certain group of tabs.
	return {
		single: checkIt([[["this", "that", "tab"]], [["this", "that", "the"], ["tab", "one"]]], text),
		multiple: checkIt([[["these", "those", "them", "tabs"]], [["this", "that", "these", "those", "them", "the"], ["tab", "ones"]]], text),
		window: checkIt([[["window"]], [["this", "that", "the"], ["window"]]], text),
		all: checkIt([[["all", "everythings"]], [["all", "every"], ["tabs", "windows", "things", "these", "those", "them"]], [["all"], ["this", "that", "these", "those", "them", "the"], ["tabs", "windows", "things", "ones"]]], text)
		};
}

// The functions checkWord() and checkIt() are property of Jeremiah Megel
//		under version 3 of the GNU General Public License.

function checkWord(someWords, key, isFinal) {
	for (word in someWords) {
		if (((isFinal) && (levenshtein(key, someWords[word].substr(0, key.length)) <= Math.ceil(key.length * 0.2))) || (levenshtein(someWords[word], key) <= Math.ceil(someWords[word].length * 0.2))) {
			return true;
		}
	}
	return false;
}

function checkIt(rules, text) {
// Checks if [text] is close enough to any of the patterns specified in
//		[rules] to be interpreted as one of the patterns or one of the
//		patterns with a few typos.

//	Pay close attention; I'll try to explain this the best I can. [rules]
//		is an array with "patterns" as its elements. These patterns contain
//		arrays that, in order, specify valid first word(s), valid second
//		word(s), valid third word(s), etc...So if I wanted to check if
//		[text] was close enough to any of the following sentences...
//			- She is blue.
//			- She is red.
//			- He is blue.
//			- He is red.
//			- We are yellow.
//			- You are yellow.
//		You would use the following array as the [rules] parameter:
//			[
//				[	// Begin first pattern.
//					[["she"], ["he"]],	// Potential first words.
//					[["is"]],			// Potential second words.
//					[["blue"], ["red"]]	// Potential third words.
//				],	// End first pattern.
//				[	// Begin second pattern.
//					[["we"], ["you"]],	// Potential first words.
//					[["are"]],			// Potential first words.
//					[["yellow"]]		// Potential first words.
//				]	// End second pattern.
//			]
//		Each word in a pattern can have a Damerau-Levenshtein distance
//			from what it "should be" according to the pattern of up to
//			20% and still be considered valid. This is to correct for
//			typos that the user may make.
//		This function is case-insensitive. Make sure that all words in
//			all patterns are completely lowercase.
//		This function is punctuation-insensitive and will therefore
//			ignore the following characters: .,?!_&+-\/
//		This function treats all whitespace equally.

//		This function ignores the word "incognito" at the beginning of
//			[text].
//		This function treats "all of" at the beginning of [text] as the
//			same as "all".

	var words = text.replace(/[\.,?!_&+\-\\\/]/g, " ").replace(/\s{2,}/g, " ").toLowerCase().trim().split(" ");
	var unqWords = [];
	for (w in words) {
		if ((w == 0) || (!checkWord([words[w - 1]], words[w], (w == (words.length - 1))))) {
			unqWords.push(words[w]);
		}
	}
	if ((unqWords[0].length >= 2) && (checkWord(["incognito"], unqWords[0], (unqWords.length == 1)))) {
		unqWords.splice(0, 1);
	}
	if ((unqWords.length >= 2) && (checkWord(["all"], unqWords[0], false)) && (checkWord(["of"], unqWords[1], true))) {
		unqWords.splice(1, 1);
	}
	if (unqWords.length != 0) {
		for (var r in rules) {
			if (unqWords.length <= rules[r].length) {
				var soFar = false;
				for (var w in unqWords) {
					if (checkWord(rules[r][w], unqWords[w], (w == (unqWords.length - 1)))) {
						soFar = true;
					}
					else {
						soFar = false;
						break;
					}
				}
				if (soFar) {
					return true;
				}
			}
		}
	}
	return false;
}

function levenshtein(a, b) {
	// Taken from http://dzone.com/snippets/javascript-implementation
	// based on:
	// http://en.wikibooks.org/wiki/Algorithm_implementation/Strings/Levenshtein_distance
	// and: http://en.wikipedia.org/wiki/Damerau%E2%80%93Levenshtein_distance
	var i;
	var j;
	var cost;
	var d = [];
	if (a.length == 0) {
		return b.length;
	}
	if (b.length == 0) {
		return a.length;
	}
	for (i = 0; i <= a.length; i++) {
		d[i] = [];
		d[i][0] = i;
	}
	for (j = 0; j <= b.length; j++) {
		d[0][j] = j;
	}
	for (i = 1; i <= a.length; i++) {
		for (j = 1; j <= b.length; j++) {
			if (a.charAt(i - 1) == b.charAt(j - 1)) {
				cost = 0;
			} else {
				cost = 1;
			}
			d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
			if (
			i > 1 && j > 1 && a.charAt(i - 1) == b.charAt(j - 2) && a.charAt(i - 2) == b.charAt(j - 1)) {
				d[i][j] = Math.min(
				d[i][j],
				d[i - 2][j - 2] + cost)
			}
		}
	}
	return d[a.length][b.length];
}
