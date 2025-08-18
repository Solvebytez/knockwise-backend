"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimezoneService = void 0;
const date_fns_tz_1 = require("date-fns-tz");
class TimezoneService {
    /**
     * Convert a date to a specific timezone
     */
    static toTimezone(date, timezone) {
        const dateObj = typeof date === 'string' ? (0, date_fns_tz_1.parseISO)(date) : date;
        return (0, date_fns_tz_1.utcToZonedTime)(dateObj, timezone);
    }
    /**
     * Convert a timezone date to UTC
     */
    static toUTC(date, timezone) {
        const dateObj = typeof date === 'string' ? (0, date_fns_tz_1.parseISO)(date) : date;
        return (0, date_fns_tz_1.zonedTimeToUtc)(dateObj, timezone);
    }
    /**
     * Format a date in a specific timezone
     */
    static formatInTimezone(date, formatString, timezone) {
        const dateObj = typeof date === 'string' ? (0, date_fns_tz_1.parseISO)(date) : date;
        return (0, date_fns_tz_1.format)(dateObj, formatString, { timeZone: timezone });
    }
    /**
     * Get current time in a specific timezone
     */
    static getCurrentTimeInTimezone(timezone) {
        return (0, date_fns_tz_1.utcToZonedTime)(new Date(), timezone);
    }
    /**
     * Check if a date is in the future for a specific timezone
     */
    static isFutureDate(date, timezone) {
        const dateObj = typeof date === 'string' ? (0, date_fns_tz_1.parseISO)(date) : date;
        const zonedDate = (0, date_fns_tz_1.utcToZonedTime)(dateObj, timezone);
        const currentTime = this.getCurrentTimeInTimezone(timezone);
        return zonedDate > currentTime;
    }
    /**
     * Get timezone offset in minutes
     */
    static getTimezoneOffset(timezone) {
        const now = new Date();
        const utc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
        const target = new Date(utc.toLocaleString('en-US', { timeZone: timezone }));
        return (target.getTime() - utc.getTime()) / 60000;
    }
    /**
     * Get common timezones
     */
    static getCommonTimezones() {
        return [
            { value: 'America/New_York', label: 'Eastern Time (ET)' },
            { value: 'America/Chicago', label: 'Central Time (CT)' },
            { value: 'America/Denver', label: 'Mountain Time (MT)' },
            { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
            { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
            { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
            { value: 'Europe/London', label: 'Greenwich Mean Time (GMT)' },
            { value: 'Europe/Paris', label: 'Central European Time (CET)' },
            { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
            { value: 'Asia/Shanghai', label: 'China Standard Time (CST)' },
            { value: 'Asia/Kolkata', label: 'India Standard Time (IST)' },
            { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)' },
        ];
    }
    /**
     * Validate timezone
     */
    static isValidTimezone(timezone) {
        try {
            Intl.DateTimeFormat(undefined, { timeZone: timezone });
            return true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Get user's timezone from browser
     */
    static getUserTimezone() {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
    /**
     * Format date for display with timezone
     */
    static formatForDisplay(date, timezone) {
        const dateObj = typeof date === 'string' ? (0, date_fns_tz_1.parseISO)(date) : date;
        return (0, date_fns_tz_1.format)(dateObj, 'PPP p zzz', { timeZone: timezone });
    }
    /**
     * Format date for input fields (YYYY-MM-DDTHH:mm)
     */
    static formatForInput(date, timezone) {
        const dateObj = typeof date === 'string' ? (0, date_fns_tz_1.parseISO)(date) : date;
        return (0, date_fns_tz_1.format)(dateObj, "yyyy-MM-dd'T'HH:mm", { timeZone: timezone });
    }
}
exports.TimezoneService = TimezoneService;
//# sourceMappingURL=timezoneService.js.map