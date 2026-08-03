import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabase.js';
import { serializeItem } from './orders.js';

export function useAuth() {
  const [user, setUser]               = useState(null);
  const [orders, setOrders]           = useState([]);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const saveTimer = useRef(null);
  const fetchedUserId = useRef(null); // prevents double-fetch when INITIAL_SESSION + SIGNED_IN both fire

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null;
      setUser(u);

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (u) {
          // Only fetch if we haven't already fetched for this user in this session.
          // After Google OAuth redirect, INITIAL_SESSION and SIGNED_IN both fire —
          // without this guard the second fetchOrders can overwrite locally-created orders.
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
      // TOKEN_REFRESHED, USER_UPDATED: update user object only; orders stay intact.
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

  const createOrder = async (name = 'Order 1', items = []) => {
    if (!supabase || !user) return null;
    const { data, error } = await supabase
      .from('orders')
      .insert({ user_id: user.id, name, items, status: 'draft' })
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

  const markOrderSent = async (orderId) => {
    if (!supabase || !orderId) return;
    await supabase.from('orders').update({ status: 'sent' }).eq('id', orderId);
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'sent' } : o));
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
    createOrder, saveItems, renameOrder, markOrderSent, deleteOrder,
  };
}
