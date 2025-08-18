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
const Zone_1 = require("../models/Zone");
const Activity_1 = require("../models/Activity");
const Performance_1 = require("../models/Performance");
const Route_1 = require("../models/Route");
const mongoose_1 = __importDefault(require("mongoose"));
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
        const total = await Team_1.Team.countDocuments(filter);
        res.json({
            success: true,
            data: teams,
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
        // Get zone assignments for this team
        const zoneAssignments = await AgentZoneAssignment_1.AgentZoneAssignment.find({
            teamId: team._id,
            status: { $in: ['ACTIVE', 'COMPLETED'] },
            effectiveTo: null
        }).populate('zoneId', 'name');
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
        // Count active and inactive members
        const activeMembers = team.agentIds.filter((agent) => agent.status === 'ACTIVE').length;
        const totalMembers = team.agentIds.length;
        // Add performance data to team object
        const teamWithPerformance = {
            ...team.toObject(),
            performance: {
                totalMembers,
                activeMembers,
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
            superadminId: currentUserId
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
                superadminId: currentUserId,
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
            .populate('superadminId', 'name email');
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
            superadminId: currentUserId
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
        const totalTeams = await Team_1.Team.countDocuments({ superadminId: currentUserId });
        // Get total members (agents created by this admin)
        const totalMembers = await User_1.User.countDocuments({
            role: 'AGENT',
            createdBy: currentUserId
        });
        // Get teams with assigned work (routes or activities)
        const teamsWithWork = await Team_1.Team.aggregate([
            { $match: { superadminId: new mongoose_1.default.Types.ObjectId(currentUserId) } },
            {
                $lookup: {
                    from: 'routes',
                    localField: '_id',
                    foreignField: 'teamId',
                    as: 'routes'
                }
            },
            {
                $lookup: {
                    from: 'activities',
                    localField: 'agentIds',
                    foreignField: 'agentId',
                    as: 'activities'
                }
            },
            {
                $lookup: {
                    from: 'agentteamassignments',
                    localField: '_id',
                    foreignField: 'teamId',
                    as: 'teamAssignments'
                }
            },
            {
                $match: {
                    $or: [
                        { 'routes.0': { $exists: true } },
                        { 'activities.0': { $exists: true } },
                        {
                            'teamAssignments': {
                                $elemMatch: {
                                    status: { $in: ['ACTIVE', 'COMPLETED'] },
                                    effectiveTo: null
                                }
                            }
                        }
                    ]
                }
            }
        ]);
        // Get inactive teams (teams without any work assigned)
        const inactiveTeams = totalTeams - teamsWithWork.length;
        // Get active members (members who are in teams OR have direct work assignments)
        const activeMembers = await User_1.User.aggregate([
            {
                $match: {
                    role: 'AGENT',
                    createdBy: new mongoose_1.default.Types.ObjectId(currentUserId)
                }
            },
            {
                $lookup: {
                    from: 'routes',
                    localField: '_id',
                    foreignField: 'agentId',
                    as: 'directRoutes'
                }
            },
            {
                $lookup: {
                    from: 'activities',
                    localField: '_id',
                    foreignField: 'agentId',
                    as: 'directActivities'
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
                $match: {
                    $or: [
                        {
                            'teamAssignments': {
                                $elemMatch: {
                                    status: { $in: ['ACTIVE', 'COMPLETED'] },
                                    effectiveTo: null
                                }
                            }
                        }, // Member has active team assignments
                        {
                            'zoneAssignments': {
                                $elemMatch: {
                                    status: { $in: ['ACTIVE', 'COMPLETED'] },
                                    effectiveTo: null
                                }
                            }
                        }, // Member has active zone assignments
                        { 'directRoutes.0': { $exists: true } }, // Member has direct route assignments
                        { 'directActivities.0': { $exists: true } } // Member has direct activity assignments
                    ]
                }
            },
            {
                $count: 'activeMembers'
            }
        ]);
        const activeMembersCount = activeMembers.length > 0 ? activeMembers[0].activeMembers : 0;
        const inactiveMembersCount = totalMembers - activeMembersCount;
        // Get total zones
        const totalZones = await Zone_1.Zone.countDocuments({ createdBy: currentUserId });
        // Calculate real performance data from activities
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        // Get all agents created by this admin
        const adminAgents = await User_1.User.find({
            role: 'AGENT',
            createdBy: currentUserId
        }).select('_id');
        const agentIds = adminAgents.map(agent => agent._id);
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
            { $match: { superadminId: new mongoose_1.default.Types.ObjectId(currentUserId) } },
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
        const teams = await Team_1.Team.find({ superadminId: currentUserId })
            .populate('agentIds', 'name email status zoneId')
            .populate('leaderId', 'name email');
        const performanceData = await Promise.all(teams.map(async (team) => {
            // Count members with zone assignments
            const activeMembers = team.agentIds.filter((agent) => agent.zoneId).length;
            // Calculate zone coverage (number of unique zones assigned to team members)
            const assignedZones = new Set();
            team.agentIds.forEach((agent) => {
                if (agent.zoneId) {
                    assignedZones.add(agent.zoneId.toString());
                }
            });
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