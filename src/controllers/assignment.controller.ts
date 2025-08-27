import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import AgentZoneAssignment from '../models/AgentZoneAssignment';
import { ScheduledAssignmentService } from '../services/scheduledAssignmentService';
import { Zone } from '../models/Zone';
import { User } from '../models/User';
import { Team } from '../models/Team';
import { ScheduledAssignment } from '../models/ScheduledAssignment';
import { updateAgentStatus } from '../controllers/user.controller';

// Helper function to sync agent's zoneIds with all current assignments
export const syncAgentZoneIds = async (agentId: string) => {
  try {
    console.log(`\n🔄 syncAgentZoneIds: Starting for agent ${agentId}`);
    
    const agent = await User.findById(agentId);
    if (!agent) {
      console.log(`❌ syncAgentZoneIds: Agent ${agentId} not found`);
      return;
    }

    console.log(`📋 syncAgentZoneIds: Agent found: ${agent.name} (${agent._id})`);
    console.log(`📋 syncAgentZoneIds: Current zoneIds: [${agent.zoneIds.join(', ')}]`);
    console.log(`📋 syncAgentZoneIds: Current primaryZoneId: ${agent.primaryZoneId || 'None'}`);
    console.log(`📋 syncAgentZoneIds: Agent teamIds: [${agent.teamIds.join(', ')}]`);

    // Get all active assignments for this agent (individual and team-based)
    console.log(`🔍 syncAgentZoneIds: Checking for individual assignments...`);
    const individualAssignments = await AgentZoneAssignment.find({
      agentId: agentId,
      status: { $nin: ['COMPLETED', 'CANCELLED'] },
      effectiveTo: null
    }).populate('zoneId', '_id');
    console.log(`📋 syncAgentZoneIds: Found ${individualAssignments.length} individual assignments`);

    // Get team-based assignments for this agent's teams
    console.log(`🔍 syncAgentZoneIds: Checking for team assignments...`);
    const teamAssignments = await AgentZoneAssignment.find({
      $or: [
        { teamId: { $in: agent.teamIds }, status: { $nin: ['COMPLETED', 'CANCELLED'] }, effectiveTo: null },
        { agentId: agentId, teamId: { $exists: true, $ne: null }, status: { $nin: ['COMPLETED', 'CANCELLED'] }, effectiveTo: null }
      ]
    }).populate('zoneId', '_id');
    console.log(`📋 syncAgentZoneIds: Found ${teamAssignments.length} team assignments`);

    // Get PENDING scheduled individual assignments for this agent
    console.log(`🔍 syncAgentZoneIds: Checking for pending individual scheduled assignments...`);
    const individualScheduledAssignments = await ScheduledAssignment.find({
      agentId: agent._id,
      status: 'PENDING'
    }).populate('zoneId', '_id');
    console.log(`📋 syncAgentZoneIds: Found ${individualScheduledAssignments.length} individual scheduled assignments`);

    // Get PENDING scheduled team assignments for this agent's teams
    console.log(`🔍 syncAgentZoneIds: Checking for pending team scheduled assignments...`);
    const teamScheduledAssignments = await ScheduledAssignment.find({
      $or: [
        { teamId: { $in: agent.teamIds }, status: 'PENDING' },
        { agentId: agentId, teamId: { $exists: true, $ne: null }, status: 'PENDING' }
      ]
    }).populate('zoneId', '_id');
    console.log(`📋 syncAgentZoneIds: Found ${teamScheduledAssignments.length} team scheduled assignments`);

    // Combine all zone IDs from individual, team, and scheduled assignments
    const allZoneIds = [
      ...individualAssignments.map(a => a.zoneId._id.toString()),
      ...teamAssignments.map(a => a.zoneId._id.toString()),
      ...individualScheduledAssignments.map(a => a.zoneId._id.toString()),
      ...teamScheduledAssignments.map(a => a.zoneId._id.toString())
    ];

    // Remove duplicates
    const uniqueZoneIds = [...new Set(allZoneIds)];

    console.log(`📋 syncAgentZoneIds: Combined zone IDs: ${allZoneIds.length}, Unique zone IDs: ${uniqueZoneIds.length}`);
    console.log(`📋 syncAgentZoneIds: New zoneIds will be: [${uniqueZoneIds.join(', ')}]`);

    // Update the agent's zoneIds to match all current assignments
    console.log(`🔄 syncAgentZoneIds: Updating agent zoneIds...`);
    await User.findByIdAndUpdate(agentId, {
      zoneIds: uniqueZoneIds
    });

    console.log(`✅ syncAgentZoneIds: Synced zoneIds for agent ${agent.name}: ${uniqueZoneIds.length} zones`);
    console.log(`✅ syncAgentZoneIds: Completed for agent ${agent.name}\n`);
  } catch (error) {
    console.error('❌ syncAgentZoneIds: Error syncing agent zoneIds:', error);
  }
};

