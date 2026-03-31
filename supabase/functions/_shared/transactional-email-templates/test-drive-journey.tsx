import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Html, Preview, Text, Section, Hr, Row, Column,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Omni Tracely'

interface TestDriveJourneyProps {
  customerName?: string
  vehicleName?: string
  locationName?: string
  locationAddress?: string
  locationPhone?: string
  scheduledDate?: string
  scheduledTime?: string
  salesPersonName?: string
  currentStatus?: string
  feedbackLink?: string
  enquiryId?: string
  totalDurationMinutes?: number
}

const STEPS = [
  {
    num: '01',
    icon: '📧',
    title: 'Booking Confirmation',
    description: 'You have received this email and/or a WhatsApp message confirming your test drive appointment with full details.',
    color: '#3B82F6',
    bgColor: '#EFF6FF',
  },
  {
    num: '02',
    icon: '🪪',
    title: 'Upload Driving License',
    description: 'Please upload a clear image of your valid driving license before you arrive. This helps speed up the verification process.',
    color: '#8B5CF6',
    bgColor: '#F5F3FF',
  },
  {
    num: '03',
    icon: '🔍',
    title: 'License Verification',
    description: 'Our security team will verify your driving license when you arrive at the showroom. This usually takes just a few minutes.',
    color: '#6366F1',
    bgColor: '#EEF2FF',
  },
  {
    num: '04',
    icon: '🔑',
    title: 'Key Handover',
    description: 'Your assigned sales executive will greet you, walk you through the vehicle\'s features, and hand over the keys for your drive.',
    color: '#F59E0B',
    bgColor: '#FFFBEB',
  },
  {
    num: '05',
    icon: '🚗',
    title: 'Pre-Drive Inspection',
    description: 'Security will conduct a pre-drive inspection — documenting the current vehicle condition, fuel level, and odometer reading.',
    color: '#F97316',
    bgColor: '#FFF7ED',
  },
  {
    num: '06',
    icon: '🏁',
    title: 'Test Drive',
    description: 'Enjoy your test drive on the designated route! Experience the performance, comfort, technology, and feel of your potential new vehicle.',
    color: '#10B981',
    bgColor: '#ECFDF5',
  },
  {
    num: '07',
    icon: '🧾',
    title: 'Post-Drive Inspection',
    description: 'After returning, the security team will perform a post-drive inspection and compare notes, then mark all formalities as complete.',
    color: '#14B8A6',
    bgColor: '#F0FDFA',
  },
  {
    num: '08',
    icon: '✅',
    title: 'Journey Complete',
    description: 'Return the keys to your assigned sales person. They will complete your test drive journey and are happy to answer any questions about purchase options, financing, or your next steps.',
    color: '#059669',
    bgColor: '#ECFDF5',
  },
]

