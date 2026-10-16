// Turns database and storage errors into plain words. `ctx` can carry { line, family, label } to say where.
import { scopeLabel, LINE_LABELS } from './constants.js';

export function explain(err, ctx = {}) {
  if (!err) return 'Something went wrong.';
  const msg = String(err.message || err.error_description || err.error || err);
  const text = `${msg} ${err.details || ''} ${err.hint || ''}`;
  const where = ctx.line ? scopeLabel(ctx.line, ctx.family) : 'that product line';
  const q = (re) => text.match(re)?.[1];

  if (/swatches_supplier_code_per_line/.test(text)) return `That supplier code is already used in ${ctx.line ? LINE_LABELS[ctx.line] : 'this product line'}.`;
  if (/swatch_links_display_name_per_line|already used in this line/.test(text)) return `That name is already used in ${where}.`;
  if (/swatch_links_not_home_line|already belongs to the|already linked into/.test(text)) return 'This color is already in that line (a color can be placed once per line).';
  if (/swatch_links_swatch_id_product_line_key/.test(text)) return 'This color is already linked into that line.';
  if (/swatch_links_family/.test(text)) return 'Cellular needs a family (light-filtering or blackout).';
  if (/swatches_display_name_per_(family|line)/.test(text)) return `That name is already used in ${where}.`;
  if (/swatches_display_name_no_digit/.test(text)) return 'Color names can’t contain numbers.';
  if (/swatches_display_name_spacing/.test(text)) return 'Color names can’t contain double spaces.';
  if (/swatches_display_name_trimmed/.test(text)) return 'The color name can’t be empty or start or end with a space.';
  if (/swatches_supplier_code_trimmed/.test(text)) return 'The supplier code can’t be empty or start or end with a space.';
  if (/swatches_display_name_no_collection|contains the supplier collection name/.test(text)) return `The color name can’t include a price group name${q(/collection name "([^"]+)"/) ? ` (“${q(/collection name "([^"]+)"/)}”)` : ''}. Customers must not see supplier names.`;
  if (/swatches_display_name_no_code|contains the supplier code/.test(text)) return `The color name can’t include a supplier code${q(/supplier code "([^"]+)"/) ? ` (“${q(/supplier code "([^"]+)"/)}”)` : ''}.`;
  if (/fabrics_collection_not_in_display_names|appears in the display name/.test(text)) return `That price group name appears inside the color name “${q(/display name "([^"]+)"/) || 'of an existing color'}”. Customers must not see supplier names, so pick a different collection name.`;
  if (/swatches_in_saved_order|saved order/.test(text)) return 'This color is part of saved customer orders, so it can’t be deleted. Hide it instead.';
  if (/swatches_id_permanent|swatch ids are permanent/.test(text)) return 'A color’s internal id can’t change.';
  if (/swatches_line_matches_fabric|swatches_family_matches_fabric|but its fabric/.test(text)) return 'The color doesn’t fit its price group (product line or family differs).';
  if (/fabrics_family_matches_line/.test(text)) return 'Roller price groups need a family (Screen View, Solar or Blackout); other lines have none.';
  if (/swatches_family_matches_line/.test(text)) return 'This product line needs a family for each color (Roller and Cellular only).';
  if (err.code === '23503' || /foreign key/i.test(text)) return 'That price group still has colors in it, so it can’t be removed.';
  if (err.code === '23505' || /duplicate key/i.test(text)) return 'That value is already in use.';
  if (/row-level security|not authorized|insufficient_privilege|permission denied|403/i.test(text)) return 'You don’t have permission to do that. Sign out and back in with the admin account.';
  if (/jwt|token.*expired|not authenticated|401/i.test(text)) return 'Your session has expired. Please sign in again.';
  if (/mime|not supported|invalid.*type/i.test(text)) return 'That image type isn’t accepted. Use a JPG, PNG or WebP photo.';
  if (/exceeded|too large|payload|size/i.test(text) && /storage|object|file/i.test(text)) return 'That photo is too large to upload.';
  if (/failed to fetch|network|load failed|timeout|ECONN/i.test(text)) return 'Couldn’t reach the server. Check your connection and try again.';
  return msg;
}
