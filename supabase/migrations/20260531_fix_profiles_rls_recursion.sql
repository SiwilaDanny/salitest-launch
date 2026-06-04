-- Migration: Fix infinite recursion in public.profiles select policy
-- Date: 2026-05-31

-- 1. Helper function to check if current user is an admin without causing infinite recursion in RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN SECURITY DEFINER LANGUAGE plpgsql AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- 2. Drop the recursive RLS policy
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;

-- 3. Recreate the policy utilizing the non-recursive SECURITY DEFINER helper function
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin());
