import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPropertyData extends Document {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  // Zone Relationship
  zoneId?: mongoose.Types.ObjectId | null;
  // MLS Data
  mlsId?: string;
  mlsStatus?: 'ACTIVE' | 'SOLD' | 'PENDING' | 'WITHDRAWN';
  listPrice?: number;
  soldPrice?: number;
  soldDate?: Date;
  daysOnMarket?: number;
  // Homeowner Data
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  ownerMailingAddress?: string;
  // Property Details
  propertyType?: 'SINGLE_FAMILY' | 'MULTI_FAMILY' | 'CONDO' | 'TOWNHOUSE' | 'COMMERCIAL';
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  lotSize?: number;
  yearBuilt?: number;
  // Market Data
  estimatedValue?: number;
  lastAssessedValue?: number;
  taxAmount?: number;
  // Data Source
  dataSource: 'MLS' | 'PUBLIC_RECORDS' | 'THIRD_PARTY' | 'MANUAL';
  lastUpdated: Date;
  // Scoring
  leadScore?: number; // 1-100
  motivationScore?: number; // 1-100
  equityScore?: number; // 1-100
}

const PropertyDataSchema = new Schema<IPropertyData>(
  {
    addressLine1: { type: String, required: true, index: true },
    addressLine2: { type: String },
    city: { type: String, required: true, index: true },
    state: { type: String, required: true, index: true },
    postalCode: { type: String, required: true, index: true },
    location: {
      type: { type: String, enum: ['Point'], required: true },
      coordinates: { type: [Number], required: true },
    },
    mlsId: { type: String, index: true },
    mlsStatus: { type: String, enum: ['ACTIVE', 'SOLD', 'PENDING', 'WITHDRAWN'] },
    listPrice: { type: Number },
    soldPrice: { type: Number },
    soldDate: { type: Date },
    daysOnMarket: { type: Number },
    ownerName: { type: String, index: true },
    ownerPhone: { type: String },
    ownerEmail: { type: String, lowercase: true },
    ownerMailingAddress: { type: String },
    propertyType: { type: String, enum: ['SINGLE_FAMILY', 'MULTI_FAMILY', 'CONDO', 'TOWNHOUSE', 'COMMERCIAL'] },
    bedrooms: { type: Number },
    bathrooms: { type: Number },
    squareFootage: { type: Number },
    lotSize: { type: Number },
    yearBuilt: { type: Number },
    estimatedValue: { type: Number, index: true },
    lastAssessedValue: { type: Number },
    taxAmount: { type: Number },
    zoneId: { type: Schema.Types.ObjectId, ref: 'Zone', default: null, index: true },
    dataSource: { type: String, enum: ['MLS', 'PUBLIC_RECORDS', 'THIRD_PARTY', 'MANUAL'], required: true },
    lastUpdated: { type: Date, default: Date.now, index: true },
    leadScore: { type: Number, min: 1, max: 100, index: true },
    motivationScore: { type: Number, min: 1, max: 100 },
    equityScore: { type: Number, min: 1, max: 100 },
  },
  { timestamps: true }
);

PropertyDataSchema.index({ location: '2dsphere' });
PropertyDataSchema.index({ addressLine1: 1, city: 1, state: 1, postalCode: 1 }, { unique: true });

export const PropertyData: Model<IPropertyData> =
  mongoose.models.PropertyData || mongoose.model<IPropertyData>('PropertyData', PropertyDataSchema);

export default PropertyData;
