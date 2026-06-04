-- ─────────────────────────────────────────────────────────────────
-- Migration: Fix approve_wallet_transaction to handle withdrawals
-- Run this in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────

-- The original approve_wallet_transaction only credited deposits.
-- This update adds withdrawal balance deduction so that when an admin
-- approves a tester withdrawal, the balance is correctly debited.

CREATE OR REPLACE FUNCTION public.approve_wallet_transaction(
  p_transaction_id UUID,
  p_approval_reason TEXT DEFAULT 'Approved by admin'
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_admin_id UUID;
  v_user_id UUID;
  v_transaction_type TEXT;
  v_amount_usd NUMERIC;
  v_current_status TEXT;
  v_wallet_balance NUMERIC;
BEGIN
  -- Check admin role
  IF NOT public.is_admin() THEN
    RETURN QUERY SELECT FALSE::BOOLEAN, 'Unauthorized: Admin only'::TEXT;
    RETURN;
  END IF;

  v_admin_id := auth.uid();

  -- Get transaction details
  SELECT user_id, type, amount_usd, approval_status
  INTO v_user_id, v_transaction_type, v_amount_usd, v_current_status
  FROM public.wallet_transactions
  WHERE id = p_transaction_id;

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE::BOOLEAN, 'Transaction not found'::TEXT;
    RETURN;
  END IF;

  IF v_current_status != 'requested' THEN
    RETURN QUERY SELECT FALSE::BOOLEAN, 'Transaction already processed'::TEXT;
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

  -- Update transaction status
  UPDATE public.wallet_transactions
  SET
    approval_status = 'approved',
    approved_by = v_admin_id,
    approved_at = NOW(),
    status = 'completed',
    approval_reason = p_approval_reason,
    updated_at = NOW()
  WHERE id = p_transaction_id;

  -- Log approval in audit trail
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