const TestDriveJourneyEmail = ({
  customerName,
  vehicleName,
  locationName,
  locationAddress,
  locationPhone,
  scheduledDate,
  scheduledTime,
  salesPersonName,
  feedbackLink,
  enquiryId,
  totalDurationMinutes,
}: TestDriveJourneyProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      Your complete test drive journey for {vehicleName || 'your vehicle'} — {SITE_NAME}
    </Preview>
    <Body style={main}>
      <Container style={container}>

        {/* Header */}
        <Section style={header}>
          <Text style={logoText}>🚗 {SITE_NAME}</Text>
          <Text style={headerTitle}>Your Test Drive Journey</Text>
          <Text style={headerSub}>
            Everything you need to know from start to finish
          </Text>
        </Section>

        {/* Greeting */}
        <Section style={section}>
          <Text style={greetingText}>
            Hi {customerName || 'there'},
          </Text>
          <Text style={bodyText}>
            We're excited to have you visit us for your test drive
            {vehicleName ? ` of the <strong>${vehicleName}</strong>` : ''}.
            Below is your complete journey guide — every step from arrival to completion,
            so you know exactly what to expect.
          </Text>
        </Section>

        {/* Appointment details box */}
        {(scheduledDate || locationName) && (
          <Section style={detailsBox}>
            <Text style={detailsTitle}>📅 Your Appointment</Text>
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
            {salesPersonName && (
              <Text style={detailRow}>
                <span style={detailLabel}>Your Sales Executive:</span> {salesPersonName}
              </Text>
            )}
            {totalDurationMinutes && (
              <Text style={detailRow}>
                <span style={detailLabel}>Showroom Completion Time:</span> {totalDurationMinutes} mins
              </Text>
            )}
            {enquiryId && (
              <Text style={detailRow}>
                <span style={detailLabel}>Enquiry ID:</span> {enquiryId}
              </Text>
            )}
          </Section>
        )}

        {/* Journey Steps */}
        <Section style={section}>
          <Text style={sectionTitle}>Complete Journey — 8 Steps</Text>

          {STEPS.map((step, idx) => (
            <Section key={step.num} style={{ ...stepCard, borderLeft: `4px solid ${step.color}`, backgroundColor: step.bgColor }}>
              <Row>
                <Column style={{ width: '44px', verticalAlign: 'top' }}>
                  <Text style={{ ...stepIcon, color: step.color }}>{step.icon}</Text>
                </Column>
                <Column style={{ verticalAlign: 'top', paddingLeft: '8px' }}>
                  <Text style={stepNum}>Step {step.num}</Text>
                  <Text style={{ ...stepTitle, color: step.color }}>{step.title}</Text>
                  <Text style={stepDesc}>{step.description}</Text>
                </Column>
              </Row>
              {/* Connector line between steps */}
              {idx < STEPS.length - 1 && (
                <Text style={stepConnector}>│</Text>
              )}
            </Section>
          ))}
        </Section>

        <Hr style={hr} />

        {feedbackLink && (
          <Section style={feedbackBox}>
            <Text style={feedbackTitle}>📝 Share Your Feedback</Text>
            <Text style={showroomText}>
              After your test drive, please share your experience. Your feedback helps us improve.
            </Text>
            <Section style={{ marginTop: '12px' }}>
              <a href={feedbackLink} style={feedbackButton}>Open Feedback Form</a>
            </Section>
          </Section>
        )}

        <Hr style={hr} />

        {/* Showroom details */}
        <Section style={showroomBox}>
          <Text style={showroomTitle}>🏢 Visit Our Showroom</Text>
          {locationName && (
            <Text style={showroomText}><strong>{locationName}</strong></Text>
          )}
          {locationAddress && (
            <Text style={showroomText}>📍 {locationAddress}</Text>
          )}
          {locationPhone && (
            <Text style={showroomText}>📞 {locationPhone}</Text>
          )}
          <Text style={showroomText}>
            Have questions about pricing, financing, or available variants?
            Your sales executive is happy to guide you through every option.
          </Text>
          <Text style={{ ...showroomText, color: '#F59E0B', fontWeight: '600' as const }}>
            ⭐ Explore Purchase & Finance Options with our team
          </Text>
        </Section>

        <Hr style={hr} />

        <Text style={footer}>
          This email was sent by <strong>{SITE_NAME}</strong> because you booked a test drive appointment.
          {locationPhone && ` Questions? Call us at ${locationPhone}.`}
          <br />
          We look forward to seeing you!
        </Text>

      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TestDriveJourneyEmail,
  subject: (data: Record<string, any>) =>
    `Your Test Drive Journey — ${data.vehicleName || 'Your Vehicle'} | ${SITE_NAME}`,
  displayName: 'Test drive journey',
  previewData: {
    customerName: 'Dheeraj',
    vehicleName: 'Kia Seltos HTX',
    locationName: 'Bangalore HSR Layout',
    locationAddress: '123 HSR Layout, Bangalore 560102',
    locationPhone: '+91 98765 43210',
    scheduledDate: '2026-04-05',
    scheduledTime: '11:00',
    salesPersonName: 'Rahul Sharma',
    currentStatus: 'scheduled',
    feedbackLink: 'https://example.com/test-drive-feedback?td=demo-id&enquiry_id=ENQ-1021',
    enquiryId: 'ENQ-1021',
    totalDurationMinutes: 58,
  },
} satisfies TemplateEntry

