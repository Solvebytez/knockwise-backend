"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const zone_controller_1 = require("../controllers/zone.controller");
const validator_1 = require("../utils/validator");
const validators_1 = require("../validators");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
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
router.post('/check-overlap', (0, auth_1.requireRoles)('SUPERADMIN', 'SUBADMIN'), zone_controller_1.checkZoneOverlapBeforeCreate);
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
router.post('/create-zone', (0, auth_1.requireRoles)('SUPERADMIN', 'SUBADMIN'), (0, validator_1.validate)(validators_1.createZoneValidation), zone_controller_1.createZone);
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
router.get('/list-all', (0, validator_1.validate)(validators_1.listZonesValidation), zone_controller_1.listZones);
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
router.get('/get-by-id/:id', (0, validator_1.validate)(validators_1.getZoneByIdValidation), zone_controller_1.getZoneById);
/**
 * @openapi
 * /api/zones/map-view/{id}:
 *   get:
 *     summary: Get territory map view data (zone details + residents)
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
 *         description: Territory map view data retrieved successfully
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
 *                     zone:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         description:
 *                           type: string
 *                         boundary:
 *                           type: object
 *                         status:
 *                           type: string
 *                         totalResidents:
 *                           type: number
 *                         activeResidents:
 *                           type: number
 *                         assignedTo:
 *                           type: object
 *                     properties:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           address:
 *                             type: string
 *                           houseNumber:
 *                             type: number
 *                           coordinates:
 *                             type: array
 *                           status:
 *                             type: string
 *                           lastVisited:
 *                             type: string
 *                           residents:
 *                             type: array
 *                     statusSummary:
 *                       type: object
 *                     statistics:
 *                       type: object
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
router.get('/map-view/:id', (0, validator_1.validate)(validators_1.getZoneByIdValidation), zone_controller_1.getTerritoryMapView);
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
router.put('/update/:id', (0, auth_1.requireRoles)('SUPERADMIN', 'SUBADMIN'), (0, validator_1.validate)(validators_1.updateZoneValidation), zone_controller_1.updateZone);
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
router.delete('/delete/:id', (0, auth_1.requireRoles)('SUPERADMIN', 'SUBADMIN'), (0, validator_1.validate)(validators_1.deleteZoneValidation), zone_controller_1.deleteZone);
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
router.post('/assign-agent-to-zone', (0, auth_1.requireRoles)('SUPERADMIN', 'SUBADMIN'), (0, validator_1.validate)(validators_1.assignAgentToZoneValidation), zone_controller_1.assignAgentToZone);
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
router.get('/list-assignments', (0, validator_1.validate)(validators_1.getZoneAssignmentsValidation), zone_controller_1.getZoneAssignments);
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
router.put('/remove-agent-from-zone/:assignmentId', (0, auth_1.requireRoles)('SUPERADMIN', 'SUBADMIN'), (0, validator_1.validate)(validators_1.removeAgentFromZoneValidation), zone_controller_1.removeAgentFromZone);
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
router.post('/assign-team-to-zone', (0, auth_1.requireRoles)('SUPERADMIN', 'SUBADMIN'), zone_controller_1.assignTeamToZone);
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
router.put('/remove-team-from-zone/:zoneId', (0, auth_1.requireRoles)('SUPERADMIN', 'SUBADMIN'), zone_controller_1.removeTeamFromZone);
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
router.get('/find-by-proximity', (0, validator_1.validate)(validators_1.getZonesByProximityValidation), zone_controller_1.getZonesByProximity);
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
router.get('/statistics/:zoneId', (0, validator_1.validate)(validators_1.getZoneStatisticsValidation), zone_controller_1.getZoneStatistics);
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
router.get('/detailed-stats/:id', (0, validator_1.validate)(validators_1.getZoneByIdValidation), zone_controller_1.getZoneDetailedStats);
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
router.get('/overview-stats', zone_controller_1.getTerritoryOverviewStats);
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
router.get('/:id/residents', (0, validator_1.validate)(validators_1.getZoneByIdValidation), zone_controller_1.getZoneResidents);
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
router.put('/residents/:residentId', zone_controller_1.updateResidentStatus);
/**
 * @openapi
 * /api/zones/{zoneId}/building-stats:
 *   get:
 *     summary: Get building statistics by odd/even numbers for a specific zone
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: zoneId
 *         required: true
 *         schema:
 *           type: string
 *         example: "507f1f77bcf86cd799439013"
 *     responses:
 *       200:
 *         description: Building statistics retrieved successfully
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
 *                     zoneName:
 *                       type: string
 *                       example: "Downtown District"
 *                     totalBuildings:
 *                       type: integer
 *                       example: 25
 *                     residentialHomes:
 *                       type: integer
 *                       example: 25
 *                     oddBuildings:
 *                       type: object
 *                       properties:
 *                         count:
 *                           type: integer
 *                           example: 13
 *                         numbers:
 *                           type: array
 *                           items:
 *                             type: integer
 *                           example: [101, 103, 105, 107, 109, 111, 113, 115, 117, 119, 121, 123, 125]
 *                         range:
 *                           type: object
 *                           properties:
 *                             min:
 *                               type: integer
 *                               example: 101
 *                             max:
 *                               type: integer
 *                               example: 125
 *                     evenBuildings:
 *                       type: object
 *                       properties:
 *                         count:
 *                           type: integer
 *                           example: 12
 *                         numbers:
 *                           type: array
 *                           items:
 *                             type: integer
 *                           example: [100, 102, 104, 106, 108, 110, 112, 114, 116, 118, 120, 122]
 *                         range:
 *                           type: object
 *                           properties:
 *                             min:
 *                               type: integer
 *                               example: 100
 *                             max:
 *                               type: integer
 *                               example: 122
 *                     addresses:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["100 Main St", "101 Main St", "102 Main St"]
 *                     coordinates:
 *                       type: array
 *                       items:
 *                         type: array
 *                         items:
 *                           type: number
 *                       example: [[-74.0060, 40.7128], [-74.0061, 40.7129], [-74.0062, 40.7130]]
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
router.get('/:zoneId/building-stats', (0, validator_1.validate)(validators_1.getZoneByIdValidation), zone_controller_1.getZoneBuildingStats);
/**
 * @openapi
 * /api/zones/building-stats/all:
 *   get:
 *     summary: Get building statistics for all accessible zones
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Building statistics retrieved successfully
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
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalZones:
 *                           type: integer
 *                           example: 5
 *                         totalBuildings:
 *                           type: integer
 *                           example: 125
 *                         totalOddBuildings:
 *                           type: integer
 *                           example: 63
 *                         totalEvenBuildings:
 *                           type: integer
 *                           example: 62
 *                         averageBuildingsPerZone:
 *                           type: integer
 *                           example: 25
 *                     zones:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           zoneId:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439013"
 *                           zoneName:
 *                             type: string
 *                             example: "Downtown District"
 *                           status:
 *                             type: string
 *                             example: "ACTIVE"
 *                           totalBuildings:
 *                             type: integer
 *                             example: 25
 *                           oddCount:
 *                             type: integer
 *                             example: 13
 *                           evenCount:
 *                             type: integer
 *                             example: 12
 *                           oddRange:
 *                             type: object
 *                             properties:
 *                               min:
 *                                 type: integer
 *                                 example: 101
 *                               max:
 *                                 type: integer
 *                                 example: 125
 *                           evenRange:
 *                             type: object
 *                             properties:
 *                               min:
 *                                 type: integer
 *                                 example: 100
 *                               max:
 *                                 type: integer
 *                                 example: 122
 */
router.get('/building-stats/all', zone_controller_1.getAllZonesBuildingStats);
exports.default = router;
//# sourceMappingURL=zone.routes.js.map