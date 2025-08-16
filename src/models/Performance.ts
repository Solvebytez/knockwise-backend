import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPerformance extends Document {
  agentId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD
  totalVisits: number;
  totalDurationSeconds: number;
  appointments: number;
  leadsCreated: number;
}

const PerformanceSchema = new Schema<IPerformance>(
  {
    agentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true, index: true },
    totalVisits: { type: Number, default: 0 },
    totalDurationSeconds: { type: Number, default: 0 },
    appointments: { type: Number, default: 0 },
    leadsCreated: { type: Number, default: 0 },
  },
  { timestamps: true }
);

PerformanceSchema.index({ agentId: 1, date: 1 }, { unique: true });

export const Performance: Model<IPerformance> =
  mongoose.models.Performance || mongoose.model<IPerformance>('Performance', PerformanceSchema);

export default Performance;


