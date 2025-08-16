import { Document, Model } from 'mongoose';
export interface IPropertyData extends Document {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    location: {
        type: 'Point';
        coordinates: [number, number];
    };
    mlsId?: string;
    mlsStatus?: 'ACTIVE' | 'SOLD' | 'PENDING' | 'WITHDRAWN';
    listPrice?: number;
    soldPrice?: number;
    soldDate?: Date;
    daysOnMarket?: number;
    ownerName?: string;
    ownerPhone?: string;
    ownerEmail?: string;
    ownerMailingAddress?: string;
    propertyType?: 'SINGLE_FAMILY' | 'MULTI_FAMILY' | 'CONDO' | 'TOWNHOUSE' | 'COMMERCIAL';
    bedrooms?: number;
    bathrooms?: number;
    squareFootage?: number;
    lotSize?: number;
    yearBuilt?: number;
    estimatedValue?: number;
    lastAssessedValue?: number;
    taxAmount?: number;
    dataSource: 'MLS' | 'PUBLIC_RECORDS' | 'THIRD_PARTY' | 'MANUAL';
    lastUpdated: Date;
    leadScore?: number;
    motivationScore?: number;
    equityScore?: number;
}
export declare const PropertyData: Model<IPropertyData>;
export default PropertyData;
//# sourceMappingURL=PropertyData.d.ts.map