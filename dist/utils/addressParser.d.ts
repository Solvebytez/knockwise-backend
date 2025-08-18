/**
 * Extract house number from address string
 * @param address - Full address string (e.g., "123 Main St, City, State")
 * @returns House number or null if not found
 */
export declare function extractHouseNumber(address: string): number | null;
/**
 * Categorize house numbers into odd and even arrays
 * @param addresses - Array of address strings
 * @returns Object with odd and even house number arrays
 */
export declare function categorizeHouseNumbers(addresses: string[]): {
    odd: number[];
    even: number[];
};
/**
 * Process building data and extract house numbers
 * @param addresses - Array of address strings
 * @param coordinates - Array of coordinate pairs [lng, lat]
 * @returns Processed building data with house numbers
 */
export declare function processBuildingData(addresses: string[], coordinates: [number, number][]): {
    totalBuildings: number;
    residentialHomes: number;
    addresses: string[];
    coordinates: [number, number][];
    houseNumbers: {
        odd: number[];
        even: number[];
    };
};
/**
 * Get house number statistics
 * @param houseNumbers - Object with odd and even arrays
 * @returns Statistics about house numbers
 */
export declare function getHouseNumberStats(houseNumbers: {
    odd: number[];
    even: number[];
}): {
    total: number;
    oddCount: number;
    evenCount: number;
    oddRange?: {
        min: number;
        max: number;
    };
    evenRange?: {
        min: number;
        max: number;
    };
};
//# sourceMappingURL=addressParser.d.ts.map