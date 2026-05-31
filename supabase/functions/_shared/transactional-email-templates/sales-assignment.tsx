import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Auto Advant'

interface SalesAssignmentProps {
  customerName?: string
  vehicleName?: string
  locationName?: string
  scheduledDate?: string
  scheduledTime?: string
  salesPersonName?: string
  salesPersonPhone?: string
}

const SalesAssignmentEmail = ({
  customerName,
  vehicleName,
  locationName,
  scheduledDate,
  scheduledTime,
  salesPersonName,
  salesPersonPhone,
}: SalesAssignmentProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      Your sales executive for {vehicleName || 'your test drive'} — {SITE_NAME}
    </Preview>
    <Body style={main}>
      <Container style={container}>

        <Section style={header}>
          <Text style={logoText}>🚗 {SITE_NAME}</Text>
          <Text style={headerTitle}>Your Sales Executive is Assigned</Text>
          <Text style={headerSub}>
            Meet the person who'll guide your test drive experience
          </Text>
        </Section>

        <Section style={section}>
          <Text style={greetingText}>
            Hi {customerName || 'there'},
          </Text>
          <Text style={bodyText}>
            Great news! We've assigned a dedicated sales executive to assist you
            during your upcoming test drive{vehicleName ? ` of the <strong>${vehicleName}</strong>` : ''}.
            They'll be ready to welcome you, walk you through the vehicle's features,
            and answer any questions you may have.
          </Text>
        </Section>

        <Section style={assignmentBox}>
          <Text style={assignmentTitle}>👤 Your Sales Executive</Text>
          {salesPersonName && (
            <Text style={detailRow}>
              <span style={detailLabel}>Name:</span> {salesPersonName}
            </Text>
          )}
          {salesPersonPhone && (
            <Text style={detailRow}>
              <span style={detailLabel}>Contact:</span> {salesPersonPhone}
            </Text>
          )}
        </Section>

        {(scheduledDate || locationName) && (
          <Section style={detailsBox}>
            <Text style={detailsTitle}>📅 Appointment Details</Text>
            {vehicleName && (
              <Text style={detailRow}>
                <span style={detailLabel}>Vehicle:</span> {vehicleName}
              </Text>
            )}
            {scheduledDate && (
              <Text style={detailRow}>
                <span style={detailLabel}>Date:</span> {scheduledDate}
                {scheduledTime ? ` at ${scheduledTime}` : ''}
              </Text>
            )}
            {locationName && (
              <Text style={detailRow}>
                <span style={detailLabel}>Location:</span> {locationName}
              </Text>
            )}
          </Section>
        )}

        <Hr style={hr} />

        <Text style={footer}>
          This email was sent by <strong>{SITE_NAME}</strong> because you booked a test drive appointment.
          We look forward to seeing you!
        </Text>

      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SalesAssignmentEmail,
  subject: (data: Record<string, any>) =>
    `Your Sales Executive — ${data.vehicleName || 'Test Drive'} | ${SITE_NAME}`,
  displayName: 'Sales person assignment',
  previewData: {
    customerName: 'Dheeraj',
    vehicleName: 'Kia Seltos HTX',
    locationName: 'Bangalore HSR Layout',
    scheduledDate: '2026-04-05',
    scheduledTime: '11:00',
    salesPersonName: 'Rahul Sharma',
    salesPersonPhone: '+91 8*********',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#f8fafc', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '0', maxWidth: '600px', margin: '0 auto' }
const header = {
  background: 'linear-gradient(135deg, #0e2340 0%, #123b6e 100%)',
  padding: '32px 32px 28px',
  borderRadius: '12px 12px 0 0',
  textAlign: 'center' as const,
}
const logoText = { fontSize: '20px', fontWeight: '700' as const, color: '#93C5FD', margin: '0 0 12px' }
const headerTitle = { fontSize: '24px', fontWeight: '800' as const, color: '#FFFFFF', margin: '0 0 8px', lineHeight: '1.2' }
const headerSub = { fontSize: '15px', color: '#BFDBFE', margin: '0' }
const section = { padding: '24px 32px 0' }
const greetingText = { fontSize: '17px', fontWeight: '600' as const, color: '#0F172A', margin: '0 0 10px' }
const bodyText = { fontSize: '15px', color: '#475569', lineHeight: '1.7', margin: '0 0 20px' }
const assignmentBox = {
  margin: '0 32px',
  backgroundColor: '#F0FDF4',
  border: '1px solid #BBF7D0',
  borderRadius: '10px',
  padding: '16px 20px',
}
const assignmentTitle = { fontSize: '13px', fontWeight: '700' as const, color: '#166534', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 10px' }
const detailsBox = {
  margin: '16px 32px 0',
  backgroundColor: '#F0F9FF',
  border: '1px solid #BAE6FD',
  borderRadius: '10px',
  padding: '16px 20px',
}
const detailsTitle = { fontSize: '13px', fontWeight: '700' as const, color: '#0369A1', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 10px' }
const detailRow = { fontSize: '14px', color: '#0F172A', lineHeight: '1.8', margin: '0' }
const detailLabel = { fontWeight: '600' as const, color: '#0369A1' }
const hr = { borderColor: '#E2E8F0', margin: '24px 32px' }
const footer = { fontSize: '12px', color: '#94A3B8', lineHeight: '1.6', margin: '20px 32px 32px', textAlign: 'center' as const }