// Helper function to update team status based on zone assignments
export const updateTeamStatus = async (teamId: string) => {
  try {
    console.log(`\n🔄 updateTeamStatus: Starting for team ${teamId}`);
    const team = await Team.findById(teamId);
    if (!team) {
      console.log(`❌ updateTeamStatus: Team ${teamId} not found`);
      return;
    }

    console.log(`📋 updateTeamStatus: Team found: ${team.name} (${team._id})`);
    console.log(`📋 updateTeamStatus: Current status: ${team.status}`);
    console.log(`📋 updateTeamStatus: Current assignment status: ${team.assignmentStatus}`);
    console.log(`📋 updateTeamStatus: Agent count: ${team.agentIds?.length || 0}`);
    console.log(`📋 updateTeamStatus: Agent count: ${team.agentIds?.length || 0}`);

    // Check if team has any zone assignments (exclude COMPLETED and CANCELLED)
    console.log(`🔍 updateTeamStatus: Checking for active zone assignments...`);
    const teamZoneAssignments = await AgentZoneAssignment.find({
      $or: [
        { teamId: teamId, status: { $nin: ['COMPLETED', 'CANCELLED'] }, effectiveTo: null },
        { agentId: { $in: team.agentIds }, teamId: { $exists: true, $ne: null }, status: { $nin: ['COMPLETED', 'CANCELLED'] }, effectiveTo: null }
      ]
    });
    console.log(`📋 updateTeamStatus: Found ${teamZoneAssignments.length} active zone assignments`);

    // Check if team has any PENDING scheduled assignments
    console.log(`🔍 updateTeamStatus: Checking for pending scheduled assignments...`);
    const scheduledAssignments = await ScheduledAssignment.find({
      $or: [
        { teamId: teamId, status: 'PENDING' },
        { agentId: { $in: team.agentIds }, teamId: { $exists: true, $ne: null }, status: 'PENDING' }
      ]
    });
    console.log(`📋 updateTeamStatus: Found ${scheduledAssignments.length} pending scheduled assignments`);

    // Team is ACTIVE if it has any zone assignments (active or scheduled)
    const hasZoneAssignment = teamZoneAssignments.length > 0 || scheduledAssignments.length > 0;
    const newStatus = hasZoneAssignment ? 'ACTIVE' : 'INACTIVE';
    
    console.log(`📋 updateTeamStatus: Has zone assignment: ${hasZoneAssignment}`);
    console.log(`📋 updateTeamStatus: Current status: ${team.status}`);
    console.log(`📋 updateTeamStatus: New status: ${newStatus}`);
    console.log(`📋 updateTeamStatus: Status change needed: ${newStatus !== team.status}`);
    
    if (newStatus !== team.status) {
      console.log(`🔄 updateTeamStatus: Updating team status from ${team.status} to ${newStatus}...`);
      await Team.findByIdAndUpdate(teamId, { status: newStatus });
      console.log(`✅ updateTeamStatus: Team ${team.name} (${teamId}) status updated to ${newStatus}`);
    } else {
      console.log(`✅ updateTeamStatus: Team ${team.name} (${teamId}) status unchanged: ${team.status}`);
    }
    console.log(`✅ updateTeamStatus: Completed for team ${team.name}\n`);
  } catch (error) {
    console.error('❌ updateTeamStatus: Error updating team status:', error);
  }
};

