import {
  createServiceRoleClient,
  errorResponse,
  jsonResponse,
  logWhatsAppCommunication,
  preflightResponse,
  sanitizePhoneNumber,
  sendWhatsAppMessage,
} from "../_shared/whatsapp/common.ts";
import {
  WhatsAppDeliveryStatus,
  WhatsAppPurpose,
} from "../_shared/whatsapp/enums.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return preflightResponse();
  }

  try {
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return errorResponse("LOVABLE_API_KEY not configured");
    }

    const twilioApiKey = Deno.env.get("TWILIO_API_KEY");
    if (!twilioApiKey) {
      return errorResponse("TWILIO_API_KEY not configured");
    }

    const whatsappFrom = Deno.env.get("TWILIO_WHATSAPP_FROM");
    if (!whatsappFrom) {
      return errorResponse("TWILIO_WHATSAPP_FROM not configured");
    }

    const { to, message, customerId, testDriveId, purpose } = await req.json();

    if (!to || !message) {
      return errorResponse("Missing 'to' or 'message'", 400);
    }

    const cleanPhone = sanitizePhoneNumber(to);
    const cleanFrom = sanitizePhoneNumber(whatsappFrom);
    const { response, data } = await sendWhatsAppMessage({
      to: cleanPhone,
      from: cleanFrom,
      message,
      lovableApiKey,
      twilioApiKey,
    });

    const supabase = createServiceRoleClient();
    const externalId = data && typeof data === "object" && "sid" in data ? String(data.sid) : null;
    const resolvedPurpose = purpose === WhatsAppPurpose.Reminder
      ? WhatsAppPurpose.Reminder
      : WhatsAppPurpose.Custom;

    if (!response.ok) {
      console.error("Twilio error:", data);
      await logWhatsAppCommunication({
        supabase,
        customerId,
        testDriveId,
        purpose: resolvedPurpose,
        sentTo: cleanPhone,
        body: message,
        status: WhatsAppDeliveryStatus.Failed,
        externalId,
      });

      return jsonResponse(
        { success: false, error: `Twilio error [${response.status}]: ${JSON.stringify(data)}` },
        502
      );
    }

    await logWhatsAppCommunication({
      supabase,
      customerId,
      testDriveId,
      purpose: resolvedPurpose,
      sentTo: cleanPhone,
      body: message,
      status: WhatsAppDeliveryStatus.Sent,
      externalId,
    });

    return jsonResponse({ success: true, messageSid: externalId });
  } catch (error: unknown) {
    console.error("WhatsApp send error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ success: false, error: errorMessage }, 500);
  }
});