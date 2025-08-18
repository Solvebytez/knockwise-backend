export declare class TimezoneService {
    /**
     * Convert a date to a specific timezone
     */
    static toTimezone(date: Date | string, timezone: string): Date;
    /**
     * Convert a timezone date to UTC
     */
    static toUTC(date: Date | string, timezone: string): Date;
    /**
     * Format a date in a specific timezone
     */
    static formatInTimezone(date: Date | string, formatString: string, timezone: string): string;
    /**
     * Get current time in a specific timezone
     */
    static getCurrentTimeInTimezone(timezone: string): Date;
    /**
     * Check if a date is in the future for a specific timezone
     */
    static isFutureDate(date: Date | string, timezone: string): boolean;
    /**
     * Get timezone offset in minutes
     */
    static getTimezoneOffset(timezone: string): number;
    /**
     * Get common timezones
     */
    static getCommonTimezones(): {
        value: string;
        label: string;
    }[];
    /**
     * Validate timezone
     */
    static isValidTimezone(timezone: string): boolean;
    /**
     * Get user's timezone from browser
     */
    static getUserTimezone(): string;
    /**
     * Format date for display with timezone
     */
    static formatForDisplay(date: Date | string, timezone: string): string;
    /**
     * Format date for input fields (YYYY-MM-DDTHH:mm)
     */
    static formatForInput(date: Date | string, timezone: string): string;
}
//# sourceMappingURL=timezoneService.d.ts.map