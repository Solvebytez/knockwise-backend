"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRoute = createRoute;
exports.optimizeRoute = optimizeRoute;
exports.getMyRoutes = getMyRoutes;
exports.getRouteById = getRouteById;
exports.updateRoute = updateRoute;
exports.deleteRoute = deleteRoute;
exports.listRoutes = listRoutes;
exports.getTeamRoutes = getTeamRoutes;
exports.updateRouteStatus = updateRouteStatus;
exports.duplicateRoute = duplicateRoute;
exports.shareRoute = shareRoute;
exports.updateStopStatus = updateStopStatus;
exports.getRouteAnalytics = getRouteAnalytics;
exports.exportRoute = exportRoute;
exports.createTemplate = createTemplate;
exports.getTemplates = getTemplates;
const mongoose_1 = __importDefault(require("mongoose"));
const Route_1 = __importDefault(require("../models/Route"));
const PropertyData_1 = __importDefault(require("../models/PropertyData"));
const User_1 = __importDefault(require("../models/User"));
async function createRoute(req, res) {
    try {
        const routeData = {
            ...req.body,
            agentId: req.user.sub,
            analytics: {
                totalStops: 0,
                completedStops: 0,
                skippedStops: 0,
                totalDistance: 0,
                estimatedDuration: 0,
                efficiency: 0,
                completionRate: 0,
            },
        };
        const route = await Route_1.default.create(routeData);
        res.status(201).json(route);
    }
    catch (error) {
        res.status(500).json({
            message: 'Error creating route',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
async function optimizeRoute(req, res) {
    try {
        const { propertyIds, startLocation, endLocation, optimizationSettings = {} } = req.body;
        if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
            res.status(400).json({ message: 'Property IDs array is required' });
            return;
        }
        // Get properties with location data
        const properties = await PropertyData_1.default.find({
            _id: { $in: propertyIds },
            location: { $exists: true },
        }).limit(optimizationSettings.maxStops || 50);
        if (properties.length === 0) {
            res.status(400).json({ message: 'No valid properties found with location data' });
            return;
        }
        // Filter out properties without location data
        const validProperties = properties.filter(p => p.location && p.location.coordinates);
        if (validProperties.length === 0) {
            res.status(400).json({ message: 'No properties with valid location data found' });
            return;
        }
        // Enhanced optimization algorithm based on settings
        const optimizedStops = await optimizeRouteStops(validProperties, startLocation, endLocation, optimizationSettings);
        const totalDistance = calculateTotalDistance(optimizedStops, validProperties);
        const totalDuration = optimizedStops.length * (optimizationSettings.estimatedDurationPerStop || 15);
        const route = await Route_1.default.create({
            name: `Optimized Route - ${new Date().toLocaleDateString()}`,
            agentId: req.user.sub,
            date: new Date(),
            stops: optimizedStops,
            totalDistance,
            totalDuration,
            startLocation: startLocation ? { type: 'Point', coordinates: startLocation } : undefined,
            endLocation: endLocation ? { type: 'Point', coordinates: endLocation } : undefined,
            optimizationSettings: {
                maxStops: optimizationSettings.maxStops || 50,
                maxDistance: optimizationSettings.maxDistance || 25,
                optimizationType: optimizationSettings.optimizationType || 'FASTEST',
                avoidFerries: optimizationSettings.avoidFerries || false,
                avoidHighways: optimizationSettings.avoidHighways || false,
                avoidTolls: optimizationSettings.avoidTolls || false,
                avoidTraffic: optimizationSettings.avoidTraffic || true,
                startFromOffice: optimizationSettings.startFromOffice || true,
                returnToOffice: optimizationSettings.returnToOffice || true,
                preferredTimeWindow: optimizationSettings.preferredTimeWindow || { start: '09:00', end: '17:00' },
            },
            analytics: {
                totalStops: optimizedStops.length,
                completedStops: 0,
                skippedStops: 0,
                totalDistance,
                estimatedDuration: totalDuration,
                efficiency: 0,
                completionRate: 0,
            },
        });
        res.status(201).json(route);
    }
    catch (error) {
        res.status(500).json({
            message: 'Error optimizing route',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
async function getMyRoutes(req, res) {
    try {
        const agentId = req.user.sub;
        const { page = 1, limit = 20, status, priority, date } = req.query;
        const query = { agentId };
        if (status)
            query.status = status;
        if (priority)
            query.priority = priority;
        if (date) {
            const dateObj = new Date(date);
            query.date = {
                $gte: new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()),
                $lt: new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate() + 1),
            };
        }
        const routes = await Route_1.default.find(query)
            .sort({ date: -1, createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit))
            .populate('zoneId', 'name')
            .populate('teamId', 'name');
        const total = await Route_1.default.countDocuments(query);
        res.json({
            routes,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    }
    catch (error) {
        res.status(500).json({
            message: 'Error fetching routes',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
async function getRouteById(req, res) {
    try {
        const { id } = req.params;
        const route = await Route_1.default.findById(id)
            .populate('stops.propertyId', 'address city state zipCode propertyType leadScore')
            .populate('agentId', 'name email')
            .populate('zoneId', 'name')
            .populate('teamId', 'name')
            .populate('sharing.sharedWith', 'name email');
        if (!route) {
            res.status(404).json({ message: 'Route not found' });
            return;
        }
        res.json(route);
    }
    catch (error) {
        res.status(500).json({
            message: 'Error fetching route',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
async function updateRoute(req, res) {
    try {
        const { id } = req.params;
        const route = await Route_1.default.findByIdAndUpdate(id, req.body, { new: true });
        if (!route) {
            res.status(404).json({ message: 'Route not found' });
            return;
        }
        res.json(route);
    }
    catch (error) {
        res.status(500).json({
            message: 'Error updating route',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
async function deleteRoute(req, res) {
    try {
        const { id } = req.params;
        const route = await Route_1.default.findByIdAndDelete(id);
        if (!route) {
            res.status(404).json({ message: 'Route not found' });
            return;
        }
        res.json({ message: 'Route deleted successfully' });
    }
    catch (error) {
        res.status(500).json({
            message: 'Error deleting route',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
async function listRoutes(req, res) {
    try {
        const { page = 1, limit = 20, status, priority, agentId, teamId, zoneId, startDate, endDate, isTemplate, tags } = req.query;
        const query = {};
        if (status)
            query.status = status;
        if (priority)
            query.priority = priority;
        if (agentId)
            query.agentId = agentId;
        if (teamId)
            query.teamId = teamId;
        if (zoneId)
            query.zoneId = zoneId;
        if (isTemplate !== undefined)
            query.isTemplate = isTemplate === 'true';
        if (tags) {
            const tagArray = tags.split(',').map(tag => tag.trim());
            query.tags = { $in: tagArray };
        }
        if (startDate || endDate) {
            query.date = {};
            if (startDate)
                query.date.$gte = new Date(startDate);
            if (endDate)
                query.date.$lte = new Date(endDate);
        }
        const routes = await Route_1.default.find(query)
            .sort({ date: -1, createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit))
            .populate('agentId', 'name email')
            .populate('zoneId', 'name')
            .populate('teamId', 'name');
        const total = await Route_1.default.countDocuments(query);
        res.json({
            routes,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    }
    catch (error) {
        res.status(500).json({
            message: 'Error fetching routes',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
async function getTeamRoutes(req, res) {
    try {
        const { teamId } = req.query;
        const { page = 1, limit = 20, status, priority } = req.query;
        const query = { teamId };
        if (status)
            query.status = status;
        if (priority)
            query.priority = priority;
        const routes = await Route_1.default.find(query)
            .sort({ date: -1, createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit))
            .populate('agentId', 'name email')
            .populate('zoneId', 'name');
        const total = await Route_1.default.countDocuments(query);
        res.json({
            routes,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    }
    catch (error) {
        res.status(500).json({
            message: 'Error fetching team routes',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
async function updateRouteStatus(req, res) {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const route = await Route_1.default.findByIdAndUpdate(id, { status }, { new: true });
        if (!route) {
            res.status(404).json({ message: 'Route not found' });
            return;
        }
        res.json(route);
    }
    catch (error) {
        res.status(500).json({
            message: 'Error updating route status',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
async function duplicateRoute(req, res) {
    try {
        const { id } = req.params;
        const { name, date } = req.body;
        const originalRoute = await Route_1.default.findById(id);
        if (!originalRoute) {
            res.status(404).json({ message: 'Route not found' });
            return;
        }
        const duplicatedRoute = await Route_1.default.create({
            ...originalRoute.toObject(),
            _id: undefined,
            name: name || `${originalRoute.name} (Copy)`,
            date: date ? new Date(date) : new Date(),
            status: 'DRAFT',
            parentRouteId: originalRoute._id,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        res.status(201).json(duplicatedRoute);
    }
    catch (error) {
        res.status(500).json({
            message: 'Error duplicating route',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
async function shareRoute(req, res) {
    try {
        const { id } = req.params;
        const { sharedWith, permissions = 'VIEW' } = req.body;
        const route = await Route_1.default.findById(id);
        if (!route) {
            res.status(404).json({ message: 'Route not found' });
            return;
        }
        // Verify that all users exist
        const users = await User_1.default.find({ _id: { $in: sharedWith } });
        if (users.length !== sharedWith.length) {
            res.status(400).json({ message: 'Some users not found' });
            return;
        }
        route.sharing = {
            sharedWith: sharedWith.map((id) => new mongoose_1.default.Types.ObjectId(id)),
            sharedBy: new mongoose_1.default.Types.ObjectId(req.user.sub),
            sharedAt: new Date(),
            permissions,
        };
        await route.save();
        res.json(route);
    }
    catch (error) {
        res.status(500).json({
            message: 'Error sharing route',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
async function updateStopStatus(req, res) {
    try {
        const { routeId } = req.params;
        const { stopIndex, status, actualDuration, notes } = req.body;
        const route = await Route_1.default.findById(routeId);
        if (!route) {
            res.status(404).json({ message: 'Route not found' });
            return;
        }
        if (stopIndex < 0 || stopIndex >= route.stops.length) {
            res.status(400).json({ message: 'Invalid stop index' });
            return;
        }
        const stop = route.stops[stopIndex];
        if (!stop) {
            res.status(400).json({ message: 'Stop not found' });
            return;
        }
        stop.status = status;
        if (actualDuration)
            stop.actualDuration = actualDuration;
        if (notes)
            stop.notes = notes;
        if (status === 'COMPLETED')
            stop.completedAt = new Date();
        await route.save();
        res.json(route);
    }
    catch (error) {
        res.status(500).json({
            message: 'Error updating stop status',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
async function getRouteAnalytics(req, res) {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req.query;
        const route = await Route_1.default.findById(id);
        if (!route) {
            res.status(404).json({ message: 'Route not found' });
            return;
        }
        // Calculate additional analytics
        const analytics = {
            ...route.analytics,
            averageTimePerStop: route.analytics.totalStops > 0
                ? route.analytics.estimatedDuration / route.analytics.totalStops
                : 0,
            successRate: route.analytics.totalStops > 0
                ? (route.analytics.completedStops / route.analytics.totalStops) * 100
                : 0,
            efficiency: route.analytics.actualDuration && route.analytics.estimatedDuration
                ? (route.analytics.estimatedDuration / route.analytics.actualDuration) * 100
                : 0,
        };
        res.json(analytics);
    }
    catch (error) {
        res.status(500).json({
            message: 'Error fetching route analytics',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
async function exportRoute(req, res) {
    try {
        const { id } = req.params;
        const { format = 'json' } = req.query;
        const route = await Route_1.default.findById(id)
            .populate('stops.propertyId', 'address city state zipCode propertyType leadScore')
            .populate('agentId', 'name email');
        if (!route) {
            res.status(404).json({ message: 'Route not found' });
            return;
        }
        switch (format) {
            case 'csv':
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="route-${id}.csv"`);
                res.send(convertRouteToCSV(route));
                break;
            case 'pdf':
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="route-${id}.pdf"`);
                // TODO: Implement PDF generation
                res.json({ message: 'PDF export not yet implemented' });
                break;
            default:
                res.json(route);
        }
    }
    catch (error) {
        res.status(500).json({
            message: 'Error exporting route',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
async function createTemplate(req, res) {
    try {
        const { name, description, optimizationSettings, tags } = req.body;
        const template = await Route_1.default.create({
            name,
            description,
            agentId: req.user.sub,
            date: new Date(),
            stops: [],
            isTemplate: true,
            templateName: name,
            optimizationSettings: optimizationSettings || {},
            tags: tags || [],
            analytics: {
                totalStops: 0,
                completedStops: 0,
                skippedStops: 0,
                totalDistance: 0,
                estimatedDuration: 0,
                efficiency: 0,
                completionRate: 0,
            },
        });
        res.status(201).json(template);
    }
    catch (error) {
        res.status(500).json({
            message: 'Error creating template',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
async function getTemplates(req, res) {
    try {
        const { page = 1, limit = 20 } = req.query;
        const templates = await Route_1.default.find({ isTemplate: true })
            .sort({ createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit))
            .populate('agentId', 'name email');
        const total = await Route_1.default.countDocuments({ isTemplate: true });
        res.json({
            templates,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    }
    catch (error) {
        res.status(500).json({
            message: 'Error fetching templates',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
// Helper functions
async function optimizeRouteStops(properties, startLocation, endLocation, settings = {}) {
    const optimizedStops = [];
    const unvisited = [...properties];
    let currentLocation = startLocation || (properties[0]?.location?.coordinates || [0, 0]);
    const maxStops = settings.maxStops || 50;
    while (unvisited.length > 0 && optimizedStops.length < maxStops) {
        let nearestIndex = 0;
        let minDistance = calculateDistance(currentLocation, unvisited[0]?.location?.coordinates || [0, 0]);
        for (let i = 1; i < unvisited.length; i++) {
            const distance = calculateDistance(currentLocation, unvisited[i]?.location?.coordinates || [0, 0]);
            if (distance < minDistance) {
                minDistance = distance;
                nearestIndex = i;
            }
        }
        const nearestProperty = unvisited.splice(nearestIndex, 1)[0];
        if (nearestProperty?.location?.coordinates) {
            optimizedStops.push({
                propertyId: nearestProperty._id,
                order: optimizedStops.length + 1,
                estimatedDuration: settings.estimatedDurationPerStop || 15,
                status: 'PENDING',
            });
            currentLocation = nearestProperty.location.coordinates;
        }
    }
    return optimizedStops;
}
function calculateDistance(coord1, coord2) {
    const [lng1, lat1] = coord1;
    const [lng2, lat2] = coord2;
    // Haversine formula for distance calculation
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
function calculateTotalDistance(stops, properties) {
    let totalDistance = 0;
    const propertyMap = new Map(properties.map(p => [p._id.toString(), p]));
    for (let i = 0; i < stops.length - 1; i++) {
        const currentProperty = propertyMap.get(stops[i].propertyId.toString());
        const nextProperty = propertyMap.get(stops[i + 1].propertyId.toString());
        if (currentProperty?.location?.coordinates && nextProperty?.location?.coordinates) {
            totalDistance += calculateDistance(currentProperty.location.coordinates, nextProperty.location.coordinates);
        }
    }
    return Math.round(totalDistance * 100) / 100; // Round to 2 decimal places
}
function convertRouteToCSV(route) {
    const headers = ['Order', 'Address', 'City', 'State', 'ZIP', 'Property Type', 'Lead Score', 'Status', 'Estimated Duration'];
    const rows = route.stops.map((stop, index) => [
        index + 1,
        stop.propertyId?.address || '',
        stop.propertyId?.city || '',
        stop.propertyId?.state || '',
        stop.propertyId?.zipCode || '',
        stop.propertyId?.propertyType || '',
        stop.propertyId?.leadScore || '',
        stop.status || 'PENDING',
        stop.estimatedDuration || 15,
    ]);
    return [headers, ...rows].map(row => row.join(',')).join('\n');
}
//# sourceMappingURL=route.controller.js.map