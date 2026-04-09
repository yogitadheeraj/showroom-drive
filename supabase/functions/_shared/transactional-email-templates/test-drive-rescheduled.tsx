import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Auto Advant'

interface TestDriveRescheduledProps {
  customerName?: string
  vehicleName?: string
  locationName?: string
  newDate?: string
  newTime?: string
  originalDate?: string
  originalTime?: string
}

const TestDriveRescheduledEmail = ({
  customerName, vehicleName, locationName,
  newDate, newTime, originalDate, originalTime,
}: TestDriveRescheduledProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your test drive has been rescheduled — {newDate || 'new date'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={logoText}>🚗 {SITE_NAME}</Text>
          <Text style={headerTitle}>Test Drive Rescheduled</Text>
          <Text style={headerSub}>Your appointment has been updated</Text>
        </Section>

        <Section style={section}>
          <Text style={greetingText}>Hi {customerName || 'there'},</Text>
          <Text style={bodyText}>
            Your test drive{vehicleName ? ` for the <strong>${vehicleName}</strong>` : ''} has been rescheduled.
            Please find the updated details below.
          </Text>
        </Section>

        <Section style={newBox}>
          <Text style={boxTitle}>📅 New Appointment</Text>
          {newDate && <Text style={detailRow}><span style={detailLabel}>Date:</span> {newDate}</Text>}
          {newTime && <Text style={detailRow}><span style={detailLabel}>Time:</span> {newTime}</Text>}
          {locationName && <Text style={detailRow}><span style={detailLabel}>Location:</span> {locationName}</Text>}
          {vehicleName && <Text style={detailRow}><span style={detailLabel}>Vehicle:</span> {vehicleName}</Text>}
        </Section>

        {(originalDate || originalTime) && (
          <Section style={oldBox}>
            <Text style={oldTitle}>Previous Appointment</Text>
            {originalDate && <Text style={detailRow}><span style={oldLabel}>Date:</span> {originalDate}</Text>}
            {originalTime && <Text style={detailRow}><span style={oldLabel}>Time:</span> {originalTime}</Text>}
          </Section>
        )}

        <Text style={reminderText}>
          Please bring a valid driving license. We look forward to seeing you!
        </Text>

        <Hr style={hr} />
        <Text style={footer}>
          This email was sent by <strong>{SITE_NAME}</strong> because your test drive appointment was updated.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TestDriveRescheduledEmail,
  subject: (data: Record<string, any>) =>
    `Test Drive Rescheduled — ${data.newDate || 'Updated'} | ${SITE_NAME}`,
  displayName: 'Test drive rescheduled',
  previewData: {
    customerName: 'Dheeraj',
    vehicleName: 'Kia Seltos HTX',
    locationName: 'Bangalore HSR Layout',
    newDate: '2026-04-12',
    newTime: '15:00',
    originalDate: '2026-04-08',
    originalTime: '11:00',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#f8fafc', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '0', maxWidth: '600px', margin: '0 auto' }
const header = {
  background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
  padding: '32px 32px 28px',
  borderRadius: '12px 12px 0 0',
  textAlign: 'center' as const,
}
const logoText = { fontSize: '20px', fontWeight: '700' as const, color: '#C4B5FD', margin: '0 0 12px' }
const headerTitle = { fontSize: '24px', fontWeight: '800' as const, color: '#FFFFFF', margin: '0 0 8px', lineHeight: '1.2' }
const headerSub = { fontSize: '15px', color: '#DDD6FE', margin: '0' }
const section = { padding: '24px 32px 0' }
const greetingText = { fontSize: '17px', fontWeight: '600' as const, color: '#0F172A', margin: '0 0 10px' }
const bodyText = { fontSize: '15px', color: '#475569', lineHeight: '1.7', margin: '0 0 20px' }
const newBox = {
  margin: '0 32px',
  backgroundColor: '#F5F3FF',
  border: '1px solid #C4B5FD',
  borderRadius: '10px',
  padding: '16px 20px',
}
const boxTitle = { fontSize: '13px', fontWeight: '700' as const, color: '#5B21B6', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 10px' }
const oldBox = {
  margin: '12px 32px 0',
  backgroundColor: '#FEF2F2',
  border: '1px solid #FECACA',
  borderRadius: '10px',
  padding: '12px 20px',
}
const oldTitle = { fontSize: '12px', fontWeight: '700' as const, color: '#991B1B', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 8px', textDecoration: 'line-through' as const }
const detailRow = { fontSize: '14px', color: '#0F172A', lineHeight: '1.8', margin: '0' }
const detailLabel = { fontWeight: '600' as const, color: '#6D28D9' }
const oldLabel = { fontWeight: '600' as const, color: '#991B1B' }
const reminderText = { fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: '20px 32px 0' }
const hr = { borderColor: '#E2E8F0', margin: '24px 32px' }
const footer = { fontSize: '12px', color: '#94A3B8', lineHeight: '1.6', margin: '20px 32px 32px', textAlign: 'center' as const }
