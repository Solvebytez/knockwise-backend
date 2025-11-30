import express from "express";
import {
  createResident,
  getResidentById,
  updateResident,
  getMyLatestLeads,
  getMyLeads,
} from "../controllers/resident.controller";
import { mongoIdParam } from "../validators/common.validator";
import { validate } from "../utils/validator";
import { requireAuth } from "../middleware/auth";

const router = express.Router();

// Create new resident (manual addition)
router.post("/", requireAuth, createResident);

// Get all leads for logged-in agent with pagination
router.get("/my-leads", requireAuth, getMyLeads);

// Get latest leads for logged-in agent (top 3)
router.get("/my-leads/latest", requireAuth, getMyLatestLeads);

// Get resident by ID
router.get("/:id", validate([mongoIdParam()]), requireAuth, getResidentById);

// Update resident
router.put("/:id", validate([mongoIdParam()]), requireAuth, updateResident);

export default router;
