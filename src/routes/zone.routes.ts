import { Router } from 'express';
import { requireAuth, requireRoles, AuthRequest } from '../middleware/auth';
import {
  createZone,
  listZones,
  getZoneById,
  updateZone,
  deleteZone,
  assignAgentToZone,
  getZoneAssignments,
  removeAgentFromZone,
  assignTeamToZone,
  removeTeamFromZone,
  getZonesByProximity,
  getZoneStatistics,
  getZoneDetailedStats,
  getZoneResidents,
  updateResidentStatus,
  getTerritoryOverviewStats,
  checkZoneOverlapBeforeCreate,
} from '../controllers/zone.controller';
import { validate } from '../utils/validator';
import {
  createZoneValidation,
  updateZoneValidation,
  assignAgentToZoneValidation,
  listZonesValidation,
  getZoneByIdValidation,
  deleteZoneValidation,
  getZoneAssignmentsValidation,
  removeAgentFromZoneValidation,
  getZonesByProximityValidation,
  getZoneStatisticsValidation,
  getNearbyPropertiesValidation,
} from '../validators';

const router = Router();

router.use(requireAuth);

// Zone overlap checking (before creation)
/**
 * @openapi
 * /api/zones/check-overlap:
 *   post:
 *     summary: Check for zone overlaps before creation
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [boundary]
 *             properties:
 *               boundary:
 *                 type: object
 *                 required: [type, coordinates]
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [Polygon]
 *                     example: "Polygon"
 *                   coordinates:
 *                     type: array
 *                     items:
 *                       type: array
 *                       items:
 *                         type: number
 *                     example: [[[-74.0060, 40.7128], [-74.0061, 40.7129], [-74.0062, 40.7130], [-74.0060, 40.7128]]]
 *               buildingData:
 *                 type: object
 *                 properties:
 *                   addresses:
 *                     type: array
 *                     items:
 *                       type: string
 *                     example: ["123 Main St", "456 Oak Ave"]
 *     responses:
 *       200:
 *         description: Overlap check completed
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
 *                     hasOverlap:
 *                       type: boolean
 *                       example: false
 *                     overlappingZones:
 *                       type: array
 *                       items:
 *                         type: object
 *                     duplicateBuildings:
 *                       type: array
 *                       items:
 *                         type: string
 *                     isValid:
 *                       type: boolean
 *                       example: true
 */
router.post('/check-overlap', requireRoles(['SUPERADMIN', 'SUBADMIN']), checkZoneOverlapBeforeCreate);

// Zone CRUD operations
/**
 * @openapi
 * /api/zones/create-zone:
 *   post:
 *     summary: Create a new zone/territory (Superadmin/Subadmin only)
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, boundary]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 example: "Downtown District"
 *               description:
 *                 type: string
 *                 example: "High-value residential area with premium properties"
 *               boundary:
 *                 type: object
 *                 required: [type, coordinates]
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [Polygon]
 *                     example: "Polygon"
 *                   coordinates:
 *                     type: array
 *                     items:
 *                       type: array
 *                       items:
 *                         type: number
 *                     example: [[[-74.0060, 40.7128], [-74.0061, 40.7129], [-74.0062, 40.7130], [-74.0060, 40.7128]]]
 *               teamId:
 *                 type: string
 *                 format: uuid
 *                 example: "507f1f77bcf86cd799439011"
 *     responses:
 *       201:
 *         description: Zone created successfully
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
 *                   example: "Zone created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439012"
 *                     name:
 *                       type: string
 *                       example: "Downtown District"
 *                     description:
 *                       type: string
 *                       example: "High-value residential area with premium properties"
 *                     boundary:
 *                       type: object
 *                       example:
 *                         type: "Polygon"
 *                         coordinates: [[[-74.0060, 40.7128], [-74.0061, 40.7129], [-74.0062, 40.7130], [-74.0060, 40.7128]]]
 *                     teamId:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439011"
 *                     status:
 *                       type: string
 *                       example: "ACTIVE"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00.000Z"
 *       409:
 *         description: Zone name already exists
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
 *                   example: "Zone with this name already exists"
 */
