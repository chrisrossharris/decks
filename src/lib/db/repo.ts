import type { DesignInputs, LaborTemplate, TakeoffAssumptionOverrides, TakeoffItem } from '@/lib/types/domain';
import { db } from './client';
import { DEFAULT_LABOR_TEMPLATES } from '@/lib/engines/labor';
import { parseJsonObject } from '@/lib/utils/json';

export async function listProjects(userId: string) {
  return db()`
    SELECT DISTINCT p.*,
      (
        SELECT pr.decision
        FROM proposal_reviews pr
        WHERE pr.project_id = p.id
        ORDER BY pr.created_at DESC
        LIMIT 1
      ) AS latest_client_decision,
      (
        SELECT sh.stage
        FROM schedule_handoffs sh
        WHERE sh.project_id = p.id
        LIMIT 1
      ) AS schedule_stage
    FROM projects p
    LEFT JOIN project_members pm ON pm.project_id = p.id
    WHERE p.user_id = ${userId}
      OR (pm.user_id = ${userId} AND pm.status = 'accepted')
    ORDER BY p.created_at DESC
  `;
}

export async function createProject(userId: string, payload: { name: string; type: 'deck' | 'covered_deck' | 'fence'; address?: string; status: string }) {
  const [row] = await db()`
    INSERT INTO projects (user_id, name, type, address, status)
    VALUES (${userId}, ${payload.name}, ${payload.type}, ${payload.address ?? ''}, ${payload.status})
    RETURNING *
  `;
  return row;
}

export async function getProject(userId: string, projectId: string) {
  const [row] = await db()`
    SELECT DISTINCT p.*
    FROM projects p
    LEFT JOIN project_members pm ON pm.project_id = p.id
    WHERE p.id = ${projectId}
      AND (p.user_id = ${userId} OR (pm.user_id = ${userId} AND pm.status = 'accepted'))
  `;
  return row ?? null;
}

export async function isProjectOwner(userId: string, projectId: string) {
  const [row] = await db()`SELECT id FROM projects WHERE id = ${projectId} AND user_id = ${userId}`;
  return Boolean(row);
}

export async function latestDesignInputs(projectId: string) {
  const [row] = await db()`SELECT * FROM design_inputs WHERE project_id = ${projectId} ORDER BY version DESC LIMIT 1`;
  return row ?? null;
}

export async function getProjectAssumptions(projectId: string): Promise<TakeoffAssumptionOverrides | null> {
  const [row] = await db()`SELECT overrides_json FROM project_assumptions WHERE project_id = ${projectId}`;
  return row?.overrides_json ?? null;
}

export async function upsertProjectAssumptions(projectId: string, userId: string, overrides: TakeoffAssumptionOverrides) {
  const [row] = await db()`
    INSERT INTO project_assumptions (project_id, overrides_json, updated_by, updated_at)
    VALUES (${projectId}, ${JSON.stringify(overrides)}::jsonb, ${userId}, now())
    ON CONFLICT (project_id) DO UPDATE
      SET overrides_json = EXCLUDED.overrides_json,
          updated_by = EXCLUDED.updated_by,
          updated_at = now()
    RETURNING *
  `;
  return row;
}

export async function createDesignInputs(projectId: string, userId: string, inputs: DesignInputs) {
  const [ver] = await db()`SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM design_inputs WHERE project_id = ${projectId}`;
  const [row] = await db()`
    INSERT INTO design_inputs (project_id, version, inputs_json, created_by)
    VALUES (${projectId}, ${ver.next_version}, ${JSON.stringify(inputs)}::jsonb, ${userId})
    RETURNING *
  `;
  return row;
}

