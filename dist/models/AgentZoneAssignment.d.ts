import mongoose, { Document, Model } from 'mongoose';
export interface IAgentZoneAssignment extends Document {
    agentId: mongoose.Types.ObjectId;
    zoneId: mongoose.Types.ObjectId;
    teamId?: mongoose.Types.ObjectId | null;
    effectiveFrom: Date;
    effectiveTo?: Date | null;
    createdById: mongoose.Types.ObjectId;
}
export declare const AgentZoneAssignment: Model<IAgentZoneAssignment>;
export default AgentZoneAssignment;
//# sourceMappingURL=AgentZoneAssignment.d.ts.map