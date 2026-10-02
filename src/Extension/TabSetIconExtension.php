<?php

namespace XD\BetterTabs\Extension;

use SilverStripe\Core\Extension;
use SilverStripe\Forms\TabSet;
use WeakMap;

/**
 * Adds icon support to {@link TabSet}, mirroring {@link Tab::setIcon()}/getIcon(), so a
 * tab group (a TabSet — e.g. a top-level tab that contains sub-tabs) can show an icon too.
 *
 * The existing `TabSet.ss` template already renders `$Icon` for every child tab, so once
 * TabSet exposes getIcon() the icon appears with no template override. Usage:
 *
 *     $fields->fieldByName('Root.Details')->setIcon('cog');
 *
 * The value is a font-icon identifier without the `font-icon-` prefix (e.g. `cog`).
 *
 * @extends Extension<TabSet>
 */
class TabSetIconExtension extends Extension
{
    /**
     * Icons keyed by the TabSet instance (weak so entries clear with the object).
     */
    private static ?WeakMap $icons = null;

    public function setIcon(string $icon): TabSet
    {
        (self::$icons ??= new WeakMap())[$this->owner] = $icon;
        return $this->owner;
    }

    public function getIcon(): string
    {
        return (self::$icons ??= new WeakMap())[$this->owner] ?? '';
    }
}
