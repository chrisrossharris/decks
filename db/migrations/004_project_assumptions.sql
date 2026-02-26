CREATE TABLE IF NOT EXISTS project_assumptions (
  project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  overrides_json jsonb NOT NULL,
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_assumptions_project_id ON project_assumptions(project_id);
