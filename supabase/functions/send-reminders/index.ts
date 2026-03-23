import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return errorResponse("LOVABLE_API_KEY not configured");

  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
  if (!TWILIO_API_KEY) return errorResponse("TWILIO_API_KEY not configured");

  const WHATSAPP_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM");
  if (!WHATSAPP_FROM) return errorResponse("TWILIO_WHATSAPP_FROM not configured");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Find test drives scheduled for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    const { data: drives, error } = await supabase
      .from("test_drives")
      .select("id, scheduled_date, scheduled_time, customer_id, vehicle_id, location_id, customers(full_name, phone), vehicles(brand, model), locations(name)")
      .eq("scheduled_date", tomorrowStr)
      .in("status", ["scheduled", "confirmed"]);

    if (error) throw error;

    let sent = 0;
    let failed = 0;

    for (const drive of drives || []) {
      const customer = (drive as any).customers;
      const vehicle = (drive as any).vehicles;
      const location = (drive as any).locations;

      if (!customer?.phone) continue;

      const message = `🔔 *Test Drive Reminder*\n\nHi ${customer.full_name},\n\nThis is a reminder for your test drive tomorrow:\n🚗 *Vehicle:* ${vehicle?.brand} ${vehicle?.model}\n📍 *Location:* ${location?.name}\n⏰ *Time:* ${drive.scheduled_time}\n\nPlease bring a valid driving license. Reply CANCEL to cancel.\n\n— DriveSync`;

      const cleanPhone = customer.phone.replace(/[\s-]/g, "");
      const whatsappTo = `whatsapp:${cleanPhone}`;
      const whatsappFrom = `whatsapp:${WHATSAPP_FROM}`;

      try {
        const twilioResponse = await fetch(`${GATEWAY_URL}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": TWILIO_API_KEY,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: whatsappTo,
            From: whatsappFrom,
            Body: message,
          }),
        });

        const twilioData = await twilioResponse.json();
        const status = twilioResponse.ok ? "sent" : "failed";

        await supabase.from("communications").insert({
          customer_id: drive.customer_id,
          test_drive_id: drive.id,
          type: "whatsapp",
          purpose: "reminder",
          sent_to: cleanPhone,
          body: message,
          status,
          external_id: twilioData.sid || null,
          sent_at: status === "sent" ? new Date().toISOString() : null,
        });

        if (twilioResponse.ok) sent++;
        else failed++;
      } catch (err) {
        console.error(`Failed to send reminder to ${cleanPhone}:`, err);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, total: drives?.length || 0, sent, failed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Reminder error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(errorMessage);
  }
});

function errorResponse(msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status: 500,
    headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
  });
}