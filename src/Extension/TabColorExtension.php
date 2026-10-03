<?php

namespace XD\BetterTabs\Extension;

use SilverStripe\Core\Extension;

/**
 * Adds setColor() to Tab and TabSet so a tab's label (and optionally background) can be
 * coloured from PHP:
 *
 *     $fields->fieldByName('Root.Alerts')->setColor('#ffcc00');            // text colour
 *     $fields->fieldByName('Root.Live')->setColor('#ffffff', '#c0392b');   // text + background
 *
 * The colours are stored as data-attributes, which render on the tab's pane/wrapper via
 * `getAttributesHTML()`. The client script reads them and colours the tab in the nav at
 * every level (top bar, nested, and the overflow dropdown) — no template override needed.
 *
 * @extends Extension<\SilverStripe\Forms\FormField>
 */
class TabColorExtension extends Extension
{
    public function setColor(string $color, string $bgColor = '')
    {
        if ($color !== '') {
            $this->owner->setAttribute('data-bt-color', $color);
        }
        if ($bgColor !== '') {
            $this->owner->setAttribute('data-bt-bg', $bgColor);
        }
        return $this->owner;
    }

    public function getColor(): string
    {
        return (string) $this->owner->getAttribute('data-bt-color');
    }

    public function getBgColor(): string
    {
        return (string) $this->owner->getAttribute('data-bt-bg');
    }
}
