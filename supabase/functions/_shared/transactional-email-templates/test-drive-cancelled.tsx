import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Omni Tracely'

interface TestDriveCancelledProps {
  customerName?: string
  vehicleName?: string
  locationName?: string
  scheduledDate?: string
  scheduledTime?: string
  cancelReason?: string
}

const TestDriveCancelledEmail = ({
  customerName, vehicleName, locationName,
  scheduledDate, scheduledTime, cancelReason,
}: TestDriveCancelledProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your test drive has been cancelled</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={logoText}>🚗 {SITE_NAME}</Text>
          <Text style={headerTitle}>Test Drive Cancelled</Text>
        </Section>

        <Section style={section}>
          <Text style={greetingText}>Hi {customerName || 'there'},</Text>
          <Text style={bodyText}>
            We're writing to let you know that your test drive
            {vehicleName ? ` for the <strong>${vehicleName}</strong>` : ''} has been cancelled.
          </Text>
        </Section>

        <Section style={detailsBox}>
          <Text style={detailsTitle}>📋 Cancelled Appointment</Text>
          {vehicleName && <Text style={detailRow}><span style={detailLabel}>Vehicle:</span> {vehicleName}</Text>}
          {locationName && <Text style={detailRow}><span style={detailLabel}>Location:</span> {locationName}</Text>}
          {scheduledDate && <Text style={detailRow}><span style={detailLabel}>Date:</span> {scheduledDate}</Text>}
          {scheduledTime && <Text style={detailRow}><span style={detailLabel}>Time:</span> {scheduledTime}</Text>}
          {cancelReason && <Text style={detailRow}><span style={detailLabel}>Reason:</span> {cancelReason}</Text>}
        </Section>

        <Section style={section}>
          <Text style={bodyText}>
            We'd love to see you at our showroom! Feel free to book another test drive at your convenience.
          </Text>
        </Section>

        <Hr style={hr} />
        <Text style={footer}>
          This email was sent by <strong>{SITE_NAME}</strong> regarding your test drive appointment.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TestDriveCancelledEmail,
  subject: (data: Record<string, any>) =>
    `Test Drive Cancelled — ${data.vehicleName || 'Your Appointment'} | ${SITE_NAME}`,
  displayName: 'Test drive cancelled',
  previewData: {
    customerName: 'Dheeraj',
    vehicleName: 'Kia Seltos HTX',
    locationName: 'Bangalore HSR Layout',
    scheduledDate: '2026-04-08',
    scheduledTime: '11:00',
    cancelReason: 'Customer request',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#f8fafc', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '0', maxWidth: '600px', margin: '0 auto' }
const header = {
  background: 'linear-gradient(135deg, #991B1B 0%, #B91C1C 100%)',
  padding: '32px 32px 28px',
  borderRadius: '12px 12px 0 0',
  textAlign: 'center' as const,
}
const logoText = { fontSize: '20px', fontWeight: '700' as const, color: '#FCA5A5', margin: '0 0 12px' }
const headerTitle = { fontSize: '24px', fontWeight: '800' as const, color: '#FFFFFF', margin: '0 0 8px', lineHeight: '1.2' }
const section = { padding: '24px 32px 0' }
const greetingText = { fontSize: '17px', fontWeight: '600' as const, color: '#0F172A', margin: '0 0 10px' }
const bodyText = { fontSize: '15px', color: '#475569', lineHeight: '1.7', margin: '0 0 20px' }
const detailsBox = {
  margin: '0 32px',
  backgroundColor: '#FEF2F2',
  border: '1px solid #FECACA',
  borderRadius: '10px',
  padding: '16px 20px',
}
const detailsTitle = { fontSize: '13px', fontWeight: '700' as const, color: '#991B1B', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 10px' }
const detailRow = { fontSize: '14px', color: '#0F172A', lineHeight: '1.8', margin: '0' }
const detailLabel = { fontWeight: '600' as const, color: '#B91C1C' }
const hr = { borderColor: '#E2E8F0', margin: '24px 32px' }
const footer = { fontSize: '12px', color: '#94A3B8', lineHeight: '1.6', margin: '20px 32px 32px', textAlign: 'center' as const }
