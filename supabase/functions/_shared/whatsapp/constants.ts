export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export const JSON_HEADERS = {
  ...CORS_HEADERS,
  "Content-Type": "application/json",
};

export const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
export const WHATSAPP_PREFIX = "whatsapp:";
export const COMMUNICATION_TYPE = "whatsapp";

export const TEST_DRIVE_REMINDER_SELECT =
  "id, scheduled_date, scheduled_time, customer_id, vehicle_id, location_id, customers(full_name, phone), vehicles(brand, model), locations(name)";