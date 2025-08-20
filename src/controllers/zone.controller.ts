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
import { ScheduledAssignmentService } from '../services/scheduledAssignmentService';
import { updateUserAssignmentStatus, updateTeamStatus, updateTeamAssignmentStatus, syncAgentZoneIds } from './assignment.controller';

// Helper function to update agent status based on zone assignments
const updateAgentStatus = async (agentId: string) => {
  try {
    console.log(`🔄 updateAgentStatus: Starting for agent ${agentId}`);
    const agent = await User.findById(agentId);
    if (!agent || agent.role !== 'AGENT') {
      console.log(`❌ updateAgentStatus: Agent ${agentId} not found or not an agent`);
      return;
    }

    console.log(`📋 updateAgentStatus: Current status for ${(agent as any).firstName} ${(agent as any).lastName}: ${agent.status}`);
    console.log(`📋 updateAgentStatus: Agent zoneIds: [${agent.zoneIds.join(', ')}]`);
    console.log(`📋 updateAgentStatus: Agent primaryZoneId: ${agent.primaryZoneId || 'None'}`);
    console.log(`📋 updateAgentStatus: Agent teamIds: [${agent.teamIds.join(', ')}]`);

    // Check individual zone assignments
    const hasIndividualZoneAssignment = agent.zoneIds && agent.zoneIds.length > 0;
    const hasIndividualPrimaryZone = agent.primaryZoneId !== null && agent.primaryZoneId !== undefined;

    // Check team zone assignments (exclude COMPLETED and CANCELLED)
    const teamZoneAssignments = await AgentZoneAssignment.find({
      teamId: { $in: agent.teamIds },
      status: { $nin: ['COMPLETED', 'CANCELLED'] },
      effectiveTo: null
    });

    const hasTeamZoneAssignment = teamZoneAssignments.length > 0;

    // Check individual zone assignments (exclude COMPLETED and CANCELLED)
    const individualZoneAssignments = await AgentZoneAssignment.find({
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

    console.log(`📋 updateAgentStatus: Has individual zone assignment: ${hasIndividualZoneAssignment}`);
    console.log(`📋 updateAgentStatus: Has individual primary zone: ${hasIndividualPrimaryZone}`);
    console.log(`📋 updateAgentStatus: Has active individual zone assignment: ${hasActiveIndividualZoneAssignment}`);
    console.log(`📋 updateAgentStatus: Has team zone assignment: ${hasTeamZoneAssignment}`);
    console.log(`📋 updateAgentStatus: Has pending individual scheduled assignment: ${hasPendingIndividualScheduledAssignment}`);
    console.log(`📋 updateAgentStatus: Has pending team scheduled assignment: ${hasPendingTeamScheduledAssignment}`);

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
    
    console.log(`📋 updateAgentStatus: Should be active: ${shouldBeActive}, Calculated status: ${calculatedStatus}`);
    console.log(`📋 updateAgentStatus: Current status: ${agent.status}, New status: ${calculatedStatus}`);
    
    // Only update if the agent should be ACTIVE (don't automatically deactivate)
    if (calculatedStatus === 'ACTIVE' && agent.status !== 'ACTIVE') {
      await User.findByIdAndUpdate(agentId, { status: calculatedStatus });
      console.log(`✅ updateAgentStatus: Agent ${(agent as any).firstName} ${(agent as any).lastName} (${agentId}) status updated to ${calculatedStatus}`);
    } else {
      console.log(`✅ updateAgentStatus: Agent ${(agent as any).firstName} ${(agent as any).lastName} (${agentId}) status unchanged: ${agent.status}`);
    }
  } catch (error) {
    console.error('❌ updateAgentStatus: Error updating agent status:', error);
  }
};







// Create a new zone
export const createZone = async (req: AuthRequest, res: Response) => {
  try {
    console.log('=== CREATE ZONE ENDPOINT CALLED ===');
    console.log('🚀 createZone: Starting zone creation...');
    const { name, description, boundary, teamId, buildingData, effectiveFrom } = req.body;
    console.log('📝 createZone: Request data:', { name, teamId, effectiveFrom });

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

    // Check if any user has already created a zone with this exact boundary
    const existingZoneWithSameBoundary = await Zone.findOne({ boundary: boundary });
    if (existingZoneWithSameBoundary) {
      return res.status(409).json({
        success: false,
        message: `A zone with this exact boundary already exists: ${existingZoneWithSameBoundary.name}`,
        data: {
          duplicateZone: {
            id: existingZoneWithSameBoundary._id,
            name: existingZoneWithSameBoundary.name,
            createdBy: existingZoneWithSameBoundary.createdBy
          }
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
      // Check if this is a future assignment
      const effectiveDate = effectiveFrom ? new Date(effectiveFrom) : new Date();
      const now = new Date();
      const isFutureAssignment = effectiveDate > now;
      
      zoneStatus = isFutureAssignment ? 'SCHEDULED' : 'ACTIVE';
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

    // Handle team assignment if teamId is provided
    if (teamId) {
      console.log('👥 createZone: Team assignment detected, teamId:', teamId);
      // Get the team
      const team = await Team.findById(teamId);
      if (team && team.agentIds && team.agentIds.length > 0) {
        console.log('👥 createZone: Team found with', team.agentIds.length, 'members');
        const effectiveDate = effectiveFrom ? new Date(effectiveFrom) : new Date();
        const now = new Date();
        const isFutureAssignment = effectiveDate > now;
        console.log('📅 createZone: Assignment type:', isFutureAssignment ? 'FUTURE' : 'IMMEDIATE');

        if (isFutureAssignment) {
          // Create scheduled assignment for future date
          const scheduledAssignment = await ScheduledAssignmentService.createScheduledAssignment({
            teamId: teamId,
            zoneId: (zone._id as any).toString(),
            scheduledDate: effectiveDate,
            effectiveFrom: effectiveDate,
            assignedBy: req.user?.id as string
          });

          // Update team assignment status and team status
          await updateTeamAssignmentStatus(teamId);
          await updateTeamStatus(teamId);
          
          // Update assignment status for all team members (they have pending scheduled assignment)
          for (const agentId of team.agentIds) {
            await updateUserAssignmentStatus(agentId.toString());
          }
        } else {
          // Create immediate team assignments for all team members
          const teamAssignments = team.agentIds.map((agentId) => ({
            agentId,
            teamId,
            zoneId: zone._id,
            effectiveFrom: effectiveDate,
            status: 'ACTIVE',
            assignedBy: req.user?.id as string
          }));

          await AgentZoneAssignment.insertMany(teamAssignments);

          // Update user fields for all team members
          await User.updateMany(
            { _id: { $in: team.agentIds } },
            {
              primaryZoneId: zone._id,
              $addToSet: { zoneIds: zone._id }
            }
          );

          // Update assignment status for all team members
          for (const agentId of team.agentIds) {
            await syncAgentZoneIds(agentId.toString());
            await updateUserAssignmentStatus(agentId.toString());
          }

          // Update team assignment status and team status
          await updateTeamAssignmentStatus(teamId);
          await updateTeamStatus(teamId);
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
        const scheduledAssignment = await ScheduledAssignmentService.createScheduledAssignment({
          agentId: assignedAgentId,
          zoneId: (zone._id as any).toString(),
          scheduledDate: effectiveDate,
          effectiveFrom: effectiveDate,
          assignedBy: req.user?.id as string
        });

        // Update agent assignment status
        await updateUserAssignmentStatus(assignedAgentId);
      } else {
        // Create immediate individual assignment
        const assignmentData = {
          agentId: assignedAgentId,
          zoneId: zone._id,
          effectiveFrom: effectiveDate,
          status: 'ACTIVE',
          assignedBy: req.user?.id as string
        };

        await AgentZoneAssignment.create(assignmentData);

        // Update user fields
        await User.findByIdAndUpdate(assignedAgentId, {
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
    const { page, limit, teamId, status, showAll } = req.query;
    
    // Check if this is a request for all zones (no pagination parameters)
    const isListAll = !page && !limit;

    const filter: any = {};
    if (teamId) filter.teamId = teamId;
    if (status) filter.status = status;

    // If user is not superadmin, only show zones for their team
    // UNLESS this is a request to show all territories (like in edit page)
    if (req.user?.role !== 'SUPERADMIN' && !showAll) {
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
        const activeAssignments = await AgentZoneAssignment.find({
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
          } else {
            // Individual assignment
            currentAssignment = activeAssignments[0];
          }
        } else if (scheduledAssignment) {
          currentAssignment = scheduledAssignment;
        }

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

        // Calculate zone status based on assignments and completion
        let calculatedStatus = 'DRAFT'; // Default to DRAFT
        
        // Check if zone is completed (all houses visited)
        if (zone.buildingData?.houseStatuses) {
          const houseStatuses = Array.from((zone.buildingData.houseStatuses as any).values());
          const totalHouses = houseStatuses.length;
          const visitedHouses = houseStatuses.filter((house: any) => house.status !== 'not-visited').length;
          
          // If all houses have been visited (not 'not-visited'), mark as COMPLETED
          if (totalHouses > 0 && visitedHouses === totalHouses) {
            calculatedStatus = 'COMPLETED';
          } else if (currentAssignment) {
            // Check if it's a scheduled assignment (future date)
            const assignmentDate = new Date(currentAssignment.effectiveFrom);
            const now = new Date();
            
            if (assignmentDate > now) {
              calculatedStatus = 'SCHEDULED';
            } else {
              calculatedStatus = 'ACTIVE';
            }
          }
        } else if (currentAssignment) {
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

// Check zone overlap before creation or update
export const checkZoneOverlapBeforeCreate = async (req: AuthRequest, res: Response) => {
  try {
    const { boundary, buildingData, excludeZoneId } = req.body;

    // Validate boundary format
    if (!validateZoneBoundary(boundary)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid zone boundary format. Please ensure the polygon is properly closed.'
      });
    }

    // Check for overlapping zones (exclude current zone if updating)
    const overlapResult = await checkZoneOverlap(boundary, excludeZoneId);
    
    // Check for duplicate buildings if building data is provided
    let duplicateAddresses: string[] = [];
    if (buildingData && buildingData.addresses && buildingData.addresses.length > 0) {
      duplicateAddresses = await checkDuplicateBuildings(buildingData.addresses, excludeZoneId);
    }

    // Additional validation: Check if any user has already created a zone with this exact boundary
    const existingZoneWithSameBoundary = await Zone.findOne({
      boundary: boundary,
      ...(excludeZoneId && { _id: { $ne: excludeZoneId } })
    });

    const hasDuplicateZone = !!existingZoneWithSameBoundary;

    res.status(200).json({
      success: true,
      data: {
        hasOverlap: overlapResult.hasOverlap,
        overlappingZones: overlapResult.overlappingZones,
        overlapPercentage: overlapResult.overlapPercentage,
        duplicateBuildings: duplicateAddresses,
        duplicateCount: duplicateAddresses.length,
        hasDuplicateZone: hasDuplicateZone,
        duplicateZone: hasDuplicateZone ? {
          id: existingZoneWithSameBoundary._id,
          name: existingZoneWithSameBoundary.name,
          createdBy: existingZoneWithSameBoundary.createdBy
        } : null,
        isValid: !overlapResult.hasOverlap && duplicateAddresses.length === 0 && !hasDuplicateZone
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
    console.log('getZoneById called with id:', id);
    console.log('User:', req.user?.id, 'Role:', req.user?.role, 'PrimaryTeamId:', req.user?.primaryTeamId);

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

    // Check if user has access to this zone
    // Only allow access if user is SUPERADMIN or if zone was created by the user
    console.log('🔐 Permission Check:');
    console.log(`   User ID: ${req.user?.id}`);
    console.log(`   User Role: ${req.user?.role}`);
    console.log(`   Zone Created By: ${zone.createdBy?.toString()}`);
    console.log(`   Zone Created By Type: ${typeof zone.createdBy?.toString()}`);
    console.log(`   User ID Type: ${typeof req.user?.id}`);
    console.log(`   Is SUPERADMIN: ${req.user?.role === 'SUPERADMIN'}`);
    console.log(`   Zone created by user: ${zone.createdBy?._id?.toString() === req.user?.id}`);
    console.log(`   Direct comparison: ${zone.createdBy?._id?.toString()} === ${req.user?.id}`);
    console.log(`   Zone createdBy._id: ${zone.createdBy?._id}`);
    console.log(`   Zone createdBy._id.toString(): ${zone.createdBy?._id?.toString()}`);
    console.log(`   Zone createdBy._id === User ID: ${zone.createdBy?._id?.toString() === req.user?.id}`);
    
    if (req.user?.role !== 'SUPERADMIN' && 
        zone.createdBy?._id?.toString() !== req.user?.id) {
      console.log('❌ Access denied to zone');
      return res.status(403).json({
        success: false,
        message: 'Access denied to this zone'
      });
    }
    
    console.log('✅ Access granted to zone');

    // Get active assignments (same logic as listZones)
    const activeAssignments = await AgentZoneAssignment.find({
      zoneId: id,
      status: { $nin: ['COMPLETED', 'CANCELLED'] },
      effectiveTo: null
    }).populate('agentId', 'name email').populate('teamId', 'name');

    // Get scheduled assignments
    const scheduledAssignment = await ScheduledAssignment.findOne({
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
      } else {
        // Individual assignment
        currentAssignment = activeAssignments[0];
      }
    } else if (scheduledAssignment) {
      currentAssignment = scheduledAssignment;
    }

    // Calculate zone status based on assignments and completion (same logic as listZones)
    let calculatedStatus = 'DRAFT'; // Default to DRAFT
    
    // Check if zone is completed (all houses visited)
    if (zone.buildingData?.houseStatuses) {
      const houseStatuses = Array.from((zone.buildingData.houseStatuses as any).values());
      const totalHouses = houseStatuses.length;
      const visitedHouses = houseStatuses.filter((house: any) => house.status !== 'not-visited').length;
      
      // If all houses have been visited (not 'not-visited'), mark as COMPLETED
      if (totalHouses > 0 && visitedHouses === totalHouses) {
        calculatedStatus = 'COMPLETED';
      } else if (currentAssignment) {
        // Check if it's a scheduled assignment (future date)
        const assignmentDate = new Date(currentAssignment.effectiveFrom);
        const now = new Date();
        
        if (assignmentDate > now) {
          calculatedStatus = 'SCHEDULED';
        } else {
          calculatedStatus = 'ACTIVE';
        }
      }
    } else if (currentAssignment) {
      // Check if it's a scheduled assignment (future date)
      const assignmentDate = new Date(currentAssignment.effectiveFrom);
      const now = new Date();
      
      if (assignmentDate > now) {
        calculatedStatus = 'SCHEDULED';
      } else {
        calculatedStatus = 'ACTIVE';
      }
    }

    // Get zone statistics (same as listZones)
    const totalResidents = await Resident.countDocuments({ zoneId: id });
    const activeResidents = await Resident.countDocuments({ 
      zoneId: id, 
      status: { $in: ['interested', 'visited', 'callback', 'appointment', 'follow-up'] }
    });

    // Add current assignment and calculated status to zone data
    const zoneData: any = zone.toObject();
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
    const { name, description, boundary, buildingData, status, assignedAgentId, teamId, effectiveFrom, removeAssignment, isBoundaryUpdateOnly, isNameDescriptionUpdateOnly } = req.body;

    console.log('\n🔄 ===== UPDATE ZONE STARTED =====');
    console.log(`Zone ID: ${id}`);
    console.log(`Request Body:`, { name, description, assignedAgentId, teamId, effectiveFrom, removeAssignment });
    console.log(`User ID: ${req.user?.id}`);

    const zone = await Zone.findById(id);
    if (!zone) {
      console.log('❌ Zone not found');
      return res.status(404).json({
        success: false,
        message: 'Zone not found'
      });
    }

    console.log('📋 Current Zone State:');
    console.log(`  Current Name: ${zone.name}`);
    console.log(`  Current Status: ${zone.status}`);
    console.log(`  Current Assigned Agent ID: ${zone.assignedAgentId || 'None'}`);
    console.log(`  Current Team ID: ${zone.teamId || 'None'}`);

    // Check permissions - same logic as getZoneById
    console.log('🔐 Update Permission Check:');
    console.log(`   User ID: ${req.user?.id}`);
    console.log(`   User Role: ${req.user?.role}`);
    console.log(`   Zone Created By: ${zone.createdBy?._id?.toString()}`);
    console.log(`   Is SUPERADMIN: ${req.user?.role === 'SUPERADMIN'}`);
    console.log(`   Zone created by user: ${zone.createdBy?._id?.toString() === req.user?.id}`);
    
    if (req.user?.role !== 'SUPERADMIN' && 
        zone.createdBy?._id?.toString() !== req.user?.id) {
      console.log('❌ Access denied to update zone');
      return res.status(403).json({
        success: false,
        message: 'Access denied to update this zone'
      });
    }
    
    console.log('✅ Access granted to update zone');

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

    // Check for boundary overlap if boundary is being updated
    if (boundary) {
      // Validate boundary format
      if (!validateZoneBoundary(boundary)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid zone boundary format. Please ensure the polygon is properly closed.'
        });
      }

      // Check for overlapping zones (exclude current zone)
      const overlapResult = await checkZoneOverlap(boundary, id);
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

      // Check if any user has already created a zone with this exact boundary
      const existingZoneWithSameBoundary = await Zone.findOne({
        boundary: boundary,
        _id: { $ne: id }
      });

      if (existingZoneWithSameBoundary) {
        return res.status(409).json({
          success: false,
          message: `A zone with this exact boundary already exists: ${existingZoneWithSameBoundary.name}`,
          data: {
            duplicateZone: {
              id: existingZoneWithSameBoundary._id,
              name: existingZoneWithSameBoundary.name,
              createdBy: existingZoneWithSameBoundary.createdBy
            }
          }
        });
      }
    }

    // Handle operations without transaction to avoid timeout issues
    try {
      // Update zone basic properties
      const updateData: any = { name, description, boundary, status };
      
      // Process building data if provided (same logic as createZone)
      if (buildingData && buildingData.addresses && buildingData.coordinates) {
        const processedBuildingData = processBuildingData(
          buildingData.addresses,
          buildingData.coordinates
        );
        
        // Check for duplicate buildings across all zones (excluding current zone)
        const duplicateAddresses = await checkDuplicateBuildings(processedBuildingData.addresses);
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
        await Resident.deleteMany({ zoneId: id });
        
        // Create new residents if building data is provided
        if (processedBuildingData && processedBuildingData.addresses.length > 0) {
          console.log('🏠 Creating residents with house number extraction...');
          console.log(`📊 Total addresses to process: ${processedBuildingData.addresses.length}`);
          
          const residents = processedBuildingData.addresses.map((address, index) => {
            const coordinates = processedBuildingData.coordinates[index];
            const houseNumber = extractHouseNumber(address);
            
            // Log house number extraction for debugging
            console.log(`🏠 Address: "${address}" → House Number: ${houseNumber || 'null'}`);
            
            return new Resident({
              zoneId: id,
              address,
              coordinates,
              houseNumber,
              status: 'not-visited',
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          });

          await Resident.insertMany(residents);
          console.log(`✅ Created ${residents.length} residents with house numbers`);
        }
      }

      // 1. Deactivate existing assignments for this zone
      console.log('\n🔄 Deactivating existing assignments...');
      const deactivatedAssignments = await AgentZoneAssignment.updateMany(
        { zoneId: id, status: 'ACTIVE' },
        { status: 'INACTIVE', effectiveTo: new Date() }
      );
      console.log(`✅ Deactivated ${deactivatedAssignments.modifiedCount} AgentZoneAssignment records`);

      // Cancel any pending scheduled assignments for this zone
      console.log('🔄 Cancelling pending scheduled assignments...');
      const cancelledScheduled = await ScheduledAssignment.updateMany(
        { zoneId: id, status: 'PENDING' },
        { status: 'CANCELLED' }
      );
      console.log(`✅ Cancelled ${cancelledScheduled.modifiedCount} ScheduledAssignment records`);

      // Handle assignment updates
      console.log('\n📋 Processing assignment updates...');
      console.log(`📋 Current zone status: ${zone.status}`);
      console.log(`📋 Current assigned agent: ${zone.assignedAgentId || 'None'}`);
      console.log(`📋 Current team: ${zone.teamId || 'None'}`);
      console.log(`📋 New assigned agent: ${assignedAgentId || 'None'}`);
      console.log(`📋 New team: ${teamId || 'None'}`);
      console.log(`📋 Remove assignment: ${removeAssignment || false}`);
      console.log(`📋 Is boundary update only: ${isBoundaryUpdateOnly || false}`);
      console.log(`📋 Is name/description update only: ${isNameDescriptionUpdateOnly || false}`);
      
      // If this is only a boundary update, skip all assignment processing
      if (isBoundaryUpdateOnly) {
        console.log('🎯 BOUNDARY UPDATE ONLY: Skipping assignment processing to preserve current status');
        console.log(`📋 Preserving current status: ${zone.status}`);
        console.log(`📋 Preserving current assignment: ${zone.assignedAgentId || 'None'}`);
        console.log(`📋 Preserving current team: ${zone.teamId || 'None'}`);
        
        // Keep current assignment and status
        updateData.assignedAgentId = zone.assignedAgentId;
        updateData.teamId = zone.teamId;
        updateData.status = zone.status;
        
        console.log('✅ Boundary update only - assignment processing skipped');
      } else if (isNameDescriptionUpdateOnly) {
        console.log('🎯 NAME/DESCRIPTION UPDATE ONLY: Skipping assignment processing to preserve current status');
        console.log(`📋 Preserving current status: ${zone.status}`);
        console.log(`📋 Preserving current assignment: ${zone.assignedAgentId || 'None'}`);
        console.log(`📋 Preserving current team: ${zone.teamId || 'None'}`);
        
        // Keep current assignment and status
        updateData.assignedAgentId = zone.assignedAgentId;
        updateData.teamId = zone.teamId;
        updateData.status = zone.status;
        
        console.log('✅ Name/description update only - assignment processing skipped');
      } else if (removeAssignment) {
        console.log('❌ Removing all assignments...');
        console.log('📋 Setting zone to DRAFT status (no assignments)');
        // 2. Remove all assignments - set to DRAFT status
        updateData.assignedAgentId = null;
        updateData.teamId = null;
        updateData.status = 'DRAFT';
        
        // 3. Remove zone from all users who were assigned to this zone
        console.log('🔄 Removing zone from user records...');
        const userUpdates = await User.updateMany(
          { $or: [{ primaryZoneId: id }, { zoneIds: id }] },
          { 
            $unset: { primaryZoneId: 1 },
            $pull: { zoneIds: id }
          }
        );
        console.log(`✅ Updated ${userUpdates.modifiedCount} user records`);
        
             } else if (assignedAgentId) {
         console.log('👤 Assigning to individual agent...');
         console.log(`Agent ID: ${assignedAgentId}`);
         
         // Check if zone was previously unassigned (DRAFT status)
         if (zone.status === 'DRAFT' && !zone.assignedAgentId && !zone.teamId) {
           console.log('🎯 SPECIAL CASE: Zone was previously unassigned (DRAFT status)');
           console.log('📋 This is a new assignment to an unassigned zone');
           console.log('📋 No cleanup needed - creating fresh assignment');
         } else {
           console.log('🔄 Zone had previous assignment, cleaning up...');
         }
         
         // Handle all previous assignment cleanup scenarios
         console.log('🔄 Cleaning up previous assignments...');
         
         // Scenario 1: Zone was previously assigned to a team
         if (zone.teamId) {
           console.log('🔄 Zone was previously assigned to team, cleaning up old assignments...');
           console.log(`📋 Previous team ID: ${zone.teamId}`);
           console.log(`📋 New assigned agent ID: ${assignedAgentId}`);
           
           const previousTeam = await Team.findById(zone.teamId);
           if (previousTeam) {
             console.log(`🔄 Found previous team: ${previousTeam.name} (${previousTeam._id})`);
             console.log(`📋 Previous team members: [${previousTeam.agentIds.join(', ')}]`);
             
             // Check if the new individual agent is part of the same team
             const isNewAgentInSameTeam = previousTeam.agentIds.some(agentId => agentId.toString() === assignedAgentId);
             console.log(`🔍 Is new agent in same team? ${isNewAgentInSameTeam}`);
             
             if (isNewAgentInSameTeam) {
               console.log('🎯 SPECIAL CASE: New individual agent is a member of the same team!');
               console.log('📋 This means: Team assignment → Individual assignment (same team member)');
               console.log('📋 Other team members will become UNASSIGNED, but this agent keeps the assignment');
             }
             
             console.log(`🔄 Cleaning up assignments for team ${previousTeam.name} (${previousTeam._id})...`);
             
             // 1. Remove old team assignments for this zone
             console.log('🗑️ Step 1: Removing old team zone assignments...');
             const deletedZoneAssignments = await AgentZoneAssignment.deleteMany({ 
               zoneId: id, 
               teamId: zone.teamId 
             });
             console.log(`✅ Deleted ${deletedZoneAssignments.deletedCount} old team zone assignments`);
             
             // 2. Remove old scheduled assignments for this zone (both team and individual)
             console.log('🗑️ Step 2: Removing old scheduled assignments for this zone...');
             const deletedScheduled = await ScheduledAssignment.deleteMany({ 
               zoneId: id
             });
             console.log(`✅ Deleted ${deletedScheduled.deletedCount} old scheduled assignments for this zone`);
             
             // 3. Remove team assignment from zone
             console.log('🗑️ Step 3: Removing team assignment from zone...');
             await Zone.findByIdAndUpdate(id, { teamId: null });
             console.log('✅ Removed team assignment from zone');
             
             // 4. Now update team status (after removing old assignments)
             console.log('🔄 Step 4: Updating team status...');
             console.log(`📋 Calling updateTeamStatus for team ${previousTeam._id}...`);
             await updateTeamStatus((previousTeam._id as any).toString());
             console.log(`📋 Calling updateTeamAssignmentStatus for team ${previousTeam._id}...`);
             await updateTeamAssignmentStatus((previousTeam._id as any).toString());
             console.log(`✅ Updated team status for ${previousTeam.name}`);
             
             // Force update team assignment status to UNASSIGNED since team assignment was removed
             await Team.findByIdAndUpdate(previousTeam._id, { assignmentStatus: 'UNASSIGNED' });
             console.log(`✅ Forced team assignment status to UNASSIGNED`);
             
             // Force update other team members to UNASSIGNED since team assignment was removed
             if (previousTeam.agentIds && previousTeam.agentIds.length > 0) {
               for (const agentId of previousTeam.agentIds) {
                 // Skip the new assigned agent (they'll get updated with new individual assignment)
                 if (agentId.toString() === assignedAgentId) {
                   console.log(`⏭️ Skipping new assigned agent ${agentId} (will be updated later)`);
                   continue;
                 }
                 
                 // Force other team members to UNASSIGNED
                 await User.findByIdAndUpdate(agentId, { 
                   assignmentStatus: 'UNASSIGNED',
                   zoneIds: [],
                   primaryZoneId: null
                 });
                 console.log(`✅ Forced team member ${agentId} to UNASSIGNED`);
               }
             }
             
             // 5. Update all team members' status
             if (previousTeam.agentIds && previousTeam.agentIds.length > 0) {
               console.log(`🔄 Step 5: Updating ${previousTeam.agentIds.length} team members...`);
               for (const agentId of previousTeam.agentIds) {
                 console.log(`  👤 Processing team member: ${agentId}`);
                 
                 // Skip the new assigned agent if they're in the same team (they'll get updated later)
                 if (isNewAgentInSameTeam && agentId.toString() === assignedAgentId) {
                   console.log(`    ⏭️ Skipping new assigned agent ${agentId} (will be updated later with new assignment)`);
                   continue;
                 }
                 
                 console.log(`    🔄 Calling syncAgentZoneIds for agent ${agentId}...`);
                 await syncAgentZoneIds(agentId.toString());
                 console.log(`    🔄 Calling updateUserAssignmentStatus for agent ${agentId}...`);
                 await updateUserAssignmentStatus(agentId.toString());
                 console.log(`    ✅ Updated status for team member ${agentId}`);
               }
               
               if (isNewAgentInSameTeam) {
                 console.log(`🎯 SPECIAL CASE: New agent ${assignedAgentId} is in same team, will be updated with new individual assignment`);
               }
             }
           } else {
             console.log('❌ Previous team not found in database');
           }
         }
         
         // Scenario 2: Zone was previously assigned to an individual agent
         if (zone.assignedAgentId && zone.assignedAgentId.toString() !== assignedAgentId) {
           console.log('🔄 Zone was previously assigned to individual agent, cleaning up old assignment...');
           const previousAgent = await User.findById(zone.assignedAgentId);
           if (previousAgent) {
             console.log(`🔄 Cleaning up assignment for agent ${(previousAgent as any).firstName} ${(previousAgent as any).lastName} (${previousAgent._id})...`);
             
             // 1. Remove old individual assignments for this zone
             const deletedZoneAssignments = await AgentZoneAssignment.deleteMany({ 
               zoneId: id, 
               agentId: zone.assignedAgentId 
             }, {});
             console.log(`✅ Deleted ${deletedZoneAssignments.deletedCount} old individual zone assignments`);
             
             // 2. Remove old scheduled assignments for this zone (both team and individual)
             const deletedScheduled = await ScheduledAssignment.deleteMany({ 
               zoneId: id
             }, {});
             console.log(`✅ Deleted ${deletedScheduled.deletedCount} old scheduled assignments for this zone`);
             
             // 3. Update the previous agent's status
             console.log(`🔄 Updating previous agent ${(previousAgent as any).firstName} ${(previousAgent as any).lastName} status...`);
             await syncAgentZoneIds(zone.assignedAgentId.toString());
             await updateUserAssignmentStatus(zone.assignedAgentId.toString());
             console.log(`✅ Updated status for previous agent ${(previousAgent as any).firstName} ${(previousAgent as any).lastName}`);
             
             // 4. Check if previous agent was part of a team and update team status if needed
             if (previousAgent.teamIds && previousAgent.teamIds.length > 0) {
               console.log(`🔄 Previous agent was part of ${previousAgent.teamIds.length} team(s), checking team status...`);
               for (const teamId of previousAgent.teamIds) {
                 console.log(`  Checking team ${teamId} status...`);
                 await updateTeamStatus(teamId.toString());
                 await updateTeamAssignmentStatus(teamId.toString());
                 console.log(`    ✅ Updated status for team ${teamId}`);
               }
             }
           }
         }
         
         // 2. Validate agent exists
         console.log('🔍 Step 5: Validating new assigned agent...');
         console.log(`📋 Looking for agent with ID: ${assignedAgentId}`);
         const agent = await User.findById(assignedAgentId);
         if (!agent || agent.role !== 'AGENT') {
           console.log('❌ Agent validation failed');
           console.log(`📋 Agent found: ${agent ? 'Yes' : 'No'}`);
           console.log(`📋 Agent role: ${agent ? agent.role : 'N/A'}`);
           throw new Error('Agent not found or is not an agent');
         }
         console.log(`✅ Agent found: ${(agent as any).firstName} ${(agent as any).lastName}`);
         console.log(`📋 Agent ID: ${agent._id}`);
         console.log(`📋 Agent role: ${agent.role}`);
         console.log(`📋 Agent current status: ${agent.status}`);
         console.log(`📋 Agent current assignment status: ${agent.assignmentStatus}`);

         // 3. Check if this is a future assignment or immediate assignment
         console.log('⏰ Step 6: Determining assignment timing...');
         console.log(`📋 Effective From provided: ${effectiveFrom || 'None (using current date)'}`);
         
         const effectiveDate = effectiveFrom ? new Date(effectiveFrom) : new Date();
         const now = new Date();
         const isFutureAssignment = effectiveDate > now;
         
         console.log(`📋 Effective Date: ${effectiveDate}`);
         console.log(`📋 Current Time: ${now}`);
         console.log(`📋 Time difference: ${effectiveDate.getTime() - now.getTime()}ms`);
         console.log(`📋 Is Future Assignment: ${isFutureAssignment}`);
         console.log(`⏰ Assignment timing: ${isFutureAssignment ? 'FUTURE (SCHEDULED)' : 'IMMEDIATE'}`);
         
         if (isFutureAssignment) {
           console.log('📅 This will be a SCHEDULED assignment (future date)');
           console.log('📋 Zone status will be set to SCHEDULED');
         } else {
           console.log('🎯 This will be an IMMEDIATE assignment (current date)');
           console.log('📋 Zone status will be set to ACTIVE');
         }

                   if (isFutureAssignment) {
            console.log('📅 Step 7a: Creating scheduled assignment...');
            console.log('📋 Creating scheduled assignment for future date...');
            
            // Create scheduled assignment for future date
            const scheduledAssignmentData = {
              agentId: assignedAgentId,
              zoneId: id,
              assignedBy: req.user?.id,
              scheduledDate: effectiveDate, // Add the required scheduledDate field
              effectiveFrom: effectiveDate,
              status: 'PENDING' as const
            };
            console.log('📋 Scheduled assignment data:', scheduledAssignmentData);

            console.log('💾 Saving scheduled assignment to database...');
            const newScheduledAssignment = await ScheduledAssignment.create(scheduledAssignmentData);
            console.log(`✅ Created scheduled assignment: ${newScheduledAssignment._id}`);
           
           // Update zone status to SCHEDULED
           console.log('📋 Updating zone data for scheduled assignment...');
           updateData.assignedAgentId = assignedAgentId;
           updateData.teamId = null;
           updateData.status = 'SCHEDULED';
           console.log('📋 Zone will be marked as SCHEDULED');
           console.log('📋 Zone update data:', updateData);
         } else {
           console.log('🎯 Step 7b: Creating immediate assignment...');
           console.log('📋 Creating immediate assignment for current date...');
           
           // Create immediate assignment
           const assignmentData = {
             agentId: assignedAgentId,
             zoneId: id,
             assignedBy: req.user?.id,
             effectiveFrom: effectiveDate,
             status: 'ACTIVE' as const
           };
           console.log('📋 Assignment data:', assignmentData);

           console.log('💾 Saving immediate assignment to database...');
           const newAssignment = await AgentZoneAssignment.create(assignmentData);
           console.log(`✅ Created immediate assignment: ${newAssignment._id}`);
           
           // Update zone status to ACTIVE if it was in DRAFT
           console.log('📋 Checking if zone status needs to be updated...');
           console.log(`📋 Current zone status: ${zone.status}`);
           if (zone.status === 'DRAFT') {
             console.log('📋 Zone was in DRAFT status, updating to ACTIVE...');
             updateData.assignedAgentId = assignedAgentId;
             updateData.teamId = null;
             updateData.status = 'ACTIVE';
             console.log('📋 Zone status changed from DRAFT to ACTIVE');
           } else {
             console.log('📋 Zone was not in DRAFT status, keeping current status...');
             updateData.assignedAgentId = assignedAgentId;
             updateData.teamId = null;
           }
           console.log('📋 Final zone update data:', updateData);
         }

         // 5. Update user fields (same as createAssignment)
         console.log('🔄 Step 8: Updating user fields...');
         console.log(`📋 Updating user ${assignedAgentId} with new zone assignment...`);
         console.log(`📋 Setting primaryZoneId to: ${id}`);
         console.log(`📋 Adding zone ${id} to zoneIds array...`);
         
         await User.findByIdAndUpdate(assignedAgentId, {
           primaryZoneId: id,
           $addToSet: { zoneIds: id }
         });
         console.log(`✅ Updated user ${assignedAgentId} with zone assignment`);
         
         // 6. Update user assignment status
         console.log('🔄 Step 9: Updating user assignment status...');
         console.log(`📋 Calling syncAgentZoneIds for agent ${assignedAgentId}...`);
         await syncAgentZoneIds(assignedAgentId.toString());
         console.log(`📋 Calling updateUserAssignmentStatus for agent ${assignedAgentId}...`);
         await updateUserAssignmentStatus(assignedAgentId.toString());
         console.log(`✅ Updated assignment status for agent ${assignedAgentId}`);
         
         // 7. FORCE CLEANUP: Check for any team cleanup needed (team-to-individual OR cancelled team assignments)
         console.log('🔄 Step 10: FORCE CLEANUP - Checking for team cleanup needed...');
         
         // Check if there was a previous team assignment (either current or cancelled)
         const hadTeamAssignment = zone.teamId || await ScheduledAssignment.exists({ 
           zoneId: id, 
           teamId: { $exists: true, $ne: null },
           status: { $in: ['PENDING', 'CANCELLED'] }
         });
         
         if (hadTeamAssignment) {
           console.log('🎯 FORCE CLEANUP: Team assignment detected (current or cancelled)!');
           
           // Find the team (either from current zone or from cancelled assignment)
           let previousTeam = null;
           if (zone.teamId) {
             previousTeam = await Team.findById(zone.teamId);
             console.log(`📋 Previous team from zone.teamId: ${previousTeam?.name || 'Not found'}`);
           } else {
             // Find team from cancelled assignment
             const cancelledTeamAssignment = await ScheduledAssignment.findOne({ 
               zoneId: id, 
               teamId: { $exists: true, $ne: null },
               status: 'CANCELLED'
             }).populate('teamId');
             
             if (cancelledTeamAssignment?.teamId) {
               previousTeam = cancelledTeamAssignment.teamId;
               console.log(`📋 Previous team from cancelled assignment: ${(previousTeam as any).name}`);
             }
           }
           
           if (previousTeam) {
             console.log(`🔧 FORCE CLEANUP: Found previous team: ${(previousTeam as any).name}`);
             console.log(`📋 New individual agent ID: ${assignedAgentId}`);
             
             // FORCE: Check if team has other assignments before setting to UNASSIGNED
             const hasActiveAssignments = await AgentZoneAssignment.exists({
               teamId: (previousTeam as any)._id,
               status: { $nin: ['COMPLETED', 'CANCELLED'] }
             });
             const hasPendingScheduled = await ScheduledAssignment.exists({
               teamId: (previousTeam as any)._id,
               status: 'PENDING'
             });
             
             console.log(`🔍 FORCE CLEANUP: Team ${(previousTeam as any).name} has active assignments: ${hasActiveAssignments}, pending scheduled: ${hasPendingScheduled}`);
             
             if (!hasActiveAssignments && !hasPendingScheduled) {
               await Team.findByIdAndUpdate((previousTeam as any)._id, { assignmentStatus: 'UNASSIGNED' });
               console.log(`🔧 FORCE: Set team ${(previousTeam as any).name} to UNASSIGNED (no active assignments to ANY zones)`);
             } else {
               console.log(`⚠️ FORCE CLEANUP: Team ${(previousTeam as any).name} still has assignments to other zones, keeping as ASSIGNED`);
             }
             
             // FORCE: Set other team members to UNASSIGNED (only if they have no other assignments)
             if ((previousTeam as any).agentIds && (previousTeam as any).agentIds.length > 0) {
               for (const agentId of (previousTeam as any).agentIds) {
                 if (agentId.toString() !== assignedAgentId) {
                   // Check if this team member has other assignments
                   const hasActiveAssignments = await AgentZoneAssignment.exists({
                     agentId: agentId,
                     status: { $nin: ['COMPLETED', 'CANCELLED'] }
                   });
                   const hasPendingScheduled = await ScheduledAssignment.exists({
                     agentId: agentId,
                     status: 'PENDING'
                   });
                   
                   console.log(`🔍 FORCE CLEANUP: Team member ${agentId} has active assignments: ${hasActiveAssignments}, pending scheduled: ${hasPendingScheduled}`);
                   
                   if (!hasActiveAssignments && !hasPendingScheduled) {
                     await User.findByIdAndUpdate(agentId, {
                       assignmentStatus: 'UNASSIGNED',
                       zoneIds: [],
                       primaryZoneId: null
                     });
                     console.log(`🔧 FORCE: Set team member ${agentId} to UNASSIGNED (no active assignments to ANY zones)`);
                   } else {
                     console.log(`⚠️ FORCE CLEANUP: Team member ${agentId} still has assignments to other zones, keeping as ASSIGNED`);
                   }
                 }
               }
             }
             
             // VERIFICATION: Check final status after updates
             console.log('🔍 FORCE CLEANUP VERIFICATION: Checking final status...');
             const updatedTeam = await Team.findById((previousTeam as any)._id);
             if (updatedTeam) {
               console.log(`📋 Team ${updatedTeam.name} final assignmentStatus: ${updatedTeam.assignmentStatus}`);
             }
             
             for (const agentId of (previousTeam as any).agentIds) {
               if (agentId.toString() !== assignedAgentId) {
                 const updatedAgent = await User.findById(agentId);
                 if (updatedAgent) {
                   console.log(`📋 Team member ${agentId} final assignmentStatus: ${updatedAgent.assignmentStatus}`);
                   console.log(`📋 Team member ${agentId} final zoneIds: [${updatedAgent.zoneIds.join(', ')}]`);
                 }
               }
             }
             console.log('✅ FORCE CLEANUP VERIFICATION COMPLETED');
           }
         } else {
           console.log('📋 No team assignment detected, skipping FORCE CLEANUP');
         }
         
       } else if (teamId) {
         console.log('👥 Assigning to team...');
         console.log(`Team ID: ${teamId}`);
         
         // Check if zone was previously unassigned (DRAFT status)
         if (zone.status === 'DRAFT' && !zone.assignedAgentId && !zone.teamId) {
           console.log('🎯 SPECIAL CASE: Zone was previously unassigned (DRAFT status)');
           console.log('📋 This is a new team assignment to an unassigned zone');
           console.log('📋 No cleanup needed - creating fresh team assignment');
         } else {
           console.log('🔄 Zone had previous assignment, cleaning up...');
         }
         
         // Handle all previous assignment cleanup scenarios for team assignment
         console.log('🔄 Cleaning up previous assignments for team assignment...');
         
         // Scenario 1: Zone was previously assigned to a different team
         if (zone.teamId && zone.teamId.toString() !== teamId) {
           console.log('🔄 Zone was previously assigned to different team, cleaning up old assignments...');
           const previousTeam = await Team.findById(zone.teamId);
           if (previousTeam) {
             console.log(`🔄 Cleaning up assignments for previous team ${previousTeam.name} (${previousTeam._id})...`);
             
             // 1. Remove old team assignments for this zone
             const deletedZoneAssignments = await AgentZoneAssignment.deleteMany({ 
               zoneId: id, 
               teamId: zone.teamId 
             });
             console.log(`✅ Deleted ${deletedZoneAssignments.deletedCount} old team zone assignments`);
             
             // 2. Remove old scheduled assignments for this zone
             const deletedScheduled = await ScheduledAssignment.deleteMany({ 
               zoneId: id, 
               teamId: zone.teamId 
             });
             console.log(`✅ Deleted ${deletedScheduled.deletedCount} old scheduled team assignments`);
             
             // 3. Now update previous team status (after removing old assignments)
             console.log(`🔄 Updating previous team ${previousTeam.name} (${previousTeam._id}) status...`);
             await updateTeamStatus((previousTeam._id as any).toString());
             await updateTeamAssignmentStatus((previousTeam._id as any).toString());
             
             // Force check and update team assignment status if needed
             const updatedTeam = await Team.findById(zone.teamId);
             if (updatedTeam) {
               // Check for ANY active assignments to ANY zones for this team
               const hasActiveAssignments = await AgentZoneAssignment.exists({
                 teamId: zone.teamId,
                 status: { $nin: ['COMPLETED', 'CANCELLED'] }
               });
               const hasPendingScheduled = await ScheduledAssignment.exists({
                 teamId: zone.teamId,
                 status: 'PENDING'
               });
               
               console.log(`🔍 FORCE CHECK: Team ${previousTeam.name} has active assignments: ${hasActiveAssignments}, pending scheduled: ${hasPendingScheduled}`);
               
               if (!hasActiveAssignments && !hasPendingScheduled) {
                 await Team.findByIdAndUpdate(zone.teamId, {
                   assignmentStatus: 'UNASSIGNED'
                 });
                 console.log(`🔧 FORCE: Set team ${previousTeam.name} to UNASSIGNED (no active assignments to ANY zones)`);
               } else {
                 console.log(`⚠️ FORCE CHECK: Team ${previousTeam.name} still has assignments to other zones, keeping as ASSIGNED`);
               }
             }
             
             console.log(`✅ Updated status for previous team ${previousTeam.name}`);
             
             // 4. Update all previous team members' status and clear zone assignments
             if (previousTeam.agentIds && previousTeam.agentIds.length > 0) {
               console.log(`🔄 Updating ${previousTeam.agentIds.length} previous team members...`);
               for (const agentId of previousTeam.agentIds) {
                 console.log(`  Processing previous team member: ${agentId}`);
                 
                 // First, clear the agent's zone assignments since they're being removed
                 await User.findByIdAndUpdate(agentId, {
                   $pull: { zoneIds: id },
                   $set: { primaryZoneId: null }
                 });
                 console.log(`    ✅ Cleared zone ${id} from team member ${agentId}`);
                 
                 // Then sync and update status
                 await syncAgentZoneIds(agentId.toString());
                 await updateUserAssignmentStatus(agentId.toString());
                 
                 // Force check and update assignment status if needed
                 const updatedTeamMember = await User.findById(agentId);
                 if (updatedTeamMember && updatedTeamMember.zoneIds.length === 0) {
                   // Double-check: if agent has no zoneIds, they should be UNASSIGNED
                   // Check for ANY active assignments to ANY zones (not just the current zone)
                   const hasActiveAssignments = await AgentZoneAssignment.exists({
                     agentId: agentId,
                     status: { $nin: ['COMPLETED', 'CANCELLED'] }
                   });
                   const hasPendingScheduled = await ScheduledAssignment.exists({
                     agentId: agentId,
                     status: 'PENDING'
                   });
                   
                   console.log(`    🔍 FORCE CHECK: Team member ${agentId} has active assignments: ${hasActiveAssignments}, pending scheduled: ${hasPendingScheduled}`);
                   
                   if (!hasActiveAssignments && !hasPendingScheduled) {
                     await User.findByIdAndUpdate(agentId, {
                       assignmentStatus: 'UNASSIGNED'
                     });
                     console.log(`    🔧 FORCE: Set team member ${agentId} to UNASSIGNED (no active assignments to ANY zones)`);
                   } else {
                     console.log(`    ⚠️ FORCE CHECK: Team member ${agentId} still has assignments to other zones, keeping as ASSIGNED`);
                   }
                 }
                 
                 console.log(`    ✅ Updated status for previous team member ${agentId}`);
               }
             }
           }
         }
         
         // Scenario 2: Zone was previously assigned to an individual agent
         if (zone.assignedAgentId) {
           console.log('🔄 Zone was previously assigned to individual agent, cleaning up old assignment...');
           const previousAgent = await User.findById(zone.assignedAgentId);
           if (previousAgent) {
             console.log(`🔄 Cleaning up assignment for previous agent ${(previousAgent as any).firstName} ${(previousAgent as any).lastName} (${previousAgent._id})...`);
             
             // 1. Remove old individual assignments for this zone
             const deletedZoneAssignments = await AgentZoneAssignment.deleteMany({ 
               zoneId: id, 
               agentId: zone.assignedAgentId 
             }, {});
             console.log(`✅ Deleted ${deletedZoneAssignments.deletedCount} old individual zone assignments`);
             
             // 2. Remove old scheduled assignments for this zone (both team and individual)
             const deletedScheduled = await ScheduledAssignment.deleteMany({ 
               zoneId: id
             }, {});
             console.log(`✅ Deleted ${deletedScheduled.deletedCount} old scheduled assignments for this zone`);
             
             // 3. Update the previous agent's status and clear zone assignments
             console.log(`🔄 Updating previous agent ${(previousAgent as any).firstName} ${(previousAgent as any).lastName} status...`);
             
             // First, clear the agent's zone assignments since they're being removed
             await User.findByIdAndUpdate(zone.assignedAgentId, {
               $pull: { zoneIds: id },
               $set: { primaryZoneId: null }
             });
             console.log(`✅ Cleared zone ${id} from agent ${(previousAgent as any).firstName} ${(previousAgent as any).lastName}`);
             
             // Then sync and update status
             await syncAgentZoneIds(zone.assignedAgentId.toString());
             await updateUserAssignmentStatus(zone.assignedAgentId.toString());
             
             // Force check and update assignment status if needed
             const updatedAgent = await User.findById(zone.assignedAgentId);
             if (updatedAgent && updatedAgent.zoneIds.length === 0) {
               // Double-check: if agent has no zoneIds, they should be UNASSIGNED
               // Check for ANY active assignments to ANY zones (not just the current zone)
               const hasActiveAssignments = await AgentZoneAssignment.exists({
                 agentId: zone.assignedAgentId,
                 status: { $nin: ['COMPLETED', 'CANCELLED'] }
               });
               const hasPendingScheduled = await ScheduledAssignment.exists({
                 agentId: zone.assignedAgentId,
                 status: 'PENDING'
               });
               
               console.log(`🔍 FORCE CHECK: Agent ${(previousAgent as any).firstName} has active assignments: ${hasActiveAssignments}, pending scheduled: ${hasPendingScheduled}`);
               
               if (!hasActiveAssignments && !hasPendingScheduled) {
                 await User.findByIdAndUpdate(zone.assignedAgentId, {
                   assignmentStatus: 'UNASSIGNED'
                 });
                 console.log(`🔧 FORCE: Set agent ${(previousAgent as any).firstName} ${(previousAgent as any).lastName} to UNASSIGNED (no active assignments to ANY zones)`);
               } else {
                 console.log(`⚠️ FORCE CHECK: Agent ${(previousAgent as any).firstName} still has assignments to other zones, keeping as ASSIGNED`);
               }
             }
             
             console.log(`✅ Updated status for previous agent ${(previousAgent as any).firstName} ${(previousAgent as any).lastName}`);
             
             // 4. Check if previous agent was part of a team and update team status if needed
             if (previousAgent.teamIds && previousAgent.teamIds.length > 0) {
               console.log(`🔄 Previous agent was part of ${previousAgent.teamIds.length} team(s), checking team status...`);
               for (const teamId of previousAgent.teamIds) {
                 console.log(`  Checking team ${teamId} status...`);
                 await updateTeamStatus(teamId.toString());
                 await updateTeamAssignmentStatus(teamId.toString());
                 console.log(`    ✅ Updated status for team ${teamId}`);
               }
             }
           }
         }
         
         // 2. Validate team exists
         const team = await Team.findById(teamId);
         if (!team) {
           console.log('❌ Team validation failed');
           throw new Error('Team not found');
         }
         console.log(`✅ Team found: ${team.name}`);

         // 3. Check if this is a future assignment or immediate assignment
         const effectiveDate = effectiveFrom ? new Date(effectiveFrom) : new Date();
         const now = new Date();
         const isFutureAssignment = effectiveDate > now;
         console.log(`⏰ Assignment timing: ${isFutureAssignment ? 'FUTURE' : 'IMMEDIATE'}`);
         console.log(`Effective Date: ${effectiveDate}`);
         console.log(`Current Time: ${now}`);

         if (isFutureAssignment) {
           // Create scheduled assignment for future date
           const scheduledAssignmentData = {
             teamId: teamId,
             zoneId: id,
             assignedBy: req.user?.id,
             scheduledDate: effectiveDate,
             effectiveFrom: effectiveDate,
             status: 'PENDING' as const
           };

           await ScheduledAssignment.create(scheduledAssignmentData);
           
           // Update zone status to SCHEDULED
           updateData.teamId = teamId;
           updateData.assignedAgentId = null;
           updateData.status = 'SCHEDULED';
         } else {
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
             await AgentZoneAssignment.insertMany(teamAssignments, {});

             // Update user fields for all team members
             await User.updateMany(
               { _id: { $in: team.agentIds } },
               {
                 primaryZoneId: id,
                 $addToSet: { zoneIds: id }
               },
               {}
             );
           }

           // Update zone fields
           updateData.teamId = teamId;
           updateData.assignedAgentId = null;
           updateData.status = 'ACTIVE';
         }
       }

      // 7. Update zone
    const updatedZone = await Zone.findByIdAndUpdate(
      id,
        updateData,
        { new: true, runValidators: true}
      ).populate('teamId', 'name').populate('assignedAgentId', 'name email');

                          // 8. Sync all related data and recalculate statuses (same logic as createAssignment)
        console.log('\n🔄 Updating final statuses and relationships...');
        if (assignedAgentId) {
          console.log('👤 Processing individual agent final status updates...');
          // Update individual agent status and zone fields (same as createAssignment)
          await updateAgentStatus(assignedAgentId);
          console.log(`✅ Updated agent status for ${assignedAgentId}`);
          
          // Update agent's primaryZoneId (same as createAssignment)
          const agent = await User.findById(assignedAgentId);
          if (agent) {
            const updateData: any = {};
            
            // Always set latest assignment as primary for individual agents (same as createAssignment)
            updateData.primaryZoneId = id;
            
            // Update agent with new primary zone (same as createAssignment)
            await User.findByIdAndUpdate(assignedAgentId, updateData, {});
            console.log(`✅ Updated primary zone for agent ${(agent as any).firstName} ${(agent as any).lastName}`);
            
            // Sync zoneIds with all current assignments (same as createAssignment)
            await syncAgentZoneIds(assignedAgentId);
            console.log(`✅ Synced zone IDs for agent ${assignedAgentId}`);
          }
          
          // Update assignment status for the assigned agent
          await updateUserAssignmentStatus(assignedAgentId);
          console.log(`✅ Updated assignment status for agent ${assignedAgentId}`);
        } else if (teamId) {
          console.log('👥 Processing team assignment final status updates...');
          // Update team status if this is a team assignment (same as createAssignment)
          await updateTeamStatus(teamId);
          await updateTeamAssignmentStatus(teamId);
          console.log(`✅ Updated team status and assignment status for team ${teamId}`);
          
          // Update individual agent statuses and zone fields for all team members (same as createAssignment)
          const team = await Team.findById(teamId);
          if (team && team.agentIds) {
            console.log(`🔄 Processing ${team.agentIds.length} team members...`);
            for (const agentId of team.agentIds) {
              console.log(`  Processing member: ${agentId}`);
              await updateAgentStatus(agentId.toString());
              
              // Update agent's zone fields (same as createAssignment)
              const agent = await User.findById(agentId);
              if (agent) {
                const updateData: any = {};
                
                // Always set latest team assignment as primary for team members (same as createAssignment)
                updateData.primaryZoneId = id;
                
                // Update agent with new primary zone (same as createAssignment)
                await User.findByIdAndUpdate(agentId, updateData, {});
                console.log(`    ✅ Updated primary zone for ${(agent as any).firstName} ${(agent as any).lastName}`);
                
                // Sync zoneIds with all current assignments (same as createAssignment)
                await syncAgentZoneIds(agentId.toString());
                console.log(`    ✅ Synced zone IDs for ${(agent as any).firstName} ${(agent as any).lastName}`);
              }
              
                           // Sync agent zoneIds and update assignment status for each team member
             await syncAgentZoneIds(agentId.toString());
             await updateUserAssignmentStatus(agentId.toString());
             console.log(`    ✅ Updated assignment status for member ${agentId}`);
            }
          }
        } else if (removeAssignment) {
          console.log('❌ Processing assignment removal final status updates...');
          // Update statuses for all users who were previously assigned to this zone
          const previouslyAssignedUsers = await User.find({
            $or: [{ primaryZoneId: id }, { zoneIds: id }]
          });
          console.log(`🔄 Found ${previouslyAssignedUsers.length} previously assigned users to update`);
          
          for (const user of previouslyAssignedUsers) {
            console.log(`  Processing user: ${(user as any).firstName} ${(user as any).lastName} (${user._id})`);
            await syncAgentZoneIds((user._id as any).toString());
            await updateAgentStatus((user._id as any).toString());
            await updateUserAssignmentStatus((user._id as any).toString());
            console.log(`    ✅ Updated status for ${(user as any).firstName} ${(user as any).lastName}`);
          }
        }

      console.log('\n✅ Update completed successfully');

      // Get the updated zone with proper population and calculated data (same as getZoneById)
      const finalZone = await Zone.findById(id)
        .populate('teamId', 'name')
        .populate('assignedAgentId', 'name email')
        .populate('createdBy', 'name email');

      if (!finalZone) {
        throw new Error('Zone not found after update');
      }

      // Get active assignments (same logic as getZoneById)
      const activeAssignments = await AgentZoneAssignment.find({
        zoneId: id,
        status: { $nin: ['COMPLETED', 'CANCELLED'] },
        effectiveTo: null
      }).populate('agentId', 'name email').populate('teamId', 'name');

      // Get scheduled assignments
      const scheduledAssignment = await ScheduledAssignment.findOne({
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
        } else {
          // Individual assignment
          currentAssignment = activeAssignments[0];
        }
      } else if (scheduledAssignment) {
        currentAssignment = scheduledAssignment;
      }

      // Calculate zone status based on assignments and completion (same logic as getZoneById)
      let calculatedStatus = 'DRAFT'; // Default to DRAFT
      
      // Check if zone is completed (all houses visited)
      if (finalZone.buildingData?.houseStatuses) {
        const houseStatuses = Array.from((finalZone.buildingData.houseStatuses as any).values());
        const totalHouses = houseStatuses.length;
        const visitedHouses = houseStatuses.filter((house: any) => house.status !== 'not-visited').length;
        
        // If all houses have been visited (not 'not-visited'), mark as COMPLETED
        if (totalHouses > 0 && visitedHouses === totalHouses) {
          calculatedStatus = 'COMPLETED';
        } else if (currentAssignment) {
          // Check if it's a scheduled assignment (future date)
          const assignmentDate = new Date(currentAssignment.effectiveFrom);
          const now = new Date();
          
          if (assignmentDate > now) {
            calculatedStatus = 'SCHEDULED';
          } else {
            calculatedStatus = 'ACTIVE';
          }
        }
      } else if (currentAssignment) {
        // Check if it's a scheduled assignment (future date)
        const assignmentDate = new Date(currentAssignment.effectiveFrom);
        const now = new Date();
        
        if (assignmentDate > now) {
          calculatedStatus = 'SCHEDULED';
        } else {
          calculatedStatus = 'ACTIVE';
        }
      }

      // Add current assignment and calculated status to zone data (same as getZoneById)
      const zoneData: any = finalZone.toObject();
      zoneData.status = calculatedStatus; // Use calculated status instead of stored status
      zoneData.currentAssignment = currentAssignment ? {
        _id: currentAssignment._id,
        agentId: currentAssignment.agentId,
        teamId: currentAssignment.teamId,
        effectiveFrom: currentAssignment.effectiveFrom,
        effectiveTo: 'effectiveTo' in currentAssignment ? currentAssignment.effectiveTo || null : null,
        status: currentAssignment.status
      } : null;

    console.log('\n🎉 ===== UPDATE ZONE COMPLETED SUCCESSFULLY =====');
    console.log('📋 Final Zone Data:');
    console.log(`  Zone ID: ${zoneData._id}`);
    console.log(`  Zone Name: ${zoneData.name}`);
    console.log(`  Zone Status: ${zoneData.status}`);
    console.log(`  Assigned Agent ID: ${zoneData.assignedAgentId || 'None'}`);
    console.log(`  Team ID: ${zoneData.teamId || 'None'}`);
    if (zoneData.currentAssignment) {
      console.log('  Current Assignment:');
      console.log(`    Agent ID: ${zoneData.currentAssignment.agentId || 'None'}`);
      console.log(`    Team ID: ${zoneData.currentAssignment.teamId || 'None'}`);
      console.log(`    Status: ${zoneData.currentAssignment.status}`);
      console.log(`    Effective From: ${zoneData.currentAssignment.effectiveFrom}`);
    }
    console.log('🎯 Update completed successfully!\n');

    res.json({
      success: true,
      message: 'Zone updated successfully',
        data: zoneData
      });
    } catch (error) {
      throw error;
    }
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
    console.log('🗑️ deleteZone: Starting zone deletion...');
    const { id } = req.params;
    console.log('🗑️ deleteZone: Zone ID to delete:', id);

    const zone = await Zone.findById(id);
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
    const activeAssignments = await AgentZoneAssignment.find({
      zoneId: id,
      status: 'ACTIVE'
    });
    console.log('📋 deleteZone: Found', activeAssignments.length, 'active assignments');

    // Get all assignments for this zone (active and inactive) to track affected users/teams
    const allZoneAssignments = await AgentZoneAssignment.find({
      zoneId: id
    }).populate('agentId teamId');
    console.log('📋 deleteZone: Found', allZoneAssignments.length, 'total assignments');

    // Get scheduled assignments for this zone to track affected users/teams
    const scheduledAssignments = await ScheduledAssignment.find({
      zoneId: id
    }).populate('agentId teamId');
    console.log('📋 deleteZone: Found', scheduledAssignments.length, 'scheduled assignments');

    // Collect unique agent IDs and team IDs that will be affected
    const affectedAgentIds = new Set();
    const affectedTeamIds = new Set();

    allZoneAssignments.forEach(assignment => {
      if (assignment.agentId) {
        // Handle both populated objects and ObjectIds
        const agentId = typeof assignment.agentId === 'object' && assignment.agentId._id 
          ? assignment.agentId._id.toString() 
          : assignment.agentId.toString();
        affectedAgentIds.add(agentId);
      }
      if (assignment.teamId) {
        // Handle both populated objects and ObjectIds
        const teamId = typeof assignment.teamId === 'object' && assignment.teamId._id 
          ? assignment.teamId._id.toString() 
          : assignment.teamId.toString();
        affectedTeamIds.add(teamId);
      }
    });

    // Also collect from scheduled assignments
    scheduledAssignments.forEach(assignment => {
      if (assignment.agentId) {
        // Handle both populated objects and ObjectIds
        const agentId = typeof assignment.agentId === 'object' && assignment.agentId._id 
          ? assignment.agentId._id.toString() 
          : assignment.agentId.toString();
        affectedAgentIds.add(agentId);
      }
      if (assignment.teamId) {
        // Handle both populated objects and ObjectIds
        const teamId = typeof assignment.teamId === 'object' && assignment.teamId._id 
          ? assignment.teamId._id.toString() 
          : assignment.teamId.toString();
        affectedTeamIds.add(teamId);
      }
    });

    console.log('👥 deleteZone: Affected agent IDs:', Array.from(affectedAgentIds));
    console.log('👥 deleteZone: Affected team IDs:', Array.from(affectedTeamIds));
    
    // Log the actual team objects for debugging
    if (scheduledAssignments.length > 0) {
      console.log('🔍 deleteZone: Scheduled assignment teamId types:');
      scheduledAssignments.forEach((assignment, index) => {
        console.log(`  Assignment ${index}:`, {
          teamId: assignment.teamId,
          teamIdType: typeof assignment.teamId,
          hasId: assignment.teamId && typeof assignment.teamId === 'object' && '_id' in assignment.teamId
        });
      });
    }

    console.log('🔄 deleteZone: Starting zone deletion process');

    try {
      // Delete all associated data in the correct order to avoid foreign key constraint issues
      
      // 1. Delete all agent zone assignments for this zone (not just deactivate)
      const deletedZoneAssignments = await AgentZoneAssignment.deleteMany({ zoneId: id }, {});
      console.log(`Deleted ${deletedZoneAssignments.deletedCount} agent zone assignments`);
      
      // 2. Agent team assignments are not zone-specific, so we don't delete them here
      // AgentTeamAssignment tracks team membership, not zone assignments
      
      // 3. Delete all scheduled assignments
      const deletedScheduled = await ScheduledAssignment.deleteMany({ zoneId: id }, {});
      console.log(`Deleted ${deletedScheduled.deletedCount} scheduled assignments`);
      
      // 4. Delete all properties in this zone
      const deletedProperties = await Property.deleteMany({ zoneId: id }, {});
      console.log(`Deleted ${deletedProperties.deletedCount} properties`);
      
      // 5. Delete all leads in this zone
      const deletedLeads = await Lead.deleteMany({ zoneId: id }, {});
      console.log(`Deleted ${deletedLeads.deletedCount} leads`);
      
      // 6. Delete all activities in this zone
      const deletedActivities = await Activity.deleteMany({ zoneId: id }, {});
      console.log(`Deleted ${deletedActivities.deletedCount} activities`);
      
      // 7. Delete all routes in this zone
      const deletedRoutes = await Route.deleteMany({ zoneId: id }, {});
      console.log(`Deleted ${deletedRoutes.deletedCount} routes`);
      
      // 8. Delete all residents in this zone (CRITICAL - must be deleted)
      const deletedResidents = await Resident.deleteMany({ zoneId: id }, {});
      console.log(`Deleted ${deletedResidents.deletedCount} residents for zone ${id}`);
      
      // 8. Update users to remove zone references
      // Remove primaryZoneId if it matches this zone
      await User.updateMany(
        { primaryZoneId: id },
        { $unset: { primaryZoneId: 1 } },
        {}
      );
      
      // Remove from zoneIds array in users
      await User.updateMany(
        { zoneIds: id },
        { $pull: { zoneIds: id } },
        {}
      );
      
      // 9. Finally, delete the zone itself
      await Zone.findByIdAndDelete(id, {});

      console.log('✅ deleteZone: Zone deletion completed successfully');

      // After successful deletion, update assignment status for affected users and teams
      // This is done outside the transaction to avoid long-running transactions
      console.log('🔄 deleteZone: Starting status updates for affected users and teams...');
      
      // Update assignment status and zoneIds for affected agents
      for (const agentId of affectedAgentIds) {
        console.log('👤 deleteZone: Updating assignment status for agent:', agentId);
        await updateUserAssignmentStatus(agentId as string);
        
        // Also sync zoneIds to remove the deleted zone
        console.log('👤 deleteZone: Syncing zoneIds for agent:', agentId);
        await syncAgentZoneIds(agentId as string);
      }

      // Update assignment status for affected teams
      for (const teamId of affectedTeamIds) {
        console.log('👥 deleteZone: Updating assignment status for team:', teamId);
        await updateTeamAssignmentStatus(teamId as string);
        console.log('👥 deleteZone: Updating status for team:', teamId);
        await updateTeamStatus(teamId as string);
        
        // Also update assignment status for all team members
        console.log('👥 deleteZone: Fetching team to update member statuses...');
        const team = await Team.findById(teamId);
        if (team && team.agentIds && team.agentIds.length > 0) {
          console.log(`👥 deleteZone: Found ${team.agentIds.length} team members to update`);
          for (const agentId of team.agentIds) {
            console.log(`👤 deleteZone: Updating assignment status for team member: ${agentId}`);
            await updateUserAssignmentStatus(agentId.toString());
            
            // Also sync zoneIds for team members
            console.log(`👤 deleteZone: Syncing zoneIds for team member: ${agentId}`);
            await syncAgentZoneIds(agentId.toString());
          }
          console.log('✅ deleteZone: All team members assignment status and zoneIds updated');
        } else {
          console.log('⚠️ deleteZone: No team members found to update');
        }
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
    } catch (error) {
      // If any operation fails, throw the error
      throw error;
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

      await AgentZoneAssignment.insertMany(zoneAssignments);
      
      // Update user fields for all team members
      await User.updateMany(
        { _id: { $in: team.agentIds } },
        {
          primaryZoneId: zoneId,
          $addToSet: { zoneIds: zoneId }
        }
      );
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

// Get building statistics by odd/even numbers for a specific zone
export const getZoneBuildingStats = async (req: AuthRequest, res: Response) => {
  try {
    const { zoneId } = req.params;
    const userId = (req.user as any)?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Validate zone ID
    if (!mongoose.Types.ObjectId.isValid(zoneId as any)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid zone ID'
      });
    }

    // Get the zone with building data
    const zone = await Zone.findById(zoneId).select('name buildingData');
    
    if (!zone) {
      return res.status(404).json({
        success: false,
        message: 'Zone not found'
      });
    }

    // Check if user has access to this zone
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check permissions (user can access if they created it or are assigned to it)
    const canAccess = 
      zone.createdBy?.toString() === userId.toString() ||
      zone.assignedAgentId?.toString() === userId.toString() ||
      (user.teamIds && user.teamIds.includes(zone.teamId as any));

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
        range: (zone.buildingData as any)?.houseNumbers?.odd?.length > 0 ? {
          min: Math.min(...((zone.buildingData as any).houseNumbers.odd || [])),
          max: Math.max(...((zone.buildingData as any).houseNumbers.odd || []))
        } : null
      },
      evenBuildings: {
        count: zone.buildingData?.houseNumbers?.even?.length || 0,
        numbers: zone.buildingData?.houseNumbers?.even || [],
        range: (zone.buildingData as any)?.houseNumbers?.even?.length > 0 ? {
          min: Math.min(...((zone.buildingData as any).houseNumbers.even || [])),
          max: Math.max(...((zone.buildingData as any).houseNumbers.even || []))
        } : null
      },
      addresses: zone.buildingData?.addresses || [],
      coordinates: zone.buildingData?.coordinates || []
    };

    res.json({
      success: true,
      data: buildingStats
    });
  } catch (error) {
    console.error('Error getting zone building stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get zone building statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get all zones with building statistics summary
export const getAllZonesBuildingStats = async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req.user as any)?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Get user to check permissions
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Build filter based on user role
    let filter: any = {};
    
    if (user.role === 'AGENT') {
      // Agents can only see zones assigned to them
      filter = {
        $or: [
          { assignedAgentId: userId },
          { teamId: { $in: user.teamIds } }
        ]
      };
    } else if (user.role === 'SUBADMIN') {
      // Subadmins can see zones they created
      filter = { createdBy: userId };
    }
    // SUPERADMIN can see all zones (no filter)

    // Get zones with building data
    const zones = await Zone.find(filter).select('name buildingData status');
    
    const zonesStats = zones.map(zone => ({
      zoneId: zone._id,
      zoneName: zone.name,
      status: zone.status,
      totalBuildings: zone.buildingData?.totalBuildings || 0,
      oddCount: zone.buildingData?.houseNumbers?.odd?.length || 0,
      evenCount: zone.buildingData?.houseNumbers?.even?.length || 0,
      oddRange: (zone.buildingData as any)?.houseNumbers?.odd?.length > 0 ? {
        min: Math.min(...((zone.buildingData as any).houseNumbers.odd || [])),
        max: Math.max(...((zone.buildingData as any).houseNumbers.odd || []))
      } : null,
      evenRange: (zone.buildingData as any)?.houseNumbers?.even?.length > 0 ? {
        min: Math.min(...((zone.buildingData as any).houseNumbers.even || [])),
        max: Math.max(...((zone.buildingData as any).houseNumbers.even || []))
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
  } catch (error) {
    console.error('Error getting all zones building stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get zones building statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get territory map view data (zone details + residents)
export const getTerritoryMapView = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    console.log('getTerritoryMapView called with id:', id);

    // Get zone details with populated data
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

    // Check if user has access to this zone
    if (req.user?.role !== 'SUPERADMIN' && 
        zone.createdBy?._id?.toString() !== req.user?.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this zone'
      });
    }

    // Get active assignments
    const activeAssignments = await AgentZoneAssignment.find({
      zoneId: id,
      status: { $nin: ['COMPLETED', 'CANCELLED'] },
      effectiveTo: null
    }).populate('agentId', 'name email').populate('teamId', 'name');

    // Get scheduled assignments
    const scheduledAssignment = await ScheduledAssignment.findOne({
      zoneId: id,
      status: 'PENDING'
    }).populate('agentId', 'name email').populate('teamId', 'name');

    // Determine current assignment
    let currentAssignment = null;
    if (activeAssignments.length > 0) {
      const teamAssignment = activeAssignments.find(assignment => assignment.teamId);
      if (teamAssignment) {
        currentAssignment = {
          _id: teamAssignment._id,
          agentId: null,
          teamId: teamAssignment.teamId,
          effectiveFrom: teamAssignment.effectiveFrom,
          effectiveTo: teamAssignment.effectiveTo,
          status: teamAssignment.status
        };
      } else {
        currentAssignment = activeAssignments[0];
      }
    } else if (scheduledAssignment) {
      currentAssignment = scheduledAssignment;
    }

    // Calculate zone status
    let calculatedStatus = 'DRAFT';
    if (zone.buildingData?.houseStatuses) {
      const houseStatuses = Array.from((zone.buildingData.houseStatuses as any).values());
      const totalHouses = houseStatuses.length;
      const visitedHouses = houseStatuses.filter((house: any) => house.status !== 'not-visited').length;
      
      if (totalHouses > 0 && visitedHouses === totalHouses) {
        calculatedStatus = 'COMPLETED';
      } else if (currentAssignment) {
        const assignmentDate = new Date(currentAssignment.effectiveFrom);
        const now = new Date();
        
        if (assignmentDate > now) {
          calculatedStatus = 'SCHEDULED';
        } else {
          calculatedStatus = 'ACTIVE';
        }
      }
    } else if (currentAssignment) {
      const assignmentDate = new Date(currentAssignment.effectiveFrom);
      const now = new Date();
      
      if (assignmentDate > now) {
        calculatedStatus = 'SCHEDULED';
      } else {
        calculatedStatus = 'ACTIVE';
      }
    }

    // Get all residents for this zone
    const residents = await Resident.find({ zoneId: id })
      .populate('assignedAgentId', 'name email')
      .sort({ houseNumber: 1 });

    // Get status counts
    const statusCounts = await Resident.aggregate([
      { $match: { zoneId: zone._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const statusSummary = statusCounts.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>);

    // Helper function to extract house number from address
    const extractHouseNumber = (address: string): number => {
      const match = address.match(/^(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    };

    // Transform residents to match frontend Property interface
    const properties = residents.map(resident => {
      const extractedHouseNumber = extractHouseNumber(resident.address);
      return {
        _id: (resident._id as any).toString(),
        address: resident.address,
        houseNumber: extractedHouseNumber || resident.houseNumber || 0,
        coordinates: resident.coordinates,
        status: resident.status,
        lastVisited: resident.lastVisited,
        notes: resident.notes,
        residents: [{
          name: resident.address.split(',')[0] || 'Unknown', // Use address as name if no specific resident name
          phone: resident.phone,
          email: resident.email
        }]
      };
    });

    // Calculate statistics
    const totalResidents = residents.length;
    const activeResidents = residents.filter(r => 
      ['interested', 'visited', 'callback', 'appointment', 'follow-up'].includes(r.status)
    ).length;

    // Prepare zone data
    const zoneData = {
      _id: (zone._id as any).toString(),
      name: zone.name,
      description: zone.description,
      boundary: zone.boundary,
      status: calculatedStatus,
      totalResidents,
      activeResidents,
      assignedTo: currentAssignment ? {
        type: currentAssignment.teamId ? 'TEAM' : 'INDIVIDUAL',
        name: currentAssignment.teamId ? 
          (currentAssignment.teamId as any).name : 
          (currentAssignment.agentId as any)?.name || 'Unknown'
      } : null,
      currentAssignment: currentAssignment ? {
        _id: currentAssignment._id,
        agentId: currentAssignment.agentId,
        teamId: currentAssignment.teamId,
        effectiveFrom: currentAssignment.effectiveFrom,
        effectiveTo: 'effectiveTo' in currentAssignment ? currentAssignment.effectiveTo || null : null,
        status: currentAssignment.status
      } : null
    };

    res.json({
      success: true,
      data: {
        zone: zoneData,
        properties,
        statusSummary,
        statistics: {
          total: totalResidents,
          visited: statusSummary['visited'] || 0,
          remaining: totalResidents - (statusSummary['visited'] || 0)
        }
      }
    });
  } catch (error) {
    console.error('Error getting territory map view:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get territory map view data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Unified zone update controller - handles basic info, boundary, and residents conditionally
export const updateZoneUnified = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      description, 
      boundary, 
      buildingData, 
      residents,
      updateType // 'basic', 'boundary', 'residents', or 'all'
    } = req.body;

    console.log('\n🔄 ===== UNIFIED ZONE UPDATE STARTED =====');
    console.log(`Zone ID: ${id}`);
    console.log(`Update Type: ${updateType}`);
    console.log(`Request Body:`, { 
      name: name ? 'Present' : 'Not present', 
      description: description ? 'Present' : 'Not present',
      boundary: boundary ? 'Present' : 'Not present',
      buildingData: buildingData ? 'Present' : 'Not present',
      residents: residents ? `Array(${residents.length})` : 'Not present'
    });
    console.log(`User ID: ${req.user?.id}`);

    const zone = await Zone.findById(id);
    if (!zone) {
      console.log('❌ Zone not found');
      return res.status(404).json({
        success: false,
        message: 'Zone not found'
      });
    }

    // Check permissions
    if (req.user?.role !== 'SUPERADMIN' && 
        zone.createdBy?._id?.toString() !== req.user?.id) {
      console.log('❌ Access denied to update zone');
      return res.status(403).json({
        success: false,
        message: 'Access denied to update this zone'
      });
    }

    // Start a database transaction to ensure all updates are atomic
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Prepare zone update data
      const zoneUpdateData: any = {};

      // Handle basic info updates (name, description)
      if (updateType === 'basic' || updateType === 'all') {
        if (name !== undefined) zoneUpdateData.name = name;
        if (description !== undefined) zoneUpdateData.description = description;
        
        // Preserve existing status when updating basic info
        zoneUpdateData.status = zone.status || 'DRAFT';

        // Check if name already exists (if name is being updated)
        if (name && name !== zone.name) {
          const existingZone = await Zone.findOne({ name, _id: { $ne: id } });
          if (existingZone) {
            await session.abortTransaction();
            return res.status(409).json({
              success: false,
              message: 'Zone with this name already exists'
            });
          }
        }
      }

      // Handle boundary updates
      if (updateType === 'boundary' || updateType === 'all') {
        if (boundary) {
          // Validate boundary format
          if (!validateZoneBoundary(boundary)) {
            await session.abortTransaction();
            return res.status(400).json({
              success: false,
              message: 'Invalid zone boundary format. Please ensure the polygon is properly closed.'
            });
          }

          // Check for overlapping zones (exclude current zone)
          const overlapResult = await checkZoneOverlap(boundary, id);
          if (overlapResult.hasOverlap) {
            const overlappingZoneNames = overlapResult.overlappingZones.map(zone => zone.name).join(', ');
            await session.abortTransaction();
            return res.status(409).json({
              success: false,
              message: `This territory overlaps with existing zone(s): ${overlappingZoneNames}`,
              data: {
                overlappingZones: overlapResult.overlappingZones,
                overlapPercentage: overlapResult.overlapPercentage
              }
            });
          }

          // Check if any user has already created a zone with this exact boundary
          const existingZoneWithSameBoundary = await Zone.findOne({
            boundary: boundary,
            _id: { $ne: id }
          });

          if (existingZoneWithSameBoundary) {
            await session.abortTransaction();
            return res.status(409).json({
              success: false,
              message: `A zone with this exact boundary already exists: ${existingZoneWithSameBoundary.name}`,
              data: {
                duplicateZone: {
                  id: existingZoneWithSameBoundary._id,
                  name: existingZoneWithSameBoundary.name,
                  createdBy: existingZoneWithSameBoundary.createdBy
                }
              }
            });
          }

          zoneUpdateData.boundary = boundary;
        }
        if (buildingData) zoneUpdateData.buildingData = buildingData;
        
        // Preserve existing status when updating boundary
        zoneUpdateData.status = zone.status || 'DRAFT';
      }

      // Update the zone if there are zone updates
      let updatedZone = zone;
      if (Object.keys(zoneUpdateData).length > 0) {
        updatedZone = await Zone.findByIdAndUpdate(
          id,
          zoneUpdateData,
          { new: true, session }
        ).populate('createdBy', 'name email');
        console.log('✅ Zone updated successfully');
      }

      // Handle residents updates
      if ((updateType === 'residents' || updateType === 'all') && residents) {
        console.log('🔄 Updating residents for zone:', id);
        
        // Remove existing residents for this zone
        await Resident.deleteMany({ zoneId: id }, { session });
        console.log('🗑️ Deleted existing residents for zone:', id);

        // Create new residents
        const residentData = residents.map((resident: any) => ({
          zoneId: id,
          address: resident.address,
          coordinates: [resident.lng, resident.lat],
          houseNumber: resident.buildingNumber || undefined,
          status: resident.status || 'not-visited',
          notes: resident.notes || '',
          phone: resident.phone || '',
          email: resident.email || '',
          lastVisited: resident.lastVisited || null,
          assignedAgentId: null
        }));

        if (residentData.length > 0) {
          await Resident.insertMany(residentData, { session });
          console.log(`✅ Created ${residentData.length} new residents for zone:`, id);
        } else {
          console.log('⚠️ No residents to create for zone:', id);
        }
      }

      // Commit the transaction
      await session.commitTransaction();
      console.log('✅ All updates completed successfully');

      res.json({
        success: true,
        message: 'Zone updated successfully',
        data: updatedZone
      });

    } catch (error) {
      // Rollback the transaction on error
      await session.abortTransaction();
      console.error('❌ Error during zone update transaction:', error);
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Error updating zone:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update zone',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};



// Update zone residents data
export const updateZoneResidents = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { residents } = req.body;

    console.log('\n🔄 ===== UPDATE ZONE RESIDENTS STARTED =====');
    console.log(`Zone ID: ${id}`);
    console.log(`Residents count: ${residents?.length || 0}`);
    console.log(`User ID: ${req.user?.id}`);

    const zone = await Zone.findById(id);
    if (!zone) {
      console.log('❌ Zone not found');
      return res.status(404).json({
        success: false,
        message: 'Zone not found'
      });
    }

    // Check permissions
    if (req.user?.role !== 'SUPERADMIN' && 
        zone.createdBy?._id?.toString() !== req.user?.id) {
      console.log('❌ Access denied to update zone');
      return res.status(403).json({
        success: false,
        message: 'Access denied to update this zone'
      });
    }

    // Validate residents data
    if (!residents || !Array.isArray(residents)) {
      return res.status(400).json({
        success: false,
        message: 'Residents data is required and must be an array'
      });
    }

    // Update residents in the database
    // First, remove existing residents for this zone
    await Resident.deleteMany({ zoneId: id });

    // Then, create new residents
    const residentData = residents.map((resident: any) => ({
      zoneId: id,
      name: resident.name || 'Unknown',
      address: resident.address,
      buildingNumber: resident.buildingNumber || 0,
      lat: resident.lat,
      lng: resident.lng,
      status: resident.status || 'not-visited',
      phone: resident.phone || '',
      email: resident.email || '',
      lastVisited: resident.lastVisited || null,
      notes: resident.notes || '',
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    const createdResidents = await Resident.insertMany(residentData);

    console.log(`✅ Zone residents updated successfully. Created ${createdResidents.length} residents`);

    res.json({
      success: true,
      message: 'Zone residents updated successfully',
      data: {
        zoneId: id,
        residentsCount: createdResidents.length,
        residents: createdResidents
      }
    });
  } catch (error) {
    console.error('Error updating zone residents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update zone residents',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
