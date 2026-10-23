import { useState } from 'react';
import ColorsSection from './colors/ColorsSection.jsx';
import ProductsSection from './products/ProductsSection.jsx';
import PricingSection from './pricing/PricingSection.jsx';
import OrdersSection from './orders/OrdersSection.jsx';

const MENU = [
  { id: 'colors', label: 'Colors' },
  { id: 'products', label: 'Products' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'orders', label: 'Orders' },
  { id: 'suppliers', label: 'Suppliers', soon: true },
  { id: 'analytics', label: 'Analytics', soon: true },
];

export default function Shell({ user, signOut }) {
  const [section, setSection] = useState('colors');
  const [open, setOpen] = useState(false);
  const current = MENU.find((m) => m.id === section);
  const go = (id) => { setSection(id); setOpen(false); };

  return (
    <div className="adm adm-shell">
      <header className="adm-topbar">
        <button className="adm-btn adm-menu-btn" aria-expanded={open} aria-controls="adm-nav" onClick={() => setOpen((o) => !o)}>Menu</button>
        <strong className="adm-brand-sm">Admin</strong>
        <button className="adm-btn adm-btn-quiet" onClick={() => signOut()}>Sign out</button>
      </header>
      <nav id="adm-nav" className={`adm-side${open ? ' is-open' : ''}`} aria-label="Admin sections">
        <div className="adm-brand">Love’s Blinds<span>Admin</span></div>
        <ul>
          {MENU.map((m) => (
            <li key={m.id}>
              <button className={`adm-nav-item${section === m.id ? ' is-current' : ''}`} onClick={() => go(m.id)} aria-current={section === m.id ? 'page' : undefined}>
                {m.label}{m.soon && <small>Coming soon</small>}
              </button>
            </li>
          ))}
        </ul>
        <div className="adm-side-foot">
          <div className="adm-muted adm-email" title={user?.email}>{user?.email}</div>
          <button className="adm-btn" onClick={() => signOut()}>Sign out</button>
        </div>
      </nav>
      <main className="adm-main">
        {section === 'colors' ? <ColorsSection /> : section === 'products' ? <ProductsSection /> : section === 'pricing' ? <PricingSection /> : section === 'orders' ? <OrdersSection /> : (
          <div className="adm-card adm-soon">
            <h1>{current.label}</h1>
            <p className="adm-muted">Coming soon.</p>
          </div>
        )}
      </main>
    </div>
  );
}
