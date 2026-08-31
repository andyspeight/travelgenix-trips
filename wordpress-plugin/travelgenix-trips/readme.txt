=== Travelgenix Trips ===
Contributors: travelgenix
Tags: travel, booking, trips, tours, embed
Requires at least: 5.6
Tested up to: 6.6
Requires PHP: 7.2
Stable tag: 0.2.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Embed your Travelgenix Trips on any WordPress page. A trip card, a grid of your trips, or a Book button, with the booking in an overlay so travellers never leave your site.

== Description ==

Travelgenix Trips lets a tour operator or travel agent sell group trips and escorted tours, take deposits, and keep the money in their own account. This plugin puts your trips on your WordPress site with a shortcode.

Three shortcodes, one script (loaded only on pages that use a shortcode):

* `[tg_trip id="TRIP_ID"]` a single trip card.
* `[tg_trips operator="OPERATOR_SLUG"]` a grid of all your published trips.
* `[tg_book id="TRIP_ID" label="Book now"]` a bare Book button, for when you already have your own trip page.

Reserve opens the hosted booking flow in an overlay, so the visitor stays on your page and traveller details are handled securely on the Travelgenix Trips backend. Nothing sensitive touches your WordPress site.

The trip data the widgets read is public and counts only. No traveller data is ever exposed to the page.

== Installation ==

1. Upload the `travelgenix-trips` folder to `/wp-content/plugins/`, or install the zip from Plugins, Add New, Upload Plugin.
2. Activate the plugin.
3. Put a shortcode on any page or post. Find your trip id and operator slug in your Travelgenix Trips console.

By default the plugin talks to https://trips.travelify.io. To point at a different backend, define `TG_TRIPS_ORIGIN` in wp-config.php or use the `tg_trips_origin` filter.

== Frequently Asked Questions ==

= Where do I find my trip id and operator slug? =
In the Travelgenix Trips console. The trip id is in the trip's address; the operator slug is your public URL prefix.

= Does this store any customer data on my WordPress site? =
No. Bookings happen on the Travelgenix Trips backend in an overlay. The page only reads public, counts-only trip information.

== Changelog ==

= 0.2.0 =
* First release: trip card, trips grid, and Book button shortcodes.
