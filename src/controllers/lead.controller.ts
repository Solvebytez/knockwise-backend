import { Request, Response } from 'express';
import Lead from '../models/Lead';
import { AuthRequest } from '../middleware/auth';

export async function createLead(req: AuthRequest, res: Response): Promise<void> {
  const lead = await Lead.create({ ...req.body, lastActivityAt: new Date() });
  res.status(201).json(lead);
}

export async function listLeads(_req: Request, res: Response): Promise<void> {
  const leads = await Lead.find().limit(100).sort({ createdAt: -1 });
  res.json(leads);
}

export async function listMyLeads(req: AuthRequest, res: Response): Promise<void> {
  const agentId = req.user!.sub;
  const leads = await Lead.find({ assignedAgentId: agentId }).sort({ updatedAt: -1 });
  res.json(leads);
}

export async function updateLeadStatus(req: AuthRequest, res: Response): Promise<void> {
  const { status, notes } = req.body as { status: string; notes?: string };
  const lead = await Lead.findByIdAndUpdate(
    req.params.id,
    {
      status,
      lastActivityAt: new Date(),
      $push: {
        history: { at: new Date(), by: req.user!.sub, action: 'STATUS_CHANGED', status, notes },
      },
    },
    { new: true }
  );
  res.json(lead);
}


