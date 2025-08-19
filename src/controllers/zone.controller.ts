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

// Helper function to sync agent's zoneIds with all current assignments
const syncAgentZoneIds = async (agentId: string, session?: mongoose.ClientSession) => {
  try {
    console.log(`🔄 syncAgentZoneIds: Starting for agent ${agentId}`);
    
    // Get all active assignments for this agent (individual and team-based)
    const individualAssignments = await AgentZoneAssignment.find({
      agentId: agentId,
      status: { $nin: ['COMPLETED', 'CANCELLED'] },
      effectiveTo: null
    }).populate('zoneId', '_id');

    const agent = await User.findById(agentId);
    if (!agent) {
      console.log(`❌ syncAgentZoneIds: Agent ${agentId} not found`);
      return;
    }

    // Get team-based assignments for this agent's teams
    const teamAssignments = await AgentZoneAssignment.find({
      teamId: { $in: agent.teamIds },
      status: { $nin: ['COMPLETED', 'CANCELLED'] },
      effectiveTo: null
    }).populate('zoneId', '_id');

    console.log(`📋 syncAgentZoneIds: Found ${individualAssignments.length} individual assignments`);
    console.log(`📋 syncAgentZoneIds: Found ${teamAssignments.length} team assignments`);

    // Combine all zone IDs from both individual and team assignments
    const allZoneIds = [
      ...individualAssignments.map(a => a.zoneId._id.toString()),
      ...teamAssignments.map(a => a.zoneId._id.toString())
    ];

    // Remove duplicates
    const uniqueZoneIds = [...new Set(allZoneIds)];

    console.log(`📋 syncAgentZoneIds: Combined zone IDs: ${allZoneIds.length}, Unique zone IDs: ${uniqueZoneIds.length}`);

    // Update the agent's zoneIds to match all current assignments
    const updateOptions = session ? { session } : {};
    await User.findByIdAndUpdate(agentId, {
      zoneIds: uniqueZoneIds
    }, updateOptions);

    console.log(`✅ syncAgentZoneIds: Synced zoneIds for agent ${agent.name}: ${uniqueZoneIds.length} zones`);
  } catch (error) {
    console.error('❌ syncAgentZoneIds: Error syncing agent zoneIds:', error);
  }
};

// Helper function to update agent status based on zone assignments
const updateAgentStatus = async (agentId: string, session?: mongoose.ClientSession) => {
  try {
    const agent = await User.findById(agentId);
    if (!agent || agent.role !== 'AGENT') return;

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
      await User.findByIdAndUpdate(agentId, { status: calculatedStatus }, updateOptions);
      console.log(`Agent ${agent.name} (${agentId}) status updated to ${calculatedStatus}`);
    }
  } catch (error) {
    console.error('Error updating agent status:', error);
  }
};

// Helper function to update team status based on zone assignments
const updateTeamStatus = async (teamId: string, session?: mongoose.ClientSession) => {
  try {
    console.log(`🔄 updateTeamStatus: Starting for team ${teamId}`);
    const team = await Team.findById(teamId);
    if (!team) {
      console.log(`❌ updateTeamStatus: Team ${teamId} not found`);
      return;
    }

    console.log(`📋 updateTeamStatus: Current status for ${team.name}: ${team.status}`);

    // Check if team has any zone assignments (exclude COMPLETED and CANCELLED)
    const teamZoneAssignments = await AgentZoneAssignment.find({
      teamId: teamId,
      status: { $nin: ['COMPLETED', 'CANCELLED'] },
      effectiveTo: null
    });

    // Check if team has any PENDING scheduled assignments
    const scheduledAssignments = await ScheduledAssignment.find({
      teamId: teamId,
      status: 'PENDING'
    });

    console.log(`📋 updateTeamStatus: Found ${teamZoneAssignments.length} active zone assignments`);
    console.log(`📋 updateTeamStatus: Found ${scheduledAssignments.length} pending scheduled assignments`);

    // Team is ACTIVE if it has any zone assignments (active or scheduled)
    const hasZoneAssignment = teamZoneAssignments.length > 0 || scheduledAssignments.length > 0;
    const newStatus = hasZoneAssignment ? 'ACTIVE' : 'INACTIVE';
    
    console.log(`📋 updateTeamStatus: Has zone assignment: ${hasZoneAssignment}, New status: ${newStatus}`);
    
    if (newStatus !== team.status) {
      const updateOptions = session ? { session } : {};
      await Team.findByIdAndUpdate(teamId, { status: newStatus }, updateOptions);
      console.log(`✅ updateTeamStatus: Team ${team.name} (${teamId}) status updated to ${newStatus}`);
    } else {
      console.log(`✅ updateTeamStatus: Team ${team.name} (${teamId}) status unchanged: ${team.status}`);
    }
  } catch (error) {
    console.error('❌ updateTeamStatus: Error updating team status:', error);
  }
};

