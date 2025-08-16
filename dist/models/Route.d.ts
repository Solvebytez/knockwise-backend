import mongoose, { Document, Model } from 'mongoose';
export interface IRouteStop {
    propertyId: mongoose.Types.ObjectId;
    order: number;
    estimatedDuration: number;
    notes?: string;
    status?: 'PENDING' | 'COMPLETED' | 'SKIPPED' | 'RESCHEDULED';
    actualDuration?: number;
    completedAt?: Date;
}
export interface IRouteOptimizationSettings {
    maxStops: number;
    maxDistance: number;
    preferredTimeWindow: {
        start: string;
        end: string;
    };
    optimizationType: 'FASTEST' | 'SHORTEST' | 'BALANCED';
    avoidFerries: boolean;
    avoidHighways: boolean;
    avoidTolls: boolean;
    avoidTraffic: boolean;
    startFromOffice: boolean;
    returnToOffice: boolean;
}
export interface IRouteAnalytics {
    totalStops: number;
    completedStops: number;
    skippedStops: number;
    totalDistance: number;
    actualDistance?: number;
    estimatedDuration: number;
    actualDuration?: number;
    startTime?: Date;
    endTime?: Date;
    efficiency: number;
    completionRate: number;
}
export interface IRouteSharing {
    sharedWith: mongoose.Types.ObjectId[];
    sharedBy: mongoose.Types.ObjectId;
    sharedAt: Date;
    permissions: 'VIEW' | 'EDIT' | 'ADMIN';
}
export interface IRoute extends Document {
    name: string;
    description?: string;
    agentId: mongoose.Types.ObjectId;
    zoneId?: mongoose.Types.ObjectId | null;
    teamId?: mongoose.Types.ObjectId | null;
    date: Date;
    stops: IRouteStop[];
    totalDistance: number;
    totalDuration: number;
    status: 'DRAFT' | 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    startLocation?: {
        type: 'Point';
        coordinates: [number, number];
        address?: string;
    };
    endLocation?: {
        type: 'Point';
        coordinates: [number, number];
        address?: string;
    };
    optimizationSettings: IRouteOptimizationSettings;
    analytics: IRouteAnalytics;
    sharing?: IRouteSharing;
    tags?: string[];
    isTemplate: boolean;
    templateName?: string;
    parentRouteId?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Route: Model<IRoute>;
export default Route;
//# sourceMappingURL=Route.d.ts.map