export async function createTakeoff(
  projectId: string,
  userId: string,
  generated: { assumptions: unknown; totals: unknown; items: TakeoffItem[] }
) {
  const [ver] = await db()`SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM takeoffs WHERE project_id = ${projectId}`;
  const [takeoff] = await db()`
    INSERT INTO takeoffs (project_id, version, assumptions_json, totals_json, created_by)
    VALUES (${projectId}, ${ver.next_version}, ${JSON.stringify(generated.assumptions)}::jsonb, ${JSON.stringify(generated.totals)}::jsonb, ${userId})
    RETURNING *
  `;

  for (const item of generated.items) {
    await db()`
      INSERT INTO takeoff_items (
        takeoff_id, category, sku, name, unit, qty, waste_factor, unit_cost, vendor, lead_time_days, notes
      ) VALUES (
        ${takeoff.id}, ${item.category}, ${item.sku ?? null}, ${item.name}, ${item.unit}, ${item.qty},
        ${item.waste_factor}, ${item.unit_cost}, ${item.vendor ?? null}, ${item.lead_time_days}, ${item.notes ?? null}
      )
    `;
  }

  return takeoff;
}

export async function latestTakeoff(projectId: string) {
  const [takeoff] = await db()`SELECT * FROM takeoffs WHERE project_id = ${projectId} ORDER BY version DESC LIMIT 1`;
  if (!takeoff) return null;
  const items = await db()`SELECT * FROM takeoff_items WHERE takeoff_id = ${takeoff.id} ORDER BY category, name`;
  return { ...takeoff, items };
}

export async function takeoffHistory(projectId: string) {
  return db()`SELECT id, version, totals_json, created_at FROM takeoffs WHERE project_id = ${projectId} ORDER BY version DESC`;
}

export async function takeoffWithItems(takeoffId: string) {
  const [takeoff] = await db()`SELECT * FROM takeoffs WHERE id = ${takeoffId}`;
  if (!takeoff) return null;
  const items = await db()`SELECT * FROM takeoff_items WHERE takeoff_id = ${takeoff.id} ORDER BY category, name`;
  return { ...takeoff, items };
}

export async function updateTakeoffItem(itemId: string, patch: Partial<TakeoffItem>) {
  const [row] = await db()`
    UPDATE takeoff_items
    SET qty = COALESCE(${patch.qty ?? null}, qty),
        waste_factor = COALESCE(${patch.waste_factor ?? null}, waste_factor),
        unit_cost = COALESCE(${patch.unit_cost ?? null}, unit_cost),
        lead_time_days = COALESCE(${patch.lead_time_days ?? null}, lead_time_days),
        notes = COALESCE(${patch.notes ?? null}, notes),
        vendor = COALESCE(${patch.vendor ?? null}, vendor)
    WHERE id = ${itemId}
    RETURNING *
  `;
  return row;
}

export async function updateTakeoffItemForUser(userId: string, itemId: string, patch: Partial<TakeoffItem>) {
  const [row] = await db()`
    UPDATE takeoff_items ti
    SET qty = COALESCE(${patch.qty ?? null}, ti.qty),
        waste_factor = COALESCE(${patch.waste_factor ?? null}, ti.waste_factor),
        unit_cost = COALESCE(${patch.unit_cost ?? null}, ti.unit_cost),
        lead_time_days = COALESCE(${patch.lead_time_days ?? null}, ti.lead_time_days),
        notes = COALESCE(${patch.notes ?? null}, ti.notes),
        vendor = COALESCE(${patch.vendor ?? null}, ti.vendor)
    FROM takeoffs t
    JOIN projects p ON p.id = t.project_id
    LEFT JOIN project_members pm ON pm.project_id = p.id
    WHERE ti.id = ${itemId}
      AND ti.takeoff_id = t.id
      AND (p.user_id = ${userId} OR (pm.user_id = ${userId} AND pm.status = 'accepted'))
    RETURNING ti.*
  `;
  return row ?? null;
}

export async function listLaborTemplates(userId: string): Promise<LaborTemplate[]> {
  const existing = await db()`SELECT * FROM labor_templates WHERE user_id = ${userId} ORDER BY created_at ASC`;
  if (existing.length > 0) return existing as unknown as LaborTemplate[];

  for (const template of DEFAULT_LABOR_TEMPLATES) {
    await db()`
      INSERT INTO labor_templates (user_id, name, rates_json, production_json)
      VALUES (${userId}, ${template.name}, ${JSON.stringify(template.rates_json)}::jsonb, ${JSON.stringify(template.production_json)}::jsonb)
    `;
  }

  const rows = await db()`SELECT * FROM labor_templates WHERE user_id = ${userId} ORDER BY created_at ASC`;
  return rows as unknown as LaborTemplate[];
}

