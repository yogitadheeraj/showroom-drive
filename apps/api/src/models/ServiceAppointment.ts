import mongoose, { Document, Schema } from 'mongoose';

export type ServiceAppointmentStatus =
  | 'booked'
  | 'confirmed'
  | 'in_progress'
  | 'ready_for_delivery'
  | 'completed'
  | 'cancelled'
  | 'rescheduled';

export type ServicePaymentStatus = 'pending' | 'partial' | 'paid';

export interface IServiceVehicleDetails {
  registration_number: string;
  brand: string;
  model: string;
  variant: string | null;
  year: number | null;
  color: string | null;
}

export interface IServiceProgressEvent {
  step: string;
  note: string | null;
  updated_by_profile_id: string | null;
  created_at: string;
}

export interface IServiceAppointment extends Document {
  id: string;
  appointment_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  preferred_contact: string;
  location_id: string;
  package_code: string;
  package_name: string;
  package_price: number;
  duration_minutes: number;
  appointment_date: string;
  appointment_time: string;
  slot_end_time: string;
  status: ServiceAppointmentStatus;
  progress_step: string;
  payment_status: ServicePaymentStatus;
  assigned_service_expert_profile_id: string | null;
  cancel_reason: string | null;
  reschedule_reason: string | null;
  original_appointment_date: string | null;
  original_appointment_time: string | null;
  vehicle: IServiceVehicleDetails;
  progress_history: IServiceProgressEvent[];
  source: string;
  created_at: string;
  updated_at: string;
}

const ServiceVehicleSchema = new Schema<IServiceVehicleDetails>(
  {
    registration_number: { type: String, required: true },
    brand: { type: String, required: true },
    model: { type: String, required: true },
    variant: { type: String, default: null },
    year: { type: Number, default: null },
    color: { type: String, default: null },
  },
  { _id: false },
);

const ServiceProgressEventSchema = new Schema<IServiceProgressEvent>(
  {
    step: { type: String, required: true },
    note: { type: String, default: null },
    updated_by_profile_id: { type: String, default: null },
    created_at: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false },
);

const ServiceAppointmentSchema = new Schema<IServiceAppointment>(
  {
    id: { type: String, required: true, unique: true, index: true },
    appointment_number: { type: String, required: true, unique: true, index: true },
    customer_id: { type: String, default: null, index: true },
    customer_name: { type: String, required: true },
    customer_phone: { type: String, required: true, index: true },
    customer_email: { type: String, default: null, index: true },
    preferred_contact: { type: String, default: 'phone' },
    location_id: { type: String, required: true, index: true },
    package_code: { type: String, required: true, index: true },
    package_name: { type: String, required: true },
    package_price: { type: Number, required: true },
    duration_minutes: { type: Number, required: true },
    appointment_date: { type: String, required: true, index: true },
    appointment_time: { type: String, required: true, index: true },
    slot_end_time: { type: String, required: true },
    status: {
      type: String,
      enum: ['booked', 'confirmed', 'in_progress', 'ready_for_delivery', 'completed', 'cancelled', 'rescheduled'],
      default: 'booked',
      index: true,
    },
    progress_step: { type: String, default: 'booked' },
    payment_status: {
      type: String,
      enum: ['pending', 'partial', 'paid'],
      default: 'pending',
      index: true,
    },
    assigned_service_expert_profile_id: { type: String, default: null, index: true },
    cancel_reason: { type: String, default: null },
    reschedule_reason: { type: String, default: null },
    original_appointment_date: { type: String, default: null },
    original_appointment_time: { type: String, default: null },
    vehicle: { type: ServiceVehicleSchema, required: true },
    progress_history: { type: [ServiceProgressEventSchema], default: [] },
    source: { type: String, default: 'online' },
    created_at: { type: String, default: () => new Date().toISOString(), index: true },
    updated_at: { type: String, default: () => new Date().toISOString() },
  },
  { collection: 'service_appointments', versionKey: false },
);

ServiceAppointmentSchema.pre('save', function (next) {
  this.updated_at = new Date().toISOString();
  next();
});

ServiceAppointmentSchema.index({
  customer_phone: 1,
  'vehicle.registration_number': 1,
  appointment_date: 1,
  appointment_time: 1,
});

export const ServiceAppointment =
  (mongoose.models['ServiceAppointment'] as mongoose.Model<IServiceAppointment>) ||
  mongoose.model<IServiceAppointment>('ServiceAppointment', ServiceAppointmentSchema);
