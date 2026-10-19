import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

const records = vi.hoisted(() => ({
  customer: vi.fn(),
  vehicle: vi.fn(),
  location: vi.fn(),
  profile: vi.fn(),
  drives: vi.fn(),
}));

vi.mock('../models/TestDrive.js', () => ({
  TestDrive: { updateOne: vi.fn(), find: () => ({ lean: records.drives }) },
}));
vi.mock('../models/Customer.js', () => ({ Customer: { findOne: () => ({ lean: records.customer }) } }));
vi.mock('../models/Vehicle.js', () => ({ Vehicle: { findOne: () => ({ lean: records.vehicle }) } }));
vi.mock('../models/Location.js', () => ({ Location: { findOne: () => ({ lean: records.location }) } }));
vi.mock('../models/Profile.js', () => ({ Profile: { findOne: () => ({ lean: records.profile }) } }));
vi.mock('../models/EmailQueue.js', () => ({ EmailQueue: { exists: vi.fn() } }));
vi.mock('./emailQueueService.js', () => ({ isAlreadySent: vi.fn() }));
vi.mock('./reportEmailService.js', () => ({ sendTransactionalEmail: vi.fn() }));
vi.mock('./mailService.js', () => ({ sendMail: vi.fn() }));
vi.mock('../controllers/customerBookingController.js', () => ({ generateBookingToken: vi.fn() }));
vi.mock('../config/env.js', () => ({ env: { publicFrontendUrl: 'https://showroom.example.com/' } }));

import { TestDrive } from '../models/TestDrive.js';
import { EmailQueue } from '../models/EmailQueue.js';
import { isAlreadySent } from './emailQueueService.js';
import { sendTransactionalEmail } from './reportEmailService.js';
import { queueTestDriveCompletionEmail, sendPostDriveThankYou } from './testDriveReminderService.js';
import { testDriveCompletedTemplate } from '../templates/emailTemplates.js';

const drive = {
  id: 'drive-123',
  status: 'completed' as const,
  customer_id: 'customer-1',
  vehicle_id: 'vehicle-1',
  location_id: 'location-1',
  assigned_sales_person_id: 'sales-1',
  scheduled_date: '2026-01-10',
  started_at: '2026-01-10T10:00:00.000Z',
  completed_at: '2026-01-10T10:30:00.000Z',
  security_checked_in_at: null,
  security_checked_out_at: null,
};

describe('completion emails', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(isAlreadySent).mockResolvedValue(false);
    vi.mocked(EmailQueue.exists).mockResolvedValue(null);
    records.customer.mockResolvedValue({ full_name: 'Customer', email: 'customer@example.com' });
    records.vehicle.mockResolvedValue({ brand: 'Brand', model: 'Model' });
    records.location.mockResolvedValue({ name: 'Showroom' });
    records.profile.mockResolvedValue({ full_name: 'Sales Person' });
    vi.mocked(sendTransactionalEmail).mockResolvedValue({ queued: true, messageId: 'test-drive-completed-drive-123' });
  });
  afterEach(() => vi.restoreAllMocks());

  it('queues the completion summary with a real drive-specific feedback URL', async () => {
    expect(await queueTestDriveCompletionEmail(drive)).toBe(true);
    expect(sendTransactionalEmail).toHaveBeenCalledWith(expect.objectContaining({
      recipientEmail: 'customer@example.com',
      templateName: 'test-drive-completed',
      messageId: 'test-drive-completed-drive-123',
      templateData: expect.objectContaining({
        feedbackLink: 'https://showroom.example.com/test-drive-feedback?td=drive-123',
        durationMinutes: 30,
        salesPersonName: 'Sales Person',
      }),
    }));
    expect(TestDrive.updateOne).not.toHaveBeenCalled();
  });

  it('does not notify for incomplete drives', async () => {
    expect(await queueTestDriveCompletionEmail({ ...drive, status: 'in_progress' })).toBe(false);
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it('does not queue again while the email is pending', async () => {
    vi.mocked(EmailQueue.exists).mockResolvedValue({ _id: new Types.ObjectId() });
    expect(await queueTestDriveCompletionEmail(drive)).toBe(false);
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it('marks successful delivery without resending an already sent message', async () => {
    vi.mocked(isAlreadySent).mockResolvedValue(true);
    expect(await queueTestDriveCompletionEmail(drive)).toBe(false);
    expect(TestDrive.updateOne).toHaveBeenCalledWith({ id: drive.id }, { $set: { thank_you_sent: true } });
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it('logs missing customer email rather than attempting delivery', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    records.customer.mockResolvedValue({ full_name: 'Customer', email: '' });
    expect(await queueTestDriveCompletionEmail(drive)).toBe(false);
    expect(warning).toHaveBeenCalled();
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it('surfaces queue errors so the caller can log and the scheduler can retry', async () => {
    vi.mocked(sendTransactionalEmail).mockRejectedValue(new Error('Queue unavailable'));
    await expect(queueTestDriveCompletionEmail(drive)).rejects.toThrow('Queue unavailable');
    expect(TestDrive.updateOne).not.toHaveBeenCalled();
  });

  it('recovers missed completion emails through the scheduled job', async () => {
    records.drives.mockResolvedValue([drive]);
    expect(await sendPostDriveThankYou()).toEqual({ queued: 1 });
    expect(sendTransactionalEmail).toHaveBeenCalledWith(expect.objectContaining({
      messageId: 'test-drive-completed-drive-123',
    }));
  });

  it('encodes the drive ID in the feedback link', async () => {
    await queueTestDriveCompletionEmail({ ...drive, id: 'drive/with spaces&extra' });
    const payload = vi.mocked(sendTransactionalEmail).mock.calls[0][0];
    const feedbackLink = payload.templateData?.feedbackLink;
    expect(typeof feedbackLink).toBe('string');
    expect(new URL(String(feedbackLink)).searchParams.get('td')).toBe('drive/with spaces&extra');
  });

  it('includes the feedback URL in HTML and plain text', () => {
    const feedbackLink = 'https://showroom.example.com/test-drive-feedback?td=drive-123';
    const template = testDriveCompletedTemplate({ customerName: 'Customer', feedbackLink });
    expect(template.html).toContain(`href="${feedbackLink}"`);
    expect(template.html).toContain('Share Your Feedback');
    expect(template.text).toContain(feedbackLink);
  });
});
