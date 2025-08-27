import { Router, Response } from 'express';
import { requireAuth, requireRoles, AuthRequest } from '../middleware/auth';
import {
  createUser,
  updateUser,
  deleteUser,
  getUserById,
  listUsers,
  getMyTeamMembers,
  assignAgentToTeam,
  getMyProfile,
  updateMyProfile,
  getMyZoneInfo,
  getSystemAnalytics,
  getTeamPerformance,
  getMyCreatedAgents,
  getTeamOverview,
  getRecentAdditions,
  updateAgentZoneAssignment,
  bulkUpdateAgentStatuses,
  getDetailedAgent,
  refreshAllStatuses,
  refreshAssignmentStatuses,
} from '../controllers/user.controller';
import { validate } from '../utils/validator';
import {
  createUserValidation,
  createAgentValidation,
  updateUserValidation,
  assignAgentToTeamValidation,
  updateProfileValidation,
  listUsersValidation,
  getUserByIdValidation,
  deleteUserValidation,
  getMyTeamMembersValidation,
  getTeamPerformanceValidation
} from '../validators';

const router = Router();

router.use(requireAuth);

// Superadmin endpoints
/**
 * @openapi
 * /api/users/create-subadmin:
 *   post:
 *     summary: Create a new subadmin/leader (Superadmin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, role]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 example: "John Leader"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john.leader@knockwise.com"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "secret123"
 *               role:
 *                 type: string
 *                 enum: [SUPERADMIN, SUBADMIN, AGENT]
 *                 example: "SUBADMIN"
 *               teamId:
 *                 type: string
 *                 format: uuid
 *                 example: "507f1f77bcf86cd799439011"
 *               zoneId:
 *                 type: string
 *                 format: uuid
 *                 example: "507f1f77bcf86cd799439012"
 *     responses:
 *       201:
 *         description: User created successfully
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
 *                   example: "User created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439013"
 *                     name:
 *                       type: string
 *                       example: "John Leader"
 *                     email:
 *                       type: string
 *                       example: "john.leader@knockwise.com"
 *                     role:
 *                       type: string
 *                       example: "SUBADMIN"
 *                     status:
 *                       type: string
 *                       example: "ACTIVE"
 *                     teamId:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439011"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00.000Z"
 *       409:
 *         description: Email already exists
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
 *                   example: "Email already exists"
 */
router.post(
  '/create-subadmin',
  requireRoles('SUPERADMIN'),
  validate(createUserValidation),
  createUser
);

/**
 * @openapi
 * /api/users/create-agent:
 *   post:
 *     summary: Create a new agent (Superadmin/Subadmin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 example: "Jane Agent"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "jane.agent@knockwise.com"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "secret123"
 *               teamId:
 *                 type: string
 *                 format: uuid
 *                 example: "507f1f77bcf86cd799439011"
 *               zoneId:
 *                 type: string
 *                 format: uuid
 *                 example: "507f1f77bcf86cd799439012"
 *     responses:
 *       201:
 *         description: Agent created successfully
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
 *                   example: "Agent created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439014"
 *                     name:
 *                       type: string
 *                       example: "Jane Agent"
 *                     email:
 *                       type: string
 *                       example: "jane.agent@knockwise.com"
 *                     role:
 *                       type: string
 *                       example: "AGENT"
 *                     status:
 *                       type: string
 *                       example: "ACTIVE"
 *                     teamId:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439011"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00.000Z"
 *       409:
 *         description: Email already exists
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
 *                   example: "Email already exists"
 */
router.post(
  '/create-agent',
  requireRoles('SUPERADMIN', 'SUBADMIN'),
  validate(createAgentValidation),
  async (req: AuthRequest, res: Response) => {
    req.body.role = 'AGENT'; // Force role to AGENT
    return createUser(req, res);
  }
);

