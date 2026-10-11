# Stage 1 plan: supplier pricing and product options (admin only)

Branch `claude/supplier-pricing-stage1` (from `main`, which already contains the merged admin work). Nothing here is built yet.
The workbooks sit in `private/` (git-ignored). Customers see no change in this stage.

## 0. What arrived
| Workbook | Sheets read | Notes |
|---|---|---|
| roller | cord, cordless, Motor | 81 grids, 85,902 cost cells |
| zebra | cord, cordless, motor, 特殊尺寸 (special sizes) | 36 grids, 40,540 cells |
| roman | cord, cordless, motor | 6 grids (light-filtering and blackout per system), 4,608 cells |
| shangri-la | one sheet, cord grids + motor remarks | 6 grids, 5,940 cells |
| cellular | Normal, Top down bottom up, DAY&NIGHT | 6 grids, 5,742 cells |
| dream curtains | MANUL, MOTOR (the `--` tab was never read, printed or stored) | 2 grids, 18,228 cells |
| woven wood | **not received** | only six of the seven files arrived |
Total 137 grids, 160,960 cost cells. All values are read as the numbers the sheets show (formula results).

## 1. Data model (all new tables admin-only)
```
pricing_lines      id (roller, zebra, shangri-la, roman, cellular, dream-curtains, drapery), name, price_on_request, markup (default 0.50)
collection_markups fabric_id -> markup override (optional)
price_grids        id, line, system (cord | cordless | motor | manual), variant (light-filtering | blackout | standard |
                   top-down-bottom-up | day-night | all), label, roll_width, special boolean, multiplier (1 or 1.1),
                   width_axis numeric[], height_axis numeric[], cost numeric[] (row-major, NULL = no price), source_file/sheet/range
grid_fabrics       grid_id, fabric_id  (which collections each grid covers; one grid per fabric + system + variant)
price_adders       id, line, label, kind (add | subtract | multiply), amount, applies_when jsonb ({"control":["matter"]}), source text, verified, active
price_imports      id, line, file name, sha256, at, by, summary jsonb
product_lines / option_groups / option_values / size_rules   (the Phase 2 schema, plus option_values.grid_system and product_lines.price_on_request)
```
- Row Level Security: all of the above readable and writable by admins only. No grants to anon.
- Customers get a price only through `estimate_price(...)` (security definer). It returns `{price, custom_size}` and nothing else.
  A second function, `estimate_price_debug(...)`, checks `is_admin()` and returns cost, grid cell, adders and markup for the price checker.
- Lookup: round width and height UP to the next axis value; a blank cell or a size past the last axis value means `custom_size`.
- Price = round((grid cost x multiplier + adders) x (1 + markup)), whole dollars. Markup is the collection override if there is one, else the line's.
- Triggers: the audit trigger is attached to every new table.

