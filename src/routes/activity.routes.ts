import { Router } from 'express';
import { requireAuth, requireRoles } from '../middleware/auth';
import { 
  createActivity, 
  getActivityById, 
  updateActivity, 
  deleteActivity, 
  listMyActivities, 
  listAllActivities, 
  getActivityStatistics, 
  getAgentPerformance 
} from '../controllers/activity.controller';
import { 
  createActivityValidation, 
  updateActivityValidation, 
  listMyActivitiesValidation,
  listAllActivitiesValidation,
  getActivityByIdValidation,
  deleteActivityValidation,
  getActivityStatsValidation,
  getMyActivityStatsValidation
} from '../validators';
import { validate } from '../utils/validator';

const router = Router();

router.use(requireAuth);

// Activity CRUD operations
/**
 * @openapi
 * /api/activities/create:
 *   post:
 *     summary: Create a new door-knocking activity (Agent only)
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [propertyId, response]
 *             properties:
 *               propertyId:
 *                 type: string
 *                 format: uuid
 *                 example: "507f1f77bcf86cd799439011"
 *               zoneId:
 *                 type: string
 *                 format: uuid
 *                 example: "507f1f77bcf86cd799439012"
 *               startedAt:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-01-15T10:30:00.000Z"
 *               endedAt:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-01-15T10:35:00.000Z"
 *               durationSeconds:
 *                 type: integer
 *                 example: 300
 *               response:
 *                 type: string
 *                 enum: [NO_ANSWER, NOT_INTERESTED, CALL_BACK, APPOINTMENT_SET, FOLLOW_UP, LEAD_CREATED]
 *                 example: "LEAD_CREATED"
 *               notes:
 *                 type: string
 *                 example: "Homeowner was very interested in selling their property"
 *     responses:
 *       201:
 *         description: Activity created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Activity created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439013"
 *                     agentId:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: "507f1f77bcf86cd799439014"
 *                         name:
 *                           type: string
 *                           example: "John Doe"
 *                         email:
 *                           type: string
 *                           example: "john.doe@knockwise.com"
 *                     propertyId:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: "507f1f77bcf86cd799439011"
 *                         addressLine1:
 *                           type: string
 *                           example: "123 Main St"
 *                         city:
 *                           type: string
 *                           example: "New York"
 *                         state:
 *                           type: string
 *                           example: "NY"
 *                     zoneId:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: "507f1f77bcf86cd799439012"
 *                         name:
 *                           type: string
 *                           example: "Downtown District"
 *                     startedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00.000Z"
 *                     endedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:35:00.000Z"
 *                     durationSeconds:
 *                       type: integer
 *                       example: 300
 *                     response:
 *                       type: string
 *                       example: "LEAD_CREATED"
 *                     notes:
 *                       type: string
 *                       example: "Homeowner was very interested in selling their property"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:35:00.000Z"
 *       404:
 *         description: Property or zone not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Property not found"
 */
router.post(
  '/create',
  requireRoles('AGENT'),
  validate(createActivityValidation),
  createActivity
);

/**
 * @openapi
 * /api/activities/my:
 *   get:
 *     summary: List my door-knocking activities (Agent only)
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           example: 10
 *       - in: query
 *         name: response
 *         schema:
 *           type: string
 *           enum: [NO_ANSWER, NOT_INTERESTED, CALL_BACK, APPOINTMENT_SET, FOLLOW_UP, LEAD_CREATED]
 *           example: "LEAD_CREATED"
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *           example: "2024-01-01"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *           example: "2024-01-31"
 *       - in: query
 *         name: zoneId
 *         schema:
 *           type: string
 *           example: "507f1f77bcf86cd799439012"
 *     responses:
 *       200:
 *         description: List of activities with pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: "507f1f77bcf86cd799439013"
 *                       agentId:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439014"
 *                           name:
 *                             type: string
 *                             example: "John Doe"
 *                           email:
 *                             type: string
 *                             example: "john.doe@knockwise.com"
 *                       propertyId:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439011"
 *                           addressLine1:
 *                             type: string
 *                             example: "123 Main St"
 *                           city:
 *                             type: string
 *                             example: "New York"
 *                           state:
 *                             type: string
 *                             example: "NY"
 *                       zoneId:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439012"
 *                           name:
 *                             type: string
 *                             example: "Downtown District"
 *                       startedAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-01-15T10:30:00.000Z"
 *                       endedAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-01-15T10:35:00.000Z"
 *                       durationSeconds:
 *                         type: integer
 *                         example: 300
 *                       response:
 *                         type: string
 *                         example: "LEAD_CREATED"
 *                       notes:
 *                         type: string
 *                         example: "Homeowner was very interested in selling their property"
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-01-15T10:35:00.000Z"
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     total:
 *                       type: integer
 *                       example: 25
 *                     pages:
 *                       type: integer
 *                       example: 3
 */
