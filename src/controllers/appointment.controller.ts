import { Response } from 'express';
import Appointment from '../models/Appointment';
import { AuthRequest } from '../middleware/auth';

export async function createAppointment(req: AuthRequest, res: Response): Promise<void> {
  const appt = await Appointment.create(req.body);
  res.status(201).json(appt);
}

export async function getAppointmentById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findById(id);
    
    if (!appointment) {
      res.status(404).json({ message: 'Appointment not found' });
      return;
    }
    
    res.json(appointment);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching appointment', error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function updateAppointment(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findByIdAndUpdate(id, req.body, { new: true });
    
    if (!appointment) {
      res.status(404).json({ message: 'Appointment not found' });
      return;
    }
    
    res.json(appointment);
  } catch (error) {
    res.status(500).json({ message: 'Error updating appointment', error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function deleteAppointment(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findByIdAndDelete(id);
    
    if (!appointment) {
      res.status(404).json({ message: 'Appointment not found' });
      return;
    }
    
    res.json({ message: 'Appointment deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting appointment', error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function listAppointments(req: AuthRequest, res: Response): Promise<void> {
  try {
    const appointments = await Appointment.find().sort({ start: 1 }).limit(100);
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching appointments', error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function getMyAppointments(req: AuthRequest, res: Response): Promise<void> {
  const agentId = req.user!.sub;
  const upcoming = await Appointment.find({ agentId }).sort({ start: 1 }).limit(100);
  res.json(upcoming);
}

export async function getTeamAppointments(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { teamId } = req.query;
    const appointments = await Appointment.find({ teamId }).sort({ start: 1 }).limit(100);
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching team appointments', error: error instanceof Error ? error.message : 'Unknown error' });
  }
}


