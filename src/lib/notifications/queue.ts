import { db } from '@/lib/db/client';
import { sendEmail } from './email';

export async function enqueueEmailJob(args: {
  projectId?: string | null;
  toEmail: string;
  subject: string;
  html: string;
  metadata?: Record<string, unknown>;
}) {
  const [row] = await db()`
    INSERT INTO notification_jobs (project_id, kind, to_email, subject, html, status, metadata_json)
    VALUES (${args.projectId ?? null}, 'email', ${args.toEmail}, ${args.subject}, ${args.html}, 'pending', ${JSON.stringify(args.metadata ?? {})}::jsonb)
    RETURNING id
  `;
  return row?.id as string;
}

function nextAttemptTimestamp(attemptCount: number) {
  const minutes = Math.min(60, 5 * 2 ** Math.max(0, attemptCount - 1));
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export async function processNotificationQueue(limit = 20) {
  const jobs = await db()`
    SELECT *
    FROM notification_jobs
    WHERE status = 'pending'
      AND next_attempt_at <= now()
    ORDER BY created_at ASC
    LIMIT ${limit}
  `;

  let sent = 0;
  let retried = 0;
  let failed = 0;

  for (const job of jobs as any[]) {
    const attemptCount = Number(job.attempt_count ?? 0) + 1;
    const result = await sendEmail({
      to: job.to_email,
      subject: job.subject,
      html: job.html
    });

    if (result.sent) {
      sent += 1;
      await db()`
        UPDATE notification_jobs
        SET status = 'sent', attempt_count = ${attemptCount}, updated_at = now(), last_error = null
        WHERE id = ${job.id}
      `;
      continue;
    }

    const retryable = String(result.reason).startsWith('resend_') || result.reason === 'network_error';
    if (retryable && attemptCount < 6) {
      retried += 1;
      await db()`
        UPDATE notification_jobs
        SET status = 'pending',
            attempt_count = ${attemptCount},
            next_attempt_at = ${nextAttemptTimestamp(attemptCount)}::timestamptz,
            last_error = ${String(result.reason)},
            updated_at = now()
        WHERE id = ${job.id}
      `;
    } else {
      failed += 1;
      await db()`
        UPDATE notification_jobs
        SET status = 'failed',
            attempt_count = ${attemptCount},
            last_error = ${String(result.reason)},
            updated_at = now()
        WHERE id = ${job.id}
      `;
    }
  }

  return { processed: jobs.length, sent, retried, failed };
}
