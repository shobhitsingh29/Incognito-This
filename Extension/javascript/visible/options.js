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
var suggestionsUl;
window.addEventListener("load", function(){
	var checkUrlScript = document.createElement("script");
	checkUrlScript.id = "checkUrlScript";
	checkUrlScript.src = chrome.extension.getURL("javascript/multipurpose/checkurl.js");
	checkUrlScript.type = "text/javascript";
	document.body.appendChild(checkUrlScript);

	var keyScript = document.createElement("script");
	keyScript.id = "keyScript";
	keyScript.src = chrome.extension.getURL("javascript/content/key.js");
	keyScript.type = "text/javascript";
	document.body.appendChild(keyScript);

	setUp("closeWin");
	setUp("alwaysNewWin");
	setUp("recent", []);
	setUp("clearHist", ["clearTab"]);
	setUp("clearTab", []);
	setUp("clearSession", ["clearCookies"]);
	setUp("clearCookies", []);
	setUp("useKey", []);
	setUp("useContext", []);
	setUp("doubleClick", []);
	setUp("maximize", []);
	setUp("autoClose", ["autoCloseMin", "autoCloseSec", "autoCloseAll"]);
	setUp("autoCloseAll", []);
	setUp("autoIncog", ["autoTerms"]);
	document.getElementById("useContext").addEventListener("change", function(){
		chrome.extension.sendMessage("context");
	});
	document.getElementById("autoIncog").addEventListener("change", function(){
		if (document.getElementById("autoIncog").checked){
			document.getElementById("autoTerms").focus();
		}
	});

	chrome.extension.isAllowedIncognitoAccess(function(hasIncognitoAccess){
		if (!(hasIncognitoAccess)){
			var incogAccessNeededInputs = document.getElementsByClassName("incogAccessNeededInput");
			for (var inp in incogAccessNeededInputs) {
				incogAccessNeededInputs[inp].disabled = true;
			}
			var incogAccessNeededDivs = document.getElementsByClassName("incogAccessNeededDiv");
			var accessNeededNotice;
			for (var div in incogAccessNeededDivs) {
				if (typeof(incogAccessNeededDivs[div]) == "object") {
					incogAccessNeededDivs[div].className += " noIncogAccess";
					accessNeededNotice = document.createElement("label");
					accessNeededNotice.className = "accessNeededNotice";
					accessNeededNotice.setAttribute("for", incogAccessNeededDivs[div].parentNode.getElementsByTagName("header")[0].getElementsByTagName("input")[0].id);
					accessNeededNotice.innerHTML = "(Please allow the extension to run in Incognito to enable this feature. [See FAQ below.])";
					incogAccessNeededDivs[div].appendChild(accessNeededNotice);
				}
			}
		}
	});

	var autoCloseTime = ((localStorage["autoCloseTime"] != undefined)?localStorage["autoCloseTime"]:600000);
	document.getElementById("autoCloseMin").value = Math.floor((autoCloseTime / 1000) / 60);
	document.getElementById("autoCloseSec").value = ((autoCloseTime / 1000) % 60);

	document.getElementById("autoTerms").value = ((localStorage["autoTerms"] != undefined)?localStorage["autoTerms"]:"");

	var numbers = ["autoCloseMin", "autoCloseSec"];
	for ( var n in numbers){
		listenStore(numbers[n], function(){
			localStorage["autoCloseTime"] = ((parseInt(document.getElementById("autoCloseMin").value * 60) + parseInt(document.getElementById("autoCloseSec").value)) * 1000);
		});
	}

	suggestionsUl = document.getElementById("autoTermsContainer").getElementsByTagName("div")[0].getElementsByTagName("ul")[0];
	listenStore("autoTerms", suggest);
	document.getElementById("autoTerms").addEventListener("focus", suggest);

	window.addEventListener("click", function(e){
		if (e.target.id != "autoTerms"){
			clearBookmarks();
		}
	});

	var preferencesArea = document.getElementById("preferences").getElementsByTagName("div")[0].getElementsByTagName("div")[0];
	preferencesArea.style.visibility = "visible";
	preferencesArea.style.opacity = "1";

	var socialSection = document.getElementById("social").getElementsByTagName("div")[0];

	var faceBookiFrame = document.createElement("iframe");
	faceBookiFrame.className = "socialButtoniFrame";
	faceBookiFrame.id = "faceBookiFrame";
	faceBookiFrame.src = "https://www.facebook.com/plugins/like.php?href=https%3A%2F%2Fchrome.google.com%2Fwebstore%2Fdetail%2Ficnaplnkjfjncegmphmlfpggildllbho&send=false&layout=box_count&width=47&show_faces=false&action=like&colorscheme=light&font=arial&height=62";
	socialSection.appendChild(faceBookiFrame);

	var twitteriFrame = document.createElement("iframe");
	twitteriFrame.className = "socialButtoniFrame";
	twitteriFrame.id = "twitteriFrame";
	twitteriFrame.src = "https://platform.twitter.com/widgets/tweet_button.html?url=https%3A%2F%2Fchrome.google.com%2Fwebstore%2Fdetail%2Ficnaplnkjfjncegmphmlfpggildllbho&text=Incognito%20This!%20is%20really%20useful%20for%20switching%20between%20private%20and%20normal%20browsing%20in%20Chrome!%20Check%20it%20out!&count=vertical&dnt=false&size=medium";
	socialSection.appendChild(twitteriFrame);

	var gPlusOne = document.createElement("div");
	gPlusOne.className = "g-plusone";
	gPlusOne.setAttribute("data-size", "tall");
	gPlusOne.setAttribute("data-href", "https://chrome.google.com/webstore/detail/icnaplnkjfjncegmphmlfpggildllbho");
	socialSection.appendChild(gPlusOne);

	var flattrButton = document.createElement("a");
	flattrButton.className = "FlattrButton";
	flattrButton.href = "http://goo.gl/WxDzR";
	flattrButton.style.display = "none";
	var flattrNoScript = document.createElement("noscript");
	var flattrNoScriptA = document.createElement("a");
	flattrNoScriptA.href = "https://flattr.com/thing/619256/Incognito-This";
	flattrNoScriptA.target = "_blank";
	var flattrImg = document.createElement("img");
	flattrImg.src = "https://api.flattr.com/button/flattr-badge-large.png";
	flattrImg.alt = "Flattr this";
	flattrImg.title = "Flattr this";
	flattrImg.style.border = "0";
	flattrNoScriptA.appendChild(flattrImg);
	flattrNoScript.appendChild(flattrNoScriptA);
	socialSection.appendChild(flattrButton);
	socialSection.appendChild(flattrNoScript);

	var payPalForm = document.createElement("form");
	payPalForm.action = "https://www.paypal.com/cgi-bin/webscr";
	payPalForm.method = "post";
	payPalForm.target = "_blank";
	var payPalCmd = document.createElement("input");
	payPalCmd.name = "cmd";
	payPalCmd.type = "hidden";
	payPalCmd.value = "_s-xclick";
	var payPalEncrypted = document.createElement("input");
	payPalEncrypted.name = "encrypted";
	payPalEncrypted.type = "hidden";
	payPalEncrypted.value = "-----BEGIN PKCS7-----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-----END PKCS7-----";
	var payPalSubmit = document.createElement("input");
	payPalSubmit.alt = "PayPal - The safer, easier way to pay online!";
	payPalSubmit.name = "submit";
	payPalSubmit.src = "https://www.paypalobjects.com/en_US/i/btn/btn_donate_LG.gif";
	payPalSubmit.style.border = "0";
	payPalSubmit.type = "image";
	var payPalImg = document.createElement("img");
	payPalImg.alt = "";
	payPalImg.src = "https://www.paypalobjects.com/en_US/i/scr/pixel.gif";
	payPalImg.style.border = "0";
	payPalImg.style.height = "1px";
	payPalImg.style.width = "1px";
	payPalForm.appendChild(payPalCmd);
	payPalForm.appendChild(payPalEncrypted);
	payPalForm.appendChild(payPalSubmit);
	payPalForm.appendChild(payPalImg);
	socialSection.appendChild(payPalForm);

	(function(){
		var po = document.createElement("script");
		po.type = "text/javascript";
		po.async = true;
		po.src = "https://apis.google.com/js/plusone.js";
		var s = document.getElementsByTagName("script")[0];
		s.parentNode.insertBefore(po, s);
	})();

	/* <![CDATA[ */
	(function(){
		var s = document.createElement("script"), t = document.getElementsByTagName("script")[0];
		s.type = "text/javascript";
		s.async = true;
		s.src = "https://api.flattr.com/js/0.6/load.js?mode=auto";
		t.parentNode.insertBefore(s, t);
	})();
	/* ]]> */
});
function setUp(option, subOptions){
	if (localStorage[option] == (( !(document.getElementById(option).checked))?"yes":"no")){
		document.getElementById(option).checked = !(document.getElementById(option).checked);
	}
	if (subOptions != null){
		for ( var opt in subOptions){
			document.getElementById(subOptions[opt]).disabled = !document.getElementById(option).checked;
			if ((document.getElementById(subOptions[opt]).parentNode.parentNode.getElementsByTagName("input")[0] != undefined) && (document.getElementById(subOptions[opt]).parentNode.parentNode.getElementsByTagName("input")[0].id != option)) {
				document.getElementById(subOptions[opt]).parentNode.parentNode.className = "indented";
			}
		}
	}
	document.getElementById(option).addEventListener("change", function(){
		localStorage[option] = ((document.getElementById(option).checked)?"yes":"no");
		for ( var opt in subOptions){
			document.getElementById(subOptions[opt]).disabled = !(document.getElementById(option).checked);
		}
	});
}
function listenStore(element, action){
	var events = ["change", "keyup", "click"];
	for ( var e in events){
		document.getElementById(element).addEventListener(events[e], action);
	}
}
function clearBookmarks(){
	var newUl = document.createElement("ul");
	document.getElementById("autoTermsContainer").getElementsByTagName("div")[0].getElementsByTagName("div")[0].replaceChild(newUl, suggestionsUl);
	suggestionsUl = newUl;
}
function suggest(){
	localStorage["autoTerms"] = document.getElementById("autoTerms").value;
	var ul = document.createElement("ul");
	if (document.getElementById("autoTerms").value != ""){
		var atVal = document.getElementById("autoTerms").value;
		var atPos = document.getElementById("autoTerms").selectionStart;
		var start = atVal.lastIndexOf(",", (atPos - 1));
		if (start == -1){
			start = 0;
		} else if (atPos != 0){
			start++;
		}
		var end = atVal.indexOf(",", atPos);
		if (end == -1){
			end = undefined;
		}
		var searchTerm = atVal.substring(start, end).trim().replace(/^(http|https|ftp|file):\/\//, "");
		if (searchTerm != ""){
			chrome.bookmarks.search(searchTerm, function(bookmarks){
				chrome.history.search({
					text: searchTerm,
					maxResults: 10
				}, function(history){
					var marks = 0;
					var suggestions = new Array();
					for ( var b in bookmarks){
						if (suggestions.indexOf(bookmarks[b].url) == -1){
							suggestions.push({
								url: bookmarks[b].url,
								title: bookmarks[b].title,
								origin: "bookmark"
							});
						}
					}
					for ( var h in history){
						if (suggestions.indexOf(history[h].url) == -1){
							suggestions.push({
								url: history[h].url,
								title: history[h].title,
								origin: "history"
							});
						}
					}
					for ( var s in suggestions){
						if ((suggestions[s].url != atVal.substring(start, end).trim()) & (checkUrl(suggestions[s].url))){
							marks++;
							var li = document.createElement("li");
							var header = document.createElement("header");
							if (suggestions[s].origin == "bookmark"){
								header.innerHTML = "☆";
							} else{
								header.innerHTML = "⌚";
							}
							li.appendChild(header);
							var strong = document.createElement("strong");
							if (suggestions[s].title != ""){
								strong.innerHTML = suggestions[s].title + ":";
								li.appendChild(strong);
								li.innerHTML += " ";
							}
							li.innerHTML += suggestions[s].url;
							li.title = suggestions[s].url;
							li.addEventListener("mouseup", (function(replaceText){
								return function(e){
									document.getElementById("autoTerms").value = replaceText;
									suggest();
								};
							})(atVal.substring(0, start) + suggestions[s].url + ((end != undefined)?atVal.substring(end):"")));
							ul.appendChild(li);
							if (marks >= 5){
								break;
							}
						}
					}
					document.getElementById("autoTermsContainer").getElementsByTagName("div")[0].getElementsByTagName("div")[0].replaceChild(ul, suggestionsUl);
					suggestionsUl = ul;
				});
			});
		} else{
			clearBookmarks();
		}
	} else{
		clearBookmarks();
	}
}