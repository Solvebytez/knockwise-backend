import express from 'express';
import { getResidentById, updateResident } from '../controllers/resident.controller';
import { mongoIdParam } from '../validators/common.validator';
import { validate } from '../utils/validator';
import { requireAuth } from '../middleware/auth';

const router = express.Router();

// Get resident by ID
router.get('/:id', validate([mongoIdParam()]), requireAuth, getResidentById);

// Update resident
router.put('/:id', validate([mongoIdParam()]), requireAuth, updateResident);

export default router;
