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
/*
	This script is included in [javascript/background/background.js] and 
		[javascript/visible/options.js].
	This function checks if a URL can be switched to Incognito mode. (No
		URLs of the "chrome://" scheme can be opened in Incognito, except
		for "chrome://newtab".)
*/
function checkUrl(url) {
	if ((url !== undefined) && (url !== null)) {
		return ((url.toLowerCase().indexOf("chrome") != 0) || (url.toLowerCase().substr(0,15) == "chrome://newtab"));
	}
}