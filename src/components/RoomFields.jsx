// "Which room is this for?": a dropdown of common rooms plus a custom name for "Other", and an optional label for the window
// (for example "Left" or "Window 2") so several blinds in one room stay clear.
export const ROOMS = ['Living room', 'Bedroom', 'Primary bedroom', 'Kitchen', 'Dining room', 'Office', 'Bathroom', 'Nursery', 'Basement', 'Other'];

// A saved room label becomes the dropdown value and the custom name.
export function splitRoom(label) {
  const t = (label || '').trim();
  if (!t) return { choice: '', custom: '' };
  const hit = ROOMS.find((r) => r !== 'Other' && r.toLowerCase() === t.toLowerCase());
  return hit ? { choice: hit, custom: '' } : { choice: 'Other', custom: t };
}
export const roomLabelOf = (choice, custom) => (choice === 'Other' ? custom.trim() : choice);

export default function RoomFields({ choice, custom, windowLabel, onChange }) {
  return (
    <div className="s2-room">
      <div className="s2-field">
        <label className="s2-label" htmlFor="s2-room">Room</label>
        <select id="s2-room" className="s2-input" value={choice} onChange={(e) => onChange({ choice: e.target.value, custom, windowLabel })}>
          <option value="">Choose a room (optional)</option>
          {ROOMS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      {choice === 'Other' && (
        <div className="s2-field">
          <label className="s2-label" htmlFor="s2-room-custom">Room name</label>
          <input id="s2-room-custom" className="s2-input" type="text" maxLength={60} placeholder="e.g. Sunroom" value={custom} onChange={(e) => onChange({ choice, custom: e.target.value, windowLabel })} />
        </div>
      )}
      <div className="s2-field">
        <label className="s2-label" htmlFor="s2-window">Window <span className="s2-optional">(optional)</span></label>
        <input id="s2-window" className="s2-input" type="text" maxLength={40} placeholder="e.g. Left, or Window 2" value={windowLabel} onChange={(e) => onChange({ choice, custom, windowLabel: e.target.value })} />
      </div>
      <p className="s2-step-hint">Helps you keep several blinds in one room straight.</p>
    </div>
  );
}
