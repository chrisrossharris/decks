ALTER TABLE proposal_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_handoffs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS proposal_reviews_own_select ON proposal_reviews;
CREATE POLICY proposal_reviews_own_select ON proposal_reviews
FOR SELECT
USING (EXISTS (
  SELECT 1
  FROM projects p
  LEFT JOIN project_members pm ON pm.project_id = p.id
  WHERE p.id = proposal_reviews.project_id
    AND (p.user_id = app_user_id() OR (pm.user_id = app_user_id() AND pm.status = 'accepted'))
));

DROP POLICY IF EXISTS proposal_reviews_token_insert ON proposal_reviews;
CREATE POLICY proposal_reviews_token_insert ON proposal_reviews
FOR INSERT
WITH CHECK (
  share_link_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM project_share_links sl
    WHERE sl.id = proposal_reviews.share_link_id
      AND sl.project_id = proposal_reviews.project_id
      AND sl.kind = 'estimate'
      AND sl.is_active = true
      AND (sl.expires_at IS NULL OR sl.expires_at > now())
  )
);

DROP POLICY IF EXISTS project_activity_own_select ON project_activity;
CREATE POLICY project_activity_own_select ON project_activity
FOR SELECT
USING (EXISTS (
  SELECT 1
  FROM projects p
  LEFT JOIN project_members pm ON pm.project_id = p.id
  WHERE p.id = project_activity.project_id
    AND (p.user_id = app_user_id() OR (pm.user_id = app_user_id() AND pm.status = 'accepted'))
));

DROP POLICY IF EXISTS project_activity_own_insert ON project_activity;
CREATE POLICY project_activity_own_insert ON project_activity
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1
  FROM projects p
  LEFT JOIN project_members pm ON pm.project_id = p.id
  WHERE p.id = project_activity.project_id
    AND (p.user_id = app_user_id() OR (pm.user_id = app_user_id() AND pm.status = 'accepted'))
));

DROP POLICY IF EXISTS schedule_handoffs_own_select ON schedule_handoffs;
CREATE POLICY schedule_handoffs_own_select ON schedule_handoffs
FOR SELECT
USING (EXISTS (
  SELECT 1
  FROM projects p
  LEFT JOIN project_members pm ON pm.project_id = p.id
  WHERE p.id = schedule_handoffs.project_id
    AND (p.user_id = app_user_id() OR (pm.user_id = app_user_id() AND pm.status = 'accepted'))
));

DROP POLICY IF EXISTS schedule_handoffs_own_modify ON schedule_handoffs;
CREATE POLICY schedule_handoffs_own_modify ON schedule_handoffs
FOR ALL
USING (EXISTS (
  SELECT 1
  FROM projects p
  LEFT JOIN project_members pm ON pm.project_id = p.id
  WHERE p.id = schedule_handoffs.project_id
    AND (p.user_id = app_user_id() OR (pm.user_id = app_user_id() AND pm.status = 'accepted'))
))
WITH CHECK (EXISTS (
  SELECT 1
  FROM projects p
  LEFT JOIN project_members pm ON pm.project_id = p.id
  WHERE p.id = schedule_handoffs.project_id
    AND (p.user_id = app_user_id() OR (pm.user_id = app_user_id() AND pm.status = 'accepted'))
));
