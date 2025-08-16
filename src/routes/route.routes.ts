import { Router } from 'express';
import { requireAuth, requireRoles } from '../middleware/auth';
import { 
  createRoute, 
  getRouteById, 
  updateRoute, 
  deleteRoute, 
  listRoutes, 
  getMyRoutes, 
  getTeamRoutes, 
  optimizeRoute, 
  updateRouteStatus,
  duplicateRoute,
  shareRoute,
  updateStopStatus,
  getRouteAnalytics,
  exportRoute,
  createTemplate,
  getTemplates
} from '../controllers/route.controller';
import { 
  createRouteValidation, 
  updateRouteValidation,
  updateRouteStatusValidation, 
  optimizeRouteValidation,
  duplicateRouteValidation,
  shareRouteValidation,
  updateStopStatusValidation,
  listRoutesValidation,
  getRouteAnalyticsValidation,
  exportRouteValidation,
  createTemplateValidation
} from '../validators';
import { validate } from '../utils/validator';

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /api/routes:
 *   post:
 *     summary: Create a new route
 *     tags: [Routes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, date]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               date:
 *                 type: string
 *                 format: date
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, URGENT]
 *               zoneId:
 *                 type: string
 *                 format: uuid
 *               teamId:
 *                 type: string
 *                 format: uuid
 *               startLocation:
 *                 type: object
 *                 properties:
 *                   coordinates:
 *                     type: array
 *                     items:
 *                       type: number
 *                   address:
 *                     type: string
 *               endLocation:
 *                 type: object
 *                 properties:
 *                   coordinates:
 *                     type: array
 *                     items:
 *                       type: number
 *                   address:
 *                     type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Route created successfully
 *       400:
 *         description: Invalid input data
 */
router.post('/create', 
  requireAuth, 
  requireRoles('AGENT', 'SUBADMIN'), 
  validate(createRouteValidation), 
  createRoute
);

/**
 * @openapi
 * /api/routes/optimize:
 *   post:
 *     summary: Optimize route with advanced settings
 *     tags: [Routes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [propertyIds]
 *             properties:
 *               propertyIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *               startLocation:
 *                 type: array
 *                 items:
 *                   type: number
 *               endLocation:
 *                 type: array
 *                 items:
 *                   type: number
 *               optimizationSettings:
 *                 type: object
 *                 properties:
 *                   maxStops:
 *                     type: integer
 *                     minimum: 1
 *                     maximum: 100
 *                   maxDistance:
 *                     type: number
 *                     minimum: 0.1
 *                     maximum: 500
 *                   optimizationType:
 *                     type: string
 *                     enum: [FASTEST, SHORTEST, BALANCED]
 *                   avoidFerries:
 *                     type: boolean
 *                   avoidHighways:
 *                     type: boolean
 *                   avoidTolls:
 *                     type: boolean
 *                   avoidTraffic:
 *                     type: boolean
 *                   startFromOffice:
 *                     type: boolean
 *                   returnToOffice:
 *                     type: boolean
 *                   preferredTimeWindow:
 *                     type: object
 *                     properties:
 *                       start:
 *                         type: string
 *                         pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
 *                       end:
 *                         type: string
 *                         pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
 *     responses:
 *       201:
 *         description: Optimized route created
 *       400:
 *         description: Invalid input data
 */
router.post(
  '/optimize',
  validate(optimizeRouteValidation),
  optimizeRoute
);

/**
 * @openapi
 * /api/routes/my:
 *   get:
 *     summary: Get my routes with pagination and filtering
 *     tags: [Routes]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PLANNED, IN_PROGRESS, COMPLETED, CANCELLED, ARCHIVED]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, URGENT]
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: My routes with pagination
 */
router.get('/my', validate(listRoutesValidation), getMyRoutes);

/**
 * @openapi
 * /api/routes:
 *   get:
 *     summary: List all routes with advanced filtering
 *     tags: [Routes]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PLANNED, IN_PROGRESS, COMPLETED, CANCELLED, ARCHIVED]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, URGENT]
 *       - in: query
 *         name: agentId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: teamId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: zoneId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: isTemplate
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *           description: Comma-separated list of tags
 *     responses:
 *       200:
 *         description: Routes list with pagination
 */
router.get('/', validate(listRoutesValidation), listRoutes);

/**
 * @openapi
 * /api/routes/team:
 *   get:
 *     summary: Get team routes
 *     tags: [Routes]
 *     parameters:
 *       - in: query
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PLANNED, IN_PROGRESS, COMPLETED, CANCELLED, ARCHIVED]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, URGENT]
 *     responses:
 *       200:
 *         description: Team routes with pagination
 */
