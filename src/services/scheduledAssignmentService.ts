import { ScheduledAssignment } from '../models/ScheduledAssignment';
import { AgentZoneAssignment } from '../models/AgentZoneAssignment';
import { User } from '../models/User';
import { Team } from '../models/Team';
import { Zone } from '../models/Zone';
import { EmailService } from './emailService';
import { SocketService } from './socketService';

export class ScheduledAssignmentService {
  
  /**
   * Sync agent's zoneIds with all current assignments
   */
  static async syncAgentZoneIds(agentId: string) {
    try {
      // Get all active assignments for this agent (individual and team-based)
      const individualAssignments = await AgentZoneAssignment.find({
        agentId: agentId,
        status: { $nin: ['COMPLETED', 'CANCELLED'] },
        effectiveTo: null
      }).populate('zoneId', '_id');

      const agent = await User.findById(agentId);
      if (!agent) return;

      // Get team-based assignments for this agent's teams
      const teamAssignments = await AgentZoneAssignment.find({
        teamId: { $in: agent.teamIds },
        status: { $nin: ['COMPLETED', 'CANCELLED'] },
        effectiveTo: null
      }).populate('zoneId', '_id');

      // Combine all zone IDs from both individual and team assignments
      const allZoneIds = [
        ...individualAssignments.map(a => a.zoneId._id.toString()),
        ...teamAssignments.map(a => a.zoneId._id.toString())
      ];

      // Remove duplicates
      const uniqueZoneIds = [...new Set(allZoneIds)];

      // Update the agent's zoneIds to match all current assignments
      await User.findByIdAndUpdate(agentId, {
        zoneIds: uniqueZoneIds
      });

      console.log(`Synced zoneIds for agent ${agent.name}: ${uniqueZoneIds.length} zones`);
    } catch (error) {
      console.error('Error syncing agent zoneIds:', error);
    }
  }
  
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

          // Update agent zone fields
          if (assignment.agentId) {
            // Individual agent assignment
            const agent = await User.findById(assignment.agentId);
            if (agent) {
              const updateData: any = {};
              
              // Always set latest activated assignment as primary
              updateData.primaryZoneId = assignment.zoneId;
              
              // Add to zoneIds array if not already present
              const currentZoneIds = agent.zoneIds || [];
              if (!currentZoneIds.includes(assignment.zoneId)) {
                updateData.zoneIds = [...currentZoneIds, assignment.zoneId];
              }
              
              // Update agent if there are changes
              if (Object.keys(updateData).length > 0) {
                await User.findByIdAndUpdate(assignment.agentId, updateData);
              }
            }
          } else if (assignment.teamId) {
            // Team assignment - update all team members
            const team = await Team.findById(assignment.teamId);
            if (team && team.agentIds) {
              for (const agentId of team.agentIds) {
                const agent = await User.findById(agentId);
                if (agent) {
                  const updateData: any = {};
                  
                  // Always set latest activated team assignment as primary
                  updateData.primaryZoneId = assignment.zoneId;
                  
                  // Update agent with new primary zone
                  await User.findByIdAndUpdate(agentId, updateData);
                  
                  // Sync zoneIds with all current assignments
                  await this.syncAgentZoneIds(agentId.toString());
                }
              }
            }
          }

          // Update scheduled assignment status
          assignment.status = 'ACTIVATED';
          assignment.notificationSent = true;
          await assignment.save();

          // Send notifications
          // await this.sendAssignmentNotifications(assignment);
          
          // Send socket notifications
          // await this.sendAssignmentSocketNotifications(assignment);

          console.log(`Activated assignment for zone: ${assignment.zoneId}`);
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
          
          for (const agent of team.agentIds as any[]) {
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
          
          for (const agent of team.agentIds as any[]) {
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
