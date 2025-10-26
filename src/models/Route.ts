import mongoose, { Schema, Document, Model } from "mongoose";

export interface IRouteStop {
  propertyId?: mongoose.Types.ObjectId; // Optional for address-based stops
  address?: string; // For address-based stops (not linked to PropertyData)
  order: number;
  estimatedDuration: number; // minutes
  notes?: string;
  status?: "PENDING" | "COMPLETED" | "SKIPPED" | "RESCHEDULED";
  actualDuration?: number; // minutes
  completedAt?: Date;
}

export interface IRouteOptimizationSettings {
  maxStops: number;
  maxDistance: number; // miles
  preferredTimeWindow: {
    start: string; // HH:MM
    end: string; // HH:MM
  };
  optimizationType: "FASTEST" | "SHORTEST" | "BALANCED";
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
  totalDistance: number; // miles
  actualDistance?: number; // miles
  estimatedDuration: number; // minutes
  actualDuration?: number; // minutes
  startTime?: Date;
  endTime?: Date;
  efficiency: number; // percentage
  completionRate: number; // percentage
}

export interface IRouteSharing {
  sharedWith: mongoose.Types.ObjectId[];
  sharedBy: mongoose.Types.ObjectId;
  sharedAt: Date;
  permissions: "VIEW" | "EDIT" | "ADMIN";
}

export interface IRouteStep {
  instruction: string;
  distance: number; // meters
  duration: number; // seconds
  startLocation: [number, number]; // [lng, lat]
  endLocation: [number, number]; // [lng, lat]
  maneuver?: string;
  polyline?: string;
}

export interface IRouteLeg {
  startAddress: string;
  endAddress: string;
  startLocation: [number, number]; // [lng, lat]
  endLocation: [number, number]; // [lng, lat]
  distance: number; // meters
  duration: number; // seconds
  steps: IRouteStep[];
}

export interface IRouteAlternative {
  summary: string;
  distance: number; // miles
  duration: number; // minutes
  trafficCondition?: string;
  legs: IRouteLeg[];
  overviewPolyline?: string;
  warnings?: string[];
  waypointOrder?: number[];
}

export interface IRouteDetails {
  selectedAlternativeIndex: number; // Which route was chosen (0, 1, 2, etc.)
  alternatives: IRouteAlternative[]; // All available route options
  bounds?: {
    northeast: [number, number]; // [lng, lat]
    southwest: [number, number]; // [lng, lat]
  };
  copyrights?: string;
  calculatedAt: Date; // When the route was calculated
}

export interface IRoute extends Document {
  name: string;
  description?: string;
  agentId: mongoose.Types.ObjectId;
  zoneId?: mongoose.Types.ObjectId | null;
  teamId?: mongoose.Types.ObjectId | null;
  date: Date;
  stops: IRouteStop[];
  totalDistance: number; // miles
  totalDuration: number; // minutes
  status:
    | "DRAFT"
    | "PLANNED"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "CANCELLED"
    | "ARCHIVED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  startLocation?: {
    type: "Point";
    coordinates: [number, number];
    address?: string;
  };
  endLocation?: {
    type: "Point";
    coordinates: [number, number];
    address?: string;
  };
  optimizationSettings: IRouteOptimizationSettings;
  analytics: IRouteAnalytics;
  sharing?: IRouteSharing;
  routeDetails?: IRouteDetails; // Detailed turn-by-turn directions and alternatives
  tags?: string[];
  isTemplate: boolean;
  templateName?: string;
  parentRouteId?: mongoose.Types.ObjectId; // for duplicated routes
  createdAt: Date;
  updatedAt: Date;
}

const RouteStopSchema = new Schema<IRouteStop>(
  {
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: "PropertyData",
      required: false, // Optional for address-based stops
    },
    address: {
      type: String,
      required: false, // For address-based stops (not linked to PropertyData)
    },
    order: { type: Number, required: true },
    estimatedDuration: { type: Number, required: true, default: 15 }, // 15 minutes default
    notes: { type: String },
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "SKIPPED", "RESCHEDULED"],
      default: "PENDING",
    },
    actualDuration: { type: Number },
    completedAt: { type: Date },
  },
  { _id: false }
);

// Validation: Either propertyId or address must be provided
RouteStopSchema.pre("validate", function (next) {
  if (!this.propertyId && !this.address) {
    return next(new Error("Either propertyId or address must be provided"));
  }
  next();
});

const RouteOptimizationSettingsSchema = new Schema<IRouteOptimizationSettings>(
  {
    maxStops: { type: Number, default: 50 },
    maxDistance: { type: Number, default: 25 }, // miles
    preferredTimeWindow: {
      start: { type: String, default: "09:00" },
      end: { type: String, default: "17:00" },
    },
    optimizationType: {
      type: String,
      enum: ["FASTEST", "SHORTEST", "BALANCED"],
      default: "FASTEST",
    },
    avoidFerries: { type: Boolean, default: false },
    avoidHighways: { type: Boolean, default: false },
    avoidTolls: { type: Boolean, default: false },
    avoidTraffic: { type: Boolean, default: true },
    startFromOffice: { type: Boolean, default: true },
    returnToOffice: { type: Boolean, default: true },
  },
  { _id: false }
);

