// =============================================================================
//  content.ts — the data behind the feature and solution pages.
// =============================================================================
//  Kept as plain data so the site scales by adding entries, not files: one
//  dynamic route renders every feature page, another every solution page. Copy
//  is warm, plain, UK English, no em dashes, no Oxford comma. Claims stay true
//  to what is built: the money story is the Stripe Connect MODEL (you are the
//  merchant), never a live-checkout promise, because checkout is not wired yet.
// =============================================================================

export interface Split {
  title: string;
  body: string;
  points?: string[];
}

export interface Benefit {
  icon: string;
  title: string;
  body: string;
}

export interface PageContent {
  slug: string;
  nav: string;       // short label for nav and cards
  icon: string;      // icon key (see site-chrome Icon)
  title: string;     // hero heading
  lede: string;      // hero sub-line
  card: string;      // one-line description on the index grid
  splits: Split[];   // alternating rows
  benefitsHead?: string;
  benefits?: Benefit[];
}

// --- feature pages ---------------------------------------------------------

export const FEATURES: PageContent[] = [
  {
    slug: 'payments',
    nav: 'Payments',
    icon: 'wallet',
    title: 'Your money is yours',
    lede: 'You are the merchant, not us. Money settles into your own Stripe account, on your own payout schedule, at your own rate. We take nothing per booking.',
    card: 'Keep your own Stripe rate. We take nothing per booking.',
    splits: [
      {
        title: 'No payments company in the middle',
        body: 'Most booking platforms sit between you and your travellers’ money, taking a cut and holding funds until they decide to release them. We do not. Travelgenix Trips connects to your own Stripe account, so you are the merchant of record and the money is yours from the moment it lands.',
        points: [
          'Funds settle to your Stripe balance, not ours',
          'Your own payout schedule and your own Stripe rate',
          'No platform cut on any booking, ever',
        ],
      },
      {
        title: 'Software, not a payment service',
        body: 'Because we never hold your travellers’ money, there is no client-money account, no safeguarding, no e-money partner and no verification limbo. That keeps you in control, and it keeps the product simple. You run the payments, we run the platform.',
        points: [
          'You stay in control of refunds and disputes',
          'No funds frozen while someone reviews your account',
          'Roughly two points cheaper on every pound that moves',
        ],
      },
    ],
    benefitsHead: 'What that means for you',
    benefits: [
      { icon: 'wallet', title: 'Better economics', body: 'Your Stripe rate instead of a platform markup on top of card fees. The saving compounds on every booking.' },
      { icon: 'lock', title: 'Fewer surprises', body: 'No held funds, no payout freezes, no rate you did not choose. The money behaves the way your own account does.' },
      { icon: 'shield', title: 'Less to worry about', body: 'We are not a payment service, so there is no client-money burden landing on you through us.' },
    ],
  },
  {
    slug: 'trip-pages',
    nav: 'Trip pages',
    icon: 'page',
    title: 'A trip page that sells',
    lede: 'Not a form with a price on it. A real brochure with your photography, your itinerary and your voice, ready to take a booking.',
    card: 'Brochure-quality pages with itinerary, packages and add-ons.',
    splits: [
      {
        title: 'Build it once, keep it beautiful',
        body: 'Add your dates, rooms and prices, write the day-by-day, drop in your photography and publish. The page is responsive, fast and clean, and it wears your brand rather than ours. Choose a stacked itinerary or a timeline, whichever suits the trip.',
        points: [
          'Itinerary day-by-day, stacked or as a timeline',
          'Packages and priced add-ons like transfers or excursions',
          'Your logo, colours and typeface throughout',
        ],
      },
      {
        title: 'Start from what you already have',
        body: 'You do not have to build every trip from a blank page. Paste in the itinerary you already send by email or PDF and our importer drafts the page for you to tidy and publish. Most of the work is done before you start.',
        points: [
          'Paste an existing itinerary and get a draft back',
          'Every draft is yours to edit before it goes live',
          'Nothing is published until you say so',
        ],
      },
    ],
    benefitsHead: 'Why it converts',
    benefits: [
      { icon: 'sparkle', title: 'Looks the part', body: 'A page a traveller trusts enough to book, not a checkout that makes them hesitate.' },
      { icon: 'map', title: 'Tells the story', body: 'The itinerary, the places and the photography do the selling, the way a good brochure always has.' },
      { icon: 'phone', title: 'Works everywhere', body: 'Fast and readable on a phone, which is where most of your travellers will first see it.' },
    ],
  },
  {
    slug: 'bookings',
    nav: 'Bookings',
    icon: 'ticket',
    title: 'Bookings and deposits, without the oversell',
    lede: 'Take a booking, hold the place safely and secure it with a deposit. Never sell the same seat twice.',
    card: 'Places held safely, never oversold, secured with a deposit.',
    splits: [
      {
        title: 'A place is held the moment it is booked',
        body: 'When a traveller books, their places are reserved atomically, so two people can never take the last seats at once. Capacity is tracked per departure and per room, and a sold-out date shows as sold out rather than taking a booking you cannot honour.',
        points: [
          'Capacity per departure and per package',
          'No double-selling, even under a rush',
          'A clean sold-out state, with a waitlist behind it',
        ],
      },
      {
        title: 'Deposits and balances that make sense',
        body: 'Secure a place with a deposit and show the balance clearly. Every booking carries its reference, party size and money in one place, and your team sees the whole picture in the console the moment it comes in.',
        points: [
          'Deposit to secure, balance shown plainly',
          'One reference the traveller keeps',
          'The booking is in your console instantly',
        ],
      },
    ],
    benefitsHead: 'The details that matter',
    benefits: [
      { icon: 'calendar', title: 'Multiple departures', body: 'Run the same trip across many dates, each with its own capacity and availability.' },
      { icon: 'tag', title: 'Promo and early-bird codes', body: 'Run an offer without discounting your whole catalogue, with limits you control.' },
      { icon: 'bell', title: 'Waitlists', body: 'Fill a sold-out departure the moment a place opens, from the people already keen to travel.' },
    ],
  },
  {
    slug: 'registration',
    nav: 'Registration',
    icon: 'shield',
    title: 'Collect everything you need, once',
    lede: 'Traveller details, your own questions, a signed waiver and passport documents, gathered the moment they book and never chased twice.',
    card: 'Traveller details, custom questions, waivers and documents.',
    splits: [
      {
        title: 'Your questions, their answers',
        body: 'Every trip can ask exactly what you need: dietary requirements, room preferences, emergency contacts, anything. Ask once per booking or once per traveller. It all lands against the booking, so nothing lives in a spreadsheet or a lost email.',
        points: [
          'Custom questions per trip',
          'Per booking or per traveller',
          'Answers attached to the booking, not your inbox',
        ],
      },
      {
        title: 'Waivers and documents, handled properly',
        body: 'Where you need a signature, the traveller signs the waiver as part of registering. Where you need a passport or ID, they upload it to a private, secure store, not an email attachment. Sensitive documents are treated as sensitive.',
        points: [
          'Digital waiver with a signature per traveller',
          'Passport and ID upload to a private store',
          'A clear view of who has completed what',
        ],
      },
    ],
    benefitsHead: 'Less admin, fewer gaps',
    benefits: [
      { icon: 'page', title: 'One source of truth', body: 'Everything about a booking in one place, ready when you need it.' },
      { icon: 'lock', title: 'Documents kept private', body: 'Passports and IDs go to a secure store, never a shared inbox.' },
      { icon: 'check', title: 'Nothing chased twice', body: 'Automated reminders nudge anyone who has not finished, so you do not have to.' },
    ],
  },
  {
    slug: 'traveller-app',
    nav: 'Traveller hub',
    icon: 'phone',
    title: 'Travellers get an app, not a receipt',
    lede: 'Every booking has its own hub: the itinerary, documents, a checklist and the details they need, all in your brand.',
    card: 'A per-booking hub with itinerary, checklist and documents.',
    splits: [
      {
        title: 'Everything in one place, from booking to boarding',
        body: 'The moment a traveller books, they get their own confirmation hub. It shows their trip, their reference, what is paid and what is left, and a checklist of anything you need them to do. They come back to it rather than emailing you.',
        points: [
          'Their trip, dates and money at a glance',
          'A checklist they tick off before they travel',
          'In your brand, not ours',
        ],
      },
      {
        title: 'Fewer questions in your inbox',
        body: 'When the traveller can see the answer themselves, they ask you less. The hub carries the practical detail, and reviews and reminders keep them moving without you lifting a finger.',
        points: [
          'Self-service answers to the common questions',
          'Gentle reminders when something is outstanding',
          'A place to leave a review after the trip',
        ],
      },
    ],
    benefitsHead: 'Looks after the traveller',
    benefits: [
      { icon: 'check', title: 'Clarity', body: 'They always know what they have booked and what is left to do.' },
      { icon: 'bell', title: 'Timely nudges', body: 'Reminders to finish registration or complete the checklist, sent for you.' },
      { icon: 'star', title: 'Reviews', body: 'A prompt to review after the trip, from someone who actually travelled.' },
    ],
  },
  {
    slug: 'widgets',
    nav: 'Widgets',
    icon: 'layers',
    title: 'Sell on your own website',
    lede: 'Drop your trips onto the site your customers already visit. A trip card, a grid of trips or a book button, in your brand.',
    card: 'Embed your trips on your own site, in your own brand.',
    splits: [
      {
        title: 'One snippet, your trips anywhere',
        body: 'Add a small snippet to your website and your trips appear on it: a single trip card, a responsive grid of everything you have on sale, or a simple book button next to your own content. It stays in step with the console, so what you publish is what shows.',
        points: [
          'A single trip, a grid, or a book button',
          'Always in sync with what you have published',
          'Your logo, colours and font, not ours',
        ],
      },
      {
        title: 'Or use the hosted page',
        body: 'Not everyone has a website they can edit easily. Every trip also has its own hosted page, so you can share a link on social, in an email or in a message and take a booking without touching any code.',
        points: [
          'A hosted page for every trip',
          'Shareable link for social and email',
          'No code, no website required',
        ],
      },
    ],
    benefitsHead: 'Meet customers where they are',
    benefits: [
      { icon: 'layers', title: 'On your site', body: 'The trip sells where your customers already are, not only on a page they have to find.' },
      { icon: 'globe', title: 'Or a hosted page', body: 'A ready-made page when you want to share a link and nothing more.' },
      { icon: 'palette', title: 'Always on brand', body: 'Whichever you choose, it wears your brand, so it feels like you.' },
    ],
  },
  {
    slug: 'ai-import',
    nav: 'AI import',
    icon: 'sparkle',
    title: 'Turn a brochure into a trip page',
    lede: 'Paste the itinerary you already have and get a trip page back, drafted and ready to tidy. The blank page problem, solved.',
    card: 'Paste an itinerary you already have, get a trip page back.',
    splits: [
      {
        title: 'The first draft, done for you',
        body: 'You have already written your trips: in a PDF, a Word document, an email. Paste that in and our importer reads it and builds a draft trip page, with the title, summary and day-by-day filled in. You review and tidy rather than starting from nothing.',
        points: [
          'Reads your existing itinerary text',
          'Drafts the page structure for you',
          'You keep full control of the result',
        ],
      },
      {
        title: 'Safe by design',
        body: 'The import only ever creates a draft, never a published page, and everything it produces runs through the same checks as anything you type yourself. It extracts what is there rather than inventing detail, so a price or a date is never made up.',
        points: [
          'Always a draft, never auto-published',
          'Extracts, does not invent',
          'The same safety checks as manual editing',
        ],
      },
    ],
    benefitsHead: 'Get set up faster',
    benefits: [
      { icon: 'sparkle', title: 'Less typing', body: 'Your catalogue goes in far quicker than building each trip by hand.' },
      { icon: 'page', title: 'Your words', body: 'It works from your own copy, so the page sounds like you from the start.' },
      { icon: 'check', title: 'You approve', body: 'Nothing goes live until you have read it and hit publish.' },
    ],
  },
  {
    slug: 'integrations',
    nav: 'API and webhooks',
    icon: 'plug',
    title: 'Wire Trips into everything else',
    lede: 'Real-time webhooks and a proper API, so your bookings flow into your CRM, your accounting and anything else you run.',
    card: 'Webhooks and an API to connect Trips to your other tools.',
    splits: [
      {
        title: 'Webhooks that tell you the moment it happens',
        body: 'Register an endpoint and Trips sends a signed event the moment a booking is made or its status changes. Push new bookings straight into your CRM, a spreadsheet or a Slack channel, without anyone rekeying anything.',
        points: [
          'Signed events on booking created and updated',
          'Sync to your CRM, accounting or a channel',
          'Verify every delivery came from us',
        ],
      },
      {
        title: 'An API for the rest',
        body: 'A clean, keyed API lets your own systems read your bookings and push trips in. Pair it with the bookings export and you have everything you need to keep your accounts and your reporting in step.',
        points: [
          'Read your bookings programmatically',
          'Create trips from your own inventory',
          'A bookings CSV export for your accounts',
        ],
      },
    ],
    benefitsHead: 'Fits your stack',
    benefits: [
      { icon: 'plug', title: 'Real time', body: 'Webhooks push the moment something changes, so nothing lags behind.' },
      { icon: 'route', title: 'Two-way', body: 'Read bookings out, push trips in. The data flows both ways.' },
      { icon: 'chart', title: 'Books that balance', body: 'Export to CSV so your accounting reconciles with what the platform shows.' },
    ],
  },
  {
    slug: 'white-label',
    nav: 'White-label',
    icon: 'palette',
    title: 'It looks like you, not like us',
    lede: 'Your logo, colours and typeface from the trip page to the confirmation email. Turn off the Travelgenix credit entirely.',
    card: 'Your brand from the trip page to the emails, end to end.',
    splits: [
      {
        title: 'One brand, the whole way through',
        body: 'The trip page, the booking form, registration, the confirmation hub and the emails all wear your brand. A traveller moves from your website to booking to their confirmation without ever feeling handed off to a third party.',
        points: [
          'Your logo, colours and font throughout',
          'Branded confirmation and reminder emails',
          'A consistent journey from first click to boarding',
        ],
      },
      {
        title: 'Remove our name completely',
        body: 'A small credit sits in the footer by default. Switch it off and there is no Travelgenix mark anywhere your travellers can see. As far as they are concerned, it is your platform.',
        points: [
          'One switch to remove the credit',
          'No Travelgenix mark on your public pages',
          'Custom domains on the higher plans',
        ],
      },
    ],
    benefitsHead: 'Your name front and centre',
    benefits: [
      { icon: 'palette', title: 'Fully themed', body: 'Every surface a traveller sees carries your brand, not a generic tool.' },
      { icon: 'lock', title: 'Trust stays with you', body: 'The traveller trusts your name, because your name is the only one they see.' },
      { icon: 'globe', title: 'Your domain', body: 'Put it on your own web address on the plans that include custom domains.' },
    ],
  },
  {
    slug: 'reporting',
    nav: 'Reporting',
    icon: 'chart',
    title: 'Know where you stand',
    lede: 'Money across every trip in one view, and an export that drops straight into your accounts.',
    card: 'Money across every trip, and a clean export for your accounts.',
    splits: [
      {
        title: 'The whole picture, not one trip at a time',
        body: 'See what you have booked, what you have collected and what is still outstanding across everything you have on sale. The figures reconcile with what you and your travellers see on screen, so there is one version of the truth.',
        points: [
          'Booked, collected and outstanding at a glance',
          'Across every trip and every departure',
          'Figures that match the booking screens',
        ],
      },
      {
        title: 'Ready for your accountant',
        body: 'Download a finance ledger of every booking as a CSV, ready to import into your accounting software or hand to your bookkeeper. The money columns follow the same rules as the reports, so nothing has to be reconciled by hand.',
        points: [
          'One-click bookings CSV export',
          'Import to QuickBooks, Xero or a spreadsheet',
          'Collected and outstanding worked out for you',
        ],
      },
    ],
    benefitsHead: 'Clarity on the numbers',
    benefits: [
      { icon: 'chart', title: 'One view', body: 'Every trip’s money in one place, refreshed as bookings come in.' },
      { icon: 'page', title: 'Clean export', body: 'A ledger your accounts software understands, with no manual tidying.' },
      { icon: 'users', title: 'Team-ready', body: 'Give the right people a look without handing over the keys.' },
    ],
  },
];

