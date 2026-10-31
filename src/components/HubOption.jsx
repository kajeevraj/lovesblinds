// The Zigbee hub in the cart: one checkbox for the whole order (unchecked by default), shown only while some line uses a Zigbee motor.
import { HUB_BLURB, hubTitle } from '../lib/hub.js';

export function HubOption({ cart, compact = false }) {
  const hub = cart.hub;
  if (!hub?.available) return null;
  return (
    <div className={`s2-hub${compact ? ' compact' : ''}`}>
      <label className="s2-hub-check">
        <input type="checkbox" checked={hub.on} onChange={(e) => hub.setOn(e.target.checked)} />
        <span className="s2-hub-text"><strong>{hubTitle(hub.price)}</strong> {HUB_BLURB}</span>
      </label>
    </div>
  );
}

// "Zigbee hub $35" as a line of the total, when it is in the order
export function HubTotalRow({ cart }) {
  const hub = cart.hub;
  if (!hub?.on) return null;
  return <div className="s2-total-hub"><span>Zigbee hub</span><span>1 × ${hub.price}</span></div>;
}
