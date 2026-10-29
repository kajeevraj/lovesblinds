"""Cuts the foreground (sofa, coffee table, floor lamp, plant) out of the /room-lab photo as an RGBA picture.

    python3 scripts/room-lab/make-cutout.py assets/room-lab/room-bare.webp assets/room-lab/room-cutout.png

The cutout has the same size as the photo and is laid on top of the 3D treatments so shades and curtains pass behind the furniture.
Steps: a salient-object model (rembg, isnet-general-use) gives a rough mask for the sofa and table, and for the lamp and the plant in
their own crops (the model ignores them on the full picture); closed-form matting (pymatting) turns the rough mask into a soft,
accurate edge (piping, lamp pole, leaf tips); edge colours are then taken from the solid inside of each object so none of the
bright window behind bleeds into the edge.   Needs: pip install "rembg[cpu]" pymatting scikit-image scipy pillow numpy
Run once; the outputs (public/room-lab/*) are committed. Not part of the site build.
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from skimage.morphology import remove_small_holes
from rembg import remove, new_session
from pymatting import estimate_alpha_cf

src, dst = sys.argv[1], sys.argv[2]
img = Image.open(src).convert('RGB')
im = np.asarray(img).astype(np.float64) / 255.
H, W, _ = im.shape
sess = new_session('isnet-general-use')

# 1. rough masks: whole picture (sofa + table), then the lamp and the plant in their own crops
coarse = np.asarray(remove(img, session=sess, only_mask=True)).astype(float) / 255.
CROPS = {'lamp': (190, 470, 430, 1060), 'plant': (1500, 400, 1880, 1060)}
for x0, y0, x1, y1 in CROPS.values():
    m = np.asarray(remove(img.crop((x0, y0, x1, y1)), session=sess, only_mask=True)).astype(float) / 255.
    coarse[y0:y1, x0:x1] = np.maximum(coarse[y0:y1, x0:x1], m)

# 2. matting around the rough edge, per object
REGIONS = {'sofa': (400, 660, 1580, 1190), 'lamp': CROPS['lamp'], 'plant': CROPS['plant']}
alpha = np.zeros((H, W))
for name, (x0, y0, x1, y1) in REGIONS.items():
    c = coarse[y0:y1, x0:x1]
    sure_fg = ndi.binary_erosion(c > 0.9, iterations=3)
    sure_bg = ndi.binary_erosion(c < 0.1, iterations=2 if name == 'lamp' else 3)
    tri = np.full(c.shape, 0.5); tri[sure_fg] = 1; tri[sure_bg] = 0
    a = np.clip(estimate_alpha_cf(im[y0:y1, x0:x1], tri), 0, 1)
    a[sure_fg] = 1; a[sure_bg] = 0
    alpha[y0:y1, x0:x1] = np.maximum(alpha[y0:y1, x0:x1], a)

# 3. close small holes, firm the edge a little, and take edge colours from the solid inside
solid = alpha > 0.5
alpha = np.where(remove_small_holes(solid, max_size=120) & ~solid, 1.0, alpha)
alpha = np.clip((alpha - 0.30) / 0.60, 0, 1)
core = ndi.binary_erosion(alpha > 0.98, iterations=1)
dist, (iy, ix) = ndi.distance_transform_edt(~core, return_indices=True)
edge = (alpha < 0.98) & (alpha > 0) & (dist <= 4)
rgb = im.copy(); rgb[edge] = im[iy[edge], ix[edge]]
alpha[(dist > 4) & (alpha <= 0.98)] = 0
rgba = np.dstack([rgb, alpha])
Image.fromarray((rgba * 255 + 0.5).astype('uint8'), 'RGBA').save(dst)
print('cutout written:', dst, f'({(alpha > 0.5).mean():.1%} of the picture)')
