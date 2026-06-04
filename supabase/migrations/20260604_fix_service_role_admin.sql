-- Fix: Allow service_role callers to pass is_admin() checks
-- The lib/wallet.js uses the service_role client for RPC calls,
-- but the RPC functions check is_admin() which relies on auth.uid().
-- Service role has no auth.uid(), so is_admin() returns false.
-- Fix: trust service_role callers since admin identity is already
-- verified at the API route level before calling these functions.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN SECURITY DEFINER LANGUAGE plpgsql AS $$
BEGIN
  -- Service role is trusted (admin verified at API layer)
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN TRUE;
  END IF;
  
  -- Normal user path: check profiles table
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;
