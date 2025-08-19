import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IZone extends Document {
  name: string;
  description?: string;
  boundary: {
    type: 'Polygon';
    coordinates: number[][][]; // GeoJSON polygon
  };
  buildingData?: {
    totalBuildings: number;
    residentialHomes: number;
    addresses: string[];
    coordinates: [number, number][]; // [lng, lat]
    houseNumbers: {
      odd: number[];
      even: number[];
    };
    houseStatuses?: {
      [address: string]: {
        status: 'not-visited' | 'interested' | 'visited' | 'callback' | 'appointment' | 'follow-up' | 'not-interested';
        notes?: string;
        phone?: string;
        email?: string;
        lastVisited?: Date;
        updatedBy?: mongoose.Types.ObjectId;
        updatedAt?: Date;
      };
    };
  };
  assignedAgentId?: mongoose.Types.ObjectId | null;
  teamId?: mongoose.Types.ObjectId | null;
  status?: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'SCHEDULED' | 'COMPLETED';
  createdBy?: mongoose.Types.ObjectId;
}

const ZoneSchema = new Schema<IZone>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    boundary: {
      type: { type: String, enum: ['Polygon'], required: true },
      coordinates: { type: [[[Number]]], required: true },
    },
    buildingData: {
      totalBuildings: { type: Number, default: 0 },
      residentialHomes: { type: Number, default: 0 },
      addresses: [{ type: String }],
      coordinates: [{ type: [Number] }], // [lng, lat]
      houseNumbers: {
        odd: [{ type: Number }],
        even: [{ type: Number }],
      },
      houseStatuses: { type: Map, of: {
        status: { 
          type: String, 
          enum: ['not-visited', 'interested', 'visited', 'callback', 'appointment', 'follow-up', 'not-interested'],
          default: 'not-visited'
        },
        notes: { type: String },
        phone: { type: String },
        email: { type: String },
        lastVisited: { type: Date },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        updatedAt: { type: Date, default: Date.now }
      }},
    },
    assignedAgentId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', default: null, index: true },
    status: { type: String, enum: ['DRAFT', 'ACTIVE', 'INACTIVE', 'SCHEDULED', 'COMPLETED'], default: 'DRAFT', index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Re-enable 2dsphere index now that polygon closure is fixed
ZoneSchema.index({ boundary: '2dsphere' });
ZoneSchema.index({ 'buildingData.houseNumbers.odd': 1 });
ZoneSchema.index({ 'buildingData.houseNumbers.even': 1 });

export const Zone: Model<IZone> = mongoose.models.Zone || mongoose.model<IZone>('Zone', ZoneSchema);

export default Zone;


