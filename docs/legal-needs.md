# What the privacy and terms pages still need from the owner

The pages `/privacy` and `/terms` (`src/legal.jsx`) are drafts. Every yellow `[placeholder]` on them needs an answer. Until then both pages are marked `noindex` in `src/lib/pageMeta.js` (remove `noindex: true` from `privacy` and `terms`, and add them to `sitemapPaths`, when they are final). Have a lawyer read both before launch.

## Both pages
- Legal business name and mailing address (the sheet says "Loves Blinds and Window Treatments").
- The "last updated" date.

## Privacy policy
- How long you keep orders and messages (and whether you delete on request).
- Who your suppliers and carriers are, or whether "our manufacturing partners" is enough.
- Whether you sell to people in California, the EU or the UK. If so, extra rights and wording apply.
- Confirm that you run no analytics or ad trackers (the site has none today).

## Terms of sale
- Payment: which methods, and when (for example a deposit before production).
- Typical production time and shipping time.
- Shipping: cost, countries, carriers, who pays customs and duties.
- Returns and cancellations for made-to-measure items; whether a deposit is refundable; how many days a customer has to report damage.
- Who pays if a customer's measurement is wrong.
- Samples: offered or not, free or paid.
- Warranty: length, what is covered, what is not, how to claim.
- Installation: offered, or customer installs.
- Limitation of liability and governing law (state).
