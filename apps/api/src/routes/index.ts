import express from 'express';
import multer from 'multer';
import { dbQueryController } from '../controllers/dbController.js';
import { invokeFunctionController } from '../controllers/functionsController.js';
import { rpcController } from '../controllers/rpcController.js';
import {
  listController,
  publicUrlController,
  removeController,
  signedUrlController,
  uploadController,
} from '../controllers/storageController.js';
import { meController, resendVerificationController } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import {
  createLocationController,
  deleteLocationController,
  getLocationController,
  getLocationsController,
  updateLocationController,
} from '../controllers/locationController.js';
import {
  createBrandController,
  deleteBrandController,
  getBrandController,
  getBrandsController,
  updateBrandController,
} from '../controllers/brandController.js';
import {
  createLocationSpecialPeriodController,
  deleteLocationSpecialPeriodController,
  getLocationSpecialPeriodController,
  listLocationSpecialPeriodsController,
  updateLocationSpecialPeriodController,
} from '../controllers/locationSpecialPeriodController.js';
import {
  bulkUpsertLocationOperatingHoursController,
  createLocationOperatingHourController,
  deleteLocationOperatingHourController,
  getLocationOperatingHourController,
  listLocationOperatingHoursController,
  updateLocationOperatingHourController,
} from '../controllers/locationOperatingHourController.js';
import {
  createTestDriveController,
  deleteTestDriveController,
  getTestDriveController,
  getTestDrivesController,
  updateTestDriveController,
} from '../controllers/testDriveController.js';
import {
  createDealerController,
  deleteDealerController,
  getDealerController,
  listDealersController,
  updateDealerController,
} from '../controllers/dealerController.js';
import {
  getMyProfileController,
  getProfileController,
  listProfilesController,
  updateProfileController,
  upsertProfileController,
} from '../controllers/profileController.js';
import {
  deleteRoleController,
  getRoleController,
  listRolesController,
  upsertRoleController,
} from '../controllers/userRoleController.js';
import {
  createCustomerController,
  getCustomerController,
  listCustomersController,
  updateCustomerController,
} from '../controllers/customerController.js';
import {
  createVehicleController,
  deleteVehicleController,
  getVehicleController,
  listVehiclesController,
  updateVehicleController,
} from '../controllers/vehicleController.js';
import {
  endSessionController,
  listEventsController,
  listOnlineSessionsController,
  logEventController,
  startSessionController,
  touchSessionController,
} from '../controllers/activityController.js';
import {
  createCommunicationController,
  listCommunicationsController,
  updateCommunicationStatusController,
} from '../controllers/communicationController.js';
import {
  listNotificationsController,
  markAllReadController,
  markReadController,
  unreadCountController,
} from '../controllers/notificationController.js';
import {
  deleteFollowUpReminderConfigController,
  getFollowUpReminderConfigController,
  listFollowUpReminderConfigsController,
  upsertFollowUpReminderConfigController,
} from '../controllers/followUpReminderConfigController.js';
import {
  createUserController,
  deleteUserController,
  disableUserController,
  enableUserController,
  getUserController,
  sendTestDriveNotificationController,
  setCustomClaimsController,
  updateUserController,
} from '../controllers/firebaseController.js';

const upload = multer({ storage: multer.memoryStorage() });

export const apiRouter = express.Router();

// Generic DB query (fallback for all other collections)
apiRouter.post('/db/query', dbQueryController);
apiRouter.post('/functions/:name', invokeFunctionController);
apiRouter.post('/rpc/:name', rpcController);

// Storage
apiRouter.post('/storage/:bucket/upload', upload.single('file'), uploadController);
apiRouter.get('/storage/:bucket/list', listController);
apiRouter.post('/storage/:bucket/public-url', publicUrlController);
apiRouter.post('/storage/:bucket/signed-url', signedUrlController);
apiRouter.post('/storage/:bucket/remove', removeController);

// Auth
apiRouter.get('/auth/me', requireAuth, meController);
apiRouter.post('/auth/resend-verification', resendVerificationController);

// Locations
apiRouter.get('/locations', getLocationsController);
apiRouter.get('/locations/:id', getLocationController);
apiRouter.post('/locations', requireAuth, createLocationController);
apiRouter.patch('/locations/:id', requireAuth, updateLocationController);
apiRouter.delete('/locations/:id', requireAuth, deleteLocationController);

// Brands
apiRouter.get('/brands', getBrandsController);
apiRouter.get('/brands/:id', getBrandController);
apiRouter.post('/brands', requireAuth, createBrandController);
apiRouter.patch('/brands/:id', requireAuth, updateBrandController);
apiRouter.delete('/brands/:id', requireAuth, deleteBrandController);

// Location Special Periods
apiRouter.get('/location-special-periods', listLocationSpecialPeriodsController);
apiRouter.get('/location-special-periods/:id', getLocationSpecialPeriodController);
apiRouter.post('/location-special-periods', requireAuth, createLocationSpecialPeriodController);
apiRouter.patch('/location-special-periods/:id', requireAuth, updateLocationSpecialPeriodController);
apiRouter.delete('/location-special-periods/:id', requireAuth, deleteLocationSpecialPeriodController);

