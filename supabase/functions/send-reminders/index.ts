import {
  createServiceRoleClient,
  errorResponse,
  getRequiredEnv,
  jsonResponse,
  logWhatsAppCommunication,
  preflightResponse,
  sanitizePhoneNumber,
  sendWhatsAppMessage,
} from "../_shared/whatsapp/common.ts";
import { TEST_DRIVE_REMINDER_SELECT } from "../_shared/whatsapp/constants.ts";
import {
  TestDriveStatus,
  WhatsAppDeliveryStatus,
  WhatsAppPurpose,
} from "../_shared/whatsapp/enums.ts";
import { ReminderDriveRecord } from "../_shared/whatsapp/types.ts";

function buildReminderMessage(drive: ReminderDriveRecord): string {
  const customerName = drive.customers?.full_name ?? "Customer";
  const vehicleName = [drive.vehicles?.brand, drive.vehicles?.model].filter(Boolean).join(" ") || "your selected vehicle";
  const locationName = drive.locations?.name ?? "your selected location";

  return `🔔 *Test Drive Reminder*\n\nHi ${customerName},\n\nThis is a reminder for your test drive tomorrow:\n🚗 *Vehicle:* ${vehicleName}\n📍 *Location:* ${locationName}\n⏰ *Time:* ${drive.scheduled_time}\n\nPlease bring a valid driving license. Reply CANCEL to cancel.\n\n— TestDriveSync`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return preflightResponse();
  }

  try {
    const lovableApiKey = getRequiredEnv("LOVABLE_API_KEY");
    const twilioApiKey = getRequiredEnv("TWILIO_API_KEY");
    const whatsappFrom = getRequiredEnv("TWILIO_WHATSAPP_FROM");
    const supabase = createServiceRoleClient();

    // Find test drives scheduled for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    const { data: drives, error } = await supabase
      .from("test_drives")
      .select(TEST_DRIVE_REMINDER_SELECT)
      .eq("scheduled_date", tomorrowStr)
      .in("status", [TestDriveStatus.Scheduled, TestDriveStatus.Confirmed]);

    if (error) throw error;

    let sent = 0;
    let failed = 0;

    for (const drive of (drives as ReminderDriveRecord[] | null) ?? []) {
      const customer = drive.customers;

      if (!customer?.phone) continue;

      const message = buildReminderMessage(drive);
      const cleanPhone = sanitizePhoneNumber(customer.phone);

      try {
        const { response, data } = await sendWhatsAppMessage({
          to: cleanPhone,
          from: whatsappFrom,
          message,
          lovableApiKey,
          twilioApiKey,
        });

        const status = response.ok
          ? WhatsAppDeliveryStatus.Sent
          : WhatsAppDeliveryStatus.Failed;

        await logWhatsAppCommunication({
          supabase,
          customerId: drive.customer_id,
          testDriveId: drive.id,
          purpose: WhatsAppPurpose.Reminder,
          sentTo: cleanPhone,
          body: message,
          status,
          externalId: data && typeof data === "object" && "sid" in data ? String(data.sid) : null,
        });

        if (response.ok) sent++;
        else failed++;
      } catch (err) {
        console.error(`Failed to send reminder to ${cleanPhone}:`, err);
        failed++;
      }
    }

    return jsonResponse({ success: true, total: drives?.length || 0, sent, failed });
  } catch (error: unknown) {
    console.error("Reminder error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(errorMessage);
  }
});