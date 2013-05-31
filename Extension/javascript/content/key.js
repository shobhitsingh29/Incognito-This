/*
    Copyright Jeremiah Megel and Ben Cunningham 2012-2013
    
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
var keyDefined;
if (keyDefined != true) {
	keyDefined = true;
	var controlDown = false;
	window.addEventListener("keydown", function(e) {
		chrome.extension.sendMessage("autoClose");
		if (e.keyCode == 17) {
			controlDown = true;
		}
		else if ((e.keyCode == 66) && (controlDown)) {
	    	chrome.extension.sendMessage("switchTabs");
		}
	}, false);
	window.addEventListener("keyup", function(e){
		if (e.keyCode == 17) {
			controlDown = false;
		}
	}, false);
	window.addEventListener("mousedown", function(e){
		chrome.extension.sendMessage("autoClose");
	}, false);
}