/**
 * @openapi
 * /api/users/list-all:
 *   get:
 *     summary: List all users with pagination (Superadmin/Subadmin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [SUPERADMIN, SUBADMIN, AGENT]
 *           example: "AGENT"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE]
 *           example: "ACTIVE"
 *       - in: query
 *         name: teamId
 *         schema:
 *           type: string
 *           example: "507f1f77bcf86cd799439011"
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           description: Search by name, email, or username
 *           example: "john"
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
 *     responses:
 *       200:
 *         description: List of users with pagination
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
 *                         example: "507f1f77bcf86cd799439013"
 *                       name:
 *                         type: string
 *                         example: "John Doe"
 *                       email:
 *                         type: string
 *                         example: "john.doe@knockwise.com"
 *                       role:
 *                         type: string
 *                         example: "AGENT"
 *                       status:
 *                         type: string
 *                         example: "ACTIVE"
 *                       primaryTeamId:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439011"
 *                           name:
 *                             type: string
 *                             example: "Team Alpha"
 *                       primaryZoneId:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439012"
 *                           name:
 *                             type: string
 *                             example: "Downtown District"
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
  requireRoles('SUPERADMIN', 'SUBADMIN'),
  validate(listUsersValidation),
  listUsers
);

/**
 * @openapi
 * /api/users/my-created-agents:
 *   get:
 *     summary: Get agents created by current admin (Superadmin/Subadmin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE]
 *           example: "ACTIVE"
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           example: "john"
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE]
 *           description: Filter agents by status (defaults to ACTIVE)
 *           example: "ACTIVE"
 *       - in: query
 *         name: excludeTeamId
 *         schema:
 *           type: string
 *           description: Exclude agents who are already members of this team (useful for team editing)
 *           example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: List of agents created by current admin
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
 *                         example: "507f1f77bcf86cd799439013"
 *                       name:
 *                         type: string
 *                         example: "John Doe"
 *                       email:
 *                         type: string
 *                         example: "john.doe@knockwise.com"
 *                       username:
 *                         type: string
 *                         example: "johndoe"
 *                       contactNumber:
 *                         type: string
 *                         example: "+1234567890"
 *                       role:
 *                         type: string
 *                         example: "AGENT"
 *                       status:
 *                         type: string
 *                         example: "ACTIVE"
 *                       primaryTeamId:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439011"
 *                           name:
 *                             type: string
 *                             example: "Team Alpha"
 *                       primaryZoneId:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439012"
 *                           name:
 *                             type: string
 *                             example: "Downtown District"
 *                       createdBy:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439010"
 *                           name:
 *                             type: string
 *                             example: "Admin User"
 *                           email:
 *                             type: string
 *                             example: "admin@knockwise.com"
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
  '/my-created-agents',
  requireRoles('SUPERADMIN', 'SUBADMIN'),
  getMyCreatedAgents
);

/**
 * @openapi
 * /api/users/team-overview:
 *   get:
 *     summary: Get team overview for current admin (Superadmin/Subadmin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Team overview data
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
 *                     totalAgents:
 *                       type: integer
 *                       example: 25
 *                     activeAgents:
 *                       type: integer
 *                       example: 20
 *                     inactiveAgents:
 *                       type: integer
 *                       example: 5
 *                     agentsThisMonth:
 *                       type: integer
 *                       example: 8
 */
router.get(
  '/team-overview',
  requireRoles('SUPERADMIN', 'SUBADMIN'),
  getTeamOverview
);

/**
 * @openapi
 * /api/users/recent-additions:
 *   get:
 *     summary: Get recent agent additions for current admin (Superadmin/Subadmin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 20
 *           default: 5
 *         example: 5
 *     responses:
 *       200:
 *         description: Recent agent additions
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
 *                         example: "507f1f77bcf86cd799439013"
 *                       name:
 *                         type: string
 *                         example: "John Doe"
 *                       email:
 *                         type: string
 *                         example: "john.doe@knockwise.com"
 *                       status:
 *                         type: string
 *                         example: "ACTIVE"
 *                       primaryZoneId:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439012"
 *                           name:
 *                             type: string
 *                             example: "Downtown District"
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-01-15T10:30:00.000Z"
 */
router.get(
  '/recent-additions',
  requireRoles('SUPERADMIN', 'SUBADMIN'),
  getRecentAdditions
);

/**
 * @openapi
 * /api/users/update-agent-zone/{agentId}:
 *   put:
 *     summary: Update agent zone assignment and automatically update status (Superadmin/Subadmin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
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
 *               primaryZoneId:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439012"
 *               zoneIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["507f1f77bcf86cd799439012", "507f1f77bcf86cd799439013"]
 *     responses:
 *       200:
 *         description: Agent zone assignment updated successfully
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
 *                   example: "Agent zone assignment updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439013"
 *                     name:
 *                       type: string
 *                       example: "John Doe"
 *                     status:
 *                       type: string
 *                       example: "ACTIVE"
 *                     primaryZoneId:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439012"
 *                     zoneIds:
 *                       type: array
 *                       items:
 *                         type: string
 *       404:
 *         description: Agent not found
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
 *                   example: "Agent not found"
 */
