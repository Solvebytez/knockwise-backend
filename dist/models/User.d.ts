import mongoose, { Document, Model } from 'mongoose';
export type UserRole = 'SUPERADMIN' | 'SUBADMIN' | 'AGENT';
export interface IUser extends Document {
    name: string;
    email: string;
    username?: string;
    contactNumber?: string;
    password: string;
    originalPassword?: string;
    role: UserRole;
    status: 'ACTIVE' | 'INACTIVE';
    assignmentStatus: 'ASSIGNED' | 'UNASSIGNED';
    timezone?: string;
    primaryTeamId?: mongoose.Types.ObjectId | null;
    primaryZoneId?: mongoose.Types.ObjectId | null;
    teamIds: mongoose.Types.ObjectId[];
    zoneIds: mongoose.Types.ObjectId[];
    createdBy?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
    comparePassword(candidate: string): Promise<boolean>;
}
export declare const User: Model<IUser>;
export default User;
//# sourceMappingURL=User.d.ts.map