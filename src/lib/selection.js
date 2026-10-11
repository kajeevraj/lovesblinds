// Browser entry point for order text (see selectionText.js). Picks saved before display names existed carry no
// displayName; they are filled in from their swatch id here.
import DISPLAY_NAMES from "../data/displayNames.json";
import { setNameFallback } from "./selectionText.js";

setNameFallback((swatchId) => DISPLAY_NAMES[swatchId]);

export * from "./selectionText.js";
