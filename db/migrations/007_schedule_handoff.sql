DO $$ BEGIN
  CREATE TYPE schedule_stage AS ENUM ('backlog', 'ready', 'scheduled', 'in_progress', 'done');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS schedule_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  stage schedule_stage NOT NULL DEFAULT 'backlog',
  preferred_start_date date,
  scheduled_start_date date,
  target_completion_date date,
  estimated_duration_days int,
  assigned_lead text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_handoffs_project_id ON schedule_handoffs(project_id);
