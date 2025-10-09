import mongoose, { Schema, Document, Model } from "mongoose";

export type ResidentStatus =
  | "not-visited"
  | "interested"
  | "visited"
  | "callback"
  | "appointment"
  | "follow-up"
  | "not-interested";

export interface IResident extends Document {
  zoneId: mongoose.Types.ObjectId;
  address: string;
  coordinates: [number, number]; // [lng, lat]
  houseNumber?: number;
  status: ResidentStatus;
  notes?: string;
  phone?: string;
  email?: string;
  lastVisited?: Date;
  assignedAgentId?: mongoose.Types.ObjectId;
  lastUpdatedBy?: mongoose.Types.ObjectId; // Track which user last updated this resident
  propertyDataId?: mongoose.Types.ObjectId | null; // Link to detailed property info
  createdAt: Date;
  updatedAt: Date;
}

const ResidentSchema = new Schema<IResident>(
  {
    zoneId: {
      type: Schema.Types.ObjectId,
      ref: "Zone",
      required: true,
      index: true,
    },
    address: { type: String, required: true },
    coordinates: { type: [Number], required: true }, // [lng, lat]
    houseNumber: { type: Number, index: true },
    status: {
      type: String,
      enum: [
        "not-visited",
        "interested",
        "visited",
        "callback",
        "appointment",
        "follow-up",
        "not-interested",
      ],
      default: "not-visited",
      index: true,
    },
    notes: { type: String },
    phone: { type: String },
    email: { type: String, lowercase: true },
    lastVisited: { type: Date },
    assignedAgentId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    lastUpdatedBy: { type: Schema.Types.ObjectId, ref: "User", index: true },
    propertyDataId: {
      type: Schema.Types.ObjectId,
      ref: "PropertyData",
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

ResidentSchema.index({ coordinates: "2dsphere" });
ResidentSchema.index({ zoneId: 1, status: 1 });
ResidentSchema.index({ zoneId: 1, houseNumber: 1 });

export const Resident: Model<IResident> =
  mongoose.models.Resident ||
  mongoose.model<IResident>("Resident", ResidentSchema);

export default Resident;
