import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Auto Advant'

interface VehicleChangeProps {
  customerName?: string
  oldVehicleName?: string
  newVehicleName?: string
  locationName?: string
  scheduledDate?: string
  scheduledTime?: string
}

const VehicleChangeEmail = ({
  customerName, oldVehicleName, newVehicleName,
  locationName, scheduledDate, scheduledTime,
}: VehicleChangeProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your test drive vehicle has been updated to {newVehicleName || 'a new model'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={logoText}>🚗 {SITE_NAME}</Text>
          <Text style={headerTitle}>Vehicle Updated</Text>
          <Text style={headerSub}>Your test drive appointment has been updated</Text>
        </Section>

        <Section style={section}>
          <Text style={greetingText}>Hi {customerName || 'there'},</Text>
          <Text style={bodyText}>
            The vehicle for your upcoming test drive has been changed.
            Here are the updated details:
          </Text>
        </Section>

        <Section style={newBox}>
          <Text style={boxTitle}>🚘 New Vehicle</Text>
          <Text style={vehicleText}>{newVehicleName || 'Updated vehicle'}</Text>
        </Section>

        {oldVehicleName && (
          <Section style={oldBox}>
            <Text style={oldTitle}>Previous Vehicle</Text>
            <Text style={oldVehicleText}>{oldVehicleName}</Text>
          </Section>
        )}

        <Section style={detailsBox}>
          <Text style={detailsTitle}>📅 Appointment Details</Text>
          {scheduledDate && <Text style={detailRow}><span style={detailLabel}>Date:</span> {scheduledDate}{scheduledTime ? ` at ${scheduledTime}` : ''}</Text>}
          {locationName && <Text style={detailRow}><span style={detailLabel}>Location:</span> {locationName}</Text>}
        </Section>

        <Hr style={hr} />
        <Text style={footer}>
          This email was sent by <strong>{SITE_NAME}</strong> because your test drive vehicle was updated.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: VehicleChangeEmail,
  subject: (data: Record<string, any>) =>
    `Vehicle Updated — Now: ${data.newVehicleName || 'New Vehicle'} | ${SITE_NAME}`,
  displayName: 'Vehicle change notification',
  previewData: {
    customerName: 'Dheeraj',
    oldVehicleName: 'Kia Seltos HTX',
    newVehicleName: 'Kia EV6 GT-Line',
    locationName: 'Bangalore HSR Layout',
    scheduledDate: '2026-04-10',
    scheduledTime: '14:00',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#f8fafc', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '0', maxWidth: '600px', margin: '0 auto' }
const header = {
  background: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)',
  padding: '32px 32px 28px',
  borderRadius: '12px 12px 0 0',
  textAlign: 'center' as const,
}
const logoText = { fontSize: '20px', fontWeight: '700' as const, color: '#FDE68A', margin: '0 0 12px' }
const headerTitle = { fontSize: '24px', fontWeight: '800' as const, color: '#FFFFFF', margin: '0 0 8px', lineHeight: '1.2' }
const headerSub = { fontSize: '15px', color: '#FEF3C7', margin: '0' }
const section = { padding: '24px 32px 0' }
const greetingText = { fontSize: '17px', fontWeight: '600' as const, color: '#0F172A', margin: '0 0 10px' }
const bodyText = { fontSize: '15px', color: '#475569', lineHeight: '1.7', margin: '0 0 20px' }
const newBox = {
  margin: '0 32px',
  backgroundColor: '#FFFBEB',
  border: '1px solid #FDE68A',
  borderRadius: '10px',
  padding: '16px 20px',
}
const boxTitle = { fontSize: '13px', fontWeight: '700' as const, color: '#92400E', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 8px' }
const vehicleText = { fontSize: '18px', fontWeight: '700' as const, color: '#92400E', margin: '0' }
const oldBox = {
  margin: '12px 32px 0',
  backgroundColor: '#F1F5F9',
  border: '1px solid #CBD5E1',
  borderRadius: '10px',
  padding: '12px 20px',
}
const oldTitle = { fontSize: '12px', fontWeight: '700' as const, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 6px' }
const oldVehicleText = { fontSize: '14px', color: '#94A3B8', margin: '0', textDecoration: 'line-through' as const }
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
