DO $$ BEGIN
  CREATE TYPE review_kind AS ENUM ('blueprint','estimate');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS project_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by text NOT NULL,
  kind review_kind NOT NULL,
  token text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_share_links_project_id ON project_share_links(project_id);
CREATE INDEX IF NOT EXISTS idx_project_share_links_token ON project_share_links(token);
