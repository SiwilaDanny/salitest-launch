-- ═══════════════════════════════════════════════════════════
-- SaLiTeSt Launch — Full Database Schema
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── PROFILES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  full_name       TEXT,
  avatar_url      TEXT,
  role            TEXT NOT NULL DEFAULT 'developer'
                    CHECK (role IN ('developer', 'tester', 'admin')),
  subscription_plan TEXT NOT NULL DEFAULT 'starter'
                    CHECK (subscription_plan IN ('starter', 'pro', 'enterprise')),
  phone           TEXT,
  country         TEXT,
  is_verified     BOOLEAN DEFAULT FALSE,
  trust_score     INTEGER DEFAULT 50 CHECK (trust_score BETWEEN 0 AND 100),
  stripe_customer_id TEXT,
  stripe_account_id  TEXT,    -- Stripe Connect for tester payouts
  mobile_money_number TEXT,
  mobile_money_operator TEXT CHECK (mobile_money_operator IN ('mtn', 'airtel', 'zamtel')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'developer',
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trust_score INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
  ADD COLUMN IF NOT EXISTS mobile_money_number TEXT,
  ADD COLUMN IF NOT EXISTS mobile_money_operator TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Helper function to check if current user is an admin without causing infinite recursion in RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN SECURITY DEFINER LANGUAGE plpgsql AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

-- Auto-create profile on signup
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Prevent users from promoting themselves by updating protected profile fields.
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

-- ─── API KEYS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  key_hash        TEXT NOT NULL UNIQUE,
  last_used_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS developer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS key_hash TEXT,
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enterprise developers can manage own API keys" ON public.api_keys;
CREATE POLICY "Enterprise developers can manage own API keys"
  ON public.api_keys FOR ALL
  USING (
    auth.uid() = developer_id
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'developer'
        AND p.subscription_plan = 'enterprise'
    )
  )
  WITH CHECK (
    auth.uid() = developer_id
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'developer'
        AND p.subscription_plan = 'enterprise'
    )
  );

-- ─── APPS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.apps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  platform        TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'both')),
  category        TEXT,
  icon_url        TEXT,
  package_name    TEXT,           -- com.example.app
  bundle_id       TEXT,           -- iOS bundle identifier
  testing_link    TEXT,           -- Play Store closed testing opt-in URL
  testflight_link TEXT,
  status          TEXT DEFAULT 'draft'
                    CHECK (status IN ('draft', 'active', 'completed', 'suspended')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.apps
  ADD COLUMN IF NOT EXISTS developer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS icon_url TEXT,
  ADD COLUMN IF NOT EXISTS package_name TEXT,
  ADD COLUMN IF NOT EXISTS bundle_id TEXT,
  ADD COLUMN IF NOT EXISTS testing_link TEXT,
  ADD COLUMN IF NOT EXISTS testflight_link TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Developers can manage own apps" ON public.apps;
CREATE POLICY "Developers can manage own apps"
  ON public.apps FOR ALL
  USING (auth.uid() = developer_id);

DROP POLICY IF EXISTS "Testers can read active apps" ON public.apps;
CREATE POLICY "Testers can read active apps"
  ON public.apps FOR SELECT
  USING (status = 'active');

-- ─── CAMPAIGNS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaigns (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id              UUID NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  developer_id        UUID NOT NULL REFERENCES public.profiles(id),
  title               TEXT NOT NULL,
  description         TEXT,
  platform            TEXT NOT NULL,
  testers_required    INTEGER NOT NULL DEFAULT 12 CHECK (testers_required >= 12),
  testers_enrolled    INTEGER DEFAULT 0,
  duration_days       INTEGER NOT NULL DEFAULT 14 CHECK (duration_days >= 14),
  reward_per_tester   NUMERIC(10,2) NOT NULL DEFAULT 3.00 CHECK (reward_per_tester > 0),
  platform_fee_pct    NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  budget_total        NUMERIC(10,2),       -- testers_required * reward_per_tester
  requirements        JSONB DEFAULT '{}',  -- { min_android_version, device_types, countries }
  status              TEXT DEFAULT 'pending'
                        CHECK (status IN (
                          'pending','funded','recruiting','in_progress',
                          'verification','completed','cancelled'
                        )),
  starts_at           TIMESTAMPTZ,
  ends_at             TIMESTAMPTZ,
  stripe_payment_id   TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS app_id UUID REFERENCES public.apps(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS developer_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS testers_required INTEGER NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS testers_enrolled INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_days INTEGER NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS reward_per_tester NUMERIC(10,2) NOT NULL DEFAULT 3.00,
  ADD COLUMN IF NOT EXISTS platform_fee_pct NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  ADD COLUMN IF NOT EXISTS budget_total NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS requirements JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Developers manage own campaigns" ON public.campaigns;
CREATE POLICY "Developers manage own campaigns"
  ON public.campaigns FOR ALL
  USING (auth.uid() = developer_id);

DROP POLICY IF EXISTS "Testers can read recruiting campaigns" ON public.campaigns;
CREATE POLICY "Testers can read recruiting campaigns"
  ON public.campaigns FOR SELECT
  USING (status IN ('recruiting','in_progress'));

-- ─── CAMPAIGN DAILY TASKS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaign_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  day_number      INTEGER NOT NULL CHECK (day_number >= 1),
  title           TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
  description     TEXT,
  is_optional     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, day_number, title)
);

ALTER TABLE public.campaign_tasks
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS day_number INTEGER,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS is_optional BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.campaign_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Developers manage tasks for own campaigns" ON public.campaign_tasks;
CREATE POLICY "Developers manage tasks for own campaigns"
  ON public.campaign_tasks FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_id AND c.developer_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_id AND c.developer_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Admins manage all campaign tasks" ON public.campaign_tasks;
CREATE POLICY "Admins manage all campaign tasks"
  ON public.campaign_tasks FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── ENROLLMENTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.enrollments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  tester_id           UUID NOT NULL REFERENCES public.profiles(id),
  status              TEXT DEFAULT 'pending'
                        CHECK (status IN (
                          'pending','approved','opted_in','active',
                          'completed','dropped','flagged','rejected'
                        )),
  opted_in_at         TIMESTAMPTZ,
  last_activity_at    TIMESTAMPTZ,
  days_active         INTEGER DEFAULT 0,
  checkin_log         BOOLEAN[] DEFAULT ARRAY[]::BOOLEAN[],  -- 14-element array
  feedback_submitted  BOOLEAN DEFAULT FALSE,
  reward_paid         BOOLEAN DEFAULT FALSE,
  reward_amount       NUMERIC(10,2),
  fraud_flags         JSONB DEFAULT '[]',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, tester_id)
);

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tester_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS opted_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS days_active INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checkin_log BOOLEAN[] DEFAULT ARRAY[]::BOOLEAN[],
  ADD COLUMN IF NOT EXISTS feedback_submitted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reward_paid BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reward_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS fraud_flags JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Testers manage own enrollments" ON public.enrollments;
