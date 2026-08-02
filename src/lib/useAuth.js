import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabase.js';
import { serializeItem } from './orders.js';

export function useAuth() {
  const [user, setUser]               = useState(null);
  const [orders, setOrders]           = useState([]);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const saveTimer = useRef(null);

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }

    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) fetchOrders(u.id);
      else setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        fetchOrders(u.id);
      } else {
        setOrders([]);
        setActiveOrderId(null);
        setAuthLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchOrders = async (userId) => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    const list = data ?? [];
    setOrders(list);
    setActiveOrderId(list[0]?.id ?? null);
    setAuthLoading(false);
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
      .insert({ user_id: user.id, name, items })
      .select()
      .single();
    if (error || !data) return null;
    setOrders(prev => [data, ...prev]);
    setActiveOrderId(data.id);
    return data;
  };

  const saveItems = useCallback((orderId, items) => {
    if (!supabase || !orderId) return;
    const serialized = items.map(serializeItem);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from('orders')
        .update({ items: serialized })
        .eq('id', orderId)
        .select()
        .single();
      if (data) setOrders(prev => prev.map(o => o.id === orderId ? data : o));
    }, 600);
  }, []);

  const renameOrder = async (orderId, name) => {
    if (!supabase) return;
    await supabase.from('orders').update({ name }).eq('id', orderId);
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, name } : o));
  };

  const deleteOrder = async (orderId) => {
    if (!supabase) return;
    await supabase.from('orders').delete().eq('id', orderId);
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
    authLoading, signInWithGoogle, signOut,
    createOrder, saveItems, renameOrder, deleteOrder,
  };
}
