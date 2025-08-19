"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllZonesBuildingStats = exports.getZoneBuildingStats = exports.getTerritoryOverviewStats = exports.removeTeamFromZone = exports.assignTeamToZone = exports.updateResidentStatus = exports.getZoneResidents = exports.getZoneDetailedStats = exports.getZoneStatistics = exports.getZonesByProximity = exports.removeAgentFromZone = exports.getZoneAssignments = exports.assignAgentToZone = exports.deleteZone = exports.updateZone = exports.getZoneById = exports.checkZoneOverlapBeforeCreate = exports.listZones = exports.createZone = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Zone_1 = require("../models/Zone");
const User_1 = require("../models/User");
const AgentZoneAssignment_1 = require("../models/AgentZoneAssignment");
const AgentTeamAssignment_1 = require("../models/AgentTeamAssignment");
const Team_1 = require("../models/Team");
const Resident_1 = require("../models/Resident");
const Property_1 = require("../models/Property");
const Lead_1 = require("../models/Lead");
const Activity_1 = require("../models/Activity");
const Route_1 = require("../models/Route");
const ScheduledAssignment_1 = require("../models/ScheduledAssignment");
const addressParser_1 = require("../utils/addressParser");
const zoneOverlapChecker_1 = require("../utils/zoneOverlapChecker");
const scheduledAssignmentService_1 = require("../services/scheduledAssignmentService");
// Helper function to sync agent's zoneIds with all current assignments
const syncAgentZoneIds = async (agentId, session) => {
    try {
        // Get all active assignments for this agent (individual and team-based)
        const individualAssignments = await AgentZoneAssignment_1.AgentZoneAssignment.find({
            agentId: agentId,
            status: { $nin: ['COMPLETED', 'CANCELLED'] },
            effectiveTo: null
        }).populate('zoneId', '_id');
        const agent = await User_1.User.findById(agentId);
        if (!agent)
            return;
        // Get team-based assignments for this agent's teams
        const teamAssignments = await AgentZoneAssignment_1.AgentZoneAssignment.find({
            teamId: { $in: agent.teamIds },
            status: { $nin: ['COMPLETED', 'CANCELLED'] },
            effectiveTo: null
        }).populate('zoneId', '_id');
        // Combine all zone IDs from both individual and team assignments
        const allZoneIds = [
            ...individualAssignments.map(a => a.zoneId._id.toString()),
            ...teamAssignments.map(a => a.zoneId._id.toString())
        ];
        // Remove duplicates
        const uniqueZoneIds = [...new Set(allZoneIds)];
        // Update the agent's zoneIds to match all current assignments
        const updateOptions = session ? { session } : {};
        await User_1.User.findByIdAndUpdate(agentId, {
            zoneIds: uniqueZoneIds
        }, updateOptions);
        console.log(`Synced zoneIds for agent ${agent.name}: ${uniqueZoneIds.length} zones`);
    }
    catch (error) {
        console.error('Error syncing agent zoneIds:', error);
    }
};
// Helper function to update agent status based on zone assignments
const updateAgentStatus = async (agentId, session) => {
    try {
        const agent = await User_1.User.findById(agentId);
        if (!agent || agent.role !== 'AGENT')
            return;
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
        const pendingIndividualScheduledAssignments = await ScheduledAssignment_1.ScheduledAssignment.find({
            agentId: agent._id,
            status: 'PENDING'
        });
        const hasPendingIndividualScheduledAssignment = pendingIndividualScheduledAssignments.length > 0;
        // Check PENDING scheduled assignments (team)
        const pendingTeamScheduledAssignments = await ScheduledAssignment_1.ScheduledAssignment.find({
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
        const calculatedStatus = shouldBeActive ? 'ACTIVE' : 'INACTIVE';
        // Only update if the agent should be ACTIVE (don't automatically deactivate)
        if (calculatedStatus === 'ACTIVE' && agent.status !== 'ACTIVE') {
            const updateOptions = session ? { session } : {};
            await User_1.User.findByIdAndUpdate(agentId, { status: calculatedStatus }, updateOptions);
            console.log(`Agent ${agent.name} (${agentId}) status updated to ${calculatedStatus}`);
        }
    }
    catch (error) {
        console.error('Error updating agent status:', error);
    }
};
// Helper function to update team status based on zone assignments
const updateTeamStatus = async (teamId, session) => {
    try {
        const team = await Team_1.Team.findById(teamId);
        if (!team)
            return;
        // Check if team has any zone assignments (exclude COMPLETED and CANCELLED)
        const teamZoneAssignments = await AgentZoneAssignment_1.AgentZoneAssignment.find({
            teamId: teamId,
            status: { $nin: ['COMPLETED', 'CANCELLED'] },
            effectiveTo: null
        });
        // Check if team has any PENDING scheduled assignments
        const scheduledAssignments = await ScheduledAssignment_1.ScheduledAssignment.find({
            teamId: teamId,
            status: 'PENDING'
        });
        // Team is ACTIVE if it has any zone assignments (active or scheduled)
        const hasZoneAssignment = teamZoneAssignments.length > 0 || scheduledAssignments.length > 0;
        const newStatus = hasZoneAssignment ? 'ACTIVE' : 'INACTIVE';
        if (newStatus !== team.status) {
            const updateOptions = session ? { session } : {};
            await Team_1.Team.findByIdAndUpdate(teamId, { status: newStatus }, updateOptions);
            console.log(`Team ${team.name} (${teamId}) status updated to ${newStatus}`);
        }
    }
    catch (error) {
        console.error('Error updating team status:', error);
    }
};
// Helper function to update team assignment status based on zone assignments
const updateTeamAssignmentStatus = async (teamId, session) => {
    try {
        const team = await Team_1.Team.findById(teamId);
        if (!team)
            return;
        // Check if team has any active zone assignments (exclude COMPLETED and CANCELLED)
        const activeZoneAssignments = await AgentZoneAssignment_1.AgentZoneAssignment.find({
            teamId: teamId,
            status: { $nin: ['COMPLETED', 'CANCELLED'] },
            effectiveTo: null
        });
        // Check if team has any PENDING scheduled assignments
        const scheduledAssignments = await ScheduledAssignment_1.ScheduledAssignment.find({
            teamId: teamId,
            status: 'PENDING'
        });
        // Team is ASSIGNED if it has any zone assignments (active or scheduled)
        const hasZoneAssignment = activeZoneAssignments.length > 0 || scheduledAssignments.length > 0;
        const newAssignmentStatus = hasZoneAssignment ? 'ASSIGNED' : 'UNASSIGNED';
        if (newAssignmentStatus !== team.assignmentStatus) {
            const updateOptions = session ? { session } : {};
            await Team_1.Team.findByIdAndUpdate(teamId, { assignmentStatus: newAssignmentStatus }, updateOptions);
            console.log(`Team ${team.name} (${teamId}) assignment status updated to ${newAssignmentStatus}`);
        }
    }
    catch (error) {
        console.error('Error updating team assignment status:', error);
    }
};
// Helper function to update user assignment status based on zone assignments
const updateUserAssignmentStatus = async (userId, session) => {
    try {
        const user = await User_1.User.findById(userId);
        if (!user || user.role !== 'AGENT')
            return;
        // Check individual zone assignments (exclude COMPLETED and CANCELLED)
        const individualZoneAssignments = await AgentZoneAssignment_1.AgentZoneAssignment.find({
            agentId: user._id,
            status: { $nin: ['COMPLETED', 'CANCELLED'] },
            effectiveTo: null
        });
        // Check team zone assignments (exclude COMPLETED and CANCELLED)
        const teamZoneAssignments = await AgentZoneAssignment_1.AgentZoneAssignment.find({
            teamId: { $in: user.teamIds },
            status: { $nin: ['COMPLETED', 'CANCELLED'] },
            effectiveTo: null
        });
        // Check PENDING scheduled assignments (individual)
        const pendingIndividualScheduledAssignments = await ScheduledAssignment_1.ScheduledAssignment.find({
            agentId: user._id,
            status: 'PENDING'
        });
        // Check PENDING scheduled assignments (team)
        const pendingTeamScheduledAssignments = await ScheduledAssignment_1.ScheduledAssignment.find({
            teamId: { $in: user.teamIds },
            status: 'PENDING'
        });
        // User is ASSIGNED if they have any zone assignments (active or scheduled)
        const hasZoneAssignment = individualZoneAssignments.length > 0 ||
            teamZoneAssignments.length > 0 ||
            pendingIndividualScheduledAssignments.length > 0 ||
            pendingTeamScheduledAssignments.length > 0;
        const newAssignmentStatus = hasZoneAssignment ? 'ASSIGNED' : 'UNASSIGNED';
        if (newAssignmentStatus !== user.assignmentStatus) {
            const updateOptions = session ? { session } : {};
            await User_1.User.findByIdAndUpdate(userId, { assignmentStatus: newAssignmentStatus }, updateOptions);
            console.log(`User ${user.name} (${userId}) assignment status updated to ${newAssignmentStatus}`);
        }
    }
    catch (error) {
        console.error('Error updating user assignment status:', error);
    }
};
// Create a new zone
const createZone = async (req, res) => {
    try {
        const { name, description, boundary, teamId, buildingData, effectiveFrom } = req.body;
        // Validate boundary format
        if (!(0, zoneOverlapChecker_1.validateZoneBoundary)(boundary)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid zone boundary format. Please ensure the polygon is properly closed.'
            });
        }
        // Check if zone name already exists
        const existingZone = await Zone_1.Zone.findOne({ name });
        if (existingZone) {
            return res.status(409).json({
                success: false,
                message: 'Zone with this name already exists'
            });
        }
        // Check for overlapping zones
        const overlapResult = await (0, zoneOverlapChecker_1.checkZoneOverlap)(boundary);
        if (overlapResult.hasOverlap) {
            const overlappingZoneNames = overlapResult.overlappingZones.map(zone => zone.name).join(', ');
            return res.status(409).json({
                success: false,
                message: `This territory overlaps with existing zone(s): ${overlappingZoneNames}`,
                data: {
                    overlappingZones: overlapResult.overlappingZones,
                    overlapPercentage: overlapResult.overlapPercentage
                }
            });
        }
        // Process building data if provided
        let processedBuildingData = undefined;
        if (buildingData && buildingData.addresses && buildingData.coordinates) {
            processedBuildingData = (0, addressParser_1.processBuildingData)(buildingData.addresses, buildingData.coordinates);
            // Check for duplicate buildings across all zones
            const duplicateAddresses = await (0, zoneOverlapChecker_1.checkDuplicateBuildings)(processedBuildingData.addresses);
            if (duplicateAddresses.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: `${duplicateAddresses.length} buildings are already assigned to other territories`,
                    data: {
                        duplicateAddresses,
                        duplicateCount: duplicateAddresses.length
                    }
                });
            }
        }
        // Determine zone status based on assignment
        let zoneStatus = 'DRAFT';
        if (teamId || req.body.assignedAgentId) {
            // Check if this is a future assignment
            const effectiveDate = effectiveFrom ? new Date(effectiveFrom) : new Date();
            const now = new Date();
            const isFutureAssignment = effectiveDate > now;
            zoneStatus = isFutureAssignment ? 'SCHEDULED' : 'ACTIVE';
        }
        const zone = new Zone_1.Zone({
            name,
            description,
            boundary,
            teamId,
            buildingData: processedBuildingData,
            status: zoneStatus,
            createdBy: req.user?.id
        });
        await zone.save();
        // Handle team assignment if teamId is provided
        if (teamId) {
            // Get the team
            const team = await Team_1.Team.findById(teamId);
            if (team && team.agentIds && team.agentIds.length > 0) {
                const effectiveDate = effectiveFrom ? new Date(effectiveFrom) : new Date();
                const now = new Date();
                const isFutureAssignment = effectiveDate > now;
                if (isFutureAssignment) {
                    // Create scheduled assignment for future date
                    const scheduledAssignment = await scheduledAssignmentService_1.ScheduledAssignmentService.createScheduledAssignment({
                        teamId: teamId,
                        zoneId: zone._id,
                        scheduledDate: effectiveDate,
                        effectiveFrom: effectiveDate,
                        assignedBy: req.user?.id
                    });
                    // Update team assignment status
                    await updateTeamAssignmentStatus(teamId);
                    // Update assignment status for all team members (they have pending scheduled assignment)
                    for (const agentId of team.agentIds) {
                        await updateUserAssignmentStatus(agentId.toString());
                    }
                }
                else {
                    // Create immediate team assignments for all team members
                    const teamAssignments = team.agentIds.map((agentId) => ({
                        agentId,
                        teamId,
                        zoneId: zone._id,
                        effectiveFrom: effectiveDate,
                        status: 'ACTIVE',
                        assignedBy: req.user?.id
                    }));
                    await AgentZoneAssignment_1.AgentZoneAssignment.insertMany(teamAssignments);
                    // Update user fields for all team members
                    await User_1.User.updateMany({ _id: { $in: team.agentIds } }, {
                        primaryZoneId: zone._id,
                        $addToSet: { zoneIds: zone._id }
                    });
                    // Update assignment status for all team members
                    for (const agentId of team.agentIds) {
                        await syncAgentZoneIds(agentId.toString());
                        await updateUserAssignmentStatus(agentId.toString());
                    }
                    // Update team assignment status
                    await updateTeamAssignmentStatus(teamId);
                }
            }
        }
        // Handle individual agent assignment if assignedAgentId is provided
        if (req.body.assignedAgentId) {
            const assignedAgentId = req.body.assignedAgentId;
            const effectiveDate = effectiveFrom ? new Date(effectiveFrom) : new Date();
            const now = new Date();
            const isFutureAssignment = effectiveDate > now;
            if (isFutureAssignment) {
                // Create scheduled assignment for future date
                const scheduledAssignment = await scheduledAssignmentService_1.ScheduledAssignmentService.createScheduledAssignment({
                    agentId: assignedAgentId,
                    zoneId: zone._id,
                    scheduledDate: effectiveDate,
                    effectiveFrom: effectiveDate,
                    assignedBy: req.user?.id
                });
                // Update agent assignment status
                await updateUserAssignmentStatus(assignedAgentId);
            }
            else {
                // Create immediate individual assignment
                const assignmentData = {
                    agentId: assignedAgentId,
                    zoneId: zone._id,
                    effectiveFrom: effectiveDate,
                    status: 'ACTIVE',
                    assignedBy: req.user?.id
                };
                await AgentZoneAssignment_1.AgentZoneAssignment.create(assignmentData);
                // Update user fields
                await User_1.User.findByIdAndUpdate(assignedAgentId, {
                    primaryZoneId: zone._id,
                    $addToSet: { zoneIds: zone._id }
                });
                // Sync agent zoneIds and update assignment status
                await syncAgentZoneIds(assignedAgentId);
                await updateUserAssignmentStatus(assignedAgentId);
            }
        }
        // Save individual residents if building data is provided
        if (processedBuildingData && processedBuildingData.addresses.length > 0) {
            const residents = processedBuildingData.addresses.map((address, index) => {
                const coordinates = processedBuildingData.coordinates[index];
                const houseNumber = (0, addressParser_1.extractHouseNumber)(address);
                return new Resident_1.Resident({
                    zoneId: zone._id,
                    address,
                    coordinates,
                    houseNumber,
                    status: 'not-visited',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
            });
            await Resident_1.Resident.insertMany(residents);
        }
        // Get house number statistics for response
        let houseNumberStats = null;
        if (processedBuildingData) {
            houseNumberStats = (0, addressParser_1.getHouseNumberStats)(processedBuildingData.houseNumbers);
        }
        res.status(201).json({
            success: true,
            message: 'Zone created successfully',
            data: {
                ...zone.toObject(),
                houseNumberStats
            }
        });
    }
    catch (error) {
        console.error('Error creating zone:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create zone',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.createZone = createZone;
// Get all zones with pagination and filtering
const listZones = async (req, res) => {
    try {
        const { page, limit, teamId, status, showAll } = req.query;
        // Check if this is a request for all zones (no pagination parameters)
        const isListAll = !page && !limit;
        const filter = {};
        if (teamId)
            filter.teamId = teamId;
        if (status)
            filter.status = status;
        // If user is not superadmin, only show zones for their team
        // UNLESS this is a request to show all territories (like in edit page)
        if (req.user?.role !== 'SUPERADMIN' && !showAll) {
            filter.teamId = req.user?.primaryTeamId;
        }
        let zones;
        if (isListAll) {
            // Return all zones without pagination
            zones = await Zone_1.Zone.find(filter)
                .populate('teamId', 'name')
                .populate('createdBy', 'name email')
                .sort({ createdAt: -1 });
        }
        else {
            // Use pagination
            const pageNum = Number(page) || 1;
            const limitNum = Number(limit) || 10;
            const skip = (pageNum - 1) * limitNum;
            zones = await Zone_1.Zone.find(filter)
                .populate('teamId', 'name')
                .populate('createdBy', 'name email')
                .skip(skip)
                .limit(limitNum)
                .sort({ createdAt: -1 });
        }
        // Import ScheduledAssignment model
        const { ScheduledAssignment } = require('../models/ScheduledAssignment');
        // Get current active and scheduled assignments for each zone
        const zonesWithAssignments = await Promise.all(zones.map(async (zone) => {
            // Get active assignments
            const activeAssignments = await AgentZoneAssignment_1.AgentZoneAssignment.find({
                zoneId: zone._id,
                status: { $nin: ['COMPLETED', 'CANCELLED'] },
                effectiveTo: null
            }).populate('agentId', 'name email').populate('teamId', 'name');
            // Get scheduled assignments
            const scheduledAssignment = await ScheduledAssignment.findOne({
                zoneId: zone._id,
                status: 'PENDING'
            }).populate('agentId', 'name email').populate('teamId', 'name');
            // Determine current assignment - prioritize team assignments over individual
            let currentAssignment = null;
            if (activeAssignments.length > 0) {
                // If there are multiple assignments (team assignment), find the one with teamId
                const teamAssignment = activeAssignments.find(assignment => assignment.teamId);
                if (teamAssignment) {
                    // For team assignments, return a representative assignment with teamId but no specific agentId
                    currentAssignment = {
                        _id: teamAssignment._id,
                        agentId: null, // Don't show specific agent for team assignments
                        teamId: teamAssignment.teamId,
                        effectiveFrom: teamAssignment.effectiveFrom,
                        effectiveTo: teamAssignment.effectiveTo,
                        status: teamAssignment.status
                    };
                }
                else {
                    // Individual assignment
                    currentAssignment = activeAssignments[0];
                }
            }
            else if (scheduledAssignment) {
                currentAssignment = scheduledAssignment;
            }
            // Get zone statistics
            const totalResidents = await Resident_1.Resident.countDocuments({ zoneId: zone._id });
            const activeResidents = await Resident_1.Resident.countDocuments({
                zoneId: zone._id,
                status: { $in: ['interested', 'visited', 'callback', 'appointment', 'follow-up'] }
            });
            // Calculate completion rate
            const completionRate = totalResidents > 0 ? Math.round((activeResidents / totalResidents) * 100) : 0;
            // Get average knocks (activities)
            const activities = await Activity_1.Activity.find({ zoneId: zone._id });
            const averageKnocks = activities.length > 0 ? Math.round(activities.length / totalResidents) : 0;
            // Get last activity
            const lastActivity = await Activity_1.Activity.findOne({ zoneId: zone._id })
                .sort({ createdAt: -1 })
                .select('createdAt');
            const zoneData = zone.toObject();
            const lastActivityDate = lastActivity ? lastActivity.createdAt : new Date();
            // Calculate zone status based on assignments and completion
            let calculatedStatus = 'DRAFT'; // Default to DRAFT
            // Check if zone is completed (all houses visited)
            if (zone.buildingData?.houseStatuses) {
                const houseStatuses = Array.from(zone.buildingData.houseStatuses.values());
                const totalHouses = houseStatuses.length;
                const visitedHouses = houseStatuses.filter(house => house.status !== 'not-visited').length;
                // If all houses have been visited (not 'not-visited'), mark as COMPLETED
                if (totalHouses > 0 && visitedHouses === totalHouses) {
                    calculatedStatus = 'COMPLETED';
                }
                else if (currentAssignment) {
                    // Check if it's a scheduled assignment (future date)
                    const assignmentDate = new Date(currentAssignment.effectiveFrom);
                    const now = new Date();
                    if (assignmentDate > now) {
                        calculatedStatus = 'SCHEDULED';
                    }
                    else {
                        calculatedStatus = 'ACTIVE';
                    }
                }
            }
            else if (currentAssignment) {
                // Check if it's a scheduled assignment (future date)
                const assignmentDate = new Date(currentAssignment.effectiveFrom);
                const now = new Date();
                if (assignmentDate > now) {
                    calculatedStatus = 'SCHEDULED';
                }
                else {
                    calculatedStatus = 'ACTIVE';
                }
            }
            return {
                ...zoneData,
                status: calculatedStatus, // Use calculated status
                assignedAgentId: currentAssignment?.agentId || null,
                currentAssignment: currentAssignment ? {
                    _id: currentAssignment._id,
                    agentId: currentAssignment.agentId,
                    teamId: currentAssignment.teamId,
                    effectiveFrom: currentAssignment.effectiveFrom,
                    effectiveTo: currentAssignment.effectiveTo,
                    status: currentAssignment.status
                } : null,
                totalResidents,
                activeResidents,
                completionRate,
                averageKnocks,
                lastActivity: lastActivityDate
            };
        }));
        const total = await Zone_1.Zone.countDocuments(filter);
        if (isListAll) {
            // Return all zones without pagination
            res.json({
                success: true,
                data: zonesWithAssignments
            });
        }
        else {
            // Return paginated response
            const pageNum = Number(page) || 1;
            const limitNum = Number(limit) || 10;
            res.json({
                success: true,
                data: zonesWithAssignments,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    pages: Math.ceil(total / limitNum)
                }
            });
        }
    }
    catch (error) {
        console.error('Error listing zones:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to list zones',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.listZones = listZones;
// Check zone overlap before creation
const checkZoneOverlapBeforeCreate = async (req, res) => {
    try {
        const { boundary, buildingData } = req.body;
        // Validate boundary format
        if (!(0, zoneOverlapChecker_1.validateZoneBoundary)(boundary)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid zone boundary format. Please ensure the polygon is properly closed.'
            });
        }
        // Check for overlapping zones
        const overlapResult = await (0, zoneOverlapChecker_1.checkZoneOverlap)(boundary);
        // Check for duplicate buildings if building data is provided
        let duplicateAddresses = [];
        if (buildingData && buildingData.addresses && buildingData.addresses.length > 0) {
            duplicateAddresses = await (0, zoneOverlapChecker_1.checkDuplicateBuildings)(buildingData.addresses);
        }
        res.status(200).json({
            success: true,
            data: {
                hasOverlap: overlapResult.hasOverlap,
                overlappingZones: overlapResult.overlappingZones,
                overlapPercentage: overlapResult.overlapPercentage,
                duplicateBuildings: duplicateAddresses,
                duplicateCount: duplicateAddresses.length,
                isValid: !overlapResult.hasOverlap && duplicateAddresses.length === 0
            }
        });
    }
    catch (error) {
        console.error('Error checking zone overlap:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check zone overlap',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.checkZoneOverlapBeforeCreate = checkZoneOverlapBeforeCreate;
// Get zone by ID
const getZoneById = async (req, res) => {
    try {
        const { id } = req.params;
        console.log('getZoneById called with id:', id);
        console.log('User:', req.user?.id, 'Role:', req.user?.role, 'PrimaryTeamId:', req.user?.primaryTeamId);
        const zone = await Zone_1.Zone.findById(id)
            .populate('teamId', 'name')
            .populate('assignedAgentId', 'name email')
            .populate('createdBy', 'name email');
        if (!zone) {
            return res.status(404).json({
                success: false,
                message: 'Zone not found'
            });
        }
        // Check if user has access to this zone
        // Allow access if user is SUPERADMIN, or if zone was created by the user, or if zone is assigned to user's team
        // Also allow access if user is SUBADMIN and zone is in DRAFT status (unassigned)
        if (req.user?.role !== 'SUPERADMIN' &&
            zone.createdBy?.toString() !== req.user?.id &&
            zone.teamId?.toString() !== req.user?.primaryTeamId &&
            !(req.user?.role === 'SUBADMIN' && zone.status === 'DRAFT')) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to this zone'
            });
        }
        // Get active assignments (same logic as listZones)
        const activeAssignments = await AgentZoneAssignment_1.AgentZoneAssignment.find({
            zoneId: id,
            status: { $nin: ['COMPLETED', 'CANCELLED'] },
            effectiveTo: null
        }).populate('agentId', 'name email').populate('teamId', 'name');
        // Get scheduled assignments
        const scheduledAssignment = await ScheduledAssignment_1.ScheduledAssignment.findOne({
            zoneId: id,
            status: 'PENDING'
        }).populate('agentId', 'name email').populate('teamId', 'name');
        // Determine current assignment - prioritize team assignments over individual
        let currentAssignment = null;
        if (activeAssignments.length > 0) {
            // If there are multiple assignments (team assignment), find the one with teamId
            const teamAssignment = activeAssignments.find(assignment => assignment.teamId);
            if (teamAssignment) {
                // For team assignments, return a representative assignment with teamId but no specific agentId
                currentAssignment = {
                    _id: teamAssignment._id,
                    agentId: null, // Don't show specific agent for team assignments
                    teamId: teamAssignment.teamId,
                    effectiveFrom: teamAssignment.effectiveFrom,
                    effectiveTo: teamAssignment.effectiveTo,
                    status: teamAssignment.status
                };
            }
            else {
                // Individual assignment
                currentAssignment = activeAssignments[0];
            }
        }
        else if (scheduledAssignment) {
            currentAssignment = scheduledAssignment;
        }
        // Calculate zone status based on assignments and completion (same logic as listZones)
        let calculatedStatus = 'DRAFT'; // Default to DRAFT
        // Check if zone is completed (all houses visited)
        if (zone.buildingData?.houseStatuses) {
            const houseStatuses = Array.from(zone.buildingData.houseStatuses.values());
            const totalHouses = houseStatuses.length;
            const visitedHouses = houseStatuses.filter(house => house.status !== 'not-visited').length;
            // If all houses have been visited (not 'not-visited'), mark as COMPLETED
            if (totalHouses > 0 && visitedHouses === totalHouses) {
                calculatedStatus = 'COMPLETED';
            }
            else if (currentAssignment) {
                // Check if it's a scheduled assignment (future date)
                const assignmentDate = new Date(currentAssignment.effectiveFrom);
                const now = new Date();
                if (assignmentDate > now) {
                    calculatedStatus = 'SCHEDULED';
                }
                else {
                    calculatedStatus = 'ACTIVE';
                }
            }
        }
        else if (currentAssignment) {
            // Check if it's a scheduled assignment (future date)
            const assignmentDate = new Date(currentAssignment.effectiveFrom);
            const now = new Date();
            if (assignmentDate > now) {
                calculatedStatus = 'SCHEDULED';
            }
            else {
                calculatedStatus = 'ACTIVE';
            }
        }
        // Get zone statistics (same as listZones)
        const totalResidents = await Resident_1.Resident.countDocuments({ zoneId: id });
        const activeResidents = await Resident_1.Resident.countDocuments({
            zoneId: id,
            status: { $in: ['interested', 'visited', 'callback', 'appointment', 'follow-up'] }
        });
        // Add current assignment and calculated status to zone data
        const zoneData = zone.toObject();
        zoneData.status = calculatedStatus; // Use calculated status instead of stored status
        zoneData.currentAssignment = currentAssignment ? {
            _id: currentAssignment._id,
            agentId: currentAssignment.agentId,
            teamId: currentAssignment.teamId,
            effectiveFrom: currentAssignment.effectiveFrom,
            effectiveTo: 'effectiveTo' in currentAssignment ? currentAssignment.effectiveTo || null : null,
            status: currentAssignment.status
        } : null;
        zoneData.totalResidents = totalResidents;
        zoneData.activeResidents = activeResidents;
        res.json({
            success: true,
            data: zoneData
        });
    }
    catch (error) {
        console.error('Error getting zone:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get zone',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.getZoneById = getZoneById;
// Update zone
const updateZone = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, boundary, buildingData, status, assignedAgentId, teamId, effectiveFrom, removeAssignment } = req.body;
        const zone = await Zone_1.Zone.findById(id);
        if (!zone) {
            return res.status(404).json({
                success: false,
                message: 'Zone not found'
            });
        }
        // Check permissions
        if (req.user?.role !== 'SUPERADMIN' && zone.teamId?.toString() !== req.user?.primaryTeamId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to update this zone'
            });
        }
        // Check if name already exists (if name is being updated)
        if (name && name !== zone.name) {
            const existingZone = await Zone_1.Zone.findOne({ name, _id: { $ne: id } });
            if (existingZone) {
                return res.status(409).json({
                    success: false,
                    message: 'Zone with this name already exists'
                });
            }
        }
        // Start a transaction for assignment updates
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        try {
            // Update zone basic properties
            const updateData = { name, description, boundary, status };
            // Process building data if provided (same logic as createZone)
            if (buildingData && buildingData.addresses && buildingData.coordinates) {
                const processedBuildingData = (0, addressParser_1.processBuildingData)(buildingData.addresses, buildingData.coordinates);
                // Check for duplicate buildings across all zones (excluding current zone)
                const duplicateAddresses = await (0, zoneOverlapChecker_1.checkDuplicateBuildings)(processedBuildingData.addresses);
                const filteredDuplicates = duplicateAddresses.filter(addr => {
                    // Check if this address belongs to the current zone
                    return !zone.buildingData?.addresses?.includes(addr);
                });
                if (filteredDuplicates.length > 0) {
                    return res.status(409).json({
                        success: false,
                        message: `${filteredDuplicates.length} buildings are already assigned to other territories`,
                        data: {
                            duplicateAddresses: filteredDuplicates,
                            duplicateCount: filteredDuplicates.length
                        }
                    });
                }
                updateData.buildingData = processedBuildingData;
                // Delete existing residents for this zone and create new ones
                await Resident_1.Resident.deleteMany({ zoneId: id }, { session });
                // Create new residents if building data is provided
                if (processedBuildingData && processedBuildingData.addresses.length > 0) {
                    const residents = processedBuildingData.addresses.map((address, index) => {
                        const coordinates = processedBuildingData.coordinates[index];
                        const houseNumber = (0, addressParser_1.extractHouseNumber)(address);
                        return new Resident_1.Resident({
                            zoneId: id,
                            address,
                            coordinates,
                            houseNumber,
                            status: 'not-visited',
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        });
                    });
                    await Resident_1.Resident.insertMany(residents, { session });
                }
            }
            // 1. Deactivate existing assignments for this zone
            await AgentZoneAssignment_1.AgentZoneAssignment.updateMany({ zoneId: id, status: 'ACTIVE' }, { status: 'INACTIVE', effectiveTo: new Date() }, { session });
            // Cancel any pending scheduled assignments for this zone
            await ScheduledAssignment_1.ScheduledAssignment.updateMany({ zoneId: id, status: 'PENDING' }, { status: 'CANCELLED' }, { session });
            // Handle assignment updates
            if (removeAssignment) {
                // 2. Remove all assignments - set to DRAFT status
                updateData.assignedAgentId = null;
                updateData.teamId = null;
                updateData.status = 'DRAFT';
                // 3. Remove zone from all users who were assigned to this zone
                await User_1.User.updateMany({ $or: [{ primaryZoneId: id }, { zoneIds: id }] }, {
                    $unset: { primaryZoneId: 1 },
                    $pull: { zoneIds: id }
                }, { session });
            }
            else if (assignedAgentId) {
                // 2. Validate agent exists
                const agent = await User_1.User.findById(assignedAgentId);
                if (!agent || agent.role !== 'AGENT') {
                    throw new Error('Agent not found or is not an agent');
                }
                // 3. Check if this is a future assignment or immediate assignment
                const effectiveDate = effectiveFrom ? new Date(effectiveFrom) : new Date();
                const now = new Date();
                const isFutureAssignment = effectiveDate > now;
                if (isFutureAssignment) {
                    // Create scheduled assignment for future date
                    const scheduledAssignmentData = {
                        agentId: assignedAgentId,
                        zoneId: id,
                        assignedBy: req.user?.id,
                        scheduledDate: effectiveDate, // Add the required scheduledDate field
                        effectiveFrom: effectiveDate,
                        status: 'PENDING'
                    };
                    await ScheduledAssignment_1.ScheduledAssignment.create(scheduledAssignmentData);
                    // Update zone status to SCHEDULED
                    updateData.assignedAgentId = assignedAgentId;
                    updateData.teamId = null;
                    updateData.status = 'SCHEDULED';
                }
                else {
                    // Create immediate assignment
                    const assignmentData = {
                        agentId: assignedAgentId,
                        zoneId: id,
                        assignedBy: req.user?.id,
                        effectiveFrom: effectiveDate,
                        status: 'ACTIVE'
                    };
                    await AgentZoneAssignment_1.AgentZoneAssignment.create(assignmentData);
                    // Update zone status to ACTIVE if it was in DRAFT
                    if (zone.status === 'DRAFT') {
                        updateData.assignedAgentId = assignedAgentId;
                        updateData.teamId = null;
                        updateData.status = 'ACTIVE';
                    }
                }
                // 5. Update user fields (same as createAssignment)
                await User_1.User.findByIdAndUpdate(assignedAgentId, {
                    primaryZoneId: id,
                    $addToSet: { zoneIds: id }
                }, { session });
            }
            else if (teamId) {
                // 2. Validate team exists
                const team = await Team_1.Team.findById(teamId);
                if (!team) {
                    throw new Error('Team not found');
                }
                // 3. Check if this is a future assignment or immediate assignment
                const effectiveDate = effectiveFrom ? new Date(effectiveFrom) : new Date();
                const now = new Date();
                const isFutureAssignment = effectiveDate > now;
                if (isFutureAssignment) {
                    // Create scheduled assignment for future date
                    const scheduledAssignmentData = {
                        teamId: teamId,
                        zoneId: id,
                        assignedBy: req.user?.id,
                        scheduledDate: effectiveDate,
                        effectiveFrom: effectiveDate,
                        status: 'PENDING'
                    };
                    await ScheduledAssignment_1.ScheduledAssignment.create(scheduledAssignmentData);
                    // Update zone status to SCHEDULED
                    updateData.teamId = teamId;
                    updateData.assignedAgentId = null;
                    updateData.status = 'SCHEDULED';
                }
                else {
                    // Create immediate team assignments for all team members
                    if (team.agentIds && team.agentIds.length > 0) {
                        const teamAssignments = team.agentIds.map((agentId) => ({
                            agentId,
                            teamId,
                            zoneId: id,
                            effectiveFrom: effectiveDate,
                            status: 'ACTIVE',
                            assignedBy: req.user?.id
                        }));
                        await AgentZoneAssignment_1.AgentZoneAssignment.insertMany(teamAssignments, { session });
                        // Update user fields for all team members
                        await User_1.User.updateMany({ _id: { $in: team.agentIds } }, {
                            primaryZoneId: id,
                            $addToSet: { zoneIds: id }
                        }, { session });
                    }
                    // Update zone fields
                    updateData.teamId = teamId;
                    updateData.assignedAgentId = null;
                    updateData.status = 'ACTIVE';
                }
            }
            // 7. Update zone
            const updatedZone = await Zone_1.Zone.findByIdAndUpdate(id, updateData, { new: true, runValidators: true, session }).populate('teamId', 'name').populate('assignedAgentId', 'name email');
            // 8. Sync all related data and recalculate statuses (same logic as createAssignment)
            if (assignedAgentId) {
                // Update individual agent status and zone fields (same as createAssignment)
                await updateAgentStatus(assignedAgentId, session);
                // Update agent's primaryZoneId (same as createAssignment)
                const agent = await User_1.User.findById(assignedAgentId);
                if (agent) {
                    const updateData = {};
                    // Always set latest assignment as primary for individual agents (same as createAssignment)
                    updateData.primaryZoneId = id;
                    // Update agent with new primary zone (same as createAssignment)
                    await User_1.User.findByIdAndUpdate(assignedAgentId, updateData, { session });
                    // Sync zoneIds with all current assignments (same as createAssignment)
                    await syncAgentZoneIds(assignedAgentId, session);
                }
                // Update assignment status for the assigned agent
                await updateUserAssignmentStatus(assignedAgentId, session);
            }
            else if (teamId) {
                // Update team status if this is a team assignment (same as createAssignment)
                await updateTeamStatus(teamId, session);
                await updateTeamAssignmentStatus(teamId, session);
                // Update individual agent statuses and zone fields for all team members (same as createAssignment)
                const team = await Team_1.Team.findById(teamId);
                if (team && team.agentIds) {
                    for (const agentId of team.agentIds) {
                        await updateAgentStatus(agentId.toString(), session);
                        // Update agent's zone fields (same as createAssignment)
                        const agent = await User_1.User.findById(agentId);
                        if (agent) {
                            const updateData = {};
                            // Always set latest team assignment as primary for team members (same as createAssignment)
                            updateData.primaryZoneId = id;
                            // Update agent with new primary zone (same as createAssignment)
                            await User_1.User.findByIdAndUpdate(agentId, updateData, { session });
                            // Sync zoneIds with all current assignments (same as createAssignment)
                            await syncAgentZoneIds(agentId.toString(), session);
                        }
                        // Sync agent zoneIds and update assignment status for each team member
                        await syncAgentZoneIds(agentId.toString(), session);
                        await updateUserAssignmentStatus(agentId.toString(), session);
                    }
                }
            }
            else if (removeAssignment) {
                // Update statuses for all users who were previously assigned to this zone
                const previouslyAssignedUsers = await User_1.User.find({
                    $or: [{ primaryZoneId: id }, { zoneIds: id }]
                });
                for (const user of previouslyAssignedUsers) {
                    await syncAgentZoneIds(user._id.toString(), session);
                    await updateAgentStatus(user._id.toString(), session);
                    await updateUserAssignmentStatus(user._id.toString(), session);
                }
            }
            await session.commitTransaction();
            // Get the updated zone with proper population and calculated data (same as getZoneById)
            const finalZone = await Zone_1.Zone.findById(id)
                .populate('teamId', 'name')
                .populate('assignedAgentId', 'name email')
                .populate('createdBy', 'name email');
            if (!finalZone) {
                throw new Error('Zone not found after update');
            }
            // Get active assignments (same logic as getZoneById)
            const activeAssignments = await AgentZoneAssignment_1.AgentZoneAssignment.find({
                zoneId: id,
                status: { $nin: ['COMPLETED', 'CANCELLED'] },
                effectiveTo: null
            }).populate('agentId', 'name email').populate('teamId', 'name');
            // Get scheduled assignments
            const scheduledAssignment = await ScheduledAssignment_1.ScheduledAssignment.findOne({
                zoneId: id,
                status: 'PENDING'
            }).populate('agentId', 'name email').populate('teamId', 'name');
            // Determine current assignment - prioritize team assignments over individual
            let currentAssignment = null;
            if (activeAssignments.length > 0) {
                // If there are multiple assignments (team assignment), find the one with teamId
                const teamAssignment = activeAssignments.find(assignment => assignment.teamId);
                if (teamAssignment) {
                    // For team assignments, return a representative assignment with teamId but no specific agentId
                    currentAssignment = {
                        _id: teamAssignment._id,
                        agentId: null, // Don't show specific agent for team assignments
                        teamId: teamAssignment.teamId,
                        effectiveFrom: teamAssignment.effectiveFrom,
                        effectiveTo: teamAssignment.effectiveTo,
                        status: teamAssignment.status
                    };
                }
                else {
                    // Individual assignment
                    currentAssignment = activeAssignments[0];
                }
            }
            else if (scheduledAssignment) {
                currentAssignment = scheduledAssignment;
            }
            // Calculate zone status based on assignments and completion (same logic as getZoneById)
            let calculatedStatus = 'DRAFT'; // Default to DRAFT
            // Check if zone is completed (all houses visited)
            if (finalZone.buildingData?.houseStatuses) {
                const houseStatuses = Array.from(finalZone.buildingData.houseStatuses.values());
                const totalHouses = houseStatuses.length;
                const visitedHouses = houseStatuses.filter(house => house.status !== 'not-visited').length;
                // If all houses have been visited (not 'not-visited'), mark as COMPLETED
                if (totalHouses > 0 && visitedHouses === totalHouses) {
                    calculatedStatus = 'COMPLETED';
                }
                else if (currentAssignment) {
                    // Check if it's a scheduled assignment (future date)
                    const assignmentDate = new Date(currentAssignment.effectiveFrom);
                    const now = new Date();
                    if (assignmentDate > now) {
                        calculatedStatus = 'SCHEDULED';
                    }
                    else {
                        calculatedStatus = 'ACTIVE';
                    }
                }
            }
            else if (currentAssignment) {
                // Check if it's a scheduled assignment (future date)
                const assignmentDate = new Date(currentAssignment.effectiveFrom);
                const now = new Date();
                if (assignmentDate > now) {
                    calculatedStatus = 'SCHEDULED';
                }
                else {
                    calculatedStatus = 'ACTIVE';
                }
            }
            // Add current assignment and calculated status to zone data (same as getZoneById)
            const zoneData = finalZone.toObject();
            zoneData.status = calculatedStatus; // Use calculated status instead of stored status
            zoneData.currentAssignment = currentAssignment ? {
                _id: currentAssignment._id,
                agentId: currentAssignment.agentId,
                teamId: currentAssignment.teamId,
                effectiveFrom: currentAssignment.effectiveFrom,
                effectiveTo: 'effectiveTo' in currentAssignment ? currentAssignment.effectiveTo || null : null,
                status: currentAssignment.status
            } : null;
            res.json({
                success: true,
                message: 'Zone updated successfully',
                data: zoneData
            });
        }
        catch (error) {
            await session.abortTransaction();
            throw error;
        }
        finally {
            session.endSession();
        }
    }
    catch (error) {
        console.error('Error updating zone:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update zone',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.updateZone = updateZone;
// Delete zone
const deleteZone = async (req, res) => {
    try {
        const { id } = req.params;
        const zone = await Zone_1.Zone.findById(id);
        if (!zone) {
            return res.status(404).json({
                success: false,
                message: 'Zone not found'
            });
        }
        // Check permissions
        // Allow deletion if user is SUPERADMIN, or if zone was created by the user, or if zone is assigned to user's team
        // Also allow deletion if user is SUBADMIN and zone is in DRAFT status (unassigned)
        if (req.user?.role !== 'SUPERADMIN' &&
            zone.createdBy?.toString() !== req.user?.id &&
            zone.teamId?.toString() !== req.user?.primaryTeamId &&
            !(req.user?.role === 'SUBADMIN' && zone.status === 'DRAFT')) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to delete this zone'
            });
        }
        // Get active assignments for this zone (we'll deactivate them during deletion)
        const activeAssignments = await AgentZoneAssignment_1.AgentZoneAssignment.find({
            zoneId: id,
            status: 'ACTIVE'
        });
        // Get all assignments for this zone (active and inactive) to track affected users/teams
        const allZoneAssignments = await AgentZoneAssignment_1.AgentZoneAssignment.find({
            zoneId: id
        }).populate('agentId teamId');
        // Collect unique agent IDs and team IDs that will be affected
        const affectedAgentIds = new Set();
        const affectedTeamIds = new Set();
        allZoneAssignments.forEach(assignment => {
            if (assignment.agentId) {
                affectedAgentIds.add(assignment.agentId.toString());
            }
            if (assignment.teamId) {
                affectedTeamIds.add(assignment.teamId.toString());
            }
        });
        // Start a database transaction to ensure all deletions are atomic
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        try {
            // Delete all associated data in the correct order to avoid foreign key constraint issues
            // 1. Delete all agent zone assignments for this zone (not just deactivate)
            const deletedZoneAssignments = await AgentZoneAssignment_1.AgentZoneAssignment.deleteMany({ zoneId: id }, { session });
            console.log(`Deleted ${deletedZoneAssignments.deletedCount} agent zone assignments`);
            // 2. Agent team assignments are not zone-specific, so we don't delete them here
            // AgentTeamAssignment tracks team membership, not zone assignments
            // 3. Delete all scheduled assignments
            const deletedScheduled = await ScheduledAssignment_1.ScheduledAssignment.deleteMany({ zoneId: id }, { session });
            console.log(`Deleted ${deletedScheduled.deletedCount} scheduled assignments`);
            // 4. Delete all properties in this zone
            const deletedProperties = await Property_1.Property.deleteMany({ zoneId: id }, { session });
            console.log(`Deleted ${deletedProperties.deletedCount} properties`);
            // 5. Delete all leads in this zone
            const deletedLeads = await Lead_1.Lead.deleteMany({ zoneId: id }, { session });
            console.log(`Deleted ${deletedLeads.deletedCount} leads`);
            // 6. Delete all activities in this zone
            const deletedActivities = await Activity_1.Activity.deleteMany({ zoneId: id }, { session });
            console.log(`Deleted ${deletedActivities.deletedCount} activities`);
            // 7. Delete all routes in this zone
            const deletedRoutes = await Route_1.Route.deleteMany({ zoneId: id }, { session });
            console.log(`Deleted ${deletedRoutes.deletedCount} routes`);
            // 8. Delete all residents in this zone (CRITICAL - must be deleted)
            const deletedResidents = await Resident_1.Resident.deleteMany({ zoneId: id }, { session });
            console.log(`Deleted ${deletedResidents.deletedCount} residents for zone ${id}`);
            // 8. Update users to remove zone references
            // Remove primaryZoneId if it matches this zone
            await User_1.User.updateMany({ primaryZoneId: id }, { $unset: { primaryZoneId: 1 } }, { session });
            // Remove from zoneIds array in users
            await User_1.User.updateMany({ zoneIds: id }, { $pull: { zoneIds: id } }, { session });
            // 9. Finally, delete the zone itself
            await Zone_1.Zone.findByIdAndDelete(id, { session });
            // Commit the transaction
            await session.commitTransaction();
            // After successful deletion, update assignment status for affected users and teams
            // This is done outside the transaction to avoid long-running transactions
            // Update assignment status for affected agents
            for (const agentId of affectedAgentIds) {
                await updateUserAssignmentStatus(agentId);
            }
            // Update assignment status for affected teams
            for (const teamId of affectedTeamIds) {
                await updateTeamAssignmentStatus(teamId);
                await updateTeamStatus(teamId);
            }
            // Prepare response message based on whether there were active assignments
            let message = 'Zone and all associated residential data deleted successfully';
            if (activeAssignments.length > 0) {
                message = `Zone and all residential data deleted successfully. ${activeAssignments.length} active assignment(s) were automatically deleted.`;
            }
            res.json({
                success: true,
                message
            });
        }
        catch (error) {
            // If any operation fails, rollback the transaction
            await session.abortTransaction();
            throw error;
        }
        finally {
            // End the session
            session.endSession();
        }
    }
    catch (error) {
        console.error('Error deleting zone:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete zone',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.deleteZone = deleteZone;
// Assign agent to zone
const assignAgentToZone = async (req, res) => {
    try {
        const { agentId, zoneId, effectiveDate } = req.body;
        // Validate agent exists and is an AGENT
        const agent = await User_1.User.findById(agentId);
        if (!agent || agent.role !== 'AGENT') {
            return res.status(404).json({
                success: false,
                message: 'Agent not found'
            });
        }
        // Validate zone exists
        const zone = await Zone_1.Zone.findById(zoneId);
        if (!zone) {
            return res.status(404).json({
                success: false,
                message: 'Zone not found'
            });
        }
        // Check permissions
        if (req.user?.role !== 'SUPERADMIN' && zone.teamId?.toString() !== req.user?.primaryTeamId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to assign to this zone'
            });
        }
        // Deactivate any existing active assignments for this agent
        await AgentZoneAssignment_1.AgentZoneAssignment.updateMany({ agentId, status: 'ACTIVE' }, { status: 'INACTIVE', endDate: new Date() });
        // Create new assignment
        const assignment = new AgentZoneAssignment_1.AgentZoneAssignment({
            agentId,
            zoneId,
            assignedBy: req.user?.id,
            effectiveDate: effectiveDate || new Date(),
            status: 'ACTIVE'
        });
        await assignment.save();
        // Update agent's zoneId
        await User_1.User.findByIdAndUpdate(agentId, { zoneId });
        // Update zone status from DRAFT to ACTIVE if it was in draft
        if (zone.status === 'DRAFT') {
            await Zone_1.Zone.findByIdAndUpdate(zoneId, {
                status: 'ACTIVE',
                assignedAgentId: agentId
            });
        }
        res.status(201).json({
            success: true,
            message: 'Agent assigned to zone successfully',
            data: assignment
        });
    }
    catch (error) {
        console.error('Error assigning agent to zone:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to assign agent to zone',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.assignAgentToZone = assignAgentToZone;
// Get zone assignments
const getZoneAssignments = async (req, res) => {
    try {
        const { zoneId, status } = req.query;
        const filter = {};
        if (zoneId)
            filter.zoneId = zoneId;
        if (status)
            filter.status = status;
        const assignments = await AgentZoneAssignment_1.AgentZoneAssignment.find(filter)
            .populate('agentId', 'name email')
            .populate('zoneId', 'name')
            .populate('assignedBy', 'name')
            .sort({ effectiveDate: -1 });
        res.json({
            success: true,
            data: assignments
        });
    }
    catch (error) {
        console.error('Error getting zone assignments:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get zone assignments',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.getZoneAssignments = getZoneAssignments;
// Remove agent from zone
const removeAgentFromZone = async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const assignment = await AgentZoneAssignment_1.AgentZoneAssignment.findById(assignmentId)
            .populate('zoneId', 'teamId');
        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found'
            });
        }
        // Check permissions
        if (req.user?.role !== 'SUPERADMIN' &&
            assignment.zoneId?.teamId?.toString() !== req.user?.primaryTeamId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to remove this assignment'
            });
        }
        // Update assignment status
        await AgentZoneAssignment_1.AgentZoneAssignment.findByIdAndUpdate(assignmentId, {
            status: 'INACTIVE',
            endDate: new Date()
        });
        // Remove zoneId from agent
        await User_1.User.findByIdAndUpdate(assignment.agentId, { $unset: { zoneId: 1 } });
        res.json({
            success: true,
            message: 'Agent removed from zone successfully'
        });
    }
    catch (error) {
        console.error('Error removing agent from zone:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove agent from zone',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.removeAgentFromZone = removeAgentFromZone;
// Get zones by geographic proximity
const getZonesByProximity = async (req, res) => {
    try {
        const { latitude, longitude, maxDistance = 10000 } = req.query; // maxDistance in meters
        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                message: 'Latitude and longitude are required'
            });
        }
        const zones = await Zone_1.Zone.find({
            boundary: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [Number(longitude), Number(latitude)]
                    },
                    $maxDistance: Number(maxDistance)
                }
            }
        }).populate('teamId', 'name');
        res.json({
            success: true,
            data: zones
        });
    }
    catch (error) {
        console.error('Error getting zones by proximity:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get zones by proximity',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.getZonesByProximity = getZonesByProximity;
// Get zone statistics
const getZoneStatistics = async (req, res) => {
    try {
        const { zoneId } = req.params;
        const zone = await Zone_1.Zone.findById(zoneId);
        if (!zone) {
            return res.status(404).json({
                success: false,
                message: 'Zone not found'
            });
        }
        // Get active assignments
        const activeAssignments = await AgentZoneAssignment_1.AgentZoneAssignment.countDocuments({
            zoneId,
            status: 'ACTIVE'
        });
        // Get total agents in this zone
        const totalAgents = await User_1.User.countDocuments({
            zoneId,
            role: 'AGENT',
            status: 'ACTIVE'
        });
        // Get zone area (if boundary is a polygon)
        let area = 0;
        if (zone.boundary && zone.boundary.type === 'Polygon') {
            // Calculate area in square meters (simplified calculation)
            area = 1000000; // Placeholder
        }
        res.json({
            success: true,
            data: {
                zoneId: zone._id,
                zoneName: zone.name,
                activeAssignments,
                totalAgents,
                area,
                status: zone.status,
                createdAt: zone.createdAt
            }
        });
    }
    catch (error) {
        console.error('Error getting zone statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get zone statistics',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.getZoneStatistics = getZoneStatistics;
// Get detailed zone statistics including house numbers
const getZoneDetailedStats = async (req, res) => {
    try {
        const { id } = req.params;
        const zone = await Zone_1.Zone.findById(id)
            .populate('teamId', 'name')
            .populate('assignedAgentId', 'name email')
            .populate('createdBy', 'name email');
        if (!zone) {
            return res.status(404).json({
                success: false,
                message: 'Zone not found'
            });
        }
        // Get active assignments
        const activeAssignments = await AgentZoneAssignment_1.AgentZoneAssignment.find({
            zoneId: id,
            status: 'ACTIVE'
        }).populate('agentId', 'name email');
        // Get house number statistics
        let houseNumberStats = null;
        if (zone.buildingData && zone.buildingData.houseNumbers) {
            houseNumberStats = (0, addressParser_1.getHouseNumberStats)(zone.buildingData.houseNumbers);
        }
        // Calculate area (simplified)
        let area = 0;
        if (zone.boundary && zone.boundary.type === 'Polygon') {
            // Calculate area in square meters (simplified calculation)
            area = 1000000; // Placeholder
        }
        res.json({
            success: true,
            data: {
                zoneId: zone._id,
                zoneName: zone.name,
                description: zone.description,
                boundary: zone.boundary,
                buildingData: zone.buildingData,
                houseNumberStats,
                activeAssignments,
                totalAgents: activeAssignments.length,
                area,
                status: zone.status,
                teamId: zone.teamId,
                assignedAgentId: zone.assignedAgentId,
                createdBy: zone.createdBy,
                createdAt: zone.createdAt,
                updatedAt: zone.updatedAt
            }
        });
    }
    catch (error) {
        console.error('Error getting zone detailed statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get zone detailed statistics',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.getZoneDetailedStats = getZoneDetailedStats;
// Get residents for a specific zone
const getZoneResidents = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, page = 1, limit = 50 } = req.query;
        // Verify zone exists and user has access
        const zone = await Zone_1.Zone.findById(id);
        if (!zone) {
            return res.status(404).json({
                success: false,
                message: 'Zone not found'
            });
        }
        // Check if user has access to this zone
        if (req.user?.role !== 'SUPERADMIN' && zone.teamId?.toString() !== req.user?.primaryTeamId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to this zone'
            });
        }
        // Build filter for residents
        const filter = { zoneId: id };
        if (status) {
            filter.status = status;
        }
        const skip = (Number(page) - 1) * Number(limit);
        const residents = await Resident_1.Resident.find(filter)
            .populate('assignedAgentId', 'name email')
            .skip(skip)
            .limit(Number(limit))
            .sort({ createdAt: -1 });
        const total = await Resident_1.Resident.countDocuments(filter);
        // Get status counts
        const statusCounts = await Resident_1.Resident.aggregate([
            { $match: { zoneId: zone._id } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        const statusSummary = statusCounts.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {});
        res.json({
            success: true,
            data: {
                residents,
                statusSummary,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total,
                    pages: Math.ceil(total / Number(limit))
                }
            }
        });
    }
    catch (error) {
        console.error('Error getting zone residents:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get zone residents',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.getZoneResidents = getZoneResidents;
// Update resident status
const updateResidentStatus = async (req, res) => {
    try {
        const { residentId } = req.params;
        const { status, notes, phone, email } = req.body;
        const resident = await Resident_1.Resident.findById(residentId);
        if (!resident) {
            return res.status(404).json({
                success: false,
                message: 'Resident not found'
            });
        }
        // Verify user has access to the zone
        const zone = await Zone_1.Zone.findById(resident.zoneId);
        if (!zone) {
            return res.status(404).json({
                success: false,
                message: 'Zone not found'
            });
        }
        if (req.user?.role !== 'SUPERADMIN' && zone.teamId?.toString() !== req.user?.primaryTeamId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to update this resident'
            });
        }
        // Update resident
        const updateData = {};
        if (status)
            updateData.status = status;
        if (notes !== undefined)
            updateData.notes = notes;
        if (phone !== undefined)
            updateData.phone = phone;
        if (email !== undefined)
            updateData.email = email;
        // Update lastVisited if status is being changed to visited
        if (status === 'visited') {
            updateData.lastVisited = new Date();
        }
        updateData.updatedAt = new Date();
        const updatedResident = await Resident_1.Resident.findByIdAndUpdate(residentId, updateData, { new: true }).populate('assignedAgentId', 'name email');
        res.json({
            success: true,
            message: 'Resident status updated successfully',
            data: updatedResident
        });
    }
    catch (error) {
        console.error('Error updating resident status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update resident status',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.updateResidentStatus = updateResidentStatus;
// Assign team to zone
const assignTeamToZone = async (req, res) => {
    try {
        const { teamId, zoneId, effectiveDate } = req.body;
        // Validate team exists
        const team = await Team_1.Team.findById(teamId);
        if (!team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found'
            });
        }
        // Validate zone exists
        const zone = await Zone_1.Zone.findById(zoneId);
        if (!zone) {
            return res.status(404).json({
                success: false,
                message: 'Zone not found'
            });
        }
        // Check permissions
        if (req.user?.role !== 'SUPERADMIN' && team.createdBy?.toString() !== req.user?.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to assign to this zone'
            });
        }
        // Update zone with team assignment
        const updatedZone = await Zone_1.Zone.findByIdAndUpdate(zoneId, {
            teamId,
            status: zone.status === 'DRAFT' ? 'ACTIVE' : zone.status,
            assignedAgentId: null // Remove individual agent assignment when team is assigned
        }, { new: true }).populate('teamId', 'name');
        // Create zone assignment records for all agents in the team
        // Note: AgentTeamAssignment records should already exist for team members
        // Here we only create AgentZoneAssignment records (agent-to-zone relationships)
        if (team.agentIds && team.agentIds.length > 0) {
            const zoneAssignments = team.agentIds.map((agentId) => ({
                agentId,
                teamId,
                zoneId: zoneId,
                effectiveFrom: effectiveDate || new Date(),
                status: 'ACTIVE',
                assignedBy: req.user?.id
            }));
            await AgentZoneAssignment_1.AgentZoneAssignment.insertMany(zoneAssignments);
            // Update user fields for all team members
            await User_1.User.updateMany({ _id: { $in: team.agentIds } }, {
                primaryZoneId: zoneId,
                $addToSet: { zoneIds: zoneId }
            });
        }
        res.status(200).json({
            success: true,
            message: 'Team assigned to zone successfully',
            data: {
                zone: updatedZone,
                team: {
                    id: team._id,
                    name: team.name,
                    agentCount: team.agentIds?.length || 0
                }
            }
        });
    }
    catch (error) {
        console.error('Error assigning team to zone:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to assign team to zone',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.assignTeamToZone = assignTeamToZone;
// Remove team from zone
const removeTeamFromZone = async (req, res) => {
    try {
        const { zoneId } = req.params;
        const zone = await Zone_1.Zone.findById(zoneId).populate('teamId', 'name');
        if (!zone) {
            return res.status(404).json({
                success: false,
                message: 'Zone not found'
            });
        }
        // Check permissions
        if (req.user?.role !== 'SUPERADMIN' &&
            zone.teamId?.createdBy?.toString() !== req.user?.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to remove team from this zone'
            });
        }
        // Update zone to remove team assignment
        const updatedZone = await Zone_1.Zone.findByIdAndUpdate(zoneId, {
            teamId: null,
            status: 'DRAFT' // Reset to draft when team is removed
        }, { new: true });
        // Deactivate team assignments for this zone's team
        if (zone.teamId) {
            await AgentTeamAssignment_1.AgentTeamAssignment.updateMany({ teamId: zone.teamId, status: 'ACTIVE' }, { status: 'INACTIVE', effectiveTo: new Date() });
        }
        res.json({
            success: true,
            message: 'Team removed from zone successfully',
            data: updatedZone
        });
    }
    catch (error) {
        console.error('Error removing team from zone:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove team from zone',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.removeTeamFromZone = removeTeamFromZone;
// Get overall territory statistics for dashboard
const getTerritoryOverviewStats = async (req, res) => {
    try {
        // Import ScheduledAssignment model
        const { ScheduledAssignment } = require('../models/ScheduledAssignment');
        // Build filter based on user role
        const filter = {};
        if (req.user?.role !== 'SUPERADMIN') {
            filter.teamId = req.user?.primaryTeamId;
        }
        // Get total territories
        const totalTerritories = await Zone_1.Zone.countDocuments(filter);
        // Get all zones for this admin
        const zones = await Zone_1.Zone.find(filter).select('_id');
        // Get active assignments (including scheduled)
        const activeAssignments = await AgentZoneAssignment_1.AgentZoneAssignment.find({
            zoneId: { $in: zones.map(z => z._id) },
            status: { $nin: ['COMPLETED', 'CANCELLED'] },
            effectiveTo: null
        });
        const scheduledAssignments = await ScheduledAssignment.find({
            zoneId: { $in: zones.map(z => z._id) },
            status: 'PENDING'
        });
        // Calculate territories by status
        let activeTerritories = 0;
        let scheduledTerritories = 0;
        let draftTerritories = 0;
        let assignedTerritories = 0;
        // Process active assignments
        for (const assignment of activeAssignments) {
            const assignmentDate = new Date(assignment.effectiveFrom);
            const now = new Date();
            if (assignmentDate > now) {
                scheduledTerritories++;
            }
            else {
                activeTerritories++;
            }
            if (assignment.agentId || assignment.teamId) {
                assignedTerritories++;
            }
        }
        // Process scheduled assignments
        for (const assignment of scheduledAssignments) {
            scheduledTerritories++;
            if (assignment.agentId || assignment.teamId) {
                assignedTerritories++;
            }
        }
        // Calculate draft territories (total - active - scheduled)
        draftTerritories = totalTerritories - activeTerritories - scheduledTerritories;
        // Calculate unassigned territories
        const unassignedTerritories = totalTerritories - assignedTerritories;
        // Get total residents (this would come from a separate residents collection)
        // For now, we'll use a placeholder calculation
        const totalResidents = totalTerritories * 25; // Average 25 residents per territory
        const activeResidents = Math.floor(totalResidents * 0.85); // 85% active rate
        // Calculate average completion rate (this would come from activity data)
        const averageCompletionRate = 82; // Placeholder
        // Calculate total area (simplified)
        const totalArea = totalTerritories * 250000; // Average 250k sq meters per territory
        // Get recent activity count (last 24 hours)
        const recentActivity = Math.floor(Math.random() * 20) + 5; // Placeholder
        // Get top performing territory
        const topPerformingTerritory = await Zone_1.Zone.findOne(filter)
            .sort({ 'performance.completionRate': -1 })
            .select('name performance.completionRate')
            .limit(1);
        const stats = {
            totalTerritories,
            activeTerritories,
            scheduledTerritories,
            draftTerritories,
            assignedTerritories,
            unassignedTerritories,
            totalResidents,
            activeResidents,
            averageCompletionRate,
            totalArea,
            recentActivity,
            topPerformingTerritory: topPerformingTerritory ? {
                name: topPerformingTerritory.name,
                completionRate: topPerformingTerritory.performance?.completionRate || 85
            } : undefined
        };
        res.json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        console.error('Error getting territory overview stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get territory overview statistics',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.getTerritoryOverviewStats = getTerritoryOverviewStats;
// Get building statistics by odd/even numbers for a specific zone
const getZoneBuildingStats = async (req, res) => {
    try {
        const { zoneId } = req.params;
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
        }
        // Validate zone ID
        if (!mongoose_1.default.Types.ObjectId.isValid(zoneId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid zone ID'
            });
        }
        // Get the zone with building data
        const zone = await Zone_1.Zone.findById(zoneId).select('name buildingData');
        if (!zone) {
            return res.status(404).json({
                success: false,
                message: 'Zone not found'
            });
        }
        // Check if user has access to this zone
        const user = await User_1.User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        // Check permissions (user can access if they created it or are assigned to it)
        const canAccess = zone.createdBy?.toString() === userId.toString() ||
            zone.assignedAgentId?.toString() === userId.toString() ||
            (user.teamIds && user.teamIds.includes(zone.teamId));
        if (!canAccess && user.role !== 'SUPERADMIN') {
            return res.status(403).json({
                success: false,
                message: 'Access denied to this zone'
            });
        }
        // Extract building statistics
        const buildingStats = {
            zoneName: zone.name,
            totalBuildings: zone.buildingData?.totalBuildings || 0,
            residentialHomes: zone.buildingData?.residentialHomes || 0,
            oddBuildings: {
                count: zone.buildingData?.houseNumbers?.odd?.length || 0,
                numbers: zone.buildingData?.houseNumbers?.odd || [],
                range: zone.buildingData?.houseNumbers?.odd?.length > 0 ? {
                    min: Math.min(...(zone.buildingData.houseNumbers.odd || [])),
                    max: Math.max(...(zone.buildingData.houseNumbers.odd || []))
                } : null
            },
            evenBuildings: {
                count: zone.buildingData?.houseNumbers?.even?.length || 0,
                numbers: zone.buildingData?.houseNumbers?.even || [],
                range: zone.buildingData?.houseNumbers?.even?.length > 0 ? {
                    min: Math.min(...(zone.buildingData.houseNumbers.even || [])),
                    max: Math.max(...(zone.buildingData.houseNumbers.even || []))
                } : null
            },
            addresses: zone.buildingData?.addresses || [],
            coordinates: zone.buildingData?.coordinates || []
        };
        res.json({
            success: true,
            data: buildingStats
        });
    }
    catch (error) {
        console.error('Error getting zone building stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get zone building statistics',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.getZoneBuildingStats = getZoneBuildingStats;
// Get all zones with building statistics summary
const getAllZonesBuildingStats = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
        }
        // Get user to check permissions
        const user = await User_1.User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        // Build filter based on user role
        let filter = {};
        if (user.role === 'AGENT') {
            // Agents can only see zones assigned to them
            filter = {
                $or: [
                    { assignedAgentId: userId },
                    { teamId: { $in: user.teamIds } }
                ]
            };
        }
        else if (user.role === 'SUBADMIN') {
            // Subadmins can see zones they created
            filter = { createdBy: userId };
        }
        // SUPERADMIN can see all zones (no filter)
        // Get zones with building data
        const zones = await Zone_1.Zone.find(filter).select('name buildingData status');
        const zonesStats = zones.map(zone => ({
            zoneId: zone._id,
            zoneName: zone.name,
            status: zone.status,
            totalBuildings: zone.buildingData?.totalBuildings || 0,
            oddCount: zone.buildingData?.houseNumbers?.odd?.length || 0,
            evenCount: zone.buildingData?.houseNumbers?.even?.length || 0,
            oddRange: zone.buildingData?.houseNumbers?.odd?.length > 0 ? {
                min: Math.min(...(zone.buildingData.houseNumbers.odd || [])),
                max: Math.max(...(zone.buildingData.houseNumbers.odd || []))
            } : null,
            evenRange: zone.buildingData?.houseNumbers?.even?.length > 0 ? {
                min: Math.min(...(zone.buildingData.houseNumbers.even || [])),
                max: Math.max(...(zone.buildingData.houseNumbers.even || []))
            } : null
        }));
        // Calculate summary statistics
        const summary = {
            totalZones: zonesStats.length,
            totalBuildings: zonesStats.reduce((sum, zone) => sum + zone.totalBuildings, 0),
            totalOddBuildings: zonesStats.reduce((sum, zone) => sum + zone.oddCount, 0),
            totalEvenBuildings: zonesStats.reduce((sum, zone) => sum + zone.evenCount, 0),
            averageBuildingsPerZone: zonesStats.length > 0 ?
                Math.round(zonesStats.reduce((sum, zone) => sum + zone.totalBuildings, 0) / zonesStats.length) : 0
        };
        res.json({
            success: true,
            data: {
                summary,
                zones: zonesStats
            }
        });
    }
    catch (error) {
        console.error('Error getting all zones building stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get zones building statistics',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.getAllZonesBuildingStats = getAllZonesBuildingStats;
//# sourceMappingURL=zone.controller.js.map