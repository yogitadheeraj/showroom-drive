export type Customer360Item = {
  id: string;
  type: 'customer' | 'test_drive' | 'communication' | 'event';
  title: string;
  description: string;
  timestamp: string;
  source?: string | null;
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
    }] : []),
    ...testDrives.map((testDrive: any) => ({
      id: `test-drive-${testDrive.id}`,
      type: 'test_drive' as const,
      title: `Test drive ${String(testDrive.status || 'updated').replace(/_/g, ' ')}`,
      description: `${testDrive.vehicle_name || 'Vehicle'} • ${testDrive.scheduled_date || '—'} ${testDrive.scheduled_time || ''}`.trim(),
      timestamp: testDrive.updated_at || testDrive.created_at || testDrive.scheduled_date || new Date().toISOString(),
      source: 'Test drive',
    })),
    ...communications.map((communication: any) => ({
      id: `communication-${communication.id}`,
      type: 'communication' as const,
      title: `${String(communication.type || 'message').toUpperCase()} ${String(communication.purpose || 'communication').replace(/_/g, ' ')}`,
      description: `${communication.subject || communication.purpose || 'Message'} • ${communication.sent_to || 'customer'}`,
      timestamp: communication.sent_at || communication.created_at || new Date().toISOString(),
      source: communication.type || 'communication',
    })),
    ...events.map((event: any) => ({
      id: `event-${event.id}`,
      type: 'event' as const,
      title: event.event_label || event.event_type || 'Activity',
      description: event.metadata && typeof event.metadata === 'object'
        ? JSON.stringify(event.metadata).slice(0, 120)
        : 'Customer activity update',
      timestamp: event.happened_at || event.created_at || new Date().toISOString(),
      source: event.event_type || 'activity',
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
