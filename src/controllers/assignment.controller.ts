import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import AgentZoneAssignment from '../models/AgentZoneAssignment';
import { ScheduledAssignmentService } from '../services/scheduledAssignmentService';
import { Zone } from '../models/Zone';
import { User } from '../models/User';
import { Team } from '../models/Team';

export async function createAssignment(req: AuthRequest, res: Response): Promise<void> {
  try {
    const payload = { ...req.body, assignedBy: req.user!.sub };
    
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

      // Send scheduled assignment notifications
      await ScheduledAssignmentService.sendScheduledAssignmentNotifications(scheduledAssignment);
      
      // Send socket notifications
      await ScheduledAssignmentService.sendScheduledAssignmentSocketNotifications(scheduledAssignment);

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


