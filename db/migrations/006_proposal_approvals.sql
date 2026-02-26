DO $$ BEGIN
  CREATE TYPE proposal_decision AS ENUM ('approved', 'changes_requested');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE activity_actor AS ENUM ('owner', 'collaborator', 'client', 'system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS proposal_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  share_link_id uuid REFERENCES project_share_links(id) ON DELETE SET NULL,
  reviewer_name text NOT NULL,
  reviewer_email text,
  decision proposal_decision NOT NULL,
  message text,
  approved_amount numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  actor activity_actor NOT NULL,
  actor_ref text,
  event_key text NOT NULL,
  event_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposal_reviews_project_id ON proposal_reviews(project_id);
CREATE INDEX IF NOT EXISTS idx_project_activity_project_id ON project_activity(project_id);
