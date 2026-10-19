-- Migration 12: keep the customer's details (name, email, phone, the full shipping address, notes) with each saved order.
-- Safe to run more than once. Paste into the Supabase SQL Editor.
--
-- The site works without it (a sent order is saved and marked sent, just without these details); with it, every order sent
-- from now on also stores them in `orders.customer`. Orders already sent keep an empty value.
--
-- Shape: { "name": "...", "email": "...", "phone": "...", "notes": "...",
--          "address": { "street": "...", "apt": "...", "city": "...", "state": "...", "zip": "...", "country": "United States" } }

alter table public.orders add column if not exists customer jsonb;

comment on column public.orders.customer is 'Customer details and shipping address as sent with the order (set when the order is sent).';
