# Color family fixes, part 2 (dry run; not applied)

`node scripts/apply-color-fixes.mjs --fixes part2` shows the plan; `--apply` does it and writes a manifest; `--undo <manifest>` puts it back. Only the color family changes. "Tile now" / "tile after" are what the picker shows with the current / new family (distance to the photo average in brackets). No preview color is set on any of these, and none needs one: every tile lands within 7.3 of its photo.

| Color | Line | Code | Move | Photo average | Tile now | Tile after |
|---|---|---|---|---|---|---|
| Tundra White | zebra | YZB901 | White -> Gray | `#b8bcc0` | `#e9ecf0` (17.2) | `#babfc3` (1.1) |
| Tundra White | roller | WSS380192 | White -> Gray | `#e0dfe2` | `#ececee` (4.5) | `#d6d6d8` (3.4) |
| Platinum Gray | roller | XSS000105 | White -> Gray | `#d3d3dc` | `#ececf0` (9.1) | `#d3d3dc` (0) |
| White Gray | roller | YB204304 | White -> Gray | `#b1b2ae` | `#ecede8` (21.2) | `#b1b2ae` (0) |
| Dove White | zebra | YZB1001 | White -> Gray | `#b6b9bc` | `#e9edf0` (18.5) | `#b7babc` (0.6) |
| Off-white | zebra | YZB501 | White -> Cream/Ivory | `#dadcd4` | `#ebede7` (6.1) | `#e0e3db` (2.4) |
| Sunbeam Yellow | shangri-la | YSLM602 | White -> Cream/Ivory | `#d0cfcd` | `#eeece8` (10.4) | `#e0dbce` (7.3) |
| Breeze White | drapery | SP26049006 | White -> Cream/Ivory | `#dcd6cf` | `#eeece8` (7.8) | `#dcd6ce` (0.5) |
| Whisper White | drapery | SP26004001 | White -> Cream/Ivory | `#eae3d9` | `#eeece8` (4.7) | `#e9e3d9` (0.4) |
| Wisp White | drapery | SP26041001 | White -> Cream/Ivory | `#e1d5c8` | `#efece8` (9.6) | `#e0d5c8` (0.4) |
| Porcelain White | drapery | SP26003001 | White -> Cream/Ivory | `#e9e3d8` | `#eeece8` (5) | `#e8e3d7` (0.6) |
| White Linen | cellular | YHCK002 | White -> Cream/Ivory | `#d1c9bf` | `#efece8` (12.8) | `#dbd3c9` (3.6) |
| Powder White | dream-curtains | ZDS3008-2 | White -> Cream/Ivory | `#e2e3d1` | `#ecece8` (8.1) | `#e8e8d6` (1.9) |
| Clean White | drapery | SP26060003 | White -> Pattern/Multi | `#d6d6db` | `#ececef` (7.8) | `#d7d6db` (0.4) |
| Crisp White | drapery | SP26060001 | White -> Pattern/Multi | `#e4e3ea` | `#ececf0` (3.4) | `#e1e0e6` (1.2) |
| Pristine White | drapery | SP26060002 | White -> Pattern/Multi | `#e0dcda` | `#ececed` (5.8) | `#e0dcda` (0) |
| Moonbeam White | drapery | SP26062005 | White -> Pattern/Multi | `#e1e2e3` | `#ececef` (3.8) | `#e0e1e2` (0.4) |
| Milk White | drapery | SP26010002 | White -> Pattern/Multi | `#d9d6d0` | `#eeece8` (7.8) | `#d9d6d0` (0) |
| Pinstripe | roller | XS140004 | White -> Pattern/Multi | `#d6d5db` | `#ececf0` (8.1) | `#d6d5db` (0) |

## On hold: Bronze (roller, WSS385858)

Photo: white basketweave with a tan-grey backing (`#c8c2b5`) showing through the gaps. Proposed family: **Beige/Tan** (tile `#dcd9d1`; Brown would read too dark, `#99968e`). Not changed.
