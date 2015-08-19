var bodyEl = document.getElementsByTagName("body")[0];
containerEl = document.createElement("div");
bodyEl.insertBefore(containerEl, bodyEl.firstChild);
var root = containerEl.createShadowRoot();

var loadContent = function(container, callback) {
  var data = {cmd: 'read_template', hostname: window.location.hostname};
  chrome.extension.sendRequest(data, function(html) {
    var content = document.createElement('div');
    content.innerHTML = html;
    content.classList.add('content-wrapper');

    container.appendChild(content);

    var cardEls = content.querySelectorAll('.card')

    callback();
  });
}

var loadImage = function(el) {
  var data = el.dataset;
  data.cmd = 'read_screenshot';
  chrome.extension.sendRequest(data, function(image) {
    if(image) {
      var titleEl = el.querySelector('.screenshot');
      titleEl.style.backgroundImage = 'url(' + image + ')';
    } else {
      el.classList.add('no-screenshot');
    }
  });
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if(request.toggleDisplay) {
    if(root.querySelector('.wrapper.show')) {
      root.querySelector('.wrapper').classList.remove('show');
    } else {
      chrome.extension.sendRequest({cmd: 'read_index'}, function(html) {
        var div = document.createElement('div');
        div.innerHTML = html;
        bodyEl.insertBefore(div, bodyEl.firstChild);

        var template = document.querySelector('#site-history');
        var clone = document.importNode(template.content, true);

        root.appendChild(clone);

        setTimeout(function() {
          root.querySelector('.wrapper').classList.add('show');

          loadContent(root.querySelector('.wrapper'), function() {
            var items = root.querySelectorAll('[data-url]');
            [].forEach.call(items, function(item) {
              loadImage(item);
            });

            var selectedTitleEl = root.querySelector('.selected-tab .title'),
                selectedUrlEl = root.querySelector('.selected-tab .url');

            var links = root.querySelectorAll('a.tab');
            [].forEach.call(links, function(link) {
              link.addEventListener("focus", function(e) {
                var dataset = e.currentTarget.dataset;
                selectedTitleEl.innerHTML = dataset.title;
                selectedUrlEl.innerHTML = dataset.url;
              });

              link.addEventListener("click", function(e) {
                e.preventDefault();
                root.querySelector('.wrapper').classList.remove('show');
                chrome.extension.sendRequest({
                  cmd: 'highlight_tab',
                  tabId: parseInt(e.currentTarget.dataset.tabId, 10)
                });
              });
            });

            links[0].focus();

            root.querySelector('a.dummy').addEventListener('focus', function(e) {
              links[0].focus();
            }, true);
          });
        }, 100);
      });
    }
  }
});
