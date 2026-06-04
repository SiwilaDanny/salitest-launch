-- SaLiTeSt Launch — Admin Control Plane
-- User/device moderation, campaign review, and platform fund visibility

-- ─── USER MODERATION FIELDS ──────────────────────────────────
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

-- ─── DEVICE MODERATION FIELDS ────────────────────────────────
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

-- ─── CAMPAIGN REVIEW / MODERATION FIELDS ─────────────────────
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

-- ─── ADMIN AUDIT ACTIONS ─────────────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON public.admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target ON public.admin_actions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON public.admin_actions(created_at DESC);

-- ─── PLATFORM FUNDS ──────────────────────────────────────────
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
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_account_id UUID NOT NULL REFERENCES public.platform_accounts(id) ON DELETE CASCADE,
  wallet_transaction_id UUID REFERENCES public.wallet_transactions(id),
  campaign_id         UUID REFERENCES public.campaigns(id),
  type                TEXT NOT NULL
                        CHECK (type IN ('deposit', 'withdrawal', 'campaign_reserve', 'campaign_release', 'platform_fee', 'adjustment')),
  amount_usd          NUMERIC(12,2) NOT NULL,
  description         TEXT,
  created_by          UUID REFERENCES public.profiles(id),
  created_at          TIMESTAMPTZ DEFAULT NOW()
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

CREATE INDEX IF NOT EXISTS idx_platform_ledger_account ON public.platform_ledger_entries(platform_account_id);
CREATE INDEX IF NOT EXISTS idx_platform_ledger_campaign ON public.platform_ledger_entries(campaign_id);
CREATE INDEX IF NOT EXISTS idx_platform_ledger_created ON public.platform_ledger_entries(created_at DESC);

-- ─── ADMIN SUMMARY VIEWS ─────────────────────────────────────
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

-- Views cannot have RLS directly; expose them through SECURITY DEFINER RPCs.
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

-- ─── ADMIN ACTION FUNCTIONS ──────────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_tester_devices_status ON public.tester_devices(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_review_status ON public.campaigns(review_status);
