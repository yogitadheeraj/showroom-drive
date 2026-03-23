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
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
  if (!TWILIO_API_KEY) {
    return new Response(JSON.stringify({ error: "TWILIO_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const WHATSAPP_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM");
  if (!WHATSAPP_FROM) {
    return new Response(JSON.stringify({ error: "TWILIO_WHATSAPP_FROM not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { to, message, customerId, testDriveId, purpose } = await req.json();

    if (!to || !message) {
      return new Response(JSON.stringify({ error: "Missing 'to' or 'message'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clean phone number - ensure E.164 format
    const cleanPhone = to.replace(/[\s-]/g, "");
    const cleanFrom = WHATSAPP_FROM.replace(/[\s-]/g, "");
    const whatsappTo = `whatsapp:${cleanPhone}`;
    const whatsappFrom = `whatsapp:${cleanFrom}`;

    // Send via Twilio gateway
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

    if (!twilioResponse.ok) {
      console.error("Twilio error:", twilioData);
      // Still log the failed attempt
      await logCommunication({
        customerId,
        testDriveId,
        purpose: purpose || "custom",
        sentTo: cleanPhone,
        body: message,
        status: "failed",
        externalId: null,
      });

      return new Response(
        JSON.stringify({ success: false, error: `Twilio error [${twilioResponse.status}]: ${JSON.stringify(twilioData)}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log successful communication
    await logCommunication({
      customerId,
      testDriveId,
      purpose: purpose || "custom",
      sentTo: cleanPhone,
      body: message,
      status: "sent",
      externalId: twilioData.sid || null,
    });

    return new Response(
      JSON.stringify({ success: true, messageSid: twilioData.sid }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("WhatsApp send error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function logCommunication(params: {
  customerId?: string;
  testDriveId?: string;
  purpose: string;
  sentTo: string;
  body: string;
  status: string;
  externalId: string | null;
}) {
  if (!params.customerId) return;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  await supabase.from("communications").insert({
    customer_id: params.customerId,
    test_drive_id: params.testDriveId || null,
    type: "whatsapp",
    purpose: params.purpose,
    sent_to: params.sentTo,
    body: params.body,
    status: params.status,
    external_id: params.externalId,
    sent_at: params.status === "sent" ? new Date().toISOString() : null,
  });
}