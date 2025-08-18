export declare class ScheduledAssignmentService {
    /**
     * Create a scheduled assignment
     */
    static createScheduledAssignment(data: {
        agentId?: string;
        teamId?: string;
        zoneId: string;
        scheduledDate: Date;
        effectiveFrom: Date;
        assignedBy: string;
    }): Promise<import("mongoose").Document<unknown, {}, import("../models/ScheduledAssignment").IScheduledAssignment, {}, {}> & import("../models/ScheduledAssignment").IScheduledAssignment & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    /**
     * Activate pending assignments that have reached their scheduled date
     */
    static activatePendingAssignments(): Promise<void>;
    /**
     * Send notifications for activated assignments
     */
    static sendAssignmentNotifications(assignment: any): Promise<void>;
    /**
     * Send scheduled assignment notifications
     */
    static sendScheduledAssignmentNotifications(assignment: any): Promise<void>;
    /**
     * Get scheduled assignments for a user or team
     */
    static getScheduledAssignments(filters: {
        agentId?: string;
        teamId?: string;
        status?: string;
    }): Promise<(import("mongoose").Document<unknown, {}, import("../models/ScheduledAssignment").IScheduledAssignment, {}, {}> & import("../models/ScheduledAssignment").IScheduledAssignment & Required<{
        _id: unknown;
    }> & {
        __v: number;
    })[]>;
    /**
     * Cancel a scheduled assignment
     */
    static cancelScheduledAssignment(assignmentId: string): Promise<(import("mongoose").Document<unknown, {}, import("../models/ScheduledAssignment").IScheduledAssignment, {}, {}> & import("../models/ScheduledAssignment").IScheduledAssignment & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }) | null>;
    /**
     * Send assignment socket notifications
     */
    static sendAssignmentSocketNotifications(assignment: any): Promise<void>;
    /**
     * Send scheduled assignment socket notifications
     */
    static sendScheduledAssignmentSocketNotifications(assignment: any): Promise<void>;
}
//# sourceMappingURL=scheduledAssignmentService.d.ts.map