CREATE POLICY "Testers manage own enrollments"
  ON public.enrollments FOR ALL
  USING (auth.uid() = tester_id);

DROP POLICY IF EXISTS "Developers read enrollments for own campaigns" ON public.enrollments;
CREATE POLICY "Developers read enrollments for own campaigns"
  ON public.enrollments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_id AND c.developer_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Testers read tasks for assigned campaigns" ON public.campaign_tasks;
CREATE POLICY "Testers read tasks for assigned campaigns"
  ON public.campaign_tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_id AND c.status IN ('recruiting','in_progress','verification','completed')
    )
    OR EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.campaign_id = campaign_tasks.campaign_id
        AND e.tester_id = auth.uid()
    )
  );

-- ─── CAMPAIGN TASK COMPLETIONS ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaign_task_completions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_task_id UUID NOT NULL REFERENCES public.campaign_tasks(id) ON DELETE CASCADE,
  enrollment_id   UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  tester_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'submitted'
                    CHECK (status IN ('submitted','approved','rejected')),
  notes           TEXT,
  proof_url       TEXT,
  reviewed_by     UUID REFERENCES public.profiles(id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_task_id, enrollment_id)
);

ALTER TABLE public.campaign_task_completions
  ADD COLUMN IF NOT EXISTS campaign_task_id UUID REFERENCES public.campaign_tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS enrollment_id UUID REFERENCES public.enrollments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tester_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'submitted',
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS proof_url TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.campaign_task_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Testers manage own task completions" ON public.campaign_task_completions;
CREATE POLICY "Testers manage own task completions"
  ON public.campaign_task_completions FOR ALL
  USING (
    auth.uid() = tester_id
    AND EXISTS (
      SELECT 1
      FROM public.enrollments e
      JOIN public.campaign_tasks ct ON ct.campaign_id = e.campaign_id
      WHERE e.id = campaign_task_completions.enrollment_id
        AND e.tester_id = auth.uid()
        AND ct.id = campaign_task_completions.campaign_task_id
    )
  )
  WITH CHECK (
    auth.uid() = tester_id
    AND EXISTS (
      SELECT 1
      FROM public.enrollments e
      JOIN public.campaign_tasks ct ON ct.campaign_id = e.campaign_id
      WHERE e.id = campaign_task_completions.enrollment_id
        AND e.tester_id = auth.uid()
        AND ct.id = campaign_task_completions.campaign_task_id
    )
  );

DROP POLICY IF EXISTS "Developers read completions for own campaigns" ON public.campaign_task_completions;
CREATE POLICY "Developers read completions for own campaigns"
  ON public.campaign_task_completions FOR SELECT
  USING (EXISTS (
    SELECT 1
    FROM public.campaign_tasks ct
    JOIN public.campaigns c ON c.id = ct.campaign_id
    WHERE ct.id = campaign_task_completions.campaign_task_id
      AND c.developer_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Developers review completions for own campaigns" ON public.campaign_task_completions;
CREATE POLICY "Developers review completions for own campaigns"
  ON public.campaign_task_completions FOR UPDATE
  USING (EXISTS (
    SELECT 1
    FROM public.campaign_tasks ct
    JOIN public.campaigns c ON c.id = ct.campaign_id
    WHERE ct.id = campaign_task_completions.campaign_task_id
      AND c.developer_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.campaign_tasks ct
    JOIN public.campaigns c ON c.id = ct.campaign_id
    WHERE ct.id = campaign_task_completions.campaign_task_id
      AND c.developer_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Admins manage all task completions" ON public.campaign_task_completions;
CREATE POLICY "Admins manage all task completions"
  ON public.campaign_task_completions FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── TESTER DEVICES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tester_devices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tester_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_fingerprint  TEXT NOT NULL,
  visitor_id          TEXT,           -- FingerprintJS visitor ID
  device_name         TEXT,
  os                  TEXT,
  os_version          TEXT,
  browser             TEXT,
  screen_resolution   TEXT,
  ip_address          INET,
  geo_country         TEXT,
  geo_city            TEXT,
  is_emulator         BOOLEAN DEFAULT FALSE,
  is_vpn              BOOLEAN DEFAULT FALSE,
  is_datacenter       BOOLEAN DEFAULT FALSE,
  is_bot              BOOLEAN DEFAULT FALSE,
  first_seen_at       TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tester_id, device_fingerprint)
);

ALTER TABLE public.tester_devices
  ADD COLUMN IF NOT EXISTS tester_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS device_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS visitor_id TEXT,
  ADD COLUMN IF NOT EXISTS device_name TEXT,
  ADD COLUMN IF NOT EXISTS os TEXT,
  ADD COLUMN IF NOT EXISTS os_version TEXT,
  ADD COLUMN IF NOT EXISTS browser TEXT,
  ADD COLUMN IF NOT EXISTS screen_resolution TEXT,
  ADD COLUMN IF NOT EXISTS ip_address INET,
  ADD COLUMN IF NOT EXISTS geo_country TEXT,
  ADD COLUMN IF NOT EXISTS geo_city TEXT,
  ADD COLUMN IF NOT EXISTS is_emulator BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_vpn BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_datacenter BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.tester_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Testers manage own devices" ON public.tester_devices;
CREATE POLICY "Testers manage own devices"
  ON public.tester_devices FOR ALL
  USING (auth.uid() = tester_id);

DROP POLICY IF EXISTS "Admins read all devices" ON public.tester_devices;
CREATE POLICY "Admins read all devices"
  ON public.tester_devices FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

-- ─── FEEDBACK ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feedback (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id       UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  campaign_id         UUID NOT NULL REFERENCES public.campaigns(id),
  tester_id           UUID NOT NULL REFERENCES public.profiles(id),
  overall_rating      INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
  usability_score     INTEGER CHECK (usability_score BETWEEN 1 AND 10),
  bugs_found          TEXT,
  suggestions         TEXT,
  screenshots         TEXT[],             -- Supabase Storage URLs
  time_spent_minutes  INTEGER,
  quality_score       INTEGER,            -- AI-assessed 0-100
  is_genuine          BOOLEAN,            -- Fraud check result
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS enrollment_id UUID REFERENCES public.enrollments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id),
  ADD COLUMN IF NOT EXISTS tester_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS overall_rating INTEGER,
  ADD COLUMN IF NOT EXISTS usability_score INTEGER,
  ADD COLUMN IF NOT EXISTS bugs_found TEXT,
  ADD COLUMN IF NOT EXISTS suggestions TEXT,
  ADD COLUMN IF NOT EXISTS screenshots TEXT[],
  ADD COLUMN IF NOT EXISTS time_spent_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS quality_score INTEGER,
  ADD COLUMN IF NOT EXISTS is_genuine BOOLEAN,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Testers manage own feedback" ON public.feedback;
CREATE POLICY "Testers manage own feedback"
  ON public.feedback FOR ALL
  USING (auth.uid() = tester_id);

DROP POLICY IF EXISTS "Developers read feedback for own campaigns" ON public.feedback;
CREATE POLICY "Developers read feedback for own campaigns"
  ON public.feedback FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_id AND c.developer_id = auth.uid()
  ));

