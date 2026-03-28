/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SalesFollowUpProps {
  customerName?: string
  message?: string
}

const SalesFollowUpEmail = ({ customerName = 'Customer', message = '' }: SalesFollowUpProps) => {
  return (
    <Html>
      <Head />
      <Preview>Follow-up from your TestDriveSync sales team</Preview>
      <Body style={{ margin: 0, padding: 0, backgroundColor: '#f7f8fa', fontFamily: 'Arial, sans-serif' }}>
        <Container style={{ maxWidth: '560px', margin: '24px auto', backgroundColor: '#ffffff', borderRadius: '10px', padding: '24px' }}>
          <Section>
            <Text style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: '0 0 12px' }}>
              Follow-up from TestDriveSync
            </Text>
            <Text style={{ fontSize: '14px', color: '#374151', lineHeight: '22px' }}>
              Hi {customerName},
            </Text>
            <Text style={{ fontSize: '14px', color: '#374151', lineHeight: '22px', whiteSpace: 'pre-wrap' }}>
              {message}
            </Text>
            <Text style={{ fontSize: '14px', color: '#374151', lineHeight: '22px' }}>
              Thank you,
              <br />
              Sales Team
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: SalesFollowUpEmail,
  subject: 'Follow-up from TestDriveSync',
  previewData: {
    customerName: 'John Doe',
    message: 'Thanks for your enquiry. We are sharing the next best slot for your test drive.',
  },
}
