import { Router } from 'express';
import { requireAuth, requireRoles } from '../middleware/auth';
import {
  searchProperties,
  getPropertyById,
  bulkImportProperties,
  updatePropertyScores,
} from '../controllers/property.controller';
import { validate } from '../utils/validator';
import {
  bulkImportPropertiesValidation,
  updatePropertyScoresValidation,
  getPropertyByIdValidation,
} from '../validators';

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /api/properties/search:
 *   get:
 *     summary: Search properties (DataGrid)
 *     tags: [Properties]
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *       - in: query
 *         name: minLeadScore
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Properties found
 */
router.get('/search', searchProperties);

/**
 * @openapi
 * /api/properties/{id}:
 *   get:
 *     summary: Get property by ID
 *     tags: [Properties]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Property details
 */
router.get('/:id', validate(getPropertyByIdValidation), getPropertyById);

/**
 * @openapi
 * /api/properties/bulk-import:
 *   post:
 *     summary: Bulk import properties
 *     tags: [Properties]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               properties:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Import results
 */
router.post(
  '/bulk-import',
  requireAuth,
  requireRoles('SUPERADMIN', 'SUBADMIN'),
  validate(bulkImportPropertiesValidation),
  bulkImportProperties
);

/**
 * @openapi
 * /api/properties/{id}/scores:
 *   patch:
 *     summary: Update property scores
 *     tags: [Properties]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               leadScore:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 100
 *               motivationScore:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 100
 *               equityScore:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 100
 *     responses:
 *       200:
 *         description: Updated property
 */
router.patch(
  '/:id/scores',
  requireAuth,
  requireRoles('SUPERADMIN', 'SUBADMIN'),
  validate(updatePropertyScoresValidation),
  updatePropertyScores
);

export default router;
