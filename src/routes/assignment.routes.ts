import { Router } from 'express';
import { requireAuth, requireRoles, AuthRequest } from '../middleware/auth';
import { 
  createAssignment, 
  getAssignmentById, 
  updateAssignment, 
  deleteAssignment, 
  listAssignments, 
  getMyAssignments, 
  getTeamAssignments 
} from '../controllers/assignment.controller';
import { validate } from '../utils/validator';
import { createAssignmentValidation } from '../validators';
import { body, param, query } from 'express-validator';

const router = Router();

router.use(requireAuth, requireRoles('SUPERADMIN', 'SUBADMIN'));

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
router.post('/create', 
  requireAuth, 
  requireRoles('SUPERADMIN', 'SUBADMIN'), 
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
router.get('/', listAssignments);

export default router;


