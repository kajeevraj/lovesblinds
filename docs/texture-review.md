# Fabric texture review (phase 1)

Made by `node scripts/texture-report.mjs` from the live catalog (read-only). 436 colors: **308 Photo crop**, **128 Pattern** (88 Zebra, always; 40 others).

## 1. Swatches switched to Pattern (not Zebra): 40

Each has no usable flat area in its photo. In the admin: Products > Colors > the color > Texture. "shade" and "edge" are the measures behind the decision (limits 11 and 2.6).

| Line | Color | Code | Why | shade | edge |
|---|---|---|---|---|---|
| cellular/blackout | Beige Linen | YHCKB001 | folds, edges and strong shading | 12.46 | 4.6 |
| cellular/blackout | Coffee Linen | YHCKB004 | folds or edges | 10.78 | 3.62 |
| cellular/light-filtering | Coffee Linen | YHCK004 | folds or edges | 7.28 | 2.71 |
| cellular/blackout | Goose Yellow | YHC38LB11 | folds or edges | 7.14 | 2.64 |
| cellular/blackout | Latte Linen | YHCKB003 | folds or edges | 8.11 | 4.22 |
| cellular/light-filtering | Latte Linen | YHCK003 | folds or edges | 7.3 | 3.52 |
| cellular/light-filtering | Light Grey | YHC38L007 | folds or edges | 6.99 | 3.5 |
| cellular/blackout | Pink | YHC38LB009 | folds or edges | 6.71 | 2.99 |
| cellular/blackout | Silver Mist | YHC38LB630 | folds, edges and strong shading | 11.73 | 4.8 |
| cellular/light-filtering | Silver Mist | YHC38SL630 | folds or edges | 9.86 | 3.72 |
| cellular/blackout | White Linen | YHCKB002 | folds or edges | 7.75 | 3.01 |
| drapery | Black Lattice | SP26056014 | folds, edges and strong shading | 29.69 | 5.39 |
| drapery | Clean White | SP26060003 | folds, edges and strong shading | 17.3 | 4.66 |
| drapery | Hunter Green Damask | SP26062004 | folds, edges and strong shading | 52.17 | 9.59 |
| drapery | Navy Leaf | SP26062006 | folds, edges and strong shading | 21 | 5 |
| drapery | Pristine White | SP26060002 | folds, edges and strong shading | 12.83 | 3.76 |
| drapery | Rain Gray | SP26048002 | folds or edges | 9.33 | 2.98 |
| dream-curtains | Asphalt Gray | ZDS3003-17 | strong shading | 12.9 | 0.77 |
| dream-curtains | Granite Gray | ZDS3002-18 | strong shading | 11.66 | 0.57 |
| dream-curtains | Light Pink | ZDS3003-41 | strong shading | 11.79 | 0.39 |
| dream-curtains | Pewter Gray | ZDS3001-18 | strong shading | 11.4 | 0.36 |
| shangri-la | Blossom White | YSLL901 | folds, edges and strong shading | 28.83 | 2.62 |
| shangri-la | Canary Yellow | YSLP1002 | strong shading | 12.94 | 1.17 |
| shangri-la | Chai Latte | YSLP608 | strong shading | 14.55 | 1.83 |
| shangri-la | Chocolate | YSLP1004 | strong shading | 24.04 | 2.23 |
| shangri-la | Clean White | YSLP1001 | strong shading | 17.69 | 1.73 |
| shangri-la | Concrete Gray | YSLS905 | folds, edges and strong shading | 25.12 | 3.63 |
| shangri-la | Dark Grey | YSLP103 | folds, edges and strong shading | 29.54 | 3.27 |
| shangri-la | Fresh White | YSLS901 | folds, edges and strong shading | 18.7 | 2.65 |
| shangri-la | Glacier | YSLP603 | strong shading | 24.46 | 1.63 |
| shangri-la | Gunmetal Gray | YSLP1003 | strong shading | 30.32 | 2.38 |
| shangri-la | Honey Latte | YSLS903 | strong shading | 25.8 | 2.16 |
| shangri-la | Khaki | YSLH203 | strong shading | 22.73 | 1.22 |
| shangri-la | Lily White | YSLP601 | strong shading | 13.28 | 0.84 |
| shangri-la | Linen | YSLM605 | strong shading | 17.24 | 1.61 |
| shangri-la | Linen Ash | YSLK904 | folds, edges and strong shading | 24.35 | 3.66 |
| shangri-la | Silver Grey | YSLM604 | strong shading | 13.48 | 1.3 |
| shangri-la | Smoke Gray | YSLP605 | strong shading | 21.93 | 1.96 |
| shangri-la | Steel Gray | YSLH204 | strong shading | 20.98 | 1.52 |
| shangri-la | Sunbeam Yellow | YSLM602 | strong shading | 19.18 | 1.29 |

