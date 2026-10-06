import { useState } from 'react';
import {
  AdminGate, AdminShell, AdminDashboard, AdminProducts,
  AdminPricing, AdminMechanisms, AdminSuppliers, AdminInbox, AdminSettings,
} from './admin.jsx';

// Loaded only at /admin. Kept out of the public bundle, along with its mock data.
export default function AdminApp({ onExit }) {
  const [unlocked, setUnlocked] = useState(false);
  const [page, setPage] = useState("dashboard");
  if (!unlocked) return <AdminGate onUnlock={() => setUnlocked(true)} />;
  return (
    <AdminShell page={page} setPage={setPage} onExit={onExit}>
      {page === "dashboard"  && <AdminDashboard />}
      {page === "products"   && <AdminProducts />}
      {page === "pricing"    && <AdminPricing />}
      {page === "mechanisms" && <AdminMechanisms />}
      {page === "suppliers"  && <AdminSuppliers />}
      {page === "inbox"      && <AdminInbox />}
      {page === "settings"   && <AdminSettings />}
    </AdminShell>
  );
}