-- ─── FRAUD EVENTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fraud_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES public.profiles(id),
  device_id     UUID REFERENCES public.tester_devices(id),
  event_type    TEXT NOT NULL,
                -- 'duplicate_device' | 'vpn_detected' | 'bot_behavior' |
                -- 'rapid_form_fill' | 'multiple_accounts' | 'emulator_detected' |
                -- 'low_engagement' | 'generic_feedback'
  severity      TEXT CHECK (severity IN ('low','medium','high','critical')),
  details       JSONB DEFAULT '{}',
  auto_resolved BOOLEAN DEFAULT FALSE,
  resolved      BOOLEAN DEFAULT FALSE,
  resolved_by   UUID REFERENCES public.profiles(id),
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.fraud_events
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS device_id UUID REFERENCES public.tester_devices(id),
  ADD COLUMN IF NOT EXISTS event_type TEXT,
  ADD COLUMN IF NOT EXISTS severity TEXT,
  ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS auto_resolved BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS resolved BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.fraud_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage fraud events" ON public.fraud_events;
CREATE POLICY "Admins manage fraud events"
  ON public.fraud_events FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

-- ─── TRANSACTIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id),
  campaign_id         UUID REFERENCES public.campaigns(id),
  enrollment_id       UUID REFERENCES public.enrollments(id),
  type                TEXT NOT NULL
                        CHECK (type IN (
                          'campaign_payment','tester_payout',
                          'refund','platform_fee'
                        )),
  amount              NUMERIC(10,2) NOT NULL,
  currency            TEXT DEFAULT 'USD',
  stripe_payment_id   TEXT,
  stripe_transfer_id  TEXT,
  lenco_reference     TEXT,
  payout_phone        TEXT,
  payout_operator     TEXT CHECK (payout_operator IN ('mtn','airtel','zamtel')),
  approval_status     TEXT DEFAULT 'requested'
                        CHECK (approval_status IN ('requested','approved','rejected')),
  approved_by         UUID REFERENCES public.profiles(id),
  approved_at         TIMESTAMPTZ,
  status              TEXT DEFAULT 'pending'
                        CHECK (status IN ('pending','completed','failed','refunded')),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id),
  ADD COLUMN IF NOT EXISTS enrollment_id UUID REFERENCES public.enrollments(id),
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS stripe_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_transfer_id TEXT,
  ADD COLUMN IF NOT EXISTS lenco_reference TEXT,
  ADD COLUMN IF NOT EXISTS payout_phone TEXT,
  ADD COLUMN IF NOT EXISTS payout_operator TEXT,
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'requested',
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own transactions" ON public.transactions;
CREATE POLICY "Users read own transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

-- ─── HELPER FUNCTIONS ─────────────────────────────────────────

-- Recalculate trust score after new fraud event
CREATE OR REPLACE FUNCTION public.update_trust_score(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_critical  INTEGER;
  v_high      INTEGER;
  v_medium    INTEGER;
  v_low       INTEGER;
  v_score     INTEGER;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE severity = 'critical'),
    COUNT(*) FILTER (WHERE severity = 'high'),
    COUNT(*) FILTER (WHERE severity = 'medium'),
    COUNT(*) FILTER (WHERE severity = 'low')
  INTO v_critical, v_high, v_medium, v_low
  FROM public.fraud_events
  WHERE user_id = p_user_id AND resolved = FALSE;

  v_score := GREATEST(0,
    50 - (v_critical * 25) - (v_high * 15) - (v_medium * 8) - (v_low * 3)
  );

  UPDATE public.profiles
  SET trust_score = v_score, updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apps_updated_at ON public.apps;
