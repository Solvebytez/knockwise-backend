import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAgentTeamAssignment extends Document {
  agentId: mongoose.Types.ObjectId;
  teamId: mongoose.Types.ObjectId;
  effectiveFrom: Date;
  effectiveTo?: Date | null; // null means active
  status: 'ACTIVE' | 'INACTIVE';
  assignedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AgentTeamAssignmentSchema = new Schema<IAgentTeamAssignment>(
  {
    agentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    effectiveFrom: { type: Date, required: true, index: true },
    effectiveTo: { type: Date, default: null, index: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

AgentTeamAssignmentSchema.index({ agentId: 1, effectiveTo: 1 });
AgentTeamAssignmentSchema.index({ teamId: 1, effectiveTo: 1 });
AgentTeamAssignmentSchema.index({ agentId: 1, status: 1 });

export const AgentTeamAssignment: Model<IAgentTeamAssignment> =
  mongoose.models.AgentTeamAssignment ||
  mongoose.model<IAgentTeamAssignment>('AgentTeamAssignment', AgentTeamAssignmentSchema);

export default AgentTeamAssignment;
