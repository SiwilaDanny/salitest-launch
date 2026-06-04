-- SaLiTeSt Launch existing database migration
-- Run this in Supabase SQL Editor if the base schema has already been created.
-- Do not rerun supabase/schema.sql on an existing database.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── PROFILES: billing/role fields ───────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS mobile_money_number TEXT,
  ADD COLUMN IF NOT EXISTS mobile_money_operator TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_subscription_plan_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_subscription_plan_check
      CHECK (subscription_plan IN ('starter', 'pro', 'enterprise'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_mobile_money_operator_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_mobile_money_operator_check
      CHECK (mobile_money_operator IN ('mtn', 'airtel', 'zamtel'));
  END IF;
END $$;

-- ─── SIGNUP ROLE HARDENING ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    CASE
      WHEN NEW.raw_user_meta_data->>'role' = 'tester' THEN 'tester'
      ELSE 'developer'
    END
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF auth.uid() = NEW.id AND OLD.role <> 'admin' THEN
    NEW.role := OLD.role;
    NEW.subscription_plan := OLD.subscription_plan;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_privilege_escalation ON public.profiles;
CREATE TRIGGER prevent_profile_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- ─── API KEYS: Enterprise-only access ────────────────────────
CREATE TABLE IF NOT EXISTS public.api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  key_hash        TEXT NOT NULL UNIQUE,
  last_used_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;


DROP POLICY IF EXISTS "Developers can manage own API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Enterprise developers can manage own API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Enterprise developers and admins can manage own API keys" ON public.api_keys;

CREATE POLICY "Enterprise developers and admins can manage own API keys"
  ON public.api_keys FOR ALL
  USING (
    auth.uid() = developer_id
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          (p.role = 'developer' AND p.subscription_plan = 'enterprise')
          OR p.role = 'admin'
        )
    )
  )
  WITH CHECK (
    auth.uid() = developer_id
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          (p.role = 'developer' AND p.subscription_plan = 'enterprise')
          OR p.role = 'admin'
        )
    )
  );

-- ─── TRANSACTIONS: Lenco reference ───────────────────────────
DO $$
BEGIN
  IF to_regclass('public.transactions') IS NOT NULL THEN
    ALTER TABLE public.transactions
      ADD COLUMN IF NOT EXISTS lenco_reference TEXT;
  END IF;
END $$;
