import type { APIRoute } from 'astro';
import { createProjectActivity, createProjectShareLink, getProject } from '@/lib/db/repo';
import { sendEmail } from '@/lib/notifications/email';
import { enqueueEmailJob } from '@/lib/notifications/queue';
import { proposalShareTemplate } from '@/lib/notifications/templates';
import { requireProjectEditAccess, requireUserId } from '@/lib/utils/auth';
import { z } from 'zod';

export const POST: APIRoute = async (context) => {
  const userId = requireUserId(context);
  const projectId = context.params.id as string;
  const editGuard = await requireProjectEditAccess(context, userId, projectId);
  if (editGuard) return editGuard;

  const project = await getProject(userId, projectId);
  if (!project) return new Response('Project not found', { status: 404 });

  const form = await context.request.formData();
  const kind = form.get('kind')?.toString() as 'blueprint' | 'estimate';
  const rawEmail = form.get('client_email')?.toString().trim().toLowerCase();
  const clientEmail = rawEmail ? z.string().email().safeParse(rawEmail) : null;
  const expiresAtRaw = form.get('expires_at')?.toString().trim();

  if (kind !== 'blueprint' && kind !== 'estimate') {
    return new Response('Invalid review kind', { status: 400 });
  }

  if (rawEmail && !clientEmail?.success) {
    return new Response('Invalid client email', { status: 400 });
  }

  let expiresAt: string | null = null;
  const now = Date.now();
  const minExpiryMs = 60 * 60 * 1000;
  const maxExpiryMs = 180 * 24 * 60 * 60 * 1000;
  const defaultExpiryMs = 30 * 24 * 60 * 60 * 1000;
  if (expiresAtRaw) {
    const parsed = new Date(expiresAtRaw);
    if (Number.isNaN(parsed.getTime())) {
      return new Response('Invalid expiration date', { status: 400 });
    }
    const delta = parsed.getTime() - now;
    if (delta < minExpiryMs) {
      return new Response('Expiration must be at least 1 hour in the future', { status: 400 });
    }
    if (delta > maxExpiryMs) {
      return new Response('Expiration cannot exceed 180 days', { status: 400 });
    }
    expiresAt = parsed.toISOString();
  } else if (kind === 'estimate') {
    expiresAt = new Date(now + defaultExpiryMs).toISOString();
  }

  const link = await createProjectShareLink({
    projectId,
    createdBy: userId,
    kind,
    expiresAt
  });

  if (clientEmail?.success && kind === 'estimate') {
    const reviewUrl = `${context.url.origin}/review/${link.token}`;
    const template = proposalShareTemplate({ projectName: project.name, reviewUrl });
    const sent = await sendEmail({
      to: clientEmail.data,
      subject: template.subject,
      html: template.html
    });
    await createProjectActivity({
      projectId,
      actor: 'owner',
      actorRef: userId,
      eventKey: sent.sent ? 'proposal_email_sent' : 'proposal_email_not_sent',
      eventJson: { to: clientEmail.data, reason: sent.sent ? null : (sent as any).reason ?? 'unknown' }
    });

    const reason = String((sent as any).reason ?? '');
    const shouldQueue = !sent.sent && (
      reason === 'network_error' ||
      reason === 'missing_resend_env' ||
      reason.startsWith('resend_')
    );
    if (shouldQueue) {
      await enqueueEmailJob({
        projectId,
        toEmail: clientEmail.data,
        subject: template.subject,
        html: template.html,
        metadata: { source: 'share_create', kind: 'estimate' }
      });
      await createProjectActivity({
        projectId,
        actor: 'system',
        eventKey: 'proposal_email_queued',
        eventJson: { to: clientEmail.data }
      });
    }
  }

  await createProjectActivity({
    projectId,
    actor: project.user_id === userId ? 'owner' : 'collaborator',
    actorRef: userId,
    eventKey: 'share_link_created',
    eventJson: { kind, expires_at: expiresAt }
  });

  return context.redirect(`/projects/${projectId}/share`);
};
