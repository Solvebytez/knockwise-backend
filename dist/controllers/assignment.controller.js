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
async function createAssignment(req, res) {
    const payload = { ...req.body, createdById: req.user.sub };
    const record = await AgentZoneAssignment_1.default.create(payload);
    res.status(201).json(record);
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