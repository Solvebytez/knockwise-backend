"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLead = createLead;
exports.listLeads = listLeads;
exports.listMyLeads = listMyLeads;
exports.updateLeadStatus = updateLeadStatus;
const Lead_1 = __importDefault(require("../models/Lead"));
async function createLead(req, res) {
    const lead = await Lead_1.default.create({ ...req.body, lastActivityAt: new Date() });
    res.status(201).json(lead);
}
async function listLeads(_req, res) {
    const leads = await Lead_1.default.find().limit(100).sort({ createdAt: -1 });
    res.json(leads);
}
async function listMyLeads(req, res) {
    const agentId = req.user.sub;
    const leads = await Lead_1.default.find({ assignedAgentId: agentId }).sort({ updatedAt: -1 });
    res.json(leads);
}
async function updateLeadStatus(req, res) {
    const { status, notes } = req.body;
    const lead = await Lead_1.default.findByIdAndUpdate(req.params.id, {
        status,
        lastActivityAt: new Date(),
        $push: {
            history: { at: new Date(), by: req.user.sub, action: 'STATUS_CHANGED', status, notes },
        },
    }, { new: true });
    res.json(lead);
}
//# sourceMappingURL=lead.controller.js.map