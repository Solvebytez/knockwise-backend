import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IZone extends Document {
  name: string;
  boundary: {
    type: 'Polygon';
    coordinates: number[][][]; // GeoJSON polygon
  };
  assignedAgentId?: mongoose.Types.ObjectId | null;
  teamId?: mongoose.Types.ObjectId | null;
}

const ZoneSchema = new Schema<IZone>(
  {
    name: { type: String, required: true, trim: true },
    boundary: {
      type: { type: String, enum: ['Polygon'], required: true },
      coordinates: { type: [[[Number]]], required: true },
    },
    assignedAgentId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', default: null, index: true },
  },
  { timestamps: true }
);

ZoneSchema.index({ boundary: '2dsphere' });

export const Zone: Model<IZone> = mongoose.models.Zone || mongoose.model<IZone>('Zone', ZoneSchema);

export default Zone;


