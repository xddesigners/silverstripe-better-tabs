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

    function breadcrumbsEnabled() {
        return typeof window !== 'undefined' && !!window.__betterTabsBreadcrumbs;
    }

    // Walk from a tabset down through the active tab at each level, collecting the chain.
    function activeChain(root) {
        var crumbs = [];
        var tabset = root;
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
            var href = anchor.getAttribute('href') || '';
            var id = href.charAt(0) === '#' ? href.slice(1) : '';
            var panel = id ? document.getElementById(id) : null;
            tabset = (panel && panel.classList.contains('ss-tabset')) ? panel : null;
        }
        return crumbs;
    }

    // Render (or remove) the breadcrumb of the active nested path at the top of #Root.
    function updateBreadcrumb() {
        var root = document.getElementById('Root');
        if (!root || !root.classList.contains('ss-tabset')) {
            return;
        }
        var existing = root.querySelector(':scope > .bt-breadcrumb');
        var chain = breadcrumbsEnabled() ? activeChain(root) : [];
        if (chain.length < 2) {
            if (existing) {
                existing.parentNode.removeChild(existing);
            }
            return;
        }
        var bc = existing || document.createElement('div');
        bc.className = 'bt-breadcrumb';
        bc.textContent = '';
        chain.forEach(function (crumb, i) {
            if (i) {
                var sep = document.createElement('span');
                sep.className = 'bt-breadcrumb-sep';
                sep.setAttribute('aria-hidden', 'true');
                sep.textContent = '›';
                bc.appendChild(sep);
            }
            var isLast = i === chain.length - 1;
            var item = document.createElement(isLast ? 'span' : 'a');
            item.className = 'bt-breadcrumb-item' + (isLast ? ' bt-current' : '');
            item.textContent = crumb.label;
            if (!isLast && crumb.anchor) {
                item.href = '#';
                (function (anchor) {
                    item.addEventListener('click', function (e) {
                        e.preventDefault();
                        anchor.click();
                        setTimeout(updateBreadcrumb, 0);
                    });
                })(crumb.anchor);
            }
            bc.appendChild(item);
        });
        if (!existing) {
            var nav = root.querySelector(':scope > ul.nav-tabs');
            if (nav && nav.nextSibling) {
                root.insertBefore(bc, nav.nextSibling);
            } else {
                root.appendChild(bc);
            }
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
