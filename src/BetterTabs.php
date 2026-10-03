<?php

namespace XD\BetterTabs;

use SilverStripe\Core\Config\Configurable;

/**
 * Font Awesome options for better-tabs.
 *
 * Icons are assigned to tabs in PHP with setIcon() (no YAML needed) — see the README.
 * For Font Awesome icons pass FA classes, e.g.:
 *
 *     $fields->fieldByName('Root.Media')->setIcon('fa-solid fa-photo-film');
 *
 * These options only control which Font Awesome stylesheet (if any) is loaded in the CMS.
 * Set them in PHP from your `app/_config.php`, e.g.:
 *
 *     use XD\BetterTabs\BetterTabs;
 *     use SilverStripe\Core\Config\Config;
 *     Config::modify()->set(BetterTabs::class, 'include_fontawesome_free', true);
 *     // or, for Font Awesome Pro:
 *     Config::modify()->set(BetterTabs::class, 'fontawesome_css', 'https://kit.fontawesome.com/XXXX.css');
 */
class BetterTabs
{
    use Configurable;

    /**
     * Load Font Awesome Free (from cdnjs) into the CMS. Ignored when `fontawesome_css`
     * is set.
     *
     * @config
     */
    private static bool $include_fontawesome_free = false;

    /**
     * Font Awesome Free version loaded from cdnjs when `include_fontawesome_free` is on.
     *
     * @config
     */
    private static string $fontawesome_version = '6.7.2';

    /**
     * Explicit Font Awesome stylesheet to load in the CMS — a full URL or local path.
     * Point this at your Font Awesome **Pro** kit/CSS to use Pro instead of the bundled
     * Free load; then use Pro classes (e.g. `fa-thin`, `fa-duotone`) in setIcon().
     * Takes precedence over `include_fontawesome_free`.
     *
     * @config
     */
    private static string $fontawesome_css = '';

    /**
     * Show a breadcrumb of the active nested-tab path (e.g. "Deep › Account › Profile")
     * above the panel, for tabsets nested two or more levels deep.
     *
     * @config
     */
    private static bool $breadcrumbs = false;

    /**
     * Resolve the Font Awesome stylesheet URL to load, or '' for none.
     */
    public static function fontAwesomeCss(): string
    {
        $css = trim((string) static::config()->get('fontawesome_css'));
        if ($css !== '') {
            return $css;
        }
        if (static::config()->get('include_fontawesome_free')) {
            $version = (string) static::config()->get('fontawesome_version');
            return "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/{$version}/css/all.min.css";
        }
        return '';
    }
}
