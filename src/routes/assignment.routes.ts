import { Router } from "express";
import { requireAuth, requireRoles, AuthRequest } from "../middleware/auth";
import {
  createAssignment,
  getAssignmentById,
  updateAssignment,
  deleteAssignment,
  listAssignments,
  getMyAssignments,
  getTeamAssignments,
  getAssignmentStatus,
} from "../controllers/assignment.controller";
import { validate } from "../utils/validator";
import { createAssignmentValidation } from "../validators";
import { body, param, query } from "express-validator";

const router = Router();

router.use(requireAuth, requireRoles("SUPERADMIN", "SUBADMIN"));

/**
 * @openapi
 * /api/assignments:
 *   post:
 *     summary: Assign agent to zone
 *     tags: [Assignments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AssignmentCreateInput'
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Assignment'
 */
router.post(
  "/create",
  requireAuth,
  requireRoles("SUPERADMIN", "SUBADMIN"),
  validate(createAssignmentValidation),
  createAssignment
);

/**
 * @openapi
 * /api/assignments:
 *   get:
 *     summary: List assignments
 *     tags: [Assignments]
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Assignment'
 */
router.get("/", listAssignments);

/**
 * @openapi
 * /api/assignments/status:
 *   get:
 *     summary: Get assignment status overview for admin dashboard
 *     tags: [Assignments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Assignment status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     activeAssignments:
 *                       type: integer
 *                       example: 45
 *                     scheduledAssignments:
 *                       type: integer
 *                       example: 12
 *                     completedThisWeek:
 *                       type: integer
 *                       example: 89
 *                     pendingApproval:
 *                       type: integer
 *                       example: 3
 *                     overdueAssignments:
 *                       type: integer
 *                       example: 2
 */
router.get("/status", getAssignmentStatus);

export default router;
