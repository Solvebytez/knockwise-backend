import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICommunity extends Document {
  name: string;
  type: "Community";
  municipalityId: mongoose.Types.ObjectId;
  areaId: mongoose.Types.ObjectId; // For easier querying and performance
  zoneIds: mongoose.Types.ObjectId[]; // Array of zones this community belongs to
  createdAt: Date;
  updatedAt: Date;
}

const CommunitySchema = new Schema<ICommunity>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["Community"],
      default: "Community",
    },
    municipalityId: {
      type: Schema.Types.ObjectId,
      ref: "Municipality",
      required: true,
    },
    areaId: {
      type: Schema.Types.ObjectId,
      ref: "Area",
      required: true,
    },
    zoneIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Zone",
      },
    ],
  },
  { timestamps: true }
);

// Compound index to ensure unique community names within a municipality
CommunitySchema.index({ name: 1, municipalityId: 1 }, { unique: true });
CommunitySchema.index({ municipalityId: 1 });
CommunitySchema.index({ areaId: 1 });
CommunitySchema.index({ zoneIds: 1 });

export const Community: Model<ICommunity> =
  mongoose.models.Community ||
  mongoose.model<ICommunity>("Community", CommunitySchema);

export default Community;
