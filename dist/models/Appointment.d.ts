import mongoose, { Document, Model } from 'mongoose';
export type AppointmentStatus = 'SCHEDULED' | 'RESCHEDULED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
export interface IAppointment extends Document {
    title?: string;
    agentId: mongoose.Types.ObjectId;
    createdById: mongoose.Types.ObjectId;
    propertyId?: mongoose.Types.ObjectId | null;
    leadId?: mongoose.Types.ObjectId | null;
    start: Date;
    end: Date;
    status: AppointmentStatus;
    notes?: string;
    teamId?: mongoose.Types.ObjectId | null;
}
export declare const Appointment: Model<IAppointment>;
export default Appointment;
//# sourceMappingURL=Appointment.d.ts.map