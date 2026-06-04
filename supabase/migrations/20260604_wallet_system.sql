-- SaLiTeSt Launch — Wallet & Fund Approval System
-- Run in Supabase SQL Editor
-- Phase 1: Database Schema & Security

-- ─── ACCOUNT WALLETS ──────────────────────────────────────────
-- Main wallet for user account balances
CREATE TABLE IF NOT EXISTS public.account_wallets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance_usd     NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (balance_usd >= 0),
  balance_zmw     NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  total_deposited_usd NUMERIC(12,2) DEFAULT 0.00,
  total_withdrawn_usd NUMERIC(12,2) DEFAULT 0.00,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
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

-- ─── ADMIN EXCHANGE RATES ─────────────────────────────────────
-- USD to ZMW exchange rate set by admin
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

-- ─── WALLET TRANSACTIONS ──────────────────────────────────────
-- All wallet deposit/withdrawal history
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id),
  type            TEXT NOT NULL
                    CHECK (type IN ('deposit', 'withdrawal')),
  amount_usd      NUMERIC(10,2) NOT NULL CHECK (amount_usd > 0),
  amount_zmw      NUMERIC(10,2),  -- Calculated at transaction time
  status          TEXT DEFAULT 'pending'
                    CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  approval_status TEXT DEFAULT 'requested'
                    CHECK (approval_status IN ('requested', 'approved', 'rejected')),
  
  -- Lenco payment integration
  lenco_reference TEXT,
  payout_phone    TEXT,
  payout_operator TEXT CHECK (payout_operator IN ('mtn', 'airtel', 'zamtel')),
  
  -- Admin approval
  approved_by     UUID REFERENCES public.profiles(id),
  approved_at     TIMESTAMPTZ,
  approval_reason TEXT,
  rejection_reason TEXT,
  
  -- Security & audit
  ip_address      INET,
  user_agent      TEXT,
  two_fa_verified_at TIMESTAMPTZ,
  two_fa_method   TEXT CHECK (two_fa_method IS NULL OR two_fa_method IN ('email', 'sms')),
  
  -- Admin-initiated flag (for admin-created tester withdrawals)
  initiated_by_admin BOOLEAN DEFAULT FALSE,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
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

-- ─── TRANSACTION AUDIT LOGS ────────────────────────────────────
-- Immutable approval audit trail
CREATE TABLE IF NOT EXISTS public.transaction_audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_transaction_id UUID NOT NULL REFERENCES public.wallet_transactions(id) ON DELETE CASCADE,
  admin_id        UUID NOT NULL REFERENCES public.profiles(id),
  action          TEXT NOT NULL
                    CHECK (action IN ('approved', 'rejected', 'initiated')),
  reason          TEXT NOT NULL,
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
  -- Intentionally NO updates or deletes allowed
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

-- ─── IP LOGS ──────────────────────────────────────────────────
-- Track user IP addresses for security and fraud detection
CREATE TABLE IF NOT EXISTS public.ip_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id),
  ip_address      INET NOT NULL,
  user_agent      TEXT,
  transaction_type TEXT,
  geo_country     TEXT,
  geo_city        TEXT,
  is_unusual      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ip_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read IP logs" ON public.ip_logs;
CREATE POLICY "Admins read IP logs"
  ON public.ip_logs FOR SELECT
  USING (public.is_admin());

-- ─── VELOCITY CHECKS ──────────────────────────────────────────
-- Track transaction frequency for rate limiting
CREATE TABLE IF NOT EXISTS public.velocity_checks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id),
  transaction_type TEXT NOT NULL,  -- 'deposit' or 'withdrawal'
  hourly_count    INTEGER DEFAULT 0,
  daily_count     INTEGER DEFAULT 0,
  last_reset_hour TIMESTAMPTZ,
  last_reset_day  TIMESTAMPTZ,
  last_transaction_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
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

-- ─── HELPER FUNCTIONS ─────────────────────────────────────────

-- Create wallet for new user
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

-- Initialize exchange rate if none exists
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

-- Get current exchange rate (cached)
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

-- Check and update velocity limits
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
  
  -- Get or create velocity check record
  INSERT INTO public.velocity_checks (user_id, transaction_type)
  VALUES (p_user_id, p_transaction_type)
  ON CONFLICT (user_id, transaction_type) DO NOTHING;
  
  -- Get current counts
  SELECT 
    COALESCE(vc.hourly_count, 0),
    COALESCE(vc.daily_count, 0)
  INTO v_hourly_count, v_daily_count
  FROM public.velocity_checks vc
  WHERE vc.user_id = p_user_id AND vc.transaction_type = p_transaction_type;
  
  -- Reset hourly if hour has passed
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
  
  -- Reset daily if day has passed
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
  
  -- Check limits
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