## 2. Collection mapping
### Roller (41 sheet entries; 3 systems)
| Sheet collection | Family | Roll width (sheet) | Our fabric id | Roll width (ours) | Grid blocks (sheet cell of title) | Note |
|---|---|---|---|---|---|---|
| Breezy | blackout | 78 | `roller:blackout:breezy` | 78 in | cord: B103, cordless: B83, motor: B103 |  |
| Danaus | blackout | 118 | `roller:blackout:danaus` | 118 in | cord: CB103, cordless: BJ83, motor: CB103 |  |
| Eris | blackout | 98 | `roller:blackout:eris` | 98 in | cord: EB2, cordless: CX2, motor: EB2 |  |
| Gaea | blackout | 110 | - | - | cord: CO2, cordless: BT2, motor: CO2 | **no fabric in our DB** |
| Magic | blackout | 110 | `roller:blackout:magic` | 110 in | cord: DB103, cordless: CD83, motor: DB103 |  |
| Pixels | blackout | 90 | `roller:blackout:pixels` | 90 in | cord: DB2, cordless: CD2, motor: DB2 |  |
| Serenity | blackout | 110 | `roller:blackout:serenity`, `roller:blackout:serenity-2` | 110 in | cord: DO103, cordless: CN83, motor: DO103 |  |
| Stone | blackout | 110 | `roller:blackout:stone` | 110 in | cord: B204, cordless: B164, motor: B204 |  |
| Sundance | blackout | 110 | `roller:blackout:sundance` | 110 in | cord: CO2, cordless: BT2, motor: CO2 |  |
| UrbanChic | blackout | 110 | `roller:blackout:urbanchic` | 110 in | cord: BO103, cordless: AZ83, motor: BO103 |  |
| Ushas | blackout | 118 | `roller:blackout:ushas` | 118 in | cord: O103, cordless: L83, motor: O103 |  |
| Breezy | screen-view | 118 | `roller:screen-view:breezy` | 118 in | cord: O204, cordless: L164, motor: O204 |  |
| Danaus | screen-view | 118 | `roller:screen-view:danaus` | 118 in | cord: CB103, cordless: BJ83, motor: CB103 |  |
| Eris | screen-view | 118 | `roller:screen-view:eris` | 118 in | cord: AB204, cordless: V164, motor: AB204 |  |
| Gaea | screen-view | 118 | `roller:screen-view:gaea` | 118 in | cord: AO103, cordless: AF83, motor: AO103 |  |
| Harmony | screen-view | 118 | `roller:screen-view:harmony` | 118 in | cord: B2, cordless: B2, motor: B2 |  |
| Lumina | screen-view | 118 | `roller:screen-view:lumina` | 118 in | cord: CB103, cordless: BJ83, motor: CB103 |  |
| Magic | screen-view | 118 | - | - | cord: FB2, cordless: DR2, motor: FB2 | **no fabric in our DB** |
| Nestility | screen-view | 98/118 | `roller:screen-view:nestility` | 98 in / 118 in | cord: CO103, cordless: BT83, motor: CO103 |  |
| Pixels | screen-view | 118 | `roller:screen-view:pixels` | 118 in | cord: AO103, cordless: AF83, motor: AO103 |  |
| Purity | screen-view | 118 | `roller:screen-view:purity` | 118 in | cord: AO204, cordless: AF164, motor: AO204 |  |
| Serenity | screen-view | 118 | `roller:screen-view:serenity` | 118 in | cord: O204, cordless: L164, motor: O204 |  |
| Solarium | screen-view | 118 | `roller:screen-view:solarium` | 118 in | cord: DO2, cordless: CN2, motor: DO2 |  |
| Spring | screen-view | 118 | `roller:screen-view:spring` | 118 in | cord: CB103, cordless: BJ83, motor: CB103 |  |
| Stone | screen-view | 118 | `roller:screen-view:stone` | 98 in / 118 in | cord: AO103, cordless: AF83, motor: AO103 |  |
| Sundance | screen-view | 98 | `roller:screen-view:sundance` | 118 in | cord: AB103, cordless: V83, motor: AB103 | **roll width differs** |
| UrbanChic | screen-view | 118 | `roller:screen-view:urbanchic` | 118 in | cord: CB103, cordless: BJ83, motor: CB103 |  |
| Ushas | screen-view | 118 | `roller:screen-view:ushas` | 118 in | cord: CB2, cordless: BJ2, motor: CB2 |  |
| Aquarius | solar | 90 | `roller:solar:aquarius` | 90 in | cord: O2, cordless: L2, motor: O2 |  |
| Aries | solar | 110 | `roller:solar:aries` | 110 in | cord: BB103, cordless: AP83, motor: BB103 |  |
| Capricorn | solar | 90 | `roller:solar:capricorn` | 90 in | cord: BO2, cordless: AZ2, motor: BO2 |  |
| Gemini | solar | 110 | `roller:solar:gemini` | 110 in | cord: EO2, cordless: DH2, motor: EO2 |  |
| Leo | solar | 110 | `roller:solar:leo` | 110 in | cord: BB2, cordless: AP2, motor: BB2 |  |
| Libra | solar | 118 | `roller:solar:libra` | 118 in | cord: FB2, cordless: DR2, motor: FB2 |  |
| Pisces | solar | 98 | `roller:solar:pisces` | 98 in | cord: AB2, cordless: V2, motor: AB2 |  |
| Sag | solar | 118 | `roller:solar:sag` | 118 in | cord: B2, cordless: B2, motor: B2 |  |
| Scorpio | solar | 110 | `roller:solar:scorpio` | 110 in | cord: EO2, cordless: DH2, motor: EO2 |  |
| Taurus | solar | 110 | `roller:solar:taurus` | 110 in | cord: EO2, cordless: DH2, motor: EO2 |  |
| Virgo | solar | 118 | `roller:solar:virgo` | 118 in | cord: AO2, cordless: AF2, motor: AO2 |  |
| Pansy | ? | 110 | `roller:blackout:pansy` | 118 in | cord: EO2, cordless: DH2, motor: EO2 | **roll width differs** listed untyped ("new") under the Taurus solar grid |
| Violet | ? | 110 | `roller:blackout:violet` | 110 in | cord: EO2, cordless: DH2, motor: EO2 | listed untyped ("new") under the Taurus solar grid |

