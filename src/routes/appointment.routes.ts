import { Router } from 'express';
import { requireAuth, requireRoles, AuthRequest } from '../middleware/auth';
import { 
  createAppointment, 
  getAppointmentById, 
  updateAppointment, 
  deleteAppointment, 
  listAppointments, 
  getMyAppointments, 
  getTeamAppointments 
} from '../controllers/appointment.controller';
import { validate } from '../utils/validator';
import { createAppointmentValidation } from '../validators';
import { body, param, query } from 'express-validator';

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /api/appointments:
 *   post:
 *     summary: Create an appointment
 *     tags: [Appointments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AppointmentCreateInput'
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appointment'
 */
router.post(
  '/create',
  requireAuth,
  requireRoles('AGENT', 'SUBADMIN'),
  validate(createAppointmentValidation),
  createAppointment
);

/**
 * @openapi
 * /api/appointments/my:
 *   get:
 *     summary: List my appointments
 *     tags: [Appointments]
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Appointment'
 */
router.get('/my', requireRoles('AGENT'), getMyAppointments);

export default router;


