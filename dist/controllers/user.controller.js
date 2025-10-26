"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshAllStatuses = exports.refreshAssignmentStatuses = exports.getDetailedAgent = exports.bulkUpdateAgentStatuses = exports.getRecentAdditions = exports.getTeamOverview = exports.getMyCreatedAgents = exports.getTeamPerformance = exports.getSystemAnalytics = exports.getMyZoneInfo = exports.updateMyProfile = exports.getMyProfile = exports.assignAgentToTeam = exports.getMyTeamMembers = exports.listUsers = exports.getUserById = exports.deleteUser = exports.updateUser = exports.createUser = exports.updateAgentZoneAssignment = exports.updateAgentStatusOnZoneChange = exports.updateAgentStatus = void 0;
const User_1 = require("../models/User");
const Team_1 = require("../models/Team");
const Zone_1 = require("../models/Zone");
const AgentZoneAssignment_1 = require("../models/AgentZoneAssignment");
const AgentTeamAssignment_1 = require("../models/AgentTeamAssignment");
const ScheduledAssignment_1 = require("../models/ScheduledAssignment");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
// Helper function to calculate team status based on zone assignments
const calculateTeamStatus = async (teamId) => {
    try {
        // Check if team has any zone assignments
        const teamZoneAssignments = await AgentZoneAssignment_1.AgentZoneAssignment.find({
            teamId: teamId,
            status: { $in: ['ACTIVE', 'COMPLETED'] },
            effectiveTo: null
        });
        // Team is ACTIVE if it has any zone assignments
        const hasZoneAssignment = teamZoneAssignments.length > 0;
        return hasZoneAssignment ? 'ACTIVE' : 'INACTIVE';
    }
    catch (error) {
        console.error('Error calculating team status:', error);
        return 'INACTIVE';
    }
};
// Helper function to calculate agent status based on zone assignments (individual and team)
const calculateAgentStatus = async (agentId) => {
    try {
        const agent = await User_1.User.findById(agentId);
        if (!agent || agent.role !== 'AGENT')
            return 'INACTIVE';
        // Import ScheduledAssignment model
        const { ScheduledAssignment } = require('../models/ScheduledAssignment');
        // Check individual zone assignments
        const hasIndividualZoneAssignment = agent.zoneIds && agent.zoneIds.length > 0;
        const hasIndividualPrimaryZone = agent.primaryZoneId !== null && agent.primaryZoneId !== undefined;
        // Check team zone assignments (exclude COMPLETED and CANCELLED)
        const teamZoneAssignments = await AgentZoneAssignment_1.AgentZoneAssignment.find({
            teamId: { $in: agent.teamIds },
            status: { $nin: ['COMPLETED', 'CANCELLED'] },
            effectiveTo: null
        });
        const hasTeamZoneAssignment = teamZoneAssignments.length > 0;
        // Check individual zone assignments (exclude COMPLETED and CANCELLED)
        const individualZoneAssignments = await AgentZoneAssignment_1.AgentZoneAssignment.find({
            agentId: agent._id,
            status: { $nin: ['COMPLETED', 'CANCELLED'] },
            effectiveTo: null
        });
        const hasActiveIndividualZoneAssignment = individualZoneAssignments.length > 0;
        // Check PENDING scheduled assignments (individual)
        const pendingIndividualScheduledAssignments = await ScheduledAssignment.find({
            agentId: agent._id,
            status: 'PENDING'
        });
        const hasPendingIndividualScheduledAssignment = pendingIndividualScheduledAssignments.length > 0;
        // Check PENDING scheduled assignments (team)
        const pendingTeamScheduledAssignments = await ScheduledAssignment.find({
            teamId: { $in: agent.teamIds },
            status: 'PENDING'
        });
        const hasPendingTeamScheduledAssignment = pendingTeamScheduledAssignments.length > 0;
        // Agent is ACTIVE if:
        // 1. Has individual zone assignment (primaryZoneId or zoneIds), OR
        // 2. Has active individual zone assignments, OR
        // 3. Is part of a team that has zone assignments, OR
        // 4. Has PENDING scheduled individual assignments, OR
        // 5. Is part of a team that has PENDING scheduled assignments
        // 6. OR if they were previously ACTIVE (don't automatically deactivate)
        const shouldBeActive = hasIndividualZoneAssignment ||
            hasIndividualPrimaryZone ||
            hasActiveIndividualZoneAssignment ||
            hasTeamZoneAssignment ||
            hasPendingIndividualScheduledAssignment ||
            hasPendingTeamScheduledAssignment ||
            agent.status === 'ACTIVE'; // Keep ACTIVE status if already set
        return shouldBeActive ? 'ACTIVE' : 'INACTIVE';
    }
    catch (error) {
        console.error('Error calculating agent status:', error);
        return 'INACTIVE';
    }
};
// Helper function to update agent status based on zone assignment and task completion
const updateAgentStatus = async (agentId) => {
    try {
        const agent = await User_1.User.findById(agentId);
        if (!agent || agent.role !== 'AGENT')
            return;
        const calculatedStatus = await calculateAgentStatus(agentId);
        // Only update if the agent should be ACTIVE (don't automatically deactivate)
        if (calculatedStatus === 'ACTIVE' && agent.status !== 'ACTIVE') {
            await User_1.User.findByIdAndUpdate(agentId, { status: calculatedStatus });
            console.log(`Agent ${agent.name} (${agentId}) status updated to ${calculatedStatus}`);
        }
    }
    catch (error) {
        console.error('Error updating agent status:', error);
    }
};
exports.updateAgentStatus = updateAgentStatus;
// Update agent status when zone assignment changes
const updateAgentStatusOnZoneChange = async (agentId) => {
    await (0, exports.updateAgentStatus)(agentId);
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
        await (0, exports.updateAgentStatus)(agentId);
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
        const { page = 1, limit = 10, role, status, teamId, search, excludeAssigned } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const filter = {};
        if (role)
            filter.role = role;
        if (status)
            filter.status = status;
        if (teamId)
            filter.teamIds = teamId;
        // Add search functionality
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { username: { $regex: search, $options: 'i' } }
            ];
        }
        // If user is not superadmin, only show users they created
        if (req.user?.role !== 'SUPERADMIN') {
            filter.createdBy = req.user?.sub;
        }
        let users = await User_1.User.find(filter)
            .select('-password')
            .populate('primaryTeamId', 'name')
            .populate('primaryZoneId', 'name')
            .skip(skip)
            .limit(Number(limit))
            .sort({ createdAt: -1 });
        // If excludeAssigned is true, filter out agents who have active or scheduled zone assignments
        if (excludeAssigned === 'true' && role === 'AGENT') {
            console.log('🔍 Filtering out agents with active/scheduled assignments...');
            const { AgentZoneAssignment } = require('../models/AgentZoneAssignment');
            const { ScheduledAssignment } = require('../models/ScheduledAssignment');
            const filteredUsers = [];
            for (const user of users) {
                // Check for active individual zone assignments
                const hasActiveIndividualAssignments = await AgentZoneAssignment.exists({
                    agentId: user._id,
                    status: { $nin: ['COMPLETED', 'CANCELLED'] },
                    effectiveTo: null
                });
                // Check for pending scheduled individual assignments
                const hasPendingScheduledAssignments = await ScheduledAssignment.exists({
                    agentId: user._id,
                    status: 'PENDING'
                });
                // Check for active team zone assignments (if agent is part of teams)
                let hasActiveTeamAssignments = false;
                if (user.teamIds && user.teamIds.length > 0) {
                    hasActiveTeamAssignments = await AgentZoneAssignment.exists({
                        teamId: { $in: user.teamIds },
                        status: { $nin: ['COMPLETED', 'CANCELLED'] },
                        effectiveTo: null
                    });
                }
                // Check for pending scheduled team assignments
                let hasPendingTeamScheduledAssignments = false;
                if (user.teamIds && user.teamIds.length > 0) {
                    hasPendingTeamScheduledAssignments = await ScheduledAssignment.exists({
                        teamId: { $in: user.teamIds },
                        status: 'PENDING'
                    });
                }
                const hasAnyAssignments = hasActiveIndividualAssignments ||
                    hasPendingScheduledAssignments ||
                    hasActiveTeamAssignments ||
                    hasPendingTeamScheduledAssignments;
                console.log(`🔍 Agent ${user.email}: hasActiveIndividual=${hasActiveIndividualAssignments}, hasPendingScheduled=${hasPendingScheduledAssignments}, hasActiveTeam=${hasActiveTeamAssignments}, hasPendingTeamScheduled=${hasPendingTeamScheduledAssignments}, hasAnyAssignments=${hasAnyAssignments}`);
                // Only include agents who don't have any active or scheduled assignments
                if (!hasAnyAssignments) {
                    filteredUsers.push(user);
                }
            }
            users = filteredUsers;
            console.log(`✅ Filtered ${users.length} agents without active/scheduled assignments`);
        }
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
        const { page = 1, limit = 10, status, search, excludeAssigned, includeTeamInfo, excludeTeamId } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const filter = {
            role: 'AGENT',
            createdBy: req.user?.sub,
        };
        // Only add status filter if not requesting 'all' statuses
        if (status && status !== 'all') {
            filter.status = status;
        }
        else if (status !== 'all') {
            filter.status = 'ACTIVE'; // Default to ACTIVE only if not explicitly requesting 'all'
        }
        // Exclude agents who are already members of the specified team
        if (excludeTeamId) {
            filter.teamIds = { $ne: excludeTeamId };
        }
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { username: { $regex: search, $options: 'i' } }
            ];
        }
        let agents;
        if (includeTeamInfo === 'true') {
            // Enhanced query with team membership information
            agents = await User_1.User.find(filter)
                .select('-password')
                .populate('primaryTeamId', 'name status assignmentStatus')
                .populate('primaryZoneId', 'name')
                .populate('createdBy', 'name email')
                .populate({
                path: 'teamIds',
                select: 'name status assignmentStatus',
                match: { createdBy: req.user?.sub } // Only show teams created by current admin
            })
                .skip(skip)
                .limit(Number(limit))
                .sort({ createdAt: -1 });
        }
        else {
            // Original simple query
            agents = await User_1.User.find(filter)
                .select('-password')
                .populate('primaryTeamId', 'name')
                .populate('primaryZoneId', 'name')
                .populate('createdBy', 'name email')
                .skip(skip)
                .limit(Number(limit))
                .sort({ createdAt: -1 });
        }
        // If excludeAssigned is true, filter out agents who have active or scheduled zone assignments
        if (excludeAssigned === 'true') {
            console.log('🔍 Filtering out agents with active/scheduled assignments...');
            const filteredAgents = [];
            for (const agent of agents) {
                // Check for active individual zone assignments
                const hasActiveIndividualAssignments = !!(await AgentZoneAssignment_1.AgentZoneAssignment.exists({
                    agentId: agent._id,
                    status: { $nin: ['COMPLETED', 'CANCELLED'] },
                    effectiveTo: null
                }));
                // Check for pending scheduled individual assignments
                const hasPendingScheduledAssignments = !!(await ScheduledAssignment_1.ScheduledAssignment.exists({
                    agentId: agent._id,
                    status: 'PENDING'
                }));
                // Check for active team zone assignments (if agent is part of teams)
                let hasActiveTeamAssignments = false;
                if (agent.teamIds && agent.teamIds.length > 0) {
                    hasActiveTeamAssignments = !!(await AgentZoneAssignment_1.AgentZoneAssignment.exists({
                        teamId: { $in: agent.teamIds },
                        status: { $nin: ['COMPLETED', 'CANCELLED'] },
                        effectiveTo: null
                    }));
                }
                // Check for pending scheduled team assignments
                let hasPendingTeamScheduledAssignments = false;
                if (agent.teamIds && agent.teamIds.length > 0) {
                    hasPendingTeamScheduledAssignments = !!(await ScheduledAssignment_1.ScheduledAssignment.exists({
                        teamId: { $in: agent.teamIds },
                        status: 'PENDING'
                    }));
                }
                const hasAnyAssignments = hasActiveIndividualAssignments ||
                    hasPendingScheduledAssignments ||
                    hasActiveTeamAssignments ||
                    hasPendingTeamScheduledAssignments;
                console.log(`🔍 Agent ${agent.email}: hasActiveIndividual=${hasActiveIndividualAssignments}, hasPendingScheduled=${hasPendingScheduledAssignments}, hasActiveTeam=${hasActiveTeamAssignments}, hasPendingTeamScheduled=${hasPendingTeamScheduledAssignments}, hasAnyAssignments=${hasAnyAssignments}`);
                // Only include agents who don't have any active or scheduled assignments
                if (!hasAnyAssignments) {
                    filteredAgents.push(agent);
                }
            }
            agents = filteredAgents;
            console.log(`✅ Filtered ${agents.length} agents without active/scheduled assignments`);
        }
        // Calculate correct status and get all zone information
        const agentsWithCorrectStatus = await Promise.all(agents.map(async (agent) => {
            const calculatedStatus = await calculateAgentStatus(agent._id.toString());
            // Get team zone information if agent is part of a team
            let teamZoneInfo = null;
            if (agent.primaryTeamId) {
                const teamZoneAssignment = await AgentZoneAssignment_1.AgentZoneAssignment.findOne({
                    teamId: agent.primaryTeamId._id,
                    status: { $nin: ['COMPLETED', 'CANCELLED'] },
                    effectiveTo: null
                }).populate('zoneId', 'name');
                if (teamZoneAssignment && teamZoneAssignment.zoneId) {
                    teamZoneInfo = {
                        _id: teamZoneAssignment.zoneId._id,
                        name: teamZoneAssignment.zoneId.name
                    };
                }
            }
            // Import ScheduledAssignment model
            const { ScheduledAssignment } = require('../models/ScheduledAssignment');
            // Get all individual zone assignments for this agent
            const individualZoneAssignments = await AgentZoneAssignment_1.AgentZoneAssignment.find({
                agentId: agent._id,
                status: { $nin: ['COMPLETED', 'CANCELLED'] },
                effectiveTo: null
            }).populate('zoneId', 'name');
            // Get all team zone assignments for this agent's teams
            const teamZoneAssignments = await AgentZoneAssignment_1.AgentZoneAssignment.find({
                teamId: { $in: agent.teamIds },
                status: { $nin: ['COMPLETED', 'CANCELLED'] },
                effectiveTo: null
            }).populate('zoneId', 'name');
            // Get all PENDING scheduled individual assignments
            const pendingIndividualScheduledAssignments = await ScheduledAssignment.find({
                agentId: agent._id,
                status: 'PENDING'
            }).populate('zoneId', 'name');
            // Get all PENDING scheduled team assignments
            const pendingTeamScheduledAssignments = await ScheduledAssignment.find({
                teamId: { $in: agent.teamIds },
                status: 'PENDING'
            }).populate('zoneId', 'name');
            // Combine all assignments (active + scheduled)
            const allAssignments = [
                ...individualZoneAssignments,
                ...teamZoneAssignments,
                ...pendingIndividualScheduledAssignments,
                ...pendingTeamScheduledAssignments
            ];
            // Create a map of zones from all assignment records (both active and scheduled)
            // Use a Map to deduplicate zones by zoneId
            const zoneMap = new Map();
            allAssignments.forEach(assignment => {
                const zoneId = assignment.zoneId._id.toString();
                if (!zoneMap.has(zoneId)) {
                    zoneMap.set(zoneId, {
                        _id: assignment.zoneId._id,
                        name: assignment.zoneId.name,
                        isPrimary: assignment.zoneId._id.toString() === agent.primaryZoneId?._id?.toString(),
                        isScheduled: assignment.status === 'PENDING' // Add flag to identify scheduled assignments
                    });
                }
            });
            const assignmentZones = Array.from(zoneMap.values());
            // If no assignment records found, fall back to User model's zoneIds
            let allAssignedZones = assignmentZones;
            if (assignmentZones.length === 0 && agent.zoneIds && agent.zoneIds.length > 0) {
                // Get zone details from the zoneIds array
                const Zone = require('../models/Zone').default;
                const zones = await Zone.find({ _id: { $in: agent.zoneIds } }).select('name');
                allAssignedZones = zones.map((zone) => ({
                    _id: zone._id,
                    name: zone.name,
                    isPrimary: zone._id.toString() === agent.primaryZoneId?._id?.toString()
                }));
            }
            // Determine assignment status based on zone assignments
            const hasZoneAssignment = allAssignments.length > 0;
            const assignmentStatus = hasZoneAssignment ? 'ASSIGNED' : 'UNASSIGNED';
            // Get team information for all teams the user is a member of
            let teamInfo = null;
            let teamMemberships = null;
            if (agent.teamIds && agent.teamIds.length > 0) {
                if (includeTeamInfo === 'true') {
                    // Enhanced team membership information
                    teamMemberships = agent.teamIds?.filter((team) => team && typeof team === 'object' && team._id).map((team) => ({
                        teamId: team._id,
                        teamName: team.name || 'Unknown Team',
                        teamStatus: team.status || 'UNKNOWN',
                        teamAssignmentStatus: team.assignmentStatus || 'UNKNOWN',
                        isPrimary: agent.primaryTeamId?._id?.toString() === team._id?.toString()
                    })) || [];
                }
                else {
                    // Simple team information
                    const Team = require('../models/Team').default;
                    const teams = await Team.find({ _id: { $in: agent.teamIds } }).select('name');
                    if (teams.length > 0) {
                        teamInfo = teams.map((team) => ({
                            _id: team._id,
                            name: team.name
                        }));
                    }
                }
            }
            // Create assignment summary for enhanced response
            let assignmentSummary = null;
            if (includeTeamInfo === 'true') {
                assignmentSummary = {
                    totalActiveZones: individualZoneAssignments.length + teamZoneAssignments.length,
                    totalScheduledZones: pendingIndividualScheduledAssignments.length + pendingTeamScheduledAssignments.length,
                    hasActiveAssignments: (individualZoneAssignments.length + teamZoneAssignments.length) > 0,
                    hasScheduledAssignments: (pendingIndividualScheduledAssignments.length + pendingTeamScheduledAssignments.length) > 0,
                    individualZones: individualZoneAssignments.map((a) => a.zoneId?.name || 'Unknown'),
                    teamZones: teamZoneAssignments.map((a) => a.zoneId?.name || 'Unknown'),
                    scheduledZones: [...pendingIndividualScheduledAssignments, ...pendingTeamScheduledAssignments].map((a) => a.zoneId?.name || 'Unknown'),
                    // Enhanced assignment status details
                    currentAssignmentStatus: assignmentStatus,
                    assignmentDetails: {
                        hasIndividualAssignments: individualZoneAssignments.length > 0,
                        hasTeamAssignments: teamZoneAssignments.length > 0,
                        hasScheduledIndividualAssignments: pendingIndividualScheduledAssignments.length > 0,
                        hasScheduledTeamAssignments: pendingTeamScheduledAssignments.length > 0,
                        totalAssignments: allAssignments.length,
                        isFullyAssigned: allAssignments.length > 0,
                        isPartiallyAssigned: (individualZoneAssignments.length > 0 || teamZoneAssignments.length > 0) &&
                            (pendingIndividualScheduledAssignments.length > 0 || pendingTeamScheduledAssignments.length > 0),
                        isOnlyScheduled: (pendingIndividualScheduledAssignments.length > 0 || pendingTeamScheduledAssignments.length > 0) &&
                            (individualZoneAssignments.length === 0 && teamZoneAssignments.length === 0)
                    }
                };
            }
            return {
                ...agent.toObject(),
                status: calculatedStatus, // Use calculated status instead of stored status
                assignmentStatus, // Add assignment status
                teamZoneInfo, // Add team zone information
                allAssignedZones, // Add all individual zone assignments
                teamInfo, // Add team information for all teams user is member of
                teamMemberships, // Enhanced team membership details
                assignmentSummary // Detailed assignment summary
            };
        }));
        // Apply status filter after calculating correct status
        const filteredAgents = status && status !== 'all'
            ? agentsWithCorrectStatus.filter(agent => agent.status === status)
            : agentsWithCorrectStatus;
        // Recalculate total count with status filter
        const totalFilter = { ...filter };
        if (status && status !== 'all') {
            // For status filtering, we need to check zone assignments (individual and team)
            const allAgents = await User_1.User.find(filter).select('primaryZoneId zoneIds teamIds');
            const filteredCount = await Promise.all(allAgents.map(async (agent) => {
                const calculatedStatus = await calculateAgentStatus(agent._id.toString());
                return calculatedStatus === status;
            }));
            var total = filteredCount.filter(Boolean).length;
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
        // Count agents based on status
        for (const agent of agents) {
            // Use the same calculateAgentStatus function that includes scheduled assignments
            const calculatedStatus = await calculateAgentStatus(agent._id.toString());
            if (calculatedStatus === 'ACTIVE') {
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
        // Get total zones count
        const { Zone } = require('../models/Zone');
        const totalZones = await Zone.countDocuments({
            createdBy: currentUserId
        });
        // Calculate assignment status based on actual zone assignments
        let assignedAgentsCount = 0;
        let unassignedAgentsCount = 0;
        for (const agent of agents) {
            // Check if agent has any zone assignments (individual or through team)
            const { AgentZoneAssignment } = require('../models/AgentZoneAssignment');
            // Check individual zone assignments
            const individualAssignments = await AgentZoneAssignment.find({
                agentId: agent._id,
                status: 'ACTIVE'
            });
            // Check team zone assignments in AgentZoneAssignment
            const teamAssignments = await AgentZoneAssignment.find({
                teamId: { $in: agent.teamIds || [] },
                status: 'ACTIVE'
            });
            // Check team zone assignments in Zone model (for zones assigned to teams)
            const { Zone } = require('../models/Zone');
            const teamZoneAssignments = await Zone.find({
                teamId: { $in: agent.teamIds || [] },
                status: { $in: ['ACTIVE', 'SCHEDULED'] }
            });
            // Also check if agent has direct zoneIds (for backward compatibility)
            const hasDirectZones = agent.zoneIds && agent.zoneIds.length > 0;
            const hasZoneAssignment = individualAssignments.length > 0 || teamAssignments.length > 0 || teamZoneAssignments.length > 0 || hasDirectZones;
            if (hasZoneAssignment) {
                assignedAgentsCount++;
            }
            else {
                unassignedAgentsCount++;
            }
        }
        res.json({
            success: true,
            data: {
                totalAgents,
                activeAgents,
                inactiveAgents,
                agentsThisMonth,
                assignedAgents: assignedAgentsCount,
                unassignedAgents: unassignedAgentsCount,
                totalZones
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
        const agentsWithCorrectStatus = await Promise.all(recentAgents.map(async (agent) => {
            // Use the same calculateAgentStatus function that includes scheduled assignments
            const calculatedStatus = await calculateAgentStatus(agent._id.toString());
            return {
                _id: agent._id,
                name: agent.name,
                email: agent.email,
                status: calculatedStatus, // Use calculated status instead of stored status
                primaryZoneId: agent.primaryZoneId,
                createdAt: agent.createdAt
            };
        }));
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
        // Import ScheduledAssignment model
        const { ScheduledAssignment } = require('../models/ScheduledAssignment');
        // Get all individual zone assignments for this agent
        const individualZoneAssignments = await AgentZoneAssignment_1.AgentZoneAssignment.find({
            agentId: agent._id,
            status: { $nin: ['COMPLETED', 'CANCELLED'] },
            effectiveTo: null
        }).populate('zoneId', 'name');
        // Get all team zone assignments for this agent's teams
        const teamZoneAssignments = await AgentZoneAssignment_1.AgentZoneAssignment.find({
            teamId: { $in: agent.teamIds },
            status: { $nin: ['COMPLETED', 'CANCELLED'] },
            effectiveTo: null
        }).populate('zoneId', 'name');
        // Get all PENDING scheduled individual assignments
        const pendingIndividualScheduledAssignments = await ScheduledAssignment.find({
            agentId: agent._id,
            status: 'PENDING'
        }).populate('zoneId', 'name');
        // Get all PENDING scheduled team assignments
        const pendingTeamScheduledAssignments = await ScheduledAssignment.find({
            teamId: { $in: agent.teamIds },
            status: 'PENDING'
        }).populate('zoneId', 'name');
        // Combine all assignments (active + scheduled)
        const allAssignments = [
            ...individualZoneAssignments,
            ...teamZoneAssignments,
            ...pendingIndividualScheduledAssignments,
            ...pendingTeamScheduledAssignments
        ];
        // Create a map of zones from all assignment records (both active and scheduled)
        const assignmentZones = allAssignments.map(assignment => ({
            _id: assignment.zoneId._id,
            name: assignment.zoneId.name,
            isPrimary: assignment.zoneId._id.toString() === agent.primaryZoneId?._id?.toString(),
            isScheduled: assignment.status === 'PENDING' // Add flag to identify scheduled assignments
        }));
        // Get team information (including teams from assignments)
        const teamIdsFromAssignments = [
            ...teamZoneAssignments.map(a => a.teamId),
            ...pendingTeamScheduledAssignments.map((a) => a.teamId)
        ];
        const allTeamIds = [...new Set([
                ...(agent.teamIds || []),
                ...teamIdsFromAssignments
            ])];
        const teams = allTeamIds.length > 0
            ? await Team_1.Team.find({ _id: { $in: allTeamIds } }).select('name')
            : [];
        // Use assignment zones if available, otherwise fall back to User model's zoneIds
        const zones = assignmentZones.length > 0
            ? assignmentZones
            : (agent.zoneIds && agent.zoneIds.length > 0
                ? await Zone_1.Zone.find({ _id: { $in: agent.zoneIds } }).select('name')
                : []);
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
        // Calculate correct status based on zone assignments (including scheduled assignments)
        const calculatedStatus = await calculateAgentStatus(agent._id.toString());
        // Get primary team and zone from assignments
        const primaryTeam = teams.length > 0 ? teams[0] : null; // First team as primary
        const primaryZone = zones.length > 0 ? zones[0] : null; // First zone as primary
        const detailedAgent = {
            _id: agent._id,
            name: agent.name,
            email: agent.email,
            username: agent.username,
            contactNumber: agent.contactNumber,
            role: agent.role,
            status: calculatedStatus,
            password: agent.originalPassword || 'Password not available', // Return original password for admin view
            primaryTeamId: primaryTeam,
            primaryZoneId: primaryZone,
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
// Function to refresh assignment statuses for all agents
const refreshAssignmentStatuses = async (req, res) => {
    try {
        const currentUserId = req.user?.sub;
        const { updateUserAssignmentStatus } = require('../controllers/assignment.controller');
        // Get all agents created by this admin
        const agents = await User_1.User.find({
            role: 'AGENT',
            createdBy: currentUserId
        });
        console.log(`🔄 refreshAssignmentStatuses: Processing ${agents.length} agents`);
        // Update each agent's assignment status
        const updatePromises = agents.map(async (agent) => {
            try {
                await updateUserAssignmentStatus(agent._id.toString());
                return { agentId: agent._id, name: agent.name, success: true };
            }
            catch (error) {
                console.error(`❌ Failed to update assignment status for agent ${agent.name}:`, error);
                return { agentId: agent._id, name: agent.name, success: false, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        });
        const results = await Promise.all(updatePromises);
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        console.log(`✅ refreshAssignmentStatuses: Updated ${successful.length} agents, ${failed.length} failed`);
        res.json({
            success: true,
            message: 'Assignment statuses refreshed successfully',
            data: {
                totalAgents: agents.length,
                successful: successful.length,
                failed: failed.length,
                results
            }
        });
    }
    catch (error) {
        console.error('❌ Error refreshing assignment statuses:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to refresh assignment statuses',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.refreshAssignmentStatuses = refreshAssignmentStatuses;
// Function to refresh all agent and team statuses based on zone assignments
const refreshAllStatuses = async (req, res) => {
    try {
        const currentUserId = req.user?.sub;
        // Get all agents created by this admin
        const agents = await User_1.User.find({
            role: 'AGENT',
            createdBy: currentUserId
        });
        // Update each agent's status
        const agentUpdates = agents.map(async (agent) => {
            const calculatedStatus = await calculateAgentStatus(agent._id.toString());
            if (calculatedStatus !== agent.status) {
                await User_1.User.findByIdAndUpdate(agent._id, { status: calculatedStatus });
                return { agentId: agent._id, name: agent.name, oldStatus: agent.status, newStatus: calculatedStatus };
            }
            return null;
        });
        const agentResults = await Promise.all(agentUpdates);
        const updatedAgents = agentResults.filter(result => result !== null);
        // Get all teams created by this admin (filter out teams with no members)
        const allTeams = await Team_1.Team.find({ createdBy: currentUserId }).populate('agentIds');
        const teams = allTeams.filter(team => team.agentIds && team.agentIds.length > 0);
        // Update each team's status
        const teamUpdates = teams.map(async (team) => {
            const calculatedStatus = await calculateTeamStatus(team._id.toString());
            if (calculatedStatus !== team.status) {
                await Team_1.Team.findByIdAndUpdate(team._id, { status: calculatedStatus });
                return { teamId: team._id, name: team.name, oldStatus: team.status, newStatus: calculatedStatus };
            }
            return null;
        });
        const teamResults = await Promise.all(teamUpdates);
        const updatedTeams = teamResults.filter(result => result !== null);
        res.json({
            success: true,
            message: 'All statuses refreshed successfully',
            data: {
                updatedAgents,
                updatedTeams,
                summary: {
                    agentsUpdated: updatedAgents.length,
                    teamsUpdated: updatedTeams.length
                }
            }
        });
    }
    catch (error) {
        console.error('Error refreshing statuses:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to refresh statuses',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.refreshAllStatuses = refreshAllStatuses;
//# sourceMappingURL=user.controller.js.map