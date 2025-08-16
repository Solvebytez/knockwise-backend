"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const appointment_controller_1 = require("../controllers/appointment.controller");
const validator_1 = require("../utils/validator");
const validators_1 = require("../validators");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
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
router.post('/create', auth_1.requireAuth, (0, auth_1.requireRoles)('AGENT', 'SUBADMIN'), (0, validator_1.validate)(validators_1.createAppointmentValidation), appointment_controller_1.createAppointment);
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
router.get('/my', (0, auth_1.requireRoles)('AGENT'), appointment_controller_1.getMyAppointments);
exports.default = router;
//# sourceMappingURL=appointment.routes.js.map