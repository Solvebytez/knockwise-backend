import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import AgentZoneAssignment from '../models/AgentZoneAssignment';

export async function createAssignment(req: AuthRequest, res: Response): Promise<void> {
  const payload = { ...req.body, createdById: req.user!.sub };
  const record = await AgentZoneAssignment.create(payload);
  res.status(201).json(record);
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


