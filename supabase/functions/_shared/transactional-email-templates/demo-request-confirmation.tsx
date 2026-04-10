import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "AutoAdvant"

interface DemoRequestProps {
  name?: string
  email?: string
  company?: string
  phone?: string
  message?: string
}

const DemoRequestConfirmationEmail = ({ name, email, company, phone, message }: DemoRequestProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Thank you for requesting a demo of {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={h1}>🚗 Demo Request Received</Heading>
        </Section>

        <Text style={text}>
          {name ? `Hi ${name},` : 'Hi there,'}
        </Text>
        <Text style={text}>
          Thank you for your interest in <strong>{SITE_NAME}</strong>! We've received your demo request and our team will get back to you within 24 hours to schedule a personalized walkthrough.
        </Text>

        <Section style={detailsBox}>
          <Text style={detailsTitle}>Your Request Details:</Text>
          {name && <Text style={detailItem}>👤 Name: {name}</Text>}
          {email && <Text style={detailItem}>✉️ Email: {email}</Text>}
          {company && <Text style={detailItem}>🏢 Company: {company}</Text>}
          {phone && <Text style={detailItem}>📞 Phone: {phone}</Text>}
          {message && <Text style={detailItem}>💬 Message: {message}</Text>}
        </Section>

        <Text style={text}>
          In the meantime, here's what you can expect from your demo:
        </Text>

        <Section style={bulletSection}>
          <Text style={bulletItem}>✅ Complete platform walkthrough tailored to your dealership needs</Text>
          <Text style={bulletItem}>✅ Live demonstration of test drive management & lead tracking</Text>
          <Text style={bulletItem}>✅ Pricing and onboarding discussion</Text>
          <Text style={bulletItem}>✅ Q&A with our product specialist</Text>
        </Section>

        <Hr style={hr} />

        <Text style={footer}>
          Best regards,<br />
          The {SITE_NAME} Team
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: DemoRequestConfirmationEmail,
  subject: (data: Record<string, any>) =>
    data?.name
      ? `${data.name}, your AutoAdvant demo request is confirmed!`
      : 'Your AutoAdvant demo request is confirmed!',
  displayName: 'Demo Request Confirmation',
  previewData: { name: 'John Smith', email: 'john@dealer.com', company: 'City Motors', phone: '+1 555-0123', message: 'Interested in the full DMS platform' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Segoe UI', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const headerSection = { textAlign: 'center' as const, marginBottom: '24px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0369a1', margin: '0 0 8px', textAlign: 'center' as const }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 16px' }
const detailsBox = { backgroundColor: '#f0f9ff', borderRadius: '12px', padding: '20px', margin: '16px 0 24px', border: '1px solid #bae6fd' }
const detailsTitle = { fontSize: '14px', fontWeight: 'bold' as const, color: '#0c4a6e', margin: '0 0 12px' }
const detailItem = { fontSize: '14px', color: '#334155', margin: '0 0 6px', lineHeight: '1.5' }
const bulletSection = { margin: '0 0 24px' }
const bulletItem = { fontSize: '14px', color: '#334155', margin: '0 0 8px', lineHeight: '1.5' }
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const footer = { fontSize: '13px', color: '#94a3b8', margin: '0' }