Our roller fabrics with **no** grid: `roller:blackout:gare` (1 swatches).

### Zebra (20 sheet entries; 3 systems + special sizes)
| Sheet collection | Family | Roll width (sheet) | Our fabric id | Roll width (ours) | Grid blocks (sheet cell of title) | Note |
|---|---|---|---|---|---|---|
| Ceres | - | 118 | `zebra:-:ceres` | 118 in | cord: AO2, cordless: AF2, motor: BB2 |  |
| Comet | - | 118 | `zebra:-:comet` | 118 in | cord: AB101, cordless: V81, motor: AB101 |  |
| Earth | - | 118 | `zebra:-:earth` | 118 in | cord: CB2, cordless: AZ2, motor: CO2 |  |
| Earth Eclipse | - | 118 | `zebra:-:earth-eclipse` | 118 in | cord: B101, cordless: B81, motor: B101 |  |
| Galaxy | - | 118 | `zebra:-:galaxy` | 118 in | cord: BB2, cordless: AP2, motor: BO2 |  |
| Jupiter | - | 118 | `zebra:-:jupiter` | 118 in | cord: AO2, cordless: AF2, motor: BB2 |  |
| Mars | - | 118 | `zebra:-:mars` | 118 in | cord: AB2, cordless: V2, motor: AO2 |  |
| Mercury | - | 112 | `zebra:-:mercury` | 118 in | cord: B2, cordless: B2, motor: O2 | **roll width differs** |
| Meteor | - | 112 | `zebra:-:meteor` | 118 in | cord: BO2, cordless: AP2, motor: CB2 | **roll width differs** |
| Moon | - | 112 | `zebra:-:moon` | 118 in | cord: B2, cordless: B2, motor: B2 | **roll width differs** |
| Nebula | - | 112 | `zebra:-:nebula` | 118 in | cord: B2, cordless: B2, motor: O2 | **roll width differs** |
| Neptune | - | 112 | `zebra:-:neptune` | 118 in | cord: B2, cordless: B2, motor: O2 | **roll width differs** |
| Orchid | - | 118 | `zebra:-:orchid` | 118 in | cord: O101, cordless: L81, motor: O101 |  |
| Pluto | - | 118 | `zebra:-:pluto` | 118 in | cord: B101, cordless: B81, motor: B101 |  |
| Polaris | - | 118 | `zebra:-:polaris` | 118 in | cord: CO2, cordless: BJ2, motor: DO2 |  |
| Saturn | - | 118 | `zebra:-:saturn` | 118 in | cord: O101, cordless: L81, motor: O101 |  |
| Sun | - | 118 | `zebra:-:sun` | 118 in | cord: B101, cordless: B81, motor: B101 |  |
| Tulip | - | 118 | `zebra:-:tulip` | 118 in | cord: O101, cordless: L81, motor: O101 |  |
| Uranus | - | 118 | `zebra:-:uranus` | 118 in | cord: O2, cordless: L2, motor: AB2, special: B1 |  |
| Venus | - | 118 | `zebra:-:venus` | 118 in | cord: CB2, cordless: AZ2, motor: DB2, special: B106 |  |

Our zebra fabrics with **no** grid: none.

Special sizes (特殊尺寸) cover **Uranus and Venus only**; widths up to 154 in.

