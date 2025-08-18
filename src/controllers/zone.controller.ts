import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Zone, IZone } from '../models/Zone';
import { User } from '../models/User';
import { AgentZoneAssignment } from '../models/AgentZoneAssignment';
import { AgentTeamAssignment } from '../models/AgentTeamAssignment';
import { Team } from '../models/Team';
import { Resident, IResident } from '../models/Resident';
import { Property } from '../models/Property';
import { Lead } from '../models/Lead';
import { Activity } from '../models/Activity';
import { Route } from '../models/Route';
import { ScheduledAssignment } from '../models/ScheduledAssignment';
import { AuthRequest } from '../middleware/auth';
import { processBuildingData, getHouseNumberStats, extractHouseNumber } from '../utils/addressParser';
import { checkZoneOverlap, checkDuplicateBuildings, validateZoneBoundary } from '../utils/zoneOverlapChecker';

// Create a new zone
export const createZone = async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, boundary, teamId, buildingData } = req.body;

    // Validate boundary format
    if (!validateZoneBoundary(boundary)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid zone boundary format. Please ensure the polygon is properly closed.'
      });
    }

    // Check if zone name already exists
    const existingZone = await Zone.findOne({ name });
    if (existingZone) {
      return res.status(409).json({
        success: false,
        message: 'Zone with this name already exists'
      });
    }

    // Check for overlapping zones
    const overlapResult = await checkZoneOverlap(boundary);
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
      processedBuildingData = processBuildingData(
        buildingData.addresses,
        buildingData.coordinates
      );

      // Check for duplicate buildings across all zones
      const duplicateAddresses = await checkDuplicateBuildings(processedBuildingData.addresses);
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
      zoneStatus = 'ACTIVE';
    }

    const zone = new Zone({
      name,
      description,
      boundary,
      teamId,
      buildingData: processedBuildingData,
      status: zoneStatus,
      createdBy: req.user?.id
    });

    await zone.save();

    // Save individual residents if building data is provided
    if (processedBuildingData && processedBuildingData.addresses.length > 0) {
      const residents = processedBuildingData.addresses.map((address, index) => {
        const coordinates = processedBuildingData.coordinates[index];
        const houseNumber = extractHouseNumber(address);
        
        return new Resident({
          zoneId: zone._id,
          address,
          coordinates,
          houseNumber,
          status: 'not-visited',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });

      await Resident.insertMany(residents);
    }

    // Get house number statistics for response
    let houseNumberStats = null;
    if (processedBuildingData) {
      houseNumberStats = getHouseNumberStats(processedBuildingData.houseNumbers);
    }

    res.status(201).json({
      success: true,
      message: 'Zone created successfully',
      data: {
        ...zone.toObject(),
        houseNumberStats
      }
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
    const { page, limit, teamId, status } = req.query;
    
    // Check if this is a request for all zones (no pagination parameters)
    const isListAll = !page && !limit;
    
    const filter: any = {};
    if (teamId) filter.teamId = teamId;
    if (status) filter.status = status;

    // If user is not superadmin, only show zones for their team
    if (req.user?.role !== 'SUPERADMIN') {
      filter.teamId = req.user?.primaryTeamId;
    }

    let zones;
    if (isListAll) {
      // Return all zones without pagination
      zones = await Zone.find(filter)
        .populate('teamId', 'name')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });
    } else {
      // Use pagination
      const pageNum = Number(page) || 1;
      const limitNum = Number(limit) || 10;
      const skip = (pageNum - 1) * limitNum;
      
      zones = await Zone.find(filter)
        .populate('teamId', 'name')
        .populate('createdBy', 'name email')
        .skip(skip)
        .limit(limitNum)
        .sort({ createdAt: -1 });
    }

    // Import ScheduledAssignment model
    const { ScheduledAssignment } = require('../models/ScheduledAssignment');

    // Get current active and scheduled assignments for each zone
    const zonesWithAssignments = await Promise.all(
      zones.map(async (zone) => {
        // Get active assignments
        const activeAssignment = await AgentZoneAssignment.findOne({
          zoneId: zone._id,
          status: { $nin: ['COMPLETED', 'CANCELLED'] },
          effectiveTo: null
        }).populate('agentId', 'name email').populate('teamId', 'name');

        // Get scheduled assignments
        const scheduledAssignment = await ScheduledAssignment.findOne({
          zoneId: zone._id,
          status: 'PENDING'
        }).populate('agentId', 'name email').populate('teamId', 'name');

        // Use active assignment if available, otherwise use scheduled assignment
        const currentAssignment = activeAssignment || scheduledAssignment;

        // Get zone statistics
        const totalResidents = await Resident.countDocuments({ zoneId: zone._id });
        const activeResidents = await Resident.countDocuments({ 
          zoneId: zone._id, 
          status: { $in: ['interested', 'visited', 'callback', 'appointment', 'follow-up'] }
        });

        // Calculate completion rate
        const completionRate = totalResidents > 0 ? Math.round((activeResidents / totalResidents) * 100) : 0;

        // Get average knocks (activities)
        const activities = await Activity.find({ zoneId: zone._id });
        const averageKnocks = activities.length > 0 ? Math.round(activities.length / totalResidents) : 0;

        // Get last activity
        const lastActivity = await Activity.findOne({ zoneId: zone._id })
          .sort({ createdAt: -1 })
          .select('createdAt');

        const zoneData = zone.toObject();
        const lastActivityDate = lastActivity ? (lastActivity as any).createdAt : new Date();

        // Calculate zone status based on assignments
        let calculatedStatus = 'DRAFT'; // Default to DRAFT
        
        if (currentAssignment) {
          // Check if it's a scheduled assignment (future date)
          const assignmentDate = new Date(currentAssignment.effectiveFrom);
          const now = new Date();
          
          if (assignmentDate > now) {
            calculatedStatus = 'SCHEDULED';
          } else {
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
      })
    );

    const total = await Zone.countDocuments(filter);

    if (isListAll) {
      // Return all zones without pagination
      res.json({
        success: true,
        data: zonesWithAssignments
      });
    } else {
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
  } catch (error) {
    console.error('Error listing zones:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list zones',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Check zone overlap before creation
export const checkZoneOverlapBeforeCreate = async (req: AuthRequest, res: Response) => {
  try {
    const { boundary, buildingData } = req.body;

    // Validate boundary format
    if (!validateZoneBoundary(boundary)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid zone boundary format. Please ensure the polygon is properly closed.'
      });
    }

    // Check for overlapping zones
    const overlapResult = await checkZoneOverlap(boundary);
    
    // Check for duplicate buildings if building data is provided
    let duplicateAddresses: string[] = [];
    if (buildingData && buildingData.addresses && buildingData.addresses.length > 0) {
      duplicateAddresses = await checkDuplicateBuildings(buildingData.addresses);
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
  } catch (error) {
    console.error('Error checking zone overlap:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check zone overlap',
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
    if (req.user?.role !== 'SUPERADMIN' && zone.teamId?.toString() !== req.user?.primaryTeamId) {
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
    if (req.user?.role !== 'SUPERADMIN' && zone.teamId?.toString() !== req.user?.primaryTeamId) {
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
    if (req.user?.role !== 'SUPERADMIN' && zone.teamId?.toString() !== req.user?.primaryTeamId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to delete this zone'
      });
    }

    // Get active assignments for this zone (we'll deactivate them during deletion)
    const activeAssignments = await AgentZoneAssignment.find({
      zoneId: id,
      status: 'ACTIVE'
    });

    // Start a database transaction to ensure all deletions are atomic
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Delete all associated data in the correct order to avoid foreign key constraint issues
      
      // 1. Deactivate all agent zone assignments for this zone
      await AgentZoneAssignment.updateMany(
        { zoneId: id },
        { 
          status: 'INACTIVE',
          endDate: new Date()
        },
        { session }
      );
      
      // 2. Delete all scheduled assignments
      await ScheduledAssignment.deleteMany({ zoneId: id }, { session });
      
      // 3. Delete all properties in this zone
      await Property.deleteMany({ zoneId: id }, { session });
      
      // 4. Delete all leads in this zone
      await Lead.deleteMany({ zoneId: id }, { session });
      
      // 5. Delete all activities in this zone
      await Activity.deleteMany({ zoneId: id }, { session });
      
      // 6. Delete all routes in this zone
      await Route.deleteMany({ zoneId: id }, { session });
      
      // 7. Delete all residents in this zone
      await Resident.deleteMany({ zoneId: id }, { session });
      
      // 8. Update users to remove zone references
      // Remove primaryZoneId if it matches this zone
      await User.updateMany(
        { primaryZoneId: id },
        { $unset: { primaryZoneId: 1 } },
        { session }
      );
      
      // Remove from zoneIds array in users
      await User.updateMany(
        { zoneIds: id },
        { $pull: { zoneIds: id } },
        { session }
      );
      
      // 8. Finally, delete the zone itself
      await Zone.findByIdAndDelete(id, { session });

      // Commit the transaction
      await session.commitTransaction();
      
      // Prepare response message based on whether there were active assignments
      let message = 'Zone and all associated residential data deleted successfully';
      if (activeAssignments.length > 0) {
        message = `Zone and all residential data deleted successfully. ${activeAssignments.length} active assignment(s) were automatically deactivated.`;
      }
      
      res.json({
        success: true,
        message
      });
    } catch (error) {
      // If any operation fails, rollback the transaction
      await session.abortTransaction();
      throw error;
    } finally {
      // End the session
      session.endSession();
    }
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
    if (req.user?.role !== 'SUPERADMIN' && zone.teamId?.toString() !== req.user?.primaryTeamId) {
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

    // Update zone status from DRAFT to ACTIVE if it was in draft
    if (zone.status === 'DRAFT') {
      await Zone.findByIdAndUpdate(zoneId, { 
        status: 'ACTIVE',
        assignedAgentId: agentId 
      });
    }

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
        (assignment.zoneId as any)?.teamId?.toString() !== req.user?.primaryTeamId) {
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

// Get detailed zone statistics including house numbers
export const getZoneDetailedStats = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const zone = await Zone.findById(id)
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
    const activeAssignments = await AgentZoneAssignment.find({
      zoneId: id,
      status: 'ACTIVE'
    }).populate('agentId', 'name email');

    // Get house number statistics
    let houseNumberStats = null;
    if (zone.buildingData && zone.buildingData.houseNumbers) {
      houseNumberStats = getHouseNumberStats(zone.buildingData.houseNumbers);
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
        createdAt: (zone as any).createdAt,
        updatedAt: (zone as any).updatedAt
      }
    });
  } catch (error) {
    console.error('Error getting zone detailed statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get zone detailed statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get residents for a specific zone
export const getZoneResidents = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, page = 1, limit = 50 } = req.query;

    // Verify zone exists and user has access
    const zone = await Zone.findById(id);
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
    const filter: any = { zoneId: id };
    if (status) {
      filter.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const residents = await Resident.find(filter)
      .populate('assignedAgentId', 'name email')
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await Resident.countDocuments(filter);

    // Get status counts
    const statusCounts = await Resident.aggregate([
      { $match: { zoneId: zone._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const statusSummary = statusCounts.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>);

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
  } catch (error) {
    console.error('Error getting zone residents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get zone residents',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update resident status
export const updateResidentStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { residentId } = req.params;
    const { status, notes, phone, email } = req.body;

    const resident = await Resident.findById(residentId);
    if (!resident) {
      return res.status(404).json({
        success: false,
        message: 'Resident not found'
      });
    }

    // Verify user has access to the zone
    const zone = await Zone.findById(resident.zoneId);
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
    const updateData: any = {};
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    
    // Update lastVisited if status is being changed to visited
    if (status === 'visited') {
      updateData.lastVisited = new Date();
    }

    updateData.updatedAt = new Date();

    const updatedResident = await Resident.findByIdAndUpdate(
      residentId,
      updateData,
      { new: true }
    ).populate('assignedAgentId', 'name email');

    res.json({
      success: true,
      message: 'Resident status updated successfully',
      data: updatedResident
    });
  } catch (error) {
    console.error('Error updating resident status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update resident status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Assign team to zone
export const assignTeamToZone = async (req: AuthRequest, res: Response) => {
  try {
    const { teamId, zoneId, effectiveDate } = req.body;

    // Validate team exists
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
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
    if (req.user?.role !== 'SUPERADMIN' && team.createdBy?.toString() !== req.user?.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to assign to this zone'
      });
    }

    // Update zone with team assignment
    const updatedZone = await Zone.findByIdAndUpdate(
      zoneId,
      { 
        teamId,
        status: zone.status === 'DRAFT' ? 'ACTIVE' : zone.status,
        assignedAgentId: null // Remove individual agent assignment when team is assigned
      },
      { new: true }
    ).populate('teamId', 'name');

    // Create team assignment records for all agents in the team
    if (team.agentIds && team.agentIds.length > 0) {
      const teamAssignments = team.agentIds.map((agentId) => ({
        agentId,
        teamId,
        effectiveFrom: effectiveDate || new Date(),
        status: 'ACTIVE',
        assignedBy: req.user?.id
      }));

      await AgentTeamAssignment.insertMany(teamAssignments);
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
  } catch (error) {
    console.error('Error assigning team to zone:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign team to zone',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Remove team from zone
export const removeTeamFromZone = async (req: AuthRequest, res: Response) => {
  try {
    const { zoneId } = req.params;

    const zone = await Zone.findById(zoneId).populate('teamId', 'name');
    if (!zone) {
      return res.status(404).json({
        success: false,
        message: 'Zone not found'
      });
    }

    // Check permissions
    if (req.user?.role !== 'SUPERADMIN' && 
        (zone.teamId as any)?.createdBy?.toString() !== req.user?.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to remove team from this zone'
      });
    }

    // Update zone to remove team assignment
    const updatedZone = await Zone.findByIdAndUpdate(
      zoneId,
      { 
        teamId: null,
        status: 'DRAFT' // Reset to draft when team is removed
      },
      { new: true }
    );

    // Deactivate team assignments for this zone's team
    if (zone.teamId) {
      await AgentTeamAssignment.updateMany(
        { teamId: zone.teamId, status: 'ACTIVE' },
        { status: 'INACTIVE', effectiveTo: new Date() }
      );
    }

    res.json({
      success: true,
      message: 'Team removed from zone successfully',
      data: updatedZone
    });
  } catch (error) {
    console.error('Error removing team from zone:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove team from zone',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get overall territory statistics for dashboard
export const getTerritoryOverviewStats = async (req: AuthRequest, res: Response) => {
  try {
    // Import ScheduledAssignment model
    const { ScheduledAssignment } = require('../models/ScheduledAssignment');

    // Build filter based on user role
    const filter: any = {};
    if (req.user?.role !== 'SUPERADMIN') {
      filter.teamId = req.user?.primaryTeamId;
    }

    // Get total territories
    const totalTerritories = await Zone.countDocuments(filter);

    // Get all zones for this admin
    const zones = await Zone.find(filter).select('_id');

    // Get active assignments (including scheduled)
    const activeAssignments = await AgentZoneAssignment.find({
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
      } else {
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
    const topPerformingTerritory = await Zone.findOne(filter)
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
        completionRate: (topPerformingTerritory as any).performance?.completionRate || 85
      } : undefined
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting territory overview stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get territory overview statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
