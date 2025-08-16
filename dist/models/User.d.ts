import mongoose, { Document, Model } from 'mongoose';
export type UserRole = 'SUPERADMIN' | 'SUBADMIN' | 'AGENT';
export interface IUser extends Document {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    status: 'ACTIVE' | 'INACTIVE';
    teamId?: mongoose.Types.ObjectId | null;
    zoneId?: mongoose.Types.ObjectId | null;
    createdAt: Date;
    updatedAt: Date;
    comparePassword(candidate: string): Promise<boolean>;
}
export declare const User: Model<IUser>;
export default User;
//# sourceMappingURL=User.d.ts.map