router.post(
  '/create-zone',
  requireRoles('SUPERADMIN', 'SUBADMIN'),
  validate(createZoneValidation),
  createZone
);

/**
 * @openapi
 * /api/zones/list-all:
 *   get:
 *     summary: List all zones with pagination and filtering
 *     tags: [Zones]
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
 *         name: teamId
 *         schema:
 *           type: string
 *           example: "507f1f77bcf86cd799439011"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, ACTIVE, INACTIVE]
 *           example: "DRAFT"
 *     responses:
 *       200:
 *         description: List of zones with pagination
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
 *                         example: "507f1f77bcf86cd799439012"
 *                       name:
 *                         type: string
 *                         example: "Downtown District"
 *                       description:
 *                         type: string
 *                         example: "High-value residential area"
 *                       boundary:
 *                         type: object
 *                         example:
 *                           type: "Polygon"
 *                           coordinates: [[[-74.0060, 40.7128], [-74.0061, 40.7129], [-74.0062, 40.7130], [-74.0060, 40.7128]]]
 *                       teamId:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439011"
 *                           name:
 *                             type: string
 *                             example: "Team Alpha"
 *                       status:
 *                         type: string
 *                         example: "ACTIVE"
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-01-15T10:30:00.000Z"
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
  validate(listZonesValidation),
  listZones
);

/**
 * @openapi
 * /api/zones/get-by-id/{id}:
 *   get:
 *     summary: Get zone by ID
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "507f1f77bcf86cd799439012"
 *     responses:
 *       200:
 *         description: Zone details
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
 *                       example: "507f1f77bcf86cd799439012"
 *                     name:
 *                       type: string
 *                       example: "Downtown District"
 *                     description:
 *                       type: string
 *                       example: "High-value residential area with premium properties"
 *                     boundary:
 *                       type: object
 *                       example:
 *                         type: "Polygon"
 *                         coordinates: [[[-74.0060, 40.7128], [-74.0061, 40.7129], [-74.0062, 40.7130], [-74.0060, 40.7128]]]
 *                     teamId:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: "507f1f77bcf86cd799439011"
 *                         name:
 *                           type: string
 *                           example: "Team Alpha"
 *                     status:
 *                       type: string
 *                       example: "ACTIVE"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00.000Z"
 *       404:
 *         description: Zone not found
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
 *                   example: "Zone not found"
 */
router.get(
  '/get-by-id/:id',
  validate(getZoneByIdValidation),
  getZoneById
);

/**
 * @openapi
 * /api/zones/update/{id}:
 *   put:
 *     summary: Update zone (Superadmin/Subadmin only)
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "507f1f77bcf86cd799439012"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated Downtown District"
 *               description:
 *                 type: string
 *                 example: "Updated description for the downtown area"
 *               boundary:
 *                 type: object
 *                 example:
 *                   type: "Polygon"
 *                   coordinates: [[[-74.0060, 40.7128], [-74.0061, 40.7129], [-74.0062, 40.7130], [-74.0060, 40.7128]]]
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE]
 *                 example: "ACTIVE"
 *     responses:
 *       200:
 *         description: Zone updated successfully
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
 *                   example: "Zone updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439012"
 *                     name:
 *                       type: string
 *                       example: "Updated Downtown District"
 *                     description:
 *                       type: string
 *                       example: "Updated description for the downtown area"
 *                     status:
 *                       type: string
 *                       example: "ACTIVE"
 *       404:
 *         description: Zone not found
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
 *                   example: "Zone not found"
 */
router.put(
  '/update/:id',
  requireRoles('SUPERADMIN', 'SUBADMIN'),
  validate(updateZoneValidation),
  updateZone
);

/**
 * @openapi
 * /api/zones/delete/{id}:
 *   delete:
 *     summary: Delete zone (Superadmin/Subadmin only)
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "507f1f77bcf86cd799439012"
 *     responses:
 *       200:
 *         description: Zone deleted successfully
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
 *                   example: "Zone deleted successfully"
 *       400:
 *         description: Cannot delete zone with active assignments
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
 *                   example: "Cannot delete zone with active agent assignments"
 *       404:
 *         description: Zone not found
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
 *                   example: "Zone not found"
 */
