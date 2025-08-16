"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTeamPerformance = exports.getSystemAnalytics = exports.getMyZoneInfo = exports.updateMyProfile = exports.getMyProfile = exports.assignAgentToTeam = exports.getMyTeamMembers = exports.listUsers = exports.getUserById = exports.deleteUser = exports.updateUser = exports.createUser = void 0;
const User_1 = require("../models/User");
const Team_1 = require("../models/Team");
const Zone_1 = require("../models/Zone");
const AgentZoneAssignment_1 = require("../models/AgentZoneAssignment");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
// Create a new user (Superadmin only)
const createUser = async (req, res) => {
    try {
        const { name, email, password, role, teamId, zoneId } = req.body;
        // Check if email already exists
        const existingUser = await User_1.User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'Email already exists'
            });
        }
        // Hash password
        const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;
        const hashedPassword = await bcryptjs_1.default.hash(password, saltRounds);
        const user = new User_1.User({
            name,
            email,
            password: hashedPassword,
            role,
            teamId,
            zoneId
        });
        await user.save();
        // Remove password from response
        const userResponse = user.toObject();
        delete userResponse.password;
        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: userResponse
        });
    }
    catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create user',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.createUser = createUser;
// Update user (Superadmin only)
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, role, status, teamId, zoneId } = req.body;
        const user = await User_1.User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        // Check if email already exists (if email is being updated)
        if (email && email !== user.email) {
            const existingUser = await User_1.User.findOne({ email, _id: { $ne: id } });
            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: 'Email already exists'
                });
            }
        }
        const updatedUser = await User_1.User.findByIdAndUpdate(id, { name, email, role, status, teamId, zoneId }, { new: true, runValidators: true });
        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        // Remove password from response
        const userResponse = updatedUser.toObject();
        delete userResponse.password;
        res.json({
            success: true,
            message: 'User updated successfully',
            data: userResponse
        });
    }
    catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.updateUser = updateUser;
// Delete user (Superadmin only)
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User_1.User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        // Prevent deleting own account
        if (user._id.toString() === req.user?.sub) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete your own account'
            });
        }
        await User_1.User.findByIdAndDelete(id);
        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    }
    catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete user',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.deleteUser = deleteUser;
