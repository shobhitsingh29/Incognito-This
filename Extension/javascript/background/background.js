/*
    Copyright Jeremiah Megel and Benjamin Cunningham 2012-2013
    
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
chrome.extension.isAllowedIncognitoAccess(function(isIt){
	isAllowed = isIt;
});
var context;
if (localStorage["useContext"] == "yes") {
	setContext(true);
}
startAutoClose();
chrome.browserAction.onClicked.addListener(function(clickedTab){
	if (localStorage["doubleClick"] != "yes") {
		switchTabs("multiple");
	}
	else {
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
chrome.tabs.onCreated.addListener(function(newTab){
	ignoredTabs[newTab.id] = newTab.incognito;
	autoClose(newTab);
});
chrome.tabs.onUpdated.addListener(function(updatedTabId, updatedInfo, updatedTab){
	checkAnyTab(updatedTab);
	autoClose(updatedTab);
});
chrome.tabs.onRemoved.addListener(function(removedTabId, removedTabInfo){
	if ((updatedTimes[removedTabId] != undefined) && (updatedTimes[removedTabId] != null)) {
		clearTimeout(updatedTimes[removedTabId]);
		updatedTimes[removedTabId] = null;
	}
});
chrome.windows.onFocusChanged.addListener(function(incogWinId){
	if (incogWinId >= 0) {
		chrome.windows.get(incogWinId, {populate: false}, function(mrWin){
			updateMostRecent(mrWin.incognito, mrWin.id);
		});
	}
	if (incogWinId != chrome.windows.WINDOW_ID_NONE) {
		chrome.tabs.query({windowId: incogWinId, active: true}, function(activeTabs){
			for (var activeTab in activeTabs) {
				updateMostRecent(activeTabs[activeTab].incognito, incogWinId);
				checkAnyTab(activeTabs[activeTab]);
			}
		});
	}
	cancelDN(incogWinId);
});
chrome.windows.onRemoved.addListener(function(winId){
	if (mostRecent[true].indexOf(winId) != -1) {
		removeMostRecent(true, winId);
	}
	else if (mostRecent[false].indexOf(winId) != -1) {
		removeMostRecent(false, winId);
	}
	cancelDN(winId);
});
chrome.extension.onMessage.addListener(function(request, sender, respond){
	if ((request == "switchTabs") && (localStorage["useKey"] == "yes")) {
		switchTabs("multiple");
	}
	else if (request == "autoClose") {
		autoClose(sender.tab);
	}
	else if (request == "autoCloseAll") {
		startAutoClose();
	}
	else if (request == "context") {
		setContext(localStorage["useContext"]=="yes");
	}
});
chrome.tabs.onActivated.addListener(function(activeInfo){
	chrome.tabs.get(activeInfo.tabId, function(itsATab){
		checkAnyTab(itsATab);
	});
});
chrome.omnibox.onInputChanged.addListener(function(omniText, suggest){
	var switchType = areYouSure(omniText);
	textAvail(switchType, function(incognito, totalUsable) {
		chrome.bookmarks.search(omniText, function(bookmarks){
			chrome.history.search({text: omniText, maxResults: 10}, function(history){
				var suggestions = [];
				if (totalUsable.all > 0) {
					if (totalUsable.window > 0) {
						if ((switchType.single) && (totalUsable.single > 0)) {
							suggestions.push({content: "tab ", description: ((!incognito)?"":"De-") + "Incognito this tab!"});
						}
						if ((switchType.multiple) && (((totalUsable.multiple + totalUsable.single) > 0) || (!switchType.single))) {
							suggestions.push({content: ((totalUsable.multiple > 0)?"tabs ":"tab "), description: ((!(incognito))?"":"De-") + "Incognito " + ((totalUsable.multiple > 0)?"these tabs":"this tab") + "!"});
						}
						if (switchType.window) {
							suggestions.push({content: "window ", description: ((!incognito)?"":"De-") + "Incognito this window!"});
						}
					}
					if (switchType.all) {
						suggestions.push({content: "all ", description: ((!incognito)?"":"De-") + "Incognito all tabs!"});
					}
				}
				if (checkIt([[["options", "preferences", "settings"]]], omniText)) {
					suggestions.push({content: "options ", description: "⚙ Options"});
				}
				if (checkIt([[["faq", "information"]], [["frequently"], ["asked"], ["questions"]]], omniText)) {
					suggestions.push({content: "faq ", description: "؟ Frequently Asked Questions"});
				}
				if (omniText != "") {
					var reu = regExUrl(omniText);
					if (reu.url) {
						if ((reu.scheme) && (checkUrl(omniText))) {
							suggestions.push({content: omniText + " ", description: "Open \""+omniText+"\" in " + ((!incognito)?"an Incognito":"a normal") + " window."});
						}
						else {
							suggestions.push({content: "http://" + omniText + " ", description: "Open \"http://" + omniText + "\" in " + ((!incognito)?"an Incognito":"a normal") + " window."});
						}
					}
					suggestions.push({content: "https://www.google.com/#q=" + encodeURIComponent(omniText) + " ", description: "Google \"" + omniText.replace(/&/g, "&amp;") + "\" in " + ((!incognito)?"an Incognito":"a normal") + " window."});
					for (b in bookmarks) {
						if (checkUrl(bookmarks[b].url)) {
							suggestions.push({content: bookmarks[b].url + " ", description: "☆ Open "+((bookmarks[b].title != "")?("\"" + bookmarks[b].title.replace(/&/g, "&amp;") + "\" (<url>" + bookmarks[b].url.replace(/&/g, "&amp;") + "</url>)"):("<url>" + bookmarks[b].url.replace(/&/g, "&amp;") + "</url>"))+" in " + ((!incognito)?"an Incognito":"a normal") + " window."});
						}
					}
					for (h in history) {
						if (checkUrl(history[h].url)) {
							suggestions.push({content: history[h].url + " ", description: "⌚ Open "+((history[h].title != "")?("\"" + history[h].title.replace(/&/g, "&amp;") + "\" (<url>" + history[h].url.replace(/&/g, "&amp;") + "</url>)"):("<url>" + history[h].url.replace(/&/g, "&amp;") + "</url>"))+" in " + ((!incognito)?"an Incognito":"a normal") + " window."});
						}
					}
				}
				suggest(suggestions);
			});
		});
	});
});
chrome.omnibox.onInputEntered.addListener(function(omniText){
	omniText = omniText.trim();
	var switchType = areYouSure(omniText);
	textAvail(switchType, function(incognito, totalUsable) {
		if ((switchType.single) && (totalUsable.single > 0)) {
			switchTabs("single");
		}
		else if ((switchType.multiple) && (totalUsable.multiple > 0)) {
			switchTabs("multiple");
		}
		else if ((switchType.window) && (totalUsable.window > 0)) {
			switchTabs("window");
		}
		else if ((switchType.all) && (totalUsable.all > 0)) {
			switchTabs("all");
		}
		else {
			chrome.tabs.query({lastFocusedWindow: true, active: true}, function(tabInUse){
				var newTabId = null;
				if (tabInUse[0].url.replace(/\/$/, "") == "chrome://newtab") {
					newTabId = tabInUse[0].id;
				}
				if (checkIt([[["options", "preferences", "settings"]]], omniText)) {
					queuedTabs[false].push({url: chrome.extension.getURL("html/options.html"), idToClose: newTabId});
					createTab(incognito);
				}
				else if (checkIt([[["faq", "information"]], [["frequently"], ["asked"], ["questions"]]], omniText)) {
					queuedTabs[false].push({url: chrome.extension.getURL("html/options.html#faq"), idToClose: newTabId});
					createTab(incognito);
				}
				else {
					chrome.windows.getLastFocused(function(currentWin){
						var reu = regExUrl(omniText);
						if ((reu.scheme) && (checkUrl(omniText))) {
							queuedTabs[!incognito].push({url: omniText, idToClose: newTabId});
						}
						else if (reu.url) {
							queuedTabs[!incognito].push({url: "http://" + omniText, idToClose: newTabId});
						}
						else {
							queuedTabs[!incognito].push({url: "https://www.google.com/#q=" + encodeURIComponent(omniText), idToClose: newTabId});
						}
						createTab(!incognito);
					});
				}
			});
		}
	});
});
chrome.browserAction.setBadgeBackgroundColor({color: [255, 0, 0, 64]});
chrome.windows.getAll({populate: true}, function(allWins){
	for (var win in allWins) {
		for (var winTab in allWins[win].tabs) {
			checkAnyTab(allWins[win].tabs[winTab]);
		}
	}
});
chrome.webRequest.onBeforeRequest.addListener(
	function(details){
		if ((isAuto(details.url)) && (isClosing[details.tabId] == undefined)) {
			if (!ignoredTabs[details.tabId]) {
				chrome.tabs.get(details.tabId, function(someTab){
					doTheAutoThing(someTab);
				});
				if (localStorage["recent"] == "yes") {
					return {redirectUrl: blankPageUrl};
				}
				else {
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
	if ((checkUrl(someUrl)) && (localStorage["autoIncog"] == "yes") && (localStorage["autoTerms"] != undefined)) {
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
	isClosing[someTab.id] = true;
	chrome.windows.getLastFocused({}, function(potentialWin){
		if ((potentialWin.focused) && (someTab.windowId == potentialWin.id) && (someTab.active)) {
			indivSwitch(someTab, true, false);
		}
		else {
			indivSwitch(someTab, true, true);
		}
		createTab(!someTab.incognito);
	});
}
function checkATab(someTab) {
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
	if ((localStorage["autoClose"] == "yes") && ((localStorage["autoCloseAll"] != "no") || (itTabs.indexOf(tabIdToClose) != -1)) && ((updatedTimes[tabIdToClose] != undefined) && (updatedTimes[tabIdToClose] != null))) {
		closeTab(tabIdToClose, incognito);
	}
}
function switchTabs(group) {
	if (group == "all") {
		var switchQuery = {};
	}
	else if (group == "window") {
		var switchQuery = {lastFocusedWindow: true};
	}
	else if (group == "single") {
		var switchQuery = {lastFocusedWindow: true, active: true};
	}
	else {
		var switchQuery = {lastFocusedWindow: true, highlighted: true};
	}
	chrome.tabs.query(switchQuery, function(activeTabArr){
		for (var activeTab in activeTabArr) {
			indivSwitch(activeTabArr[activeTab], false, false);
		}
		createTab(!activeTabArr[activeTab].incognito);
	});
}
function indivSwitch(tab, forceClose, refocus) {
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
	chrome.tabs.remove(theStupidIdOfTheStupidTab, function(){
		isClosing[theStupidIdOfTheStupidTab] = undefined;
	});
}
function updateMostRecent(incognito, winId) {
	mrInd = mostRecent[incognito].indexOf(winId);
	mostRecent[incognito].unshift(winId);
	if (mrInd != -1) {
		mostRecent[incognito].splice(mrInd, 1);
	}
}
function removeMostRecent(incognito, winId) {
	mrInd = mostRecent[incognito].indexOf(winId);
	if (mrInd != -1) {
		mostRecent[incognito].splice(mrInd, 1);
	}
}
function createTab(incognito) {
	if (queuedTabs[incognito].length > 0) {
		chrome.windows.getAll({populate: false}, function(allWindows){
			mostRecentTemp = {true: [], false: []};
			var noobWindows = {true: [], false: []};
			var focusedWin = -1;
			for (var w in allWindows) {
				if (mostRecentTemp[allWindows[w].incognito].indexOf(allWindows[w].id) != -1) {
					mostRecentTemp[allWindows[w].incognito].push(allWindows[w].id);
				}
				else {
					noobWindows[allWindows[w].incognito].push(allWindows[w].id);
				}
				if (allWindows[w].focused == true) {
					focusedWin = allWindows[w].id;
				}
			}
			mostRecentTemp[true] = mostRecentTemp[true].concat(noobWindows[true]);
			mostRecentTemp[false] = mostRecentTemp[false].concat(noobWindows[false]);
			mostRecent = mostRecentTemp;
			if (mostRecent[incognito].length > 0) {
				var mrWin = mostRecent[incognito][0];
			}
			else {
				var mrWin = -1;
			}
			if ((mrWin != -1) && (localStorage["alwaysNewWin"] != "yes")) {
				if (!queuedTabs[incognito][0].refocus) {
					chrome.windows.update(mrWin, {focused: true});
				}
				else {
					chrome.windows.update(mrWin, {drawAttention: true});
					desktopNotify(mrWin, incognito);
				}
				chrome.tabs.create({windowId: mrWin, url: queuedTabs[incognito][0].url}, function(createdTab){
					updatedTimes[createdTab.id] = -1;
					autoClose(createdTab);
					if (queuedTabs[incognito][0].idToClose != undefined) {
						closeTab(queuedTabs[incognito][0].idToClose, !incognito);
					}
					queuedTabs[incognito].shift();
					createTab(createdTab.incognito);
				});
			}
			else {
				chrome.windows.create({url: queuedTabs[incognito][0].url, type: "normal", incognito: incognito, focused: true}, function(createdWin){
					if (isAllowed){
						updateMostRecent(createdWin.incognito, createdWin.id);
						updatedTimes[createdWin.tabs[0].id] = -1;
						itTabs[itTabs.length] = createdWin.tabs[0].id;
						autoClose(createdWin.tabs[0]);
						if ((isAllowed) && (queuedTabs[incognito][0].refocus) && (focusedWin != -1)) {
							if (localStorage["maximize"] == "yes") {
								chrome.windows.update(createdWin.id, {drawAttention: true, state: "maximized"});
							}
							else {
								chrome.windows.update(createdWin.id, {drawAttention: true});
							}
							chrome.windows.update(focusedWin, {focused: true});
							desktopNotify(createdWin.id, incognito);
						}
						else if (localStorage["maximize"] == "yes") {
							chrome.windows.update(createdWin.id, {state: "maximized"});
						}
					}
					if (queuedTabs[incognito][0].idToClose != undefined) {
						closeTab(queuedTabs[incognito][0].idToClose, !incognito);
					}
					queuedTabs[incognito].shift();
					createTab(incognito);
				});
			}
		});
	}
}
function desktopNotify(windowId, incognito) {
	if (dnWins[windowId] == undefined) {
		dnWins[windowId] = {};
		dnWins[windowId].notif = webkitNotifications.createNotification(chrome.extension.getURL("images/logo/48.png"), "New "+((incognito)?"Incognito":"Non-Incognito")+" Tab", "A new "+((incognito)?"Incognito":"non-Incognito")+" tab was opened in the background. Click here to view it.");
		dnWins[windowId].notif.addEventListener("click", function(){
			chrome.windows.update(windowId, {focused: true});
			cancelDN(windowId);
		});
		dnWins[windowId].notif.addEventListener("close", function(){
			cancelDN(windowId);
		});
		dnWins[windowId].notif.show();
		dnWins[windowId].timeout = setTimeout(function(){
			cancelDN(windowId);
		}, 10000);
	}
	else {
		clearTimeout(dnWins[windowId].timeout);
		dnWins[windowId].timeout = setTimeout(function(){
			cancelDN(windowId);
		}, 10000);
	}
}
function cancelDN(windowId) {
	if ((dnWins[windowId] != undefined) && (dnWins[windowId].closing != true)) {
		dnWins[windowId].closing = true;
		dnWins[windowId].notif.cancel();
		clearTimeout(dnWins[windowId].timeout);
		dnWins[windowId] = undefined;
	}
}
function textAvail(valid, callback) {
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
		else {
			var queryProps = {lastFocusedWindow: true, highlighted: true};
		}
		chrome.tabs.query(queryProps, function(selectedTabs) {
			var totalUsable = {single: 0, multiple: 0, window: 0, all: 0};
			for (var tab in selectedTabs) {
				if ((selectedTabs[tab].incognito == currentWin.incognito) && (checkATab(selectedTabs[tab]))) {
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
	return {
		single: checkIt([[["this", "that", "tab"]], [["this", "that", "the"], ["tab", "one"]]], text),
		multiple: checkIt([[["these", "those", "them", "tabs"]], [["this", "that", "these", "those", "them", "the"], ["tab", "ones"]]], text),
		window: checkIt([[["window"]], [["this", "that", "the"], ["window"]]], text),
		all: checkIt([[["all", "everythings"]], [["all", "every"], ["tabs", "windows", "things", "these", "those", "them"]], [["all"], ["this", "that", "these", "those", "them", "the"], ["tabs", "windows", "things", "ones"]]], text)
		};
}
function checkWord(someWords, key, isFinal) {
	for (word in someWords) {
		if (((isFinal) && (levenshtein(key, someWords[word].substr(0, key.length)) <= Math.ceil(key.length * 0.2))) || (levenshtein(someWords[word], key) <= Math.ceil(someWords[word].length * 0.2))) {
			return true;
		}
	}
	return false;
}
function checkIt(rules, text) {
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