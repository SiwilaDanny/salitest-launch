-- Migration: Add Admin RLS policies and automated trust score synchronization trigger
-- Date: 2026-05-31

-- ═══════════════════════════════════════════════════════════
-- 1. ADMIN RLS POLICIES FOR DATA MANAGEMENT
-- ═══════════════════════════════════════════════════════════

-- Profiles: Allow admins to update user profiles (roles, trust score, country, etc.)
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_admin());

-- Feedback Screenshots: Allow admins to select and update screenshots
DROP POLICY IF EXISTS "Admins can read all feedback screenshots" ON public.feedback_screenshots;
CREATE POLICY "Admins can read all feedback screenshots"
  ON public.feedback_screenshots FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update all feedback screenshots" ON public.feedback_screenshots;
CREATE POLICY "Admins can update all feedback screenshots"
  ON public.feedback_screenshots FOR UPDATE
  USING (public.is_admin());

-- Apps: Allow admins to read and update any app
DROP POLICY IF EXISTS "Admins can read all apps" ON public.apps;
CREATE POLICY "Admins can read all apps"
  ON public.apps FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update all apps" ON public.apps;
CREATE POLICY "Admins can update all apps"
  ON public.apps FOR UPDATE
  USING (public.is_admin());

-- Campaigns: Allow admins to read and update campaigns
DROP POLICY IF EXISTS "Admins can read all campaigns" ON public.campaigns;
CREATE POLICY "Admins can read all campaigns"
  ON public.campaigns FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update all campaigns" ON public.campaigns;
CREATE POLICY "Admins can update all campaigns"
  ON public.campaigns FOR UPDATE
  USING (public.is_admin());

-- Enrollments: Allow admins to read and update enrollments
DROP POLICY IF EXISTS "Admins can read all enrollments" ON public.enrollments;
CREATE POLICY "Admins can read all enrollments"
  ON public.enrollments FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update all enrollments" ON public.enrollments;
CREATE POLICY "Admins can update all enrollments"
  ON public.enrollments FOR UPDATE
  USING (public.is_admin());

-- Feedback: Allow admins to read feedback
DROP POLICY IF EXISTS "Admins can read all feedback" ON public.feedback;
CREATE POLICY "Admins can read all feedback"
  ON public.feedback FOR SELECT
  USING (public.is_admin());

-- Transactions: Allow admins to read all transactions
DROP POLICY IF EXISTS "Admins can read all transactions" ON public.transactions;
CREATE POLICY "Admins can read all transactions"
  ON public.transactions FOR SELECT
  USING (public.is_admin());


-- ═══════════════════════════════════════════════════════════
-- 2. AUTOMATIC PROFILE TRUST SCORE recalculation trigger
-- ═══════════════════════════════════════════════════════════

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
