const SITE_NAME = 'Auto Advant';

function base(previewText: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${SITE_NAME}</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #18181b; }
    .container { max-width: 600px; margin: 32px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
    .header { background: #18181b; color: #fff; padding: 28px 32px; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
    .header p { margin: 4px 0 0; font-size: 13px; color: #a1a1aa; }
    .body { padding: 28px 32px; }
    .body h2 { margin: 0 0 16px; font-size: 18px; }
    .body p { margin: 0 0 12px; line-height: 1.6; color: #3f3f46; }
    .details { background: #f4f4f5; border-radius: 6px; padding: 16px 20px; margin: 16px 0; }
    .details .row { display: flex; justify-content: space-between; gap: 24px; padding: 8px 0; border-bottom: 1px solid #e4e4e7; font-size: 13px; }
    .details .row:last-child { border-bottom: none; }
    .details .row .label { color: #71717a; white-space: nowrap; }
    .cta { display: inline-block; background: #18181b; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 600; margin: 16px 0; }
    .footer { padding: 20px 32px; font-size: 12px; color: #a1a1aa; border-top: 1px solid #f4f4f5; }
    .preview { display: none; font-size: 1px; color: transparent; }
  </style>
</head>
<body>
  <span class="preview">${previewText}</span>
  <div class="container">
    <div class="header">
      <h1>🚗 ${SITE_NAME}</h1>
    </div>
    ${bodyContent}
    <div class="footer">
      <p>© ${new Date().getFullYear()} ${SITE_NAME}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

function detailRow(label: string, value: string | undefined | null): string {
  if (!value) return '';
  const displayLabel = label.endsWith(':') ? label : `${label}:`;
  return `<div class="details row"><span class="label">${displayLabel}</span><span>${value}</span></div>`;
}

// ── Templates ────────────────────────────────────────────────────────────────

export function testDriveCompletedTemplate(data: Record<string, unknown>) {
  const { customerName, vehicleName, locationName, scheduledDate, salesPersonName, durationMinutes } = data as Record<string, string | number | undefined>;
  return {
    subject: `Your test drive is complete — thank you, ${customerName || 'there'}!`,
    html: base(
      `Your test drive of ${vehicleName || 'a vehicle'} is complete — thank you!`,
      `<div class="body">
        <h2>Test Drive Completed! 🎉</h2>
        <p>Hi ${customerName || 'there'},</p>
        <p>We hope you enjoyed your test drive${vehicleName ? ` of the <strong>${vehicleName}</strong>` : ''}! Your feedback means a lot to us.</p>
        <div class="details">
          ${detailRow('Vehicle', vehicleName as string)}
          ${detailRow('Location', locationName as string)}
          ${detailRow('Date', scheduledDate as string)}
          ${detailRow('Assisted by', salesPersonName as string)}
          ${detailRow('Duration', durationMinutes ? `${durationMinutes} minutes` : undefined)}
        </div>
        <p>Interested in the next step? Our team is ready to help with pricing, financing, or scheduling another test drive.</p>
      </div>`,
    ),
    text: `Hi ${customerName || 'there'}, your test drive${vehicleName ? ` of ${vehicleName}` : ''} is complete. Thank you for visiting us!`,
  };
}

export function testDriveRescheduledTemplate(data: Record<string, unknown>) {
  const { customerName, vehicleName, locationName, newDate, newTime } = data as Record<string, string | undefined>;
  return {
    subject: `Test drive rescheduled — ${newDate || 'new date confirmed'}`,
    html: base(
      `Your test drive has been rescheduled`,
      `<div class="body">
        <h2>Test Drive Rescheduled</h2>
        <p>Hi ${customerName || 'there'},</p>
        <p>Your test drive has been rescheduled. Here are your updated details:</p>
        <div class="details">
          ${detailRow('Vehicle', vehicleName)}
          ${detailRow('Location', locationName)}
          ${detailRow('New Date', newDate)}
          ${detailRow('New Time', newTime)}
        </div>
        <p>If you have questions or need to make further changes, please contact us.</p>
      </div>`,
    ),
    text: `Hi ${customerName || 'there'}, your test drive has been rescheduled to ${newDate} at ${newTime}.`,
  };
}

export function testDriveCancelledTemplate(data: Record<string, unknown>) {
  const { customerName, vehicleName, reason } = data as Record<string, string | undefined>;
  return {
    subject: `Test drive cancellation confirmed`,
    html: base(
      'Your test drive has been cancelled',
      `<div class="body">
        <h2>Test Drive Cancelled</h2>
        <p>Hi ${customerName || 'there'},</p>
        <p>Your test drive${vehicleName ? ` of the <strong>${vehicleName}</strong>` : ''} has been cancelled.</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
        <p>We hope to see you again soon. Feel free to book another test drive at your convenience.</p>
      </div>`,
    ),
    text: `Hi ${customerName || 'there'}, your test drive${vehicleName ? ` of ${vehicleName}` : ''} has been cancelled.`,
  };
}

export function bookingConfirmationTemplate(data: Record<string, unknown>) {
  const { customerName, vehicleName, locationName, scheduledDate, scheduledTime, salesPersonName } = data as Record<string, string | undefined>;
  return {
    subject: `Test drive confirmed — ${scheduledDate || 'upcoming'}`,
    html: base(
      `Your test drive is confirmed for ${scheduledDate}`,
      `<div class="body">
        <h2>Test Drive Confirmed! ✅</h2>
        <p>Hi ${customerName || 'there'},</p>
        <p>Great news — your test drive is confirmed. We look forward to seeing you!</p>
        <div class="details">
          ${detailRow('Vehicle', vehicleName)}
          ${detailRow('Location', locationName)}
          ${detailRow('Date', scheduledDate)}
          ${detailRow('Time', scheduledTime)}
          ${detailRow('Sales Person', salesPersonName)}
        </div>
        <p>Please bring a valid driving licence. Arrive 10 minutes before your slot.</p>
      </div>`,
    ),
    text: `Hi ${customerName || 'there'}, your test drive is confirmed for ${scheduledDate} at ${scheduledTime}.`,
  };
}

export function salesFollowUpTemplate(data: Record<string, unknown>) {
  const { customerName, salesPersonName, vehicleName, followUpNote } = data as Record<string, string | undefined>;
  return {
    subject: `Follow-up from ${SITE_NAME}`,
    html: base(
      `Your ${SITE_NAME} sales consultant is following up`,
      `<div class="body">
        <h2>We're following up!</h2>
        <p>Hi ${customerName || 'there'},</p>
        <p>Your ${SITE_NAME} consultant${salesPersonName ? ` <strong>${salesPersonName}</strong>` : ''} is following up${vehicleName ? ` regarding the <strong>${vehicleName}</strong>` : ''}.</p>
        ${followUpNote ? `<p>${followUpNote}</p>` : ''}
        <p>Reply to this email or contact us directly — we'd love to help you take the next step.</p>
      </div>`,
    ),
    text: `Hi ${customerName || 'there'}, ${salesPersonName || 'your sales consultant'} is following up${vehicleName ? ` about the ${vehicleName}` : ''}.`,
  };
}

export function salesAssignmentTemplate(data: Record<string, unknown>) {
  const { salesPersonName, customerName, vehicleName, scheduledDate, scheduledTime } = data as Record<string, string | undefined>;
  return {
    subject: `New test drive assigned — ${customerName}`,
    html: base(
      `You have a new test drive assignment`,
      `<div class="body">
        <h2>New Test Drive Assigned</h2>
        <p>Hi ${salesPersonName || 'there'},</p>
        <p>A test drive has been assigned to you. Please review the details below:</p>
        <div class="details">
          ${detailRow('Customer', customerName)}
          ${detailRow('Vehicle', vehicleName)}
          ${detailRow('Date', scheduledDate)}
          ${detailRow('Time', scheduledTime)}
        </div>
        <p>Please ensure you are available and prepared for this appointment.</p>
      </div>`,
    ),
    text: `Hi ${salesPersonName || 'there'}, a test drive with ${customerName} for ${vehicleName} has been assigned to you on ${scheduledDate} at ${scheduledTime}.`,
  };
}

export function testDriveJourneyTemplate(data: Record<string, unknown>) {
  const { customerName, vehicleName, durationMinutes, startKm, endKm, notes } = data as Record<string, string | number | undefined>;
  return {
    subject: `Test drive journey summary — ${vehicleName || 'vehicle'}`,
    html: base(
      `Journey summary for your test drive`,
      `<div class="body">
        <h2>Journey Summary 🗺️</h2>
        <p>Hi ${customerName || 'there'},</p>
        <p>Here's a summary of your test drive journey:</p>
        <div class="details">
          ${detailRow('Vehicle', vehicleName as string)}
          ${detailRow('Duration', durationMinutes ? `${durationMinutes} minutes` : undefined)}
          ${detailRow('Start KM', startKm ? String(startKm) : undefined)}
          ${detailRow('End KM', endKm ? String(endKm) : undefined)}
          ${detailRow('Notes', notes as string)}
        </div>
      </div>`,
    ),
    text: `Hi ${customerName || 'there'}, here is your test drive journey summary for ${vehicleName || 'the vehicle'}.`,
  };
}

export function staffWelcomeTemplate(data: Record<string, unknown>) {
  const { fullName, roleLabel, verificationLink, loginUrl } = data as Record<string, string | undefined>;
  return {
    subject: `Verify your account to sign in`,
    html: base(
      `Welcome to ${SITE_NAME} — verify your account`,
      `<div class="body">
        <h2>Welcome to ${SITE_NAME}! 👋</h2>
        <p>Hi ${fullName || 'there'},</p>
        <p>Your <strong>${roleLabel || 'staff'}</strong> account has been created. Verify your email to get started:</p>
        ${verificationLink ? `<a class="cta" href="${verificationLink}">Verify My Account</a>` : ''}
        ${loginUrl ? `<p>After verification, sign in at: <a href="${loginUrl}">${loginUrl}</a></p>` : ''}
      </div>`,
    ),
    text: `Hi ${fullName || 'there'}, your ${roleLabel || 'staff'} account has been created. Verify your email: ${verificationLink}`,
  };
}

export function vehicleChangeNotificationTemplate(data: Record<string, unknown>) {
  const { customerName, oldVehicle, newVehicle, scheduledDate } = data as Record<string, string | undefined>;
  return {
    subject: `Vehicle updated for your test drive`,
    html: base(
      'Your test drive vehicle has been updated',
      `<div class="body">
        <h2>Vehicle Updated</h2>
        <p>Hi ${customerName || 'there'},</p>
        <p>The vehicle for your upcoming test drive has been updated:</p>
        <div class="details">
          ${detailRow('Previous Vehicle', oldVehicle)}
          ${detailRow('New Vehicle', newVehicle)}
          ${detailRow('Date', scheduledDate)}
        </div>
        <p>If you have any questions, please contact us.</p>
      </div>`,
    ),
    text: `Hi ${customerName || 'there'}, your test drive vehicle has been updated from ${oldVehicle} to ${newVehicle}.`,
  };
}

export function demoRequestConfirmationTemplate(data: Record<string, unknown>) {
  const { contactName, dealerName } = data as Record<string, string | undefined>;
  return {
    subject: `Demo request received — ${SITE_NAME}`,
    html: base(
      'We received your demo request',
      `<div class="body">
        <h2>Demo Request Received ✅</h2>
        <p>Hi ${contactName || 'there'},</p>
        <p>Thank you for your interest in ${SITE_NAME}${dealerName ? ` for <strong>${dealerName}</strong>` : ''}! We've received your demo request and our team will be in touch within 24 hours.</p>
      </div>`,
    ),
    text: `Hi ${contactName || 'there'}, we received your demo request and will be in touch within 24 hours.`,
  };
}

// ── Registry ─────────────────────────────────────────────────────────────────

type TemplateRenderer = (data: Record<string, unknown>) => { subject: string; html: string; text: string };

export const EMAIL_TEMPLATES: Record<string, TemplateRenderer> = {
  'booking-confirmation': bookingConfirmationTemplate,
  'sales-follow-up': salesFollowUpTemplate,
  'test-drive-journey': testDriveJourneyTemplate,
  'sales-assignment': salesAssignmentTemplate,
  'test-drive-completed': testDriveCompletedTemplate,
  'test-drive-rescheduled': testDriveRescheduledTemplate,
  'test-drive-cancelled': testDriveCancelledTemplate,
  'vehicle-change-notification': vehicleChangeNotificationTemplate,
  'staff-welcome': staffWelcomeTemplate,
  'demo-request-confirmation': demoRequestConfirmationTemplate,
};

/** Render an email template by name. Throws if template not found. */
export function renderEmailTemplate(
  templateName: string,
  data: Record<string, unknown>,
): { subject: string; html: string; text: string } {
  const renderer = EMAIL_TEMPLATES[templateName];
  if (!renderer) {
    throw new Error(`Unknown email template: ${templateName}`);
  }
  return renderer(data);
}
