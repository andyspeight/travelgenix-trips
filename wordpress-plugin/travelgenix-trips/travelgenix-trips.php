<?php
/**
 * Plugin Name:       Travelgenix Trips
 * Plugin URI:        https://trips.travelify.io
 * Description:       Embed your Travelgenix Trips as a trip card, a grid of your trips, or a Book button. Bookings open in an overlay, so travellers never leave your site.
 * Version:           0.2.0
 * Requires at least: 5.6
 * Requires PHP:      7.2
 * Author:            Travelgenix
 * Author URI:        https://travelgenix.co.uk
 * License:           GPL-2.0-or-later
 * Text Domain:       travelgenix-trips
 *
 * Three shortcodes, one script (loaded once, only on pages that use a shortcode):
 *
 *   [tg_trip id="TRIP_ID"]                 a single trip card
 *   [tg_trips operator="OPERATOR_SLUG"]    a grid of an operator's trips
 *   [tg_book id="TRIP_ID" label="Book"]    a bare Book button
 *
 * The script and the read-only trip API are served from the Trips origin
 * (https://trips.travelify.io by default). Override with the TG_TRIPS_ORIGIN
 * constant in wp-config.php, or the `tg_trips_origin` filter.
 */

if (!defined('ABSPATH')) {
    exit; // never load outside WordPress
}

if (!defined('TG_TRIPS_ORIGIN')) {
    define('TG_TRIPS_ORIGIN', 'https://trips.travelify.io');
}

/**
 * The Trips origin the embed script and API are served from, trailing slash
 * stripped. Filterable so a staging site can point elsewhere.
 */
function tg_trips_origin() {
    $origin = apply_filters('tg_trips_origin', TG_TRIPS_ORIGIN);
    return rtrim(esc_url_raw($origin), '/');
}

/**
 * Register the embed script. Not enqueued here: a shortcode enqueues it, so the
 * script only loads on pages that actually use a Trips embed.
 */
function tg_trips_register_assets() {
    wp_register_script(
        'travelgenix-trips-embed',
        tg_trips_origin() . '/embed.js',
        array(),
        '0.2.0',
        true // in the footer
    );
}
add_action('wp_enqueue_scripts', 'tg_trips_register_assets');

/** Add defer to our script tag, for older WordPress without the strategy arg. */
function tg_trips_defer_tag($tag, $handle) {
    if ($handle === 'travelgenix-trips-embed' && strpos($tag, ' defer') === false) {
        $tag = str_replace(' src=', ' defer src=', $tag);
    }
    return $tag;
}
add_filter('script_loader_tag', 'tg_trips_defer_tag', 10, 2);

/** Enqueue the embed script for this request. Called by every shortcode. */
function tg_trips_enqueue() {
    wp_enqueue_script('travelgenix-trips-embed');
}

/**
 * Build a container div with the given data-* attributes. Every attribute value
 * is escaped, so a bad shortcode value can never inject markup. The Trips origin
 * is passed as data-tg-api so the embed always talks to the right backend even
 * if the plugin points at staging.
 */
function tg_trips_container($attrs) {
    tg_trips_enqueue();
    $attrs['data-tg-api'] = tg_trips_origin();

    $out = '<div';
    foreach ($attrs as $key => $value) {
        if ($value === '' || $value === null) {
            continue;
        }
        $out .= ' ' . esc_attr($key) . '="' . esc_attr($value) . '"';
    }
    $out .= '></div>';
    return $out;
}

/** [tg_trip id="..." cta="Reserve a place"] */
function tg_trips_shortcode_trip($atts) {
    $a = shortcode_atts(array('id' => '', 'cta' => ''), $atts, 'tg_trip');
    if ($a['id'] === '') {
        return '';
    }
    return tg_trips_container(array(
        'data-tg-trip' => $a['id'],
        'data-tg-cta'  => $a['cta'],
    ));
}
add_shortcode('tg_trip', 'tg_trips_shortcode_trip');

/** [tg_trips operator="operator-slug" cta="Reserve a place"] */
function tg_trips_shortcode_grid($atts) {
    $a = shortcode_atts(array('operator' => '', 'cta' => ''), $atts, 'tg_trips');
    if ($a['operator'] === '') {
        return '';
    }
    return tg_trips_container(array(
        'data-tg-trips' => $a['operator'],
        'data-tg-cta'   => $a['cta'],
    ));
}
add_shortcode('tg_trips', 'tg_trips_shortcode_grid');

/** [tg_book id="..." label="Book now"] (label aliases cta) */
function tg_trips_shortcode_book($atts) {
    $a = shortcode_atts(array('id' => '', 'label' => '', 'cta' => ''), $atts, 'tg_book');
    if ($a['id'] === '') {
        return '';
    }
    $cta = $a['label'] !== '' ? $a['label'] : $a['cta'];
    return tg_trips_container(array(
        'data-tg-book' => $a['id'],
        'data-tg-cta'  => $cta,
    ));
}
add_shortcode('tg_book', 'tg_trips_shortcode_book');
