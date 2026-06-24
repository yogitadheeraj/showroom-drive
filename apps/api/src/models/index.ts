/**
 * Central export for all Mongoose models
 * Includes both legacy and new hierarchy models
 */

// Legacy Models
export { default as AgentConversation } from './AgentConversation.js';
export { default as Brand } from './Brand.js';
export { default as CarBooking } from './CarBooking.js';
export { default as Communication } from './Communication.js';
export { default as Customer } from './Customer.js';
export { default as DailyTestDriveReport } from './DailyTestDriveReport.js';
export { default as Dealer } from './Dealer.js';
export { default as DealerIntegration } from './DealerIntegration.js';
export { default as EmailQueue } from './EmailQueue.js';
export { default as EmailSendLog } from './EmailSendLog.js';
export { default as EmailSendState } from './EmailSendState.js';
export { default as EmailTemplateCustomization } from './EmailTemplateCustomization.js';
export { default as EmailUnsubscribeToken } from './EmailUnsubscribeToken.js';
export { default as FollowUpReminderConfig } from './FollowUpReminderConfig.js';
export { default as Location } from './Location.js';
export { default as LocationBlockedSlot } from './LocationBlockedSlot.js';
export { default as LocationOperatingHour } from './LocationOperatingHour.js';
export { default as LocationSpecialPeriod } from './LocationSpecialPeriod.js';
export { default as Notification } from './Notification.js';
export { default as Profile } from './Profile.js';
export { default as ReportAuditLog } from './ReportAuditLog.js';
export { default as ReportDispatchConfig } from './ReportDispatchConfig.js';
export { default as StaffActivityEvent } from './StaffActivityEvent.js';
export { default as StaffActivitySession } from './StaffActivitySession.js';
export { default as TestDrive } from './TestDrive.js';
export { default as TestDriveFeedback } from './TestDriveFeedback.js';
export { default as UserRole } from './UserRole.js';
export { default as Vehicle } from './Vehicle.js';
export { default as VehicleTransit } from './VehicleTransit.js';
export { default as VehicleTransitRequest } from './VehicleTransitRequest.js';

// New Hierarchy Models
export { default as Organization } from './Organization.js';
export { default as BrandNew } from './BrandNew.js';
export { default as BrandNewModel } from './BrandNewModel.js';
export { default as BusinessUnitBrand } from './BusinessUnitBrand.js';
export { default as SalesOffice } from './SalesOffice.js';
export { default as Plant } from './Plant.js';
export { default as LocationNew } from './LocationNew.js';
export { default as VehicleNew } from './VehicleNew.js';
export { default as LeadNew } from './LeadNew.js';
export { default as TestDriveNew } from './TestDriveNew.js';
export { default as RoleNew } from './RoleNew.js';
export { default as PermissionNew } from './PermissionNew.js';
export { default as RolePermissionNew } from './RolePermissionNew.js';
export { default as UserRoleAssignmentNew } from './UserRoleAssignmentNew.js';

// Audit & Advanced Features
export { default as HierarchyAuditLog } from './HierarchyAuditLog.js';
export { default as HierarchyWebhook } from './HierarchyWebhook.js';
export { default as HierarchyWebhookEvent } from './HierarchyWebhookEvent.js';
export { default as HierarchyReport } from './HierarchyReport.js';
