import mongoose, { Schema, Document, Model } from 'mongoose';

export type VisitResponse =
  | 'NO_ANSWER'
  | 'NOT_INTERESTED'
  | 'CALL_BACK'
  | 'APPOINTMENT_SET'
  | 'FOLLOW_UP'
  | 'LEAD_CREATED';

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

const ActivitySchema = new Schema<IActivity>(
  {
    agentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
    zoneId: { type: Schema.Types.ObjectId, ref: 'Zone', default: null, index: true },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, required: true },
    durationSeconds: { type: Number, required: true },
    response: {
      type: String,
      enum: ['NO_ANSWER', 'NOT_INTERESTED', 'CALL_BACK', 'APPOINTMENT_SET', 'FOLLOW_UP', 'LEAD_CREATED'],
      required: true,
      index: true,
    },
    notes: { type: String },
  },
  { timestamps: true }
);

ActivitySchema.index({ agentId: 1, startedAt: -1 });

export const Activity: Model<IActivity> =
  mongoose.models.Activity || mongoose.model<IActivity>('Activity', ActivitySchema);

export default Activity;


