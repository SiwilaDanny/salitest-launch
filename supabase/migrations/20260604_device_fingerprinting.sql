-- ─────────────────────────────────────────────────────────────────
-- Migration: Support shared device fingerprinting & composite key
-- Run this in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────

-- Find any existing unique constraint on device_fingerprint and drop it
DO $$
DECLARE
    const_name TEXT;
BEGIN
    SELECT conname INTO const_name
    FROM pg_constraint
    WHERE conrelid = 'public.tester_devices'::regclass
      AND contype = 'u'
      AND conkey = (
          SELECT array_agg(attnum)
          FROM pg_attribute
          WHERE attrelid = 'public.tester_devices'::regclass
            AND attname = 'device_fingerprint'
      );
    
    IF const_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.tester_devices DROP CONSTRAINT ' || quote_ident(const_name);
    END IF;
END $$;

-- Drop any simple unique index if it exists
DROP INDEX IF EXISTS idx_devices_fingerprint;

-- Add a new composite unique constraint on (tester_id, device_fingerprint)
ALTER TABLE public.tester_devices 
  ADD CONSTRAINT tester_devices_tester_id_device_fingerprint_key 
  UNIQUE (tester_id, device_fingerprint);

-- Recreate index on fingerprint for efficient lookups across all users
CREATE INDEX IF NOT EXISTS idx_devices_fingerprint ON public.tester_devices(device_fingerprint);