router.get(
  '/my',
  requireRoles('AGENT'),
  validate(listMyActivitiesValidation),
  listMyActivities
);

/**
 * @openapi
 * /api/activities/list-all:
 *   get:
 *     summary: List all activities (Superadmin/Subadmin only)
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           example: 10
 *       - in: query
 *         name: agentId
 *         schema:
 *           type: string
 *           example: "507f1f77bcf86cd799439014"
 *       - in: query
 *         name: response
 *         schema:
 *           type: string
 *           enum: [NO_ANSWER, NOT_INTERESTED, CALL_BACK, APPOINTMENT_SET, FOLLOW_UP, LEAD_CREATED]
 *           example: "LEAD_CREATED"
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *           example: "2024-01-01"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *           example: "2024-01-31"
 *       - in: query
 *         name: zoneId
 *         schema:
 *           type: string
 *           example: "507f1f77bcf86cd799439012"
 *       - in: query
 *         name: teamId
 *         schema:
 *           type: string
 *           example: "507f1f77bcf86cd799439015"
 *     responses:
 *       200:
 *         description: List of all activities with pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: "507f1f77bcf86cd799439013"
 *                       agentId:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439014"
 *                           name:
 *                             type: string
 *                             example: "John Doe"
 *                           email:
 *                             type: string
 *                             example: "john.doe@knockwise.com"
 *                       propertyId:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439011"
 *                           addressLine1:
 *                             type: string
 *                             example: "123 Main St"
 *                           city:
 *                             type: string
 *                             example: "New York"
 *                           state:
 *                             type: string
 *                             example: "NY"
 *                       zoneId:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439012"
 *                           name:
 *                             type: string
 *                             example: "Downtown District"
 *                       startedAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-01-15T10:30:00.000Z"
 *                       endedAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-01-15T10:35:00.000Z"
 *                       durationSeconds:
 *                         type: integer
 *                         example: 300
 *                       response:
 *                         type: string
 *                         example: "LEAD_CREATED"
 *                       notes:
 *                         type: string
 *                         example: "Homeowner was very interested in selling their property"
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-01-15T10:35:00.000Z"
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     total:
 *                       type: integer
 *                       example: 25
 *                     pages:
 *                       type: integer
 *                       example: 3
 */
router.get(
  '/list-all',
  requireRoles('SUPERADMIN', 'SUBADMIN'),
  validate(listAllActivitiesValidation),
  listAllActivities
);

/**
 * @openapi
 * /api/activities/get-by-id/{id}:
 *   get:
 *     summary: Get activity by ID
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "507f1f77bcf86cd799439013"
 *     responses:
 *       200:
 *         description: Activity details
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
 *                     _id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439013"
 *                     agentId:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: "507f1f77bcf86cd799439014"
 *                         name:
 *                           type: string
 *                           example: "John Doe"
 *                         email:
 *                           type: string
 *                           example: "john.doe@knockwise.com"
 *                     propertyId:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: "507f1f77bcf86cd799439011"
 *                         addressLine1:
 *                           type: string
 *                           example: "123 Main St"
 *                         city:
 *                           type: string
 *                           example: "New York"
 *                         state:
 *                           type: string
 *                           example: "NY"
 *                     zoneId:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: "507f1f77bcf86cd799439012"
 *                         name:
 *                           type: string
 *                           example: "Downtown District"
 *                     startedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00.000Z"
 *                     endedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:35:00.000Z"
 *                     durationSeconds:
 *                       type: integer
 *                       example: 300
 *                     response:
 *                       type: string
 *                       example: "LEAD_CREATED"
 *                     notes:
 *                       type: string
 *                       example: "Homeowner was very interested in selling their property"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:35:00.000Z"
 *       404:
 *         description: Activity not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Activity not found"
 */
router.get(
  '/get-by-id/:id',
  validate(getActivityByIdValidation),
  getActivityById
);

/**
 * @openapi
 * /api/activities/update/{id}:
 *   put:
 *     summary: Update activity (Agent can only update their own activities)
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "507f1f77bcf86cd799439013"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               response:
 *                 type: string
 *                 enum: [NO_ANSWER, NOT_INTERESTED, CALL_BACK, APPOINTMENT_SET, FOLLOW_UP, LEAD_CREATED]
 *                 example: "LEAD_CREATED"
 *               notes:
 *                 type: string
 *                 example: "Updated notes about the visit"
 *               endedAt:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-01-15T10:35:00.000Z"
 *               durationSeconds:
 *                 type: integer
 *                 example: 300
 *     responses:
 *       200:
 *         description: Activity updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Activity updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439013"
 *                     response:
 *                       type: string
 *                       example: "LEAD_CREATED"
 *                     notes:
 *                       type: string
 *                       example: "Updated notes about the visit"
 *                     endedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:35:00.000Z"
 *                     durationSeconds:
 *                       type: integer
 *                       example: 300
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Insufficient permissions"
 *       404:
 *         description: Activity not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Activity not found"
 */