// Helper function to update team assignment status based on zone assignments
const updateTeamAssignmentStatus = async (teamId: string, session?: mongoose.ClientSession) => {
  try {
    console.log(`🔄 updateTeamAssignmentStatus: Starting for team ${teamId}`);
    const team = await Team.findById(teamId);
    if (!team) {
      console.log(`❌ updateTeamAssignmentStatus: Team ${teamId} not found`);
      return;
    }

    console.log(`📋 updateTeamAssignmentStatus: Current assignment status for ${team.name}: ${team.assignmentStatus}`);

    // Check if team has any active zone assignments (exclude COMPLETED and CANCELLED)
    const activeZoneAssignments = await AgentZoneAssignment.find({
      teamId: teamId,
      status: { $nin: ['COMPLETED', 'CANCELLED'] },
      effectiveTo: null
    });

    // Check if team has any PENDING scheduled assignments
    const scheduledAssignments = await ScheduledAssignment.find({
      teamId: teamId,
      status: 'PENDING'
    });

    console.log(`📋 updateTeamAssignmentStatus: Found ${activeZoneAssignments.length} active zone assignments`);
    console.log(`📋 updateTeamAssignmentStatus: Found ${scheduledAssignments.length} pending scheduled assignments`);

    // Team is ASSIGNED if it has any zone assignments (active or scheduled)
    const hasZoneAssignment = activeZoneAssignments.length > 0 || scheduledAssignments.length > 0;
    const newAssignmentStatus = hasZoneAssignment ? 'ASSIGNED' : 'UNASSIGNED';

    console.log(`📋 updateTeamAssignmentStatus: Has zone assignment: ${hasZoneAssignment}, New assignment status: ${newAssignmentStatus}`);

    if (newAssignmentStatus !== team.assignmentStatus) {
      const updateOptions = session ? { session } : {};
      await Team.findByIdAndUpdate(teamId, { assignmentStatus: newAssignmentStatus }, updateOptions);
      console.log(`✅ updateTeamAssignmentStatus: Team ${team.name} (${teamId}) assignment status updated to ${newAssignmentStatus}`);
    } else {
      console.log(`✅ updateTeamAssignmentStatus: Team ${team.name} (${teamId}) assignment status unchanged: ${team.assignmentStatus}`);
    }
  } catch (error) {
    console.error('❌ updateTeamAssignmentStatus: Error updating team assignment status:', error);
  }
};