export async function createOrReplaceLaborPlan(
  projectId: string,
  templateId: string | null,
  laborJson: unknown,
  totalLaborCost: number
) {
  const [existing] = await db()`SELECT * FROM labor_plans WHERE project_id = ${projectId} ORDER BY created_at DESC LIMIT 1`;
  if (existing) {
    const [row] = await db()`
      UPDATE labor_plans
      SET template_id = ${templateId}, labor_json = ${JSON.stringify(laborJson)}::jsonb,
          total_labor_cost = ${totalLaborCost}, updated_at = now()
      WHERE id = ${existing.id}
      RETURNING *
    `;
    return row;
  }

  const [created] = await db()`
    INSERT INTO labor_plans (project_id, template_id, labor_json, total_labor_cost)
    VALUES (${projectId}, ${templateId}, ${JSON.stringify(laborJson)}::jsonb, ${totalLaborCost})
    RETURNING *
  `;
  return created;
}

export async function latestLaborPlan(projectId: string) {
  const [row] = await db()`SELECT * FROM labor_plans WHERE project_id = ${projectId} ORDER BY updated_at DESC LIMIT 1`;
  return row ?? null;
}

export async function upsertEstimate(
  projectId: string,
  takeoffId: string,
  laborPlanId: string,
  payload: {
    overhead_pct: number;
    profit_pct: number;
    tax_pct: number;
    subtotal_materials: number;
    subtotal_labor: number;
    overhead_amount: number;
    profit_amount: number;
    tax_amount: number;
    grand_total: number;
  }
) {
  const [existing] = await db()`SELECT * FROM estimates WHERE project_id = ${projectId} ORDER BY updated_at DESC LIMIT 1`;
  if (existing) {
    const [row] = await db()`
      UPDATE estimates
      SET takeoff_id = ${takeoffId}, labor_plan_id = ${laborPlanId},
          overhead_pct = ${payload.overhead_pct}, profit_pct = ${payload.profit_pct}, tax_pct = ${payload.tax_pct},
          subtotal_materials = ${payload.subtotal_materials}, subtotal_labor = ${payload.subtotal_labor},
          overhead_amount = ${payload.overhead_amount}, profit_amount = ${payload.profit_amount}, tax_amount = ${payload.tax_amount},
          grand_total = ${payload.grand_total}, updated_at = now()
      WHERE id = ${existing.id}
      RETURNING *
    `;
    return row;
  }

  const [row] = await db()`
    INSERT INTO estimates (
      project_id, takeoff_id, labor_plan_id, overhead_pct, profit_pct, tax_pct,
      subtotal_materials, subtotal_labor, overhead_amount, profit_amount, tax_amount, grand_total, status
    ) VALUES (
      ${projectId}, ${takeoffId}, ${laborPlanId}, ${payload.overhead_pct}, ${payload.profit_pct}, ${payload.tax_pct},
      ${payload.subtotal_materials}, ${payload.subtotal_labor}, ${payload.overhead_amount}, ${payload.profit_amount},
      ${payload.tax_amount}, ${payload.grand_total}, 'draft'
    ) RETURNING *
  `;
  return row;
}

export async function latestEstimate(projectId: string) {
  const [row] = await db()`SELECT * FROM estimates WHERE project_id = ${projectId} ORDER BY updated_at DESC LIMIT 1`;
  return row ?? null;
}

export async function createDocument(projectId: string, kind: string, storagePath: string) {
  const [row] = await db()`
    INSERT INTO documents (project_id, kind, storage_path)
    VALUES (${projectId}, ${kind}, ${storagePath})
    RETURNING *
  `;
  return row;
}

export async function listProjectDocuments(projectId: string) {
  return db()`
    SELECT id, kind, storage_path, created_at
    FROM documents
    WHERE project_id = ${projectId}
    ORDER BY created_at DESC
  `;
}

