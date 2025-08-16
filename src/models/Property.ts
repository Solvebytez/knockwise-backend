import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IProperty extends Document {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  ownerName?: string;
  mlsId?: string;
  estimatedValue?: number;
  zoneId?: mongoose.Types.ObjectId | null;
}

const PropertySchema = new Schema<IProperty>(
  {
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true, index: true },
    location: {
      type: { type: String, enum: ['Point'], required: true },
      coordinates: { type: [Number], required: true },
    },
    ownerName: { type: String },
    mlsId: { type: String, index: true },
    estimatedValue: { type: Number },
    zoneId: { type: Schema.Types.ObjectId, ref: 'Zone', default: null, index: true },
  },
  { timestamps: true }
);

PropertySchema.index({ location: '2dsphere' });

export const Property: Model<IProperty> =
  mongoose.models.Property || mongoose.model<IProperty>('Property', PropertySchema);

export default Property;


