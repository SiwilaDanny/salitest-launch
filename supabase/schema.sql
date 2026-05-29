-- ═══════════════════════════════════════════════════════════
-- SaLiTeSt Launch — Full Database Schema
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── PROFILES ────────────────────────────────────────────────
CREATE TABLE public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  full_name       TEXT,
  avatar_url      TEXT,
  role            TEXT NOT NULL DEFAULT 'developer'
                    CHECK (role IN ('developer', 'tester', 'admin')),
  phone           TEXT,
  country         TEXT,
  is_verified     BOOLEAN DEFAULT FALSE,
  trust_score     INTEGER DEFAULT 50 CHECK (trust_score BETWEEN 0 AND 100),
  stripe_customer_id TEXT,
  stripe_account_id  TEXT,    -- Stripe Connect for tester payouts
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'developer')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── APPS ─────────────────────────────────────────────────────
CREATE TABLE public.apps (
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

ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers can manage own apps"
  ON public.apps FOR ALL
  USING (auth.uid() = developer_id);

CREATE POLICY "Testers can read active apps"
  ON public.apps FOR SELECT
  USING (status = 'active');

-- ─── CAMPAIGNS ────────────────────────────────────────────────
CREATE TABLE public.campaigns (
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

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers manage own campaigns"
  ON public.campaigns FOR ALL
  USING (auth.uid() = developer_id);

CREATE POLICY "Testers can read recruiting campaigns"
  ON public.campaigns FOR SELECT
  USING (status IN ('recruiting','in_progress'));

-- ─── ENROLLMENTS ──────────────────────────────────────────────
CREATE TABLE public.enrollments (
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

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Testers manage own enrollments"
  ON public.enrollments FOR ALL
  USING (auth.uid() = tester_id);

CREATE POLICY "Developers read enrollments for own campaigns"
  ON public.enrollments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_id AND c.developer_id = auth.uid()
  ));

-- ─── TESTER DEVICES ───────────────────────────────────────────
CREATE TABLE public.tester_devices (
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
  UNIQUE(device_fingerprint)
);

ALTER TABLE public.tester_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Testers manage own devices"
  ON public.tester_devices FOR ALL
  USING (auth.uid() = tester_id);

CREATE POLICY "Admins read all devices"
  ON public.tester_devices FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

-- ─── FEEDBACK ─────────────────────────────────────────────────
CREATE TABLE public.feedback (
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

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Testers manage own feedback"
  ON public.feedback FOR ALL
  USING (auth.uid() = tester_id);

CREATE POLICY "Developers read feedback for own campaigns"
  ON public.feedback FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_id AND c.developer_id = auth.uid()
  ));

-- ─── FRAUD EVENTS ─────────────────────────────────────────────
CREATE TABLE public.fraud_events (
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

ALTER TABLE public.fraud_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage fraud events"
  ON public.fraud_events FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

-- ─── TRANSACTIONS ─────────────────────────────────────────────
CREATE TABLE public.transactions (
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
  status              TEXT DEFAULT 'pending'
                        CHECK (status IN ('pending','completed','failed','refunded')),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

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

CREATE TRIGGER apps_updated_at    BEFORE UPDATE ON public.apps    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER campaigns_updated  BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER profiles_updated   BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── INDEXES ──────────────────────────────────────────────────
CREATE INDEX idx_campaigns_developer     ON public.campaigns(developer_id);
CREATE INDEX idx_campaigns_status        ON public.campaigns(status);
CREATE INDEX idx_enrollments_campaign    ON public.enrollments(campaign_id);
CREATE INDEX idx_enrollments_tester      ON public.enrollments(tester_id);
CREATE INDEX idx_fraud_events_user       ON public.fraud_events(user_id);
CREATE INDEX idx_fraud_events_severity   ON public.fraud_events(severity) WHERE resolved = FALSE;
CREATE INDEX idx_devices_fingerprint     ON public.tester_devices(device_fingerprint);
CREATE INDEX idx_transactions_user       ON public.transactions(user_id);
