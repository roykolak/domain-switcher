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

    orderTabsByLastFocus: function(tabs, callback) {
      var out = tabs;
      chrome.storage.local.get('tabMap', function(data) {
        tabs.forEach(function(tab, i) {
          var tabData = data.tabMap[tab.id];
          if(tabData) {
            out[i].lastFocusedAt = new Date(tabData.lastFocusedAt);
          } else {
            out[i].lastFocusedAt = new Date(new Date().getTime() - (1000 * 60 * 60));
          }
        });

        out.sort(function(a,b) {
          if (a.lastFocusedAt.getTime() > b.lastFocusedAt.getTime())
            return -1;
          if (a.lastFocusedAt.getTime() < b.lastFocusedAt.getTime())
            return 1;
          return 0;
        });

        callback(out);
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

    updateBrowserActionIcon: function() {
      chrome.tabs.query({active: true}, function(tabs) {
        if(tabs[0]) {
          var tabId = tabs[0].id;

          chrome.tabs.sendMessage(tabId, {state: true}, function(response) {
            chromeAPI.getSimilarTabsForTab(tabId, function(tabs) {
              var similarTabsCount;

              if(tabs.length > 1) {
                similarTabsCount = tabs.length.toString();
              } else {
                similarTabsCount = 1;
              }

              if(similarTabsCount > 9) {
                similarTabsCount = 10;
              }

              if(typeof(similarTabsCount) !== 'undefined') {
                var path = 'icons/icon38-' + similarTabsCount;

                if(response.isActive) {
                  path = path + '-active'
                }

                path = path + '.png';

                chrome.browserAction.setIcon({
                  path: path,
                  tabId: tabId
                });
              }
            });
          });
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
    },

    updateTabLastFocusedAt: function(tabId) {
      chrome.storage.local.get('tabMap', function(data) {
        if(data.tabMap[tabId]) {
          data.tabMap[tabId].lastFocusedAt = new Date().toISOString();
          chrome.storage.local.set(data);
        }
      });
    },

    rememberTab: function(tabId, options) {
      var updateScreenshot = function(tab, tabMap) {
        if(tabMap[tabId]) {
          chrome.storage.local.remove(tabId + ':' + tabMap[tabId].url);
        }

        tabMap[tabId] = {url: tab.url, lastFocusedAt: new Date().toISOString()};
        chrome.storage.local.set({tabMap: tabMap});

        var tabData = {},
            key = tabId + ':' + tab.url;

        if(!tab.url.includes('chrome://')) {
          chrome.tabs.captureVisibleTab(null, {}, function(image) {
            tabData[key] = {screenshot: image};
            chrome.storage.local.set(tabData);
          });
        } else {
          tabData[key] = {screenshot: null};
          chrome.storage.local.set(tabData);
        }
      };

      chrome.tabs.get(tabId, function(tab) {
        chrome.storage.local.get('tabMap', function(data) {
          if(options && options.override) {
            updateScreenshot(tab, data.tabMap);
          } else {
            var key = tabId + ':' + tab.url;
            chrome.storage.local.get(key, function(screenshotData) {
              if(screenshotData[key]) {
                // Nothing because we found a screenshot for this specific tab
                // on this specific site.
              } else {
                // Take a screenshot because this combination of tab id and url
                // does not currently exist in storage.
                updateScreenshot(tab, data.tabMap);
              }
            })
          }
        });
      });
    }
  };
})();
