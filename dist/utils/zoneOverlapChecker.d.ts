export interface OverlapResult {
    hasOverlap: boolean;
    overlappingZones: any[];
    overlapPercentage?: number;
}
/**
 * Check if a new zone boundary overlaps with existing zones
 * @param boundary - GeoJSON polygon of the new zone
 * @param excludeZoneId - Zone ID to exclude from overlap check (for updates)
 * @returns OverlapResult with overlap information
 */
export declare const checkZoneOverlap: (boundary: any, excludeZoneId?: string) => Promise<OverlapResult>;
/**
 * Check for duplicate buildings across all zones
 * @param addresses - Array of building addresses
 * @param excludeZoneId - Zone ID to exclude from check
 * @returns Array of duplicate addresses
 */
export declare const checkDuplicateBuildings: (addresses: string[], excludeZoneId?: string) => Promise<string[]>;
/**
 * Validate zone boundary format
 * @param boundary - Zone boundary to validate
 * @returns boolean indicating if boundary is valid
 */
export declare const validateZoneBoundary: (boundary: any) => boolean;
//# sourceMappingURL=zoneOverlapChecker.d.ts.map