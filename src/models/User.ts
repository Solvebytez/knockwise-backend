import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'SUPERADMIN' | 'SUBADMIN' | 'AGENT';

export interface IUser extends Document {
  name: string;
  email: string;
  username?: string;
  contactNumber?: string;
  password: string;
  originalPassword?: string; // Store original password for admin viewing
  role: UserRole;
  status: 'ACTIVE' | 'INACTIVE';
  assignmentStatus: 'ASSIGNED' | 'UNASSIGNED'; // New field for zone assignment status
  timezone?: string; // User's preferred timezone
  // Primary assignments (for backward compatibility and main assignment)
  primaryTeamId?: mongoose.Types.ObjectId | null;
  primaryZoneId?: mongoose.Types.ObjectId | null;
  // Multiple assignments
  teamIds: mongoose.Types.ObjectId[];
  zoneIds: mongoose.Types.ObjectId[];
  // Track who created this user
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    username: { type: String, trim: true, sparse: true },
    contactNumber: { type: String, trim: true },
    password: { type: String, required: true, select: false },
    originalPassword: { type: String, select: false }, // Add originalPassword field
    role: { type: String, enum: ['SUPERADMIN', 'SUBADMIN', 'AGENT'], required: true, index: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
    assignmentStatus: { type: String, enum: ['ASSIGNED', 'UNASSIGNED'], default: 'UNASSIGNED' },
    timezone: { type: String, default: 'America/New_York' }, // Default timezone
    // Primary assignments (for backward compatibility)
    primaryTeamId: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    primaryZoneId: { type: Schema.Types.ObjectId, ref: 'Zone', default: null },
    // Multiple assignments
    teamIds: [{ type: Schema.Types.ObjectId, ref: 'Team' }],
    zoneIds: [{ type: Schema.Types.ObjectId, ref: 'Zone' }],
    // Track who created this user
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

UserSchema.index({ role: 1, status: 1 });
UserSchema.index({ teamIds: 1 });
UserSchema.index({ zoneIds: 1 });
UserSchema.index({ createdBy: 1 });

UserSchema.pre('save', async function hashPassword(next) {
  const user = this as IUser;
  if (!user.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(user.password, salt);
  next();
});

UserSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  const user = this as IUser;
  return bcrypt.compare(candidate, user.password);
};

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;


