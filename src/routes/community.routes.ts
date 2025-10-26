import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  getAllCommunities,
  getCommunityById,
  getCommunitiesByArea,
  getCommunitiesByMunicipality,
  getCommunityStats,
} from "../controllers/community.controller";

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /api/communities:
 *   get:
 *     summary: Get all communities with their municipalities and areas
 *     tags: [Communities]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Communities retrieved successfully
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
 *                         example: "68f248b6f061ee5b03d474ab"
 *                       name:
 *                         type: string
 *                         example: "Airport Road/ Highway 7 Business"
 *                       type:
 *                         type: string
 *                         example: "Community"
 *                       municipalityId:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           type:
 *                             type: string
 *                       areaId:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           type:
 *                             type: string
 */
router.get("/", getAllCommunities);

/**
 * @openapi
 * /api/communities/{id}:
 *   get:
 *     summary: Get community by ID with populated data
 *     tags: [Communities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "68f248b6f061ee5b03d474ab"
 *     responses:
 *       200:
 *         description: Community retrieved successfully
 *       404:
 *         description: Community not found
 */
router.get("/:id", getCommunityById);

/**
 * @openapi
 * /api/communities/area/{areaId}:
 *   get:
 *     summary: Get communities by area ID
 *     tags: [Communities]
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
router.get("/area/:areaId", getCommunitiesByArea);

/**
 * @openapi
 * /api/communities/municipality/{municipalityId}:
 *   get:
 *     summary: Get communities by municipality ID
 *     tags: [Communities]
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
router.get("/municipality/:municipalityId", getCommunitiesByMunicipality);

/**
 * @openapi
 * /api/communities/{id}/stats:
 *   get:
 *     summary: Get community statistics
 *     tags: [Communities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "68f248b6f061ee5b03d474ab"
 *     responses:
 *       200:
 *         description: Community statistics retrieved successfully
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
 *                     area:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 */
router.get("/:id/stats", getCommunityStats);

export default router;