// Styles
const main = { backgroundColor: '#f8fafc', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '0', maxWidth: '600px', margin: '0 auto' }
const header = {
  background: 'linear-gradient(135deg, #0e2340 0%, #123b6e 100%)',
  padding: '32px 32px 28px',
  borderRadius: '12px 12px 0 0',
  textAlign: 'center' as const,
}
const logoText = { fontSize: '20px', fontWeight: '700' as const, color: '#93C5FD', margin: '0 0 12px' }
const headerTitle = { fontSize: '28px', fontWeight: '800' as const, color: '#FFFFFF', margin: '0 0 8px', lineHeight: '1.2' }
const headerSub = { fontSize: '15px', color: '#BFDBFE', margin: '0' }
const section = { padding: '24px 32px 0' }
const greetingText = { fontSize: '17px', fontWeight: '600' as const, color: '#0F172A', margin: '0 0 10px' }
const bodyText = { fontSize: '15px', color: '#475569', lineHeight: '1.7', margin: '0 0 20px' }
const detailsBox = {
  margin: '20px 32px 0',
  backgroundColor: '#F0F9FF',
  border: '1px solid #BAE6FD',
  borderRadius: '10px',
  padding: '16px 20px',
}
const detailsTitle = { fontSize: '13px', fontWeight: '700' as const, color: '#0369A1', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 10px' }
const detailRow = { fontSize: '14px', color: '#0F172A', lineHeight: '1.8', margin: '0' }
const detailLabel = { fontWeight: '600' as const, color: '#0369A1' }
const sectionTitle = { fontSize: '13px', fontWeight: '700' as const, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.1em', margin: '0 0 16px' }
const stepCard = {
  borderRadius: '10px',
  padding: '14px 16px',
  marginBottom: '4px',
}
const stepIcon = { fontSize: '22px', margin: '0', lineHeight: '1.4' }
const stepNum = { fontSize: '10px', fontWeight: '700' as const, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '0.1em', margin: '0 0 2px' }
const stepTitle = { fontSize: '15px', fontWeight: '700' as const, margin: '0 0 4px', lineHeight: '1.3' }
const stepDesc = { fontSize: '13px', color: '#475569', margin: '0', lineHeight: '1.6' }
const stepConnector = { fontSize: '16px', color: '#CBD5E1', margin: '0', textAlign: 'center' as const, padding: '0 0 0 20px' }
const hr = { borderColor: '#E2E8F0', margin: '24px 32px' }
const showroomBox = {
  margin: '0 32px',
  backgroundColor: '#FAFAFA',
  border: '1px solid #E2E8F0',
  borderRadius: '10px',
  padding: '16px 20px',
}
const showroomTitle = { fontSize: '13px', fontWeight: '700' as const, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.1em', margin: '0 0 10px' }
const showroomText = { fontSize: '14px', color: '#475569', lineHeight: '1.7', margin: '0 0 6px' }
const feedbackBox = {
  margin: '0 32px',
  backgroundColor: '#F0F9FF',
  border: '1px solid #BAE6FD',
  borderRadius: '10px',
  padding: '16px 20px',
  textAlign: 'center' as const,
}
const feedbackTitle = { fontSize: '13px', fontWeight: '700' as const, color: '#0369A1', textTransform: 'uppercase' as const, letterSpacing: '0.1em', margin: '0 0 10px' }
const feedbackButton = {
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: '700' as const,
  backgroundColor: '#0E2340',
  color: '#FFFFFF',
  padding: '10px 16px',
  borderRadius: '8px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#94A3B8', lineHeight: '1.6', margin: '20px 32px 32px', textAlign: 'center' as const }
