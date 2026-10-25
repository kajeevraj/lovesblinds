// The registry of window treatments. To add one (woven wood, venetian blinds): write a class like the others in this folder
// (extend BlindModel, implement build() and update()), add it here under a new kind, then add a row to PRODUCTS in
// src/hero/products.js. The wall, the camera path, the progress list and the tiles all follow that list.
import { RollerShade, ZebraShade } from './roller.js';
import { ShangriLaShade } from './shangrila.js';
import { CellularShade } from './cellular.js';
import { RomanShade } from './roman.js';
import { Curtains, DreamCurtains } from './curtains.js';

export const MODELS = {
  roller: RollerShade,
  zebra: ZebraShade,
  'shangri-la': ShangriLaShade,
  cellular: CellularShade,
  roman: RomanShade,
  curtains: Curtains,
  'dream-curtains': DreamCurtains,
};

export { BlindModel } from './common.js';
export { RollerShade, ZebraShade, ShangriLaShade, CellularShade, RomanShade, Curtains, DreamCurtains };
