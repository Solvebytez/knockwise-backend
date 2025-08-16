"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAppointment = createAppointment;
exports.getAppointmentById = getAppointmentById;
exports.updateAppointment = updateAppointment;
exports.deleteAppointment = deleteAppointment;
exports.listAppointments = listAppointments;
exports.getMyAppointments = getMyAppointments;
exports.getTeamAppointments = getTeamAppointments;
const Appointment_1 = __importDefault(require("../models/Appointment"));
async function createAppointment(req, res) {
    const appt = await Appointment_1.default.create(req.body);
    res.status(201).json(appt);
}
async function getAppointmentById(req, res) {
    try {
        const { id } = req.params;
        const appointment = await Appointment_1.default.findById(id);
        if (!appointment) {
            res.status(404).json({ message: 'Appointment not found' });
            return;
        }
        res.json(appointment);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching appointment', error: error instanceof Error ? error.message : 'Unknown error' });
    }
}
async function updateAppointment(req, res) {
    try {
        const { id } = req.params;
        const appointment = await Appointment_1.default.findByIdAndUpdate(id, req.body, { new: true });
        if (!appointment) {
            res.status(404).json({ message: 'Appointment not found' });
            return;
        }
        res.json(appointment);
    }
    catch (error) {
        res.status(500).json({ message: 'Error updating appointment', error: error instanceof Error ? error.message : 'Unknown error' });
    }
}
async function deleteAppointment(req, res) {
    try {
        const { id } = req.params;
        const appointment = await Appointment_1.default.findByIdAndDelete(id);
        if (!appointment) {
            res.status(404).json({ message: 'Appointment not found' });
            return;
        }
        res.json({ message: 'Appointment deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ message: 'Error deleting appointment', error: error instanceof Error ? error.message : 'Unknown error' });
    }
}
async function listAppointments(req, res) {
    try {
        const appointments = await Appointment_1.default.find().sort({ start: 1 }).limit(100);
        res.json(appointments);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching appointments', error: error instanceof Error ? error.message : 'Unknown error' });
    }
}
async function getMyAppointments(req, res) {
    const agentId = req.user.sub;
    const upcoming = await Appointment_1.default.find({ agentId }).sort({ start: 1 }).limit(100);
    res.json(upcoming);
}
async function getTeamAppointments(req, res) {
    try {
        const { teamId } = req.query;
        const appointments = await Appointment_1.default.find({ teamId }).sort({ start: 1 }).limit(100);
        res.json(appointments);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching team appointments', error: error instanceof Error ? error.message : 'Unknown error' });
    }
}
//# sourceMappingURL=appointment.controller.js.map