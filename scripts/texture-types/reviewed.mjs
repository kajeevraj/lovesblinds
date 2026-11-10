// Colors whose measured texture type was looked at by eye and corrected, keyed by swatch id, each with the reason. The measurement is in src/lib/textureType.js; this list
// is only for photos it cannot read (a photo of a folded shade, a very low-contrast motif ...). It is applied by scripts/classify-textures.mjs and shown in the review sheet.
export const REVIEWED = {
  "roller:screen-view:WSS360172": { type: "mesh", why: "Blossom White (WSS360172): woven grid / open weave seen in the full-size photo" },
  "roller:screen-view:WSS660864": { type: "mesh", why: "Basalt Charcoal (WSS660864): woven grid / open weave seen in the full-size photo" },
  "roller:screen-view:XSS050M01": { type: "mesh", why: "Starlight White (XSS050M01): woven grid / open weave seen in the full-size photo" },
  "drapery:SP26048009": { type: "mesh", why: "Taupe Gray (SP26048009): woven grid / open weave seen in the full-size photo" },
  "roller:screen-view:WSS360105": { type: "mesh", why: "Granite Gray (WSS360105): woven grid / open weave seen in the full-size photo" },
  "drapery:SP26002014": { type: "mesh", why: "Zinc Gray (SP26002014): woven grid / open weave seen in the full-size photo" },
  "drapery:SP26050004": { type: "mesh", why: "Asphalt Gray (SP26050004): woven grid / open weave seen in the full-size photo" },
  "drapery:SP26050005": { type: "mesh", why: "Slate Gray (SP26050005): woven grid / open weave seen in the full-size photo" },
  "drapery:SP26050002": { type: "mesh", why: "Blossom White (SP26050002): woven grid / open weave seen in the full-size photo" },
  "roller:solar:YS050002": { type: "twill", why: "Putty Beige (YS050002): diagonal twill ribs seen in the full-size photo" },
  "roller:screen-view:YSS-A12-102": { type: "twill", why: "Straw Khaki (YSS-A12-102): diagonal twill ribs seen in the full-size photo" },
  "drapery:SP26060001": { type: "motif", why: "Crisp White (SP26060001): a printed or woven motif, drawn from the photo" },
  "drapery:SP26060002": { type: "motif", why: "Pristine White (SP26060002): a printed or woven motif, drawn from the photo" },
  "roller:screen-view:YSS-T12-302": { type: "motif", why: "Dune Khaki (YSS-T12-302): a printed or woven motif, drawn from the photo" },
  "drapery:SP26062004": { type: "print", why: "Hunter Green Damask (SP26062004): a large print, drawn from the photo" },
  "roller:screen-view:YSS-T10-302": { type: "print", why: "Biscuit Khaki (YSS-T10-302): a large print, drawn from the photo" },
  "roller:blackout:YB203810": { type: "linen", why: "Powder White (YB203810): plain linen-type weave seen in the full-size photo" },
  "roller:solar:YS205908": { type: "linen", why: "Soft Cream (YS205908): plain linen-type weave seen in the full-size photo" },
  "roller:blackout:YB120007": { type: "tweed", why: "Nickel Gray (YB120007): same heathered fabric as its sibling colors" },
  "zebra:YZB50-106": { type: "smooth", why: "Coal Black (YZB50-106): flat fabric with no visible weave" },
};
