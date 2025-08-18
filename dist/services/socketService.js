"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketService = void 0;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
class SocketService {
    /**
     * Initialize Socket.IO server
     */
    static initialize(httpServer) {
        this.io = new socket_io_1.Server(httpServer, {
            cors: {
                origin: env_1.env.corsOrigin,
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
                const decoded = jsonwebtoken_1.default.verify(token, env_1.env.jwtAccessSecret);
                socket.data.userId = decoded.sub;
                next();
            }
            catch (error) {
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
            socket.on('join-team', (teamId) => {
                socket.join(`team:${teamId}`);
                console.log(`👥 User ${userId} joined team room: ${teamId}`);
            });
            socket.on('leave-team', (teamId) => {
                socket.leave(`team:${teamId}`);
                console.log(`👥 User ${userId} left team room: ${teamId}`);
            });
        });
        console.log('✅ Socket.IO server initialized');
    }
    /**
     * Send notification to a specific user
     */
    static sendToUser(userId, notification) {
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
    static sendToTeam(teamId, notification) {
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
    static sendToAll(notification) {
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
    static sendTerritoryAssignmentNotification(data) {
        const notification = {
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
        }
        else {
            this.sendToUser(data.userId, notification);
        }
    }
    /**
     * Send scheduled assignment notification
     */
    static sendScheduledAssignmentNotification(data) {
        const notification = {
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
        }
        else {
            this.sendToUser(data.userId, notification);
        }
    }
    /**
     * Send assignment activated notification
     */
    static sendAssignmentActivatedNotification(data) {
        const notification = {
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
        }
        else {
            this.sendToUser(data.userId, notification);
        }
    }
    /**
     * Get connected users count
     */
    static getConnectedUsersCount() {
        return this.userSockets.size;
    }
    /**
     * Check if user is connected
     */
    static isUserConnected(userId) {
        return this.userSockets.has(userId);
    }
}
exports.SocketService = SocketService;
SocketService.io = null;
SocketService.userSockets = new Map(); // userId -> socketId
//# sourceMappingURL=socketService.js.map