router.delete(
  '/delete/:id',
  requireRoles('SUPERADMIN', 'SUBADMIN'),
  validate(deleteZoneValidation),
  deleteZone
);

// Zone assignment operations
/**
 * @openapi
 * /api/zones/assign-agent-to-zone:
 *   post:
 *     summary: Assign agent to zone (Superadmin/Subadmin only)
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [agentId, zoneId]
 *             properties:
 *               agentId:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439013"
 *               zoneId:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439012"
 *               effectiveDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-01-15T10:30:00.000Z"
 *     responses:
 *       201:
 *         description: Agent assigned to zone successfully
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
 *                   example: "Agent assigned to zone successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439014"
 *                     agentId:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439013"
 *                     zoneId:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439012"
 *                     assignedBy:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439015"
 *                     effectiveDate:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00.000Z"
 *                     status:
 *                       type: string
 *                       example: "ACTIVE"
 *       404:
 *         description: Agent or zone not found
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
 *                   example: "Agent or zone not found"
 */
router.post(
  '/assign-agent-to-zone',
  requireRoles('SUPERADMIN', 'SUBADMIN'),
  validate(assignAgentToZoneValidation),
  assignAgentToZone
);

/**
 * @openapi
 * /api/zones/list-assignments:
 *   get:
 *     summary: Get zone assignments
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: zoneId
 *         schema:
 *           type: string
 *           example: "507f1f77bcf86cd799439012"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, ACTIVE, INACTIVE]
 *           example: "DRAFT"
 *     responses:
 *       200:
 *         description: List of zone assignments
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
 *                         example: "507f1f77bcf86cd799439014"
 *                       agentId:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439013"
 *                           name:
 *                             type: string
 *                             example: "John Doe"
 *                           email:
 *                             type: string
 *                             example: "john.doe@knockwise.com"
 *                       zoneId:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439012"
 *                           name:
 *                             type: string
 *                             example: "Downtown District"
 *                       assignedBy:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439015"
 *                           name:
 *                             type: string
 *                             example: "Admin User"
 *                       effectiveDate:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-01-15T10:30:00.000Z"
 *                       status:
 *                         type: string
 *                         example: "ACTIVE"
 */
router.get(
  '/list-assignments',
  validate(getZoneAssignmentsValidation),
  getZoneAssignments
);

/**
 * @openapi
 * /api/zones/remove-agent-from-zone/{assignmentId}:
 *   put:
 *     summary: Remove agent from zone (Superadmin/Subadmin only)
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: string
 *         example: "507f1f77bcf86cd799439014"
 *     responses:
 *       200:
 *         description: Agent removed from zone successfully
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
 *                   example: "Agent removed from zone successfully"
 *       404:
 *         description: Assignment not found
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
 *                   example: "Assignment not found"
 */
router.put(
  '/remove-agent-from-zone/:assignmentId',
  requireRoles('SUPERADMIN', 'SUBADMIN'),
  validate(removeAgentFromZoneValidation),
  removeAgentFromZone
);

// Team assignment operations
/**
 * @openapi
 * /api/zones/assign-team-to-zone:
 *   post:
 *     summary: Assign team to zone (Superadmin/Subadmin only)
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [teamId, zoneId]
 *             properties:
 *               teamId:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439013"
 *               zoneId:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439012"
 *               effectiveDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-01-15T10:30:00.000Z"
 *     responses:
 *       200:
 *         description: Team assigned to zone successfully
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
 *                   example: "Team assigned to zone successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     zone:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         teamId:
 *                           type: object
 *                           properties:
 *                             _id:
 *                               type: string
 *                             name:
 *                               type: string
 *                         status:
 *                           type: string
 *                           example: "ACTIVE"
 *                     team:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         agentCount:
 *                           type: integer
 *       404:
 *         description: Team or zone not found
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
 *                   example: "Team or zone not found"
 */
router.post(
  '/assign-team-to-zone',
  requireRoles('SUPERADMIN', 'SUBADMIN'),
  assignTeamToZone
);