### Shangri-La (one grid per group; cord system, motors as adders)
| Sheet group | Our fabric ids | Grid width range | Grid drop range | "Max Length" (sheet) |
|---|---|---|---|---|
| Hermes | `shangri-la:-:hermes` | 24-112 | 23-112 | 98.4 |
| Cronus | `shangri-la:-:cronus` | 24-118 | 23-112 | 118 |
| Apollo + Hera (shared grid) | `shangri-la:-:apollo`, `shangri-la:-:hera` | 24-112 | 23-112 | 98.4 / 110.2 |
| Alastor | `shangri-la:-:alastor` | 24-96 | 23-112 | 78.7 |
| Erebus + Hestia (shared grid) | `shangri-la:-:erebus`, `shangri-la:-:hestia` | 24-112 | 23-112 | 110.2 / 98.4 |
| Aphrodite | `shangri-la:-:aphrodite` | 24-72 | 23-112 | 66.9 |
All 8 of our fabrics have a grid; every sheet group has a fabric. Our fabrics store a 118 in roll width for all eight; the sheet gives lengths, not roll widths.

### Cellular
One fabric (`cellular:-:cellular-shades`). Six grids: {Normal, Top-down/bottom-up, Day & Night} x {light-filtering, blackout}. Chosen by the type and the swatch's family. Widths 24-99 (11 columns), heights 21-107.

### Roman
**No collection dimension.** Two grids per system, chosen by lining (light-filtering or blackout), shared by all 12 drapery collections. Systems: cord, cordless, motor. Widths 24-104 (cordless 24-96), drops 23-94. Our fabrics carry a grade (A-E) that the sheet does not price.

### Dream Curtains
One grid pair (manual / motor) shared by all 7 collections. Widths 24-352 in (step 8), heights 12-228 in (step 1), fully filled.

### Drapery (curtains)
No cost sheet: 12 collections, 123 swatches. The line is marked "price on request".

## 3. Adders and deductions found in the sheets
| # | Line / sheet | Text in the sheet | Parsed as | Applies when | Notes |
|---|---|---|---|---|---|
| 1 | Roller, all 3 sheets | No fabric warp for cassette -$3 | subtract 3 (cost) | option "no fabric wrap on the cassette" | no such option in the configurator today |
| 2 | Roller, all 3 sheets | No fabric warp for bottom rail -$3 | subtract 3 | option "no fabric wrap on the bottom rail" | same |
| 3 | Roller, Motor sheet | Bluetooth motor extra +$ 40 | add 40 | control = Matter smart motor | I read "Bluetooth" as Matter |
| 4 | Zebra, cord / cordless / motor | No fabric warp for cassette -$3 | subtract 3 | "no fabric wrap" option | |
| 5 | Zebra, motor + special | Bluetooth motor extra +$ 40 | add 40 | control = Matter | |
| 6 | Zebra, special sizes | 未x1.1 ("not yet x1.1") | multiply grid cost by 1.1 | size outside the standard grid but inside the special grid | Uranus, Venus only |
| 7 | Cellular Normal | Motor+$100 | add 100 | control = remote, Matter or motor | one figure for all three motors |
| 8 | Cellular Top-down/bottom-up | Motor+$120 | add 120 | same | |
| 9 | Cellular Day & Night | Motor+$120 | add 120 | same | |
| 10 | Shangri-La | Remote control: +$100 | add 100 | remote control | |
| 11 | Shangri-La | Bluetooth/Matter (Smart) motor: +$140 | add 140 | control = Matter | |
| 12 | Roman, motor | stray `100` in B85, and every motor cell = cord cell + $100 exactly | no adder: the motor grid already includes it | control = remote or motor | |
| 13 | Dream Curtains, MOTOR | The above quotation does not include the cost of the motor | **motor cost missing** | motorized track | no figure anywhere in the file |
Not found in any workbook received: "cordless +$15" (maybe in the woven wood sheet).

