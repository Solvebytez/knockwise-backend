import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRefreshToken extends Document {
  userId: mongoose.Types.ObjectId;
  token: string;
  expiresAt: Date;
  createdByIp?: string;
  revokedAt?: Date | null;
  revokedByIp?: string | null;
  replacedByToken?: string | null;
}

const RefreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    createdByIp: { type: String },
    revokedAt: { type: Date, default: null },
    revokedByIp: { type: String, default: null },
    replacedByToken: { type: String, default: null },
  },
  { timestamps: true }
);

RefreshTokenSchema.index({ userId: 1, expiresAt: 1 });

export const RefreshToken: Model<IRefreshToken> =
  mongoose.models.RefreshToken || mongoose.model<IRefreshToken>('RefreshToken', RefreshTokenSchema);

export default RefreshToken;


