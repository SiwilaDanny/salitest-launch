-- ═══════════════════════════════════════════════════════════
-- SaLiTeSt Launch — Screenshot Metadata Table Addition
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.feedback_screenshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id     UUID REFERENCES public.feedback(id) ON DELETE CASCADE,
  tester_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_url        TEXT NOT NULL,
  file_hash       TEXT NOT NULL,          -- SHA-256 hash of image file
  file_size       INTEGER,
  image_width     INTEGER,
  image_height    INTEGER,
  taken_at        TIMESTAMPTZ,            -- Date/time taken from EXIF
  device_make     TEXT,                   -- e.g. "Apple"
  device_model    TEXT,                   -- e.g. "iPhone 13 Pro"
  software        TEXT,                   -- Software used to save/edit
  meta_json       JSONB DEFAULT '{}',     -- Raw parsed EXIF tags
  is_flagged      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.feedback_screenshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Testers can manage own screenshots"
  ON public.feedback_screenshots FOR ALL
  USING (auth.uid() = tester_id);

CREATE POLICY "Developers can read feedback screenshots for own campaigns"
  ON public.feedback_screenshots FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.feedback f
    JOIN public.campaigns c ON c.id = f.campaign_id
    WHERE f.id = feedback_id AND c.developer_id = auth.uid()
  ));

-- Indices for fast matching
CREATE INDEX IF NOT EXISTS idx_screenshots_hash ON public.feedback_screenshots(file_hash);
CREATE INDEX IF NOT EXISTS idx_screenshots_tester ON public.feedback_screenshots(tester_id);