/**
 * @openapi
 * /api/zones/remove-team-from-zone/{zoneId}:
 *   put:
 *     summary: Remove team from zone (Superadmin/Subadmin only)
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: zoneId
 *         required: true
 *         schema:
 *           type: string
 *         example: "507f1f77bcf86cd799439012"
 *     responses:
 *       200:
 *         description: Team removed from zone successfully
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
 *                   example: "Team removed from zone successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     teamId:
 *                       type: null
 *                     status:
 *                       type: string
 *                       example: "DRAFT"
 *       404:
 *         description: Zone not found
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
 *                   example: "Zone not found"
 */
router.put(
  '/remove-team-from-zone/:zoneId',
  requireRoles('SUPERADMIN', 'SUBADMIN'),
  removeTeamFromZone
);

// Geographic operations
/**
 * @openapi
 * /api/zones/find-by-proximity:
 *   get:
 *     summary: Find zones by geographic proximity
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: latitude
 *         required: true
 *         schema:
 *           type: number
 *         example: 40.7128
 *       - in: query
 *         name: longitude
 *         required: true
 *         schema:
 *           type: number
 *         example: -74.0060
 *       - in: query
 *         name: maxDistance
 *         schema:
 *           type: number
 *           default: 10000
 *         example: 5000
 *     responses:
 *       200:
 *         description: Zones found by proximity
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
 *                         example: "507f1f77bcf86cd799439012"
 *                       name:
 *                         type: string
 *                         example: "Downtown District"
 *                       description:
 *                         type: string
 *                         example: "High-value residential area"
 *                       boundary:
 *                         type: object
 *                         example:
 *                           type: "Polygon"
 *                           coordinates: [[[-74.0060, 40.7128], [-74.0061, 40.7129], [-74.0062, 40.7130], [-74.0060, 40.7128]]]
 *                       teamId:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439011"
 *                           name:
 *                             type: string
 *                             example: "Team Alpha"
 *       400:
 *         description: Latitude and longitude are required
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
 *                   example: "Latitude and longitude are required"
 */
router.get(
  '/find-by-proximity',
  validate(getZonesByProximityValidation),
  getZonesByProximity
);

// Analytics
/**
 * @openapi
 * /api/zones/statistics/{zoneId}:
 *   get:
 *     summary: Get zone statistics
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: zoneId
 *         required: true
 *         schema:
 *           type: string
 *         example: "507f1f77bcf86cd799439012"
 *     responses:
 *       200:
 *         description: Zone statistics
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
 *                     zoneId:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439012"
 *                     zoneName:
 *                       type: string
 *                       example: "Downtown District"
 *                     activeAssignments:
 *                       type: integer
 *                       example: 3
 *                     totalAgents:
 *                       type: integer
 *                       example: 3
 *                     area:
 *                       type: number
 *                       example: 1000000
 *                     status:
 *                       type: string
 *                       example: "ACTIVE"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00.000Z"
 *       404:
 *         description: Zone not found
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
 *                   example: "Zone not found"
 */
router.get(
  '/statistics/:zoneId',
  validate(getZoneStatisticsValidation),
  getZoneStatistics
);

/**
 * @openapi
 * /api/zones/detailed-stats/{id}:
 *   get:
 *     summary: Get detailed zone statistics including house numbers
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "507f1f77bcf86cd799439012"
 *     responses:
 *       200:
 *         description: Detailed zone statistics with house numbers
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
 *                     zoneId:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439012"
 *                     zoneName:
 *                       type: string
 *                       example: "Downtown District"
 *                     buildingData:
 *                       type: object
 *                       properties:
 *                         totalBuildings:
 *                           type: integer
 *                           example: 25
 *                         residentialHomes:
 *                           type: integer
 *                           example: 25
 *                         addresses:
 *                           type: array
 *                           items:
 *                             type: string
 *                         coordinates:
 *                           type: array
 *                           items:
 *                             type: array
 *                             items:
 *                               type: number
 *                         houseNumbers:
 *                           type: object
 *                           properties:
 *                             odd:
 *                               type: array
 *                               items:
 *                                 type: integer
 *                             even:
 *                               type: array
 *                               items:
 *                                 type: integer
 *                     houseNumberStats:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 25
 *                         oddCount:
 *                           type: integer
 *                           example: 13
 *                         evenCount:
 *                           type: integer
 *                           example: 12
 *                         oddRange:
 *                           type: object
 *                           properties:
 *                             min:
 *                               type: integer
 *                             max:
 *                               type: integer
 *                         evenRange:
 *                           type: object
 *                           properties:
 *                             min:
 *                               type: integer
 *                             max:
 *                               type: integer
 *       404:
 *         description: Zone not found
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
 *                   example: "Zone not found"
 */