## 2. Zebra: every color is Pattern (88)

Solid and sheer bands (default 3 in and 2 in, editable per color in the admin). Almond Beige (YZB1002), Almond Latte (YZB5105), Anchor Gray (YZB3-103), Angel White (YZB201), Ash Gray (YZB3-102), Birch White (YZB5001), Biscotti Beige (YZB6-102), Biscuit Khaki (YZB3302), Bittersweet Chocolate (YZB3007), Black Brown (YZBK504), Black Grey (YZBK503), Black White (YZBK501), Blizzard White (YZB5101), Buff Beige (DZB4301), Camel Khaki (YZB5003), Caramel Brown (YZB6-106), Cashew Beige (YZB2001), Cinnamon Brown (YZB1007), Cinnamon Latte (YZB5005), Clay Khaki (YZB1003), Clean White (YZBK201), Cloud Gray (YZB50-104), Coal Black (YZB50-106), Cocoa Chocolate (DZB4304), Cream (YZB202), Crimson (YZB1011), Dark Chocolate (YZB2008), Desert Khaki (YZB5103), Dove Gray (DZB3104), Dove White (YZB1001), Driftwood Khaki (YZB802), Dune Khaki (YZB5-102), Dusk Gray (YZB5-103), Eclipse Black (YZB6-108), Fawn Beige (YZB50-102), Flurry White (YZB5201), Frost Gray (YZB6-104), Gesso White (DZB3101), Gossamer White (YZB50-101), Granite Gray (YZB3304), Graphite Gray (YZB5104), Grey (YZBK203), Iced Coffee (YZB3305), Jet Black (DZB3105), Mineral Gray (YZB904), Mocha Brown (DZB4303), Mocha Chocolate (YZB807), Nougat Beige (DZB3501), Oat Latte (YZB3303), Oatmeal Beige (YZB5203), Off-white (YZB501), Onyx Black (YZB1012), Parchment Beige (YZB3-101), Pewter Gray (YZB5207), Platinum Gray (YZB5004), Porcelain White (YZB5-101), Raven Black (YZBK207), Roasted Coffee (YZB3006), Sable Brown (YZB5-104), Safari Khaki (YZB3003), Sahara Khaki (DZB3502), Sand Beige (DZB3103), Sandstone Khaki (YZB50-103), Silver (YZB5206), Silver Gray (YZB801), Slate Gray (YZB50-105), Soot Black (YZB5109), Soot Gray (YZB2005), Steel Gray (YZB1021), Sterling Gray (YZB804), Straw Khaki (YZB502), Sugar White (YZB6-101), Taupe Gray (YZB3001), Taupe Khaki (YZB902), Teak Brown (YZB2007), Terrain Khaki (YZBK206), Tin Gray (DZB3503), Tobacco Brown (DZB3504), Truffle Brown (YZB210), Truffle Chocolate (YZB3306), Tundra White (YZB901), Tuxedo Black (YZB5006), Twilight Gray (YZB208), Umber Brown (YZB3-104), Vanilla Latte (YZB3004), Walnut Brown (YZB5205), Wheat Khaki (YZB2003), Wolf Gray (YZB1005).

## 3. Tile color far from the photo's average color (distance above 12): 49

The tile color is what the picker, the "This blind" chip and the 3D shade show. A Zebra's photo color is its solid band. Colors with an admin override are left out. Review in Products > Colors > Preview color.