// Get user by ID (Superadmin/Subadmin only)
const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User_1.User.findById(id).select('-password');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        res.json({
            success: true,
            data: user
        });
    }
    catch (error) {
        console.error('Error getting user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get user',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.getUserById = getUserById;
// List all users with pagination (Superadmin/Subadmin only)
const listUsers = async (req, res) => {
    try {
        const { page = 1, limit = 10, role, status, teamId } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const filter = {};
        if (role)
            filter.role = role;
        if (status)
            filter.status = status;
        if (teamId)
            filter.teamId = teamId;
        // If user is not superadmin, only show users from their team
        if (req.user?.role !== 'SUPERADMIN') {
            filter.teamId = req.user?.teamId;
        }
        const users = await User_1.User.find(filter)
            .select('-password')
            .populate('teamId', 'name')
            .populate('zoneId', 'name')
            .skip(skip)
            .limit(Number(limit))
            .sort({ createdAt: -1 });
        const total = await User_1.User.countDocuments(filter);
        res.json({
            success: true,
            data: users,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            }
        });
    }
    catch (error) {
        console.error('Error listing users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to list users',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.listUsers = listUsers;
// Get my team members (Subadmin/Agent only)
const getMyTeamMembers = async (req, res) => {
    try {
        const teamMembers = await User_1.User.find({
            teamId: req.user?.teamId,
            role: { $in: ['SUBADMIN', 'AGENT'] }
        })
            .select('-password')
            .populate('zoneId', 'name')
            .sort({ name: 1 });
        res.json({
            success: true,
            data: teamMembers
        });
    }
    catch (error) {
        console.error('Error getting team members:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get team members',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.getMyTeamMembers = getMyTeamMembers;
// Assign agent to team (Subadmin only)
const assignAgentToTeam = async (req, res) => {
    try {
        const { agentId, teamId } = req.body;
        // Validate agent exists
        const agent = await User_1.User.findById(agentId);
        if (!agent || agent.role !== 'AGENT') {
            return res.status(404).json({
                success: false,
                message: 'Agent not found'
            });
        }
        // Validate team exists
        const team = await Team_1.Team.findById(teamId);
        if (!team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found'
            });
        }
        // Update agent's team
        await User_1.User.findByIdAndUpdate(agentId, { teamId });
        res.json({
            success: true,
            message: 'Agent assigned to team successfully'
        });
    }
    catch (error) {
        console.error('Error assigning agent to team:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to assign agent to team',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.assignAgentToTeam = assignAgentToTeam;
// Get my profile (All authenticated users)
const getMyProfile = async (req, res) => {
    try {
        const user = await User_1.User.findById(req.user?.sub)
            .select('-password')
            .populate('teamId', 'name')
            .populate('zoneId', 'name');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        res.json({
            success: true,
            data: user
        });
    }
    catch (error) {
        console.error('Error getting profile:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get profile',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.getMyProfile = getMyProfile;
// Update my profile (All authenticated users)
const updateMyProfile = async (req, res) => {
    try {
        const { name, email } = req.body;
        // Check if email already exists (if email is being updated)
        if (email) {
            const existingUser = await User_1.User.findOne({ email, _id: { $ne: req.user?.sub } });
            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: 'Email already exists'
                });
            }
        }
        const updatedUser = await User_1.User.findByIdAndUpdate(req.user?.sub, { name, email }, { new: true, runValidators: true }).select('-password');
        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: updatedUser
        });
    }
    catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.updateMyProfile = updateMyProfile;
// Get my zone info (Agent only)
const getMyZoneInfo = async (req, res) => {
    try {
        const user = await User_1.User.findById(req.user?.sub).populate('zoneId');
        if (!user || !user.zoneId) {
            return res.status(404).json({
                success: false,
                message: 'No zone assigned'
            });
        }
        res.json({
            success: true,
            data: user.zoneId
        });
    }
    catch (error) {
        console.error('Error getting zone info:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get zone info',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.getMyZoneInfo = getMyZoneInfo;
// Get system analytics (Superadmin only)
const getSystemAnalytics = async (req, res) => {
    try {
        const totalUsers = await User_1.User.countDocuments();
        const totalTeams = await Team_1.Team.countDocuments();
        const totalZones = await Zone_1.Zone.countDocuments();
        const activeAgents = await User_1.User.countDocuments({ role: 'AGENT', status: 'ACTIVE' });
        res.json({
            success: true,
            data: {
                totalUsers,
                totalTeams,
                totalZones,
                activeAgents
            }
        });
    }
    catch (error) {
        console.error('Error getting system analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get system analytics',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.getSystemAnalytics = getSystemAnalytics;
// Get team performance (Superadmin/Subadmin only)
const getTeamPerformance = async (req, res) => {
    try {
        const { teamId } = req.params;
        const { startDate, endDate } = req.query;
        const team = await Team_1.Team.findById(teamId);
        if (!team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found'
            });
        }
        // Get team members
        const teamMembers = await User_1.User.find({ teamId, role: 'AGENT' }).select('name email');
        // Get assignments for this team
        const assignments = await AgentZoneAssignment_1.AgentZoneAssignment.find({
            agentId: { $in: teamMembers.map(member => member._id) }
        }).populate('agentId', 'name');
        res.json({
            success: true,
            data: {
                team,
                members: teamMembers,
                assignments
            }
        });
    }
    catch (error) {
        console.error('Error getting team performance:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get team performance',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.getTeamPerformance = getTeamPerformance;
//# sourceMappingURL=user.controller.js.map