router.get(
  '/detailed-stats/:id',
  validate(getZoneByIdValidation),
  getZoneDetailedStats
);

/**
 * @openapi
 * /api/zones/overview-stats:
 *   get:
 *     summary: Get overall territory statistics for dashboard
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Territory overview statistics
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
 *                     totalTerritories:
 *                       type: integer
 *                       example: 5
 *                     activeTerritories:
 *                       type: integer
 *                       example: 4
 *                     assignedTerritories:
 *                       type: integer
 *                       example: 4
 *                     unassignedTerritories:
 *                       type: integer
 *                       example: 1
 *                     totalResidents:
 *                       type: integer
 *                       example: 155
 *                     activeResidents:
 *                       type: integer
 *                       example: 131
 *                     averageCompletionRate:
 *                       type: integer
 *                       example: 82
 *                     totalArea:
 *                       type: integer
 *                       example: 1250000
 *                     recentActivity:
 *                       type: integer
 *                       example: 12
 *                     topPerformingTerritory:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                           example: "South Dallas Residential"
 *                         completionRate:
 *                           type: integer
 *                           example: 92
 */
router.get(
  '/overview-stats',
  getTerritoryOverviewStats
);

/**
 * @openapi
 * /api/zones/{id}/residents:
 *   get:
 *     summary: Get residents for a specific zone
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "507f1f77bcf86cd799439012"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [not-visited, interested, visited, callback, appointment, follow-up, not-interested]
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
 *           example: 50
 *     responses:
 *       200:
 *         description: Zone residents with status summary
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
 *                     residents:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           address:
 *                             type: string
 *                           coordinates:
 *                             type: array
 *                             items:
 *                               type: number
 *                           houseNumber:
 *                             type: integer
 *                           status:
 *                             type: string
 *                           notes:
 *                             type: string
 *                           phone:
 *                             type: string
 *                           email:
 *                             type: string
 *                           lastVisited:
 *                             type: string
 *                             format: date-time
 *                     statusSummary:
 *                       type: object
 *                       properties:
 *                         "not-visited":
 *                           type: integer
 *                         interested:
 *                           type: integer
 *                         visited:
 *                           type: integer
 *                         callback:
 *                           type: integer
 *                         appointment:
 *                           type: integer
 *                         "follow-up":
 *                           type: integer
 *                         "not-interested":
 *                           type: integer
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         pages:
 *                           type: integer
 */
router.get(
  '/:id/residents',
  validate(getZoneByIdValidation),
  getZoneResidents
);

/**
 * @openapi
 * /api/zones/residents/{residentId}:
 *   put:
 *     summary: Update resident status
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: residentId
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
 *               status:
 *                 type: string
 *                 enum: [not-visited, interested, visited, callback, appointment, follow-up, not-interested]
 *                 example: "visited"
 *               notes:
 *                 type: string
 *                 example: "Resident was very interested in our services"
 *               phone:
 *                 type: string
 *                 example: "+1234567890"
 *               email:
 *                 type: string
 *                 example: "resident@example.com"
 *     responses:
 *       200:
 *         description: Resident status updated successfully
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
 *                   example: "Resident status updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     address:
 *                       type: string
 *                     status:
 *                       type: string
 *                     notes:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     email:
 *                       type: string
 *                     lastVisited:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Resident not found
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
 *                   example: "Resident not found"
 */
router.put(
  '/residents/:residentId',
  updateResidentStatus
);

export default router;
