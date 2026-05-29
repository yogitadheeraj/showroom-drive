import { apiInvokeFunction } from '@/lib/apiClient';

export async function sendDailyTestDriveReports(payload: { reportDate?: string; locationIds?: string[] } = {}) {
  return apiInvokeFunction<any>('send-daily-test-drive-reports', payload);
}

export async function sendDailyActivityReports(payload: { reportDate?: string; locationIds?: string[] } = {}) {
  return apiInvokeFunction<any>('send-daily-activity-reports', payload);
}

export async function triggerScheduledReports(payload: Record<string, unknown> = {}) {
  return apiInvokeFunction<any>('trigger-scheduled-reports', payload);
}

export async function sendTransactionalEmail(payload: Record<string, unknown>) {
  return apiInvokeFunction<any>('send-transactional-email', payload);
}

export async function sendWhatsapp(payload: Record<string, unknown>) {
  return apiInvokeFunction<any>('send-whatsapp', payload);
}

export async function handleEmailUnsubscribe(payload: { token?: string; email?: string } = {}) {
  return apiInvokeFunction<any>('handle-email-unsubscribe', payload);
}

export async function sendNewLeadNotification(payload: Record<string, unknown>) {
  return apiInvokeFunction<any>('new-lead-notification', payload);
}
