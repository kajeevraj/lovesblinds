# Pricing audit

Generated 2026-10-29 by scripts/pricing-audit.mjs. Costs are before the markup. Source: **sheet** = a supplier workbook, **owner** = a cost the owner confirmed, **NEITHER** = flagged.

## Markups

- cellular: 50%
- drapery: 50%
- dream-curtains: 50%
- roller: 50%
- roman: 50%
- shangri-la: 50%
- woven-wood: 50%
- zebra: 50%

## Price tables (grids)

### cellular (6 grids)

| Table | Systems | Variant | Lining | Scope | x | Source | Active |
|---|---|---|---|---|---|---|---|
| cellular · day-night · blackout | cord+cordless | day-night | blackout | line | 1 | sheet: cellular.xlsx / DAY&NIGHT | yes |
| cellular · day-night · light-filtering | cord+cordless | day-night | light-filtering | line | 1 | sheet: cellular.xlsx / DAY&NIGHT | yes |
| cellular · standard · blackout | cord+cordless | standard | blackout | line | 1 | sheet: cellular.xlsx / Normal cellular | yes |
| cellular · standard · light-filtering | cord+cordless | standard | light-filtering | line | 1 | sheet: cellular.xlsx / Normal cellular | yes |
| cellular · top-down-bottom-up · blackout | cord+cordless | top-down-bottom-up | blackout | line | 1 | sheet: cellular.xlsx / Top down bottom up | yes |
| cellular · top-down-bottom-up · light-filtering | cord+cordless | top-down-bottom-up | light-filtering | line | 1 | sheet: cellular.xlsx / Top down bottom up | yes |

### dream-curtains (2 grids)

| Table | Systems | Variant | Lining | Scope | x | Source | Active |
|---|---|---|---|---|---|---|---|
| dream-curtains · manual | manual | all | - | line | 1 | sheet: dream-curtains.xlsx / MANUL-DREAM CURTAIN | yes |
| dream-curtains · motor | motor | all | - | line | 1 | sheet: dream-curtains.xlsx / MOTOR-DREAM CURTAIN | yes |

### roller (81 grids)

| Table | Systems | Variant | Lining | Scope | x | Source | Active |
|---|---|---|---|---|---|---|---|
| roller · cord · Aquarius | cord | all | - | fabric | 1 | sheet: roller.xlsx / Roller shades-cord | yes |
| roller · cordless · Aquarius | cordless | all | - | fabric | 1 | sheet: roller.xlsx / Roller shades-cordless | yes |
| roller · motor · Aquarius | motor | all | - | fabric | 1 | sheet: roller.xlsx / Roller shades-Motor | yes |

### roman (6 grids)

| Table | Systems | Variant | Lining | Scope | x | Source | Active |
|---|---|---|---|---|---|---|---|
| roman · cord · blackout | cord | all | blackout | line | 1 | sheet: roman.xlsx / Roman shades-cord | yes |
| roman · cord · light-filtering | cord | all | light-filtering | line | 1 | sheet: roman.xlsx / Roman shades-cord | yes |
| roman · cordless · blackout | cordless | all | blackout | line | 1 | sheet: roman.xlsx / Roman shades-cordless | yes |
| roman · cordless · light-filtering | cordless | all | light-filtering | line | 1 | sheet: roman.xlsx / Roman shades-cordless | yes |
| roman · motor · blackout | motor | all | blackout | line | 1 | sheet: roman.xlsx / Roman shades-motor | yes |
| roman · motor · light-filtering | motor | all | light-filtering | line | 1 | sheet: roman.xlsx / Roman shades-motor | yes |

### shangri-la (6 grids)

| Table | Systems | Variant | Lining | Scope | x | Source | Active |
|---|---|---|---|---|---|---|---|
| shangri-la · Alastor | cord | all | - | fabric | 1 | sheet: shangri-la.xlsx / SHRL-CORD+MOTOR | yes |

### woven-wood (1 grid)

| Table | Systems | Variant | Lining | Scope | x | Source | Active |
|---|---|---|---|---|---|---|---|
| woven-wood · final quote | cord+cordless+motor | all | - | line | 1 | sheet: woven-wood.xlsx / Sheet1 | yes |

### zebra (36 grids)

| Table | Systems | Variant | Lining | Scope | x | Source | Active |
|---|---|---|---|---|---|---|---|
| zebra · cord · COMET | cord | all | - | fabric | 1 | sheet: zebra.xlsx / Zebra-cord | yes |
| zebra · cordless · COMET | cordless | all | - | fabric | 1 | sheet: zebra.xlsx / Zebra-cordless | yes |
| zebra · motor · COMET | motor | all | - | fabric | 1 | sheet: zebra.xlsx / Zebra-motor | yes |
| zebra · special sizes · motor (special sizes) | motor | all | - | fabric | 1.1 | sheet: zebra.xlsx / 特殊尺寸 | yes |

## Adders (add-ons and deductions)

