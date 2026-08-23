import { describe, expect, it } from 'vitest';
import { getPreferredContactValues, normalizePreferredContactSelection } from './serviceBookingService';

describe('preferred contact selection normalization', () => {
  it('keeps one or many valid contact channels and supports all', () => {
    expect(normalizePreferredContactSelection(['phone', 'email'])).toBe('phone,email');
    expect(normalizePreferredContactSelection('email,whatsapp')).toBe('email,whatsapp');
    expect(normalizePreferredContactSelection(['phone', 'email', 'whatsapp'])).toBe('all');
    expect(normalizePreferredContactSelection(['all'])).toBe('all');
    expect(getPreferredContactValues([])).toEqual(['phone']);
  });
});