router.put(
  '/update/:id',
  requireAuth,
  requireRoles('AGENT'),
  validate(updateActivityValidation),
  updateActivity
);

/**
 * @openapi
 * /api/activities/delete/{id}:
 *   delete:
 *     summary: Delete activity (Agent can only delete their own activities)
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "507f1f77bcf86cd799439013"
 *     responses:
 *       200:
 *         description: Activity deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Activity deleted successfully"
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Insufficient permissions"
 *       404:
 *         description: Activity not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Activity not found"
 */
router.delete(
  '/delete/:id',
  validate(deleteActivityValidation),
  deleteActivity
);

// Analytics endpoints
/**
 * @openapi
 * /api/activities/statistics:
 *   get:
 *     summary: Get activity statistics (Superadmin/Subadmin only)
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *           example: "2024-01-01"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *           example: "2024-01-31"
 *       - in: query
 *         name: agentId
 *         schema:
 *           type: string
 *           example: "507f1f77bcf86cd799439014"
 *       - in: query
 *         name: zoneId
 *         schema:
 *           type: string
 *           example: "507f1f77bcf86cd799439012"
 *       - in: query
 *         name: teamId
 *         schema:
 *           type: string
 *           example: "507f1f77bcf86cd799439015"
 *     responses:
 *       200:
 *         description: Activity statistics
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
 *                     totalActivities:
 *                       type: integer
 *                       example: 150
 *                     totalDuration:
 *                       type: integer
 *                       example: 45000
 *                     averageDuration:
 *                       type: integer
 *                       example: 300
 *                     responseStats:
 *                       type: object
 *                       properties:
 *                         NO_ANSWER:
 *                           type: integer
 *                           example: 45
 *                         NOT_INTERESTED:
 *                           type: integer
 *                           example: 30
 *                         CALL_BACK:
 *                           type: integer
 *                           example: 25
 *                         APPOINTMENT_SET:
 *                           type: integer
 *                           example: 20
 *                         FOLLOW_UP:
 *                           type: integer
 *                           example: 15
 *                         LEAD_CREATED:
 *                           type: integer
 *                           example: 15
 *                     dailyStats:
 *                       type: object
 *                       additionalProperties:
 *                         type: object
 *                         properties:
 *                           total:
 *                             type: integer
 *                             example: 10
 *                           duration:
 *                             type: integer
 *                             example: 3000
 *                           responses:
 *                             type: object
 *                             properties:
 *                               NO_ANSWER:
 *                                 type: integer
 *                                 example: 3
 *                               LEAD_CREATED:
 *                                 type: integer
 *                                 example: 2
 *                     timeRange:
 *                       type: object
 *                       properties:
 *                         startDate:
 *                           type: string
 *                           example: "2024-01-01"
 *                         endDate:
 *                           type: string
 *                           example: "2024-01-31"
 */
router.get(
  '/statistics',
  requireRoles('SUPERADMIN', 'SUBADMIN'),
  validate(getActivityStatsValidation),
  getActivityStatistics
);

/**
 * @openapi
 * /api/activities/agent-performance:
 *   get:
 *     summary: Get agent performance analytics
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: agentId
 *         schema:
 *           type: string
 *           example: "507f1f77bcf86cd799439014"
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *           example: "2024-01-01"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *           example: "2024-01-31"
 *     responses:
 *       200:
 *         description: Agent performance data
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
 *                     agentId:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439014"
 *                     totalActivities:
 *                       type: integer
 *                       example: 150
 *                     totalDuration:
 *                       type: integer
 *                       example: 45000
 *                     averageDuration:
 *                       type: integer
 *                       example: 300
 *                     conversionRate:
 *                       type: integer
 *                       example: 10
 *                     responseStats:
 *                       type: object
 *                       properties:
 *                         NO_ANSWER:
 *                           type: integer
 *                           example: 45
 *                         NOT_INTERESTED:
 *                           type: integer
 *                           example: 30
 *                         CALL_BACK:
 *                           type: integer
 *                           example: 25
 *                         APPOINTMENT_SET:
 *                           type: integer
 *                           example: 20
 *                         FOLLOW_UP:
 *                           type: integer
 *                           example: 15
 *                         LEAD_CREATED:
 *                           type: integer
 *                           example: 15
 *                     activities:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439013"
 *                           propertyId:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                                 example: "507f1f77bcf86cd799439011"
 *                               addressLine1:
 *                                 type: string
 *                                 example: "123 Main St"
 *                           response:
 *                             type: string
 *                             example: "LEAD_CREATED"
 *                           startedAt:
 *                             type: string
 *                             format: date-time
 *                             example: "2024-01-15T10:30:00.000Z"
 *                           durationSeconds:
 *                             type: integer
 *                             example: 300
 */
router.get(
  '/agent-performance',
  validate(getMyActivityStatsValidation),
  getAgentPerformance
);

export default router;