| Line | Color | Code | Color family | Photo average | Tile color | Distance |
|---|---|---|---|---|---|---|
| zebra | Clean White | YZBK201 | White | `#646369` | `#ececf0` | 51.3 |
| roller/solar | Jet Black | YS180006 | Charcoal/Black | `#85878e` | `#37383c` | 32.8 |
| roller/blackout | Onyx Black | YB180006 | Charcoal/Black | `#85878e` | `#37383c` | 32.8 |
| drapery | Salt White | SP26027008 | White | `#a09fa4` | `#ecebf0` | 27.5 |
| roller/screen-view | Shadow Gray | YSS-A12-103 | White | `#a3a2a8` | `#ececf0` | 26.7 |
| roller/screen-view | Granite Gray | WSS360105 | White | `#a6a5aa` | `#ececf0` | 25.6 |
| roller/solar | Breeze White | XS170001 | White | `#aaa8a2` | `#edece8` | 24.5 |
| roller/screen-view | White Slate | WSS481277 | White | `#aba9ae` | `#edebef` | 23.8 |
| zebra | Jet Black | DZB3105 | Charcoal/Black | `#6a6976` | `#38383c` | 21.9 |
| roller/blackout | White Gray | YB204304 | White | `#b1b2ae` | `#ecede8` | 21.2 |
| zebra | Terrain Khaki | YZBK206 | Beige/Tan | `#474035` | `#746d62` | 18.9 |
| zebra | Dove White | YZB1001 | White | `#b6b9bc` | `#e9edf0` | 18.5 |
| zebra | Black White | YZBK501 | Charcoal/Black | `#636364` | `#383839` | 18.4 |
| roller/blackout | Raven Black | DBG7001 | Charcoal/Black | `#616360` | `#363935` | 18.2 |
| zebra | Birch White | YZB5001 | White | `#b9baba` | `#eaedec` | 18.1 |
| roller/screen-view | Ink Black | YSS-A12-110 | Charcoal/Black | `#626167` | `#38383c` | 17.8 |
| shangri-la | Fresh White | YSLS901 | White | `#bbbbc0` | `#ececef` | 17.5 |
| roller/blackout | Feather White | YB1901 | White | `#bcbcbc` | `#ececec` | 17.2 |
| zebra | Tundra White | YZB901 | White | `#b8bcc0` | `#e9ecf0` | 17.2 |
| roller/solar | Clean White | YS180002 | White | `#bdbdbd` | `#ececeb` | 16.8 |
| shangri-la | Blossom White | YSLL901 | White | `#bdbdbc` | `#edecea` | 16.8 |
| roller/blackout | Fresh White | YB010001 | White | `#bebfba` | `#ecece8` | 16.2 |
| roller/screen-view | Whale Gray | WSS438178 | Charcoal/Black | `#3a3a3c` | `#181819` | 16.2 |
| zebra | Bittersweet Chocolate | YZB3007 | Brown | `#3c3c3d` | `#54412f` | 16.1 |
| roller/screen-view | Seagull Gray | XSS000405 | Charcoal/Black | `#424348` | `#1f2124` | 15.9 |
| zebra | Safari Khaki | YZB3003 | Beige/Tan | `#bebdc1` | `#dad0ba` | 15.7 |
| roller/screen-view | Bark Brown | YSS-T12-305 | Brown | `#303030` | `#3f2d1c` | 15.3 |
| zebra | Roasted Coffee | YZB3006 | Brown | `#6a6768` | `#856f5c` | 15.3 |
| roller/screen-view | Cocoa Chocolate | XSS000539 | Brown | `#2a2a2a` | `#3b2a19` | 15.2 |
| dream-curtains | Charcoal Gray | ZDS3008-10 | Charcoal/Black | `#595c57` | `#363935` | 15.1 |
| zebra | Gesso White | DZB3101 | White | `#c2c2c2` | `#ececec` | 15 |
| zebra | Dark Chocolate | YZB2008 | Brown | `#363230` | `#513e2c` | 14.6 |
| zebra | Gossamer White | YZB50-101 | White | `#c3c3c3` | `#ececec` | 14.6 |
| zebra | Vanilla Latte | YZB3004 | Beige/Tan | `#bababd` | `#d4cab5` | 14.6 |
| shangri-la | Clean White | YSLP1001 | White | `#c3c4be` | `#edece8` | 14.5 |
| roller/solar | Midnight Black | XS160005 | Charcoal/Black | `#5a595a` | `#383838` | 14.4 |
| zebra | Sand Beige | DZB3103 | Beige/Tan | `#ececef` | `#eae0ca` | 14.1 |
| drapery | Iron Charcoal | SP26056007 | Charcoal/Black | `#58585e` | `#38383c` | 14 |
| roller/screen-view | Ash Gray | WSS660105 | White | `#c5c4ca` | `#ecebf0` | 13.9 |
| roller/blackout | Chocolate | DBL3302 | Brown | `#636561` | `#76604e` | 13.9 |
| roller/solar | Obsidian Black | YS120007 | Charcoal/Black | `#5b565e` | `#3a373d` | 13.8 |
| roller/screen-view | Blossom White | WSS360172 | White | `#c4c7be` | `#eaede7` | 13.7 |
| drapery | Obsidian Black | SP26026020 | Charcoal/Black | `#25334a` | `#2f3135` | 13.3 |
| dream-curtains | Ash Blue | ZDS3008-6 | Blue | `#8b9090` | `#8390a7` | 13.2 |
| roller/blackout | Coal Black | YB1906 | Charcoal/Black | `#595654` | `#3a3835` | 13.2 |
| roller/blackout | Wisp White | YB120001 | White | `#c7c7c4` | `#ecece9` | 13.2 |
| cellular/light-filtering | White Linen | YHCK002 | White | `#d1c9bf` | `#efece8` | 12.8 |
| zebra | Sugar White | YZB6-101 | White | `#c8c8c8` | `#ececec` | 12.8 |
| zebra | Straw Khaki | YZB502 | Beige/Tan | `#d6d4d4` | `#eae0ca` | 12.6 |
