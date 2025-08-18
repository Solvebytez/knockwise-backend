import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { AuthRequest } from '../middleware/auth';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface NotificationData {
  type: 'TERRITORY_ASSIGNMENT' | 'TEAM_TERRITORY_ASSIGNMENT' | 'SCHEDULED_ASSIGNMENT' | 'ASSIGNMENT_ACTIVATED';
  title: string;
  message: string;
  data?: any;
  timestamp: Date;
}

export class SocketService {
  private static io: SocketIOServer | null = null;
  private static userSockets: Map<string, string> = new Map(); // userId -> socketId

  /**
   * Initialize Socket.IO server
   */
  static initialize(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: env.corsOrigin,
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        const decoded = jwt.verify(token, env.jwtAccessSecret) as any;
        socket.data.userId = decoded.sub;
        next();
      } catch (error) {
        next(new Error('Authentication error: Invalid token'));
      }
    });

    // Connection handler
    this.io.on('connection', (socket) => {
      const userId = socket.data.userId;
      console.log(`🔌 Socket connected: ${userId}`);
      
      // Store user socket mapping
      this.userSockets.set(userId, socket.id);

      // Join user to their personal room
      socket.join(`user:${userId}`);

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`🔌 Socket disconnected: ${userId}`);
        this.userSockets.delete(userId);
      });

      // Handle custom events
      socket.on('join-team', (teamId: string) => {
        socket.join(`team:${teamId}`);
        console.log(`👥 User ${userId} joined team room: ${teamId}`);
      });

      socket.on('leave-team', (teamId: string) => {
        socket.leave(`team:${teamId}`);
        console.log(`👥 User ${userId} left team room: ${teamId}`);
      });
    });

    console.log('✅ Socket.IO server initialized');
  }

  /**
   * Send notification to a specific user
   */
  static sendToUser(userId: string, notification: NotificationData) {
    if (!this.io) {
      console.warn('Socket.IO not initialized');
      return;
    }

    this.io.to(`user:${userId}`).emit('notification', notification);
    console.log(`📨 Notification sent to user ${userId}:`, notification.title);
  }

  /**
   * Send notification to all team members
   */
  static sendToTeam(teamId: string, notification: NotificationData) {
    if (!this.io) {
      console.warn('Socket.IO not initialized');
      return;
    }

    this.io.to(`team:${teamId}`).emit('notification', notification);
    console.log(`📨 Team notification sent to team ${teamId}:`, notification.title);
  }

  /**
   * Send notification to all connected users
   */
  static sendToAll(notification: NotificationData) {
    if (!this.io) {
      console.warn('Socket.IO not initialized');
      return;
    }

    this.io.emit('notification', notification);
    console.log(`📨 Broadcast notification sent:`, notification.title);
  }

  /**
   * Send territory assignment notification
   */
  static sendTerritoryAssignmentNotification(data: {
    userId: string;
    zoneName: string;
    effectiveFrom: Date;
    assignmentId: string;
    isTeamAssignment?: boolean;
    teamId?: string;
  }) {
    const notification: NotificationData = {
      type: data.isTeamAssignment ? 'TEAM_TERRITORY_ASSIGNMENT' : 'TERRITORY_ASSIGNMENT',
      title: data.isTeamAssignment ? 'Team Territory Assignment' : 'New Territory Assignment',
      message: `You have been assigned to territory: ${data.zoneName}. The assignment is now active.`,
      data: {
        zoneName: data.zoneName,
        effectiveFrom: data.effectiveFrom,
        assignmentId: data.assignmentId,
        isTeamAssignment: data.isTeamAssignment
      },
      timestamp: new Date()
    };

    if (data.isTeamAssignment && data.teamId) {
      this.sendToTeam(data.teamId, notification);
    } else {
      this.sendToUser(data.userId, notification);
    }
  }

  /**
   * Send scheduled assignment notification
   */
  static sendScheduledAssignmentNotification(data: {
    userId: string;
    zoneName: string;
    scheduledDate: Date;
    assignmentId: string;
    isTeamAssignment?: boolean;
    teamId?: string;
  }) {
    const notification: NotificationData = {
      type: 'SCHEDULED_ASSIGNMENT',
      title: data.isTeamAssignment ? 'Scheduled Team Assignment' : 'Scheduled Territory Assignment',
      message: `You have been scheduled for territory assignment: ${data.zoneName}.`,
      data: {
        zoneName: data.zoneName,
        scheduledDate: data.scheduledDate,
        assignmentId: data.assignmentId,
        isTeamAssignment: data.isTeamAssignment
      },
      timestamp: new Date()
    };

    if (data.isTeamAssignment && data.teamId) {
      this.sendToTeam(data.teamId, notification);
    } else {
      this.sendToUser(data.userId, notification);
    }
  }

  /**
   * Send assignment activated notification
   */
  static sendAssignmentActivatedNotification(data: {
    userId: string;
    zoneName: string;
    effectiveFrom: Date;
    assignmentId: string;
    isTeamAssignment?: boolean;
    teamId?: string;
  }) {
    const notification: NotificationData = {
      type: 'ASSIGNMENT_ACTIVATED',
      title: 'Assignment Activated',
      message: `Your scheduled assignment to territory: ${data.zoneName} is now active.`,
      data: {
        zoneName: data.zoneName,
        effectiveFrom: data.effectiveFrom,
        assignmentId: data.assignmentId,
        isTeamAssignment: data.isTeamAssignment
      },
      timestamp: new Date()
    };

    if (data.isTeamAssignment && data.teamId) {
      this.sendToTeam(data.teamId, notification);
    } else {
      this.sendToUser(data.userId, notification);
    }
  }

  /**
   * Get connected users count
   */
  static getConnectedUsersCount(): number {
    return this.userSockets.size;
  }

  /**
   * Check if user is connected
   */
  static isUserConnected(userId: string): boolean {
    return this.userSockets.has(userId);
  }
}
