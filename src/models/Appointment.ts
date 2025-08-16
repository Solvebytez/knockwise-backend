import mongoose, { Schema, Document, Model } from 'mongoose';

export type AppointmentStatus = 'SCHEDULED' | 'RESCHEDULED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';

export interface IAppointment extends Document {
  title?: string;
  agentId: mongoose.Types.ObjectId;
  createdById: mongoose.Types.ObjectId; // who scheduled
  propertyId?: mongoose.Types.ObjectId | null;
  leadId?: mongoose.Types.ObjectId | null;
  start: Date;
  end: Date;
  status: AppointmentStatus;
  notes?: string;
  teamId?: mongoose.Types.ObjectId | null;
}

const AppointmentSchema = new Schema<IAppointment>(
  {
    title: { type: String },
    agentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property', default: null, index: true },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', default: null, index: true },
    start: { type: Date, required: true, index: true },
    end: { type: Date, required: true },
    status: { type: String, enum: ['SCHEDULED', 'RESCHEDULED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'], default: 'SCHEDULED', index: true },
    notes: { type: String },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', default: null, index: true },
  },
  { timestamps: true }
);

AppointmentSchema.index({ agentId: 1, start: 1 });

export const Appointment: Model<IAppointment> =
  mongoose.models.Appointment || mongoose.model<IAppointment>('Appointment', AppointmentSchema);

export default Appointment;


