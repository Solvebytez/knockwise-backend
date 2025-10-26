import mongoose, { Schema, Document, Model } from "mongoose";

export interface IArea extends Document {
  name: string;
  type: "Area";
  municipalities: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const AreaSchema = new Schema<IArea>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    type: {
      type: String,
      enum: ["Area"],
      default: "Area",
    },
    municipalities: [
      {
        type: Schema.Types.ObjectId,
        ref: "Municipality",
      },
    ],
  },
  { timestamps: true }
);

// Index for better query performance
AreaSchema.index({ name: 1 });
AreaSchema.index({ municipalities: 1 });

export const Area: Model<IArea> =
  mongoose.models.Area || mongoose.model<IArea>("Area", AreaSchema);

export default Area;
