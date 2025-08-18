"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateZoneBoundary = exports.checkDuplicateBuildings = exports.checkZoneOverlap = void 0;
const Zone_1 = require("../models/Zone");
/**
 * Check if a new zone boundary overlaps with existing zones
 * @param boundary - GeoJSON polygon of the new zone
 * @param excludeZoneId - Zone ID to exclude from overlap check (for updates)
 * @returns OverlapResult with overlap information
 */
const checkZoneOverlap = async (boundary, excludeZoneId) => {
    try {
        // Ensure boundary is a valid GeoJSON polygon
        if (!boundary || boundary.type !== 'Polygon' || !boundary.coordinates) {
            throw new Error('Invalid boundary format. Expected GeoJSON Polygon.');
        }
        // Build query to find overlapping zones
        const query = {
            boundary: {
                $geoIntersects: {
                    $geometry: boundary
                }
            }
        };
        // Exclude the current zone if updating
        if (excludeZoneId) {
            query._id = { $ne: excludeZoneId };
        }
        // Find zones that intersect with the new boundary
        const overlappingZones = await Zone_1.Zone.find(query).select('_id name status createdBy createdAt');
        if (overlappingZones.length === 0) {
            return {
                hasOverlap: false,
                overlappingZones: []
            };
        }
        // Calculate overlap percentage for the most significant overlap
        let maxOverlapPercentage = 0;
        for (const existingZone of overlappingZones) {
            try {
                // Use MongoDB's $geoIntersects to check intersection
                const intersectionQuery = {
                    _id: existingZone._id,
                    boundary: {
                        $geoIntersects: {
                            $geometry: boundary
                        }
                    }
                };
                const intersectionResult = await Zone_1.Zone.findOne(intersectionQuery);
                if (intersectionResult) {
                    // For now, we'll use a simple heuristic for overlap percentage
                    // In a production system, you might want to use more sophisticated geometry calculations
                    maxOverlapPercentage = Math.max(maxOverlapPercentage, 50); // Placeholder value
                }
            }
            catch (error) {
                console.error('Error calculating overlap percentage:', error);
            }
        }
        return {
            hasOverlap: true,
            overlappingZones,
            overlapPercentage: maxOverlapPercentage
        };
    }
    catch (error) {
        console.error('Error checking zone overlap:', error);
        throw error;
    }
};
exports.checkZoneOverlap = checkZoneOverlap;
/**
 * Check for duplicate buildings across all zones
 * @param addresses - Array of building addresses
 * @param excludeZoneId - Zone ID to exclude from check
 * @returns Array of duplicate addresses
 */
const checkDuplicateBuildings = async (addresses, excludeZoneId) => {
    try {
        const query = {
            address: { $in: addresses }
        };
        if (excludeZoneId) {
            query.zoneId = { $ne: excludeZoneId };
        }
        const existingResidents = await Zone_1.Zone.aggregate([
            {
                $lookup: {
                    from: 'residents',
                    localField: '_id',
                    foreignField: 'zoneId',
                    as: 'residents'
                }
            },
            {
                $unwind: '$residents'
            },
            {
                $match: {
                    'residents.address': { $in: addresses }
                }
            },
            {
                $project: {
                    'residents.address': 1,
                    'residents.zoneId': 1
                }
            }
        ]);
        const duplicateAddresses = existingResidents
            .map((item) => item.residents.address)
            .filter((address, index, arr) => arr.indexOf(address) === index);
        return duplicateAddresses;
    }
    catch (error) {
        console.error('Error checking duplicate buildings:', error);
        throw error;
    }
};
exports.checkDuplicateBuildings = checkDuplicateBuildings;
/**
 * Validate zone boundary format
 * @param boundary - Zone boundary to validate
 * @returns boolean indicating if boundary is valid
 */
const validateZoneBoundary = (boundary) => {
    try {
        if (!boundary || typeof boundary !== 'object') {
            return false;
        }
        if (boundary.type !== 'Polygon') {
            return false;
        }
        if (!Array.isArray(boundary.coordinates) || boundary.coordinates.length === 0) {
            return false;
        }
        // Check if coordinates form a closed polygon
        const firstCoord = boundary.coordinates[0][0];
        const lastCoord = boundary.coordinates[0][boundary.coordinates[0].length - 1];
        if (firstCoord[0] !== lastCoord[0] || firstCoord[1] !== lastCoord[1]) {
            return false;
        }
        // Check if polygon has at least 4 points (including closing point)
        if (boundary.coordinates[0].length < 4) {
            return false;
        }
        return true;
    }
    catch (error) {
        console.error('Error validating zone boundary:', error);
        return false;
    }
};
exports.validateZoneBoundary = validateZoneBoundary;
//# sourceMappingURL=zoneOverlapChecker.js.map