// Location Operating Hours
apiRouter.get('/location-operating-hours', listLocationOperatingHoursController);
apiRouter.get('/location-operating-hours/:id', getLocationOperatingHourController);
apiRouter.post('/location-operating-hours', requireAuth, createLocationOperatingHourController);
apiRouter.patch('/location-operating-hours/:id', requireAuth, updateLocationOperatingHourController);
apiRouter.delete('/location-operating-hours/:id', requireAuth, deleteLocationOperatingHourController);
apiRouter.post('/location-operating-hours/bulk-upsert', requireAuth, bulkUpsertLocationOperatingHoursController);

// Test Drives
apiRouter.get('/test-drives', requireAuth, getTestDrivesController);
apiRouter.get('/test-drives/:id', requireAuth, getTestDriveController);
apiRouter.post('/test-drives', requireAuth, createTestDriveController);
apiRouter.patch('/test-drives/:id', requireAuth, updateTestDriveController);
apiRouter.delete('/test-drives/:id', requireAuth, deleteTestDriveController);

// Dealers
apiRouter.get('/dealers', listDealersController);
apiRouter.get('/dealers/:id', getDealerController);
apiRouter.post('/dealers', requireAuth, createDealerController);
apiRouter.patch('/dealers/:id', requireAuth, updateDealerController);
apiRouter.delete('/dealers/:id', requireAuth, deleteDealerController);

// Profiles
apiRouter.get('/profiles/me', requireAuth, getMyProfileController);
apiRouter.get('/profiles', requireAuth, listProfilesController);
apiRouter.get('/profiles/:id', requireAuth, getProfileController);
apiRouter.post('/profiles', requireAuth, upsertProfileController);
apiRouter.patch('/profiles/:id', requireAuth, updateProfileController);

// User Roles
apiRouter.get('/user-roles', requireAuth, listRolesController);
apiRouter.get('/user-roles/:userId', requireAuth, getRoleController);
apiRouter.post('/user-roles', requireAuth, upsertRoleController);
apiRouter.delete('/user-roles/:userId', requireAuth, deleteRoleController);

// Customers
apiRouter.get('/customers', requireAuth, listCustomersController);
apiRouter.get('/customers/:id', requireAuth, getCustomerController);
apiRouter.post('/customers', requireAuth, createCustomerController);
apiRouter.patch('/customers/:id', requireAuth, updateCustomerController);

// Vehicles
apiRouter.get('/vehicles', listVehiclesController);
apiRouter.get('/vehicles/:id', getVehicleController);
apiRouter.post('/vehicles', requireAuth, createVehicleController);
apiRouter.patch('/vehicles/:id', requireAuth, updateVehicleController);
apiRouter.delete('/vehicles/:id', requireAuth, deleteVehicleController);

// Activity Events
apiRouter.get('/activity/events', requireAuth, listEventsController);
apiRouter.post('/activity/events', requireAuth, logEventController);

// Activity Sessions
apiRouter.get('/activity/sessions/online', requireAuth, listOnlineSessionsController);
apiRouter.post('/activity/sessions', requireAuth, startSessionController);
apiRouter.patch('/activity/sessions/:id/touch', requireAuth, touchSessionController);
apiRouter.patch('/activity/sessions/:id/end', requireAuth, endSessionController);

// Communications
apiRouter.get('/communications', requireAuth, listCommunicationsController);
apiRouter.post('/communications', requireAuth, createCommunicationController);
apiRouter.patch('/communications/:id/status', requireAuth, updateCommunicationStatusController);

// Notifications
apiRouter.get('/notifications', requireAuth, listNotificationsController);
apiRouter.get('/notifications/unread-count', requireAuth, unreadCountController);
apiRouter.patch('/notifications/:id/read', requireAuth, markReadController);
apiRouter.post('/notifications/mark-all-read', requireAuth, markAllReadController);

// Follow-up Reminder Config
apiRouter.get('/follow-up-reminder-config', requireAuth, listFollowUpReminderConfigsController);
apiRouter.get('/follow-up-reminder-config/:locationId', requireAuth, getFollowUpReminderConfigController);
apiRouter.put('/follow-up-reminder-config', requireAuth, upsertFollowUpReminderConfigController);
apiRouter.delete('/follow-up-reminder-config/:locationId', requireAuth, deleteFollowUpReminderConfigController);

// Firebase Admin – User Management
apiRouter.post('/firebase/users', requireAuth, createUserController);
apiRouter.get('/firebase/users/:uid', requireAuth, getUserController);
apiRouter.patch('/firebase/users/:uid', requireAuth, updateUserController);
apiRouter.patch('/firebase/users/:uid/disable', requireAuth, disableUserController);
apiRouter.patch('/firebase/users/:uid/enable', requireAuth, enableUserController);
apiRouter.delete('/firebase/users/:uid', requireAuth, deleteUserController);
apiRouter.post('/firebase/users/:uid/claims', requireAuth, setCustomClaimsController);

// Firebase – Test Drive Notifications
apiRouter.post('/firebase/notify/test-drive', requireAuth, sendTestDriveNotificationController);

