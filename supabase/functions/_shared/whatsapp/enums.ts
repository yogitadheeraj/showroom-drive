export const WhatsAppDeliveryStatus = {
  Sent: "sent",
  Failed: "failed",
} as const;

export type WhatsAppDeliveryStatus =
  (typeof WhatsAppDeliveryStatus)[keyof typeof WhatsAppDeliveryStatus];

export const WhatsAppPurpose = {
  Reminder: "reminder",
  Custom: "custom",
} as const;

export type WhatsAppPurpose =
  (typeof WhatsAppPurpose)[keyof typeof WhatsAppPurpose];

export const TestDriveStatus = {
  Scheduled: "scheduled",
  Confirmed: "confirmed",
} as const;

export type TestDriveStatus =
  (typeof TestDriveStatus)[keyof typeof TestDriveStatus];