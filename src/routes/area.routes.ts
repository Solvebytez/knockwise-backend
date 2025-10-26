import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  getAllAreas,
  getAreaById,
  getMunicipalitiesByArea,
  getCommunitiesByMunicipality,
  getCommunitiesByArea,
  getLocationHierarchy,
  searchLocations,
} from "../controllers/area.controller";

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /api/areas:
 *   get:
 *     summary: Get all areas with municipalities and communities
 *     tags: [Areas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Areas retrieved successfully
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
 *                         example: "68f248b6f061ee5b03d474a7"
 *                       name:
 *                         type: string
 *                         example: "Peel"
 *                       type:
 *                         type: string
 *                         example: "Area"
 *                       municipalities:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             _id:
 *                               type: string
 *                             name:
 *                               type: string
 *                             communities:
 *                               type: array
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   _id:
 *                                     type: string
 *                                   name:
 *                                     type: string
 *                                   type:
 *                                     type: string
 */
router.get("/", getAllAreas);

/**
 * @openapi
 * /api/areas/{id}:
 *   get:
 *     summary: Get area by ID with populated data
 *     tags: [Areas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "68f248b6f061ee5b03d474a7"
 *     responses:
 *       200:
 *         description: Area retrieved successfully
 *       404:
 *         description: Area not found
 */
router.get("/:id", getAreaById);

/**
 * @openapi
 * /api/areas/{areaId}/municipalities:
 *   get:
 *     summary: Get municipalities by area ID
 *     tags: [Areas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: areaId
 *         required: true
 *         schema:
 *           type: string
 *         example: "68f248b6f061ee5b03d474a7"
 *     responses:
 *       200:
 *         description: Municipalities retrieved successfully
 */
router.get("/:areaId/municipalities", getMunicipalitiesByArea);

/**
 * @openapi
 * /api/areas/{areaId}/communities:
 *   get:
 *     summary: Get all communities in an area
 *     tags: [Areas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: areaId
 *         required: true
 *         schema:
 *           type: string
 *         example: "68f248b6f061ee5b03d474a7"
 *     responses:
 *       200:
 *         description: Communities retrieved successfully
 */
router.get("/:areaId/communities", getCommunitiesByArea);

/**
 * @openapi
 * /api/areas/municipalities/{municipalityId}/communities:
 *   get:
 *     summary: Get communities by municipality ID
 *     tags: [Areas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: municipalityId
 *         required: true
 *         schema:
 *           type: string
 *         example: "68f248b6f061ee5b03d474a9"
 *     responses:
 *       200:
 *         description: Communities retrieved successfully
 */
router.get(
  "/municipalities/:municipalityId/communities",
  getCommunitiesByMunicipality
);

/**
 * @openapi
 * /api/areas/communities/{communityId}/hierarchy:
 *   get:
 *     summary: Get complete location hierarchy for a community
 *     tags: [Areas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: communityId
 *         required: true
 *         schema:
 *           type: string
 *         example: "68f248b6f061ee5b03d474ab"
 *     responses:
 *       200:
 *         description: Location hierarchy retrieved successfully
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
 *                     community:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         type:
 *                           type: string
 *                     municipality:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         type:
 *                           type: string
 *                     area:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         type:
 *                           type: string
 */
router.get("/communities/:communityId/hierarchy", getLocationHierarchy);

/**
 * @openapi
 * /api/areas/search:
 *   get:
 *     summary: Search locations by name
 *     tags: [Areas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *         example: "Brampton"
 *       - in: query
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *           enum: [area, municipality, community]
 *         example: "municipality"
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
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
 *                     areas:
 *                       type: array
 *                       items:
 *                         type: object
 *                     municipalities:
 *                       type: array
 *                       items:
 *                         type: object
 *                     communities:
 *                       type: array
 *                       items:
 *                         type: object
 */
router.get("/search", searchLocations);

export default router;

