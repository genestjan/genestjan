# Fetch GenSan audit (1 November 2026)

Method: type check, unit tests, full end-to-end runs of both apps in a phone-sized browser
(Playwright), review of the database security rules, and a line-by-line pass over the
booking, payment and points logic.

## Fixed during the audit

| # | Problem | Impact | Fix |
|---|---|---|---|
| 1 | Chat crashed the app on open (effect returned a Promise from `scrollIntoView`) | Blank screen when tapping Chat | Effect body wrapped in braces |
| 2 | Chat and George opened behind the map (z-index below Leaflet panes) | Could not chat | Raised overlays above the map |
| 3 | Driver could never update a trip in live mode (upsert also checks the customer-only INSERT rule) | Accept, arrive, meter and complete would all fail | Separate insert and update calls |
| 4 | Users could approve their own ID by editing their profile | Fake accounts | Database trigger keeps `verified` unless changed from the dashboard |
| 5 | Drivers could edit their own rating | Fake ratings | Trigger protects `rating` and `ratingCount` |
| 6 | Points and wallet written from the phone | Free points | Live mode: only the `settle_trip` database trigger changes points |
| 7 | Points could pay a whole fare | Driver underpaid | Points capped at half the fare |
| 8 | Profile email showed the account ID in live mode | Wrong data | Email saved at login |
| 9 | "Pabili ng ... from KCC" put the store in "Deliver to" | Wrong booking | Store goes to "Buy from" |
| 10 | George button covered driver prices and the rewards card | Hidden information | Moved, and shown only on the map screen |
| 11 | Map fit put the car under the bottom panel | Could not see the driver | Fit bounds keep markers in the top half |
| 12 | Car jumped when the routing server was unreachable | Looked broken | Fallback route split into steps |
| 13 | Logo intro wordmark overlapped the logo on wide screens | Ugly intro on tablets and desktop | Intro laid out as a column |

## Open risks (not fixable from here, in priority order)

1. **Payments are not verified automatically.** GCash and bank transfers go straight to the driver;
   the driver confirms with the reference number. Automatic checking needs PayMongo or Xendit
   (business registration, about 2.5% per GCash payment). Recommended once you have volume.
2. **Live mode is untested against a real Supabase project.** The schema and code follow
   Supabase's documented APIs, but run a full trip on two real phones before launch.
3. **Calls use the normal phone dialler**, so numbers are visible to the other party during a
   booking. Private in-app voice calls need a paid service (Agora, Twilio, about US$1 per 1,000
   minutes) plus a TURN server.
4. **ID photos are stored inside the profile row.** Fine for the first few hundred users; move to
   Supabase Storage (private bucket) before scaling.
5. **Map tiles and routing use free public OpenStreetMap servers**, which forbid heavy commercial
   use. Before launch, switch to MapTiler or Stadia Maps (free tiers of about 100,000 map loads a
   month) by changing the tile URL in `src/ui/MapView.tsx`.
6. **Voice input does not work inside the Android APK** (Android WebView has no speech
   recognition). Typing to George works; voice works in Chrome and Safari.
7. **Background location on iPhone:** web apps stop sending GPS when the screen is off. Drivers
   on iPhone should keep the app open while on a trip. The Android APK has the same limit
   unless a native background-location plugin is added.
8. **Either party can edit any trip field** (RLS is row-level). A malicious user could change a
   fare. The driver still confirms the amount before "Payment received". Tighten with a
   server function per status change before scaling.
9. **APK is debug-signed.** It installs fine, but for Google Play you need a release signing key
   (see the Monggols workflow for the same pattern) and a US$25 Play developer account.
10. **Legal:** ride-hailing for passengers is regulated by the LTFRB (TNVS accreditation).
    Pabili and parcel delivery are less regulated. Get advice before taking passengers commercially.
    Also register with the National Privacy Commission, since you store IDs.
