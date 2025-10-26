"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const assignment_controller_1 = require("../controllers/assignment.controller");
const validator_1 = require("../utils/validator");
const validators_1 = require("../validators");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth, (0, auth_1.requireRoles)("SUPERADMIN", "SUBADMIN"));
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
router.post("/create", auth_1.requireAuth, (0, auth_1.requireRoles)("SUPERADMIN", "SUBADMIN"), (0, validator_1.validate)(validators_1.createAssignmentValidation), assignment_controller_1.createAssignment);
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
router.get("/", assignment_controller_1.listAssignments);
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
router.get("/status", assignment_controller_1.getAssignmentStatus);
exports.default = router;
//# sourceMappingURL=assignment.routes.js.map