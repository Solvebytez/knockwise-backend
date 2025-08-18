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
async function createAssignment(req, res) {
    try {
        const payload = { ...req.body, assignedBy: req.user.sub };
        // Validate that either agentId or teamId is provided
        if (!payload.agentId && !payload.teamId) {
            res.status(400).json({
                success: false,
                message: 'Either agentId or teamId must be provided'
            });
            return;
        }
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
            // Send scheduled assignment notifications
            await scheduledAssignmentService_1.ScheduledAssignmentService.sendScheduledAssignmentNotifications(scheduledAssignment);
            // Send socket notifications
            await scheduledAssignmentService_1.ScheduledAssignmentService.sendScheduledAssignmentSocketNotifications(scheduledAssignment);
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
            const record = await AgentZoneAssignment_1.default.create(payload);
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