| Line | Adder | Amount (cost) | When | Source | Active |
|---|---|---|---|---|---|
| cellular | Motor (any type: battery or wired, any control) (motor) | +$70 | {"control":["motorized"]} | owner: confirmed by the owner | yes |
| cellular | Motor (day-night) (motor-day-night) | +$120 | {"type":["day-night"],"control":["remote","matter","motor"]} | sheet: DAY&NIGHT!B94: Motor+$120 | no |
| cellular | Motor (standard) (motor-standard) | +$100 | {"type":["standard"],"control":["remote","matter","motor"]} | sheet: Normal cellular!B94: Motor+$100 | no |
| cellular | Motor (top-down-bottom-up) (motor-top-down-bottom-up) | +$120 | {"type":["top-down-bottom-up"],"control":["remote","matter","motor"]} | sheet: Top down bottom up!B94: Motor+$120 | no |
| cellular | Solar panel (battery motors only) (solar-panel) | +$30 | {"solar":["panel"],"control":["motorized"]} | owner: confirmed by the owner | yes |
| dream-curtains | Motor (not in the supplier sheet) (motor-cost) | +$100 | {"control":["remote","matter"]} | owner: confirmed by the owner | yes |
| roller | Bluetooth (Matter) motor (bluetooth-motor) | +$40 | {"control":["matter"]} | sheet: Roller shades-Motor!B304: Bluetooth motor extra +$ 40 | no |
| roller | Motor (any type: battery or wired, any control) (motor) | +$70 | {"control":["motorized"]} | owner: confirmed by the owner | yes |
| roller | No fabric wrap on the bottom rail (no-wrap-bottom-rail) | -$3 | {"wrap_bottom_rail":["none"]} | sheet: Roller shades-cord!B306: No fabric warp for bottom rail -$3 | yes |
| roller | No fabric wrap on the cassette (no-wrap-cassette) | -$3 | {"wrap_cassette":["none"]} | sheet: Roller shades-cord!B305: No fabric warp for cassette -$3 | yes |
| roller | Solar panel (battery motors only) (solar-panel) | +$30 | {"solar":["panel"],"control":["motorized"]} | owner: confirmed by the owner | yes |
| roman | Motor (any type: battery or wired, any control) (motor) | +$70 | {"control":["motorized"]} | owner: confirmed by the owner | yes |
| roman | Solar panel (battery motors only) (solar-panel) | +$30 | {"solar":["panel"],"control":["motorized"]} | owner: confirmed by the owner | yes |
| shangri-la | Bluetooth / Matter (smart) motor (matter-motor) | +$140 | {"control":["matter"]} | sheet: SHRL-CORD+MOTOR!A99 | no |
| shangri-la | Motor (any type: battery or wired, any control) (motor) | +$70 | {"control":["motorized"]} | owner: confirmed by the owner | yes |
| shangri-la | Remote control (remote-control) | +$100 | {"control":["remote_wand"]} | sheet: SHRL-CORD+MOTOR!A98 | no |
| shangri-la | Solar panel (battery motors only) (solar-panel) | +$30 | {"solar":["panel"],"control":["motorized"]} | owner: confirmed by the owner | yes |
| woven-wood | Cordless (cordless) | +$15 | {"control":["cordless"]} | sheet: Sheet1!C249: Cordless:+$15 | yes |
| woven-wood | No coating (no-coating) | -$0.46/sq ft | {"coating":["none"]} | sheet: Sheet1!C251: No Coating:-$0.46/sq ft(counting based on 1 sq ft) | yes |
| woven-wood | Remote (motor) (remote) | +$100 | {"control":["remote"]} | sheet: Sheet1!C250: Remote:+$100 | yes |
| zebra | Bluetooth (Matter) motor (bluetooth-motor) | +$40 | {"control":["matter"]} | sheet: Zebra-motor!B201: Bluetooth motor extra +$ 40 | no |
| zebra | Motor (any type: battery or wired, any control) (motor) | +$70 | {"control":["motorized"]} | owner: confirmed by the owner | yes |
| zebra | No fabric wrap on the cassette (no-wrap-cassette) | -$3 | {"wrap_cassette":["none"]} | sheet: Zebra-cord!B201: No fabric warp for cassette -$3 | yes |
| zebra | Solar panel (battery motors only) (solar-panel) | +$30 | {"solar":["panel"],"control":["motorized"]} | owner: confirmed by the owner | yes |

## Prices that are not in a supplier workbook

- Motor $70 (every motor type, including the 2 in 1 and the cellular motors), Solar panel $30, Dream Curtains motor $100: owner-confirmed costs. Not changed.
- Zigbee hub $35: owner-confirmed flat SELLING price (no markup), stored in hardware_rates (id zigbee_hub, migration 20) and editable in admin; offered once per order in the cart, its own order line, quantity 1.
- Zero gravity: no price of its own. It uses the supplier sheet Cordless / Free-stop table on each line (migration 20).
- Curtain fabric (drapery_tiers, drapery_fabrics, the liner, shipping and ripple numbers): measured from the supplier drapery order form by the owner; reproduces six supplier quotes within $1 (supabase/tests/20_options_hardware_tests.sql). Source type: owner-supplied measurement, not a workbook.
- Curtain hardware (hardware_rates: $/m, $/kg, weights, motor $100, finial $18): from the owner's order form notes. The finial amount per pair vs per finial is an open question (flag hardware-finial-price).

## Flags: active adders that are neither from a sheet nor owner-confirmed

None.

## Open price flags

- [confirm] cellular: Zero gravity: no supplier price yet
- [info] dream-curtains: "Divided to 2 tracks for following width"
- [anomaly] dream-curtains: Price drops at 115 in
- [info] roller: "Gare" renamed "Gaea"
- [anomaly] roller: Cent-level decreases and 118.2 axis labels kept as printed
- [confirm] roller: Zero gravity: no supplier price yet
- [info] roller: Roll widths differ between the sheet and our catalog
- [info] roller: Pansy and Violet are priced from the Taurus block
- [info] roman: Roman has no collection or grade pricing
- [confirm] roman: Zero gravity: no supplier price yet
- [info] shangri-la: "Max Length" is stricter than the grid
- [info] woven-wood: Woven wood is imported but not on the site
- [confirm] zebra: Zero gravity: no supplier price yet
- [info] general: Price = round((grid cost x multiplier + adders - deductions) x (1 + markup))
- [confirm] general: Wired motor: plug-in or hardwired?
- [info] general: Tall motorized sizes show "Price by email"

