<?php

namespace XD\BetterTabs\Extension;

use SilverStripe\Core\Extension;
use SilverStripe\View\Requirements;
use XD\BetterTabs\BetterTabs;

/**
 * Loads the configured Font Awesome stylesheet (Free from cdnjs, or a custom/Pro URL)
 * into the CMS when enabled. See {@link BetterTabs}.
 *
 * @extends Extension<\SilverStripe\Admin\LeftAndMain>
 */
class LeftAndMainExtension extends Extension
{
    protected function onAfterInit(): void
    {
        $css = BetterTabs::fontAwesomeCss();
        if ($css !== '') {
            Requirements::css($css);
        }

        // Expose the translated "More" label + options to the client script.
        $more = _t(BetterTabs::class . '.MORE', 'More');
        $overflow = BetterTabs::config()->get('overflow_menu') ? 'true' : 'false';
        $breadcrumbs = BetterTabs::config()->get('breadcrumbs') ? 'true' : 'false';
        $viewIcons = BetterTabs::config()->get('view_tab_icons') ?: [];
        Requirements::customScript(
            'window.__betterTabsMore = ' . json_encode($more) . ';'
            . 'window.__betterTabsOverflow = ' . $overflow . ';'
            . 'window.__betterTabsBreadcrumbs = ' . $breadcrumbs . ';'
            . 'window.__betterTabsViewIcons = ' . json_encode((object) $viewIcons) . ';',
            'better-tabs-config'
        );
    }
}
