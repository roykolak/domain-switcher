chrome.runtime.onInstalled.addListener(function() {
  chrome.manifest = chrome.app.getDetails();

  chrome.storage.local.set({
    tabMap: {}
  });

  var injectScript = function (tab) {
    chrome.tabs.executeScript(tab.id, {
      file: chrome.manifest.content_scripts[0].js[0]
    });
  }

  chrome.tabs.query({}, function(tabs) {
    tabs.forEach(function(tab) {
      if(!tab.url.includes('chrome://')) {
        injectScript(tab);
      }
    });
  });
});

chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
  switch(request.cmd) {
    case "read_index":
      var xhr = new XMLHttpRequest();
      xhr.open('GET', chrome.extension.getURL("index.html"), true);
      xhr.onload = function(e) {
        if (this.status == 200) {
          sendResponse(this.response);
        }
      };
      xhr.send();
      break;

    case "read_template":
      var filteredTabs = [];

      var buildAndSendResponse = function() {
        chrome.storage.local.get(request.hostname, function(data) {
          var xhr = new XMLHttpRequest();
          xhr.open('GET', chrome.extension.getURL("template.html"), true);

          xhr.onload = function(e) {
            if (this.status == 200) {
              var template = Handlebars.compile(this.response);
              sendResponse(template({
                root: 'chrome-extension://' + chrome.runtime.id,
                items: filteredTabs,
                visits: data[request.hostname] || []
              }));
            }
          };

          xhr.send();
        });
      };

      var index = 0;
      chrome.windows.getAll(function(windows) {
        windows.forEach(function(window) {
          chrome.tabs.query({windowId: window.id}, function(tabs) {
            index = index + 1;

            var foundTabs = tabs.filter(function(tab) {
              return tab.url.includes(request.hostname);
            });
            filteredTabs = filteredTabs.concat(foundTabs);

            if(windows.length == index) {
              buildAndSendResponse();
            }
          });
        });


      });
      break;

    case "read_screenshot":
      var key = request.tabId + ':' + request.url;
      chrome.storage.local.get(key, function(data) {
        sendResponse(data[key].screenshot);
      });
      break;

    case "highlight_tab":
      chrome.tabs.get(request.tabId, function(tab) {
        chrome.tabs.highlight({
          tabs: tab.index,
          windowId: tab.windowId
        });
      });
      break;
    }
});

chrome.commands.onCommand.addListener(function(command) {
  if(command == 'toggle') {
    chrome.tabs.query({active: true}, function(tabs) {
      if(tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {toggleDisplay: true}, function(response) {});
      }
    });
  }
});

chrome.tabs.onUpdated.addListener(function(id, changeInfo, tab) {
  if(changeInfo.status === 'complete') {
    chrome.storage.local.get('tabMap', function(data) {
      if(data.tabMap[id]) {
        chrome.storage.local.remove(id + ':' + data.tabMap[id].url);
      }

      data.tabMap[id] = {url: tab.url};
      chrome.storage.local.set(data);

      var tabData = {},
          key = id + ':' + tab.url;

      if(!tab.url.includes('chrome://')) {
        chrome.tabs.captureVisibleTab(null, {}, function(image) {
          tabData[key] = {screenshot: image};
          chrome.storage.local.set(tabData);

          var domain = tab.url.match(/\w+:\/\/(.*?)\//)[1];
          chrome.storage.local.get(domain, function(data) {
            if(data[domain]) {
              var index = data[domain].findIndex(function(visit) {
                return visit.url == tab.url;
              });

              if(index !== -1) {
                data[domain][index].lastVisited = new Date().toISOString();
              } else {
                data[domain].push({
                  url: tab.url,
                  title: tab.title,
                  lastVisited: new Date().toISOString()
                })
              }

            } else {
              data = {};
              data[domain] = [{
                url: tab.url,
                title: tab.title,
                lastVisited: new Date().toISOString()
              }];
            }
            chrome.storage.local.set(data);
          });

        });
      } else {
        tabData[key] = {screenshot: null};
        chrome.storage.local.set(tabData);
      }
    });
  }
});

chrome.tabs.onRemoved.addListener(function(tabId) {
  chrome.storage.local.get('tabMap', function(data) {
    var url = data.tabMap[tabId];

    delete data.tabMap[tabId];
    chrome.storage.local.set(data);

    chrome.storage.local.remove(tabId + ':' + url);
  });
});


chrome.tabs.onHighlighted.addListener(function(highlightInfo) {
  chrome.tabs.get(highlightInfo.tabIds[0], function(tab) {
    var hostname = tab.url.match(/\w+:\/\/(.*?)\//)[0];
    chrome.tabs.query({}, function(tabs) {
      var filteredTabs = tabs.filter(function(tab) {
        return tab.url.includes(hostname);
      });

      var similarTabs = filteredTabs.length;
      if(similarTabs > 1) {
        chrome.browserAction.setBadgeText({
          text: similarTabs.toString()
        });
      } else {
        chrome.browserAction.setBadgeText({
          text: ''
        });
      }
    });
  });
});

chrome.browserAction.onClicked.addListener(function() {
  chrome.tabs.query({active: true}, function(tabs) {
    if(tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {toggleDisplay: true}, function(response) {});
    }
  });
});