## 4. Proposed size limits (derived from the grids)
"Round up" applies inside the limits; past a maximum there is no estimate (custom size). Minimums are the first axis value.
| Line / system | Width | Drop | Special rule |
|---|---|---|---|
| Roller cord and motor | 24-120 (the third band of grids is labelled 118.2) | 23-118 | when width > roll width, drop <= roll width (rolls 78, 90, 98, 110) |
| Roller cordless | 24-96 | 23-98 | roll 90 and 78: same rule above 90 / 78 |
| Zebra cord and motor | 24-118.2 | 23-118 | roll-112 fabrics: drop <= 110 (Moon, Neptune, Mercury, Nebula) or 112 (Meteor) |
| Zebra cordless | 24-96 | 23-98 | none |
| Zebra special sizes (Uranus, Venus) | up to 154 | 23-118 | price x1.1 |
| Shangri-La | 72 to 118 depending on the group (table above) | 23-112, but the fabric's "Max Length" wins when lower | Apollo/Hera and Erebus/Hestia share a grid but have different lengths |
| Cellular (all types) | 24-99 | 21-107 | none |
| Roman cord and motor | 24-104 | 23-94 | none |
| Roman cordless | 24-96 | 23-94 | none |
| Dream Curtains | 24-352 | 12-228 | prices step up at a size-dependent width: the two-track split (below) |
| Drapery curtains | none (price on request) | none | unverified |
Rules that come from a grid are marked "from grid"; anything else (drapery curtains, notes like "fixed width above 100 in") is marked **unverified** in the admin.

## 5. Things I found that are unclear (please decide)
1. **Woven wood workbook missing** (and the "cordless +$15" example).
2. **Roller Pansy / Violet**: the sheet lists them untyped "(new)" under the Taurus solar 110 in grid; we carry them as blackout (Pansy roll 118, Violet 110).
3. **Roller Gaea blackout** has a grid but we have no such fabric; we do have blackout "Gare" (1 swatch) with no grid. Probably the same product under a typo. **Magic screen-view** has a grid and no fabric.
4. **Roll-width differences**: Roller Sundance screen-view (sheet 98, ours 118), Pansy (sheet 110, ours 118); Zebra Moon, Neptune, Mercury, Nebula, Meteor (sheet 112, ours 118).
5. **Shangri-La controls**: the site offers "Remote wand" and "Matter"; the sheet is a cord grid + "Remote control +$100" + "Matter +$140". I propose Remote wand = base grid, Matter = base +$140.
6. **Roller / Zebra controls**: remote -> motor grid; Matter -> motor grid + $40; "Motor (non-Matter)" has no price in the sheet (proposed: motor grid, +$0). Cellular "Freestop" has no price (proposed: base grid).
7. **Cellular Day & Night** uses two fabrics, and the sheet has a light-filtering block (labelled "White sheer only") and a blackout block. Which one prices the shade, or the sum?
8. **Roller double-stack**: price = front shade + back shade?
9. **Dream Curtains price drop at 115 in**: every width is about $27.6 cheaper at 115 in than at 114 in (manual and motor). Rounding up could therefore price a taller curtain lower. I'd store it as printed and flag it.
10. **Dream Curtains "Divided to 2 tracks for following width"** is a note beside the 100-101 in rows with no width stated. The grid already steps up (about +$74, then about +$40) at a width that shrinks with height (352 in at 31 in tall, 48 in at 227 in tall). I'd treat that step as the two-track split and show it as a note, not as an extra price.
11. **Dream Curtains motor cost**: not in the file. For reference, the supplier's other motor premiums are Cellular +$100 / +$120, Shangri-La remote +$100 / Matter +$140, Roller/Zebra Bluetooth +$40 over a motor grid that already includes a motor, and Roman motor +$100 over the cord grid. I will leave the Dream motor adder empty (price checker shows "motor cost missing") until you give me the figure.
12. **Small oddities kept as printed**: roller/zebra grids drop by a few cents in 24 places; Virgo (roll 118) is capped at 114 in drop at 120 in width; Stone blackout at 109; the shared grids' last width column is labelled 118.2.
13. **Roman**: sheet widths stop at 104 in; three of our Roman fabrics are 102 in wide. The sheet has no grade pricing.
14. **Markup order**: price = round((cost x multiplier + adders) x 1.5). A -$3 deduction therefore removes $4.50 from the customer price. Confirm.
15. **Special sizes** are based on the motor grid (their values equal the motor sheet's for the same cells). I propose special sizes apply to motorized control only.