router.put(
  '/update-agent-zone/:agentId',
  requireRoles('SUPERADMIN', 'SUBADMIN'),
  updateAgentZoneAssignment
);

/**
 * @openapi
 * /api/users/bulk-update-agent-statuses:
 *   post:
 *     summary: Bulk update agent statuses (Superadmin/Subadmin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [agentIds, status]
 *             properties:
 *               agentIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["507f1f77bcf86cd799439013", "507f1f77bcf86cd799439014"]
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE]
 *                 example: "ACTIVE"
 *     responses:
 *       200:
 *         description: Agent statuses updated successfully
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
 *                   example: "Agent statuses updated successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: "507f1f77bcf86cd799439013"
 *                       name:
 *                         type: string
 *                         example: "John Doe"
 *                       status:
 *                         type: string
 *                         example: "ACTIVE"
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-01-15T10:30:00.000Z"
 *       400:
 *         description: Invalid request body
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
 *                   example: "Invalid request body"
 *       404:
 *         description: Agents not found
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
 *                   example: "Agents not found"
 */
router.post(
  '/bulk-update-agent-statuses',
  requireRoles('SUPERADMIN', 'SUBADMIN'),
  bulkUpdateAgentStatuses
);

/**
 * @openapi
 * /api/users/get-by-id/{id}:
 *   get:
 *     summary: Get user by ID (Superadmin/Subadmin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "507f1f77bcf86cd799439013"
 *     responses:
 *       200:
 *         description: User details
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
 *                       example: "507f1f77bcf86cd799439013"
 *                     name:
 *                       type: string
 *                       example: "John Doe"
 *                     email:
 *                       type: string
 *                       example: "john.doe@knockwise.com"
 *                     role:
 *                       type: string
 *                       example: "AGENT"
 *                     status:
 *                       type: string
 *                       example: "ACTIVE"
 *                     teamId:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: "507f1f77bcf86cd799439011"
 *                         name:
 *                           type: string
 *                           example: "Team Alpha"
 *                     zoneId:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: "507f1f77bcf86cd799439012"
 *                         name:
 *                           type: string
 *                           example: "Downtown District"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00.000Z"
 *       404:
 *         description: User not found
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
 *                   example: "User not found"
 */
router.get(
  '/get-by-id/:id',
  requireAuth,
  requireRoles('SUPERADMIN', 'SUBADMIN'),
  validate(getUserByIdValidation),
  getUserById
);

/**
 * @openapi
 * /api/users/update/{id}:
 *   put:
 *     summary: Update user (Superadmin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               name:
 *                 type: string
 *                 example: "Updated John Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "updated.john@knockwise.com"
 *               role:
 *                 type: string
 *                 enum: [SUPERADMIN, SUBADMIN, AGENT]
 *                 example: "AGENT"
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE]
 *                 example: "ACTIVE"
 *               teamId:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439011"
 *               zoneId:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439012"
 *     responses:
 *       200:
 *         description: User updated successfully
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
 *                   example: "User updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439013"
 *                     name:
 *                       type: string
 *                       example: "Updated John Doe"
 *                     email:
 *                       type: string
 *                       example: "updated.john@knockwise.com"
 *                     role:
 *                       type: string
 *                       example: "AGENT"
 *                     status:
 *                       type: string
 *                       example: "ACTIVE"
 *       403:
 *         description: Insufficient permissions
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
 *                   example: "Insufficient permissions"
 *       404:
 *         description: User not found
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
 *                   example: "User not found"
 */
router.put(
  '/update/:id',
  requireAuth,
  requireRoles('SUPERADMIN', 'SUBADMIN'),
  validate(updateUserValidation),
  updateUser
);

/**
 * @openapi
 * /api/users/delete/{id}:
 *   delete:
 *     summary: Delete user (Superadmin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "507f1f77bcf86cd799439013"
 *     responses:
 *       200:
 *         description: User deleted successfully
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
 *                   example: "User deleted successfully"
 *       403:
 *         description: Insufficient permissions
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
 *                   example: "Insufficient permissions"
 *       404:
 *         description: User not found
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
 *                   example: "User not found"
 */
router.delete(
  '/delete/:id',
  requireAuth,
  requireRoles('SUPERADMIN', 'SUBADMIN'),
  validate(deleteUserValidation),
  deleteUser
);

