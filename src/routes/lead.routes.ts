import { Router } from 'express';
import { requireAuth, requireRoles, AuthRequest } from '../middleware/auth';
import { createLead, listLeads, listMyLeads, updateLeadStatus } from '../controllers/lead.controller';
import { validate } from '../utils/validator';
import { createLeadValidation, updateLeadStatusValidation } from '../validators';

const router = Router();

router.use(requireAuth);

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
router.post(
  '/create',
  requireAuth,
  requireRoles('AGENT'),
  validate(createLeadValidation),
  createLead
);

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
router.get('/', requireRoles('SUPERADMIN', 'SUBADMIN'), listLeads);

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
router.get('/my', requireRoles('AGENT'), listMyLeads);

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
router.put('/update-status/:id',
  requireAuth,
  requireRoles('AGENT', 'SUBADMIN'),
  validate(updateLeadStatusValidation),
  updateLeadStatus
);

export default router;


