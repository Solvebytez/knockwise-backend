"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const user_controller_1 = require("../controllers/user.controller");
const validator_1 = require("../utils/validator");
const validators_1 = require("../validators");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
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
router.post('/create-subadmin', (0, auth_1.requireRoles)('SUPERADMIN'), (0, validator_1.validate)(validators_1.createUserValidation), user_controller_1.createUser);
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
router.post('/create-agent', (0, auth_1.requireRoles)('SUPERADMIN', 'SUBADMIN'), (0, validator_1.validate)(validators_1.createAgentValidation), async (req, res) => {
    req.body.role = 'AGENT'; // Force role to AGENT
    return (0, user_controller_1.createUser)(req, res);
});
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
 *                       teamId:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439011"
 *                           name:
 *                             type: string
 *                             example: "Team Alpha"
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
router.get('/list-all', (0, auth_1.requireRoles)('SUPERADMIN', 'SUBADMIN'), (0, validator_1.validate)(validators_1.listUsersValidation), user_controller_1.listUsers);
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
router.get('/get-by-id/:id', auth_1.requireAuth, (0, auth_1.requireRoles)('SUPERADMIN', 'SUBADMIN'), (0, validator_1.validate)(validators_1.getUserByIdValidation), user_controller_1.getUserById);
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
router.put('/update/:id', (0, auth_1.requireRoles)('SUPERADMIN'), (0, validator_1.validate)(validators_1.updateUserValidation), user_controller_1.updateUser);
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
router.delete('/delete/:id', auth_1.requireAuth, (0, auth_1.requireRoles)('SUPERADMIN'), (0, validator_1.validate)(validators_1.deleteUserValidation), user_controller_1.deleteUser);
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
router.get('/my-team-members', (0, auth_1.requireRoles)('SUBADMIN', 'AGENT'), (0, validator_1.validate)(validators_1.getMyTeamMembersValidation), user_controller_1.getMyTeamMembers);
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
router.post('/assign-agent-to-team', (0, auth_1.requireRoles)('SUBADMIN'), (0, validator_1.validate)(validators_1.assignAgentToTeamValidation), user_controller_1.assignAgentToTeam);
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
router.get('/my-profile', user_controller_1.getMyProfile);
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
router.put('/update-my-profile', auth_1.requireAuth, (0, validator_1.validate)(validators_1.updateProfileValidation), user_controller_1.updateMyProfile);
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
router.get('/my-zone-info', (0, auth_1.requireRoles)('AGENT'), user_controller_1.getMyZoneInfo);
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
router.get('/system-analytics', (0, auth_1.requireRoles)('SUPERADMIN'), user_controller_1.getSystemAnalytics);
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
router.get('/team-performance/:teamId', auth_1.requireAuth, (0, auth_1.requireRoles)('SUPERADMIN', 'SUBADMIN'), (0, validator_1.validate)(validators_1.getTeamPerformanceValidation), user_controller_1.getTeamPerformance);
exports.default = router;
//# sourceMappingURL=user.routes.js.map