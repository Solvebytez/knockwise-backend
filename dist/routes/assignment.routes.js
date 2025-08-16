"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const assignment_controller_1 = require("../controllers/assignment.controller");
const validator_1 = require("../utils/validator");
const validators_1 = require("../validators");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth, (0, auth_1.requireRoles)('SUPERADMIN', 'SUBADMIN'));
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
router.post('/create', auth_1.requireAuth, (0, auth_1.requireRoles)('SUBADMIN'), (0, validator_1.validate)(validators_1.createAssignmentValidation), assignment_controller_1.createAssignment);
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
router.get('/', assignment_controller_1.listAssignments);
exports.default = router;
//# sourceMappingURL=assignment.routes.js.map