import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabase.js';
import { serializeItem } from './orders.js';

export function useAuth() {
  const [user, setUser]               = useState(null);
  const [orders, setOrders]           = useState([]);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dbError, setDbError]         = useState(null);
  const saveTimer = useRef(null);
  const ordersRef = useRef([]);
  const fetchedUserId = useRef(null);

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null;
      setUser(u);

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        // The admin page shares this session but is not a customer: don't create a draft order for the admin.
        if (u && window.location.pathname.startsWith('/admin')) {
          setAuthLoading(false);
        } else if (u) {
          if (fetchedUserId.current !== u.id) {
            fetchedUserId.current = u.id;
            fetchOrders(u.id);
          }
        } else {
          setAuthLoading(false);
        }
      } else if (event === 'SIGNED_OUT') {
        fetchedUserId.current = null;
        setOrders([]);
        setActiveOrderId(null);
        setAuthLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchOrders = async (userId) => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[fetchOrders]', error);
      setDbError(`Could not load orders: ${error.message}`);
      setAuthLoading(false);
      return;
    }

    const list = data ?? [];

    if (list.length > 0) {
      setOrders(list);
      setActiveOrderId(list[0].id);
      setAuthLoading(false);
    } else {
      // First login — create their initial order immediately so activeOrderId is always set.
      const { data: first, error: createErr } = await supabase
        .from('orders')
        .insert({ user_id: userId, name: 'Order 1', items: [], status: 'draft' })
        .select()
        .single();

      if (createErr) {
        console.error('[fetchOrders/createFirst]', createErr);
        setDbError(`Could not create first order: ${createErr.message}`);
      } else if (first) {
        setOrders([first]);
        setActiveOrderId(first.id);
      }
      setAuthLoading(false);
    }
  };

  const signInWithGoogle = () => {
    if (!supabase) return;
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  const createOrder = async (name = 'New Order', items = []) => {
    if (!supabase || !user) return null;
    const { data, error } = await supabase
      .from('orders')
      .insert({ user_id: user.id, name, items, status: 'draft' })
      .select()
      .single();
    if (error) {
      console.error('[createOrder]', error);
      setDbError(`Could not create order: ${error.message}`);
      return null;
    }
    if (!data) return null;
    setOrders(prev => [data, ...prev]);
    setActiveOrderId(data.id);
    return data;
  };

  useEffect(() => { ordersRef.current = orders; }, [orders]);

  const saveItems = useCallback((orderId, items) => {
    if (!supabase || !orderId) return;
    // a sent order is never overwritten (the database refuses it too, since migration 13)
    if (ordersRef.current.find(o => o.id === orderId)?.status === 'sent') return;
    const serialized = items.map(serializeItem);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const { data, error } = await supabase
        .from('orders')
        .update({ items: serialized })
        .eq('id', orderId)
        .select()
        .single();
      if (error) console.error('[saveItems]', error);
      if (data) setOrders(prev => prev.map(o => o.id === orderId ? data : o));
    }, 600);
  }, []);

  const renameOrder = async (orderId, name) => {
    if (!supabase) return;
    const { error } = await supabase.from('orders').update({ name }).eq('id', orderId);
    if (error) console.error('[renameOrder]', error);
    else setOrders(prev => prev.map(o => o.id === orderId ? { ...o, name } : o));
  };

  // Marks the order sent. `items` (with the estimates and quantities as sent) and `customer` (name, email, phone, the full
  // shipping address, notes) are saved in the same update. The customer column comes with migration 12; until it is applied
  // the order is still saved and marked sent, without it.
  const markOrderSent = async (orderId, items = null, customer = null) => {
    if (!supabase || !orderId) return;
    clearTimeout(saveTimer.current);                       // a pending edit save must not overwrite what was sent
    const base = items ? { status: 'sent', items: items.map(serializeItem) } : { status: 'sent' };
    let patch = customer ? { ...base, customer } : base;
    let { error } = await supabase.from('orders').update(patch).eq('id', orderId);
    if (error && customer && /customer/i.test(error.message || '')) {
      patch = base;
      ({ error } = await supabase.from('orders').update(patch).eq('id', orderId));
    }
    if (error) console.error('[markOrderSent]', error);
    else setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...patch } : o));
  };

  const deleteOrder = async (orderId) => {
    if (!supabase) return;
    const { error } = await supabase.from('orders').delete().eq('id', orderId);
    if (error) { console.error('[deleteOrder]', error); return; }
    setOrders(prev => {
      const next = prev.filter(o => o.id !== orderId);
      if (activeOrderId === orderId) setActiveOrderId(next[0]?.id ?? null);
      return next;
    });
  };

  const activeOrder = orders.find(o => o.id === activeOrderId) ?? null;

  return {
    supabaseEnabled: !!supabase,
    user, orders, activeOrder, activeOrderId, setActiveOrderId,
    authLoading, signInWithGoogle, signOut, dbError,
    createOrder, saveItems, renameOrder, markOrderSent, deleteOrder,
  };
}
