CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE project_type AS ENUM ('deck','covered_deck');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE project_status AS ENUM ('draft','estimating','sent','won','lost');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE item_unit AS ENUM ('ea','lf','sqft','yd','bag','box');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE estimate_status AS ENUM ('draft','final');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE document_kind AS ENUM ('materials_pdf','internal_estimate_pdf','client_proposal_pdf');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  name text NOT NULL,
  type project_type NOT NULL,
  address text,
  status project_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS design_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version int NOT NULL,
  inputs_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  UNIQUE(project_id, version)
);

CREATE TABLE IF NOT EXISTS takeoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version int NOT NULL,
  assumptions_json jsonb NOT NULL,
  totals_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  UNIQUE(project_id, version)
);

CREATE TABLE IF NOT EXISTS takeoff_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  takeoff_id uuid NOT NULL REFERENCES takeoffs(id) ON DELETE CASCADE,
  category text NOT NULL,
  sku text,
  name text NOT NULL,
  unit item_unit NOT NULL,
  qty numeric NOT NULL,
  waste_factor numeric NOT NULL DEFAULT 0.10,
  unit_cost numeric NOT NULL DEFAULT 0,
  vendor text,
  lead_time_days int NOT NULL DEFAULT 0,
  notes text
);

CREATE TABLE IF NOT EXISTS labor_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  name text NOT NULL,
  rates_json jsonb NOT NULL,
  production_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS labor_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  template_id uuid REFERENCES labor_templates(id) ON DELETE SET NULL,
  labor_json jsonb NOT NULL,
  total_labor_cost numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  takeoff_id uuid NOT NULL REFERENCES takeoffs(id) ON DELETE CASCADE,
  labor_plan_id uuid NOT NULL REFERENCES labor_plans(id) ON DELETE CASCADE,
  overhead_pct numeric NOT NULL,
  profit_pct numeric NOT NULL,
  tax_pct numeric NOT NULL,
  subtotal_materials numeric NOT NULL,
  subtotal_labor numeric NOT NULL,
  overhead_amount numeric NOT NULL,
  profit_amount numeric NOT NULL,
  tax_amount numeric NOT NULL,
  grand_total numeric NOT NULL,
  status estimate_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind document_kind NOT NULL,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_design_inputs_project_id ON design_inputs(project_id);
CREATE INDEX IF NOT EXISTS idx_takeoffs_project_id ON takeoffs(project_id);
CREATE INDEX IF NOT EXISTS idx_takeoff_items_takeoff_id ON takeoff_items(takeoff_id);
CREATE INDEX IF NOT EXISTS idx_labor_templates_user_id ON labor_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_labor_plans_project_id ON labor_plans(project_id);
CREATE INDEX IF NOT EXISTS idx_estimates_project_id ON estimates(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);

CREATE OR REPLACE FUNCTION app_user_id() RETURNS text AS $$
  SELECT current_setting('app.current_user_id', true)::text
$$ LANGUAGE sql STABLE;

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE takeoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE takeoff_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projects_own ON projects;
CREATE POLICY projects_own ON projects USING (user_id = app_user_id()) WITH CHECK (user_id = app_user_id());

DROP POLICY IF EXISTS design_inputs_own ON design_inputs;
CREATE POLICY design_inputs_own ON design_inputs
USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = design_inputs.project_id AND p.user_id = app_user_id()))
WITH CHECK (EXISTS (SELECT 1 FROM projects p WHERE p.id = design_inputs.project_id AND p.user_id = app_user_id()));

DROP POLICY IF EXISTS takeoffs_own ON takeoffs;
CREATE POLICY takeoffs_own ON takeoffs
USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = takeoffs.project_id AND p.user_id = app_user_id()))
WITH CHECK (EXISTS (SELECT 1 FROM projects p WHERE p.id = takeoffs.project_id AND p.user_id = app_user_id()));

DROP POLICY IF EXISTS takeoff_items_own ON takeoff_items;
CREATE POLICY takeoff_items_own ON takeoff_items
USING (EXISTS (
  SELECT 1 FROM takeoffs t JOIN projects p ON p.id = t.project_id
  WHERE t.id = takeoff_items.takeoff_id AND p.user_id = app_user_id()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM takeoffs t JOIN projects p ON p.id = t.project_id
  WHERE t.id = takeoff_items.takeoff_id AND p.user_id = app_user_id()
));

DROP POLICY IF EXISTS labor_templates_own ON labor_templates;
CREATE POLICY labor_templates_own ON labor_templates USING (user_id = app_user_id()) WITH CHECK (user_id = app_user_id());

DROP POLICY IF EXISTS labor_plans_own ON labor_plans;
CREATE POLICY labor_plans_own ON labor_plans
USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = labor_plans.project_id AND p.user_id = app_user_id()))
WITH CHECK (EXISTS (SELECT 1 FROM projects p WHERE p.id = labor_plans.project_id AND p.user_id = app_user_id()));

DROP POLICY IF EXISTS estimates_own ON estimates;
CREATE POLICY estimates_own ON estimates
USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = estimates.project_id AND p.user_id = app_user_id()))
WITH CHECK (EXISTS (SELECT 1 FROM projects p WHERE p.id = estimates.project_id AND p.user_id = app_user_id()));

DROP POLICY IF EXISTS documents_own ON documents;
CREATE POLICY documents_own ON documents
USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = documents.project_id AND p.user_id = app_user_id()))
WITH CHECK (EXISTS (SELECT 1 FROM projects p WHERE p.id = documents.project_id AND p.user_id = app_user_id()));
