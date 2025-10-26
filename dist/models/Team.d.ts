import mongoose, { Document, Model } from 'mongoose';
export interface ITeam extends Document {
    name: string;
    description?: string;
    status: 'ACTIVE' | 'INACTIVE';
    assignmentStatus: 'ASSIGNED' | 'UNASSIGNED';
    createdBy: mongoose.Types.ObjectId;
    leaderId: mongoose.Types.ObjectId;
    agentIds: mongoose.Types.ObjectId[];
}
export declare const Team: Model<ITeam>;
export default Team;
//# sourceMappingURL=Team.d.ts.map