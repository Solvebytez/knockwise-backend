import { ScheduledAssignment } from '../models/ScheduledAssignment';
import { AgentZoneAssignment } from '../models/AgentZoneAssignment';
import { User } from '../models/User';
import { Team } from '../models/Team';
import { Zone } from '../models/Zone';
import { EmailService } from './emailService';
import { SocketService } from './socketService';

export class ScheduledAssignmentService {
  
  /**
   * Create a scheduled assignment
   */
  static async createScheduledAssignment(data: {
    agentId?: string;
    teamId?: string;
    zoneId: string;
    scheduledDate: Date;
    effectiveFrom: Date;
    assignedBy: string;
  }) {
    try {
      const scheduledAssignment = new ScheduledAssignment({
        ...data,
        status: 'PENDING',
        notificationSent: false
      });

      await scheduledAssignment.save();
      return scheduledAssignment;
    } catch (error) {
      console.error('Error creating scheduled assignment:', error);
      throw error;
    }
  }

  /**
   * Activate pending assignments that have reached their scheduled date
   */
  static async activatePendingAssignments() {
    try {
      const now = new Date();
      
      // Find all pending assignments that should be activated
      const pendingAssignments = await ScheduledAssignment.find({
        status: 'PENDING',
        scheduledDate: { $lte: now }
      }).populate('zoneId', 'name');

      console.log(`Found ${pendingAssignments.length} pending assignments to activate`);

      for (const assignment of pendingAssignments) {
        try {
          // Create the actual assignment
          const actualAssignment = new AgentZoneAssignment({
            agentId: assignment.agentId,
            teamId: assignment.teamId,
            zoneId: assignment.zoneId,
            effectiveFrom: assignment.effectiveFrom,
            status: 'ACTIVE',
            assignedBy: assignment.assignedBy
          });

          await actualAssignment.save();

          // Update scheduled assignment status
          assignment.status = 'ACTIVATED';
          assignment.notificationSent = true;
          await assignment.save();

          // Send notifications
          await this.sendAssignmentNotifications(assignment);
          
          // Send socket notifications
          await this.sendAssignmentSocketNotifications(assignment);

          console.log(`Activated assignment for zone: ${assignment.zoneId.name}`);
        } catch (error) {
          console.error(`Error activating assignment ${assignment._id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error activating pending assignments:', error);
    }
  }

  /**
   * Send notifications for activated assignments
   */
  static async sendAssignmentNotifications(assignment: any) {
    try {
      const zone = await Zone.findById(assignment.zoneId).select('name');
      
      if (assignment.agentId) {
        // Individual agent assignment
        const agent = await User.findById(assignment.agentId).select('name email');
        if (agent) {
          const template = EmailService.generateTerritoryAssignmentTemplate({
            zoneName: zone?.name || 'Unknown Zone',
            effectiveFrom: assignment.effectiveFrom,
            assignmentId: assignment._id.toString(),
            isTeamAssignment: false
          });
          
          await EmailService.sendEmail(agent.email, template);
        }
      } else if (assignment.teamId) {
        // Team assignment
        const team = await Team.findById(assignment.teamId)
          .populate('agentIds', 'name email')
          .select('name agentIds');
        
        if (team && team.agentIds) {
          const template = EmailService.generateTerritoryAssignmentTemplate({
            zoneName: zone?.name || 'Unknown Zone',
            effectiveFrom: assignment.effectiveFrom,
            assignmentId: assignment._id.toString(),
            isTeamAssignment: true,
            teamName: team.name
          });
          
          for (const agent of team.agentIds) {
            await EmailService.sendEmail(agent.email, template);
          }
        }
      }
    } catch (error) {
      console.error('Error sending assignment notifications:', error);
    }
  }

  /**
   * Send scheduled assignment notifications
   */
  static async sendScheduledAssignmentNotifications(assignment: any) {
    try {
      const zone = await Zone.findById(assignment.zoneId).select('name');
      
      if (assignment.agentId) {
        // Individual agent assignment
        const agent = await User.findById(assignment.agentId).select('name email');
        if (agent) {
          const template = EmailService.generateScheduledAssignmentTemplate({
            zoneName: zone?.name || 'Unknown Zone',
            scheduledDate: assignment.scheduledDate,
            assignmentId: assignment._id.toString(),
            isTeamAssignment: false
          });
          
          await EmailService.sendEmail(agent.email, template);
        }
      } else if (assignment.teamId) {
        // Team assignment
        const team = await Team.findById(assignment.teamId)
          .populate('agentIds', 'name email')
          .select('name agentIds');
        
        if (team && team.agentIds) {
          const template = EmailService.generateScheduledAssignmentTemplate({
            zoneName: zone?.name || 'Unknown Zone',
            scheduledDate: assignment.scheduledDate,
            assignmentId: assignment._id.toString(),
            isTeamAssignment: true,
            teamName: team.name
          });
          
          for (const agent of team.agentIds) {
            await EmailService.sendEmail(agent.email, template);
          }
        }
      }
    } catch (error) {
      console.error('Error sending scheduled assignment notifications:', error);
    }
  }

  /**
   * Get scheduled assignments for a user or team
   */
  static async getScheduledAssignments(filters: {
    agentId?: string;
    teamId?: string;
    status?: string;
  }) {
    try {
      const query: any = {};
      
      if (filters.agentId) query.agentId = filters.agentId;
      if (filters.teamId) query.teamId = filters.teamId;
      if (filters.status) query.status = filters.status;

      const assignments = await ScheduledAssignment.find(query)
        .populate('zoneId', 'name')
        .populate('agentId', 'name email')
        .populate('teamId', 'name')
        .sort({ scheduledDate: 1 });

      return assignments;
    } catch (error) {
      console.error('Error getting scheduled assignments:', error);
      throw error;
    }
  }

  /**
   * Cancel a scheduled assignment
   */
  static async cancelScheduledAssignment(assignmentId: string) {
    try {
      const assignment = await ScheduledAssignment.findByIdAndUpdate(
        assignmentId,
        { status: 'CANCELLED' },
        { new: true }
      );

      return assignment;
    } catch (error) {
      console.error('Error cancelling scheduled assignment:', error);
      throw error;
    }
  }

  /**
   * Send assignment socket notifications
   */
  static async sendAssignmentSocketNotifications(assignment: any) {
    try {
      const zone = await Zone.findById(assignment.zoneId).select('name');
      
      if (assignment.agentId) {
        // Individual agent assignment
        SocketService.sendAssignmentActivatedNotification({
          userId: assignment.agentId.toString(),
          zoneName: zone?.name || 'Unknown Zone',
          effectiveFrom: assignment.effectiveFrom,
          assignmentId: assignment._id.toString(),
          isTeamAssignment: false
        });
      } else if (assignment.teamId) {
        // Team assignment
        SocketService.sendAssignmentActivatedNotification({
          userId: '', // Not needed for team notifications
          zoneName: zone?.name || 'Unknown Zone',
          effectiveFrom: assignment.effectiveFrom,
          assignmentId: assignment._id.toString(),
          isTeamAssignment: true,
          teamId: assignment.teamId.toString()
        });
      }
    } catch (error) {
      console.error('Error sending assignment socket notifications:', error);
    }
  }

  /**
   * Send scheduled assignment socket notifications
   */
  static async sendScheduledAssignmentSocketNotifications(assignment: any) {
    try {
      const zone = await Zone.findById(assignment.zoneId).select('name');
      
      if (assignment.agentId) {
        // Individual agent assignment
        SocketService.sendScheduledAssignmentNotification({
          userId: assignment.agentId.toString(),
          zoneName: zone?.name || 'Unknown Zone',
          scheduledDate: assignment.scheduledDate,
          assignmentId: assignment._id.toString(),
          isTeamAssignment: false
        });
      } else if (assignment.teamId) {
        // Team assignment
        SocketService.sendScheduledAssignmentNotification({
          userId: '', // Not needed for team notifications
          zoneName: zone?.name || 'Unknown Zone',
          scheduledDate: assignment.scheduledDate,
          assignmentId: assignment._id.toString(),
          isTeamAssignment: true,
          teamId: assignment.teamId.toString()
        });
      }
    } catch (error) {
      console.error('Error sending scheduled assignment socket notifications:', error);
    }
  }
}