export async function getProjectDocument(projectId: string, documentId: string) {
  const [row] = await db()`
    SELECT *
    FROM documents
    WHERE id = ${documentId} AND project_id = ${projectId}
    LIMIT 1
  `;
  return row ?? null;
}

export async function listProjectCollaborators(projectId: string) {
  const owner = await db()`
    SELECT p.user_id, 'owner'::text AS role, 'accepted'::text AS status, p.created_at
    FROM projects p
    WHERE p.id = ${projectId}
  `;
  const members = await db()`
    SELECT pm.user_id, pm.role, pm.status, pm.created_at
    FROM project_members pm
    WHERE pm.project_id = ${projectId}
    ORDER BY pm.created_at ASC
  `;
  return [...owner, ...members];
}

export async function listProjectInvites(projectId: string) {
  return db()`
    SELECT id, invited_email, role, status, invite_code, created_at, accepted_at
    FROM project_invites
    WHERE project_id = ${projectId}
    ORDER BY created_at DESC
  `;
}

export async function createProjectInvite(args: {
  projectId: string;
  invitedBy: string;
  invitedEmail: string;
  role?: string;
}) {
  const [row] = await db()`
    INSERT INTO project_invites (project_id, invited_by, invited_email, role, status)
    VALUES (${args.projectId}, ${args.invitedBy}, lower(${args.invitedEmail}), ${args.role ?? 'partner'}, 'pending')
    ON CONFLICT (project_id, invited_email) DO UPDATE
      SET role = EXCLUDED.role, invited_by = EXCLUDED.invited_by, status = 'pending', accepted_at = null
    RETURNING *
  `;
  return row;
}

export async function acceptProjectInvite(args: { inviteCode: string; userId: string; userEmail?: string | null }) {
  const [invite] = await db()`
    SELECT * FROM project_invites
    WHERE invite_code = ${args.inviteCode}
      AND status = 'pending'
      AND (${args.userEmail ?? null}::text IS NULL OR invited_email = lower(${args.userEmail ?? ''}))
    LIMIT 1
  `;
  if (!invite) return null;

  await db()`
    INSERT INTO project_members (project_id, user_id, role, status, invited_by)
    VALUES (${invite.project_id}, ${args.userId}, ${invite.role}, 'accepted', ${invite.invited_by})
    ON CONFLICT (project_id, user_id) DO UPDATE
      SET role = EXCLUDED.role, status = 'accepted'
  `;

  const [updated] = await db()`
    UPDATE project_invites
    SET status = 'accepted', accepted_at = now(), accepted_by = ${args.userId}
    WHERE id = ${invite.id}
    RETURNING *
  `;
  return updated;
}

export async function createProjectImage(args: {
  projectId: string;
  uploadedBy: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  caption?: string | null;
}) {
  const [row] = await db()`
    INSERT INTO project_images (project_id, uploaded_by, storage_path, file_name, mime_type, size_bytes, caption)
    VALUES (
      ${args.projectId}, ${args.uploadedBy}, ${args.storagePath}, ${args.fileName},
      ${args.mimeType}, ${args.sizeBytes}, ${args.caption ?? null}
    )
    RETURNING *
  `;
  return row;
}

export async function listProjectImages(projectId: string) {
  return db()`
    SELECT id, file_name, mime_type, size_bytes, caption, created_at
    FROM project_images
    WHERE project_id = ${projectId}
    ORDER BY created_at DESC
  `;
}

export async function getProjectImage(projectId: string, imageId: string) {
  const [row] = await db()`
    SELECT *
    FROM project_images
    WHERE id = ${imageId} AND project_id = ${projectId}
    LIMIT 1
  `;
  return row ?? null;
}

