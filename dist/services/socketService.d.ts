import { Server as HTTPServer } from 'http';
export interface NotificationData {
    type: 'TERRITORY_ASSIGNMENT' | 'TEAM_TERRITORY_ASSIGNMENT' | 'SCHEDULED_ASSIGNMENT' | 'ASSIGNMENT_ACTIVATED';
    title: string;
    message: string;
    data?: any;
    timestamp: Date;
}
export declare class SocketService {
    private static io;
    private static userSockets;
    /**
     * Initialize Socket.IO server
     */
    static initialize(httpServer: HTTPServer): void;
    /**
     * Send notification to a specific user
     */
    static sendToUser(userId: string, notification: NotificationData): void;
    /**
     * Send notification to all team members
     */
    static sendToTeam(teamId: string, notification: NotificationData): void;
    /**
     * Send notification to all connected users
     */
    static sendToAll(notification: NotificationData): void;
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
    }): void;
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
    }): void;
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
    }): void;
    /**
     * Get connected users count
     */
    static getConnectedUsersCount(): number;
    /**
     * Check if user is connected
     */
    static isUserConnected(userId: string): boolean;
}
//# sourceMappingURL=socketService.d.ts.map