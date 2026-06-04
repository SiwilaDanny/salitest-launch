-- ─────────────────────────────────────────────────────────────────
-- Migration: Enable Supabase Realtime for Campaigns table
-- Run this in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────

-- Enable replication for the campaigns table
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigns;
