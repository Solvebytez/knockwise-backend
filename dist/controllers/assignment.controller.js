"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAssignment = createAssignment;
exports.getAssignmentById = getAssignmentById;
exports.updateAssignment = updateAssignment;
exports.deleteAssignment = deleteAssignment;
exports.listAssignments = listAssignments;
exports.getMyAssignments = getMyAssignments;
exports.getTeamAssignments = getTeamAssignments;
const AgentZoneAssignment_1 = __importDefault(require("../models/AgentZoneAssignment"));
const scheduledAssignmentService_1 = require("../services/scheduledAssignmentService");
const Zone_1 = require("../models/Zone");
const User_1 = require("../models/User");
const Team_1 = require("../models/Team");
const user_controller_1 = require("../controllers/user.controller");
// Helper function to sync agent's zoneIds with all current assignments
const syncAgentZoneIds = async (agentId) => {
    try {
        // Get all active assignments for this agent (individual and team-based)
        const individualAssignments = await AgentZoneAssignment_1.default.find({
            agentId: agentId,
            status: { $nin: ['COMPLETED', 'CANCELLED'] },
            effectiveTo: null
        }).populate('zoneId', '_id');
        const agent = await User_1.User.findById(agentId);
        if (!agent)
            return;
        // Get team-based assignments for this agent's teams
        const teamAssignments = await AgentZoneAssignment_1.default.find({
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
        await User_1.User.findByIdAndUpdate(agentId, {
            zoneIds: uniqueZoneIds
        });
        console.log(`Synced zoneIds for agent ${agent.name}: ${uniqueZoneIds.length} zones`);
    }
    catch (error) {
        console.error('Error syncing agent zoneIds:', error);
    }
};
// Helper function to update team status based on zone assignments
const updateTeamStatus = async (teamId) => {
    try {
        const team = await Team_1.Team.findById(teamId);
        if (!team)
            return;
        // Check if team has any zone assignments (exclude COMPLETED and CANCELLED)
        const teamZoneAssignments = await AgentZoneAssignment_1.default.find({
            teamId: teamId,
            status: { $nin: ['COMPLETED', 'CANCELLED'] },
            effectiveTo: null
        });
        // Team is ACTIVE if it has any zone assignments
        const hasZoneAssignment = teamZoneAssignments.length > 0;
        const newStatus = hasZoneAssignment ? 'ACTIVE' : 'INACTIVE';
        if (newStatus !== team.status) {
            await Team_1.Team.findByIdAndUpdate(teamId, { status: newStatus });
            console.log(`Team ${team.name} (${teamId}) status updated to ${newStatus}`);
        }
    }
    catch (error) {
        console.error('Error updating team status:', error);
    }
};
async function createAssignment(req, res) {
    try {
        const payload = { ...req.body, assignedBy: req.user.sub };
        console.log("payload", payload);
        // Validate that either agentId or teamId is provided
        if (!payload.agentId && !payload.teamId) {
            res.status(400).json({
                success: false,
                message: 'Either agentId or teamId must be provided'
            });
            return;
        }
        // Validate zone exists
        const zone = await Zone_1.Zone.findById(payload.zoneId);
        if (!zone) {
            res.status(404).json({
                success: false,
                message: 'Zone not found'
            });
            return;
        }
        // Validate agent or team exists
        if (payload.agentId) {
            const agent = await User_1.User.findById(payload.agentId);
            if (!agent || agent.role !== 'AGENT') {
                res.status(404).json({
                    success: false,
                    message: 'Agent not found or is not an agent'
                });
                return;
            }
        }
        if (payload.teamId) {
            const team = await Team_1.Team.findById(payload.teamId);
            if (!team) {
                res.status(404).json({
                    success: false,
                    message: 'Team not found'
                });
                return;
            }
        }
        // Deactivate any existing active assignments for this zone
        await AgentZoneAssignment_1.default.updateMany({
            zoneId: payload.zoneId,
            status: 'ACTIVE',
            $or: [
                { effectiveTo: { $exists: false } },
                { effectiveTo: null },
                { effectiveTo: { $gt: new Date() } }
            ]
        }, {
            status: 'INACTIVE',
            effectiveTo: new Date()
        });
        const effectiveFrom = new Date(payload.effectiveFrom);
        const now = new Date();
        // Check if this is a future assignment
        if (effectiveFrom > now) {
            // Create a scheduled assignment
            const scheduledAssignment = await scheduledAssignmentService_1.ScheduledAssignmentService.createScheduledAssignment({
                agentId: payload.agentId,
                teamId: payload.teamId,
                zoneId: payload.zoneId,
                scheduledDate: effectiveFrom,
                effectiveFrom: effectiveFrom,
                assignedBy: req.user.sub
            });
            // Update agent/team status for scheduled assignments
            if (payload.agentId) {
                await (0, user_controller_1.updateAgentStatus)(payload.agentId);
            }
            if (payload.teamId) {
                await updateTeamStatus(payload.teamId);
            }
            // Send scheduled assignment notifications
            // await ScheduledAssignmentService.sendScheduledAssignmentNotifications(scheduledAssignment);
            // Send socket notifications
            // await ScheduledAssignmentService.sendScheduledAssignmentSocketNotifications(scheduledAssignment);
            res.status(201).json({
                success: true,
                message: 'Assignment scheduled successfully',
                data: {
                    ...scheduledAssignment.toObject(),
                    scheduled: true,
                    scheduledDate: effectiveFrom
                }
            });
        }
        else {
            // Create immediate assignment
            const assignmentData = {
                ...payload,
                effectiveFrom: now,
                status: 'ACTIVE'
            };
            const record = await AgentZoneAssignment_1.default.create(assignmentData);
            // Update zone status to ACTIVE if it was in DRAFT
            if (zone.status === 'DRAFT') {
                await Zone_1.Zone.findByIdAndUpdate(payload.zoneId, {
                    status: 'ACTIVE',
                    ...(payload.agentId ? { assignedAgentId: payload.agentId } : {}),
                    ...(payload.teamId ? { teamId: payload.teamId } : {})
                });
            }
            // Update team status if this is a team assignment
            if (payload.teamId) {
                await updateTeamStatus(payload.teamId);
                // Update individual agent statuses and zone fields for all team members
                const team = await Team_1.Team.findById(payload.teamId);
                if (team && team.agentIds) {
                    for (const agentId of team.agentIds) {
                        await (0, user_controller_1.updateAgentStatus)(agentId.toString());
                        // Update agent's zone fields
                        const agent = await User_1.User.findById(agentId);
                        if (agent) {
                            const updateData = {};
                            // Always set latest team assignment as primary for team members
                            updateData.primaryZoneId = payload.zoneId;
                            // Update agent with new primary zone
                            await User_1.User.findByIdAndUpdate(agentId, updateData);
                            // Sync zoneIds with all current assignments
                            await syncAgentZoneIds(agentId.toString());
                        }
                    }
                }
            }
            // Update individual agent status and zone fields if this is an individual assignment
            if (payload.agentId) {
                await (0, user_controller_1.updateAgentStatus)(payload.agentId);
                // Update agent's primaryZoneId
                const agent = await User_1.User.findById(payload.agentId);
                if (agent) {
                    const updateData = {};
                    // Always set latest assignment as primary for individual agents
                    updateData.primaryZoneId = payload.zoneId;
                    // Update agent with new primary zone
                    await User_1.User.findByIdAndUpdate(payload.agentId, updateData);
                    // Sync zoneIds with all current assignments
                    await syncAgentZoneIds(payload.agentId);
                }
            }
            res.status(201).json({
                success: true,
                message: 'Assignment created successfully',
                data: {
                    ...record.toObject(),
                    scheduled: false
                }
            });
        }
    }
    catch (error) {
        console.error('Error creating assignment:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating assignment',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
async function getAssignmentById(req, res) {
    try {
        const { id } = req.params;
        const assignment = await AgentZoneAssignment_1.default.findById(id);
        if (!assignment) {
            res.status(404).json({ message: 'Assignment not found' });
            return;
        }
        res.json(assignment);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching assignment', error: error instanceof Error ? error.message : 'Unknown error' });
    }
}
async function updateAssignment(req, res) {
    try {
        const { id } = req.params;
        const assignment = await AgentZoneAssignment_1.default.findByIdAndUpdate(id, req.body, { new: true });
        if (!assignment) {
            res.status(404).json({ message: 'Assignment not found' });
            return;
        }
        res.json(assignment);
    }
    catch (error) {
        res.status(500).json({ message: 'Error updating assignment', error: error instanceof Error ? error.message : 'Unknown error' });
    }
}
async function deleteAssignment(req, res) {
    try {
        const { id } = req.params;
        const assignment = await AgentZoneAssignment_1.default.findByIdAndDelete(id);
        if (!assignment) {
            res.status(404).json({ message: 'Assignment not found' });
            return;
        }
        res.json({ message: 'Assignment deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ message: 'Error deleting assignment', error: error instanceof Error ? error.message : 'Unknown error' });
    }
}
async function listAssignments(_req, res) {
    const list = await AgentZoneAssignment_1.default.find().sort({ createdAt: -1 }).limit(200);
    res.json(list);
}
async function getMyAssignments(req, res) {
    try {
        const agentId = req.user.sub;
        const assignments = await AgentZoneAssignment_1.default.find({ agentId }).sort({ createdAt: -1 });
        res.json(assignments);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching my assignments', error: error instanceof Error ? error.message : 'Unknown error' });
    }
}
async function getTeamAssignments(req, res) {
    try {
        const { teamId } = req.query;
        const assignments = await AgentZoneAssignment_1.default.find({ teamId }).sort({ createdAt: -1 });
        res.json(assignments);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching team assignments', error: error instanceof Error ? error.message : 'Unknown error' });
    }
}
//# sourceMappingURL=assignment.controller.js.map