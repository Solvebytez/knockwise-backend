import { Router } from 'express';
import { requireAuth, requireRoles } from '../middleware/auth';
import { validate } from '../utils/validator';
import { 
  createTeam, 
  getMyTeams, 
  getTeamById, 
  updateTeam, 
  deleteTeam,
  getTeamStats,
  getTeamPerformance
} from '../controllers/team.controller';
import { createTeamValidation, updateTeamValidation } from '../validators/team.validator';

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /api/teams:
 *   post:
 *     summary: Create a new team
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, memberIds]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 example: "Sales Team Alpha"
 *               description:
 *                 type: string
 *                 example: "High-performing sales team for premium properties"
 *               memberIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 minItems: 1
 *                 example: ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"]
 *     responses:
 *       201:
 *         description: Team created successfully
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
 *                   example: "Team created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439013"
 *                     name:
 *                       type: string
 *                       example: "Sales Team Alpha"
 *                     description:
 *                       type: string
 *                       example: "High-performing sales team for premium properties"
 *                     leaderId:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         email:
 *                           type: string
 *                     agentIds:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           email:
 *                             type: string
 *                           status:
 *                             type: string
 *       400:
 *         description: Bad request
 *       409:
 *         description: Team name already exists
 */
router.post(
  '/',
  requireRoles('SUPERADMIN', 'SUBADMIN'),
  validate(createTeamValidation),
  createTeam
);

/**
 * @openapi
 * /api/teams:
 *   get:
 *     summary: Get all teams for current admin
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search teams by name
 *     responses:
 *       200:
 *         description: List of teams
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
 *                       leaderId:
 *                         type: object
 *                       agentIds:
 *                         type: array
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
 */
router.get(
  '/',
  requireRoles('SUPERADMIN', 'SUBADMIN'),
  getMyTeams
);

/**
 * @openapi
 * /api/teams/stats:
 *   get:
 *     summary: Get team statistics for dashboard
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Team statistics retrieved successfully
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
 *                     totalTeams:
 *                       type: integer
 *                       example: 4
 *                     totalMembers:
 *                       type: integer
 *                       example: 25
 *                     activeMembers:
 *                       type: integer
 *                       example: 22
 *                     inactiveMembers:
 *                       type: integer
 *                       example: 3
 *                     totalZones:
 *                       type: integer
 *                       example: 8
 *                     averagePerformance:
 *                       type: integer
 *                       example: 78
 *                     topPerformingTeam:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                           example: "Team Alpha"
 *                         performance:
 *                           type: integer
 *                           example: 92
 *                     recentActivity:
 *                       type: object
 *                       properties:
 *                         newMembers:
 *                           type: integer
 *                           example: 3
 *                         completedTasks:
 *                           type: integer
 *                           example: 45
 *                         activeSessions:
 *                           type: integer
 *                           example: 18
 */
router.get(
  '/stats',
  requireRoles('SUPERADMIN', 'SUBADMIN'),
  getTeamStats
);

/**
 * @openapi
 * /api/teams/performance:
 *   get:
 *     summary: Get team performance data
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Team performance data retrieved successfully
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
 *                       teamId:
 *                         type: string
 *                         example: "507f1f77bcf86cd799439011"
 *                       teamName:
 *                         type: string
 *                         example: "Team Alpha"
 *                       memberCount:
 *                         type: integer
 *                         example: 6
 *                       averageKnocks:
 *                         type: integer
 *                         example: 85
 *                       completionRate:
 *                         type: integer
 *                         example: 92
 *                       zoneCoverage:
 *                         type: integer
 *                         example: 4
 */
router.get(
  '/performance',
  requireRoles('SUPERADMIN', 'SUBADMIN'),
  getTeamPerformance
);

/**
 * @openapi
 * /api/teams/{teamId}:
 *   get:
 *     summary: Get team by ID
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Team ID
 *     responses:
 *       200:
 *         description: Team details
 *       404:
 *         description: Team not found
 */
router.get(
  '/:teamId',
  requireRoles('SUPERADMIN', 'SUBADMIN'),
  getTeamById
);

/**
 * @openapi
 * /api/teams/{teamId}:
 *   put:
 *     summary: Update team
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Team ID
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
 *               description:
 *                 type: string
 *               memberIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 minItems: 1
 *     responses:
 *       200:
 *         description: Team updated successfully
 *       404:
 *         description: Team not found
 *       409:
 *         description: Team name already exists
 */
router.put(
  '/:teamId',
  requireRoles('SUPERADMIN', 'SUBADMIN'),
  validate(updateTeamValidation),
  updateTeam
);

/**
 * @openapi
 * /api/teams/{teamId}:
 *   delete:
 *     summary: Delete team
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Team ID
 *     responses:
 *       200:
 *         description: Team deleted successfully
 *       404:
 *         description: Team not found
 */
router.delete(
  '/:teamId',
  requireRoles('SUPERADMIN', 'SUBADMIN'),
  deleteTeam
);

export default router;
