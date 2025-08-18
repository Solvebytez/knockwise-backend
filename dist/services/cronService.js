"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CronService = void 0;
const scheduledAssignmentService_1 = require("./scheduledAssignmentService");
class CronService {
    /**
     * Initialize cron jobs
     */
    static initializeCronJobs() {
        // Check for scheduled assignments every 5 minutes
        setInterval(async () => {
            try {
                console.log('Running scheduled assignment check...');
                await scheduledAssignmentService_1.ScheduledAssignmentService.activatePendingAssignments();
            }
            catch (error) {
                console.error('Error in scheduled assignment cron job:', error);
            }
        }, 5 * 60 * 1000); // 5 minutes
        // Also run immediately on startup
        setTimeout(async () => {
            try {
                console.log('Running initial scheduled assignment check...');
                await scheduledAssignmentService_1.ScheduledAssignmentService.activatePendingAssignments();
            }
            catch (error) {
                console.error('Error in initial scheduled assignment check:', error);
            }
        }, 1000); // 1 second after startup
    }
}
exports.CronService = CronService;
//# sourceMappingURL=cronService.js.map