// Helper function to update user assignment status based on zone assignments
const updateUserAssignmentStatus = async (userId: string, session?: mongoose.ClientSession) => {
  try {
    console.log(`🔄 updateUserAssignmentStatus: Starting for user ${userId}`);
    const user = await User.findById(userId);
    if (!user || user.role !== 'AGENT') {
      console.log(`❌ updateUserAssignmentStatus: User ${userId} not found or not an agent`);
      return;
    }

    console.log(`📋 updateUserAssignmentStatus: Current assignment status for ${user.name}: ${user.assignmentStatus}`);

    // Check individual zone assignments (exclude COMPLETED and CANCELLED)
    const individualZoneAssignments = await AgentZoneAssignment.find({
      agentId: user._id,
      status: { $nin: ['COMPLETED', 'CANCELLED'] },
      effectiveTo: null
    });

    // Check team zone assignments (exclude COMPLETED and CANCELLED)
    const teamZoneAssignments = await AgentZoneAssignment.find({
      teamId: { $in: user.teamIds },
      status: { $nin: ['COMPLETED', 'CANCELLED'] },
      effectiveTo: null
    });

    // Check PENDING scheduled assignments (individual)
    const pendingIndividualScheduledAssignments = await ScheduledAssignment.find({
      agentId: user._id,
      status: 'PENDING'
    });

    // Check PENDING scheduled assignments (team)
    const pendingTeamScheduledAssignments = await ScheduledAssignment.find({
      teamId: { $in: user.teamIds },
      status: 'PENDING'
    });

    console.log(`📋 updateUserAssignmentStatus: Found ${individualZoneAssignments.length} individual zone assignments`);
    console.log(`📋 updateUserAssignmentStatus: Found ${teamZoneAssignments.length} team zone assignments`);
    console.log(`📋 updateUserAssignmentStatus: Found ${pendingIndividualScheduledAssignments.length} pending individual scheduled assignments`);
    console.log(`📋 updateUserAssignmentStatus: Found ${pendingTeamScheduledAssignments.length} pending team scheduled assignments`);

    // User is ASSIGNED if they have any zone assignments (active or scheduled)
    const hasZoneAssignment = individualZoneAssignments.length > 0 || 
                             teamZoneAssignments.length > 0 ||
                             pendingIndividualScheduledAssignments.length > 0 ||
                             pendingTeamScheduledAssignments.length > 0;

    const newAssignmentStatus = hasZoneAssignment ? 'ASSIGNED' : 'UNASSIGNED';
    
    console.log(`📋 updateUserAssignmentStatus: Has zone assignment: ${hasZoneAssignment}, New assignment status: ${newAssignmentStatus}`);
    
    if (newAssignmentStatus !== user.assignmentStatus) {
      const updateOptions = session ? { session } : {};
      await User.findByIdAndUpdate(userId, { assignmentStatus: newAssignmentStatus }, updateOptions);
      console.log(`✅ updateUserAssignmentStatus: User ${user.name} (${userId}) assignment status updated to ${newAssignmentStatus}`);
    } else {
      console.log(`✅ updateUserAssignmentStatus: User ${user.name} (${userId}) assignment status unchanged: ${user.assignmentStatus}`);
    }
  } catch (error) {
    console.error('❌ updateUserAssignmentStatus: Error updating user assignment status:', error);
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
            zoneId: zone._id,
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
          zoneId: zone._id,
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
          const houseStatuses = Array.from(zone.buildingData.houseStatuses.values());
          const totalHouses = houseStatuses.length;
          const visitedHouses = houseStatuses.filter(house => house.status !== 'not-visited').length;
          
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
      const houseStatuses = Array.from(zone.buildingData.houseStatuses.values());
      const totalHouses = houseStatuses.length;
      const visitedHouses = houseStatuses.filter(house => house.status !== 'not-visited').length;
      
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
    const { name, description, boundary, buildingData, status, assignedAgentId, teamId, effectiveFrom, removeAssignment } = req.body;

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

    // Start a transaction for assignment updates
    const session = await mongoose.startSession();
    session.startTransaction();

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
        await Resident.deleteMany({ zoneId: id }, { session });
        
        // Create new residents if building data is provided
        if (processedBuildingData && processedBuildingData.addresses.length > 0) {
          const residents = processedBuildingData.addresses.map((address, index) => {
            const coordinates = processedBuildingData.coordinates[index];
            const houseNumber = extractHouseNumber(address);
            
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

          await Resident.insertMany(residents, { session });
        }
      }

      // 1. Deactivate existing assignments for this zone
      await AgentZoneAssignment.updateMany(
        { zoneId: id, status: 'ACTIVE' },
        { status: 'INACTIVE', effectiveTo: new Date() },
        { session }
      );

      // Cancel any pending scheduled assignments for this zone
      await ScheduledAssignment.updateMany(
        { zoneId: id, status: 'PENDING' },
        { status: 'CANCELLED' },
        { session }
      );

      // Handle assignment updates
      if (removeAssignment) {
        // 2. Remove all assignments - set to DRAFT status
        updateData.assignedAgentId = null;
        updateData.teamId = null;
        updateData.status = 'DRAFT';
        
        // 3. Remove zone from all users who were assigned to this zone
        await User.updateMany(
          { $or: [{ primaryZoneId: id }, { zoneIds: id }] },
          { 
            $unset: { primaryZoneId: 1 },
            $pull: { zoneIds: id }
          },
          { session }
        );
        
             } else if (assignedAgentId) {
         // 2. Validate agent exists
         const agent = await User.findById(assignedAgentId);
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
              status: 'PENDING' as const
            };

            await ScheduledAssignment.create(scheduledAssignmentData);
           
           // Update zone status to SCHEDULED
           updateData.assignedAgentId = assignedAgentId;
           updateData.teamId = null;
           updateData.status = 'SCHEDULED';
         } else {
           // Create immediate assignment
           const assignmentData = {
             agentId: assignedAgentId,
             zoneId: id,
             assignedBy: req.user?.id,
             effectiveFrom: effectiveDate,
             status: 'ACTIVE' as const
           };

           await AgentZoneAssignment.create(assignmentData);
           
           // Update zone status to ACTIVE if it was in DRAFT
           if (zone.status === 'DRAFT') {
             updateData.assignedAgentId = assignedAgentId;
             updateData.teamId = null;
             updateData.status = 'ACTIVE';
           }
         }

         // 5. Update user fields (same as createAssignment)
         await User.findByIdAndUpdate(assignedAgentId, {
           primaryZoneId: id,
           $addToSet: { zoneIds: id }
         }, { session });
         
       } else if (teamId) {
         // 2. Validate team exists
         const team = await Team.findById(teamId);
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
             await AgentZoneAssignment.insertMany(teamAssignments, { session });

             // Update user fields for all team members
             await User.updateMany(
               { _id: { $in: team.agentIds } },
               {
                 primaryZoneId: id,
                 $addToSet: { zoneIds: id }
               },
               { session }
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
        { new: true, runValidators: true, session }
      ).populate('teamId', 'name').populate('assignedAgentId', 'name email');

                          // 8. Sync all related data and recalculate statuses (same logic as createAssignment)
        if (assignedAgentId) {
          // Update individual agent status and zone fields (same as createAssignment)
          await updateAgentStatus(assignedAgentId, session);
          
          // Update agent's primaryZoneId (same as createAssignment)
          const agent = await User.findById(assignedAgentId);
          if (agent) {
            const updateData: any = {};
            
            // Always set latest assignment as primary for individual agents (same as createAssignment)
            updateData.primaryZoneId = id;
            
            // Update agent with new primary zone (same as createAssignment)
            await User.findByIdAndUpdate(assignedAgentId, updateData, { session });
            
            // Sync zoneIds with all current assignments (same as createAssignment)
            await syncAgentZoneIds(assignedAgentId, session);
          }
          
          // Update assignment status for the assigned agent
          await updateUserAssignmentStatus(assignedAgentId, session);
        } else if (teamId) {
          // Update team status if this is a team assignment (same as createAssignment)
          await updateTeamStatus(teamId, session);
          await updateTeamAssignmentStatus(teamId, session);
          
          // Update individual agent statuses and zone fields for all team members (same as createAssignment)
          const team = await Team.findById(teamId);
          if (team && team.agentIds) {
            for (const agentId of team.agentIds) {
              await updateAgentStatus(agentId.toString(), session);
              
              // Update agent's zone fields (same as createAssignment)
              const agent = await User.findById(agentId);
              if (agent) {
                const updateData: any = {};
                
                // Always set latest team assignment as primary for team members (same as createAssignment)
                updateData.primaryZoneId = id;
                
                // Update agent with new primary zone (same as createAssignment)
                await User.findByIdAndUpdate(agentId, updateData, { session });
                
                // Sync zoneIds with all current assignments (same as createAssignment)
                await syncAgentZoneIds(agentId.toString(), session);
              }
              
                           // Sync agent zoneIds and update assignment status for each team member
             await syncAgentZoneIds(agentId.toString(), session);
             await updateUserAssignmentStatus(agentId.toString(), session);
            }
          }
        } else if (removeAssignment) {
          // Update statuses for all users who were previously assigned to this zone
          const previouslyAssignedUsers = await User.find({
            $or: [{ primaryZoneId: id }, { zoneIds: id }]
          });
          
          for (const user of previouslyAssignedUsers) {
            await syncAgentZoneIds((user._id as any).toString(), session);
            await updateAgentStatus((user._id as any).toString(), session);
            await updateUserAssignmentStatus((user._id as any).toString(), session);
          }
        }

      await session.commitTransaction();

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
        const houseStatuses = Array.from(finalZone.buildingData.houseStatuses.values());
        const totalHouses = houseStatuses.length;
        const visitedHouses = houseStatuses.filter(house => house.status !== 'not-visited').length;
        
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

      res.json({
        success: true,
        message: 'Zone updated successfully',
        data: zoneData
      });
    } catch (error) {
      await session.abortTransaction();
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

    // Start a database transaction to ensure all deletions are atomic
    const session = await mongoose.startSession();
    session.startTransaction();
    console.log('🔄 deleteZone: Started database transaction');

    try {
      // Delete all associated data in the correct order to avoid foreign key constraint issues
      
      // 1. Delete all agent zone assignments for this zone (not just deactivate)
      const deletedZoneAssignments = await AgentZoneAssignment.deleteMany({ zoneId: id }, { session });
      console.log(`Deleted ${deletedZoneAssignments.deletedCount} agent zone assignments`);
      
      // 2. Agent team assignments are not zone-specific, so we don't delete them here
      // AgentTeamAssignment tracks team membership, not zone assignments
      
      // 3. Delete all scheduled assignments
      const deletedScheduled = await ScheduledAssignment.deleteMany({ zoneId: id }, { session });
      console.log(`Deleted ${deletedScheduled.deletedCount} scheduled assignments`);
      
      // 4. Delete all properties in this zone
      const deletedProperties = await Property.deleteMany({ zoneId: id }, { session });
      console.log(`Deleted ${deletedProperties.deletedCount} properties`);
      
      // 5. Delete all leads in this zone
      const deletedLeads = await Lead.deleteMany({ zoneId: id }, { session });
      console.log(`Deleted ${deletedLeads.deletedCount} leads`);
      
      // 6. Delete all activities in this zone
      const deletedActivities = await Activity.deleteMany({ zoneId: id }, { session });
      console.log(`Deleted ${deletedActivities.deletedCount} activities`);
      
      // 7. Delete all routes in this zone
      const deletedRoutes = await Route.deleteMany({ zoneId: id }, { session });
      console.log(`Deleted ${deletedRoutes.deletedCount} routes`);
      
      // 8. Delete all residents in this zone (CRITICAL - must be deleted)
      const deletedResidents = await Resident.deleteMany({ zoneId: id }, { session });
      console.log(`Deleted ${deletedResidents.deletedCount} residents for zone ${id}`);
      
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
      
      // 9. Finally, delete the zone itself
      await Zone.findByIdAndDelete(id, { session });

      // Commit the transaction
      await session.commitTransaction();
      console.log('✅ deleteZone: Database transaction committed successfully');

      // After successful deletion, update assignment status for affected users and teams
      // This is done outside the transaction to avoid long-running transactions
      console.log('🔄 deleteZone: Starting status updates for affected users and teams...');
      
      // Update assignment status for affected agents
      for (const agentId of affectedAgentIds) {
        console.log('👤 deleteZone: Updating assignment status for agent:', agentId);
        await updateUserAssignmentStatus(agentId as string);
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
          }
          console.log('✅ deleteZone: All team members assignment status updated');
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
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Validate zone ID
    if (!mongoose.Types.ObjectId.isValid(zoneId)) {
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
    const userId = req.user?._id;

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
  } catch (error) {
    console.error('Error getting all zones building stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get zones building statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
