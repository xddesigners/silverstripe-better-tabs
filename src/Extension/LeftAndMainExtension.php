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
    }
}
