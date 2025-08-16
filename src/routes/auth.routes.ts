import { Router } from 'express';
import { validate } from '../utils/validator';
import { register, login, refresh, logout, logoutAll } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth';
import { 
  registerValidation, 
  loginValidation, 
  refreshValidation, 
  logoutValidation 
} from '../validators';

const router = Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
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
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john.doe@knockwise.com"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "secret123"
 *               role:
 *                 type: string
 *                 enum: [SUPERADMIN, SUBADMIN, AGENT]
 *                 example: "AGENT"
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
 *         description: User registered successfully
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
 *                   example: "User registered successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: "507f1f77bcf86cd799439013"
 *                         name:
 *                           type: string
 *                           example: "John Doe"
 *                         email:
 *                           type: string
 *                           example: "john.doe@knockwise.com"
 *                         role:
 *                           type: string
 *                           example: "AGENT"
 *                         status:
 *                           type: string
 *                           example: "ACTIVE"
 *                         teamId:
 *                           type: string
 *                           example: "507f1f77bcf86cd799439011"
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                           example: "2024-01-15T10:30:00.000Z"
 *                     accessToken:
 *                       type: string
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1MDdmMWY3N2JjZjg2Y2Q3OTk0MzkwMTMiLCJlbWFpbCI6ImpvaG4uZG9lQGtub2Nrd2lzZS5jb20iLCJyb2xlIjoiQUdFTlQiLCJpYXQiOjE3MDUzNzQyMDAsImV4cCI6MTcwNTM3NzgwMH0.example"
 *                     refreshToken:
 *                       type: string
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1MDdmMWY3N2JjZjg2Y2Q3OTk0MzkwMTMiLCJlbWFpbCI6ImpvaG4uZG9lQGtub2Nrd2lzZS5jb20iLCJyb2xlIjoiQUdFTlQiLCJpYXQiOjE3MDUzNzQyMDAsImV4cCI6MTcwNTQwMzIwMH0.example"
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
router.post('/register', validate(registerValidation), register);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john.doe@knockwise.com"
 *               password:
 *                 type: string
 *                 example: "secret123"
 *     responses:
 *       200:
 *         description: Login successful
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
 *                   example: "Login successful"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: "507f1f77bcf86cd799439013"
 *                         name:
 *                           type: string
 *                           example: "John Doe"
 *                         email:
 *                           type: string
 *                           example: "john.doe@knockwise.com"
 *                         role:
 *                           type: string
 *                           example: "AGENT"
 *                         status:
 *                           type: string
 *                           example: "ACTIVE"
 *                         teamId:
 *                           type: object
 *                           properties:
 *                             _id:
 *                               type: string
 *                               example: "507f1f77bcf86cd799439011"
 *                             name:
 *                               type: string
 *                               example: "Team Alpha"
 *                         zoneId:
 *                           type: object
 *                           properties:
 *                             _id:
 *                               type: string
 *                               example: "507f1f77bcf86cd799439012"
 *                             name:
 *                               type: string
 *                               example: "Downtown District"
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                           example: "2024-01-15T10:30:00.000Z"
 *                     accessToken:
 *                       type: string
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1MDdmMWY3N2JjZjg2Y2Q3OTk0MzkwMTMiLCJlbWFpbCI6ImpvaG4uZG9lQGtub2Nrd2lzZS5jb20iLCJyb2xlIjoiQUdFTlQiLCJpYXQiOjE3MDUzNzQyMDAsImV4cCI6MTcwNTM3NzgwMH0.example"
 *                     refreshToken:
 *                       type: string
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1MDdmMWY3N2JjZjg2Y2Q3OTk0MzkwMTMiLCJlbWFpbCI6ImpvaG4uZG9lQGtub2Nrd2lzZS5jb20iLCJyb2xlIjoiQUdFTlQiLCJpYXQiOjE3MDUzNzQyMDAsImV4cCI6MTcwNTQwMzIwMH0.example"
 *       401:
 *         description: Invalid credentials
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
 *                   example: "Invalid credentials"
 *       403:
 *         description: Account inactive
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
 *                   example: "Account is inactive"
 */
router.post('/login', validate(loginValidation), login);

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1MDdmMWY3N2JjZjg2Y2Q3OTk0MzkwMTMiLCJlbWFpbCI6ImpvaG4uZG9lQGtub2Nrd2lzZS5jb20iLCJpYXQiOjE3MDUzNzQyMDAsImV4cCI6MTcwNTQwMzIwMH0.example"
 *     responses:
 *       200:
 *         description: Token refreshed successfully
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
 *                   example: "Token refreshed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1MDdmMWY3N2JjZjg2Y2Q3OTk0MzkwMTMiLCJlbWFpbCI6ImpvaG4uZG9lQGtub2Nrd2lzZS5jb20iLCJyb2xlIjoiQUdFTlQiLCJpYXQiOjE3MDUzNzQyMDAsImV4cCI6MTcwNTM3NzgwMH0.example"
 *                     refreshToken:
 *                       type: string
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1MDdmMWY3N2JjZjg2Y2Q3OTk0MzkwMTMiLCJlbWFpbCI6ImpvaG4uZG9lQGtub2Nrd2lzZS5jb20iLCJyb2xlIjoiQUdFTlQiLCJpYXQiOjE3MDUzNzQyMDAsImV4cCI6MTcwNTQwMzIwMH0.example"
 *       401:
 *         description: Invalid refresh token
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
 *                   example: "Invalid refresh token"
 */
router.post('/refresh', refresh);

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     summary: Logout user (revokes current session)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Optional refresh token to revoke (if not provided, will use cookie)
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example"
 *     responses:
 *       200:
 *         description: Logout successful
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
 *                   example: "Logged out successfully"
 *       401:
 *         description: Unauthorized
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
 *                   example: "Authentication required"
 */
router.post('/logout', validate(logoutValidation), logout);

/**
 * @openapi
 * /api/auth/logout-all:
 *   post:
 *     summary: Logout user from all devices (revokes all sessions)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logout from all devices successful
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
 *                   example: "Logged out from all devices successfully"
 *       401:
 *         description: Unauthorized
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
 *                   example: "Authentication required"
 */
router.post('/logout-all', requireAuth, logoutAll);

export default router;


