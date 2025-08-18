"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDetailedAgent = exports.bulkUpdateAgentStatuses = exports.getRecentAdditions = exports.getTeamOverview = exports.getMyCreatedAgents = exports.getTeamPerformance = exports.getSystemAnalytics = exports.getMyZoneInfo = exports.updateMyProfile = exports.getMyProfile = exports.assignAgentToTeam = exports.getMyTeamMembers = exports.listUsers = exports.getUserById = exports.deleteUser = exports.updateUser = exports.createUser = exports.updateAgentZoneAssignment = exports.updateAgentStatusOnZoneChange = void 0;
const User_1 = require("../models/User");
const Team_1 = require("../models/Team");
const Zone_1 = require("../models/Zone");
const AgentZoneAssignment_1 = require("../models/AgentZoneAssignment");
const AgentTeamAssignment_1 = require("../models/AgentTeamAssignment");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
// Helper function to update agent status based on zone assignment and task completion
const updateAgentStatus = async (agentId) => {
    try {
        const agent = await User_1.User.findById(agentId);
        if (!agent || agent.role !== 'AGENT')
            return;
        // Check if agent has any zone assignments
        const hasZoneAssignment = agent.zoneIds && agent.zoneIds.length > 0;
        // Check if agent has any active zone assignments (you can add task completion logic here)
        const hasActiveZoneAssignment = agent.primaryZoneId !== null && agent.primaryZoneId !== undefined;
        // Set status to INACTIVE if no zone is assigned or task is completed
        const shouldBeInactive = !hasZoneAssignment || !hasActiveZoneAssignment;
        if (shouldBeInactive && agent.status === 'ACTIVE') {
            await User_1.User.findByIdAndUpdate(agentId, { status: 'INACTIVE' });
            console.log(`Agent ${agent.name} (${agentId}) status set to INACTIVE - no zone assignment`);
        }
        else if (!shouldBeInactive && agent.status === 'INACTIVE') {
            await User_1.User.findByIdAndUpdate(agentId, { status: 'ACTIVE' });
            console.log(`Agent ${agent.name} (${agentId}) status set to ACTIVE - zone assigned`);
        }
    }
    catch (error) {
        console.error('Error updating agent status:', error);
    }
};
// Update agent status when zone assignment changes
const updateAgentStatusOnZoneChange = async (agentId) => {
    await updateAgentStatus(agentId);
};
exports.updateAgentStatusOnZoneChange = updateAgentStatusOnZoneChange;
// Update agent zone assignments and automatically update status
const updateAgentZoneAssignment = async (req, res) => {
    try {
        const { agentId } = req.params;
        if (!agentId) {
            return res.status(400).json({
                success: false,
                message: 'Agent ID is required'
            });
        }
        const { primaryZoneId, zoneIds } = req.body;
        // Validate agent exists
        const agent = await User_1.User.findById(agentId);
        if (!agent || agent.role !== 'AGENT') {
            return res.status(404).json({
                success: false,
                message: 'Agent not found'
            });
        }
        // Update zone assignments
        const updateData = {};
        if (primaryZoneId !== undefined)
            updateData.primaryZoneId = primaryZoneId;
        if (zoneIds !== undefined)
            updateData.zoneIds = zoneIds;
        const updatedAgent = await User_1.User.findByIdAndUpdate(agentId, updateData, { new: true, runValidators: true });
        if (!updatedAgent) {
            return res.status(404).json({
                success: false,
                message: 'Agent not found'
            });
        }
        // Automatically update status based on new zone assignment
        await updateAgentStatus(agentId);
        // Get the updated agent with new status
        const finalAgent = await User_1.User.findById(agentId).select('-password');
        res.json({
            success: true,
            message: 'Agent zone assignment updated successfully',
            data: finalAgent
        });
    }
    catch (error) {
        console.error('Error updating agent zone assignment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update agent zone assignment',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.updateAgentZoneAssignment = updateAgentZoneAssignment;
// Create a new user (Superadmin only)
const createUser = async (req, res) => {
    try {
        const { name, email, username, contactNumber, password, role, primaryTeamId, primaryZoneId, teamIds, zoneIds } = req.body;
        console.log('createUser', req.body);
        // Check if email already exists
        const existingUser = await User_1.User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'An account with this email address already exists. Please use a different email.'
            });
        }
        // Check if username already exists (if provided)
        if (username) {
            const existingUsername = await User_1.User.findOne({ username });
            if (existingUsername) {
                return res.status(409).json({
                    success: false,
                    message: 'This username is already taken. Please choose a different username.'
                });
            }
        }
        // Hash password
        const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;
        const hashedPassword = await bcryptjs_1.default.hash(password, saltRounds);
        // Prepare team and zone arrays
        const finalTeamIds = teamIds || [];
        const finalZoneIds = zoneIds || [];
        // Add primary team/zone to arrays if not already included
        if (primaryTeamId && !finalTeamIds.includes(primaryTeamId)) {
            finalTeamIds.push(primaryTeamId);
        }
        if (primaryZoneId && !finalZoneIds.includes(primaryZoneId)) {
            finalZoneIds.push(primaryZoneId);
        }
        // Determine initial status based on zone assignment
        const hasZoneAssignment = finalZoneIds.length > 0 || primaryZoneId;
        const initialStatus = hasZoneAssignment ? 'ACTIVE' : 'INACTIVE';
        const user = new User_1.User({
            name,
            email,
            username,
            contactNumber,
            password: hashedPassword,
            originalPassword: password, // Store original password for admin viewing
            role,
            status: initialStatus, // Set status based on zone assignment
            primaryTeamId,
            primaryZoneId,
            teamIds: finalTeamIds,
            zoneIds: finalZoneIds,
            createdBy: req.user?.sub // Set the creator
        });
        await user.save();
        // Create team assignments if teams are provided
        if (finalTeamIds.length > 0) {
            const teamAssignments = finalTeamIds.map((teamId) => ({
                agentId: user._id,
                teamId,
                effectiveFrom: new Date(),
                status: 'ACTIVE',
                assignedBy: req.user?.sub
            }));
            await AgentTeamAssignment_1.AgentTeamAssignment.insertMany(teamAssignments);
        }
        // Create zone assignments if zones are provided
        if (finalZoneIds.length > 0) {
            const zoneAssignments = finalZoneIds.map((zoneId) => ({
                agentId: user._id,
                zoneId,
                effectiveFrom: new Date(),
                status: 'ACTIVE',
                assignedBy: req.user?.sub
            }));
            await AgentZoneAssignment_1.AgentZoneAssignment.insertMany(zoneAssignments);
        }
        // Remove password from response
        const userResponse = user.toObject();
        delete userResponse.password;
        res.status(201).json({
            success: true,
            message: 'Team member created successfully',
            data: userResponse
        });
    }
    catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({
            success: false,
            message: 'Unable to create team member. Please try again or contact support if the problem persists.',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.createUser = createUser;
// Update user (Superadmin/Subadmin can update agents they created)
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, username, contactNumber, password, role, status, teamId, zoneId } = req.body;
        const user = await User_1.User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        // Check permissions
        const currentUserRole = req.user?.role;
        const userToUpdateRole = user.role;
        // SUPERADMIN can update anyone
        if (currentUserRole === 'SUPERADMIN') {
            // Allow update
        }
        // SUBADMIN can only update agents they created
        else if (currentUserRole === 'SUBADMIN') {
            // Check if the user to update is an agent
            if (userToUpdateRole !== 'AGENT') {
                return res.status(403).json({
                    success: false,
                    message: 'You can only update agents'
                });
            }
            // Check if the current user created this agent
            if (user.createdBy?.toString() !== req.user?.sub) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only update agents you created'
                });
            }
            // SUBADMIN cannot change role or status
            if (role || status) {
                return res.status(403).json({
                    success: false,
                    message: 'You cannot change role or status'
                });
            }
        }
        // AGENT cannot update anyone
        else {
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions to update users'
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
        // Check if username already exists (if username is being updated)
        if (username && username !== user.username) {
            const existingUser = await User_1.User.findOne({ username, _id: { $ne: id } });
            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: 'Username already exists'
                });
            }
        }
        // Prepare update data
        const updateData = {};
        if (name)
            updateData.name = name;
        if (email)
            updateData.email = email;
        if (username)
            updateData.username = username;
        if (contactNumber)
            updateData.contactNumber = contactNumber;
        if (role)
            updateData.role = role;
        if (status)
            updateData.status = status;
        if (teamId)
            updateData.teamId = teamId;
        if (zoneId)
            updateData.zoneId = zoneId;
        // Handle password update
        if (password) {
            const saltRounds = 12;
            const hashedPassword = await bcryptjs_1.default.hash(password, saltRounds);
            updateData.password = hashedPassword;
            updateData.originalPassword = password; // Store original password for admin viewing
        }
        const updatedUser = await User_1.User.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).select('-password');
        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        res.json({
            success: true,
            message: 'User updated successfully',
            data: updatedUser
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
// Delete user (Superadmin/Subadmin can delete agents they created)
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
        // Check permissions
        const currentUserRole = req.user?.role;
        const userToDeleteRole = user.role;
        // SUPERADMIN can delete anyone
        if (currentUserRole === 'SUPERADMIN') {
            // Allow deletion
        }
        // SUBADMIN can only delete agents they created
        else if (currentUserRole === 'SUBADMIN') {
            // Check if the user to delete is an agent
            if (userToDeleteRole !== 'AGENT') {
                return res.status(403).json({
                    success: false,
                    message: 'You can only delete agents'
                });
            }
            // Check if the current user created this agent
            if (user.createdBy?.toString() !== req.user?.sub) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only delete agents you created'
                });
            }
        }
        // AGENT cannot delete anyone
        else {
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions to delete users'
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
            filter.teamIds = req.user?.teamIds;
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
            teamIds: req.user?.teamIds,
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
        const user = await User_1.User.findById(req.user?.sub).populate('primaryZoneId');
        if (!user || !user.primaryZoneId) {
            return res.status(404).json({
                success: false,
                message: 'No zone assigned'
            });
        }
        res.json({
            success: true,
            data: user.primaryZoneId
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
        // Get team members (using new array field)
        const teamMembers = await User_1.User.find({
            teamIds: teamId,
            role: 'AGENT'
        }).select('name email');
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
// Get agents created by current admin (Superadmin/Subadmin only)
const getMyCreatedAgents = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, search } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const filter = {
            role: 'AGENT',
            createdBy: req.user?.sub
        };
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { username: { $regex: search, $options: 'i' } }
            ];
        }
        const agents = await User_1.User.find(filter)
            .select('-password')
            .populate('primaryTeamId', 'name')
            .populate('primaryZoneId', 'name')
            .populate('createdBy', 'name email')
            .skip(skip)
            .limit(Number(limit))
            .sort({ createdAt: -1 });
        // Calculate correct status based on zone assignments and apply status filter
        const agentsWithCorrectStatus = agents.map(agent => {
            const hasZoneAssignment = agent.zoneIds && agent.zoneIds.length > 0;
            const hasActiveZoneAssignment = agent.primaryZoneId !== null && agent.primaryZoneId !== undefined;
            // Use the same logic as updateAgentStatus function
            const shouldBeActive = hasZoneAssignment && hasActiveZoneAssignment;
            const calculatedStatus = shouldBeActive ? 'ACTIVE' : 'INACTIVE';
            return {
                ...agent.toObject(),
                status: calculatedStatus // Use calculated status instead of stored status
            };
        });
        // Apply status filter after calculating correct status
        const filteredAgents = status && status !== 'all'
            ? agentsWithCorrectStatus.filter(agent => agent.status === status)
            : agentsWithCorrectStatus;
        // Recalculate total count with status filter
        const totalFilter = { ...filter };
        if (status && status !== 'all') {
            // For status filtering, we need to check zone assignments
            // This is a simplified approach - in production you might want to optimize this
            const allAgents = await User_1.User.find(filter).select('primaryZoneId zoneIds');
            const filteredCount = allAgents.filter(agent => {
                const hasZoneAssignment = agent.zoneIds && agent.zoneIds.length > 0;
                const hasActiveZoneAssignment = agent.primaryZoneId !== null && agent.primaryZoneId !== undefined;
                const shouldBeActive = hasZoneAssignment && hasActiveZoneAssignment;
                const calculatedStatus = shouldBeActive ? 'ACTIVE' : 'INACTIVE';
                return calculatedStatus === status;
            }).length;
            var total = filteredCount;
        }
        else {
            total = await User_1.User.countDocuments(filter);
        }
        res.json({
            success: true,
            data: filteredAgents,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            }
        });
    }
    catch (error) {
        console.error('Error getting created agents:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get created agents',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.getMyCreatedAgents = getMyCreatedAgents;
// Get team overview for current admin (Superadmin/Subadmin only)
const getTeamOverview = async (req, res) => {
    try {
        const currentUserId = req.user?.sub;
        // Get all agents created by current admin
        const agents = await User_1.User.find({
            role: 'AGENT',
            createdBy: currentUserId
        });
        let totalAgents = agents.length;
        let activeAgents = 0;
        let inactiveAgents = 0;
        // Count agents based on zone assignment logic (same as status update logic)
        for (const agent of agents) {
            const hasZoneAssignment = agent.zoneIds && agent.zoneIds.length > 0;
            const hasActiveZoneAssignment = agent.primaryZoneId !== null && agent.primaryZoneId !== undefined;
            // Use the same logic as updateAgentStatus function
            const shouldBeActive = hasZoneAssignment && hasActiveZoneAssignment;
            if (shouldBeActive) {
                activeAgents++;
            }
            else {
                inactiveAgents++;
            }
        }
        // Get agents created this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const agentsThisMonth = await User_1.User.countDocuments({
            role: 'AGENT',
            createdBy: currentUserId,
            createdAt: { $gte: startOfMonth }
        });
        res.json({
            success: true,
            data: {
                totalAgents,
                activeAgents,
                inactiveAgents,
                agentsThisMonth
            }
        });
    }
    catch (error) {
        console.error('Error getting team overview:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get team overview',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.getTeamOverview = getTeamOverview;
// Get recent additions for current admin (Superadmin/Subadmin only)
const getRecentAdditions = async (req, res) => {
    try {
        const { limit = 5 } = req.query;
        const currentUserId = req.user?.sub;
        const recentAgents = await User_1.User.find({
            role: 'AGENT',
            createdBy: currentUserId
        })
            .select('name email status createdAt primaryZoneId zoneIds')
            .populate('primaryZoneId', 'name')
            .sort({ createdAt: -1 })
            .limit(Number(limit));
        // Calculate correct status based on zone assignments
        const agentsWithCorrectStatus = recentAgents.map(agent => {
            const hasZoneAssignment = agent.zoneIds && agent.zoneIds.length > 0;
            const hasActiveZoneAssignment = agent.primaryZoneId !== null && agent.primaryZoneId !== undefined;
            // Use the same logic as updateAgentStatus function
            const shouldBeActive = hasZoneAssignment && hasActiveZoneAssignment;
            const calculatedStatus = shouldBeActive ? 'ACTIVE' : 'INACTIVE';
            return {
                _id: agent._id,
                name: agent.name,
                email: agent.email,
                status: calculatedStatus, // Use calculated status instead of stored status
                primaryZoneId: agent.primaryZoneId,
                createdAt: agent.createdAt
            };
        });
        res.json({
            success: true,
            data: agentsWithCorrectStatus
        });
    }
    catch (error) {
        console.error('Error getting recent additions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get recent additions',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.getRecentAdditions = getRecentAdditions;
// Bulk update agent statuses based on zone assignments (for existing agents)
const bulkUpdateAgentStatuses = async (req, res) => {
    try {
        const currentUserId = req.user?.sub;
        // Get all agents created by current admin
        const agents = await User_1.User.find({
            role: 'AGENT',
            createdBy: currentUserId
        });
        let updatedCount = 0;
        let inactiveCount = 0;
        let activeCount = 0;
        for (const agent of agents) {
            const hasZoneAssignment = agent.zoneIds && agent.zoneIds.length > 0;
            const hasActiveZoneAssignment = agent.primaryZoneId !== null && agent.primaryZoneId !== undefined;
            const shouldBeInactive = !hasZoneAssignment || !hasActiveZoneAssignment;
            if (shouldBeInactive && agent.status === 'ACTIVE') {
                await User_1.User.findByIdAndUpdate(agent._id, { status: 'INACTIVE' });
                inactiveCount++;
                updatedCount++;
            }
            else if (!shouldBeInactive && agent.status === 'INACTIVE') {
                await User_1.User.findByIdAndUpdate(agent._id, { status: 'ACTIVE' });
                activeCount++;
                updatedCount++;
            }
        }
        res.json({
            success: true,
            message: `Bulk status update completed`,
            data: {
                totalAgents: agents.length,
                updatedCount,
                setToActive: activeCount,
                setToInactive: inactiveCount
            }
        });
    }
    catch (error) {
        console.error('Error bulk updating agent statuses:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to bulk update agent statuses',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.bulkUpdateAgentStatuses = bulkUpdateAgentStatuses;
// Get detailed agent information including password, teams, and zones
const getDetailedAgent = async (req, res) => {
    try {
        const { agentId } = req.params;
        if (!agentId) {
            return res.status(400).json({
                success: false,
                message: 'Agent ID is required'
            });
        }
        // Get agent with password included
        const agent = await User_1.User.findById(agentId).select('+password +originalPassword');
        if (!agent || agent.role !== 'AGENT') {
            return res.status(404).json({
                success: false,
                message: 'Agent not found'
            });
        }
        // Check if current user has permission to view this agent
        // Only allow if current user created this agent or is a superadmin
        if (req.user?.role !== 'SUPERADMIN' && agent.createdBy?.toString() !== req.user?.sub) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to view this agent'
            });
        }
        // Get team information
        const teams = agent.teamIds && agent.teamIds.length > 0
            ? await Team_1.Team.find({ _id: { $in: agent.teamIds } }).select('name')
            : [];
        // Get zone information
        const zones = agent.zoneIds && agent.zoneIds.length > 0
            ? await Zone_1.Zone.find({ _id: { $in: agent.zoneIds } }).select('name')
            : [];
        // Get createdBy admin information
        let createdByInfo = null;
        if (agent.createdBy) {
            const adminUser = await User_1.User.findById(agent.createdBy).select('name email');
            if (adminUser) {
                createdByInfo = {
                    _id: adminUser._id,
                    name: adminUser.name,
                    email: adminUser.email
                };
            }
        }
        // Calculate correct status based on zone assignments
        const hasZoneAssignment = agent.zoneIds && agent.zoneIds.length > 0;
        const hasActiveZoneAssignment = agent.primaryZoneId !== null && agent.primaryZoneId !== undefined;
        const shouldBeActive = hasZoneAssignment && hasActiveZoneAssignment;
        const calculatedStatus = shouldBeActive ? 'ACTIVE' : 'INACTIVE';
        const detailedAgent = {
            _id: agent._id,
            name: agent.name,
            email: agent.email,
            username: agent.username,
            contactNumber: agent.contactNumber,
            role: agent.role,
            status: calculatedStatus,
            password: agent.originalPassword || 'Password not available', // Return original password for admin view
            primaryTeamId: agent.primaryTeamId,
            primaryZoneId: agent.primaryZoneId,
            teamIds: agent.teamIds,
            zoneIds: agent.zoneIds,
            teams: teams,
            zones: zones,
            createdBy: createdByInfo,
            createdAt: agent.createdAt,
            knockedToday: 0 // This would come from activity tracking
        };
        res.json({
            success: true,
            message: 'Agent details retrieved successfully',
            data: detailedAgent
        });
    }
    catch (error) {
        console.error('Error getting detailed agent:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get agent details',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.getDetailedAgent = getDetailedAgent;
//# sourceMappingURL=user.controller.js.map