// Subadmin/Leader endpoints
/**
 * @openapi
 * /api/users/my-team-members:
 *   get:
 *     summary: Get my team members (Subadmin/Agent only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Team members list
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
 *                         example: "507f1f77bcf86cd799439013"
 *                       name:
 *                         type: string
 *                         example: "John Doe"
 *                       email:
 *                         type: string
 *                         example: "john.doe@knockwise.com"
 *                       role:
 *                         type: string
 *                         example: "AGENT"
 *                       status:
 *                         type: string
 *                         example: "ACTIVE"
 *                       zoneId:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439012"
 *                           name:
 *                             type: string
 *                             example: "Downtown District"
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-01-15T10:30:00.000Z"
 */
router.get('/my-team-members', requireRoles('SUBADMIN', 'AGENT'), validate(getMyTeamMembersValidation), getMyTeamMembers);

/**
 * @openapi
 * /api/users/assign-agent-to-team:
 *   post:
 *     summary: Assign agent to team (Subadmin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [agentId, teamId]
 *             properties:
 *               agentId:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439013"
 *               teamId:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Agent assigned successfully
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
 *                   example: "Agent assigned to team successfully"
 *       404:
 *         description: Agent or team not found
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
 *                   example: "Agent or team not found"
 */
router.post(
  '/assign-agent-to-team',
  requireRoles('SUBADMIN'),
  validate(assignAgentToTeamValidation),
  assignAgentToTeam
);

// Agent endpoints
/**
 * @openapi
 * /api/users/my-profile:
 *   get:
 *     summary: Get my profile (All authenticated users)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
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
 *                       example: "507f1f77bcf86cd799439013"
 *                     name:
 *                       type: string
 *                       example: "John Doe"
 *                     email:
 *                       type: string
 *                       example: "john.doe@knockwise.com"
 *                     role:
 *                       type: string
 *                       example: "AGENT"
 *                     status:
 *                       type: string
 *                       example: "ACTIVE"
 *                     teamId:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: "507f1f77bcf86cd799439011"
 *                         name:
 *                           type: string
 *                           example: "Team Alpha"
 *                     zoneId:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: "507f1f77bcf86cd799439012"
 *                         name:
 *                           type: string
 *                           example: "Downtown District"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00.000Z"
 */
router.get('/my-profile', getMyProfile);

/**
 * @openapi
 * /api/users/update-my-profile:
 *   put:
 *     summary: Update my profile (All authenticated users)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated John Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "updated.john@knockwise.com"
 *     responses:
 *       200:
 *         description: Profile updated successfully
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
 *                   example: "Profile updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439013"
 *                     name:
 *                       type: string
 *                       example: "Updated John Doe"
 *                     email:
 *                       type: string
 *                       example: "updated.john@knockwise.com"
 *                     role:
 *                       type: string
 *                       example: "AGENT"
 *                     status:
 *                       type: string
 *                       example: "ACTIVE"
 *       409:
 *         description: Email already in use
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
 *                   example: "Email already exists"
 */
router.put(
  '/update-my-profile',
  requireAuth,
  validate(updateProfileValidation),
  updateMyProfile
);

/**
 * @openapi
 * /api/users/my-zone-info:
 *   get:
 *     summary: Get my assigned zone info (Agent only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Zone information
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
 *                       example: "High-value residential area"
 *                     boundary:
 *                       type: object
 *                       example:
 *                         type: "Polygon"
 *                         coordinates: [[[-74.0060, 40.7128], [-74.0061, 40.7129], [-74.0062, 40.7130], [-74.0060, 40.7128]]]
 *                     status:
 *                       type: string
 *                       example: "ACTIVE"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00.000Z"
 *       404:
 *         description: No zone assigned
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
 *                   example: "No zone assigned"
 */
router.get('/my-zone-info', requireRoles('AGENT'), getMyZoneInfo);

