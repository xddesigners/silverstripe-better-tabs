/**
 * Better Tabs — overflow dropdown for Silverstripe CMS tab bars.
 *
 * When a tabset's nav wraps onto more than one row, the trailing tabs are collapsed into a
 * "More ▾" dropdown so the bar stays on a single row. The active tab is always kept visible.
 *
 * Dependency-free: it enhances the rendered `.ss-tabset > ul.nav-tabs` DOM and leaves the
 * tabs' own (jQuery UI) click behaviour intact by keeping the real <li>s in place (hidden)
 * and proxying clicks from the dropdown to the real tab anchor. A MutationObserver re-applies
 * it after the CMS swaps in new content (PJAX); a ResizeObserver handles panel resizes.
 */
(function () {
    'use strict';

    var MORE_LABEL = 'More';

    function debounce(fn, ms) {
        var t;
        return function () {
            clearTimeout(t);
            t = setTimeout(fn, ms);
        };
    }

    // Is the nav currently spanning more than one row?
    function wraps(ul) {
        var visible = Array.prototype.filter.call(ul.children, function (li) {
            return li.offsetParent !== null;
        });
        if (visible.length < 2) {
            return false;
        }
        var top0 = visible[0].offsetTop;
        for (var i = 1; i < visible.length; i++) {
            if (visible[i].offsetTop > top0 + 2) {
                return true;
            }
        }
        return false;
    }

    function realTabs(ul) {
        return Array.prototype.filter.call(ul.children, function (li) {
            return li.classList.contains('nav-item') && !li.classList.contains('bt-more');
        });
    }

    function isActive(li) {
        return li.classList.contains('ui-tabs-active') || li.classList.contains('active');
    }

    function ensureMore(ul) {
        var more = ul.querySelector(':scope > li.bt-more');
        if (more) {
            return more;
        }
        more = document.createElement('li');
        more.className = 'nav-item bt-more';
        more.style.display = 'none';

        var toggle = document.createElement('a');
        toggle.className = 'nav-link bt-more-toggle';
        toggle.href = '#';
        toggle.setAttribute('role', 'button');
        toggle.setAttribute('aria-haspopup', 'true');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.innerHTML = MORE_LABEL + ' <span class="bt-caret" aria-hidden="true">▾</span>';

        var menu = document.createElement('ul');
        menu.className = 'bt-more-menu';

        more.appendChild(toggle);
        more.appendChild(menu);
        ul.appendChild(more);

        toggle.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var open = more.classList.toggle('open');
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        });

        return more;
    }

    function closeAllMenus() {
        Array.prototype.forEach.call(document.querySelectorAll('li.bt-more.open'), function (m) {
            m.classList.remove('open');
            var t = m.querySelector('.bt-more-toggle');
            if (t) {
                t.setAttribute('aria-expanded', 'false');
            }
        });
    }

    function layout(ul) {
        var more = ensureMore(ul);
        var menu = more.querySelector('.bt-more-menu');
        var tabs = realTabs(ul);

        // Reset: show every tab, clear the menu, hide More.
        tabs.forEach(function (li) { li.style.display = ''; });
        menu.textContent = '';
        more.style.display = 'none';
        more.classList.remove('bt-has-active', 'open');

        if (!wraps(ul)) {
            return; // fits on one row
        }

        more.style.display = '';

        // Hide tabs from the end until the row no longer wraps; never hide the active tab.
        var hidden = [];
        for (var i = tabs.length - 1; i >= 0 && wraps(ul); i--) {
            if (isActive(tabs[i])) {
                continue;
            }
            tabs[i].style.display = 'none';
            hidden.unshift(tabs[i]); // keep natural order
        }

        if (!hidden.length) {
            more.style.display = 'none';
            return;
        }

        // Build the dropdown, proxying clicks to the real tab anchors.
        var anyActive = false;
        hidden.forEach(function (li) {
            var anchor = li.querySelector('a.nav-link') || li.querySelector('a');
            if (!anchor) {
                return;
            }
            var item = document.createElement('li');
            var link = document.createElement('a');
            link.href = '#';
            link.textContent = (anchor.textContent || '').trim();
            if (isActive(li)) {
                link.className = 'bt-active';
                anyActive = true;
            }
            link.addEventListener('click', function (e) {
                e.preventDefault();
                closeAllMenus();
                anchor.click(); // let the tabset activate the panel
                setTimeout(function () { layout(ul); }, 0); // pull the now-active tab into view
            });
            item.appendChild(link);
            menu.appendChild(item);
        });
        if (anyActive) {
            more.classList.add('bt-has-active');
        }
    }

    function getNavs() {
        return document.querySelectorAll('.ss-tabset > ul.nav-tabs');
    }

    function layoutAll() {
        Array.prototype.forEach.call(getNavs(), layout);
    }

    function enhance(ul) {
        if (ul.getAttribute('data-bt') === '1') {
            return;
        }
        ul.setAttribute('data-bt', '1');

        // Re-layout when a tab in this set is activated (the active tab may change).
        ul.addEventListener('click', function (e) {
            if (e.target.closest('.bt-more')) {
                return;
            }
            setTimeout(function () { layout(ul); }, 0);
        });

        if (window.ResizeObserver) {
            var ro = new ResizeObserver(debounce(function () { layout(ul); }, 100));
            ro.observe(ul);
        }

        layout(ul);
    }

    var scanScheduled = false;
    function scan() {
        scanScheduled = false;
        Array.prototype.forEach.call(getNavs(), enhance);
    }
    function scheduleScan() {
        if (scanScheduled) {
            return;
        }
        scanScheduled = true;
        setTimeout(scan, 50);
    }

    document.addEventListener('click', closeAllMenus);
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closeAllMenus();
        }
    });
    window.addEventListener('resize', debounce(layoutAll, 150));

    if (document.readyState !== 'loading') {
        scheduleScan();
    } else {
        document.addEventListener('DOMContentLoaded', scheduleScan);
    }

    // Re-apply after the CMS injects new content (PJAX edit-form loads).
    if (window.MutationObserver) {
        new MutationObserver(scheduleScan).observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }
})();