router.get('/team', validate(listRoutesValidation), getTeamRoutes);

/**
 * @openapi
 * /api/routes/{id}:
 *   get:
 *     summary: Get route by ID with full details
 *     tags: [Routes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Route details
 *       404:
 *         description: Route not found
 */
router.get('/:id', validate(getRouteAnalyticsValidation), getRouteById);

/**
 * @openapi
 * /api/routes/{id}:
 *   put:
 *     summary: Update route
 *     tags: [Routes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               date:
 *                 type: string
 *                 format: date
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, URGENT]
 *               status:
 *                 type: string
 *                 enum: [DRAFT, PLANNED, IN_PROGRESS, COMPLETED, CANCELLED, ARCHIVED]
 *               stops:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Route updated
 *       404:
 *         description: Route not found
 */
router.put('/:id', validate(updateRouteValidation), updateRoute);

/**
 * @openapi
 * /api/routes/{id}:
 *   delete:
 *     summary: Delete route
 *     tags: [Routes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Route deleted
 *       404:
 *         description: Route not found
 */
router.delete('/:id', validate(getRouteAnalyticsValidation), deleteRoute);

/**
 * @openapi
 * /api/routes/{id}/status:
 *   patch:
 *     summary: Update route status
 *     tags: [Routes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [DRAFT, PLANNED, IN_PROGRESS, COMPLETED, CANCELLED, ARCHIVED]
 *     responses:
 *       200:
 *         description: Route status updated
 *       404:
 *         description: Route not found
 */
router.patch('/:id/status', 
  requireAuth, 
  requireRoles('AGENT', 'SUBADMIN'), 
  validate(updateRouteStatusValidation), 
  updateRouteStatus
);

/**
 * @openapi
 * /api/routes/{id}/duplicate:
 *   post:
 *     summary: Duplicate route
 *     tags: [Routes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               date:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Route duplicated
 *       404:
 *         description: Route not found
 */
router.post('/:id/duplicate', validate(duplicateRouteValidation), duplicateRoute);

/**
 * @openapi
 * /api/routes/{id}/share:
 *   post:
 *     summary: Share route with other users
 *     tags: [Routes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sharedWith]
 *             properties:
 *               sharedWith:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *               permissions:
 *                 type: string
 *                 enum: [VIEW, EDIT, ADMIN]
 *                 default: VIEW
 *     responses:
 *       200:
 *         description: Route shared
 *       404:
 *         description: Route not found
 */
router.post('/:id/share', validate(shareRouteValidation), shareRoute);

/**
 * @openapi
 * /api/routes/{routeId}/stops/{stopIndex}/status:
 *   patch:
 *     summary: Update stop status
 *     tags: [Routes]
 *     parameters:
 *       - in: path
 *         name: routeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [stopIndex, status]
 *             properties:
 *               stopIndex:
 *                 type: integer
 *                 minimum: 0
 *               status:
 *                 type: string
 *                 enum: [PENDING, COMPLETED, SKIPPED, RESCHEDULED]
 *               actualDuration:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 480
 *               notes:
 *                 type: string
 *                 maxLength: 1000
 *     responses:
 *       200:
 *         description: Stop status updated
 *       404:
 *         description: Route not found
 */
router.patch('/:routeId/stops/status', validate(updateStopStatusValidation), updateStopStatus);

/**
 * @openapi
 * /api/routes/{id}/analytics:
 *   get:
 *     summary: Get route analytics
 *     tags: [Routes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Route analytics
 *       404:
 *         description: Route not found
 */
router.get('/:id/analytics', validate(getRouteAnalyticsValidation), getRouteAnalytics);

/**
 * @openapi
 * /api/routes/{id}/export:
 *   get:
 *     summary: Export route in various formats
 *     tags: [Routes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [pdf, csv, json]
 *           default: json
 *     responses:
 *       200:
 *         description: Route exported
 *       404:
 *         description: Route not found
 */
router.get('/:id/export', validate(exportRouteValidation), exportRoute);

/**
 * @openapi
 * /api/routes/templates:
 *   post:
 *     summary: Create route template
 *     tags: [Routes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               optimizationSettings:
 *                 type: object
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Template created
 */
router.post('/templates', validate(createTemplateValidation), createTemplate);

/**
 * @openapi
 * /api/routes/templates:
 *   get:
 *     summary: Get route templates
 *     tags: [Routes]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Templates list with pagination
 */
router.get('/templates', validate(listRoutesValidation), getTemplates);

export default router;
