import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  getAllMunicipalities,
  getMunicipalityById,
  getCommunitiesByMunicipality,
  getMunicipalityStats,
} from "../controllers/municipality.controller";

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /api/municipalities:
 *   get:
 *     summary: Get all municipalities with their areas and communities
 *     tags: [Municipalities]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Municipalities retrieved successfully
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
 *                         example: "68f248b6f061ee5b03d474a9"
 *                       name:
 *                         type: string
 *                         example: "Brampton"
 *                       type:
 *                         type: string
 *                         example: "Municipality"
 *                       areaId:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           type:
 *                             type: string
 *                       communities:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             _id:
 *                               type: string
 *                             name:
 *                               type: string
 *                             type:
 *                               type: string
 */
router.get("/", getAllMunicipalities);

/**
 * @openapi
 * /api/municipalities/{id}:
 *   get:
 *     summary: Get municipality by ID with populated data
 *     tags: [Municipalities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "68f248b6f061ee5b03d474a9"
 *     responses:
 *       200:
 *         description: Municipality retrieved successfully
 *       404:
 *         description: Municipality not found
 */
router.get("/:id", getMunicipalityById);

/**
 * @openapi
 * /api/municipalities/{municipalityId}/communities:
 *   get:
 *     summary: Get communities by municipality ID
 *     tags: [Municipalities]
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
router.get("/:municipalityId/communities", getCommunitiesByMunicipality);

/**
 * @openapi
 * /api/municipalities/{id}/stats:
 *   get:
 *     summary: Get municipality statistics
 *     tags: [Municipalities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "68f248b6f061ee5b03d474a9"
 *     responses:
 *       200:
 *         description: Municipality statistics retrieved successfully
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
 *                     communityCount:
 *                       type: number
 *                       example: 47
 *                     totalCommunities:
 *                       type: number
 *                       example: 47
 */
router.get("/:id/stats", getMunicipalityStats);

export default router;

