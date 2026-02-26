function shell(title: string, body: string) {
  return `
  <div style="font-family:Arial,sans-serif;background:#0f172a;color:#e2e8f0;padding:24px;">
    <div style="max-width:640px;margin:0 auto;background:#111827;border:1px solid #334155;border-radius:10px;padding:20px;">
      <p style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#34d399;margin:0 0 8px 0;">DeckTakeoffPro</p>
      <h1 style="font-size:20px;margin:0 0 12px 0;">${title}</h1>
      ${body}
      <p style="font-size:12px;color:#94a3b8;margin-top:18px;">This message was sent by DeckTakeoffPro.</p>
    </div>
  </div>`;
}

export function proposalShareTemplate(args: {
  projectName: string;
  reviewUrl: string;
}) {
  return {
    subject: `Proposal Ready: ${args.projectName}`,
    html: shell(
      `Proposal for ${args.projectName}`,
      `<p>Your proposal is ready for review.</p>
       <p><a href="${args.reviewUrl}" style="color:#34d399;">Open proposal</a></p>`
    )
  };
}

export function internalDecisionAlertTemplate(args: {
  projectName: string;
  decision: 'approved' | 'changes_requested';
  reviewerName: string;
  message?: string;
}) {
  const decisionLabel = args.decision === 'approved' ? 'Approved' : 'Changes Requested';
  return {
    subject: `Client ${decisionLabel}: ${args.projectName}`,
    html: shell(
      `Client ${decisionLabel}`,
      `<p><strong>Project:</strong> ${args.projectName}</p>
       <p><strong>Reviewer:</strong> ${args.reviewerName}</p>
       <p><strong>Decision:</strong> ${decisionLabel}</p>
       <p><strong>Notes:</strong> ${args.message || '(none)'}</p>`
    )
  };
}
