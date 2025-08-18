export interface EmailTemplate {
    subject: string;
    html: string;
    text: string;
}
export declare class EmailService {
    private static isInitialized;
    /**
     * Initialize SendGrid
     */
    static initialize(): void;
    /**
     * Send email notification
     */
    static sendEmail(to: string, template: EmailTemplate): Promise<{
        success: boolean;
        message: string;
        error?: never;
    } | {
        success: boolean;
        error: string;
        message?: never;
    }>;
    /**
     * Generate territory assignment email template
     */
    static generateTerritoryAssignmentTemplate(data: {
        zoneName: string;
        effectiveFrom: Date;
        assignmentId: string;
        isTeamAssignment?: boolean;
        teamName?: string;
    }): EmailTemplate;
    /**
     * Generate scheduled assignment reminder template
     */
    static generateScheduledAssignmentTemplate(data: {
        zoneName: string;
        scheduledDate: Date;
        assignmentId: string;
        isTeamAssignment?: boolean;
        teamName?: string;
    }): EmailTemplate;
}
//# sourceMappingURL=emailService.d.ts.map