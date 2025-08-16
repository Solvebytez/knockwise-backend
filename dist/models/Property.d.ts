import mongoose, { Document, Model } from 'mongoose';
export interface IProperty extends Document {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    location: {
        type: 'Point';
        coordinates: [number, number];
    };
    ownerName?: string;
    mlsId?: string;
    estimatedValue?: number;
    zoneId?: mongoose.Types.ObjectId | null;
}
export declare const Property: Model<IProperty>;
export default Property;
//# sourceMappingURL=Property.d.ts.map