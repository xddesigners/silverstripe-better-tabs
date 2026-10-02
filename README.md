# Silverstripe Better Tabs

Tame CMS forms that have too many tabs. When a tabset's tab bar would wrap onto more than
one row, the overflowing tabs collapse into a **"More ▾"** dropdown so the bar stays on a
single row. The active tab is always kept visible.

Works with the tabs you already have — including **nested tabs**
(`addFieldToTab('Root.Tab.SubTab', $field)`), which Silverstripe supports out of the box.

## Requirements

- Silverstripe Framework **6** / Admin **3**
- PHP **8.3+**

## Installation

```bash
composer require xddesigners/silverstripe-better-tabs
```

Run `dev/build?flush=1` once. No configuration or code changes are needed — it enhances the
existing CMS tab bars automatically.

## How it works

The module adds a small CSS + JS enhancement to the CMS (via
`LeftAndMain.extra_requirements_javascript` / `_css`). The script:

- watches each `.ss-tabset > ul.nav-tabs`; when it wraps, it hides the trailing tabs and lists
  them in a "More ▾" dropdown (keeping the active tab visible, and flagging "More" when the
  active tab lives inside it);
- leaves the tabs' native click behaviour intact — the real tab elements stay in the DOM
  (just hidden) and the dropdown proxies clicks to them;
- re-applies on window/panel resize (`ResizeObserver`) and after the CMS swaps in new content
  via PJAX (`MutationObserver`).

It is dependency-free (no jQuery/entwine required) and makes no server-side or data changes.

## Tab icons

Give any tab a small icon with `setIcon()` (a `font-icon` identifier, without the
`font-icon-` prefix):

```php
$fields->fieldByName('Root.Main')->setIcon('block-content');   // a leaf Tab (native)
$fields->fieldByName('Root.Settings')->setIcon('cog');         // a TabSet (tab group)
```

`Tab::setIcon()` is built into Silverstripe; this module adds the same `setIcon()`/`getIcon()`
to **`TabSet`** (via `TabSetIconExtension`) so a tab *group* can have an icon too. Icons render
through the native `TabSet.ss` template, are vertically aligned with the label, and are carried
into the "More" overflow dropdown.

## License

BSD-3-Clause.
