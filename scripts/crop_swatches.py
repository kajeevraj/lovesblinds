#!/usr/bin/env python3
"""
Crop fabric swatches out of the supplier catalog page-images and (critically)
build a CONTACT SHEET so a human can confirm each crop is labeled with the
right code before anything goes live.

Why the contact sheet matters: on the catalog pages, the printed text order
does NOT always match the visual order of the swatch tiles. Auto-labeling by
text order alone will mislabel colors. So this script does the mechanical part
(cropping consistent tile regions) and leaves the match to a quick visual check.

USAGE
  1. Put the unzipped catalog page-images somewhere, e.g. catalogs/<Name>/<n>.jpeg
  2. Edit TILE_SLOTS below if a catalog's grid differs (they're mostly the same).
  3. python scripts/crop_swatches.py catalogs/Zebra_Blinds zebra
  4. Open the generated _contact_sheet.html, confirm/rename, then move the
     approved crops into public/swatches/<category>/<CODE>.jpg
"""
import sys, os, glob, re, json
from PIL import Image

# Page images are 1316x924. These slots match the common catalog layout:
# one large "hero" image on the left + a 2x2 grid of swatch tiles on the right.
# Coordinates are (left, top, right, bottom) in page pixels. Tune per catalog.
TILE_SLOTS = {
    "hero":  (70, 190, 585, 625),
    "g_tl":  (658,  78, 912, 393),
    "g_tr":  (980,  78, 1235, 393),
    "g_bl":  (658, 505, 912, 815),
    "g_br":  (980, 505, 1235, 815),
}
SLOT_ORDER = ["hero", "g_tl", "g_tr", "g_bl", "g_br"]

def crop_page(img_path, out_dir):
    im = Image.open(img_path).convert("RGB")
    base = os.path.splitext(os.path.basename(img_path))[0]
    out = []
    for slot in SLOT_ORDER:
        box = TILE_SLOTS[slot]
        tile = im.crop(box)
        # skip near-white empty slots (pages with <5 colors)
        gray = tile.convert("L")
        px = list(gray.getdata())
        if sum(px) / len(px) > 248:  # basically blank
            continue
        fn = f"page{base}_{slot}.jpg"
        tile.save(os.path.join(out_dir, fn), quality=88)
        out.append(fn)
    return out

def main():
    if len(sys.argv) < 3:
        print("usage: crop_swatches.py <catalog_dir> <category>")
        sys.exit(1)
    cat_dir, category = sys.argv[1], sys.argv[2]
    out_dir = os.path.join("swatch_crops", category)
    os.makedirs(out_dir, exist_ok=True)
    pages = sorted(glob.glob(os.path.join(cat_dir, "*.jpeg")),
                   key=lambda p: int(re.findall(r"(\d+)", os.path.basename(p))[0]))
    all_crops = []
    for p in pages:
        all_crops += [(os.path.basename(p), f) for f in crop_page(p, out_dir)]

    # contact sheet for visual verification
    rows = "\n".join(
        f'<figure><img src="{f}"><figcaption>{f}<br>'
        f'<input value="CODE" size="12"> <input value="Color name" size="12"></figcaption></figure>'
        for _, f in all_crops
    )
    html = f"""<!doctype html><meta charset=utf-8><title>{category} swatches — verify</title>
<style>body{{font:14px system-ui;padding:24px}}
figure{{display:inline-block;width:180px;margin:8px;text-align:center;vertical-align:top}}
img{{width:180px;height:150px;object-fit:cover;border:1px solid #ccc;border-radius:6px}}
figcaption{{font-size:12px;margin-top:4px}} input{{margin-top:3px}}</style>
<h1>{category}: confirm code + name under each crop, then export</h1>
<p>Match each crop to the printed code/color on the catalog page. Text order != tile order.</p>
{rows}"""
    with open(os.path.join(out_dir, "_contact_sheet.html"), "w") as fh:
        fh.write(html)
    print(f"{len(all_crops)} crops -> {out_dir}")
    print(f"open {out_dir}/_contact_sheet.html to verify labels")

if __name__ == "__main__":
    main()
