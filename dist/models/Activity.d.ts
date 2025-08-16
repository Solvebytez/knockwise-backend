import mongoose, { Document, Model } from 'mongoose';
export type VisitResponse = 'NO_ANSWER' | 'NOT_INTERESTED' | 'CALL_BACK' | 'APPOINTMENT_SET' | 'FOLLOW_UP' | 'LEAD_CREATED';
export interface IActivity extends Document {
    agentId: mongoose.Types.ObjectId;
    propertyId: mongoose.Types.ObjectId;
    zoneId?: mongoose.Types.ObjectId | null;
    startedAt: Date;
    endedAt: Date;
    durationSeconds: number;
    response: VisitResponse;
    notes?: string;
}
export declare const Activity: Model<IActivity>;
export default Activity;
//# sourceMappingURL=Activity.d.ts.map