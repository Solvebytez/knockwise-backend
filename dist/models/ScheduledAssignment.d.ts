import mongoose, { Document, Model } from 'mongoose';
export interface IScheduledAssignment extends Document {
    agentId?: mongoose.Types.ObjectId;
    teamId?: mongoose.Types.ObjectId;
    zoneId: mongoose.Types.ObjectId;
    scheduledDate: Date;
    effectiveFrom: Date;
    status: 'PENDING' | 'ACTIVATED' | 'CANCELLED' | 'COMPLETED' | 'SCHEDULED';
    assignedBy: mongoose.Types.ObjectId;
    notificationSent: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const ScheduledAssignment: Model<IScheduledAssignment>;
export default ScheduledAssignment;
//# sourceMappingURL=ScheduledAssignment.d.ts.map