const RouteAnalyticsSchema = new Schema<IRouteAnalytics>(
  {
    totalStops: { type: Number, default: 0 },
    completedStops: { type: Number, default: 0 },
    skippedStops: { type: Number, default: 0 },
    totalDistance: { type: Number, default: 0 },
    actualDistance: { type: Number },
    estimatedDuration: { type: Number, default: 0 },
    actualDuration: { type: Number },
    startTime: { type: Date },
    endTime: { type: Date },
    efficiency: { type: Number, default: 0 }, // percentage
    completionRate: { type: Number, default: 0 }, // percentage
  },
  { _id: false }
);

const RouteSharingSchema = new Schema<IRouteSharing>(
  {
    sharedWith: [{ type: Schema.Types.ObjectId, ref: "User" }],
    sharedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sharedAt: { type: Date, default: Date.now },
    permissions: {
      type: String,
      enum: ["VIEW", "EDIT", "ADMIN"],
      default: "VIEW",
    },
  },
  { _id: false }
);

const RouteStepSchema = new Schema<IRouteStep>(
  {
    instruction: { type: String, required: true },
    distance: { type: Number, required: true }, // meters
    duration: { type: Number, required: true }, // seconds
    startLocation: { type: [Number], required: true }, // [lng, lat]
    endLocation: { type: [Number], required: true }, // [lng, lat]
    maneuver: { type: String },
    polyline: { type: String },
  },
  { _id: false }
);

const RouteLegSchema = new Schema<IRouteLeg>(
  {
    startAddress: { type: String, required: true },
    endAddress: { type: String, required: true },
    startLocation: { type: [Number], required: true }, // [lng, lat]
    endLocation: { type: [Number], required: true }, // [lng, lat]
    distance: { type: Number, required: true }, // meters
    duration: { type: Number, required: true }, // seconds
    steps: { type: [RouteStepSchema], required: true },
  },
  { _id: false }
);

const RouteAlternativeSchema = new Schema<IRouteAlternative>(
  {
    summary: { type: String, required: true },
    distance: { type: Number, required: true }, // miles
    duration: { type: Number, required: true }, // minutes
    trafficCondition: { type: String },
    legs: { type: [RouteLegSchema], required: true },
    overviewPolyline: { type: String },
    warnings: [{ type: String }],
    waypointOrder: [{ type: Number }],
  },
  { _id: false }
);

const RouteDetailsSchema = new Schema<IRouteDetails>(
  {
    selectedAlternativeIndex: { type: Number, required: true, default: 0 },
    alternatives: { type: [RouteAlternativeSchema], required: true },
    bounds: {
      northeast: { type: [Number] }, // [lng, lat]
      southwest: { type: [Number] }, // [lng, lat]
    },
    copyrights: { type: String },
    calculatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const RouteSchema = new Schema<IRoute>(
  {
    name: { type: String, required: true },
    description: { type: String },
    agentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    zoneId: {
      type: Schema.Types.ObjectId,
      ref: "Zone",
      default: null,
      index: true,
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      default: null,
      index: true,
    },
    date: { type: Date, required: true, index: true },
    stops: { type: [RouteStopSchema], required: true },
    totalDistance: { type: Number, default: 0 },
    totalDuration: { type: Number, default: 0 },
    status: {
      type: String,
      enum: [
        "DRAFT",
        "PLANNED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
        "ARCHIVED",
      ],
      default: "PLANNED",
      index: true,
    },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      default: "MEDIUM",
      index: true,
    },
    startLocation: {
      type: { type: String, enum: ["Point"] },
      coordinates: { type: [Number] },
      address: { type: String },
    },
    endLocation: {
      type: { type: String, enum: ["Point"] },
      coordinates: { type: [Number] },
      address: { type: String },
    },
    optimizationSettings: {
      type: RouteOptimizationSettingsSchema,
      default: () => ({}),
    },
    analytics: { type: RouteAnalyticsSchema, default: () => ({}) },
    sharing: { type: RouteSharingSchema },
    routeDetails: { type: RouteDetailsSchema },
    tags: [{ type: String }],
    isTemplate: { type: Boolean, default: false },
    templateName: { type: String },
    parentRouteId: { type: Schema.Types.ObjectId, ref: "Route" },
  },
  { timestamps: true }
);

// Indexes for better query performance
RouteSchema.index({ agentId: 1, date: 1 });
RouteSchema.index({ status: 1, date: 1 });
RouteSchema.index({ priority: 1, date: 1 });
RouteSchema.index({ teamId: 1, status: 1 });
RouteSchema.index({ zoneId: 1, status: 1 });
RouteSchema.index({ isTemplate: 1 });
RouteSchema.index({ tags: 1 });

// Pre-save middleware to update analytics
RouteSchema.pre("save", function (next) {
  if (this.stops) {
    this.analytics.totalStops = this.stops.length;
    this.analytics.completedStops = this.stops.filter(
      (stop) => stop.status === "COMPLETED"
    ).length;
    this.analytics.skippedStops = this.stops.filter(
      (stop) => stop.status === "SKIPPED"
    ).length;
    this.analytics.completionRate =
      this.analytics.totalStops > 0
        ? (this.analytics.completedStops / this.analytics.totalStops) * 100
        : 0;
  }
  next();
});

export const Route: Model<IRoute> =
  mongoose.models.Route || mongoose.model<IRoute>("Route", RouteSchema);

export default Route;
