// What the site knows about a signed-in customer. Google supplies the name, email and picture; the customer can add their own
// name, phone and shipping address (kept on their account as user metadata, under profile_* keys so Google's own fields are
// never overwritten). No database table is involved.
import { supabase } from './supabase.js';

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
    shipTo: (m.profile_ship_to || '').trim(),
  };
}

export async function saveProfile({ name, phone, shipTo }) {
  if (!supabase) throw new Error('Sign-in is not available right now.');
  const { data, error } = await supabase.auth.updateUser({ data: { profile_name: name.trim(), profile_phone: phone.trim(), profile_ship_to: shipTo.trim() } });
  if (error) throw error;
  return data.user;
}
