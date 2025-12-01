import { Router } from "express";
import {
  createAgentZone,
  createMobileManualZone,
  updateMobileManualZone,
  updateAgentZone,
  getAgentZones,
  getAgentZoneById,
  getAgentZoneLocation,
  deleteAgentZone,
  checkAgentZoneOverlap,
  detectAgentZoneBuildings,
} from "../controllers/agentZone.controller";
import { requireAuth, requireRoles } from "../middleware/auth";
import { validate } from "../utils/validator";
import {
  createAgentZoneValidation,
  createMobileManualZoneValidation,
  updateAgentZoneValidation,
  getAgentZonesValidation,
  getAgentZoneByIdValidation,
  deleteAgentZoneValidation,
} from "../validators/agentZone.validator";

const router = Router();

/**
 * @openapi
 * /api/agent-zones:
 *   post:
 *     summary: Create a new zone and auto-assign it to the creating agent
 *     tags: [Agent Zones]
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
 *                 maxLength: 100
 *                 example: "My Territory"
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 example: "My personal territory for door-to-door sales"
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
 *                         type: array
 *                         items:
 *                           type: number
 *                     example: [[[-74.0060, 40.7128], [-74.0061, 40.7129], [-74.0062, 40.7130], [-74.0060, 40.7128]]]
 *               buildingData:
 *                 type: object
 *                 properties:
 *                   addresses:
 *                     type: array
 *                     items:
 *                       type: string
 *                   coordinates:
 *                     type: array
 *                     items:
 *                       type: array
 *                       items:
 *                         type: number
 *               communityId:
 *                 type: string
 *                 format: uuid
 *                 example: "507f1f77bcf86cd799439013"
 *     responses:
 *       201:
 *         description: Zone created and assigned successfully
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
 *                   example: "Zone created and assigned to you successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439012"
 *                     name:
 *                       type: string
 *                       example: "My Territory"
 *                     description:
 *                       type: string
 *                       example: "My personal territory for door-to-door sales"
 *                     assignedAgentId:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         email:
 *                           type: string
 *                     status:
 *                       type: string
 *                       example: "ACTIVE"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       403:
 *         description: Access denied - not an agent
 *       409:
 *         description: Zone name already exists or overlaps with existing zones
 */
router.post(
  "/",
  requireAuth,
  requireRoles("AGENT"),
  validate(createAgentZoneValidation),
  createAgentZone
);

/**
 * @openapi
 * /api/agent-zones/manual:
 *   post:
 *     summary: Create a new manual zone (no boundary required) for mobile
 *     tags: [Agent Zones]
 *     security:
 *       - bearerAuth: []
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
 *                 minLength: 2
 *                 maxLength: 100
 *                 example: "My Manual Zone"
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 example: "Manual zone for door-to-door sales"
 *               areaId:
 *                 type: string
 *                 format: uuid
 *                 example: "507f1f77bcf86cd799439011"
 *               municipalityId:
 *                 type: string
 *                 format: uuid
 *                 example: "507f1f77bcf86cd799439012"
 *               communityId:
 *                 type: string
 *                 format: uuid
 *                 example: "507f1f77bcf86cd799439013"
 *     responses:
 *       201:
 *         description: Manual zone created successfully
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
 *                   example: "Manual zone created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439012"
 *                     name:
 *                       type: string
 *                       example: "My Manual Zone"
 *                     description:
 *                       type: string
 *                       example: "Manual zone for door-to-door sales"
 *                     zoneType:
 *                       type: string
 *                       enum: [MANUAL]
 *                       example: "MANUAL"
 *                     status:
 *                       type: string
 *                       example: "ACTIVE"
 *       403:
 *         description: Access denied - not an agent
 *       409:
 *         description: Zone name already exists
 */
router.post(
  "/manual",
  requireAuth,
  requireRoles("AGENT"),
  validate(createMobileManualZoneValidation),
  createMobileManualZone
);

/**
 * @openapi
 * /api/agent-zones:
 *   get:
 *     summary: Get zones created by the current agent
 *     tags: [Agent Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of zones per page
 *     responses:
 *       200:
 *         description: List of agent's zones
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
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       status:
 *                         type: string
 *                       assignedAgentId:
 *                         type: object
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       403:
 *         description: Access denied - not an agent
 */
router.get(
  "/",
  requireAuth,
  requireRoles("AGENT"),
  validate(getAgentZonesValidation),
  getAgentZones
);