export async function createProjectShareLink(args: {
  projectId: string;
  createdBy: string;
  kind: 'blueprint' | 'estimate';
  expiresAt?: string | null;
}) {
  const [row] = await db()`
    INSERT INTO project_share_links (project_id, created_by, kind, expires_at, is_active)
    VALUES (${args.projectId}, ${args.createdBy}, ${args.kind}, ${args.expiresAt ?? null}, true)
    RETURNING *
  `;

  if (args.kind === 'estimate') {
    await db()`
      UPDATE projects
      SET status = 'sent', updated_at = now()
      WHERE id = ${args.projectId}
    `;
    await createProjectActivity({
      projectId: args.projectId,
      actor: 'owner',
      actorRef: args.createdBy,
      eventKey: 'estimate_shared',
      eventJson: { share_link_id: row.id, kind: 'estimate', expires_at: args.expiresAt ?? null }
    });
  }

  return row;
}

export async function listProjectShareLinks(projectId: string) {
  return db()`
    SELECT id, kind, token, is_active, expires_at, created_at
    FROM project_share_links
    WHERE project_id = ${projectId}
    ORDER BY created_at DESC
  `;
}

export async function deactivateProjectShareLink(projectId: string, linkId: string) {
  const [row] = await db()`
    UPDATE project_share_links
    SET is_active = false
    WHERE id = ${linkId} AND project_id = ${projectId}
    RETURNING *
  `;
  return row ?? null;
}

export async function resolveShareToken(token: string) {
  const [row] = await db()`
    SELECT sl.*, p.name AS project_name, p.address, p.type
    FROM project_share_links sl
    JOIN projects p ON p.id = sl.project_id
    WHERE sl.token = ${token}
      AND sl.is_active = true
      AND (sl.expires_at IS NULL OR sl.expires_at > now())
    LIMIT 1
  `;
  return row ?? null;
}

export async function recordShareViewByToken(token: string) {
  const [share] = await db()`
    SELECT id, project_id, kind
    FROM project_share_links
    WHERE token = ${token}
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
    LIMIT 1
  `;
  if (!share || share.kind !== 'estimate') return null;

  const [existing] = await db()`
    SELECT id
    FROM project_activity
    WHERE project_id = ${share.project_id}
      AND event_key = 'proposal_viewed'
      AND event_json->>'share_link_id' = ${share.id}
      AND created_at > now() - interval '6 hours'
    LIMIT 1
  `;
  if (existing) return share;

  await createProjectActivity({
    projectId: share.project_id,
    actor: 'client',
    eventKey: 'proposal_viewed',
    eventJson: { share_link_id: share.id }
  });
  return share;
}

export async function createProjectActivity(args: {
  projectId: string;
  actor: 'owner' | 'collaborator' | 'client' | 'system';
  actorRef?: string | null;
  eventKey: string;
  eventJson?: Record<string, unknown>;
}) {
  const [row] = await db()`
    INSERT INTO project_activity (project_id, actor, actor_ref, event_key, event_json)
    VALUES (${args.projectId}, ${args.actor}, ${args.actorRef ?? null}, ${args.eventKey}, ${JSON.stringify(args.eventJson ?? {})}::jsonb)
    RETURNING *
  `;
  return row;
}

export async function listProjectActivity(projectId: string) {
  return db()`
    SELECT id, actor, actor_ref, event_key, event_json, created_at
    FROM project_activity
    WHERE project_id = ${projectId}
    ORDER BY created_at DESC
    LIMIT 100
  `;
}

