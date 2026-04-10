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
import { template as testDriveCompleted } from './test-drive-completed.tsx'
import { template as testDriveRescheduled } from './test-drive-rescheduled.tsx'
import { template as testDriveCancelled } from './test-drive-cancelled.tsx'
import { template as vehicleChangeNotification } from './vehicle-change-notification.tsx'
import { template as staffWelcome } from './staff-welcome.tsx'
import { template as demoRequestConfirmation } from './demo-request-confirmation.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'booking-confirmation': bookingConfirmation,
  'sales-follow-up': salesFollowUp,
  'test-drive-journey': testDriveJourney,
  'sales-assignment': salesAssignment,
  'test-drive-completed': testDriveCompleted,
  'test-drive-rescheduled': testDriveRescheduled,
  'test-drive-cancelled': testDriveCancelled,
  'vehicle-change-notification': vehicleChangeNotification,
  'staff-welcome': staffWelcome,
  'demo-request-confirmation': demoRequestConfirmation,
}
