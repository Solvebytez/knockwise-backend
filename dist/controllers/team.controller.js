"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTeamPerformance = exports.getTeamStats = exports.deleteTeam = exports.updateTeam = exports.getTeamById = exports.getMyTeams = exports.createTeam = void 0;
const Team_1 = require("../models/Team");
const User_1 = require("../models/User");
const AgentTeamAssignment_1 = require("../models/AgentTeamAssignment");
const AgentZoneAssignment_1 = require("../models/AgentZoneAssignment");
const Activity_1 = require("../models/Activity");
const Performance_1 = require("../models/Performance");
const Route_1 = require("../models/Route");
const mongoose_1 = __importDefault(require("mongoose"));
// Helper function to calculate team status based on zone assignments
const calculateTeamStatus = async (teamId) => {
    try {
        // Import ScheduledAssignment model
        const { ScheduledAssignment } = require('../models/ScheduledAssignment');
        // Check if team has any zone assignments (exclude COMPLETED and CANCELLED)
        const teamZoneAssignments = await AgentZoneAssignment_1.AgentZoneAssignment.find({
            teamId: teamId,
            status: { $nin: ['COMPLETED', 'CANCELLED'] },
            effectiveTo: null
        });
        // Check if team has any PENDING scheduled assignments
        const scheduledAssignments = await ScheduledAssignment.find({
            teamId: teamId,
            status: 'PENDING'
        });
        // Team is ACTIVE if it has any zone assignments (active or scheduled)
        const hasZoneAssignment = teamZoneAssignments.length > 0 || scheduledAssignments.length > 0;
        return hasZoneAssignment ? 'ACTIVE' : 'INACTIVE';
    }
    catch (error) {
        console.error('Error calculating team status:', error);
        return 'INACTIVE';
    }
};
// Helper function to calculate agent status (imported from user controller)
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
        const shouldBeActive = hasIndividualZoneAssignment ||
            hasIndividualPrimaryZone ||
            hasActiveIndividualZoneAssignment ||
            hasTeamZoneAssignment ||
            hasPendingIndividualScheduledAssignment ||
            hasPendingTeamScheduledAssignment;
        return shouldBeActive ? 'ACTIVE' : 'INACTIVE';
    }
    catch (error) {
        console.error('Error calculating agent status:', error);
        return 'INACTIVE';
    }
};
// Helper function to update team status based on zone assignments
const updateTeamStatus = async (teamId) => {
    try {
        const team = await Team_1.Team.findById(teamId);
        if (!team)
            return;
        const calculatedStatus = await calculateTeamStatus(teamId);
        if (calculatedStatus !== team.status) {
            await Team_1.Team.findByIdAndUpdate(teamId, { status: calculatedStatus });
            console.log(`Team ${team.name} (${teamId}) status updated to ${calculatedStatus}`);
        }
    }
    catch (error) {
        console.error('Error updating team status:', error);
    }
};
// Create a new team
const createTeam = async (req, res) => {
    try {
        const { name, description, memberIds, agentIds } = req.body;
        const memberIdsToUse = memberIds || agentIds; // Handle both field names
        const currentUserId = req.user?.sub;
        // Check if team name already exists for this admin
        const existingTeam = await Team_1.Team.findOne({
            name,
            createdBy: currentUserId
        });
        if (existingTeam) {
            return res.status(409).json({
                success: false,
                message: 'Team with this name already exists'
            });
        }
        // Validate that all member IDs are valid and belong to agents created by this admin
        if (memberIdsToUse && memberIdsToUse.length > 0) {
            const validMembers = await User_1.User.find({
                _id: { $in: memberIdsToUse },
                role: 'AGENT',
                createdBy: currentUserId
            });
            if (validMembers.length !== memberIdsToUse.length) {
                return res.status(400).json({
                    success: false,
                    message: 'Some member IDs are invalid or do not belong to agents created by you'
                });
            }
            // Select the first member as team leader (or you can implement custom logic)
            const teamLeaderId = memberIdsToUse[0];
            // Create the team
            const team = new Team_1.Team({
                name,
                description,
                status: 'INACTIVE', // Will be updated when zone assignments are made
                createdBy: currentUserId,
                leaderId: teamLeaderId,
                agentIds: memberIdsToUse
            });
            await team.save();
            // Create team assignments for all members
            const teamAssignments = memberIdsToUse.map((agentId) => ({
                agentId,
                teamId: team._id,
                effectiveFrom: new Date(),
                status: 'ACTIVE',
                assignedBy: currentUserId
            }));
            await AgentTeamAssignment_1.AgentTeamAssignment.insertMany(teamAssignments);
            // Update users with team information
            await User_1.User.updateMany({ _id: { $in: memberIdsToUse } }, {
                $addToSet: { teamIds: team._id },
                $set: { primaryTeamId: team._id }
            });
            // Populate the response with member details
            const populatedTeam = await Team_1.Team.findById(team._id)
                .populate('leaderId', 'name email')
                .populate('agentIds', 'name email status')
                .populate('createdBy', 'name email');
            res.status(201).json({
                success: true,
                message: 'Team created successfully',
                data: populatedTeam
            });
        }
        else {
            return res.status(400).json({
                success: false,
                message: 'At least one team member is required'
            });
        }
    }
    catch (error) {
        console.error('Error creating team:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create team',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.createTeam = createTeam;
// Get all teams for current admin
const getMyTeams = async (req, res) => {
    try {
        const { page = 1, limit = 10, search } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const currentUserId = req.user?.sub;
        const filter = {
            createdBy: currentUserId
        };
        if (search) {
            filter.name = { $regex: search, $options: 'i' };
        }
        const teams = await Team_1.Team.find(filter)
            .populate('leaderId', 'name email')
            .populate('agentIds', 'name email status')
            .populate('createdBy', 'name email')
            .skip(skip)
            .limit(Number(limit))
            .sort({ createdAt: -1 });
        // Import ScheduledAssignment model
        const { ScheduledAssignment } = require('../models/ScheduledAssignment');
        // Calculate correct status and zone coverage for each team
        const teamsWithCorrectStatus = await Promise.all(teams.map(async (team) => {
            const calculatedStatus = await calculateTeamStatus(team._id.toString());
            // Get zone assignments for this team (active and scheduled)
            const activeZoneAssignments = await AgentZoneAssignment_1.AgentZoneAssignment.find({
                teamId: team._id,
                status: { $nin: ['COMPLETED', 'CANCELLED'] },
                effectiveTo: null
            }).populate('zoneId', 'name');
            const scheduledZoneAssignments = await ScheduledAssignment.find({
                teamId: team._id,
                status: 'PENDING'
            }).populate('zoneId', 'name');
            // Combine all zone assignments
            const zoneAssignments = [...activeZoneAssignments, ...scheduledZoneAssignments];
            // Calculate zone coverage
            const uniqueZones = new Set();
            zoneAssignments.forEach((assignment) => {
                if (assignment.zoneId) {
                    uniqueZones.add(assignment.zoneId._id.toString());
                }
            });
            const zoneCoverage = uniqueZones.size;
            return {
                ...team.toObject(),
                status: calculatedStatus, // Use calculated status instead of stored status
                performance: {
                    totalMembers: team.agentIds.length,
                    activeMembers: 0, // Will be calculated by frontend
                    averageKnocks: 0,
                    completionRate: 0,
                    zoneCoverage // Add zone coverage for table display
                }
            };
        }));
        const total = await Team_1.Team.countDocuments(filter);
        res.json({
            success: true,
            data: teamsWithCorrectStatus,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            }
        });
    }
    catch (error) {
        console.error('Error getting teams:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get teams',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.getMyTeams = getMyTeams;
// Get team by ID with detailed information
const getTeamById = async (req, res) => {
    try {
        const { teamId } = req.params;
        const currentUserId = req.user?.sub;
        const team = await Team_1.Team.findOne({
            _id: teamId,
            createdBy: currentUserId
        })
            .populate('leaderId', 'name email')
            .populate('agentIds', 'name email status')
            .populate('createdBy', 'name email');
        if (!team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found'
            });
        }
        // Get performance data for this specific team
        const teamAgentIds = team.agentIds.map((agent) => agent._id);
        // Get performance data for team members
        const performanceData = await Performance_1.Performance.aggregate([
            {
                $match: {
                    agentId: { $in: teamAgentIds }
                }
            },
            {
                $group: {
                    _id: null,
                    totalVisits: { $sum: '$totalVisits' },
                    totalAppointments: { $sum: '$appointments' },
                    totalLeads: { $sum: '$leadsCreated' },
                    totalDuration: { $sum: '$totalDurationSeconds' }
                }
            }
        ]);
        // Get route completion data for this team
        const routeData = await Route_1.Route.aggregate([
            {
                $match: {
                    teamId: team._id,
                    status: { $in: ['COMPLETED', 'IN_PROGRESS', 'CANCELLED', 'ARCHIVED'] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRoutes: { $sum: 1 },
                    completedRoutes: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0]
                        }
                    }
                }
            }
        ]);
        // Import ScheduledAssignment model
        const { ScheduledAssignment } = require('../models/ScheduledAssignment');
        // Get zone assignments for this team (active and scheduled)
        const activeZoneAssignments = await AgentZoneAssignment_1.AgentZoneAssignment.find({
            teamId: team._id,
            status: { $nin: ['COMPLETED', 'CANCELLED'] },
            effectiveTo: null
        }).populate('zoneId', 'name');
        const scheduledZoneAssignments = await ScheduledAssignment.find({
            teamId: team._id,
            status: 'PENDING'
        }).populate('zoneId', 'name');
        // Combine all zone assignments
        const zoneAssignments = [...activeZoneAssignments, ...scheduledZoneAssignments];
        // Calculate performance metrics
        let averageKnocks = 0;
        let completionRate = 0;
        let zoneCoverage = 0;
        if (performanceData.length > 0 && performanceData[0].totalVisits > 0) {
            const data = performanceData[0];
            averageKnocks = data.totalVisits;
            completionRate = Math.round(((data.totalAppointments + data.totalLeads) / data.totalVisits) * 100);
        }
        // Calculate route completion rate
        let routeCompletionRate = 0;
        if (routeData.length > 0 && routeData[0].totalRoutes > 0) {
            routeCompletionRate = Math.round((routeData[0].completedRoutes / routeData[0].totalRoutes) * 100);
        }
        // Use route completion rate if available, otherwise use performance completion rate
        const finalCompletionRate = routeCompletionRate > 0 ? routeCompletionRate : completionRate;
        // Calculate zone coverage
        const uniqueZones = new Set();
        zoneAssignments.forEach((assignment) => {
            if (assignment.zoneId) {
                uniqueZones.add(assignment.zoneId._id.toString());
            }
        });
        zoneCoverage = uniqueZones.size;
        // Calculate correct status for each member and count active members
        const membersWithCorrectStatus = await Promise.all(team.agentIds.map(async (agent) => {
            const calculatedStatus = await calculateAgentStatus(agent._id.toString());
            return {
                ...agent.toObject(),
                status: calculatedStatus // Use calculated status instead of stored status
            };
        }));
        const activeMembersCount = membersWithCorrectStatus.filter(member => member.status === 'ACTIVE').length;
        const totalMembers = team.agentIds.length;
        // Calculate correct team status
        const calculatedTeamStatus = await calculateTeamStatus(team._id.toString());
        // Add performance data to team object
        const teamWithPerformance = {
            ...team.toObject(),
            status: calculatedTeamStatus, // Use calculated status
            agentIds: membersWithCorrectStatus, // Use members with correct status
            performance: {
                totalMembers,
                activeMembers: activeMembersCount,
                averageKnocks,
                completionRate: finalCompletionRate,
                zoneCoverage,
                totalRoutes: routeData.length > 0 ? routeData[0].totalRoutes : 0,
                completedRoutes: routeData.length > 0 ? routeData[0].completedRoutes : 0,
                zoneAssignments: zoneAssignments.map((assignment) => ({
                    zoneName: assignment.zoneId?.name || 'Unknown Zone',
                    status: assignment.status
                }))
            }
        };
        res.json({
            success: true,
            data: teamWithPerformance
        });
    }
    catch (error) {
        console.error('Error getting team:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get team',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.getTeamById = getTeamById;
// Update team
const updateTeam = async (req, res) => {
    try {
        const { teamId } = req.params;
        const { name, description, memberIds, agentIds } = req.body;
        const memberIdsToUse = memberIds || agentIds; // Handle both field names
        const currentUserId = req.user?.sub;
        const team = await Team_1.Team.findOne({
            _id: teamId,
            createdBy: currentUserId
        });
        if (!team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found'
            });
        }
        // Check if new name conflicts with existing team
        if (name && name !== team.name) {
            const existingTeam = await Team_1.Team.findOne({
                name,
                createdBy: currentUserId,
                _id: { $ne: teamId }
            });
            if (existingTeam) {
                return res.status(409).json({
                    success: false,
                    message: 'Team with this name already exists'
                });
            }
        }
        // Update team
        const updateData = {};
        if (name)
            updateData.name = name;
        if (description !== undefined)
            updateData.description = description;
        if (memberIdsToUse) {
            updateData.agentIds = memberIdsToUse;
            updateData.leaderId = memberIdsToUse[0]; // Set first member as leader
        }
        const updatedTeam = await Team_1.Team.findByIdAndUpdate(teamId, updateData, { new: true, runValidators: true })
            .populate('leaderId', 'name email')
            .populate('agentIds', 'name email status')
            .populate('createdBy', 'name email');
        // Update team assignments if members changed
        if (memberIdsToUse) {
            // Remove old assignments
            await AgentTeamAssignment_1.AgentTeamAssignment.deleteMany({ teamId });
            // Create new assignments
            const teamAssignments = memberIdsToUse.map((agentId) => ({
                agentId,
                teamId,
                effectiveFrom: new Date(),
                status: 'ACTIVE',
                assignedBy: currentUserId
            }));
            await AgentTeamAssignment_1.AgentTeamAssignment.insertMany(teamAssignments);
        }
        res.json({
            success: true,
            message: 'Team updated successfully',
            data: updatedTeam
        });
    }
    catch (error) {
        console.error('Error updating team:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update team',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.updateTeam = updateTeam;
// Delete team
const deleteTeam = async (req, res) => {
    try {
        const { teamId } = req.params;
        const currentUserId = req.user?.sub;
        const team = await Team_1.Team.findOne({
            _id: teamId,
            createdBy: currentUserId
        });
        if (!team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found'
            });
        }
        // Remove team assignments
        await AgentTeamAssignment_1.AgentTeamAssignment.deleteMany({ teamId });
        // Update users to remove team references
        await User_1.User.updateMany({ teamIds: teamId }, {
            $pull: { teamIds: teamId },
            $unset: { primaryTeamId: 1 }
        });
        // Delete the team
        await Team_1.Team.findByIdAndDelete(teamId);
        res.json({
            success: true,
            message: 'Team deleted successfully'
        });
    }
    catch (error) {
        console.error('Error deleting team:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete team',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.deleteTeam = deleteTeam;
// Get team statistics for dashboard
const getTeamStats = async (req, res) => {
    try {
        const currentUserId = req.user?.sub;
        // Get total teams
        const totalTeams = await Team_1.Team.countDocuments({ createdBy: currentUserId });
        // Get total members (agents created by this admin)
        const totalMembers = await User_1.User.countDocuments({
            role: 'AGENT',
            createdBy: currentUserId
        });
        // Get teams with zone assignments (active or scheduled)
        const teamsWithZoneAssignments = await Team_1.Team.aggregate([
            { $match: { createdBy: new mongoose_1.default.Types.ObjectId(currentUserId) } },
            {
                $lookup: {
                    from: 'agentzoneassignments',
                    localField: '_id',
                    foreignField: 'teamId',
                    as: 'zoneAssignments'
                }
            },
            {
                $lookup: {
                    from: 'scheduledassignments',
                    localField: '_id',
                    foreignField: 'teamId',
                    as: 'scheduledAssignments'
                }
            },
            {
                $match: {
                    $or: [
                        {
                            'zoneAssignments': {
                                $elemMatch: {
                                    status: { $nin: ['COMPLETED', 'CANCELLED'] },
                                    effectiveTo: null
                                }
                            }
                        },
                        {
                            'scheduledAssignments': {
                                $elemMatch: {
                                    status: 'PENDING'
                                }
                            }
                        }
                    ]
                }
            }
        ]);
        // Get inactive teams (teams without any zone assignments)
        const inactiveTeams = totalTeams - teamsWithZoneAssignments.length;
        // Get active members (members who have zone assignments - active or scheduled)
        const activeMembers = await User_1.User.aggregate([
            {
                $match: {
                    role: 'AGENT',
                    createdBy: new mongoose_1.default.Types.ObjectId(currentUserId)
                }
            },
            {
                $lookup: {
                    from: 'agentteamassignments',
                    localField: '_id',
                    foreignField: 'agentId',
                    as: 'teamAssignments'
                }
            },
            {
                $lookup: {
                    from: 'agentzoneassignments',
                    localField: '_id',
                    foreignField: 'agentId',
                    as: 'zoneAssignments'
                }
            },
            {
                $lookup: {
                    from: 'scheduledassignments',
                    localField: '_id',
                    foreignField: 'agentId',
                    as: 'scheduledAssignments'
                }
            },
            {
                $lookup: {
                    from: 'agentzoneassignments',
                    localField: 'teamIds',
                    foreignField: 'teamId',
                    as: 'teamZoneAssignments'
                }
            },
            {
                $lookup: {
                    from: 'scheduledassignments',
                    localField: 'teamIds',
                    foreignField: 'teamId',
                    as: 'teamScheduledAssignments'
                }
            },
            {
                $match: {
                    $or: [
                        {
                            'teamAssignments': {
                                $elemMatch: {
                                    status: { $nin: ['COMPLETED', 'CANCELLED'] },
                                    effectiveTo: null
                                }
                            }
                        }, // Member has active team assignments
                        {
                            'zoneAssignments': {
                                $elemMatch: {
                                    status: { $nin: ['COMPLETED', 'CANCELLED'] },
                                    effectiveTo: null
                                }
                            }
                        }, // Member has active individual zone assignments
                        {
                            'scheduledAssignments': {
                                $elemMatch: {
                                    status: 'PENDING'
                                }
                            }
                        }, // Member has scheduled individual assignments
                        {
                            'teamZoneAssignments': {
                                $elemMatch: {
                                    status: { $nin: ['COMPLETED', 'CANCELLED'] },
                                    effectiveTo: null
                                }
                            }
                        }, // Member's team has active zone assignments
                        {
                            'teamScheduledAssignments': {
                                $elemMatch: {
                                    status: 'PENDING'
                                }
                            }
                        } // Member's team has scheduled assignments
                    ]
                }
            },
            {
                $count: 'activeMembers'
            }
        ]);
        const activeMembersCount = activeMembers.length > 0 ? activeMembers[0].activeMembers : 0;
        const inactiveMembersCount = totalMembers - activeMembersCount;
        // Get total zones that are assigned to teams or agents created by this admin
        const adminTeams = await Team_1.Team.find({ createdBy: currentUserId }).select('_id');
        const adminAgents = await User_1.User.find({
            role: 'AGENT',
            createdBy: currentUserId
        }).select('_id');
        const teamIds = adminTeams.map(team => team._id);
        const agentIds = adminAgents.map(agent => agent._id);
        // Import ScheduledAssignment model
        const { ScheduledAssignment } = require('../models/ScheduledAssignment');
        // Count zones based on active AgentZoneAssignment records
        const activeZoneAssignments = await AgentZoneAssignment_1.AgentZoneAssignment.countDocuments({
            $or: [
                { agentId: { $in: agentIds }, status: { $nin: ['COMPLETED', 'CANCELLED'] }, effectiveTo: null },
                { teamId: { $in: teamIds }, status: { $nin: ['COMPLETED', 'CANCELLED'] }, effectiveTo: null }
            ]
        });
        // Count zones based on PENDING scheduled assignments
        const scheduledZoneAssignments = await ScheduledAssignment.countDocuments({
            $or: [
                { agentId: { $in: agentIds }, status: 'PENDING' },
                { teamId: { $in: teamIds }, status: 'PENDING' }
            ]
        });
        const totalZones = activeZoneAssignments + scheduledZoneAssignments;
        // Calculate real performance data from activities
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        // Use the existing agentIds from above
        // Calculate completed tasks (completed routes)
        const completedTasks = await Route_1.Route.countDocuments({
            agentId: { $in: agentIds },
            status: 'COMPLETED',
            updatedAt: { $gte: thirtyDaysAgo }
        });
        // Calculate active sessions (activities in last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const activeSessions = await Activity_1.Activity.countDocuments({
            agentId: { $in: agentIds },
            startedAt: { $gte: sevenDaysAgo }
        });
        // Calculate average performance based on actual activity data
        const performanceData = await Performance_1.Performance.aggregate([
            {
                $match: {
                    agentId: { $in: agentIds },
                    date: { $gte: thirtyDaysAgo.toISOString().split('T')[0] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalAppointments: { $sum: '$appointments' },
                    totalLeads: { $sum: '$leadsCreated' },
                    totalVisits: { $sum: '$totalVisits' },
                    count: { $sum: 1 }
                }
            }
        ]);
        let averagePerformance = 0;
        if (performanceData.length > 0 && performanceData[0].totalVisits > 0) {
            const data = performanceData[0];
            // Calculate performance as: (appointments + leads) / total visits * 100
            averagePerformance = Math.round(((data.totalAppointments + data.totalLeads) / data.totalVisits) * 100);
        }
        // Get top performing team based on actual performance
        const topPerformingTeam = await Team_1.Team.aggregate([
            { $match: { createdBy: new mongoose_1.default.Types.ObjectId(currentUserId) } },
            {
                $lookup: {
                    from: 'performances',
                    localField: 'agentIds',
                    foreignField: 'agentId',
                    as: 'performances'
                }
            },
            {
                $addFields: {
                    totalPerformance: {
                        $reduce: {
                            input: '$performances',
                            initialValue: 0,
                            in: {
                                $add: [
                                    '$$value',
                                    {
                                        $cond: [
                                            { $gt: ['$$this.totalVisits', 0] },
                                            {
                                                $multiply: [
                                                    {
                                                        $divide: [
                                                            { $add: ['$$this.appointments', '$$this.leadsCreated'] },
                                                            '$$this.totalVisits'
                                                        ]
                                                    },
                                                    100
                                                ]
                                            },
                                            0
                                        ]
                                    }
                                ]
                            }
                        }
                    },
                    performanceCount: { $size: '$performances' }
                }
            },
            {
                $addFields: {
                    avgPerformance: {
                        $cond: [
                            { $gt: ['$performanceCount', 0] },
                            { $divide: ['$totalPerformance', '$performanceCount'] },
                            0
                        ]
                    }
                }
            },
            { $sort: { avgPerformance: -1 } },
            { $limit: 1 }
        ]);
        // Get recent activity (last 30 days)
        const newMembers = await User_1.User.countDocuments({
            role: 'AGENT',
            createdBy: currentUserId,
            createdAt: { $gte: thirtyDaysAgo }
        });
        const stats = {
            totalTeams,
            totalMembers,
            activeMembers: activeMembersCount,
            inactiveMembers: inactiveMembersCount,
            inactiveTeams, // Teams without work assignments
            totalZones,
            averagePerformance,
            topPerformingTeam: {
                name: topPerformingTeam.length > 0 ? topPerformingTeam[0].name : 'N/A',
                performance: topPerformingTeam.length > 0 ? Math.round(topPerformingTeam[0].avgPerformance) : 0
            },
            recentActivity: {
                newMembers,
                completedTasks,
                activeSessions
            }
        };
        res.json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        console.error('Error getting team stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get team stats',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.getTeamStats = getTeamStats;
// Get team performance data
const getTeamPerformance = async (req, res) => {
    try {
        const currentUserId = req.user?.sub;
        const teams = await Team_1.Team.find({ createdBy: currentUserId })
            .populate('agentIds', 'name email status zoneId')
            .populate('leaderId', 'name email');
        const performanceData = await Promise.all(teams.map(async (team) => {
            // Import ScheduledAssignment model
            const { ScheduledAssignment } = require('../models/ScheduledAssignment');
            // Get zone assignments for this team (active and scheduled)
            const activeZoneAssignments = await AgentZoneAssignment_1.AgentZoneAssignment.find({
                teamId: team._id,
                status: { $nin: ['COMPLETED', 'CANCELLED'] },
                effectiveTo: null
            }).populate('zoneId', 'name');
            const scheduledZoneAssignments = await ScheduledAssignment.find({
                teamId: team._id,
                status: 'PENDING'
            }).populate('zoneId', 'name');
            // Combine all zone assignments
            const zoneAssignments = [...activeZoneAssignments, ...scheduledZoneAssignments];
            // Calculate zone coverage
            const assignedZones = new Set();
            zoneAssignments.forEach((assignment) => {
                if (assignment.zoneId) {
                    assignedZones.add(assignment.zoneId._id.toString());
                }
            });
            // Count active members using correct status calculation
            const activeMembers = await Promise.all(team.agentIds.map(async (agent) => {
                const calculatedStatus = await calculateAgentStatus(agent._id.toString());
                return calculatedStatus === 'ACTIVE';
            }));
            const activeMembersCount = activeMembers.filter(Boolean).length;
            // Calculate real performance data for this team
            const teamAgentIds = team.agentIds.map((agent) => agent._id);
            // Get performance data for team members
            const performanceData = await Performance_1.Performance.aggregate([
                {
                    $match: {
                        agentId: { $in: teamAgentIds }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalVisits: { $sum: '$totalVisits' },
                        totalAppointments: { $sum: '$appointments' },
                        totalLeads: { $sum: '$leadsCreated' },
                        totalDuration: { $sum: '$totalDurationSeconds' }
                    }
                }
            ]);
            // Get route completion data for this team
            const routeData = await Route_1.Route.aggregate([
                {
                    $match: {
                        teamId: team._id,
                        status: { $in: ['COMPLETED', 'IN_PROGRESS', 'CANCELLED', 'ARCHIVED'] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalRoutes: { $sum: 1 },
                        completedRoutes: {
                            $sum: {
                                $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0]
                            }
                        },
                        inProgressRoutes: {
                            $sum: {
                                $cond: [{ $eq: ['$status', 'IN_PROGRESS'] }, 1, 0]
                            }
                        },
                        cancelledRoutes: {
                            $sum: {
                                $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0]
                            }
                        },
                        archivedRoutes: {
                            $sum: {
                                $cond: [{ $eq: ['$status', 'ARCHIVED'] }, 1, 0]
                            }
                        }
                    }
                }
            ]);
            // Calculate performance metrics
            let averageKnocks = 0;
            let completionRate = 0;
            if (performanceData.length > 0 && performanceData[0].totalVisits > 0) {
                const data = performanceData[0];
                // Average knocks = total visits
                averageKnocks = data.totalVisits;
                // Completion rate = (appointments + leads) / total visits * 100
                completionRate = Math.round(((data.totalAppointments + data.totalLeads) / data.totalVisits) * 100);
            }
            // Calculate route completion rate
            let routeCompletionRate = 0;
            if (routeData.length > 0 && routeData[0].totalRoutes > 0) {
                routeCompletionRate = Math.round((routeData[0].completedRoutes / routeData[0].totalRoutes) * 100);
            }
            // Use route completion rate if available, otherwise use performance completion rate
            const finalCompletionRate = routeCompletionRate > 0 ? routeCompletionRate : completionRate;
            return {
                teamId: team._id.toString(),
                teamName: team.name,
                memberCount: team.agentIds.length,
                activeMembers: activeMembersCount,
                averageKnocks,
                completionRate: finalCompletionRate,
                zoneCoverage: assignedZones.size
            };
        }));
        res.json({
            success: true,
            data: performanceData
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
//# sourceMappingURL=team.controller.js.map