"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getZoneStatistics = exports.getZonesByProximity = exports.removeAgentFromZone = exports.getZoneAssignments = exports.assignAgentToZone = exports.deleteZone = exports.updateZone = exports.getZoneById = exports.listZones = exports.createZone = void 0;
const Zone_1 = require("../models/Zone");
const User_1 = require("../models/User");
const AgentZoneAssignment_1 = require("../models/AgentZoneAssignment");
// Create a new zone
const createZone = async (req, res) => {
    try {
        const { name, description, boundary, teamId } = req.body;
        // Check if zone name already exists
        const existingZone = await Zone_1.Zone.findOne({ name });
        if (existingZone) {
            return res.status(409).json({
                success: false,
                message: 'Zone with this name already exists'
            });
        }
        const zone = new Zone_1.Zone({
            name,
            description,
            boundary,
            teamId,
            createdBy: req.user?.id
        });
        await zone.save();
        res.status(201).json({
            success: true,
            message: 'Zone created successfully',
            data: zone
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
        const { page = 1, limit = 10, teamId, status } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const filter = {};
        if (teamId)
            filter.teamId = teamId;
        if (status)
            filter.status = status;
        // If user is not superadmin, only show zones for their team
        if (req.user?.role !== 'SUPERADMIN') {
            filter.teamId = req.user?.teamId;
        }
        const zones = await Zone_1.Zone.find(filter)
            .populate('teamId', 'name')
            .populate('createdBy', 'name email')
            .skip(skip)
            .limit(Number(limit))
            .sort({ createdAt: -1 });
        const total = await Zone_1.Zone.countDocuments(filter);
        res.json({
            success: true,
            data: zones,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            }
        });
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
// Get zone by ID
const getZoneById = async (req, res) => {
    try {
        const { id } = req.params;
        const zone = await Zone_1.Zone.findById(id)
            .populate('teamId', 'name')
            .populate('createdBy', 'name email');
        if (!zone) {
            return res.status(404).json({
                success: false,
                message: 'Zone not found'
            });
        }
        // Check if user has access to this zone
        if (req.user?.role !== 'SUPERADMIN' && zone.teamId?.toString() !== req.user?.teamId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to this zone'
            });
        }
        res.json({
            success: true,
            data: zone
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
        const { name, description, boundary, status } = req.body;
        const zone = await Zone_1.Zone.findById(id);
        if (!zone) {
            return res.status(404).json({
                success: false,
                message: 'Zone not found'
            });
        }
        // Check permissions
        if (req.user?.role !== 'SUPERADMIN' && zone.teamId?.toString() !== req.user?.teamId) {
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
        const updatedZone = await Zone_1.Zone.findByIdAndUpdate(id, { name, description, boundary, status }, { new: true, runValidators: true }).populate('teamId', 'name');
        res.json({
            success: true,
            message: 'Zone updated successfully',
            data: updatedZone
        });
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
        if (req.user?.role !== 'SUPERADMIN' && zone.teamId?.toString() !== req.user?.teamId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to delete this zone'
            });
        }
        // Check if zone has active assignments
        const activeAssignments = await AgentZoneAssignment_1.AgentZoneAssignment.find({
            zoneId: id,
            status: 'ACTIVE'
        });
        if (activeAssignments.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete zone with active agent assignments'
            });
        }
        await Zone_1.Zone.findByIdAndDelete(id);
        res.json({
            success: true,
            message: 'Zone deleted successfully'
        });
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
        if (req.user?.role !== 'SUPERADMIN' && zone.teamId?.toString() !== req.user?.teamId) {
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
            assignment.zoneId?.teamId?.toString() !== req.user?.teamId) {
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
            // In a real implementation, you'd use a proper geospatial library
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
//# sourceMappingURL=zone.controller.js.map