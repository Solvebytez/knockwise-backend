import mongoose, { Document, Model } from 'mongoose';
export interface IPerformance extends Document {
    agentId: mongoose.Types.ObjectId;
    date: string;
    totalVisits: number;
    totalDurationSeconds: number;
    appointments: number;
    leadsCreated: number;
}
export declare const Performance: Model<IPerformance>;
export default Performance;
//# sourceMappingURL=Performance.d.ts.map