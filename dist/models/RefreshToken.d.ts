import mongoose, { Document, Model } from 'mongoose';
export interface IRefreshToken extends Document {
    userId: mongoose.Types.ObjectId;
    token: string;
    expiresAt: Date;
    createdByIp?: string;
    revokedAt?: Date | null;
    revokedByIp?: string | null;
    replacedByToken?: string | null;
}
export declare const RefreshToken: Model<IRefreshToken>;
export default RefreshToken;
//# sourceMappingURL=RefreshToken.d.ts.map