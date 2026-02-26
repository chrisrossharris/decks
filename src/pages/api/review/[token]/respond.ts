import type { APIRoute } from 'astro';
import { createProjectActivity, createProposalReviewByToken, resolveShareToken } from '@/lib/db/repo';
import { sendEmail } from '@/lib/notifications/email';
import { enqueueEmailJob } from '@/lib/notifications/queue';
import { internalDecisionAlertTemplate } from '@/lib/notifications/templates';

export const POST: APIRoute = async (context) => {
  const token = context.params.token as string;
  const form = await context.request.formData();

  const reviewerName = form.get('reviewer_name')?.toString().trim() ?? '';
  const reviewerEmail = form.get('reviewer_email')?.toString().trim() ?? '';
  const decision = form.get('decision')?.toString() as 'approved' | 'changes_requested';
  const message = form.get('message')?.toString().trim() ?? '';
  const approvedAmountRaw = form.get('approved_amount')?.toString().trim() ?? '';

  if (!reviewerName) return new Response('Reviewer name required', { status: 400 });
  if (decision !== 'approved' && decision !== 'changes_requested') {
    return new Response('Invalid decision', { status: 400 });
  }

  const approvedAmount = approvedAmountRaw ? Number(approvedAmountRaw) : null;
  if (approvedAmountRaw && Number.isNaN(approvedAmount)) {
    return new Response('Invalid approved amount', { status: 400 });
  }

  const result = await createProposalReviewByToken({
    token,
    reviewerName,
    reviewerEmail: reviewerEmail || null,
    decision,
    message: message || null,
    approvedAmount
  });

  if (!result) {
    return new Response('Review link is invalid or expired', { status: 404 });
  }

  const alertEmail = import.meta.env.INTERNAL_ALERT_EMAIL;
  const share = await resolveShareToken(token);
  if (alertEmail && share) {
    const template = internalDecisionAlertTemplate({
      projectName: share.project_name,
      decision,
      reviewerName,
      message
    });
    const sent = await sendEmail({
      to: alertEmail,
      subject: template.subject,
      html: template.html
    });
    await createProjectActivity({
      projectId: share.project_id,
      actor: 'system',
      eventKey: sent.sent ? 'internal_alert_sent' : 'internal_alert_not_sent',
      eventJson: { to: alertEmail, reason: sent.sent ? null : (sent as any).reason ?? 'unknown' }
    });

    const reason = String((sent as any).reason ?? '');
    const shouldQueue = !sent.sent && (
      reason === 'network_error' ||
      reason === 'missing_resend_env' ||
      reason.startsWith('resend_')
    );
    if (shouldQueue) {
      await enqueueEmailJob({
        projectId: share.project_id,
        toEmail: alertEmail,
        subject: template.subject,
        html: template.html,
        metadata: { source: 'review_response', decision }
      });
      await createProjectActivity({
        projectId: share.project_id,
        actor: 'system',
        eventKey: 'internal_alert_queued',
        eventJson: { to: alertEmail, decision }
      });
    }
  }

  return context.redirect(`/review/${token}?submitted=1`);
};
