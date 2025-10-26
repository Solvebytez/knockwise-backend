import express from "express";
import {
  createResident,
  getResidentById,
  updateResident,
} from "../controllers/resident.controller";
import { mongoIdParam } from "../validators/common.validator";
import { validate } from "../utils/validator";
import { requireAuth } from "../middleware/auth";

const router = express.Router();

// Create new resident (manual addition)
router.post("/", requireAuth, createResident);

// Get resident by ID
router.get("/:id", validate([mongoIdParam()]), requireAuth, getResidentById);

// Update resident
router.put("/:id", validate([mongoIdParam()]), requireAuth, updateResident);

export default router;
