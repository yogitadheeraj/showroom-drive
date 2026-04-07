/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as bookingConfirmation } from './booking-confirmation.tsx'
import { template as salesFollowUp } from './sales-follow-up.tsx'
import { template as testDriveJourney } from './test-drive-journey.tsx'
import { template as salesAssignment } from './sales-assignment.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'booking-confirmation': bookingConfirmation,
  'sales-follow-up': salesFollowUp,
  'test-drive-journey': testDriveJourney,
  'sales-assignment': salesAssignment,
}
