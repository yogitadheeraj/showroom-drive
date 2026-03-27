import { createClient } from "npm:@supabase/supabase-js@2";

import {
  COMMUNICATION_TYPE,
  CORS_HEADERS,
  GATEWAY_URL,
  JSON_HEADERS,
  WHATSAPP_PREFIX,
} from "./constants.ts";
import { LogWhatsAppCommunicationParams, SendWhatsAppMessageParams } from "./types.ts";

export function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS,
  });
}

export function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status);
}

export function preflightResponse(): Response {
  return new Response(null, { headers: CORS_HEADERS });
}

export function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} not configured`);
  }
  return value;
}

export function createServiceRoleClient() {
  return createClient(
    getRequiredEnv("SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY")
  );
}

export function sanitizePhoneNumber(phone: string): string {
  return phone.replace(/[\s-]/g, "");
}

export function toWhatsAppAddress(phone: string): string {
  return `${WHATSAPP_PREFIX}${sanitizePhoneNumber(phone)}`;
}

export async function sendWhatsAppMessage(params: SendWhatsAppMessageParams) {
  const response = await fetch(`${GATEWAY_URL}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.lovableApiKey}`,
      "X-Connection-Api-Key": params.twilioApiKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: toWhatsAppAddress(params.to),
      From: toWhatsAppAddress(params.from),
      Body: params.message,
    }),
  });

  const data = await response.json().catch(() => null);

  return { response, data };
}

export async function logWhatsAppCommunication({
  supabase,
  customerId,
  testDriveId,
  purpose,
  sentTo,
  body,
  status,
  externalId,
}: LogWhatsAppCommunicationParams) {
  if (!customerId) {
    return;
  }

  await supabase.from("communications").insert({
    customer_id: customerId,
    test_drive_id: testDriveId ?? null,
    type: COMMUNICATION_TYPE,
    purpose,
    sent_to: sentTo,
    body,
    status,
    external_id: externalId,
    sent_at: status === "sent" ? new Date().toISOString() : null,
  });
}