CREATE TRIGGER apps_updated_at    BEFORE UPDATE ON public.apps    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS campaigns_updated ON public.campaigns;
CREATE TRIGGER campaigns_updated  BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS campaign_tasks_updated ON public.campaign_tasks;
CREATE TRIGGER campaign_tasks_updated BEFORE UPDATE ON public.campaign_tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS campaign_task_completions_updated ON public.campaign_task_completions;
CREATE TRIGGER campaign_task_completions_updated BEFORE UPDATE ON public.campaign_task_completions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS profiles_updated ON public.profiles;
CREATE TRIGGER profiles_updated   BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── INDEXES ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_campaigns_developer     ON public.campaigns(developer_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status        ON public.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaign_tasks_campaign_day ON public.campaign_tasks(campaign_id, day_number);
CREATE INDEX IF NOT EXISTS idx_task_completions_task    ON public.campaign_task_completions(campaign_task_id);
CREATE INDEX IF NOT EXISTS idx_task_completions_enrollment ON public.campaign_task_completions(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_task_completions_tester  ON public.campaign_task_completions(tester_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_campaign    ON public.enrollments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_tester      ON public.enrollments(tester_id);
CREATE INDEX IF NOT EXISTS idx_fraud_events_user       ON public.fraud_events(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_events_severity   ON public.fraud_events(severity) WHERE resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_devices_fingerprint     ON public.tester_devices(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_transactions_user       ON public.transactions(user_id);

-- ─── FEEDBACK SCREENSHOTS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feedback_screenshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id     UUID REFERENCES public.feedback(id) ON DELETE CASCADE,
  tester_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_url        TEXT NOT NULL,
  file_hash       TEXT NOT NULL,
  file_size       INTEGER,
  image_width     INTEGER,
  image_height    INTEGER,
  taken_at        TIMESTAMPTZ,
  device_make     TEXT,
  device_model    TEXT,
  software        TEXT,
  meta_json       JSONB DEFAULT '{}',
  is_flagged      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.feedback_screenshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Testers can manage own screenshots" ON public.feedback_screenshots;
CREATE POLICY "Testers can manage own screenshots"
  ON public.feedback_screenshots FOR ALL
  USING (auth.uid() = tester_id)
  WITH CHECK (auth.uid() = tester_id);

DROP POLICY IF EXISTS "Developers can read feedback screenshots for own campaigns" ON public.feedback_screenshots;
CREATE POLICY "Developers can read feedback screenshots for own campaigns"
  ON public.feedback_screenshots FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.feedback f
    JOIN public.campaigns c ON c.id = f.campaign_id
    WHERE f.id = feedback_id AND c.developer_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Admins can read all feedback screenshots" ON public.feedback_screenshots;
CREATE POLICY "Admins can read all feedback screenshots"
  ON public.feedback_screenshots FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update all feedback screenshots" ON public.feedback_screenshots;
CREATE POLICY "Admins can update all feedback screenshots"
  ON public.feedback_screenshots FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_screenshots_hash ON public.feedback_screenshots(file_hash);
CREATE INDEX IF NOT EXISTS idx_screenshots_tester ON public.feedback_screenshots(tester_id);

-- ─── ADMIN POLICIES AND TRUST SCORE TRIGGERS ─────────────────
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can read all apps" ON public.apps;
CREATE POLICY "Admins can read all apps"
  ON public.apps FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update all apps" ON public.apps;
CREATE POLICY "Admins can update all apps"
  ON public.apps FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can read all campaigns" ON public.campaigns;
CREATE POLICY "Admins can read all campaigns"
  ON public.campaigns FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update all campaigns" ON public.campaigns;
CREATE POLICY "Admins can update all campaigns"
  ON public.campaigns FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can read all enrollments" ON public.enrollments;
CREATE POLICY "Admins can read all enrollments"
  ON public.enrollments FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update all enrollments" ON public.enrollments;
CREATE POLICY "Admins can update all enrollments"
  ON public.enrollments FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can read all feedback" ON public.feedback;
CREATE POLICY "Admins can read all feedback"
  ON public.feedback FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can read all transactions" ON public.transactions;
CREATE POLICY "Admins can read all transactions"
  ON public.transactions FOR SELECT
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.on_fraud_event_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.update_trust_score(NEW.user_id);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.update_trust_score(NEW.user_id);
    IF OLD.user_id <> NEW.user_id THEN
      PERFORM public.update_trust_score(OLD.user_id);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.update_trust_score(OLD.user_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_fraud_event_change ON public.fraud_events;
CREATE TRIGGER on_fraud_event_change
  AFTER INSERT OR UPDATE OR DELETE ON public.fraud_events
  FOR EACH ROW EXECUTE FUNCTION public.on_fraud_event_change();

-- ─── ACCOUNT WALLETS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.account_wallets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance_usd         NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (balance_usd >= 0),
  balance_zmw         NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  total_deposited_usd NUMERIC(12,2) DEFAULT 0.00,
  total_withdrawn_usd NUMERIC(12,2) DEFAULT 0.00,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.account_wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own wallet" ON public.account_wallets;
CREATE POLICY "Users read own wallet"
  ON public.account_wallets FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users cannot modify wallet directly (admin only)" ON public.account_wallets;
CREATE POLICY "Users cannot modify wallet directly (admin only)"
  ON public.account_wallets FOR UPDATE
  USING (FALSE);

DROP POLICY IF EXISTS "Admins read all wallets" ON public.account_wallets;
CREATE POLICY "Admins read all wallets"
  ON public.account_wallets FOR SELECT
  USING (public.is_admin());

-- ─── ADMIN EXCHANGE RATES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_exchange_rates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_usd_to_zmw NUMERIC(10,4) NOT NULL CHECK (rate_usd_to_zmw > 0),
  set_by          UUID NOT NULL REFERENCES public.profiles(id),
  effective_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_exchange_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage exchange rates" ON public.admin_exchange_rates;
CREATE POLICY "Admins manage exchange rates"
  ON public.admin_exchange_rates FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── WALLET TRANSACTIONS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id),
  type                TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  amount_usd          NUMERIC(10,2) NOT NULL CHECK (amount_usd > 0),
  amount_zmw          NUMERIC(10,2),
  status              TEXT DEFAULT 'pending'
                        CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  approval_status     TEXT DEFAULT 'requested'
                        CHECK (approval_status IN ('requested', 'approved', 'rejected')),
  lenco_reference     TEXT,
  payout_phone        TEXT,
  payout_operator     TEXT CHECK (payout_operator IN ('mtn', 'airtel', 'zamtel')),
  approved_by         UUID REFERENCES public.profiles(id),
  approved_at         TIMESTAMPTZ,
  approval_reason     TEXT,
  rejection_reason    TEXT,
  ip_address          INET,
  user_agent          TEXT,
  two_fa_verified_at  TIMESTAMPTZ,
  two_fa_method       TEXT CHECK (two_fa_method IS NULL OR two_fa_method IN ('email', 'sms')),
  initiated_by_admin  BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own wallet transactions" ON public.wallet_transactions;
CREATE POLICY "Users read own wallet transactions"
  ON public.wallet_transactions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users cannot modify transactions (admin only)" ON public.wallet_transactions;
CREATE POLICY "Users cannot modify transactions (admin only)"
  ON public.wallet_transactions FOR UPDATE
  USING (FALSE);

DROP POLICY IF EXISTS "Users cannot delete transactions" ON public.wallet_transactions;
CREATE POLICY "Users cannot delete transactions"
  ON public.wallet_transactions FOR DELETE
  USING (FALSE);

DROP POLICY IF EXISTS "Admins read all wallet transactions" ON public.wallet_transactions;
CREATE POLICY "Admins read all wallet transactions"
  ON public.wallet_transactions FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins update approval status" ON public.wallet_transactions;
CREATE POLICY "Admins update approval status"
  ON public.wallet_transactions FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── TRANSACTION AUDIT LOGS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transaction_audit_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_transaction_id UUID NOT NULL REFERENCES public.wallet_transactions(id) ON DELETE CASCADE,
  admin_id              UUID NOT NULL REFERENCES public.profiles(id),
  action                TEXT NOT NULL CHECK (action IN ('approved', 'rejected', 'initiated')),
  reason                TEXT NOT NULL,
  ip_address            INET,
  user_agent            TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.transaction_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read audit logs" ON public.transaction_audit_logs;
CREATE POLICY "Admins read audit logs"
  ON public.transaction_audit_logs FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Prevent all modifications to audit logs" ON public.transaction_audit_logs;
CREATE POLICY "Prevent all modifications to audit logs"
  ON public.transaction_audit_logs FOR UPDATE
  USING (FALSE);

DROP POLICY IF EXISTS "Prevent deletion of audit logs" ON public.transaction_audit_logs;
CREATE POLICY "Prevent deletion of audit logs"
  ON public.transaction_audit_logs FOR DELETE
  USING (FALSE);

-- ─── WALLET SECURITY LOGS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ip_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.profiles(id),
  ip_address        INET NOT NULL,
  user_agent        TEXT,
  transaction_type  TEXT,
  geo_country       TEXT,
  geo_city          TEXT,
  is_unusual        BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ip_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read IP logs" ON public.ip_logs;
CREATE POLICY "Admins read IP logs"
  ON public.ip_logs FOR SELECT
  USING (public.is_admin());

CREATE TABLE IF NOT EXISTS public.velocity_checks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.profiles(id),
  transaction_type      TEXT NOT NULL,
  hourly_count          INTEGER DEFAULT 0,
  daily_count           INTEGER DEFAULT 0,
  last_reset_hour       TIMESTAMPTZ,
  last_reset_day        TIMESTAMPTZ,
  last_transaction_at   TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, transaction_type)
);

ALTER TABLE public.velocity_checks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  ALTER TABLE public.velocity_checks DROP CONSTRAINT IF EXISTS velocity_checks_user_id_key;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname IN (
      'velocity_checks_user_transaction_type_key',
      'velocity_checks_user_id_transaction_type_key'
    )
      AND conrelid = 'public.velocity_checks'::regclass
  ) THEN
    ALTER TABLE public.velocity_checks
      ADD CONSTRAINT velocity_checks_user_transaction_type_key
      UNIQUE (user_id, transaction_type);
  END IF;
END $$;

DROP POLICY IF EXISTS "Admins read velocity checks" ON public.velocity_checks;
CREATE POLICY "Admins read velocity checks"
  ON public.velocity_checks FOR SELECT
  USING (public.is_admin());

-- ─── WALLET FUNCTIONS ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_wallet_for_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.account_wallets (user_id, balance_usd)
  VALUES (NEW.id, 0.00)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_create_wallet ON public.profiles;
CREATE TRIGGER on_profile_created_create_wallet
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_wallet_for_user();

INSERT INTO public.account_wallets (user_id, balance_usd)
SELECT id, 0.00
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ensure_exchange_rate()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.admin_exchange_rates (rate_usd_to_zmw, set_by, effective_at)
  SELECT 26.00, id, NOW()
  FROM public.profiles
  WHERE role = 'admin'
  LIMIT 1
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_exchange_rate()
RETURNS NUMERIC LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_rate NUMERIC;
BEGIN
  SELECT rate_usd_to_zmw INTO v_rate
  FROM public.admin_exchange_rates
  WHERE effective_at <= NOW()
  ORDER BY effective_at DESC
  LIMIT 1;

  RETURN COALESCE(v_rate, 26.00);
END;
$$;

CREATE OR REPLACE FUNCTION public.check_velocity_limit(
  p_user_id UUID,
  p_transaction_type TEXT,
  p_hourly_limit INTEGER DEFAULT 5,
  p_daily_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  allowed BOOLEAN,
  hourly_count INTEGER,
  daily_count INTEGER,
  reason TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_hourly_count INTEGER;
  v_daily_count INTEGER;
  v_now TIMESTAMPTZ;
BEGIN
  v_now := NOW();

  INSERT INTO public.velocity_checks (user_id, transaction_type)
  VALUES (p_user_id, p_transaction_type)
  ON CONFLICT (user_id, transaction_type) DO NOTHING;

  SELECT COALESCE(vc.hourly_count, 0), COALESCE(vc.daily_count, 0)
  INTO v_hourly_count, v_daily_count
  FROM public.velocity_checks vc
  WHERE vc.user_id = p_user_id AND vc.transaction_type = p_transaction_type;

  IF (SELECT last_reset_hour FROM public.velocity_checks
      WHERE user_id = p_user_id AND transaction_type = p_transaction_type) IS NULL
     OR (v_now - (SELECT last_reset_hour FROM public.velocity_checks
         WHERE user_id = p_user_id AND transaction_type = p_transaction_type)) > INTERVAL '1 hour'
  THEN
    v_hourly_count := 0;
    UPDATE public.velocity_checks
    SET last_reset_hour = v_now, hourly_count = 0
    WHERE user_id = p_user_id AND transaction_type = p_transaction_type;
  END IF;

  IF (SELECT last_reset_day FROM public.velocity_checks
      WHERE user_id = p_user_id AND transaction_type = p_transaction_type) IS NULL
     OR (v_now - (SELECT last_reset_day FROM public.velocity_checks
         WHERE user_id = p_user_id AND transaction_type = p_transaction_type)) > INTERVAL '1 day'
  THEN
    v_daily_count := 0;
    UPDATE public.velocity_checks
    SET last_reset_day = v_now, daily_count = 0
    WHERE user_id = p_user_id AND transaction_type = p_transaction_type;
  END IF;

  RETURN QUERY SELECT
    (v_hourly_count < p_hourly_limit AND v_daily_count < p_daily_limit)::BOOLEAN,
    v_hourly_count,
    v_daily_count,
    CASE
      WHEN v_hourly_count >= p_hourly_limit THEN 'Hourly limit exceeded'
      WHEN v_daily_count >= p_daily_limit THEN 'Daily limit exceeded'
      ELSE NULL
    END;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_transaction_velocity(
  p_user_id UUID,
  p_transaction_type TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_now TIMESTAMPTZ;
BEGIN
  v_now := NOW();

  INSERT INTO public.velocity_checks (user_id, transaction_type)
  VALUES (p_user_id, p_transaction_type)
  ON CONFLICT (user_id, transaction_type) DO NOTHING;

  UPDATE public.velocity_checks
  SET
    hourly_count = hourly_count + 1,
    daily_count = daily_count + 1,
    last_transaction_at = v_now
  WHERE user_id = p_user_id AND transaction_type = p_transaction_type;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_ip_address(
  p_user_id UUID,
  p_ip_address INET,
  p_user_agent TEXT,
  p_transaction_type TEXT
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_log_id UUID;
  v_is_unusual BOOLEAN;
  v_last_ip INET;
BEGIN
  SELECT ip_address INTO v_last_ip
  FROM public.ip_logs
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  v_is_unusual := (v_last_ip IS NOT NULL AND v_last_ip != p_ip_address);

  INSERT INTO public.ip_logs (
    user_id, ip_address, user_agent, transaction_type, is_unusual
  ) VALUES (p_user_id, p_ip_address, p_user_agent, p_transaction_type, v_is_unusual)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_wallet_transaction(
  p_transaction_id UUID,
  p_approval_reason TEXT DEFAULT 'Approved by admin'
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
  v_amount_usd NUMERIC;
  v_transaction_type TEXT;
  v_approval_status TEXT;
  v_admin_id UUID;
  v_wallet_balance NUMERIC;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN QUERY SELECT FALSE::BOOLEAN, 'Unauthorized: Admin only'::TEXT;
    RETURN;
  END IF;

  v_admin_id := auth.uid();

  SELECT user_id, amount_usd, type, approval_status
  INTO v_user_id, v_amount_usd, v_transaction_type, v_approval_status
  FROM public.wallet_transactions
  WHERE id = p_transaction_id;

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE::BOOLEAN, 'Transaction not found'::TEXT;
    RETURN;
  END IF;

  IF v_approval_status = 'approved' THEN
    RETURN QUERY SELECT TRUE::BOOLEAN, 'Transaction already approved'::TEXT;
    RETURN;
  END IF;

  -- For withdrawals, verify sufficient balance before approving
  IF v_transaction_type = 'withdrawal' THEN
    SELECT balance_usd INTO v_wallet_balance
    FROM public.account_wallets
    WHERE user_id = v_user_id;

    IF v_wallet_balance IS NULL OR v_wallet_balance < v_amount_usd THEN
      RETURN QUERY SELECT FALSE::BOOLEAN, 'Insufficient wallet balance for withdrawal'::TEXT;
      RETURN;
    END IF;
  END IF;

  UPDATE public.wallet_transactions
  SET
    approval_status = 'approved',
    approved_by = v_admin_id,
    approved_at = NOW(),
    status = 'completed',
    approval_reason = p_approval_reason,
    updated_at = NOW()
  WHERE id = p_transaction_id;

  INSERT INTO public.transaction_audit_logs (
    wallet_transaction_id, admin_id, action, reason, ip_address
  ) VALUES (p_transaction_id, v_admin_id, 'approved', p_approval_reason,
    (SELECT ip_address FROM public.ip_logs WHERE user_id = v_user_id ORDER BY created_at DESC LIMIT 1));

  -- Credit deposits
  IF v_transaction_type = 'deposit' THEN
    UPDATE public.account_wallets
    SET
      balance_usd = balance_usd + v_amount_usd,
      total_deposited_usd = total_deposited_usd + v_amount_usd,
      updated_at = NOW()
    WHERE user_id = v_user_id;
  -- Debit withdrawals
  ELSIF v_transaction_type = 'withdrawal' THEN
    UPDATE public.account_wallets
    SET
      balance_usd = balance_usd - v_amount_usd,
      total_withdrawn_usd = total_withdrawn_usd + v_amount_usd,
      updated_at = NOW()
    WHERE user_id = v_user_id;
  END IF;

  RETURN QUERY SELECT TRUE::BOOLEAN, 'Transaction approved successfully'::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_wallet_transaction(
  p_transaction_id UUID,
  p_rejection_reason TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN QUERY SELECT FALSE::BOOLEAN, 'Unauthorized: Admin only'::TEXT;
    RETURN;
  END IF;

  v_admin_id := auth.uid();

  UPDATE public.wallet_transactions
  SET
    approval_status = 'rejected',
    approved_by = v_admin_id,
    approved_at = NOW(),
    rejection_reason = p_rejection_reason,
    updated_at = NOW()
  WHERE id = p_transaction_id;

  INSERT INTO public.transaction_audit_logs (
    wallet_transaction_id, admin_id, action, reason
  ) VALUES (p_transaction_id, v_admin_id, 'rejected', p_rejection_reason);

  RETURN QUERY SELECT TRUE::BOOLEAN, 'Transaction rejected'::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_admin_withdrawal(
  p_tester_id UUID,
  p_amount_usd NUMERIC,
  p_reason TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  transaction_id UUID,
  message TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_admin_id UUID;
  v_wallet_balance NUMERIC;
  v_transaction_id UUID;
  v_user_role TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN QUERY SELECT FALSE::BOOLEAN, NULL::UUID, 'Unauthorized: Admin only'::TEXT;
    RETURN;
  END IF;

  v_admin_id := auth.uid();

  SELECT role INTO v_user_role FROM public.profiles WHERE id = p_tester_id;
  IF v_user_role IS NULL THEN
    RETURN QUERY SELECT FALSE::BOOLEAN, NULL::UUID, 'User not found'::TEXT;
    RETURN;
  END IF;

  IF v_user_role != 'tester' THEN
    RETURN QUERY SELECT FALSE::BOOLEAN, NULL::UUID, 'User is not a tester'::TEXT;
    RETURN;
  END IF;

  SELECT balance_usd INTO v_wallet_balance FROM public.account_wallets WHERE user_id = p_tester_id;
  IF v_wallet_balance IS NULL OR v_wallet_balance < p_amount_usd THEN
    RETURN QUERY SELECT FALSE::BOOLEAN, NULL::UUID, 'Insufficient funds'::TEXT;
    RETURN;
  END IF;

  INSERT INTO public.wallet_transactions (
    user_id, type, amount_usd, approval_status, initiated_by_admin, approval_reason
  ) VALUES (p_tester_id, 'withdrawal', p_amount_usd, 'approved', TRUE, p_reason)
  RETURNING id INTO v_transaction_id;

  INSERT INTO public.transaction_audit_logs (
    wallet_transaction_id, admin_id, action, reason
  ) VALUES (v_transaction_id, v_admin_id, 'initiated', p_reason);

  UPDATE public.account_wallets
  SET
    balance_usd = balance_usd - p_amount_usd,
    total_withdrawn_usd = total_withdrawn_usd + p_amount_usd,
    updated_at = NOW()
  WHERE user_id = p_tester_id;

  RETURN QUERY SELECT TRUE::BOOLEAN, v_transaction_id, 'Withdrawal initiated successfully'::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_wallet_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_wallet_balance_zmw()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.balance_zmw := NEW.balance_usd * public.get_exchange_rate();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_wallet_balance_zmw ON public.account_wallets;
CREATE TRIGGER sync_wallet_balance_zmw
  BEFORE INSERT OR UPDATE ON public.account_wallets
  FOR EACH ROW EXECUTE FUNCTION public.sync_wallet_balance_zmw();

DROP TRIGGER IF EXISTS account_wallets_updated_at ON public.account_wallets;
CREATE TRIGGER account_wallets_updated_at
  BEFORE UPDATE ON public.account_wallets
  FOR EACH ROW EXECUTE FUNCTION public.set_wallet_updated_at();

DROP TRIGGER IF EXISTS wallet_transactions_updated_at ON public.wallet_transactions;
CREATE TRIGGER wallet_transactions_updated_at
  BEFORE UPDATE ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_wallet_updated_at();

DROP TRIGGER IF EXISTS velocity_checks_updated_at ON public.velocity_checks;
CREATE TRIGGER velocity_checks_updated_at
  BEFORE UPDATE ON public.velocity_checks
  FOR EACH ROW EXECUTE FUNCTION public.set_wallet_updated_at();

CREATE INDEX IF NOT EXISTS idx_account_wallets_user ON public.account_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user ON public.wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status ON public.wallet_transactions(status);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_approval ON public.wallet_transactions(approval_status);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created ON public.wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_audit_logs_admin ON public.transaction_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_transaction_audit_logs_created ON public.transaction_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ip_logs_user ON public.ip_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ip_logs_created ON public.ip_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_velocity_checks_user ON public.velocity_checks(user_id);

INSERT INTO public.admin_exchange_rates (rate_usd_to_zmw, set_by, effective_at)
SELECT 26.00, id, NOW()
FROM public.profiles
WHERE role = 'admin'
LIMIT 1
ON CONFLICT DO NOTHING;

-- ─── ADMIN CONTROL PLANE ─────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT,
  ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS banned_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_account_status_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_account_status_check
      CHECK (account_status IN ('active', 'suspended', 'banned'));
  END IF;
END $$;

ALTER TABLE public.tester_devices
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tester_devices_status_check'
      AND conrelid = 'public.tester_devices'::regclass
  ) THEN
    ALTER TABLE public.tester_devices
      ADD CONSTRAINT tester_devices_status_check
      CHECK (status IN ('active', 'suspended', 'banned'));
  END IF;
END $$;

DROP POLICY IF EXISTS "Admins update all devices" ON public.tester_devices;
CREATE POLICY "Admins update all devices"
  ON public.tester_devices FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_notes TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT,
  ADD COLUMN IF NOT EXISTS funded_amount_usd NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS platform_fee_amount_usd NUMERIC(12,2) NOT NULL DEFAULT 0.00;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'campaigns_review_status_check'
      AND conrelid = 'public.campaigns'::regclass
  ) THEN
    ALTER TABLE public.campaigns
      ADD CONSTRAINT campaigns_review_status_check
      CHECK (review_status IN ('pending', 'approved', 'rejected', 'suspended'));
  END IF;
END $$;

UPDATE public.campaigns
SET
  funded_amount_usd = COALESCE(budget_total, 0),
  platform_fee_amount_usd = ROUND((COALESCE(budget_total, 0) * COALESCE(platform_fee_pct, 0) / 100.0)::numeric, 2)
WHERE funded_amount_usd = 0
  AND COALESCE(budget_total, 0) > 0
  AND status IN ('funded', 'recruiting', 'in_progress', 'verification', 'completed');

CREATE TABLE IF NOT EXISTS public.admin_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        UUID NOT NULL REFERENCES public.profiles(id),
  target_type     TEXT NOT NULL
                    CHECK (target_type IN ('user', 'device', 'campaign', 'wallet', 'platform')),
  target_id       UUID,
  action          TEXT NOT NULL,
  reason          TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read admin actions" ON public.admin_actions;
CREATE POLICY "Admins read admin actions"
  ON public.admin_actions FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins create admin actions" ON public.admin_actions;
CREATE POLICY "Admins create admin actions"
  ON public.admin_actions FOR INSERT
  WITH CHECK (public.is_admin() AND admin_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.platform_accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL UNIQUE,
  cash_balance_usd      NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  reserved_funds_usd    NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  platform_revenue_usd  NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  updated_by            UUID REFERENCES public.profiles(id),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  CHECK (cash_balance_usd >= 0),
  CHECK (reserved_funds_usd >= 0),
  CHECK (platform_revenue_usd >= 0)
);

CREATE TABLE IF NOT EXISTS public.platform_ledger_entries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_account_id   UUID NOT NULL REFERENCES public.platform_accounts(id) ON DELETE CASCADE,
  wallet_transaction_id UUID REFERENCES public.wallet_transactions(id),
  campaign_id           UUID REFERENCES public.campaigns(id),
  type                  TEXT NOT NULL
                          CHECK (type IN ('deposit', 'withdrawal', 'campaign_reserve', 'campaign_release', 'platform_fee', 'adjustment')),
  amount_usd            NUMERIC(12,2) NOT NULL,
  description           TEXT,
  created_by            UUID REFERENCES public.profiles(id),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.platform_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_ledger_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage platform accounts" ON public.platform_accounts;
CREATE POLICY "Admins manage platform accounts"
  ON public.platform_accounts FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage platform ledger" ON public.platform_ledger_entries;
CREATE POLICY "Admins manage platform ledger"
  ON public.platform_ledger_entries FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

INSERT INTO public.platform_accounts (name)
VALUES ('main')
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE VIEW public.admin_campaign_overview AS
SELECT
  c.id,
  c.title,
  c.status,
  c.review_status,
  c.developer_id,
  p.email AS developer_email,
  c.testers_required,
  c.testers_enrolled,
  c.duration_days,
  c.starts_at,
  c.ends_at,
  c.budget_total,
  c.funded_amount_usd,
  c.platform_fee_amount_usd,
  COUNT(DISTINCT e.id) AS enrollment_count,
  COUNT(DISTINCT e.id) FILTER (WHERE e.status IN ('active', 'completed')) AS active_or_completed_enrollments,
  COUNT(DISTINCT ctc.id) AS submitted_task_completions,
  COUNT(DISTINCT ctc.id) FILTER (WHERE ctc.status = 'approved') AS approved_task_completions,
  CASE
    WHEN c.starts_at IS NULL THEN 0
    WHEN c.ends_at IS NOT NULL AND NOW() >= c.ends_at THEN 100
    ELSE LEAST(
      100,
      GREATEST(
        0,
        ROUND(
          (EXTRACT(EPOCH FROM (NOW() - c.starts_at))
            / NULLIF(EXTRACT(EPOCH FROM ((c.starts_at + (c.duration_days || ' days')::interval) - c.starts_at)), 0)
          ) * 100
        )::integer
      )
    )
  END AS time_progress_pct
FROM public.campaigns c
LEFT JOIN public.profiles p ON p.id = c.developer_id
LEFT JOIN public.enrollments e ON e.campaign_id = c.id
LEFT JOIN public.campaign_tasks ct ON ct.campaign_id = c.id
LEFT JOIN public.campaign_task_completions ctc ON ctc.campaign_task_id = ct.id
GROUP BY c.id, p.email;

CREATE OR REPLACE VIEW public.platform_financial_summary AS
SELECT
  COALESCE(SUM(balance_usd), 0)::numeric(12,2) AS total_user_wallet_balance_usd,
  COALESCE(SUM(total_deposited_usd), 0)::numeric(12,2) AS total_user_deposits_usd,
  COALESCE(SUM(total_withdrawn_usd), 0)::numeric(12,2) AS total_user_withdrawals_usd,
  (
    SELECT COALESCE(SUM(amount_usd), 0)::numeric(12,2)
    FROM public.wallet_transactions
    WHERE type = 'deposit' AND approval_status = 'requested'
  ) AS pending_deposits_usd,
  (
    SELECT COALESCE(SUM(amount_usd), 0)::numeric(12,2)
    FROM public.wallet_transactions
    WHERE type = 'withdrawal' AND approval_status = 'requested'
  ) AS pending_withdrawals_usd,
  (
    SELECT COALESCE(SUM(platform_fee_amount_usd), 0)::numeric(12,2)
    FROM public.campaigns
    WHERE status IN ('funded', 'recruiting', 'in_progress', 'verification', 'completed')
  ) AS expected_platform_fees_usd,
  (
    SELECT COALESCE(SUM(cash_balance_usd), 0)::numeric(12,2)
    FROM public.platform_accounts
  ) AS platform_cash_balance_usd,
  (
    SELECT COALESCE(SUM(reserved_funds_usd), 0)::numeric(12,2)
    FROM public.platform_accounts
  ) AS platform_reserved_funds_usd,
  (
    SELECT COALESCE(SUM(platform_revenue_usd), 0)::numeric(12,2)
    FROM public.platform_accounts
  ) AS platform_revenue_usd
FROM public.account_wallets;

CREATE OR REPLACE FUNCTION public.get_admin_campaign_overview()
RETURNS SETOF public.admin_campaign_overview
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT *
  FROM public.admin_campaign_overview
  WHERE public.is_admin();
$$;

CREATE OR REPLACE FUNCTION public.get_platform_financial_summary()
RETURNS SETOF public.platform_financial_summary
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT *
  FROM public.platform_financial_summary
  WHERE public.is_admin();
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_status(
  p_user_id UUID,
  p_status TEXT,
  p_reason TEXT DEFAULT NULL,
  p_suspended_until TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN QUERY SELECT FALSE, 'Unauthorized: Admin only';
    RETURN;
  END IF;

  IF p_status NOT IN ('active', 'suspended', 'banned') THEN
    RETURN QUERY SELECT FALSE, 'Invalid user status';
    RETURN;
  END IF;

  v_admin_id := auth.uid();

  UPDATE public.profiles
  SET
    account_status = p_status,
    suspended_until = CASE WHEN p_status = 'suspended' THEN p_suspended_until ELSE NULL END,
    suspended_reason = CASE WHEN p_status IN ('suspended', 'banned') THEN p_reason ELSE NULL END,
    banned_at = CASE WHEN p_status = 'banned' THEN NOW() ELSE NULL END,
    banned_by = CASE WHEN p_status = 'banned' THEN v_admin_id ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'User not found';
    RETURN;
  END IF;

  INSERT INTO public.admin_actions (admin_id, target_type, target_id, action, reason, metadata)
  VALUES (
    v_admin_id,
    'user',
    p_user_id,
    'set_status',
    p_reason,
    jsonb_build_object('status', p_status, 'suspended_until', p_suspended_until)
  );

  RETURN QUERY SELECT TRUE, 'User status updated';
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_device_status(
  p_device_id UUID,
  p_status TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN QUERY SELECT FALSE, 'Unauthorized: Admin only';
    RETURN;
  END IF;

  IF p_status NOT IN ('active', 'suspended', 'banned') THEN
    RETURN QUERY SELECT FALSE, 'Invalid device status';
    RETURN;
  END IF;

  v_admin_id := auth.uid();

  UPDATE public.tester_devices
  SET
    status = p_status,
    suspended_at = CASE WHEN p_status IN ('suspended', 'banned') THEN NOW() ELSE NULL END,
    suspended_by = CASE WHEN p_status IN ('suspended', 'banned') THEN v_admin_id ELSE NULL END,
    suspended_reason = CASE WHEN p_status IN ('suspended', 'banned') THEN p_reason ELSE NULL END
  WHERE id = p_device_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Device not found';
    RETURN;
  END IF;

  INSERT INTO public.admin_actions (admin_id, target_type, target_id, action, reason, metadata)
  VALUES (v_admin_id, 'device', p_device_id, 'set_status', p_reason, jsonb_build_object('status', p_status));

  RETURN QUERY SELECT TRUE, 'Device status updated';
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_campaign(
  p_campaign_id UUID,
  p_decision TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN QUERY SELECT FALSE, 'Unauthorized: Admin only';
    RETURN;
  END IF;

  IF p_decision NOT IN ('approved', 'rejected', 'suspended') THEN
    RETURN QUERY SELECT FALSE, 'Invalid campaign decision';
    RETURN;
  END IF;

  v_admin_id := auth.uid();

  UPDATE public.campaigns
  SET
    review_status = p_decision,
    reviewed_by = v_admin_id,
    reviewed_at = NOW(),
    review_notes = p_notes,
    approved_at = CASE WHEN p_decision = 'approved' THEN NOW() ELSE approved_at END,
    suspended_at = CASE WHEN p_decision = 'suspended' THEN NOW() ELSE suspended_at END,
    suspended_by = CASE WHEN p_decision = 'suspended' THEN v_admin_id ELSE suspended_by END,
    suspended_reason = CASE WHEN p_decision = 'suspended' THEN p_notes ELSE suspended_reason END,
    status = CASE
      WHEN p_decision = 'rejected' THEN 'cancelled'
      WHEN p_decision = 'suspended' THEN 'cancelled'
      ELSE status
    END,
    updated_at = NOW()
  WHERE id = p_campaign_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Campaign not found';
    RETURN;
  END IF;

  INSERT INTO public.admin_actions (admin_id, target_type, target_id, action, reason, metadata)
  VALUES (v_admin_id, 'campaign', p_campaign_id, 'review_campaign', p_notes, jsonb_build_object('decision', p_decision));

  RETURN QUERY SELECT TRUE, 'Campaign review updated';
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_record_platform_ledger_entry(
  p_type TEXT,
  p_amount_usd NUMERIC,
  p_description TEXT DEFAULT NULL,
  p_campaign_id UUID DEFAULT NULL,
  p_wallet_transaction_id UUID DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, ledger_entry_id UUID, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_account_id UUID;
  v_entry_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Unauthorized: Admin only';
    RETURN;
  END IF;

  IF p_type NOT IN ('deposit', 'withdrawal', 'campaign_reserve', 'campaign_release', 'platform_fee', 'adjustment') THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Invalid ledger type';
    RETURN;
  END IF;

  v_admin_id := auth.uid();

  SELECT id INTO v_account_id
  FROM public.platform_accounts
  WHERE name = 'main'
  LIMIT 1;

  IF v_account_id IS NULL THEN
    INSERT INTO public.platform_accounts (name, updated_by)
    VALUES ('main', v_admin_id)
    RETURNING id INTO v_account_id;
  END IF;

  INSERT INTO public.platform_ledger_entries (
    platform_account_id,
    wallet_transaction_id,
    campaign_id,
    type,
    amount_usd,
    description,
    created_by
  ) VALUES (
    v_account_id,
    p_wallet_transaction_id,
    p_campaign_id,
    p_type,
    p_amount_usd,
    p_description,
    v_admin_id
  )
  RETURNING id INTO v_entry_id;

  UPDATE public.platform_accounts
  SET
    cash_balance_usd = cash_balance_usd + CASE
      WHEN p_type IN ('deposit', 'platform_fee', 'adjustment') THEN p_amount_usd
      WHEN p_type = 'withdrawal' THEN -p_amount_usd
      ELSE 0
    END,
    reserved_funds_usd = reserved_funds_usd + CASE
      WHEN p_type = 'campaign_reserve' THEN p_amount_usd
      WHEN p_type = 'campaign_release' THEN -p_amount_usd
      ELSE 0
    END,
    platform_revenue_usd = platform_revenue_usd + CASE
      WHEN p_type = 'platform_fee' THEN p_amount_usd
      ELSE 0
    END,
    updated_by = v_admin_id,
    updated_at = NOW()
  WHERE id = v_account_id;

  INSERT INTO public.admin_actions (admin_id, target_type, target_id, action, reason, metadata)
  VALUES (
    v_admin_id,
    'platform',
    v_entry_id,
    'record_ledger_entry',
    p_description,
    jsonb_build_object('type', p_type, 'amount_usd', p_amount_usd)
  );

  RETURN QUERY SELECT TRUE, v_entry_id, 'Ledger entry recorded';
END;
$$;

CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON public.admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target ON public.admin_actions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON public.admin_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_ledger_account ON public.platform_ledger_entries(platform_account_id);
CREATE INDEX IF NOT EXISTS idx_platform_ledger_campaign ON public.platform_ledger_entries(campaign_id);
CREATE INDEX IF NOT EXISTS idx_platform_ledger_created ON public.platform_ledger_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_tester_devices_status ON public.tester_devices(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_review_status ON public.campaigns(review_status);
