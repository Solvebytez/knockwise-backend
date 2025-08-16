import mongoose, { Document, Model } from 'mongoose';
export interface IZone extends Document {
    name: string;
    boundary: {
        type: 'Polygon';
        coordinates: number[][][];
    };
    assignedAgentId?: mongoose.Types.ObjectId | null;
    teamId?: mongoose.Types.ObjectId | null;
}
export declare const Zone: Model<IZone>;
export default Zone;
//# sourceMappingURL=Zone.d.ts.map