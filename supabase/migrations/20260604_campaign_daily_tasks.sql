-- Migration: Add campaign daily tasks and tester task completion tracking
-- Date: 2026-06-04

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Developer-authored tasks that guide testers through each campaign day.
CREATE TABLE IF NOT EXISTS public.campaign_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  day_number      INTEGER NOT NULL CHECK (day_number >= 1),
  title           TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
  description     TEXT,
  is_optional     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, day_number, title)
);

ALTER TABLE public.campaign_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Developers manage tasks for own campaigns" ON public.campaign_tasks;
CREATE POLICY "Developers manage tasks for own campaigns"
  ON public.campaign_tasks FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_id AND c.developer_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_id AND c.developer_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Testers read tasks for assigned campaigns" ON public.campaign_tasks;
CREATE POLICY "Testers read tasks for assigned campaigns"
  ON public.campaign_tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_id AND c.status IN ('recruiting','in_progress','verification','completed')
    )
    OR EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.campaign_id = campaign_tasks.campaign_id
        AND e.tester_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins manage all campaign tasks" ON public.campaign_tasks;
CREATE POLICY "Admins manage all campaign tasks"
  ON public.campaign_tasks FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Per-tester completion records for daily tasks.
CREATE TABLE IF NOT EXISTS public.campaign_task_completions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_task_id UUID NOT NULL REFERENCES public.campaign_tasks(id) ON DELETE CASCADE,
  enrollment_id   UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  tester_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'submitted'
                    CHECK (status IN ('submitted','approved','rejected')),
  notes           TEXT,
  proof_url       TEXT,
  reviewed_by     UUID REFERENCES public.profiles(id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_task_id, enrollment_id)
);

ALTER TABLE public.campaign_task_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Testers manage own task completions" ON public.campaign_task_completions;
CREATE POLICY "Testers manage own task completions"
  ON public.campaign_task_completions FOR ALL
  USING (
    auth.uid() = tester_id
    AND EXISTS (
      SELECT 1
      FROM public.enrollments e
      JOIN public.campaign_tasks ct ON ct.campaign_id = e.campaign_id
      WHERE e.id = campaign_task_completions.enrollment_id
        AND e.tester_id = auth.uid()
        AND ct.id = campaign_task_completions.campaign_task_id
    )
  )
  WITH CHECK (
    auth.uid() = tester_id
    AND EXISTS (
      SELECT 1
      FROM public.enrollments e
      JOIN public.campaign_tasks ct ON ct.campaign_id = e.campaign_id
      WHERE e.id = campaign_task_completions.enrollment_id
        AND e.tester_id = auth.uid()
        AND ct.id = campaign_task_completions.campaign_task_id
    )
  );

DROP POLICY IF EXISTS "Developers read completions for own campaigns" ON public.campaign_task_completions;
CREATE POLICY "Developers read completions for own campaigns"
  ON public.campaign_task_completions FOR SELECT
  USING (EXISTS (
    SELECT 1
    FROM public.campaign_tasks ct
    JOIN public.campaigns c ON c.id = ct.campaign_id
    WHERE ct.id = campaign_task_completions.campaign_task_id
      AND c.developer_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Developers review completions for own campaigns" ON public.campaign_task_completions;
CREATE POLICY "Developers review completions for own campaigns"
  ON public.campaign_task_completions FOR UPDATE
  USING (EXISTS (
    SELECT 1
    FROM public.campaign_tasks ct
    JOIN public.campaigns c ON c.id = ct.campaign_id
    WHERE ct.id = campaign_task_completions.campaign_task_id
      AND c.developer_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.campaign_tasks ct
    JOIN public.campaigns c ON c.id = ct.campaign_id
    WHERE ct.id = campaign_task_completions.campaign_task_id
      AND c.developer_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Admins manage all task completions" ON public.campaign_task_completions;
CREATE POLICY "Admins manage all task completions"
  ON public.campaign_task_completions FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS campaign_tasks_updated ON public.campaign_tasks;
CREATE TRIGGER campaign_tasks_updated
  BEFORE UPDATE ON public.campaign_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS campaign_task_completions_updated ON public.campaign_task_completions;
CREATE TRIGGER campaign_task_completions_updated
  BEFORE UPDATE ON public.campaign_task_completions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_campaign_tasks_campaign_day
  ON public.campaign_tasks(campaign_id, day_number);

CREATE INDEX IF NOT EXISTS idx_task_completions_task
  ON public.campaign_task_completions(campaign_task_id);

CREATE INDEX IF NOT EXISTS idx_task_completions_enrollment
  ON public.campaign_task_completions(enrollment_id);

CREATE INDEX IF NOT EXISTS idx_task_completions_tester
  ON public.campaign_task_completions(tester_id);
