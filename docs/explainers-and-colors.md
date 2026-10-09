# Explainer pictures and color families

## Explainer pictures (`public/explainers/`)
Keys are the path without the extension, for example `control/roller-chain`. `npm run build` converts rasters to WebP
(`public/explainers-opt/`) and writes `src/data/explainers.json`. A raster with the same name as an `.svg` wins, so a photo
dropped in as `public/explainers/mount/inside.jpg` replaces `inside.svg` with no code change.

| Folder | Used for |
|---|---|
| `control/` | Control step for Roller, Zebra, Roman (`<line>-chain`, `-cordless`, `-motorized`). Remote, Matter and other motors share the motorized picture. |
| `roman-styles/` | Roman style step: relax, flat, plain-fold, ribble, hobble |
| `drapery-pleats/` | Curtain pleat step (all 8 pleats) |
| `cellular-types/` | Cellular product type step |
| `mount/` | Inside vs outside mount (SVG, brand palette) |
| `roller/` | Single vs double-stack (SVG) |
| `shangri-la/` | Horizontal shade vs sheer vertical blind (SVG) |
| `dream-curtains/` | Style A vs Style B (SVG; A 41 cm = 12.5/16/12.5, B 33 cm = 10/13/10) |
| `measure/` | Measure Guide diagrams (OM = outside mount, IM = inside mount, W = width, H = height) |

Not used: `roman-styles/valance-options`, `double`, `2-in-1`, `top-down-bottom-up` (no matching option in the order flow), `control/roman-chain` (Roman has no chain control).

## Color families
Eleven families: White, Cream/Ivory, Beige/Tan, Gray, Charcoal/Black, Brown, Blue, Green, Pink/Red, Purple, Pattern/Multi (`src/data/colorFamilyList.js`).

Order of precedence, highest first:
1. `src/data/colorFamilyOverrides.json` (`{ "<swatch id>": "<family>" }`), never touched by the scripts.
2. A family word in the swatch's color name (white, ivory, cream, beige, tan, sand, khaki, latte, gray/grey, silver, charcoal, black, brown, coffee, chocolate, blue, navy, green, pink, red, purple, lilac, mauve). With several words, the first one wins ("White Grey" is White).
3. Image analysis of the thumbnail (LAB average of the center area, plus a pattern check; zebra tiles are classified by their colored band). Used only where the name has no family word, mainly Roman and Curtains.

`src/data/colorFamilyReviewed.json` (`{ "<swatch id>": "<family>" }`) marks image-decided tiles you have checked: they stop being flagged in the report while the family stays the same. It does not change any family.

Commands: `npm run color-families` writes `src/data/colorFamilies.json`. `npm run color-report` writes `docs/color-review.html` (open it from GitHub, or locally) and a copy in the git-ignored `reports/`. In the report, change a tile's family with its dropdown and paste the JSON it builds into the overrides file. `npm run validate-catalog` fails if a swatch has no family or an override names an unknown swatch or family.

## Display names (customer-facing color names)
- `src/data/displayNames.json` maps swatch id to the name customers see. It is separate from the supplier data, which keeps its color name and code exactly as stored.
- Rules (enforced by `npm run validate-catalog`): every swatch has one, unique within its product line (roller, zebra, shangri-la, cellular, dream-curtains, drapery; Roman and Curtains share the drapery records). Roller and Cellular only need to be unique within a family, because their picker shows one family at a time, no digits, no supplier collection name, no supplier code.
- Customers see the display name with the code. The collection name and the supplier's color name appear nowhere customer-facing. The internal order email and the spreadsheet keep the supplier collection, color name and code; the spreadsheet's original nine columns are unchanged and `Supplier code` and `Display name` are appended after `Total`.
- `docs/display-names.html` is a review sheet: photo, name now, proposed name, code. Edit a name in its box and paste the JSON it builds into `displayNames.json`.
- `scripts/migrations/propose-display-names.mjs` produced the first proposal (it never overwrites an existing `displayNames.json` without `--force`). `display-name-manual.json` beside it holds hand-written names.