-- Record a transaction in velocity tracking
CREATE OR REPLACE FUNCTION public.record_transaction_velocity(
  p_user_id UUID,
  p_transaction_type TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_now TIMESTAMPTZ;
BEGIN
  v_now := NOW();
  
  -- Get or create velocity check record
  INSERT INTO public.velocity_checks (user_id, transaction_type)
  VALUES (p_user_id, p_transaction_type)
  ON CONFLICT (user_id, transaction_type) DO NOTHING;
  
  -- Increment counters
  UPDATE public.velocity_checks
  SET
    hourly_count = hourly_count + 1,
    daily_count = daily_count + 1,
    last_transaction_at = v_now
  WHERE user_id = p_user_id AND transaction_type = p_transaction_type;
END;
$$;

-- Log IP address for transaction
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
  -- Check if IP is unusual (different from last 3 transactions)
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

-- Approve wallet transaction by admin
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
BEGIN
  -- Verify caller is admin
  IF NOT public.is_admin() THEN
    RETURN QUERY SELECT FALSE::BOOLEAN, 'Unauthorized: Admin only'::TEXT;
    RETURN;
  END IF;
  
  v_admin_id := auth.uid();
  
  -- Get transaction details
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
  
  -- Update transaction
  UPDATE public.wallet_transactions
  SET 
    approval_status = 'approved',
    approved_by = v_admin_id,
    approved_at = NOW(),
    approval_reason = p_approval_reason,
    updated_at = NOW()
  WHERE id = p_transaction_id;
  
  -- Log approval in audit trail
  INSERT INTO public.transaction_audit_logs (
    wallet_transaction_id, admin_id, action, reason, ip_address
  ) VALUES (p_transaction_id, v_admin_id, 'approved', p_approval_reason, 
    (SELECT ip_address FROM public.ip_logs WHERE user_id = v_user_id ORDER BY created_at DESC LIMIT 1));
  
  -- Credit deposits only once, when the approval state moves to approved.
  IF v_transaction_type = 'deposit' THEN
    UPDATE public.account_wallets
    SET 
      balance_usd = balance_usd + v_amount_usd,
      total_deposited_usd = total_deposited_usd + v_amount_usd,
      updated_at = NOW()
    WHERE user_id = v_user_id;
  END IF;
  
  RETURN QUERY SELECT TRUE::BOOLEAN, 'Transaction approved successfully'::TEXT;
END;
$$;

-- Reject wallet transaction by admin
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
  -- Verify caller is admin
  IF NOT public.is_admin() THEN
    RETURN QUERY SELECT FALSE::BOOLEAN, 'Unauthorized: Admin only'::TEXT;
    RETURN;
  END IF;
  
  v_admin_id := auth.uid();
  
  -- Update transaction
  UPDATE public.wallet_transactions
  SET 
    approval_status = 'rejected',
    approved_by = v_admin_id,
    approved_at = NOW(),
    rejection_reason = p_rejection_reason,
    updated_at = NOW()
  WHERE id = p_transaction_id;
  
  -- Log rejection in audit trail
  INSERT INTO public.transaction_audit_logs (
    wallet_transaction_id, admin_id, action, reason
  ) VALUES (p_transaction_id, v_admin_id, 'rejected', p_rejection_reason);
  
  RETURN QUERY SELECT TRUE::BOOLEAN, 'Transaction rejected'::TEXT;
END;
$$;

-- Create admin-initiated withdrawal for tester
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
  -- Verify caller is admin
  IF NOT public.is_admin() THEN
    RETURN QUERY SELECT FALSE::BOOLEAN, NULL::UUID, 'Unauthorized: Admin only'::TEXT;
    RETURN;
  END IF;
  
  v_admin_id := auth.uid();
  
  -- Verify tester exists and is actually a tester
  SELECT role INTO v_user_role FROM public.profiles WHERE id = p_tester_id;
  IF v_user_role IS NULL THEN
    RETURN QUERY SELECT FALSE::BOOLEAN, NULL::UUID, 'User not found'::TEXT;
    RETURN;
  END IF;
  
  IF v_user_role != 'tester' THEN
    RETURN QUERY SELECT FALSE::BOOLEAN, NULL::UUID, 'User is not a tester'::TEXT;
    RETURN;
  END IF;
  
  -- Check wallet balance
  SELECT balance_usd INTO v_wallet_balance FROM public.account_wallets WHERE user_id = p_tester_id;
  IF v_wallet_balance IS NULL OR v_wallet_balance < p_amount_usd THEN
    RETURN QUERY SELECT FALSE::BOOLEAN, NULL::UUID, 'Insufficient funds'::TEXT;
    RETURN;
  END IF;
  
  -- Create withdrawal transaction
  INSERT INTO public.wallet_transactions (
    user_id, type, amount_usd, approval_status, initiated_by_admin, approval_reason
  ) VALUES (p_tester_id, 'withdrawal', p_amount_usd, 'approved', TRUE, p_reason)
  RETURNING id INTO v_transaction_id;
  
  -- Log in audit trail
  INSERT INTO public.transaction_audit_logs (
    wallet_transaction_id, admin_id, action, reason
  ) VALUES (v_transaction_id, v_admin_id, 'initiated', p_reason);
  
  -- Deduct from wallet immediately
  UPDATE public.account_wallets
  SET 
    balance_usd = balance_usd - p_amount_usd,
    total_withdrawn_usd = total_withdrawn_usd + p_amount_usd,
    updated_at = NOW()
  WHERE user_id = p_tester_id;
  
  RETURN QUERY SELECT TRUE::BOOLEAN, v_transaction_id, 'Withdrawal initiated successfully'::TEXT;
END;
$$;

-- Auto-update updated_at for wallet tables
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

-- ─── INDEXES ──────────────────────────────────────────────────
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

-- ─── SEED DATA ────────────────────────────────────────────────
-- Insert initial exchange rate (will be overridden when admin is created)
INSERT INTO public.admin_exchange_rates (rate_usd_to_zmw, set_by, effective_at)
SELECT 26.00, id, NOW()
FROM public.profiles
WHERE role = 'admin'
LIMIT 1
ON CONFLICT DO NOTHING;
