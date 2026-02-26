import type { APIRoute } from 'astro';
import { createProjectActivity, createProjectShareLink, getProject } from '@/lib/db/repo';
import { sendEmail } from '@/lib/notifications/email';
import { enqueueEmailJob } from '@/lib/notifications/queue';
import { proposalShareTemplate } from '@/lib/notifications/templates';
import { requireUserId } from '@/lib/utils/auth';

export const POST: APIRoute = async (context) => {
  const userId = requireUserId(context);
  const projectId = context.params.id as string;

  const project = await getProject(userId, projectId);
  if (!project) return new Response('Project not found', { status: 404 });

  const form = await context.request.formData();
  const kind = form.get('kind')?.toString() as 'blueprint' | 'estimate';
  const clientEmail = form.get('client_email')?.toString().trim().toLowerCase();
  const expiresAtRaw = form.get('expires_at')?.toString().trim();

  if (kind !== 'blueprint' && kind !== 'estimate') {
    return new Response('Invalid review kind', { status: 400 });
  }

  let expiresAt: string | null = null;
  if (expiresAtRaw) {
    const parsed = new Date(expiresAtRaw);
    if (Number.isNaN(parsed.getTime())) {
      return new Response('Invalid expiration date', { status: 400 });
    }
    expiresAt = parsed.toISOString();
  }

  const link = await createProjectShareLink({
    projectId,
    createdBy: userId,
    kind,
    expiresAt
  });

  if (clientEmail && kind === 'estimate') {
    const reviewUrl = `${context.url.origin}/review/${link.token}`;
    const template = proposalShareTemplate({ projectName: project.name, reviewUrl });
    const sent = await sendEmail({
      to: clientEmail,
      subject: template.subject,
      html: template.html
    });
    await createProjectActivity({
      projectId,
      actor: 'owner',
      actorRef: userId,
      eventKey: sent.sent ? 'proposal_email_sent' : 'proposal_email_not_sent',
      eventJson: { to: clientEmail, reason: sent.sent ? null : (sent as any).reason ?? 'unknown' }
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
        toEmail: clientEmail,
        subject: template.subject,
        html: template.html,
        metadata: { source: 'share_create', kind: 'estimate' }
      });
      await createProjectActivity({
        projectId,
        actor: 'system',
        eventKey: 'proposal_email_queued',
        eventJson: { to: clientEmail }
      });
    }
  }

  return context.redirect(`/projects/${projectId}/share`);
};