// Helper function to update team assignment status based on zone assignments
export const updateTeamAssignmentStatus = async (teamId: string) => {
  try {
    console.log(`\n🔄 updateTeamAssignmentStatus: Starting for team ${teamId}`);
    const team = await Team.findById(teamId);
    if (!team) {
      console.log(`❌ updateTeamAssignmentStatus: Team ${teamId} not found`);
      return;
    }

    console.log(`📋 updateTeamAssignmentStatus: Team found: ${team.name} (${team._id})`);
    console.log(`📋 updateTeamAssignmentStatus: Current status: ${team.status}`);
    console.log(`📋 updateTeamAssignmentStatus: Current assignment status: ${team.assignmentStatus}`);
    console.log(`📋 updateTeamAssignmentStatus: Agent count: ${team.agentIds?.length || 0}`);
    console.log(`📋 updateTeamAssignmentStatus: Agent count: ${team.agentIds?.length || 0}`);

    // Check if team has any active zone assignments (exclude COMPLETED and CANCELLED)
    console.log(`🔍 updateTeamAssignmentStatus: Checking for active zone assignments...`);
    const activeZoneAssignments = await AgentZoneAssignment.find({
      $or: [
        { teamId: teamId, status: { $nin: ['COMPLETED', 'CANCELLED'] }, effectiveTo: null },
        { agentId: { $in: team.agentIds }, teamId: { $exists: true, $ne: null }, status: { $nin: ['COMPLETED', 'CANCELLED'] }, effectiveTo: null }
      ]
    });
    console.log(`📋 updateTeamAssignmentStatus: Found ${activeZoneAssignments.length} active zone assignments`);

    // Check if team has any PENDING scheduled assignments
    console.log(`🔍 updateTeamAssignmentStatus: Checking for pending scheduled assignments...`);
    const scheduledAssignments = await ScheduledAssignment.find({
      $or: [
        { teamId: teamId, status: 'PENDING' },
        { agentId: { $in: team.agentIds }, teamId: { $exists: true, $ne: null }, status: 'PENDING' }
      ]
    });
    console.log(`📋 updateTeamAssignmentStatus: Found ${scheduledAssignments.length} pending scheduled assignments`);

    // Team is ASSIGNED if it has any zone assignments (active or scheduled)
    const hasZoneAssignment = activeZoneAssignments.length > 0 || scheduledAssignments.length > 0;
    const newAssignmentStatus = hasZoneAssignment ? 'ASSIGNED' : 'UNASSIGNED';

    console.log(`📋 updateTeamAssignmentStatus: Has zone assignment: ${hasZoneAssignment}`);
    console.log(`📋 updateTeamAssignmentStatus: Current assignment status: ${team.assignmentStatus}`);
    console.log(`📋 updateTeamAssignmentStatus: New assignment status: ${newAssignmentStatus}`);
    console.log(`📋 updateTeamAssignmentStatus: Assignment status change needed: ${newAssignmentStatus !== team.assignmentStatus}`);

    if (newAssignmentStatus !== team.assignmentStatus) {
      console.log(`🔄 updateTeamAssignmentStatus: Updating team assignment status from ${team.assignmentStatus} to ${newAssignmentStatus}...`);
      await Team.findByIdAndUpdate(teamId, { assignmentStatus: newAssignmentStatus });
      console.log(`✅ updateTeamAssignmentStatus: Team ${team.name} (${teamId}) assignment status updated to ${newAssignmentStatus}`);
    } else {
      console.log(`✅ updateTeamAssignmentStatus: Team ${team.name} (${teamId}) assignment status unchanged: ${team.assignmentStatus}`);
    }
    console.log(`✅ updateTeamAssignmentStatus: Completed for team ${team.name}\n`);
  } catch (error) {
    console.error('❌ updateTeamAssignmentStatus: Error updating team assignment status:', error);
  }
};