// --- solution pages --------------------------------------------------------

export const SOLUTIONS: PageContent[] = [
  {
    slug: 'travel-agents',
    nav: 'Travel agents',
    icon: 'handshake',
    title: 'Group travel, without giving away your margin',
    lede: 'Sell escorted tours and group departures on beautiful pages, take the booking, and keep every pound of the payment in your own account.',
    card: 'Sell escorted tours and group departures, keep your margin.',
    splits: [
      {
        title: 'Built for how agents actually sell',
        body: 'You already know your groups and your suppliers. Trips gives you the pages, the bookings and the traveller admin around them, so you spend your time selling rather than wrestling a system that was built for something else.',
        points: [
          'Escorted tours and group departures',
          'Deposits and balances the way you run them',
          'Traveller details, waivers and documents in one place',
        ],
      },
      {
        title: 'Keep the economics on your side',
        body: 'You are the merchant, so the money lands in your own account at your own rate and we take nothing per booking. On real volume that is a meaningful saving against a platform that takes a cut of every transaction.',
      },
    ],
    benefitsHead: 'Why agents choose Trips',
    benefits: [
      { icon: 'wallet', title: 'Your money', body: 'Payments settle to your own Stripe, not a platform’s balance.' },
      { icon: 'page', title: 'Pages that sell', body: 'Brochure-quality trip pages that do justice to your programme.' },
      { icon: 'layers', title: 'On your site', body: 'Embed your trips on the website you already have.' },
    ],
  },
  {
    slug: 'tour-operators',
    nav: 'Tour operators',
    icon: 'route',
    title: 'Run your whole programme in one place',
    lede: 'Many trips, many departures, many travellers. Trips keeps capacity, bookings and payments straight so your team can breathe.',
    card: 'Many trips and departures, capacity and payments kept straight.',
    splits: [
      {
        title: 'Capacity that holds up',
        body: 'Run a full programme of departures with capacity per date and per room, packages and add-ons, and a booking flow that never oversells. Waitlists fill the gaps when a popular date sells out.',
        points: [
          'A catalogue of trips and departures',
          'Per-departure and per-room capacity',
          'Waitlists on sold-out dates',
        ],
      },
      {
        title: 'A team that can see everything',
        body: 'Give owners, managers and viewers the right level of access, broadcast to everyone on a trip at once, and keep your reporting and your accounts in step with a clean export.',
        points: [
          'Owner, manager and viewer roles',
          'Broadcast messaging to a whole trip',
          'Cross-trip reporting and a bookings export',
        ],
      },
    ],
    benefitsHead: 'Made for scale',
    benefits: [
      { icon: 'calendar', title: 'Many departures', body: 'The same trip across as many dates as you run, each tracked on its own.' },
      { icon: 'users', title: 'A real team', body: 'Roles so the right people can do the right things, and no more.' },
      { icon: 'plug', title: 'Connected', body: 'Webhooks and an API to feed your CRM and accounting.' },
    ],
  },
  {
    slug: 'retreats-wellness',
    nav: 'Retreats and wellness',
    icon: 'sparkle',
    title: 'Fill your retreats, keep the calm',
    lede: 'Beautiful pages for your retreats, deposits to secure a place, and a traveller experience as considered as the retreat itself.',
    card: 'Beautiful retreat pages, deposits, and a calm traveller journey.',
    splits: [
      {
        title: 'A page that feels like the retreat',
        body: 'Your photography, your words and your rooms, on a page that sets the tone before anyone arrives. Offer room options and add-ons, and let a deposit hold a place while someone decides.',
        points: [
          'Room options and priced add-ons',
          'Deposits to hold a place',
          'Your brand and your imagery throughout',
        ],
      },
      {
        title: 'Look after every guest',
        body: 'Collect dietary needs and health notes with your own questions, gather waivers where you need them, and give each guest a calm hub with everything they need before they travel.',
      },
    ],
    benefitsHead: 'Considered, end to end',
    benefits: [
      { icon: 'palette', title: 'On brand', body: 'A page and a journey that match the care you put into the retreat.' },
      { icon: 'shield', title: 'The right questions', body: 'Dietary, health and preference questions, asked once and kept together.' },
      { icon: 'phone', title: 'A calm hub', body: 'Guests find their details themselves rather than emailing you.' },
    ],
  },
  {
    slug: 'school-group-trips',
    nav: 'School and group trips',
    icon: 'users',
    title: 'Group trips with the paperwork under control',
    lede: 'Collect every traveller, every consent and every document in one place, and take deposits without chasing cheques.',
    card: 'Collect every traveller, consent and document in one place.',
    splits: [
      {
        title: 'Every traveller accounted for',
        body: 'Register each person on the trip with the details you need, gather consents and waivers with a signature, and collect documents to a secure store. You always know who has completed what.',
        points: [
          'A record for every traveller',
          'Consents and waivers with a signature',
          'Documents to a private, secure store',
        ],
      },
      {
        title: 'Money without the shoebox',
        body: 'Take deposits and balances online instead of collecting cheques, and see exactly who has paid and who has not, at a glance, across the whole group.',
      },
    ],
    benefitsHead: 'Organised from day one',
    benefits: [
      { icon: 'check', title: 'Nothing missed', body: 'A clear view of who has registered, consented and paid.' },
      { icon: 'lock', title: 'Documents safe', body: 'Sensitive documents go to a secure store, not a staff inbox.' },
      { icon: 'bell', title: 'Reminders sent', body: 'The system nudges anyone who has not finished, so you do not have to.' },
    ],
  },
  {
    slug: 'adventure-active',
    nav: 'Adventure and active',
    icon: 'map',
    title: 'Sell the adventure, handle the logistics',
    lede: 'Multi-day trips, kit lists, waivers and fitness notes, all handled around a booking page that does the trip justice.',
    card: 'Multi-day trips, waivers and kit, around a page that sells.',
    splits: [
      {
        title: 'A page worthy of the trip',
        body: 'Show the route day-by-day, the grading and what is included, with your own photography carrying the sense of the place. Offer add-ons like kit hire or extra nights, and take a deposit to hold a spot.',
        points: [
          'Day-by-day itinerary or a timeline',
          'Add-ons for kit, transfers or extra nights',
          'Deposits to secure a place',
        ],
      },
      {
        title: 'The safety admin, sorted',
        body: 'Collect fitness and medical notes with your own questions, take signed waivers per traveller, and gather any documents you need, all before anyone sets off.',
      },
    ],
    benefitsHead: 'Ready for the off',
    benefits: [
      { icon: 'map', title: 'Tells the story', body: 'A page that makes the trip feel as good as it is.' },
      { icon: 'shield', title: 'Waivers handled', body: 'Signed waivers and health notes gathered at booking, per traveller.' },
      { icon: 'ticket', title: 'Add-ons', body: 'Sell kit hire, transfers and extras alongside the trip itself.' },
    ],
  },
];

export function featureBySlug(slug: string): PageContent | undefined {
  return FEATURES.find((f) => f.slug === slug);
}
export function solutionBySlug(slug: string): PageContent | undefined {
  return SOLUTIONS.find((s) => s.slug === slug);
}
