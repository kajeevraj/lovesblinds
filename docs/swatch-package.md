# Love's Blinds swatch package

Contents
- `public/images/swatches/<line>/<code>.jpg`  600 px swatch image
- `public/images/swatches/<line>/<code>-thumb.jpg`  160 px square thumbnail
- `src/data/swatches.json`  fabrics and swatches

Lines: `roller`, `zebra`, `shangri-la`, `cellular`, `dream-curtains`, `drapery` (the Drapery fabrics are shared with Roman; each record has `lines: ["roman","drapery"]`).

Counts: roller 133 (screen-view 54, solar 35, blackout 44), zebra 88, shangri-la 21, cellular 33 (blackout 16, light-filtering 17), dream-curtains 39, drapery/roman 123. Total 437 swatches, 89 fabrics.

## swatches.json
`fabrics[]`: `id, line, lines, family, fabric, specs`
`swatches[]`: `id, fabricId, line, lines, family, fabric, code, colorName, image, thumb, imageKind, ...`

Rules
- `code` and `colorName` are exactly as printed in the catalogs. Never edit them.
- `family` is `screen-view | solar | blackout` for roller, `blackout | light-filtering` for cellular, otherwise null.
- `colorName` is null for drapery/roman. Show the collection name (`fabric`) plus the code.
- `imageKind: "hero"` means the thumbnail was cropped from a fabric photo. It is still the correct color.
- `specs` fields are shown only when present. A null or missing value means do not display it.
- Roller `specs.openness` (Screen View) or `specs.opacity` (Solar, Blackout).
- Dream Curtains: `styles` is a list of `{style, code, image, thumb}`. An empty list means the catalog prints one code with no style letter: show no style choice.
- Drapery/Roman: `romanStyles` has relax, flat, plain-fold, ribble, hobble, each `{available, linings}`. `linings` can include `blackout` and `light-filtering`. `grade` (A to E) is stored but not shown to customers.
- Image paths start with `/images/swatches/` and resolve from `public/`.
