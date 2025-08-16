import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAgentZoneAssignment extends Document {
  agentId: mongoose.Types.ObjectId;
  zoneId: mongoose.Types.ObjectId;
  teamId?: mongoose.Types.ObjectId | null;
  effectiveFrom: Date;
  effectiveTo?: Date | null; // null means active
  status: 'ACTIVE' | 'INACTIVE';
  assignedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AgentZoneAssignmentSchema = new Schema<IAgentZoneAssignment>(
  {
    agentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    zoneId: { type: Schema.Types.ObjectId, ref: 'Zone', required: true, index: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', default: null, index: true },
    effectiveFrom: { type: Date, required: true, index: true },
    effectiveTo: { type: Date, default: null, index: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

AgentZoneAssignmentSchema.index({ agentId: 1, effectiveTo: 1 });
AgentZoneAssignmentSchema.index({ zoneId: 1, effectiveTo: 1 });
AgentZoneAssignmentSchema.index({ agentId: 1, status: 1 });

export const AgentZoneAssignment: Model<IAgentZoneAssignment> =
  mongoose.models.AgentZoneAssignment ||
  mongoose.model<IAgentZoneAssignment>('AgentZoneAssignment', AgentZoneAssignmentSchema);

export default AgentZoneAssignment;


