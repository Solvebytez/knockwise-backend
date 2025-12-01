import { Request, Response } from 'express';
import Lead from '../models/Lead';
import { AuthRequest } from '../middleware/auth';

export async function createLead(req: AuthRequest, res: Response): Promise<void> {
  const agentId = req.user!.sub || req.user!.id;
  
  console.log("📝 [createLead] Creating lead with:", {
    agentId,
    body: req.body,
  });
  
  // Auto-assign to current agent if not specified
  const leadData = {
    ...req.body,
    assignedAgentId: req.body.assignedAgentId || agentId,
    lastActivityAt: new Date(),
  };
  
  const lead = await Lead.create(leadData);
  
  console.log("✅ [createLead] Lead created:", {
    leadId: lead._id,
    assignedAgentId: lead.assignedAgentId,
  });
  
  res.status(201).json(lead);
}

export async function listLeads(_req: Request, res: Response): Promise<void> {
  const leads = await Lead.find().limit(100).sort({ createdAt: -1 });
  res.json(leads);
}

export async function listMyLeads(req: AuthRequest, res: Response): Promise<void> {
  const agentId = req.user!.sub || req.user!.id;
  
  console.log("📝 [listMyLeads] Fetching leads for agent:", agentId);
  
  const leads = await Lead.find({ assignedAgentId: agentId }).sort({ updatedAt: -1 });
  
  console.log("✅ [listMyLeads] Found leads:", leads.length);
  
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


