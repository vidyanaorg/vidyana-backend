// ============================================================
// Vidyana — Email Notification Function (Vercel Serverless)
// File location: /api/send-notification.js
// ============================================================
//
// This function runs on the server (not in the browser), so it's
// safe to use your secret Resend API key here.
//
// It is triggered automatically by a Supabase Database Webhook
// (see backend-integration-guide.md, Step 4) whenever a new row
// is inserted into demo_requests, contact_messages,
// internship_applications, or employer_registrations.
//
// SETUP REQUIRED before this works:
// 1. Deploy this file inside an `/api` folder in a Vercel project
// 2. Add environment variable RESEND_API_KEY in Vercel project settings
// 3. Add environment variable NOTIFY_EMAIL (your email address)
// 4. Set up the Supabase webhook pointing to this function's URL
//    (Supabase Dashboard -> Database -> Webhooks)
// ============================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body;

    // Supabase webhooks send: { type: 'INSERT', table: 'table_name', record: {...} }
    const tableName = payload.table;
    const record = payload.record;

    if (!tableName || !record) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    const { subject, htmlBody } = buildEmailContent(tableName, record);

    if (!subject) {
      // Table not relevant to notifications, skip silently
      return res.status(200).json({ skipped: true });
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Vidyana Notifications <notifications@vidyana.org>',
        to: [process.env.NOTIFY_EMAIL],
        subject: subject,
        html: htmlBody,
      }),
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      console.error('Resend error:', errText);
      return res.status(500).json({ error: 'Failed to send email' });
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Notification function error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ------------------------------------------------------------
// Builds the email subject + body depending on which table
// triggered the webhook
// ------------------------------------------------------------
function buildEmailContent(tableName, record) {
  switch (tableName) {

    case 'demo_requests':
      return {
        subject: `🎓 New demo class request — ${record.full_name}`,
        htmlBody: `
          <h2>New Demo Class Request</h2>
          <p><strong>Name:</strong> ${escapeHtml(record.full_name)}</p>
          <p><strong>Phone:</strong> ${escapeHtml(record.phone)}</p>
          <p><strong>Subject/Track:</strong> ${escapeHtml(record.subject)}</p>
          <p><strong>City:</strong> ${escapeHtml(record.city)}</p>
          ${record.message ? `<p><strong>Message:</strong> ${escapeHtml(record.message)}</p>` : ''}
          <p style="color:#888;font-size:13px;">Submitted: ${new Date(record.created_at).toLocaleString('en-IN')}</p>
        `,
      };

    case 'contact_messages':
      return {
        subject: `📩 New contact message — ${record.topic}`,
        htmlBody: `
          <h2>New Contact Form Message</h2>
          <p><strong>Name:</strong> ${escapeHtml(record.full_name)}</p>
          <p><strong>Phone:</strong> ${escapeHtml(record.phone)}</p>
          ${record.email ? `<p><strong>Email:</strong> ${escapeHtml(record.email)}</p>` : ''}
          <p><strong>Topic:</strong> ${escapeHtml(record.topic)}</p>
          <p><strong>Message:</strong> ${escapeHtml(record.message)}</p>
          <p style="color:#888;font-size:13px;">Submitted: ${new Date(record.created_at).toLocaleString('en-IN')}</p>
        `,
      };

    case 'internship_applications':
      return {
        subject: `💼 New internship application — ${record.full_name}`,
        htmlBody: `
          <h2>New Internship Application</h2>
          <p><strong>Name:</strong> ${escapeHtml(record.full_name)}</p>
          <p><strong>Phone:</strong> ${escapeHtml(record.phone)}</p>
          <p><strong>Email:</strong> ${escapeHtml(record.email)}</p>
          <p><strong>College:</strong> ${escapeHtml(record.college)}</p>
          <p><strong>Year of study:</strong> ${escapeHtml(record.year_of_study)}</p>
          ${record.why_fit ? `<p><strong>Why a good fit:</strong> ${escapeHtml(record.why_fit)}</p>` : ''}
          <p style="color:#888;font-size:13px;">Submitted: ${new Date(record.created_at).toLocaleString('en-IN')}</p>
        `,
      };

    case 'employer_registrations':
      return {
        subject: `🏢 New employer registration — ${record.company_name}`,
        htmlBody: `
          <h2>New Employer Registration</h2>
          <p><strong>Company:</strong> ${escapeHtml(record.company_name)}</p>
          <p><strong>Industry:</strong> ${escapeHtml(record.industry)}</p>
          <p><strong>Contact person:</strong> ${escapeHtml(record.contact_name)} (${escapeHtml(record.designation)})</p>
          <p><strong>Work email:</strong> ${escapeHtml(record.work_email)}</p>
          <p><strong>Phone:</strong> ${escapeHtml(record.phone)}</p>
          ${record.website ? `<p><strong>Website:</strong> ${escapeHtml(record.website)}</p>` : ''}
          <p><strong>Hiring for:</strong> ${escapeHtml(record.hiring_for)}</p>
          <p><strong>Company size:</strong> ${escapeHtml(record.company_size)}</p>
          <p style="color:#888;font-size:13px;">Submitted: ${new Date(record.created_at).toLocaleString('en-IN')}</p>
        `,
      };

    default:
      return { subject: null, htmlBody: null };
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
