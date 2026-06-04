-- Migration: Add tester payout approval workflow
-- Date: 2026-06-01

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS payout_phone TEXT,
  ADD COLUMN IF NOT EXISTS payout_operator TEXT CHECK (payout_operator IN ('mtn','airtel','zamtel')),
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'requested'
    CHECK (approval_status IN ('requested','approved','rejected')),
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