// Helper function to update user assignment status based on zone assignments
export const updateUserAssignmentStatus = async (userId: string) => {
  try {
    console.log(`\n🔄 updateUserAssignmentStatus: Starting for user ${userId}`);
    const user = await User.findById(userId);
    if (!user || user.role !== 'AGENT') {
      console.log(`❌ updateUserAssignmentStatus: User ${userId} not found or not an agent`);
      return;
    }

    console.log(`📋 updateUserAssignmentStatus: User found: ${user.name} (${user._id})`);
    console.log(`📋 updateUserAssignmentStatus: Current status: ${user.status}`);
    console.log(`📋 updateUserAssignmentStatus: Current assignment status: ${user.assignmentStatus}`);
    console.log(`📋 updateUserAssignmentStatus: Zone count: ${user.zoneIds?.length || 0}`);
    console.log(`📋 updateUserAssignmentStatus: Team count: ${user.teamIds?.length || 0}`);
    console.log(`📋 updateUserAssignmentStatus: Primary zone: ${user.primaryZoneId || 'None'}`);

    // Check individual zone assignments (exclude COMPLETED and CANCELLED)
    console.log(`🔍 updateUserAssignmentStatus: Checking for individual zone assignments...`);
    const individualZoneAssignments = await AgentZoneAssignment.find({
      agentId: user._id,
      status: { $nin: ['COMPLETED', 'CANCELLED'] },
      effectiveTo: null
    });
    console.log(`📋 updateUserAssignmentStatus: Found ${individualZoneAssignments.length} individual zone assignments`);

    // Check team zone assignments (exclude COMPLETED and CANCELLED)
    console.log(`🔍 updateUserAssignmentStatus: Checking for team zone assignments...`);
    const teamZoneAssignments = await AgentZoneAssignment.find({
      $or: [
        { teamId: { $in: user.teamIds }, status: { $nin: ['COMPLETED', 'CANCELLED'] }, effectiveTo: null },
        { agentId: user._id, teamId: { $exists: true, $ne: null }, status: { $nin: ['COMPLETED', 'CANCELLED'] }, effectiveTo: null }
      ]
    });
    console.log(`📋 updateUserAssignmentStatus: Found ${teamZoneAssignments.length} team zone assignments`);

    // Check PENDING scheduled assignments (individual)
    console.log(`🔍 updateUserAssignmentStatus: Checking for pending individual scheduled assignments...`);
    const pendingIndividualScheduledAssignments = await ScheduledAssignment.find({
      agentId: user._id,
      status: 'PENDING'
    });
    console.log(`📋 updateUserAssignmentStatus: Found ${pendingIndividualScheduledAssignments.length} pending individual scheduled assignments`);

    // Check PENDING scheduled assignments (team)
    console.log(`🔍 updateUserAssignmentStatus: Checking for pending team scheduled assignments...`);
    const pendingTeamScheduledAssignments = await ScheduledAssignment.find({
      $or: [
        { teamId: { $in: user.teamIds }, status: 'PENDING' },
        { agentId: user._id, teamId: { $exists: true, $ne: null }, status: 'PENDING' }
      ]
    });
    console.log(`📋 updateUserAssignmentStatus: Found ${pendingTeamScheduledAssignments.length} pending team scheduled assignments`);

    // User is ASSIGNED if they have any zone assignments (active or scheduled)
    const hasZoneAssignment = individualZoneAssignments.length > 0 || 
                             teamZoneAssignments.length > 0 ||
                             pendingIndividualScheduledAssignments.length > 0 ||
                             pendingTeamScheduledAssignments.length > 0;

    const newAssignmentStatus = hasZoneAssignment ? 'ASSIGNED' : 'UNASSIGNED';
    
    console.log(`📋 updateUserAssignmentStatus: Has zone assignment: ${hasZoneAssignment}`);
    console.log(`📋 updateUserAssignmentStatus: Current assignment status: ${user.assignmentStatus}`);
    console.log(`📋 updateUserAssignmentStatus: New assignment status: ${newAssignmentStatus}`);
    console.log(`📋 updateUserAssignmentStatus: Assignment status change needed: ${newAssignmentStatus !== user.assignmentStatus}`);
    
    // Determine new primaryZoneId based on assignments
    let newPrimaryZoneId = null;
    if (hasZoneAssignment) {
      // Priority: individual assignments > team assignments > scheduled assignments
      if (individualZoneAssignments.length > 0) {
        newPrimaryZoneId = individualZoneAssignments[0]?.zoneId || null;
      } else if (teamZoneAssignments.length > 0) {
        newPrimaryZoneId = teamZoneAssignments[0]?.zoneId || null;
      } else if (pendingIndividualScheduledAssignments.length > 0) {
        newPrimaryZoneId = pendingIndividualScheduledAssignments[0]?.zoneId || null;
      } else if (pendingTeamScheduledAssignments.length > 0) {
        newPrimaryZoneId = pendingTeamScheduledAssignments[0]?.zoneId || null;
      }
    }
    
    console.log(`📋 updateUserAssignmentStatus: Current primaryZoneId: ${user.primaryZoneId || 'None'}`);
    console.log(`📋 updateUserAssignmentStatus: New primaryZoneId: ${newPrimaryZoneId || 'None'}`);
    console.log(`📋 updateUserAssignmentStatus: PrimaryZoneId change needed: ${newPrimaryZoneId?.toString() !== user.primaryZoneId?.toString()}`);
    
    // Prepare update object
    const updateData: any = {};
    let hasChanges = false;
    
    if (newAssignmentStatus !== user.assignmentStatus) {
      updateData.assignmentStatus = newAssignmentStatus;
      hasChanges = true;
    }
    
    if (newPrimaryZoneId?.toString() !== user.primaryZoneId?.toString()) {
      updateData.primaryZoneId = newPrimaryZoneId;
      hasChanges = true;
    }
    
    if (hasChanges) {
      console.log(`🔄 updateUserAssignmentStatus: Updating user data...`);
      await User.findByIdAndUpdate(userId, updateData);
      console.log(`✅ updateUserAssignmentStatus: User ${user.name} (${userId}) updated:`, updateData);
    } else {
      console.log(`✅ updateUserAssignmentStatus: User ${user.name} (${userId}) no changes needed`);
    }
    console.log(`✅ updateUserAssignmentStatus: Completed for user ${user.name}\n`);
  } catch (error) {
    console.error('❌ updateUserAssignmentStatus: Error updating user assignment status:', error);
  }
};

