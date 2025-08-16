import { Request, Response } from 'express';
import { Zone, IZone } from '../models/Zone';
import { User } from '../models/User';
import { AgentZoneAssignment } from '../models/AgentZoneAssignment';
import { AuthRequest } from '../middleware/auth';

// Create a new zone
export const createZone = async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, boundary, teamId } = req.body;

    // Check if zone name already exists
    const existingZone = await Zone.findOne({ name });
    if (existingZone) {
      return res.status(409).json({
        success: false,
        message: 'Zone with this name already exists'
      });
    }

    const zone = new Zone({
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
  } catch (error) {
    console.error('Error creating zone:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create zone',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get all zones with pagination and filtering
export const listZones = async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 10, teamId, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter: any = {};
    if (teamId) filter.teamId = teamId;
    if (status) filter.status = status;

    // If user is not superadmin, only show zones for their team
    if (req.user?.role !== 'SUPERADMIN') {
      filter.teamId = req.user?.teamId;
    }

    const zones = await Zone.find(filter)
      .populate('teamId', 'name')
      .populate('createdBy', 'name email')
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await Zone.countDocuments(filter);

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
  } catch (error) {
    console.error('Error listing zones:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list zones',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get zone by ID
export const getZoneById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const zone = await Zone.findById(id)
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
  } catch (error) {
    console.error('Error getting zone:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get zone',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update zone
export const updateZone = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, boundary, status } = req.body;

    const zone = await Zone.findById(id);
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
      const existingZone = await Zone.findOne({ name, _id: { $ne: id } });
      if (existingZone) {
        return res.status(409).json({
          success: false,
          message: 'Zone with this name already exists'
        });
      }
    }

    const updatedZone = await Zone.findByIdAndUpdate(
      id,
      { name, description, boundary, status },
      { new: true, runValidators: true }
    ).populate('teamId', 'name');

    res.json({
      success: true,
      message: 'Zone updated successfully',
      data: updatedZone
    });
  } catch (error) {
    console.error('Error updating zone:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update zone',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Delete zone
export const deleteZone = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const zone = await Zone.findById(id);
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
    const activeAssignments = await AgentZoneAssignment.find({
      zoneId: id,
      status: 'ACTIVE'
    });

    if (activeAssignments.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete zone with active agent assignments'
      });
    }

    await Zone.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Zone deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting zone:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete zone',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Assign agent to zone
export const assignAgentToZone = async (req: AuthRequest, res: Response) => {
  try {
    const { agentId, zoneId, effectiveDate } = req.body;

    // Validate agent exists and is an AGENT
    const agent = await User.findById(agentId);
    if (!agent || agent.role !== 'AGENT') {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    // Validate zone exists
    const zone = await Zone.findById(zoneId);
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
    await AgentZoneAssignment.updateMany(
      { agentId, status: 'ACTIVE' },
      { status: 'INACTIVE', endDate: new Date() }
    );

    // Create new assignment
    const assignment = new AgentZoneAssignment({
      agentId,
      zoneId,
      assignedBy: req.user?.id,
      effectiveDate: effectiveDate || new Date(),
      status: 'ACTIVE'
    });

    await assignment.save();

    // Update agent's zoneId
    await User.findByIdAndUpdate(agentId, { zoneId });

    res.status(201).json({
      success: true,
      message: 'Agent assigned to zone successfully',
      data: assignment
    });
  } catch (error) {
    console.error('Error assigning agent to zone:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign agent to zone',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get zone assignments
export const getZoneAssignments = async (req: AuthRequest, res: Response) => {
  try {
    const { zoneId, status } = req.query;

    const filter: any = {};
    if (zoneId) filter.zoneId = zoneId;
    if (status) filter.status = status;

    const assignments = await AgentZoneAssignment.find(filter)
      .populate('agentId', 'name email')
      .populate('zoneId', 'name')
      .populate('assignedBy', 'name')
      .sort({ effectiveDate: -1 });

    res.json({
      success: true,
      data: assignments
    });
  } catch (error) {
    console.error('Error getting zone assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get zone assignments',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Remove agent from zone
export const removeAgentFromZone = async (req: AuthRequest, res: Response) => {
  try {
    const { assignmentId } = req.params;

    const assignment = await AgentZoneAssignment.findById(assignmentId)
      .populate('zoneId', 'teamId');

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // Check permissions
    if (req.user?.role !== 'SUPERADMIN' && 
        (assignment.zoneId as any)?.teamId?.toString() !== req.user?.teamId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to remove this assignment'
      });
    }

    // Update assignment status
    await AgentZoneAssignment.findByIdAndUpdate(assignmentId, {
      status: 'INACTIVE',
      endDate: new Date()
    });

    // Remove zoneId from agent
    await User.findByIdAndUpdate(assignment.agentId, { $unset: { zoneId: 1 } });

    res.json({
      success: true,
      message: 'Agent removed from zone successfully'
    });
  } catch (error) {
    console.error('Error removing agent from zone:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove agent from zone',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get zones by geographic proximity
export const getZonesByProximity = async (req: AuthRequest, res: Response) => {
  try {
    const { latitude, longitude, maxDistance = 10000 } = req.query; // maxDistance in meters

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const zones = await Zone.find({
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
  } catch (error) {
    console.error('Error getting zones by proximity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get zones by proximity',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get zone statistics
export const getZoneStatistics = async (req: AuthRequest, res: Response) => {
  try {
    const { zoneId } = req.params;

    const zone = await Zone.findById(zoneId);
    if (!zone) {
      return res.status(404).json({
        success: false,
        message: 'Zone not found'
      });
    }

    // Get active assignments
    const activeAssignments = await AgentZoneAssignment.countDocuments({
      zoneId,
      status: 'ACTIVE'
    });

    // Get total agents in this zone
    const totalAgents = await User.countDocuments({
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
        status: (zone as any).status,
        createdAt: (zone as any).createdAt
      }
    });
  } catch (error) {
    console.error('Error getting zone statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get zone statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
