import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITeam extends Document {
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  assignmentStatus: 'ASSIGNED' | 'UNASSIGNED'; // New field for zone assignment status
  createdBy: mongoose.Types.ObjectId; // owner (superadmin or subadmin)
  leaderId: mongoose.Types.ObjectId; // team leader
  agentIds: mongoose.Types.ObjectId[]; // agents in team
}

const TeamSchema = new Schema<ITeam>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'INACTIVE', index: true },
    assignmentStatus: { type: String, enum: ['ASSIGNED', 'UNASSIGNED'], default: 'UNASSIGNED', index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    leaderId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    agentIds: [{ type: Schema.Types.ObjectId, ref: 'User', index: true }],
  },
  { timestamps: true }
);

TeamSchema.index({ createdBy: 1, leaderId: 1 });

export const Team: Model<ITeam> = mongoose.models.Team || mongoose.model<ITeam>('Team', TeamSchema);

export default Team;


