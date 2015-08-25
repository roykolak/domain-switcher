var ChromeAPI;

(function() {
  ChromeAPI = function() {}

  ChromeAPI.prototype = {
    getTabsForDomain: function(domain, callback) {
      var index = 0,
          filteredTabs = [];

      chrome.windows.getAll(function(windows) {
        windows.forEach(function(window) {
          chrome.tabs.query({windowId: window.id}, function(tabs) {
            index = index + 1;

            var foundTabs = tabs.filter(function(tab) {
              return tab.url.includes(domain);
            });

            filteredTabs = filteredTabs.concat(foundTabs);

            if(windows.length == index) {
              callback(filteredTabs);
            }
          });
        });
      });
    },

    getSimilarTabsForTab: function(tabId, callback) {
      chrome.tabs.get(tabId, function(tab) {
        var hostname = tab.url.match(/\w+:\/\/(.*?)\//)[0];
        this.getTabsForDomain(hostname, callback);
      }.bind(this));
    },

    highlightTab: function(tabId) {
      chrome.tabs.get(tabId, function(tab) {
        chrome.tabs.highlight({
          tabs: tab.index,
          windowId: tab.windowId
        });
      });
    },

    sendMessageToActiveTab: function(data) {
      chrome.tabs.query({active: true}, function(tabs) {
        if(tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, data, function(response) {});
        }
      });
    },

    requestFile: function(file, callback) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', chrome.extension.getURL(file), true);
      xhr.onload = function(e) {
        callback(this.status, this.response);
      };
      xhr.send();
    }
  };
})();