export async function createProposalReviewByToken(args: {
  token: string;
  reviewerName: string;
  reviewerEmail?: string | null;
  decision: 'approved' | 'changes_requested';
  message?: string | null;
  approvedAmount?: number | null;
}) {
  const [share] = await db()`
    SELECT * FROM project_share_links
    WHERE token = ${args.token}
      AND is_active = true
      AND kind = 'estimate'
      AND (expires_at IS NULL OR expires_at > now())
    LIMIT 1
  `;
  if (!share) return null;

  const [row] = await db()`
    INSERT INTO proposal_reviews (
      project_id, share_link_id, reviewer_name, reviewer_email, decision, message, approved_amount
    ) VALUES (
      ${share.project_id}, ${share.id}, ${args.reviewerName}, ${args.reviewerEmail ?? null},
      ${args.decision}, ${args.message ?? null}, ${args.approvedAmount ?? null}
    )
    RETURNING *
  `;

  await db()`
    UPDATE projects
    SET status = ${args.decision === 'approved' ? 'won' : 'estimating'}, updated_at = now()
    WHERE id = ${share.project_id}
  `;

  if (args.decision === 'approved') {
    const [labor] = await db()`
      SELECT total_labor_cost, labor_json
      FROM labor_plans
      WHERE project_id = ${share.project_id}
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    const laborJson = parseJsonObject((labor as any)?.labor_json, { total_hours: 0 });
    const totalHours = Number((laborJson as any).total_hours ?? 0);
    const estimatedDurationDays = Math.max(1, Math.ceil(totalHours / 8));
    await upsertScheduleHandoff({
      projectId: share.project_id,
      stage: 'ready',
      estimatedDurationDays
    });
    await createProjectActivity({
      projectId: share.project_id,
      actor: 'system',
      eventKey: 'schedule_handoff_auto_created',
      eventJson: { stage: 'ready', estimated_duration_days: estimatedDurationDays }
    });
  }

  await createProjectActivity({
    projectId: share.project_id,
    actor: 'client',
    actorRef: args.reviewerEmail ?? args.reviewerName,
    eventKey: args.decision === 'approved' ? 'proposal_approved' : 'proposal_changes_requested',
    eventJson: {
      share_link_id: share.id,
      message: args.message ?? null,
      approved_amount: args.approvedAmount ?? null
    }
  });

  return row;
}

export async function listProposalReviews(projectId: string) {
  return db()`
    SELECT id, reviewer_name, reviewer_email, decision, message, approved_amount, created_at
    FROM proposal_reviews
    WHERE project_id = ${projectId}
    ORDER BY created_at DESC
  `;
}

export async function getScheduleHandoff(projectId: string) {
  const [row] = await db()`
    SELECT *
    FROM schedule_handoffs
    WHERE project_id = ${projectId}
    LIMIT 1
  `;
  return row ?? null;
}

export async function upsertScheduleHandoff(args: {
  projectId: string;
  stage: 'backlog' | 'ready' | 'scheduled' | 'in_progress' | 'done';
  preferredStartDate?: string | null;
  scheduledStartDate?: string | null;
  targetCompletionDate?: string | null;
  estimatedDurationDays?: number | null;
  assignedLead?: string | null;
  notes?: string | null;
}) {
  const [row] = await db()`
    INSERT INTO schedule_handoffs (
      project_id, stage, preferred_start_date, scheduled_start_date, target_completion_date,
      estimated_duration_days, assigned_lead, notes, updated_at
    ) VALUES (
      ${args.projectId}, ${args.stage}, ${args.preferredStartDate ?? null}, ${args.scheduledStartDate ?? null},
      ${args.targetCompletionDate ?? null}, ${args.estimatedDurationDays ?? null}, ${args.assignedLead ?? null},
      ${args.notes ?? null}, now()
    )
    ON CONFLICT (project_id) DO UPDATE
      SET stage = EXCLUDED.stage,
          preferred_start_date = EXCLUDED.preferred_start_date,
          scheduled_start_date = EXCLUDED.scheduled_start_date,
          target_completion_date = EXCLUDED.target_completion_date,
          estimated_duration_days = EXCLUDED.estimated_duration_days,
          assigned_lead = EXCLUDED.assigned_lead,
          notes = EXCLUDED.notes,
          updated_at = now()
    RETURNING *
  `;
  return row;
}

export async function listNotificationJobsForUser(userId: string, limit = 20) {
  return db()`
    SELECT DISTINCT nj.id, nj.project_id, nj.to_email, nj.subject, nj.status, nj.attempt_count, nj.next_attempt_at, nj.last_error, nj.created_at, nj.updated_at
    FROM notification_jobs nj
    LEFT JOIN projects p ON p.id = nj.project_id
    LEFT JOIN project_members pm ON pm.project_id = p.id
    WHERE nj.project_id IS NULL
      OR p.user_id = ${userId}
      OR (pm.user_id = ${userId} AND pm.status = 'accepted')
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
}
