type EmailInput = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail(input: EmailInput) {
  const apiKey = import.meta.env.RESEND_API_KEY;
  const from = import.meta.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return { sent: false as const, reason: 'missing_resend_env' };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html
      })
    });

    if (!res.ok) {
      const text = await res.text();
      return { sent: false as const, reason: `resend_${res.status}`, detail: text };
    }
    return { sent: true as const };
  } catch (error) {
    return { sent: false as const, reason: 'network_error', detail: String(error) };
  }
}
