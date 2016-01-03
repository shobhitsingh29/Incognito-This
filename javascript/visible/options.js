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
/*
	This script is included in the [html/options/options.html] page. (The
		extension's Options page.)
*/
var suggestionsUl;
window.addEventListener("load", function(){
	// Load the checkUrl() function from the relevant script file.
	var checkUrlScript = document.createElement("script");
	checkUrlScript.id = "checkUrlScript";
	checkUrlScript.src = chrome.extension.getURL("javascript/multipurpose/checkurl.js");
	checkUrlScript.type = "text/javascript";
	document.body.appendChild(checkUrlScript);

	// Load the activity-checking script.
	var keyScript = document.createElement("script");
	keyScript.id = "keyScript";
	keyScript.src = chrome.extension.getURL("javascript/content/key.js");
	keyScript.type = "text/javascript";
	document.body.appendChild(keyScript);

	// Fill the form elements with the user's preferences or the default
	//		preferences if the user has not set a preference, and set
	//		them up to change their respective localStorage values when
	//		changed.
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

	// Check if the extension has been allowed to run in Incognito mode
	//		(through the extension-manager). If not, certain options
	//		that require Incognito access will be disabled with an
	//		explanation at the side.
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

	// Calculate and fill the minute/second fields.
	var autoCloseTime = ((localStorage["autoCloseTime"] != undefined)?localStorage["autoCloseTime"]:600000);
	document.getElementById("autoCloseMin").value = Math.floor((autoCloseTime / 1000) / 60);
	document.getElementById("autoCloseSec").value = ((autoCloseTime / 1000) % 60);

	// Fill the keywords field with the user's preferences, if they exist.
	document.getElementById("autoTerms").value = ((localStorage["autoTerms"] != undefined)?localStorage["autoTerms"]:"");

	// Set up the listener to convert the values from the minute/second
	//		fields to milliseconds and store them in localStorage.
	var numbers = ["autoCloseMin", "autoCloseSec"];
	for ( var n in numbers){
		listenStore(numbers[n], function(){
			localStorage["autoCloseTime"] = ((parseInt(document.getElementById("autoCloseMin").value * 60) + parseInt(document.getElementById("autoCloseSec").value)) * 1000);
		});
	}

	// Set up the listener to display a list of URL suggestions for the
	//		keywords textbox when the user does anything with the
	//		textbox.
	suggestionsUl = document.getElementById("autoTermsContainer").getElementsByTagName("div")[0].getElementsByTagName("ul")[0];
	listenStore("autoTerms", suggest);
	document.getElementById("autoTerms").addEventListener("focus", suggest);

	// If the user clicks outside of the keywords textbox, hide the list
	//		of URL suggestions.
	window.addEventListener("click", function(e){
		if (e.target.id != "autoTerms"){
			clearBookmarks();
		}
	});

	// Once all of the preferences and listeners have been loaded, make the
	//		preferences section visible.
	var preferencesArea = document.getElementById("preferences").getElementsByTagName("div")[0].getElementsByTagName("div")[0];
	preferencesArea.style.visibility = "visible";
	preferencesArea.style.opacity = "1";

	var socialSection = document.getElementById("social").getElementsByTagName("div")[0];

	// Add the Facebook "Like" button.
	var faceBookiFrame = document.createElement("iframe");
	faceBookiFrame.className = "socialButtoniFrame";
	faceBookiFrame.id = "faceBookiFrame";
	faceBookiFrame.src = "https://www.facebook.com/plugins/like.php?href=https%3A%2F%2Fchrome.google.com%2Fwebstore%2Fdetail%2Ficnaplnkjfjncegmphmlfpggildllbho&send=false&layout=box_count&width=47&show_faces=false&action=like&colorscheme=light&font=arial&height=62";
	socialSection.appendChild(faceBookiFrame);

	// Add the Twitter "Tweet" button.
	var twitteriFrame = document.createElement("iframe");
	twitteriFrame.className = "socialButtoniFrame";
	twitteriFrame.id = "twitteriFrame";
	twitteriFrame.src = "https://platform.twitter.com/widgets/tweet_button.html?url=https%3A%2F%2Fchrome.google.com%2Fwebstore%2Fdetail%2Ficnaplnkjfjncegmphmlfpggildllbho&text=Incognito%20This!%20is%20really%20useful%20for%20switching%20between%20private%20and%20normal%20browsing%20in%20Chrome!%20Check%20it%20out!&count=vertical&dnt=false&size=medium";
	socialSection.appendChild(twitteriFrame);

	// Add the Google+ "+1" button.
	var gPlusOne = document.createElement("div");
	gPlusOne.className = "g-plusone";
	gPlusOne.setAttribute("data-size", "tall");
	gPlusOne.setAttribute("data-href", "https://chrome.google.com/webstore/detail/icnaplnkjfjncegmphmlfpggildllbho");
	socialSection.appendChild(gPlusOne);

	// Add the Flattr button.
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

	// Add the PayPal donation button.
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

	// Script required for the Google+ "+1" button.
	(function(){
		var po = document.createElement("script");
		po.type = "text/javascript";
		po.async = true;
		po.src = "https://apis.google.com/js/plusone.js";
		var s = document.getElementsByTagName("script")[0];
		s.parentNode.insertBefore(po, s);
	})();

	// Script required for the Flattr button.
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
	// Fill the [option] (string) checkbox from localStorage, indent any
	//		[subOptions] (array of strings) that are dependent on [option]
	//		and disable them if [option] is unchecked, and add the
	//		listener to change their respective localStorage values and
	//		disable their [subOptions] if their value changes.
	
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
// If [element] has its value changed, if a key is pressed on it, or if it
//		is clicked, fire [action] (function).
	
	var events = ["change", "keyup", "click"];
	for ( var e in events){
		document.getElementById(element).addEventListener(events[e], action);
	}
}

function clearBookmarks(){
// Hide the URL suggestion list.
	
	var newUl = document.createElement("ul");
	document.getElementById("autoTermsContainer").getElementsByTagName("div")[0].getElementsByTagName("div")[0].replaceChild(newUl, suggestionsUl);
	suggestionsUl = newUl;
}

function suggest(){
// Display a list of five suggested URLs to use as keywords in the
//		keywords textbox, compiled from the user's bookmarks and
//		history.
	
	localStorage["autoTerms"] = document.getElementById("autoTerms").value;
	var ul = document.createElement("ul");
	if (document.getElementById("autoTerms").value != ""){
		// Find where the user's cursor is in the textbox, and grab the
		//		value of the text between any potential commas to the
		//		left and right of the cursor.
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
		var searchTerm = atVal.substring(start, end).trim().replace(/^(http|https|ftp|file):\/\//, ""); // Take out any URL scheme for better search results.
		if (searchTerm != ""){
			// Search the user's bookmarks and history for the text and
			//		add results to an array [suggestions] with its URL,
			//		page title, and search origin.
			chrome.bookmarks.search(searchTerm, function(bookmarks){
				chrome.history.search({
					text: searchTerm,
					maxResults: 10
					// I chose to search for 10 history results instead of just 5
					//		in case some of the history results match the bookmark
					//		results.
				}, function(history){
					var marks = 0;
					var suggestions = new Array();
					for ( var b in bookmarks){
						if (suggestions.indexOf(bookmarks[b].url) == -1){
							// Make sure that the URL isn't already in the array.
							
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
						// Make sure that the URL is not exactly what the user typed
						//		and that the URL can be opened in Incognito.
							
							// Create the <li> list item in the suggested URL list. If
							//		the user clicks it, replace the text the user typed
							//		with the URL of the list item.
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
							// Limit the number of list items to 5.
								
								break;
							}
						}
					}
					
					// Replace the already existing [suggestionsUl] element with the [ul]
					//		element that we just created.
					document.getElementById("autoTermsContainer").getElementsByTagName("div")[0].getElementsByTagName("div")[0].replaceChild(ul, suggestionsUl);
					suggestionsUl = ul;
				});
			});
		} else{
		// If the search term is blank, hide the suggestions list.
			clearBookmarks();
		}
	} else{
	// If the entire keywords box is blank, hide the suggestions list.
		clearBookmarks();
	}
}