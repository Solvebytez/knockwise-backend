"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const zone_controller_1 = require("../controllers/zone.controller");
const validator_1 = require("../utils/validator");
const validators_1 = require("../validators");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
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
 *           enum: [ACTIVE, INACTIVE]
 *           example: "ACTIVE"
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
 *           enum: [ACTIVE, INACTIVE]
 *           example: "ACTIVE"
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
exports.default = router;
//# sourceMappingURL=zone.routes.js.map