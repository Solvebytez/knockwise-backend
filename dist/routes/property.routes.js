"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const property_controller_1 = require("../controllers/property.controller");
const validator_1 = require("../utils/validator");
const validators_1 = require("../validators");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
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
router.get('/search', property_controller_1.searchProperties);
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
router.get('/:id', (0, validator_1.validate)(validators_1.getPropertyByIdValidation), property_controller_1.getPropertyById);
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
router.post('/bulk-import', auth_1.requireAuth, (0, auth_1.requireRoles)('SUPERADMIN', 'SUBADMIN'), (0, validator_1.validate)(validators_1.bulkImportPropertiesValidation), property_controller_1.bulkImportProperties);
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
router.patch('/:id/scores', auth_1.requireAuth, (0, auth_1.requireRoles)('SUPERADMIN', 'SUBADMIN'), (0, validator_1.validate)(validators_1.updatePropertyScoresValidation), property_controller_1.updatePropertyScores);
exports.default = router;
//# sourceMappingURL=property.routes.js.map