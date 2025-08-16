"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const lead_controller_1 = require("../controllers/lead.controller");
const validator_1 = require("../utils/validator");
const validators_1 = require("../validators");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
/**
 * @openapi
 * /api/leads:
 *   post:
 *     summary: Create a lead
 *     tags: [Leads]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LeadCreateInput'
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Lead'
 */
router.post('/create', auth_1.requireAuth, (0, auth_1.requireRoles)('AGENT'), (0, validator_1.validate)(validators_1.createLeadValidation), lead_controller_1.createLead);
/**
 * @openapi
 * /api/leads:
 *   get:
 *     summary: List all leads
 *     tags: [Leads]
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Lead'
 */
router.get('/', (0, auth_1.requireRoles)('SUPERADMIN', 'SUBADMIN'), lead_controller_1.listLeads);
/**
 * @openapi
 * /api/leads/my:
 *   get:
 *     summary: List my assigned leads
 *     tags: [Leads]
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Lead'
 */
router.get('/my', (0, auth_1.requireRoles)('AGENT'), lead_controller_1.listMyLeads);
/**
 * @openapi
 * /api/leads/{id}/status:
 *   patch:
 *     summary: Update lead status
 *     tags: [Leads]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 $ref: '#/components/schemas/LeadStatus'
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Lead'
 */
router.put('/update-status/:id', auth_1.requireAuth, (0, auth_1.requireRoles)('AGENT', 'SUBADMIN'), (0, validator_1.validate)(validators_1.updateLeadStatusValidation), lead_controller_1.updateLeadStatus);
exports.default = router;
//# sourceMappingURL=lead.routes.js.map