import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Omni Tracely"

interface BookingConfirmationProps {
  customerName?: string
  vehicleName?: string
  locationName?: string
  scheduledDate?: string
  scheduledTime?: string
}

const BookingConfirmationEmail = ({
  customerName,
  vehicleName,
  locationName,
  scheduledDate,
  scheduledTime,
}: BookingConfirmationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your test drive is confirmed — {vehicleName || 'your vehicle'} at {locationName || 'our showroom'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Text style={logoText}>🚗 {SITE_NAME}</Text>
        </Section>

        <Heading style={h1}>
          Test Drive Confirmed!
        </Heading>

        <Text style={text}>
          {customerName ? `Hi ${customerName},` : 'Hi there,'} your test drive has been successfully booked. Here are the details:
        </Text>

        <Section style={detailsBox}>
          <Text style={detailRow}>
            <span style={detailLabel}>Vehicle:</span> {vehicleName || 'Your selected vehicle'}
          </Text>
          <Text style={detailRow}>
            <span style={detailLabel}>Location:</span> {locationName || 'Our showroom'}
          </Text>
          <Text style={detailRow}>
            <span style={detailLabel}>Date:</span> {scheduledDate || 'As scheduled'}
          </Text>
          <Text style={detailRow}>
            <span style={detailLabel}>Time:</span> {scheduledTime || 'As scheduled'}
          </Text>
        </Section>

        <Text style={text}>
          Please bring a valid driving license with you. We look forward to seeing you!
        </Text>

        <Hr style={hr} />

        <Text style={footer}>
          Best regards,<br />The {SITE_NAME} Team
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BookingConfirmationEmail,
  subject: (data: Record<string, any>) =>
    `Test Drive Confirmed — ${data.vehicleName || 'Your Vehicle'}`,
  displayName: 'Booking confirmation',
  previewData: {
    customerName: 'Dheeraj',
    vehicleName: 'Kia Seltos HTX',
    locationName: 'Bangalore HSR Layout',
    scheduledDate: '2026-03-25',
    scheduledTime: '14:00',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '20px 25px', maxWidth: '560px', margin: '0 auto' }
const headerSection = { padding: '20px 0 10px' }
const logoText = { fontSize: '20px', fontWeight: '700' as const, color: 'hsl(220, 80%, 50%)', margin: '0' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: 'hsl(220, 25%, 10%)', margin: '0 0 16px' }
const text = { fontSize: '15px', color: 'hsl(220, 10%, 45%)', lineHeight: '1.6', margin: '0 0 20px' }
const detailsBox = {
  backgroundColor: 'hsl(220, 20%, 97%)',
  borderRadius: '12px',
  padding: '16px 20px',
  margin: '0 0 20px',
  border: '1px solid hsl(220, 15%, 88%)',
}
const detailRow = { fontSize: '15px', color: 'hsl(220, 25%, 10%)', lineHeight: '1.8', margin: '0' }
const detailLabel = { fontWeight: '600' as const, color: 'hsl(220, 80%, 50%)' }
const hr = { borderColor: 'hsl(220, 15%, 88%)', margin: '24px 0' }
const footer = { fontSize: '13px', color: 'hsl(220, 10%, 45%)', margin: '0' }
