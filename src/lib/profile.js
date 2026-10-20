// What the site knows about a signed-in customer. Google supplies the name, email and picture; the customer can add their own
// name, phone and shipping address (kept on their account as user metadata, under profile_* keys so Google's own fields are
// never overwritten). No database table is involved.
import { supabase } from './supabase.js';
import { DEFAULT_COUNTRY, addressLine } from '../data/countries.js';

export const EMPTY_ADDRESS = { street: '', apt: '', city: '', state: '', zip: '', country: DEFAULT_COUNTRY };
const str = (v) => (typeof v === 'string' ? v.trim() : '');
// The saved address has the same fields as the order form. Profiles saved before that kept one line of text (profile_ship_to): it
// goes in the street box so nothing is lost.
export function addressOf(m = {}) {
  const a = m.profile_address;
  if (a && typeof a === 'object') return { street: str(a.street), apt: str(a.apt), city: str(a.city), state: str(a.state), zip: str(a.zip), country: str(a.country) || DEFAULT_COUNTRY };
  return { ...EMPTY_ADDRESS, street: str(m.profile_ship_to) };
}

export function profileOf(user) {
  if (!user) return null;
  const m = user.user_metadata || {};
  const email = user.email || m.email || '';
  const name = (m.profile_name || m.full_name || m.name || '').trim();
  const initials = (name || email).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';
  return {
    name, email, initials,
    avatar: m.avatar_url || m.picture || '',
    phone: (m.profile_phone || '').trim(),
    address: addressOf(m),
    shipTo: addressLine(addressOf(m)),
  };
}

export async function saveProfile({ name, phone, address }) {
  if (!supabase) throw new Error('Sign-in is not available right now.');
  const a = { street: str(address?.street), apt: str(address?.apt), city: str(address?.city), state: str(address?.state), zip: str(address?.zip), country: str(address?.country) || DEFAULT_COUNTRY };
  const empty = !a.street && !a.apt && !a.city && !a.state && !a.zip;
  // profile_ship_to keeps the one-line form of the same address for anything that still reads it
  const { data, error } = await supabase.auth.updateUser({ data: { profile_name: name.trim(), profile_phone: phone.trim(), profile_address: a, profile_ship_to: empty ? '' : addressLine(a) } });
  if (error) throw error;
  return data.user;
}
