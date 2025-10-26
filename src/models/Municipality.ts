import mongoose, { Schema, Document, Model } from "mongoose";

export interface IMunicipality extends Document {
  name: string;
  type: "Municipality";
  areaId: mongoose.Types.ObjectId;
  communities: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const MunicipalitySchema = new Schema<IMunicipality>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["Municipality"],
      default: "Municipality",
    },
    areaId: {
      type: Schema.Types.ObjectId,
      ref: "Area",
      required: true,
    },
    communities: [
      {
        type: Schema.Types.ObjectId,
        ref: "Community",
      },
    ],
  },
  { timestamps: true }
);

// Compound index to ensure unique municipality names within an area
MunicipalitySchema.index({ name: 1, areaId: 1 }, { unique: true });
MunicipalitySchema.index({ areaId: 1 });
MunicipalitySchema.index({ communities: 1 });

export const Municipality: Model<IMunicipality> =
  mongoose.models.Municipality ||
  mongoose.model<IMunicipality>("Municipality", MunicipalitySchema);

export default Municipality;
