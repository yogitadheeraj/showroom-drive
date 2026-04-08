import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Omni Tracely'

interface StaffWelcomeProps {
  staffName?: string
  role?: string
  locationName?: string
  loginEmail?: string
}

const StaffWelcomeEmail = ({
  staffName, role, locationName, loginEmail,
}: StaffWelcomeProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to {SITE_NAME} — your account is ready!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={logoText}>🚗 {SITE_NAME}</Text>
          <Text style={headerTitle}>Welcome to the Team!</Text>
          <Text style={headerSub}>Your account has been created</Text>
        </Section>

        <Section style={section}>
          <Text style={greetingText}>Hi {staffName || 'there'},</Text>
          <Text style={bodyText}>
            Welcome aboard! Your staff account on <strong>{SITE_NAME}</strong> has been set up and is ready to use.
          </Text>
        </Section>

        <Section style={detailsBox}>
          <Text style={detailsTitle}>🔑 Account Details</Text>
          {loginEmail && <Text style={detailRow}><span style={detailLabel}>Login Email:</span> {loginEmail}</Text>}
          {role && <Text style={detailRow}><span style={detailLabel}>Role:</span> {role}</Text>}
          {locationName && <Text style={detailRow}><span style={detailLabel}>Assigned Location:</span> {locationName}</Text>}
        </Section>

        <Section style={section}>
          <Text style={bodyText}>
            Your password was set by your manager. Please log in and change it at your earliest convenience.
            If you have any questions, reach out to your admin.
          </Text>
        </Section>

        <Hr style={hr} />
        <Text style={footer}>
          This email was sent by <strong>{SITE_NAME}</strong> because a staff account was created for you.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: StaffWelcomeEmail,
  subject: `Welcome to ${SITE_NAME} — Your Account is Ready`,
  displayName: 'Staff welcome',
  previewData: {
    staffName: 'Rahul Sharma',
    role: 'Sales',
    locationName: 'Bangalore HSR Layout',
    loginEmail: 'rahul@example.com',
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
const detailsBox = {
  margin: '0 32px',
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
