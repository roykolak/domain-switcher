var tracker = new Tracker("9ee5f5d9bb3dad93f990c534b4e9efec");
var chromeAPI = new ChromeAPI();

chrome.storage.sync.get('userId', function(data) {
  var userId;

  if(data && data.userId) {
    userId = data.userId;
  } else {
    userId = Tracker.generateGuid();
    chrome.storage.sync.set({userId: userId});
  }

  tracker.identify(userId, {
    isNew: typeof(data.userId) === 'undefined'
  });
});


chrome.runtime.onInstalled.addListener(function() {
  tracker.installed();

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
      chrome.commands.getAll(function(commands) {
        var toggleCommand;

        commands.forEach(function(command) {
          if(command.name == "toggle") {
            toggleCommand = command;
          }
        });

        chromeAPI.requestFile("index.html", function(status, response) {
          if (status == 200) {
            var template = Handlebars.compile(response);
            sendResponse(template({
              shortcut: toggleCommand.shortcut,
              hostname: request.hostname
            }));
          }
        });
      });
      break;

    case "read_template":
      chromeAPI.getTabsForDomain(request.hostname, function(filteredTabs) {
        var index = filteredTabs.findIndex(function(tab) {
          return tab.url == request.href
        });
        filteredTabs[index].current = true;

        chromeAPI.orderTabsByLastFocus(filteredTabs, function(orderedFilteredTabs) {
          chromeAPI.requestFile("template.html", function(status, response) {
            if (status == 200) {
              var template = Handlebars.compile(response);
              sendResponse(template({
                root: 'chrome-extension://' + chrome.runtime.id,
                items: orderedFilteredTabs
              }));
            }
          });

          tracker.showPages({
            numberOfPages: filteredTabs.length
          });
        });
      });
      break;

    case "read_screenshot":
      var key = request.tabId + ':' + request.url;
      chrome.storage.local.get(key, function(data) {
        sendResponse(data[key] ? data[key].screenshot : false);
      });
      break;

    case "highlight_tab":
      chromeAPI.highlightTab(request.tabId);
      tracker.selectPage();
      break;
    }
});

chrome.commands.onCommand.addListener(function(command) {
  if(command == 'toggle') {
    tracker.open({method: 'Keyboard shortcut'});
    chromeAPI.sendMessageToActiveTab({toggleDisplay: true});
  }
});

chrome.tabs.onUpdated.addListener(function(id, changeInfo, tab) {
  if(changeInfo.status === 'complete') {
    chrome.storage.local.get('tabMap', function(data) {
      if(data.tabMap[id]) {
        chrome.storage.local.remove(id + ':' + data.tabMap[id].url);
      }

      data.tabMap[id] = {url: tab.url, lastFocusedAt: new Date().toISOString()};
      chrome.storage.local.set(data);

      var tabData = {},
          key = id + ':' + tab.url;

      if(!tab.url.includes('chrome://')) {
        chrome.tabs.captureVisibleTab(null, {}, function(image) {
          tabData[key] = {screenshot: image};
          chrome.storage.local.set(tabData);
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
  var tabId = highlightInfo.tabIds[0];
  chromeAPI.getSimilarTabsForTab(tabId, function(tabs) {
    var badgeText = '';

    if(tabs.length > 1) {
      badgeText = tabs.length.toString()
    }

    chrome.browserAction.setBadgeText({text: badgeText});
  });

  chrome.tabs.get(tabId, function(tab) {
    chrome.storage.local.get('tabMap', function(data) {
      if(data.tabMap[tabId]) {
        chrome.storage.local.remove(tabId + ':' + data.tabMap[tabId].url);
      }

      data.tabMap[tabId] = {url: tab.url, lastFocusedAt: new Date().toISOString()};
      chrome.storage.local.set(data);

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
    });
  });
});

chrome.browserAction.onClicked.addListener(function() {
  tracker.open({method: 'Browser action'});
  chromeAPI.sendMessageToActiveTab({toggleDisplay: true});
});
