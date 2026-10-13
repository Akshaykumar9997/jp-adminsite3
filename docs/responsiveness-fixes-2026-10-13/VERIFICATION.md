# JP responsiveness fixes — 13 October 2026

Implemented the nine UI findings from the original responsiveness audit across the admin and client repositories. Changes are local and have not been deployed to Vercel.

## Changes

| Area | Result |
| --- | --- |
| Admin navigation | Home, Leads, Rooms, Gallery and More fit on phones. More opens the complete navigation drawer. Its links scroll independently so the last screens remain reachable in short landscape views. Added an explicit close control and dialog semantics. |
| Admin CRM | Mobile records use readable cards with contact, date, status and message information. Expandable details preserve every field. Desktop tables, pagination, filters and export remain available. |
| Admin narrow layouts | Removed the body minimum width that caused scrollbar-related overflow. Login and administrator form inputs use 16px text. Dashboard descriptions now flow below values instead of overlapping them. |
| Client tablet layouts | Mobile navigation and single-column hero/form layouts now extend through 820px. Category cards use two columns through 900px. |
| Client phone layouts | Home section titles stack above their subtitles. Support district and email fields stack at narrow widths. Text inputs use 16px text; phone location filtering also uses 16px. |
| Client image viewer | Thumbnails retain their 68px width and scroll horizontally instead of shrinking. Safe-area spacing remains in place. |
| Local review | Hid the development indicator that obstructed the client Home link. The client preview runs the production build. |

## Verification

- Both production builds passed, including TypeScript checks. Admin Vite still reports its existing large-bundle advisory.
- Admin main screens were checked at 320px and 1440px. Populated media library and room details were checked again at 320px, including the image viewer and work editor.
- CRM layouts were checked at 320, 360, 390, 430, 600, 601, 768, 820, 821, 1024 and 1440px. Mobile cards appear through 820px; desktop tables appear from 821px.
- All 13 mobile lead fields match the corresponding desktop table cells. Selecting an unmatched status produces the empty state; clearing filters restores the record.
- The mobile drawer reached Manage Admins at 780×390. Admin sign-in was verified again at 320px, with 16px inputs and no horizontal page overflow.
- Client home was measured from 320px through 1440px, including both sides of the 600px and 820px breakpoints. Enquiry, materials and works were checked at 320, 601, 820, 821 and 1440px.
- At 320px, support inputs are 230px wide with 16px text. Changing preferred contact to Email correctly makes the email field required.
- The six-image viewer retains 68px thumbnails, and the sixth asset can be selected through the scrolling strip.
- No page-level horizontal overflow was measured in these checks. Raw geometry measurements and screenshots are saved beside this document.

These are browser viewport checks on this computer. Physical-device keyboard behavior and Safari rendering still need device testing. Published materials, partners and 3D assets were unavailable in the supplied data; their populated states could not be verified. No content edits, uploads, deletions, enquiry submissions or support submissions were made. Authorized labelled visitor entries were used to pass the mandatory client entry form.

## Running previews

- Admin: http://127.0.0.1:5173/ — Vite development server.
- Client: http://127.0.0.1:3000/ — Next.js production server.

Both servers remain running on this computer. Use the existing admin credentials; client entry accepts your own details.
