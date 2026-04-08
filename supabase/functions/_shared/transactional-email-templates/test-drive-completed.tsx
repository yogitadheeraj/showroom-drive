import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Omni Tracely'

interface TestDriveCompletedProps {
  customerName?: string
  vehicleName?: string
  locationName?: string
  scheduledDate?: string
  salesPersonName?: string
  durationMinutes?: number
}

const TestDriveCompletedEmail = ({
  customerName,
  vehicleName,
  locationName,
  scheduledDate,
  salesPersonName,
  durationMinutes,
}: TestDriveCompletedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your test drive of {vehicleName || 'a vehicle'} is complete — thank you!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={logoText}>🚗 {SITE_NAME}</Text>
          <Text style={headerTitle}>Test Drive Completed!</Text>
          <Text style={headerSub}>Thank you for visiting us</Text>
        </Section>

        <Section style={section}>
          <Text style={greetingText}>
            Hi {customerName || 'there'},
          </Text>
          <Text style={bodyText}>
            We hope you enjoyed your test drive{vehicleName ? ` of the <strong>${vehicleName}</strong>` : ''}!
            Your feedback means a lot to us.
          </Text>
        </Section>

        <Section style={detailsBox}>
          <Text style={detailsTitle}>📋 Drive Summary</Text>
          {vehicleName && <Text style={detailRow}><span style={detailLabel}>Vehicle:</span> {vehicleName}</Text>}
          {locationName && <Text style={detailRow}><span style={detailLabel}>Location:</span> {locationName}</Text>}
          {scheduledDate && <Text style={detailRow}><span style={detailLabel}>Date:</span> {scheduledDate}</Text>}
          {salesPersonName && <Text style={detailRow}><span style={detailLabel}>Assisted by:</span> {salesPersonName}</Text>}
          {durationMinutes && <Text style={detailRow}><span style={detailLabel}>Duration:</span> {durationMinutes} minutes</Text>}
        </Section>

        <Section style={ctaSection}>
          <Text style={bodyText}>
            Interested in taking the next step? Our team is ready to help you with pricing,
            financing options, or scheduling another test drive with a different model.
          </Text>
        </Section>

        <Hr style={hr} />

        <Text style={footer}>
          Thank you for choosing <strong>{SITE_NAME}</strong>. We look forward to helping you find your perfect vehicle!
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TestDriveCompletedEmail,
  subject: (data: Record<string, any>) =>
    `Test Drive Complete — ${data.vehicleName || 'Your Vehicle'} | ${SITE_NAME}`,
  displayName: 'Test drive completed',
  previewData: {
    customerName: 'Dheeraj',
    vehicleName: 'Kia Seltos HTX',
    locationName: 'Bangalore HSR Layout',
    scheduledDate: '2026-04-08',
    salesPersonName: 'Rahul Sharma',
    durationMinutes: 45,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#f8fafc', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '0', maxWidth: '600px', margin: '0 auto' }
const header = {
  background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
  padding: '32px 32px 28px',
  borderRadius: '12px 12px 0 0',
  textAlign: 'center' as const,
}
const logoText = { fontSize: '20px', fontWeight: '700' as const, color: '#6EE7B7', margin: '0 0 12px' }
const headerTitle = { fontSize: '24px', fontWeight: '800' as const, color: '#FFFFFF', margin: '0 0 8px', lineHeight: '1.2' }
const headerSub = { fontSize: '15px', color: '#A7F3D0', margin: '0' }
const section = { padding: '24px 32px 0' }
const greetingText = { fontSize: '17px', fontWeight: '600' as const, color: '#0F172A', margin: '0 0 10px' }
const bodyText = { fontSize: '15px', color: '#475569', lineHeight: '1.7', margin: '0 0 20px' }
const detailsBox = {
  margin: '0 32px',
  backgroundColor: '#F0FDF4',
  border: '1px solid #BBF7D0',
  borderRadius: '10px',
  padding: '16px 20px',
}
const detailsTitle = { fontSize: '13px', fontWeight: '700' as const, color: '#166534', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 10px' }
const detailRow = { fontSize: '14px', color: '#0F172A', lineHeight: '1.8', margin: '0' }
const detailLabel = { fontWeight: '600' as const, color: '#047857' }
const ctaSection = { padding: '20px 32px 0' }
const hr = { borderColor: '#E2E8F0', margin: '24px 32px' }
const footer = { fontSize: '12px', color: '#94A3B8', lineHeight: '1.6', margin: '20px 32px 32px', textAlign: 'center' as const }