/**
 * @openapi
 * /api/users/get-detailed-agent/{agentId}:
 *   get:
 *     summary: Get detailed agent information (Superadmin/Subadmin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *         example: "507f1f77bcf86cd799439013"
 *     responses:
 *       200:
 *         description: Detailed agent information
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
 *                       example: "507f1f77bcf86cd799439013"
 *                     name:
 *                       type: string
 *                       example: "John Doe"
 *                     email:
 *                       type: string
 *                       example: "john.doe@knockwise.com"
 *                     username:
 *                       type: string
 *                       example: "johndoe"
 *                     contactNumber:
 *                       type: string
 *                       example: "+1234567890"
 *                     role:
 *                       type: string
 *                       example: "AGENT"
 *                     status:
 *                       type: string
 *                       example: "ACTIVE"
 *                     primaryTeamId:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: "507f1f77bcf86cd799439011"
 *                         name:
 *                           type: string
 *                           example: "Team Alpha"
 *                     primaryZoneId:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: "507f1f77bcf86cd799439012"
 *                         name:
 *                           type: string
 *                           example: "Downtown District"
 *                     createdBy:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: "507f1f77bcf86cd799439010"
 *                         name:
 *                           type: string
 *                           example: "Admin User"
 *                         email:
 *                           type: string
 *                           example: "admin@knockwise.com"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00.000Z"
 *       404:
 *         description: Agent not found
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
 *                   example: "Agent not found"
 */
router.get(
  '/get-detailed-agent/:agentId',
  requireAuth,
  requireRoles('SUPERADMIN', 'SUBADMIN'),
  getDetailedAgent
);

// Analytics endpoints
/**
 * @openapi
 * /api/users/system-analytics:
 *   get:
 *     summary: Get system-wide analytics (Superadmin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System analytics data
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
 *                     totalUsers:
 *                       type: integer
 *                       example: 25
 *                     totalTeams:
 *                       type: integer
 *                       example: 5
 *                     totalZones:
 *                       type: integer
 *                       example: 12
 *                     activeAgents:
 *                       type: integer
 *                       example: 18
 */
router.get('/system-analytics', requireRoles('SUPERADMIN'), getSystemAnalytics);

/**
 * @openapi
 * /api/users/team-performance/{teamId}:
 *   get:
 *     summary: Get team performance analytics (Superadmin/Subadmin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *         example: "507f1f77bcf86cd799439011"
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         example: "2024-01-01"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         example: "2024-01-31"
 *     responses:
 *       200:
 *         description: Team performance data
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
 *                     team:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: "507f1f77bcf86cd799439011"
 *                         name:
 *                           type: string
 *                           example: "Team Alpha"
 *                         description:
 *                           type: string
 *                           example: "High-performing team"
 *                     members:
 *                       type: array
 *                       items:
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
 *                     assignments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439014"
 *                           agentId:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                                 example: "507f1f77bcf86cd799439013"
 *                               name:
 *                                 type: string
 *                                 example: "John Doe"
 *                           status:
 *                             type: string
 *                             example: "ACTIVE"
 *       404:
 *         description: Team not found
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
 *                   example: "Team not found"
 */
router.get(
  '/team-performance/:teamId',
  requireAuth,
  requireRoles('SUPERADMIN', 'SUBADMIN'),
  validate(getTeamPerformanceValidation),
  getTeamPerformance
);

/**
 * @openapi
 * /api/users/refresh-statuses:
 *   post:
 *     summary: Refresh all agent and team statuses based on zone assignments
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All statuses refreshed successfully
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
 *                   example: "All statuses refreshed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     updatedAgents:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           agentId:
 *                             type: string
 *                           name:
 *                             type: string
 *                           oldStatus:
 *                             type: string
 *                           newStatus:
 *                             type: string
 *                     updatedTeams:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           teamId:
 *                             type: string
 *                           name:
 *                             type: string
 *                           oldStatus:
 *                             type: string
 *                           newStatus:
 *                             type: string
 *                     summary:
 *                       type: object
 *                       properties:
 *                         agentsUpdated:
 *                           type: integer
 *                         teamsUpdated:
 *                           type: integer
 */
router.post(
  '/refresh-statuses',
  requireRoles('SUPERADMIN', 'SUBADMIN'),
  refreshAllStatuses
);

/**
 * @openapi
 * /api/users/refresh-assignment-statuses:
 *   post:
 *     summary: Refresh assignment statuses for all agents based on zone assignments
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Assignment statuses refreshed successfully
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
 *                   example: "Assignment statuses refreshed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalAgents:
 *                       type: integer
 *                       example: 5
 *                     successful:
 *                       type: integer
 *                       example: 4
 *                     failed:
 *                       type: integer
 *                       example: 1
 *                     results:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           agentId:
 *                             type: string
 *                           name:
 *                             type: string
 *                           success:
 *                             type: boolean
 */
router.post(
  '/refresh-assignment-statuses',
  requireRoles('SUPERADMIN', 'SUBADMIN'),
  refreshAssignmentStatuses
);

export default router;