/**
 * @openapi
 * /api/agent-zones/{id}:
 *   get:
 *     summary: Get a specific zone created by the current agent
 *     tags: [Agent Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Zone ID
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
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     boundary:
 *                       type: object
 *                     assignedAgentId:
 *                       type: object
 *                     status:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       403:
 *         description: Access denied - not an agent
 *       404:
 *         description: Zone not found or not owned by agent
 */
router.get(
  "/:id",
  requireAuth,
  requireRoles("AGENT"),
  validate(getAgentZoneByIdValidation),
  getAgentZoneById
);

/**
 * @openapi
 * /api/agent-zones/{id}/location:
 *   get:
 *     summary: Get zone location hierarchy for agent zones
 *     tags: [Agent Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Zone ID
 *         example: "68f248b6f061ee5b03d474ab"
 *     responses:
 *       200:
 *         description: Zone location retrieved successfully
 *       404:
 *         description: Zone not found or access denied
 */
router.get(
  "/:id/location",
  requireAuth,
  requireRoles("AGENT"),
  getAgentZoneLocation
);

/**
 * @openapi
 * /api/agent-zones/check-overlap:
 *   post:
 *     summary: Check for zone overlaps before creation/update (Agent)
 *     tags: [Agent Zones]
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
 *                         type: array
 *                         items:
 *                           type: number
 *                     example: [[[-74.0060, 40.7128], [-74.0061, 40.7129], [-74.0062, 40.7130], [-74.0060, 40.7128]]]
 *               excludeZoneId:
 *                 type: string
 *                 description: Zone ID to exclude from overlap check (for updates)
 *                 example: "507f1f77bcf86cd799439012"
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
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                     overlapPercentage:
 *                       type: number
 *                       example: 0
 *       403:
 *         description: Access denied - not an agent
 */
router.post(
  "/check-overlap",
  requireAuth,
  requireRoles("AGENT"),
  checkAgentZoneOverlap
);

/**
 * @openapi
 * /api/agent-zones/detect-buildings:
 *   post:
 *     summary: Detect buildings inside a polygon (Agent mobile helper)
 *     tags: [Agent Zones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [polygon]
 *             properties:
 *               polygon:
 *                 type: array
 *                 description: Array of coordinates in { latitude, longitude } format
 *                 items:
 *                   type: object
 *                   properties:
 *                     latitude:
 *                       type: number
 *                     longitude:
 *                       type: number
 *                 example:
 *                   - latitude: 43.66512
 *                     longitude: -79.30983
 *                   - latitude: 43.66601
 *                     longitude: -79.30891
 *                   - latitude: 43.66457
 *                     longitude: -79.30745
 *     responses:
 *       200:
 *         description: Building detection completed
 *       400:
 *         description: Invalid polygon provided
 *       403:
 *         description: Access denied - not an agent
 */
router.post(
  "/detect-buildings",
  requireAuth,
  requireRoles("AGENT"),
  detectAgentZoneBuildings
);

/**
 * @openapi
 * /api/agent-zones/{id}:
 *   put:
 *     summary: Update a zone created by the current agent
 *     tags: [Agent Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Zone ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               boundary:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [Polygon]
 *                   coordinates:
 *                     type: array
 *               buildingData:
 *                 type: object
 *               communityId:
 *                 type: string
 *                 format: uuid
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
 *       403:
 *         description: Access denied - not an agent or not zone owner
 *       404:
 *         description: Zone not found
 *       409:
 *         description: Zone name already exists or overlaps with existing zones
 */
/**
 * @openapi
 * /api/agent-zones/manual/{id}:
 *   put:
 *     summary: Update a manual zone (name, description, location only)
 *     tags: [Agent Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Zone ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               areaId:
 *                 type: string
 *               municipalityId:
 *                 type: string
 *               communityId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Manual zone updated successfully
 *       403:
 *         description: Access denied - not an agent or not zone owner
 *       404:
 *         description: Zone not found
 *       409:
 *         description: Zone name already exists
 */
router.put(
  "/manual/:id",
  requireAuth,
  requireRoles("AGENT"),
  validate(updateAgentZoneValidation),
  updateMobileManualZone
);

router.put(
  "/:id",
  requireAuth,
  requireRoles("AGENT"),
  validate(updateAgentZoneValidation),
  updateAgentZone
);

/**
 * @openapi
 * /api/agent-zones/{id}:
 *   delete:
 *     summary: Delete a zone created by the current agent
 *     tags: [Agent Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Zone ID
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
 *       403:
 *         description: Access denied - not an agent or not zone owner
 *       404:
 *         description: Zone not found
 */
router.delete(
  "/:id",
  requireAuth,
  requireRoles("AGENT"),
  validate(deleteAgentZoneValidation),
  deleteAgentZone
);

export default router;
