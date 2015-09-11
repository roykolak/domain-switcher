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
              hostname: request.hostname,
              href: request.href
            }));
          }
        });
      });
      break;

    case "read_template":
      chromeAPI.getTabsForDomain(request.hostname, function(filteredTabs) {
        var index;
        filteredTabs.forEach(function(tab, i) {
           if(tab.url == request.href && tab.id == sender.tab.id) {
             index = i;
           }
        });
        filteredTabs[index].current = true;

        chromeAPI.orderTabsByLastFocus(filteredTabs, function(orderedFilteredTabs) {
          chromeAPI.requestFile("template.html", function(status, response) {
            if (status == 200) {
              var template = Handlebars.compile(response);
              sendResponse(template({
                root: 'chrome-extension://' + chrome.runtime.id,
                items: orderedFilteredTabs,
                hostname: request.hostname
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

    case "new_tab":
      chrome.tabs.create({
        url: 'new.html'
      });
      break;

    case "highlight_tab":
      chromeAPI.highlightTab(request.tabId);
      tracker.selectPage();
      break;

    case "hide_extension":
      chromeAPI.updateBrowserActionIcon();
      break;
    }
});

chrome.commands.onCommand.addListener(function(command) {
  if(command == 'toggle') {
    tracker.open({method: 'Keyboard shortcut'});
    chromeAPI.sendMessageToActiveTab({toggle: true});
    chromeAPI.updateBrowserActionIcon();
  }
});

chrome.tabs.onUpdated.addListener(function(id, changeInfo, tab) {
  if(changeInfo.status === 'complete') {

    // We always want to override the screen of the tab when the tab is updated
    // because the update event means that the content is probably different
    chromeAPI.rememberTab(id, {override: true});
    chromeAPI.updateBrowserActionIcon();
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

  chromeAPI.updateBrowserActionIcon();

  chromeAPI.updateTabLastFocusedAt(tabId);

  // Rely on the screenshot override logic on rememberTab, don't force it to
  // store a fresh screenshot because if the user has QuickSwitch open on a
  // newly highlighted tab, then we don't want to take a screenshot.
  chromeAPI.rememberTab(tabId);
});

chrome.browserAction.onClicked.addListener(function() {
  tracker.open({method: 'Browser action'});
  chromeAPI.sendMessageToActiveTab({toggle: true});
  chromeAPI.updateBrowserActionIcon();
});
