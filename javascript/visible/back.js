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
	This listener is included in the [html/back.html] page. If the user
		enables the "Block tabs closed by Incognito This! from being
		reopened, and hide them from the "Recently Closed" list."
		option and then switches a tab to Incognito, the extension will
		redirect the original, non-Incognito tab to blank.html and then
		close it. When someone tries to reopen this tab, Incognito This!
		will close it immediately. If, however, the user disables this
		option and then tries to reopen the tab, this listener will fire,
		sending the user back to the original content of the tab.
*/
chrome.extension.onMessage.addListener(function(request, sender, respond){
	if (request == "back") {
		window.history.back();
	}
});