export type Customer360Item = {
  id: string;
  type: 'customer' | 'test_drive' | 'communication' | 'event';
  title: string;
  description: string;
  timestamp: string;
  source?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
  raw?: any;
};

export function buildCustomer360Summary({
  customer,
  testDrives = [],
  communications = [],
  events = [],
}: {
  customer?: any | null;
  testDrives?: any[];
  communications?: any[];
  events?: any[];
}) {
  const describeEvent = (event: any) => {
    const metadata = event?.metadata;
    if (!metadata || typeof metadata !== 'object') {
      return 'Customer activity update';
    }

    const showroom = String(metadata.showroom || '').trim();
    const visitReason = String(metadata.visit_reason || '').trim();
    const modelInterest = String(metadata.model_interest || '').trim();
    const trimInterest = String(metadata.trim_interest || '').trim();
    const budget = String(metadata.budget || '').trim();
    const notes = String(metadata.notes || '').trim();

    const parts = [
      showroom ? `Showroom: ${showroom}` : '',
      visitReason ? `Reason: ${visitReason}` : '',
      modelInterest ? `Model: ${modelInterest}` : '',
      trimInterest ? `Trim: ${trimInterest}` : '',
      budget ? `Budget: ${budget}` : '',
      notes || '',
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(' • ') : JSON.stringify(metadata).slice(0, 120);
  };

  const hasCustomerEvent = (events || []).some((event: any) =>
    (event?.event_type || '').toLowerCase().includes('customer')
  );

  const timeline: Customer360Item[] = [
    ...(customer && !hasCustomerEvent ? [{
      id: `customer-${customer.id}`,
      type: 'customer' as const,
      title: 'Customer profile created',
      description: `${customer.full_name || 'Customer'} was added to the CRM`,
      timestamp: customer.created_at || new Date().toISOString(),
      source: 'CRM',
      raw: customer,
    }] : []),
    ...testDrives.map((testDrive: any) => ({
      id: `test-drive-${testDrive.id}`,
      type: 'test_drive' as const,
      title: `Test drive ${String(testDrive.status || 'updated').replace(/_/g, ' ')}`,
      description: `${testDrive.vehicle_name || 'Vehicle'} • ${testDrive.scheduled_date || '—'} ${testDrive.scheduled_time || ''}`.trim(),
      timestamp: testDrive.updated_at || testDrive.created_at || testDrive.scheduled_date || new Date().toISOString(),
      source: 'Test drive',
      status: testDrive.status || null,
      raw: testDrive,
    })),
    ...communications.map((communication: any) => ({
      id: `communication-${communication.id}`,
      type: 'communication' as const,
      title: `${String(communication.type || 'message').toUpperCase()} ${String(communication.purpose || 'communication').replace(/_/g, ' ')}`,
      description: `${communication.subject || communication.purpose || 'Message'} • ${communication.sent_to || 'customer'}`,
      timestamp: communication.sent_at || communication.created_at || new Date().toISOString(),
      source: communication.type || 'communication',
      status: communication.status || null,
      raw: communication,
    })),
    ...events.map((event: any) => ({
      id: `event-${event.id}`,
      type: 'event' as const,
      title: event.event_label || event.event_type || 'Activity',
      description: describeEvent(event),
      timestamp: event.happened_at || event.created_at || new Date().toISOString(),
      source: event.event_type || 'activity',
      metadata: event.metadata && typeof event.metadata === 'object' ? event.metadata : null,
      raw: event,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const metrics = {
    totalActivities: timeline.length,
    totalTestDrives: testDrives.length,
    totalCommunications: communications.length,
    activeTestDrives: testDrives.filter((testDrive: any) => ['scheduled', 'confirmed', 'show', 'in_progress'].includes(testDrive.status)).length,
  };

  return {
    customer,
    timeline,
    metrics,
    testDrives,
    communications,
    events,
  };
}
