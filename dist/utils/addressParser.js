"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractHouseNumber = extractHouseNumber;
exports.categorizeHouseNumbers = categorizeHouseNumbers;
exports.processBuildingData = processBuildingData;
exports.getHouseNumberStats = getHouseNumberStats;
/**
 * Extract house number from address string
 * @param address - Full address string (e.g., "123 Main St, City, State")
 * @returns House number or null if not found
 */
function extractHouseNumber(address) {
    if (!address)
        return null;
    // Match number at the beginning of the address
    const match = address.trim().match(/^(\d+)/);
    return match ? parseInt(match[1] || '0', 10) : null;
}
/**
 * Categorize house numbers into odd and even arrays
 * @param addresses - Array of address strings
 * @returns Object with odd and even house number arrays
 */
function categorizeHouseNumbers(addresses) {
    const houseNumbers = addresses
        .map(extractHouseNumber)
        .filter((num) => num !== null && !isNaN(num));
    return {
        odd: houseNumbers.filter(num => num % 2 === 1),
        even: houseNumbers.filter(num => num % 2 === 0)
    };
}
/**
 * Process building data and extract house numbers
 * @param addresses - Array of address strings
 * @param coordinates - Array of coordinate pairs [lng, lat]
 * @returns Processed building data with house numbers
 */
function processBuildingData(addresses, coordinates) {
    const houseNumbers = categorizeHouseNumbers(addresses);
    return {
        totalBuildings: addresses.length,
        residentialHomes: addresses.length, // Assuming all detected buildings are residential
        addresses,
        coordinates,
        houseNumbers
    };
}
/**
 * Get house number statistics
 * @param houseNumbers - Object with odd and even arrays
 * @returns Statistics about house numbers
 */
function getHouseNumberStats(houseNumbers) {
    const oddCount = houseNumbers.odd.length;
    const evenCount = houseNumbers.even.length;
    const total = oddCount + evenCount;
    const oddRange = oddCount > 0 ? {
        min: Math.min(...houseNumbers.odd),
        max: Math.max(...houseNumbers.odd)
    } : undefined;
    const evenRange = evenCount > 0 ? {
        min: Math.min(...houseNumbers.even),
        max: Math.max(...houseNumbers.even)
    } : undefined;
    return {
        total,
        oddCount,
        evenCount,
        ...(oddRange && { oddRange }),
        ...(evenRange && { evenRange })
    };
}
//# sourceMappingURL=addressParser.js.map