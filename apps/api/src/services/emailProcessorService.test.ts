import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

const state = vi.hoisted(() => ({ lean: vi.fn() }));
const queueId = new Types.ObjectId();

vi.mock('./emailQueueService.js', () => ({
  countFailedAttempts: vi.fn(),
  deleteEmailFromQueue: vi.fn(),
  isAlreadySent: vi.fn(),
  moveEmailToDlq: vi.fn(),
  readEmailBatch: vi.fn(),
}));
vi.mock('../models/EmailSendLog.js', () => ({ EmailSendLog: { create: vi.fn() } }));
vi.mock('../models/EmailSendState.js', () => ({ EmailSendState: { findOne: () => ({ lean: state.lean }) } }));
vi.mock('./mailService.js', () => ({ sendMail: vi.fn() }));

import { readEmailBatch, countFailedAttempts, isAlreadySent, deleteEmailFromQueue } from './emailQueueService.js';
import { EmailSendLog } from '../models/EmailSendLog.js';
import { sendMail } from './mailService.js';
import { processEmailQueues } from './emailProcessorService.js';

describe('email delivery logging', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    state.lean.mockResolvedValue(null);
    vi.mocked(readEmailBatch).mockResolvedValueOnce([{
      _id: queueId,
      queue: 'transactional_emails',
      tries: 1,
      message: {
        message_id: 'completion-1',
        to: 'customer@example.com',
        subject: 'Completed',
        html: '<p>Completed</p>',
        label: 'test-drive-completed',
        queued_at: new Date().toISOString(),
      },
    }]).mockResolvedValue([]);
    vi.mocked(countFailedAttempts).mockResolvedValue(0);
    vi.mocked(isAlreadySent).mockResolvedValue(false);
  });
  afterEach(() => vi.restoreAllMocks());

  it('keeps skipped SMTP messages retryable and never records them as sent', async () => {
    vi.mocked(sendMail).mockResolvedValue({ sent: false, skipped: true, reason: 'smtp_not_configured' });
    expect(await processEmailQueues()).toEqual({ processed: 0 });
    expect(EmailSendLog.create).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      error_message: 'Email not sent: smtp_not_configured',
    }));
    expect(deleteEmailFromQueue).not.toHaveBeenCalled();
  });

  it('logs successful SMTP sends and removes the queued message', async () => {
    vi.mocked(sendMail).mockResolvedValue({ sent: true, skipped: false });
    expect(await processEmailQueues()).toEqual({ processed: 1 });
    expect(EmailSendLog.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'sent' }));
    expect(deleteEmailFromQueue).toHaveBeenCalledWith(queueId.toString());
  });

  it('does not send a queued duplicate of an already delivered completion message', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(isAlreadySent).mockResolvedValue(true);
    expect(await processEmailQueues()).toEqual({ processed: 0 });
    expect(sendMail).not.toHaveBeenCalled();
    expect(deleteEmailFromQueue).toHaveBeenCalledWith(queueId.toString());
  });
});
