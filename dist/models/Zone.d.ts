import mongoose, { Document, Model } from 'mongoose';
export interface IZone extends Document {
    name: string;
    description?: string;
    boundary: {
        type: 'Polygon';
        coordinates: number[][][];
    };
    buildingData?: {
        totalBuildings: number;
        residentialHomes: number;
        addresses: string[];
        coordinates: [number, number][];
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
    status?: 'DRAFT' | 'ACTIVE' | 'INACTIVE';
    createdBy?: mongoose.Types.ObjectId;
}
export declare const Zone: Model<IZone>;
export default Zone;
//# sourceMappingURL=Zone.d.ts.map