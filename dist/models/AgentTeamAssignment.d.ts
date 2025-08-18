import mongoose, { Document, Model } from 'mongoose';
export interface IAgentTeamAssignment extends Document {
    agentId: mongoose.Types.ObjectId;
    teamId: mongoose.Types.ObjectId;
    effectiveFrom: Date;
    effectiveTo?: Date | null;
    status: 'ACTIVE' | 'INACTIVE' | 'COMPLETED' | 'CANCELLED';
    assignedBy: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
export declare const AgentTeamAssignment: Model<IAgentTeamAssignment>;
export default AgentTeamAssignment;
//# sourceMappingURL=AgentTeamAssignment.d.ts.map