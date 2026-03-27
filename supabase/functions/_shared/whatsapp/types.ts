import { createClient } from "npm:@supabase/supabase-js@2";

import { WhatsAppDeliveryStatus, WhatsAppPurpose } from "./enums.ts";

export type ServiceRoleSupabaseClient = ReturnType<typeof createClient>;

export interface ReminderDriveRecord {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  customer_id: string;
  vehicle_id: string | null;
  location_id: string | null;
  customers: {
    full_name: string;
    phone: string | null;
  } | null;
  vehicles: {
    brand: string | null;
    model: string | null;
  } | null;
  locations: {
    name: string | null;
  } | null;
}

export interface SendWhatsAppMessageParams {
  to: string;
  from: string;
  message: string;
  lovableApiKey: string;
  twilioApiKey: string;
}

export interface LogWhatsAppCommunicationParams {
  supabase: ServiceRoleSupabaseClient;
  customerId?: string;
  testDriveId?: string;
  purpose: WhatsAppPurpose;
  sentTo: string;
  body: string;
  status: WhatsAppDeliveryStatus;
  externalId: string | null;
}