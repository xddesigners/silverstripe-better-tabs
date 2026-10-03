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

    function moreLabel() {
        return (typeof window !== 'undefined' && window.__betterTabsMore) || 'More';
    }

    function debounce(fn, ms) {
        var t;
        return function () {
            clearTimeout(t);
            t = setTimeout(fn, ms);
        };
    }

    // Activate a tab by its anchor. Prefer the jQuery UI tabs API (no click event, so the
    // CMS's link handler can't fire a pjax-less ajax -> "Bad Request"); fall back to a click.
    function activateTab(anchor) {
        var jq = window.jQuery;
        var li = anchor.closest ? anchor.closest('li.nav-item') : null;
        var ul = anchor.closest ? anchor.closest('ul.nav-tabs') : null;
        var tabset = ul ? ul.parentNode : null;
        if (jq && tabset && li && jq(tabset).is('.ui-tabs') && typeof jq.fn.tabs === 'function') {
            var $ts = jq(tabset);
            var index = $ts.children('ul.nav-tabs').children('li.nav-item').not('.bt-more').index(li);
            if (index > -1) {
                try {
                    $ts.tabs('option', 'active', index);
                    // Mirror a normal tab click: reflect the tab in the URL hash.
                    if (anchor.hash) {
                        location.hash = anchor.hash;
                    }
                    return;
                } catch (e) {
                    /* fall through to the last-resort click */
                }
            }
        }
        anchor.click();
    }

    // setIcon('fa-solid fa-gear') renders as `font-icon-fa-solid fa-gear` (the template
    // forces a `font-icon-` prefix). Strip that prefix off Font Awesome tokens so FA renders.
    function normalizeFaIcons(root) {
        var scope = root && root.querySelectorAll ? root : document;
        Array.prototype.forEach.call(scope.querySelectorAll('.tab__icon'), function (icon) {
            Array.prototype.slice.call(icon.classList).forEach(function (cls) {
                if (cls.indexOf('font-icon-fa-') === 0) {
                    icon.classList.remove(cls);
                    icon.classList.add(cls.slice('font-icon-'.length));
                }
            });
        });
    }

    // Colours set in PHP via setColor() render as data-attributes on the tab's pane/wrapper;
    // copy them onto the matching nav tab link.
    function applyTabColors() {
        Array.prototype.forEach.call(document.querySelectorAll('[data-bt-color],[data-bt-bg],[data-bt-icon-color]'), function (el) {
            if (!el.id) {
                return;
            }
            var link = document.getElementById('tab-' + el.id);
            if (!link) {
                return;
            }
            var color = el.getAttribute('data-bt-color');
            var bg = el.getAttribute('data-bt-bg');
            var iconColor = el.getAttribute('data-bt-icon-color');
            if (color) {
                link.style.color = color;
            }
            if (bg) {
                link.style.backgroundColor = bg;
                link.classList.add('bt-colored-bg'); // CSS fades this while inactive
            }
            if (iconColor) {
                var icon = link.querySelector('.tab__icon');
                if (icon) {
                    icon.style.color = iconColor;
                }
            }
        });
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
        toggle.textContent = moreLabel();
        toggle.insertAdjacentHTML('beforeend',
            ' <svg class="bt-kebab" viewBox="0 0 4 16" aria-hidden="true">' +
            '<circle cx="2" cy="2.4" r="1.5"/><circle cx="2" cy="8" r="1.5"/><circle cx="2" cy="13.6" r="1.5"/></svg>');

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
        Array.prototype.forEach.call(
            document.querySelectorAll('li.bt-more.open, li.bt-tabmenu.open'),
            function (m) {
                m.classList.remove('open');
                var t = m.querySelector('.bt-more-toggle');
                if (t) {
                    t.setAttribute('aria-expanded', 'false');
                }
            }
        );
    }

    function layout(ul) {
        // Navs inside a dropdown-mode group are hidden and replaced by a menu — no overflow.
        if (inMarkedSubtree(ul)) {
            return;
        }

        var more = ensureMore(ul);
        var menu = more.querySelector('.bt-more-menu');
        var tabs = realTabs(ul);

        // Reset: show every tab, clear the menu, hide More.
        tabs.forEach(function (li) { li.style.display = ''; });
        menu.textContent = '';
        more.style.display = 'none';
        more.classList.remove('bt-has-active', 'open');
        ul.classList.remove('bt-has-more');

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

        ul.classList.add('bt-has-more'); // stretch the nested track so More can right-align

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
            if (isActive(li)) {
                link.className = 'bt-active';
                anyActive = true;
            }
            // Carry the tab's icon (if any) into the dropdown item.
            var iconEl = anchor.querySelector('.tab__icon');
            if (iconEl) {
                link.appendChild(iconEl.cloneNode(true));
            }
            var label = document.createElement('span');
            label.className = 'bt-more-label';
            label.textContent = (anchor.textContent || '').trim();
            link.appendChild(label);
            if (anchor.style.color) {
                link.style.color = anchor.style.color;
            }
            if (anchor.style.backgroundColor) {
                link.style.backgroundColor = anchor.style.backgroundColor;
            }
            link.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation(); // don't let the CMS link handler navigate to the '#' href
                closeAllMenus();
                activateTab(anchor);
                setTimeout(function () { layout(ul); updateBreadcrumb(); }, 0); // pull the now-active tab into view
            });
            item.appendChild(link);
            menu.appendChild(item);
        });
        if (anyActive) {
            more.classList.add('bt-has-active');
        }
    }

    function breadcrumbsEnabled() {
        return typeof window !== 'undefined' && !!window.__betterTabsBreadcrumbs;
    }

    // A nav lives inside a tab group that was marked in PHP with setMode('dropdown') /
    // enableDropdown() (data-bt-mode="dropdown" on the tabset pane). Its own tab bar is hidden
    // and replaced by a dropdown menu, so skip the overflow handling for it.
    function inMarkedSubtree(ul) {
        var tabset = ul.parentNode;
        return !!(tabset && tabset.closest &&
            tabset.closest('.ss-tabset[data-bt-mode="dropdown"]'));
    }

    // The tabset pane a tab anchor points at, or null for a leaf tab.
    function childTabset(anchor) {
        var hash = anchor.hash || '';
        var id = hash.charAt(0) === '#' ? hash.slice(1) : hash;
        var panel = id ? document.getElementById(id) : null;
        return panel && panel.classList.contains('ss-tabset') ? panel : null;
    }

    // The first leaf tab anchor reached by always taking the first child.
    function firstLeafAnchor(tabset) {
        var nav = tabset.querySelector(':scope > ul.nav-tabs');
        if (!nav) {
            return null;
        }
        var tabs = realTabs(nav);
        if (!tabs.length) {
            return null;
        }
        var anchor = tabs[0].querySelector('a.nav-link');
        if (!anchor) {
            return null;
        }
        var child = childTabset(anchor);
        return child ? firstLeafAnchor(child) : anchor;
    }

    // Activate the full tab chain leading to a (leaf) tab anchor, top-down, via the jQuery UI
    // API (no click event -> no CMS link-handler ajax), then reflect it in the URL hash.
    function activatePath(leafAnchor) {
        var jq = window.jQuery;
        if (!jq || typeof jq.fn.tabs !== 'function') {
            leafAnchor.click();
            return;
        }
        var li = leafAnchor.closest ? leafAnchor.closest('li.nav-item') : null;
        var steps = [];
        var guard = 0;
        while (li && guard++ < 12) {
            var ul = li.parentNode;
            var tabset = ul ? ul.parentNode : null;
            if (!tabset || !tabset.classList || !tabset.classList.contains('ss-tabset')) {
                break;
            }
            steps.unshift({ tabset: tabset, li: li });
            var parentLink = tabset.id ? document.getElementById('tab-' + tabset.id) : null;
            li = parentLink && parentLink.closest ? parentLink.closest('li.nav-item') : null;
        }
        steps.forEach(function (step) {
            try {
                var $ts = jq(step.tabset);
                if (!$ts.is('.ui-tabs')) {
                    return;
                }
                var idx = $ts.children('ul.nav-tabs').children('li.nav-item')
                    .not('.bt-more').index(step.li);
                if (idx > -1) {
                    $ts.tabs('option', 'active', idx);
                }
            } catch (e) {
                /* ignore */
            }
        });
        if (leafAnchor.hash) {
            location.hash = leafAnchor.hash;
        }
    }

    // Build a dropdown list (reusing the "More" menu look) for one tabset's child tabs. A child
    // that is itself a tab group becomes a flyout submenu (recursively).
    function buildMenuLevel(tabset) {
        var menu = document.createElement('ul');
        menu.className = 'bt-more-menu';
        var nav = tabset.querySelector(':scope > ul.nav-tabs');
        if (!nav) {
            return menu;
        }
        realTabs(nav).forEach(function (tabLi) {
            var anchor = tabLi.querySelector('a.nav-link');
            if (!anchor) {
                return;
            }
            var group = childTabset(anchor);
            var item = document.createElement('li');
            var link = document.createElement('a');
            link.href = '#';

            var iconEl = anchor.querySelector('.tab__icon');
            if (iconEl) {
                link.appendChild(iconEl.cloneNode(true));
            }
            var label = document.createElement('span');
            label.className = 'bt-more-label';
            label.textContent = (anchor.textContent || '').trim();
            link.appendChild(label);
            if (anchor.style.color) {
                link.style.color = anchor.style.color;
            }
            if (anchor.style.backgroundColor) {
                link.style.backgroundColor = anchor.style.backgroundColor;
            }
            if (isActive(tabLi)) {
                link.classList.add('bt-active');
            }

            if (group) {
                item.classList.add('bt-submenu');
                link.insertAdjacentHTML('beforeend',
                    '<span class="bt-flyout-caret" aria-hidden="true">›</span>');
                var flyout = buildMenuLevel(group);
                flyout.classList.add('bt-flyout');
                item.appendChild(link);
                item.appendChild(flyout);
                // Flyout opens to the right by default; flip left only if it would overflow.
                flipIfOverflow(item, flyout, 'bt-flyout-left');
                // Clicking a group heading jumps to its first leaf (hover opens the flyout).
                link.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    var leaf = firstLeafAnchor(group);
                    if (leaf) {
                        closeAllMenus();
                        activatePath(leaf);
                        setTimeout(updateBreadcrumb, 0);
                    }
                });
            } else {
                item.appendChild(link);
                link.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    closeAllMenus();
                    activatePath(anchor);
                    setTimeout(updateBreadcrumb, 0);
                });
            }
            menu.appendChild(item);
        });
        return menu;
    }

    // Open a menu/flyout in its default direction, flipping (via `cls`) only when its right
    // edge would run off the viewport. Measured each time the pointer opens it.
    function flipIfOverflow(container, menuEl, cls) {
        container.addEventListener('mouseenter', function () {
            container.classList.remove(cls);
            var r = menuEl.getBoundingClientRect();
            var vw = window.innerWidth || document.documentElement.clientWidth;
            if (r.width && r.right > vw - 4) {
                container.classList.add(cls);
            }
        });
    }

    function addTabCaret(link) {
        if (link.querySelector('.bt-tab-caret')) {
            return;
        }
        var caret = document.createElement('span');
        caret.className = 'bt-tab-caret';
        caret.setAttribute('aria-hidden', 'true');
        link.appendChild(caret);
    }

    // For each tab group marked as a dropdown, hang a website-style menu off its own tab item.
    function buildTabMenus() {
        Array.prototype.forEach.call(
            document.querySelectorAll('.ss-tabset[data-bt-mode="dropdown"]'),
            function (tabset) {
                // Skip a marked group nested inside another marked group — the outer menu covers it.
                if (tabset.parentNode && tabset.parentNode.closest &&
                    tabset.parentNode.closest('.ss-tabset[data-bt-mode="dropdown"]')) {
                    return;
                }
                var link = tabset.id ? document.getElementById('tab-' + tabset.id) : null;
                if (!link) {
                    return;
                }
                var li = link.closest ? link.closest('li.nav-item') : null;
                if (!li || li.getAttribute('data-bt-menu') === '1') {
                    return;
                }
                li.setAttribute('data-bt-menu', '1');
                li.classList.add('bt-tabmenu');
                addTabCaret(link);

                var menu = buildMenuLevel(tabset);
                menu.classList.add('bt-tab-root-menu');
                li.appendChild(menu);

                // Open the menu under the tab by default; align it right only if it would
                // overflow the viewport (measured each time it opens).
                flipIfOverflow(li, menu, 'bt-menu-right');

                // Click opens the menu (hover opens it too, via CSS); don't let it switch tabs
                // or hit the CMS link handler.
                link.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    var wasOpen = li.classList.contains('open');
                    closeAllMenus();
                    if (!wasOpen) {
                        li.classList.add('open');
                    }
                });
            }
        );
    }

    // Reset every nested tabset inside a tab's panel to its first tab (its default path).
    function resetDescendants(anchor) {
        var jq = window.jQuery;
        if (!jq) {
            return;
        }
        var hash = anchor.hash || '';
        var id = hash.charAt(0) === '#' ? hash.slice(1) : hash;
        var panel = id ? document.getElementById(id) : null;
        if (!panel) {
            return;
        }
        var tabsets = [];
        if (panel.classList.contains('ss-tabset')) {
            tabsets.push(panel);
        }
        Array.prototype.push.apply(tabsets, panel.querySelectorAll('.ss-tabset'));
        tabsets.forEach(function (ts) {
            try {
                if (jq(ts).is('.ui-tabs')) {
                    jq(ts).tabs('option', 'active', 0);
                }
            } catch (e) {
                /* ignore */
            }
        });
    }

    // Render (or remove) the breadcrumb of the active nested path, placed just below the
    // deepest sub-tab strip.
    function updateBreadcrumb() {
        var old = document.querySelector('.bt-breadcrumb');
        if (old && old.parentNode) {
            old.parentNode.removeChild(old);
        }
        if (!breadcrumbsEnabled()) {
            return;
        }
        var root = document.getElementById('Root');
        if (!root || !root.classList.contains('ss-tabset')) {
            return;
        }

        // Walk the active chain, tracking the deepest tabset (its nav is the lowest strip).
        var crumbs = [];
        var tabset = root;
        var deepest = null;
        var guard = 0;
        while (tabset && guard++ < 12) {
            var nav = tabset.querySelector(':scope > ul.nav-tabs');
            if (!nav) {
                break;
            }
            var activeLi = nav.querySelector(':scope > li.ui-tabs-active');
            if (!activeLi) {
                break;
            }
            var anchor = activeLi.querySelector('a.nav-link');
            if (!anchor) {
                break;
            }
            crumbs.push({ label: (anchor.textContent || '').trim(), anchor: anchor });
            deepest = tabset;
            var hash = anchor.hash || '';
            var id = hash.charAt(0) === '#' ? hash.slice(1) : hash;
            var panel = id ? document.getElementById(id) : null;
            tabset = (panel && panel.classList.contains('ss-tabset')) ? panel : null;
        }

        if (crumbs.length < 2 || !deepest) {
            return;
        }

        var bc = document.createElement('div');
        bc.className = 'bt-breadcrumb';
        crumbs.forEach(function (crumb, i) {
            if (i) {
                var sep = document.createElement('span');
                sep.className = 'bt-breadcrumb-sep';
                sep.setAttribute('aria-hidden', 'true');
                sep.textContent = '›';
                bc.appendChild(sep);
            }
            var isLast = i === crumbs.length - 1;
            var item = document.createElement(isLast ? 'span' : 'a');
            item.className = 'bt-breadcrumb-item' + (isLast ? ' bt-current' : '');
            item.textContent = crumb.label;
            if (!isLast && crumb.anchor) {
                item.href = '#';
                (function (anchor) {
                    item.addEventListener('click', function (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        resetDescendants(anchor); // go to this tab's default child path
                        activateTab(anchor);      // activate it + set the hash
                        setTimeout(updateBreadcrumb, 0);
                    });
                })(crumb.anchor);
            }
            bc.appendChild(item);
        });

        var deepestNav = deepest.querySelector(':scope > ul.nav-tabs');
        if (deepestNav && deepestNav.nextSibling) {
            deepest.insertBefore(bc, deepestNav.nextSibling);
        } else {
            deepest.appendChild(bc);
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

        // Hidden navs inside a dropdown-mode group are driven by the menu, not enhanced here.
        if (inMarkedSubtree(ul)) {
            return;
        }

        // Re-layout when a tab in this set is activated (the active tab may change).
        ul.addEventListener('click', function (e) {
            if (e.target.closest('.bt-more')) {
                return;
            }
            setTimeout(function () { layout(ul); updateBreadcrumb(); }, 0);
        });

        if (window.ResizeObserver) {
            // Observe the parent (stable available width), not the ul — toggling the track's
            // own width (compact <-> full when More appears) must not retrigger the observer.
            var ro = new ResizeObserver(debounce(function () { layout(ul); }, 100));
            ro.observe(ul.parentNode || ul);
        }

        layout(ul);
    }

    var scanScheduled = false;
    function scan() {
        scanScheduled = false;
        normalizeFaIcons(document);
        applyTabColors();
        Array.prototype.forEach.call(getNavs(), enhance);
        buildTabMenus();
        updateBreadcrumb();
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