export async function createAssignment(req: AuthRequest, res: Response): Promise<void> {
  try {
    const payload = { ...req.body, assignedBy: req.user!.sub };

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
    const zone = await Zone.findById(payload.zoneId);
    if (!zone) {
      res.status(404).json({
        success: false,
        message: 'Zone not found'
      });
      return;
    }

    // Validate agent or team exists
    if (payload.agentId) {
      const agent = await User.findById(payload.agentId);
      if (!agent || agent.role !== 'AGENT') {
        res.status(404).json({
          success: false,
          message: 'Agent not found or is not an agent'
        });
        return;
      }
    }

    if (payload.teamId) {
      const team = await Team.findById(payload.teamId);
      if (!team) {
        res.status(404).json({
          success: false,
          message: 'Team not found'
        });
        return;
      }
    }

    // Deactivate any existing active assignments for this zone
    await AgentZoneAssignment.updateMany(
      { 
        zoneId: payload.zoneId, 
        status: 'ACTIVE',
        $or: [
          { effectiveTo: { $exists: false } },
          { effectiveTo: null },
          { effectiveTo: { $gt: new Date() } }
        ]
      },
      { 
        status: 'INACTIVE', 
        effectiveTo: new Date() 
      }
    );

    const effectiveFrom = new Date(payload.effectiveFrom);
    const now = new Date();
    
    // Check if this is a future assignment
    if (effectiveFrom > now) {
      // Create a scheduled assignment
      const scheduledAssignment = await ScheduledAssignmentService.createScheduledAssignment({
        agentId: payload.agentId,
        teamId: payload.teamId,
        zoneId: payload.zoneId,
        scheduledDate: effectiveFrom,
        effectiveFrom: effectiveFrom,
        assignedBy: req.user!.sub
      });

      // Update zone status to SCHEDULED if it was in DRAFT
      if (zone.status === 'DRAFT') {
        await Zone.findByIdAndUpdate(payload.zoneId, { 
          status: 'SCHEDULED',
          ...(payload.agentId ? { assignedAgentId: payload.agentId } : {}),
          ...(payload.teamId ? { teamId: payload.teamId } : {})
        });
        console.log('✅ Updated zone status from DRAFT to SCHEDULED');
      }

      // Update agent/team status for scheduled assignments
      if (payload.agentId) {
        console.log('👤 createAssignment: Updating individual agent status...');
        await updateAgentStatus(payload.agentId);
        await updateUserAssignmentStatus(payload.agentId);
      }
      if (payload.teamId) {
        console.log('👥 createAssignment: Updating team status...');
        await updateTeamStatus(payload.teamId);
        await updateTeamAssignmentStatus(payload.teamId);
        
        // Also update assignment status and zoneIds for all team members
        console.log('👥 createAssignment: Fetching team to update member statuses...');
        const team = await Team.findById(payload.teamId);
        if (team && team.agentIds && team.agentIds.length > 0) {
          console.log(`👥 createAssignment: Found ${team.agentIds.length} team members to update`);
          for (const agentId of team.agentIds) {
            console.log(`👤 createAssignment: Updating assignment status for team member: ${agentId}`);
            await updateUserAssignmentStatus(agentId.toString());
            
            // Also sync zoneIds for team members to include scheduled assignments
            console.log(`👤 createAssignment: Syncing zoneIds for team member: ${agentId}`);
            await syncAgentZoneIds(agentId.toString());
          }
          console.log('✅ createAssignment: All team members assignment status and zoneIds updated');
        } else {
          console.log('⚠️ createAssignment: No team members found to update');
        }
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
    } else {
      // Create immediate assignment
      const assignmentData = {
        ...payload,
        effectiveFrom: now,
        status: 'ACTIVE' as const
      };

      const record = await AgentZoneAssignment.create(assignmentData);
      
      // Update zone status to ACTIVE if it was in DRAFT
      if (zone.status === 'DRAFT') {
        await Zone.findByIdAndUpdate(payload.zoneId, { 
          status: 'ACTIVE',
          ...(payload.agentId ? { assignedAgentId: payload.agentId } : {}),
          ...(payload.teamId ? { teamId: payload.teamId } : {})
        });
      }

      // Update team status if this is a team assignment
      if (payload.teamId) {
        await updateTeamStatus(payload.teamId);
        await updateTeamAssignmentStatus(payload.teamId);
        
        // Update individual agent statuses and zone fields for all team members
        const team = await Team.findById(payload.teamId);
        if (team && team.agentIds) {
          for (const agentId of team.agentIds) {
            await updateAgentStatus(agentId.toString());
            
            // Update agent's zone fields
            const agent = await User.findById(agentId);
            if (agent) {
              const updateData: any = {};
              
              // Always set latest team assignment as primary for team members
              updateData.primaryZoneId = payload.zoneId;
              
              // Update agent with new primary zone
              await User.findByIdAndUpdate(agentId, updateData);
              
              // Sync zoneIds with all current assignments
              await syncAgentZoneIds(agentId.toString());
            }
            
            // Update assignment status for each team member
            await updateUserAssignmentStatus(agentId.toString());
          }
        }
      }
      
      // Update individual agent status and zone fields if this is an individual assignment
      if (payload.agentId) {
        await updateAgentStatus(payload.agentId);
        
        // Update agent's primaryZoneId
        const agent = await User.findById(payload.agentId);
        if (agent) {
          const updateData: any = {};
          
          // Always set latest assignment as primary for individual agents
          updateData.primaryZoneId = payload.zoneId;
          
          // Update agent with new primary zone
          await User.findByIdAndUpdate(payload.agentId, updateData);
          
          // Sync zoneIds with all current assignments
          await syncAgentZoneIds(payload.agentId);
        }
        
        // Update assignment status for the individual agent
        await updateUserAssignmentStatus(payload.agentId);
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
  } catch (error) {
    console.error('Error creating assignment:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error creating assignment', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

export async function getAssignmentById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const assignment = await AgentZoneAssignment.findById(id);
    
    if (!assignment) {
      res.status(404).json({ message: 'Assignment not found' });
      return;
    }
    
    res.json(assignment);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching assignment', error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function updateAssignment(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const assignment = await AgentZoneAssignment.findByIdAndUpdate(id, req.body, { new: true });
    
    if (!assignment) {
      res.status(404).json({ message: 'Assignment not found' });
      return;
    }
    
    res.json(assignment);
  } catch (error) {
    res.status(500).json({ message: 'Error updating assignment', error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function deleteAssignment(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const assignment = await AgentZoneAssignment.findByIdAndDelete(id);
    
    if (!assignment) {
      res.status(404).json({ message: 'Assignment not found' });
      return;
    }
    
    res.json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting assignment', error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function listAssignments(_req: Request, res: Response): Promise<void> {
  const list = await AgentZoneAssignment.find().sort({ createdAt: -1 }).limit(200);
  res.json(list);
}

export async function getMyAssignments(req: AuthRequest, res: Response): Promise<void> {
  try {
    const agentId = req.user!.sub;
    const assignments = await AgentZoneAssignment.find({ agentId }).sort({ createdAt: -1 });
    res.json(assignments);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching my assignments', error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function getTeamAssignments(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { teamId } = req.query;
    const assignments = await AgentZoneAssignment.find({ teamId }).sort({ createdAt: -1 });
    res.json(assignments);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching team assignments', error: error instanceof Error ? error.message : 'Unknown error' });
  }
}


