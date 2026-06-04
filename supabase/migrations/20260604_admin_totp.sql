-- Add totp_secret column to profiles table for Google Authenticator support
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS totp_secret TEXT;
