"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createActivity = createActivity;
exports.listMyActivities = listMyActivities;
exports.listAllActivities = listAllActivities;
exports.getActivityById = getActivityById;
exports.updateActivity = updateActivity;
exports.deleteActivity = deleteActivity;
exports.getActivityStatistics = getActivityStatistics;
exports.getAgentPerformance = getAgentPerformance;
const Activity_1 = __importDefault(require("../models/Activity"));
const Property_1 = __importDefault(require("../models/Property"));
const Zone_1 = __importDefault(require("../models/Zone"));
const User_1 = __importDefault(require("../models/User"));
async function createActivity(req, res) {
    try {
        const { propertyId, zoneId, startedAt, endedAt, durationSeconds, response, notes, } = req.body;
        // Validate property exists
        const property = await Property_1.default.findById(propertyId);
        if (!property) {
            res.status(404).json({ success: false, message: "Property not found" });
            return;
        }
        // Validate zone if provided
        if (zoneId) {
            const zone = await Zone_1.default.findById(zoneId);
            if (!zone) {
                res.status(404).json({ success: false, message: "Zone not found" });
                return;
            }
        }
        // Calculate duration if not provided
        let calculatedDuration = durationSeconds;
        if (!durationSeconds && startedAt && endedAt) {
            const start = new Date(startedAt);
            const end = new Date(endedAt);
            calculatedDuration = Math.floor((end.getTime() - start.getTime()) / 1000);
        }
        const activity = await Activity_1.default.create({
            agentId: req.user.sub,
            propertyId,
            zoneId: zoneId || property.zoneId,
            startedAt: startedAt || new Date(),
            endedAt: endedAt || new Date(),
            durationSeconds: calculatedDuration,
            response,
            notes,
        });
        const populatedActivity = await Activity_1.default.findById(activity._id)
            .populate("propertyId")
            .populate("zoneId", "name")
            .populate("agentId", "name email");
        res.status(201).json({
            success: true,
            message: "Activity created successfully",
            data: populatedActivity,
        });
    }
    catch (error) {
        console.error("Error creating activity:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create activity",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
}
async function listMyActivities(req, res) {
    try {
        const { page = 1, limit = 10, response, startDate, endDate, zoneId, } = req.query;
        const filter = { agentId: req.user.sub };
        if (response)
            filter.response = response;
        if (zoneId)
            filter.zoneId = zoneId;
        if (startDate || endDate) {
            filter.startedAt = {};
            if (startDate)
                filter.startedAt.$gte = new Date(startDate);
            if (endDate)
                filter.startedAt.$lte = new Date(endDate);
        }
        const skip = (Number(page) - 1) * Number(limit);
        const activities = await Activity_1.default.find(filter)
            .populate("propertyId")
            .populate("zoneId", "name")
            .populate("agentId", "name email")
            .sort({ startedAt: -1 })
            .skip(skip)
            .limit(Number(limit));
        const total = await Activity_1.default.countDocuments(filter);
        res.json({
            success: true,
            data: activities,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    }
    catch (error) {
        console.error("Error listing activities:", error);
        res.status(500).json({
            success: false,
            message: "Failed to list activities",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
}
async function listAllActivities(req, res) {
    try {
        const { page = 1, limit = 10, agentId, response, startDate, endDate, zoneId, teamId, } = req.query;
        const filter = {};
        if (agentId)
            filter.agentId = agentId;
        if (response)
            filter.response = response;
        if (zoneId)
            filter.zoneId = zoneId;
        if (startDate || endDate) {
            filter.startedAt = {};
            if (startDate)
                filter.startedAt.$gte = new Date(startDate);
            if (endDate)
                filter.startedAt.$lte = new Date(endDate);
        }
        // Filter by team if user is SUBADMIN
        if (req.user?.role === "SUBADMIN" && teamId) {
            filter.teamId = teamId;
        }
        const skip = (Number(page) - 1) * Number(limit);
        const activities = await Activity_1.default.find(filter)
            .populate("propertyId")
            .populate("zoneId", "name")
            .populate("agentId", "name email")
            .sort({ startedAt: -1 })
            .skip(skip)
            .limit(Number(limit));
        const total = await Activity_1.default.countDocuments(filter);
        res.json({
            success: true,
            data: activities,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    }
    catch (error) {
        console.error("Error listing all activities:", error);
        res.status(500).json({
            success: false,
            message: "Failed to list activities",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
}
async function getActivityById(req, res) {
    try {
        const { id } = req.params;
        const activity = await Activity_1.default.findById(id)
            .populate("propertyId")
            .populate("zoneId", "name")
            .populate("agentId", "name email");
        if (!activity) {
            res.status(404).json({ success: false, message: "Activity not found" });
            return;
        }
        // Check if user has permission to view this activity
        if (req.user?.role === "AGENT" &&
            activity.agentId.toString() !== req.user.sub) {
            res
                .status(403)
                .json({ success: false, message: "Insufficient permissions" });
            return;
        }
        res.json({
            success: true,
            data: activity,
        });
    }
    catch (error) {
        console.error("Error getting activity:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get activity",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
}
async function updateActivity(req, res) {
    try {
        const { id } = req.params;
        const { response, notes, endedAt, durationSeconds } = req.body;
        const activity = await Activity_1.default.findById(id);
        if (!activity) {
            res.status(404).json({ success: false, message: "Activity not found" });
            return;
        }
        // Check if user has permission to update this activity
        if (req.user?.role === "AGENT" &&
            activity.agentId.toString() !== req.user.sub) {
            res
                .status(403)
                .json({ success: false, message: "Insufficient permissions" });
            return;
        }
        const updateData = {};
        if (response)
            updateData.response = response;
        if (notes !== undefined)
            updateData.notes = notes;
        if (endedAt)
            updateData.endedAt = endedAt;
        if (durationSeconds)
            updateData.durationSeconds = durationSeconds;
        const updatedActivity = await Activity_1.default.findByIdAndUpdate(id, updateData, {
            new: true,
        })
            .populate("propertyId")
            .populate("zoneId", "name")
            .populate("agentId", "name email");
        res.json({
            success: true,
            message: "Activity updated successfully",
            data: updatedActivity,
        });
    }
    catch (error) {
        console.error("Error updating activity:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update activity",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
}
async function deleteActivity(req, res) {
    try {
        const { id } = req.params;
        const activity = await Activity_1.default.findById(id);
        if (!activity) {
            res.status(404).json({ success: false, message: "Activity not found" });
            return;
        }
        // Check if user has permission to delete this activity
        if (req.user?.role === "AGENT" &&
            activity.agentId.toString() !== req.user.sub) {
            res
                .status(403)
                .json({ success: false, message: "Insufficient permissions" });
            return;
        }
        await Activity_1.default.findByIdAndDelete(id);
        res.json({
            success: true,
            message: "Activity deleted successfully",
        });
    }
    catch (error) {
        console.error("Error deleting activity:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete activity",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
}
async function getActivityStatistics(req, res) {
    try {
        const { startDate, endDate, agentId, zoneId, teamId } = req.query;
        const filter = {};
        if (agentId)
            filter.agentId = agentId;
        if (zoneId)
            filter.zoneId = zoneId;
        if (startDate || endDate) {
            filter.startedAt = {};
            if (startDate)
                filter.startedAt.$gte = new Date(startDate);
            if (endDate)
                filter.startedAt.$lte = new Date(endDate);
        }
        // Filter by team if user is SUBADMIN
        if (req.user?.role === "SUBADMIN") {
            // Get user's primary team if no specific teamId provided
            const user = await User_1.default.findById(req.user.sub);
            if (user?.primaryTeamId) {
                filter.teamId = teamId || user.primaryTeamId;
            }
            else if (teamId) {
                filter.teamId = teamId;
            }
            // If no teamId and no primaryTeamId, filter by activities created by this admin's agents
            else {
                const adminAgents = await User_1.default.find({
                    createdBy: req.user.sub,
                    role: "AGENT",
                }).select("_id");
                filter.agentId = { $in: adminAgents.map((agent) => agent._id) };
            }
        }
        const activities = await Activity_1.default.find(filter);
        const totalActivities = activities.length;
        const totalDuration = activities.reduce((sum, activity) => sum + activity.durationSeconds, 0);
        // Calculate response statistics
        const responseStats = activities.reduce((stats, activity) => {
            stats[activity.response] = (stats[activity.response] || 0) + 1;
            return stats;
        }, {});
        // Calculate daily statistics
        const dailyStats = {};
        activities.forEach((activity) => {
            const dateString = activity.startedAt.toISOString().split("T")[0];
            if (dateString) {
                if (!dailyStats[dateString]) {
                    dailyStats[dateString] = {
                        total: 0,
                        duration: 0,
                        responses: {},
                    };
                }
                const dayStats = dailyStats[dateString];
                if (dayStats) {
                    dayStats.total += 1;
                    dayStats.duration += activity.durationSeconds;
                    dayStats.responses[activity.response] =
                        (dayStats.responses[activity.response] || 0) + 1;
                }
            }
        });
        res.json({
            success: true,
            data: {
                totalActivities,
                totalDuration,
                averageDuration: totalActivities > 0 ? Math.round(totalDuration / totalActivities) : 0,
                responseStats,
                dailyStats,
                timeRange: {
                    startDate: startDate || null,
                    endDate: endDate || null,
                },
            },
        });
    }
    catch (error) {
        console.error("Error getting activity statistics:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get activity statistics",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
}
async function getAgentPerformance(req, res) {
    try {
        const { agentId, startDate, endDate } = req.query;
        const filter = {};
        if (agentId) {
            filter.agentId = agentId;
        }
        else if (req.user?.role === "AGENT") {
            filter.agentId = req.user.sub;
        }
        if (startDate || endDate) {
            filter.startedAt = {};
            if (startDate)
                filter.startedAt.$gte = new Date(startDate);
            if (endDate)
                filter.startedAt.$lte = new Date(endDate);
        }
        const activities = await Activity_1.default.find(filter)
            .populate("propertyId")
            .populate("zoneId", "name")
            .sort({ startedAt: -1 });
        const totalActivities = activities.length;
        const totalDuration = activities.reduce((sum, activity) => sum + activity.durationSeconds, 0);
        const averageDuration = totalActivities > 0 ? Math.round(totalDuration / totalActivities) : 0;
        // Calculate response rates
        const responseStats = activities.reduce((stats, activity) => {
            stats[activity.response] = (stats[activity.response] || 0) + 1;
            return stats;
        }, {});
        // Calculate conversion rate (LEAD_CREATED / total)
        const conversionRate = totalActivities > 0
            ? Math.round(((responseStats.LEAD_CREATED || 0) / totalActivities) * 100)
            : 0;
        res.json({
            success: true,
            data: {
                agentId: agentId || req.user?.sub,
                totalActivities,
                totalDuration,
                averageDuration,
                conversionRate,
                responseStats,
                activities: activities.slice(0, 50), // Return last 50 activities
            },
        });
    }
    catch (error) {
        console.error("Error getting agent performance:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get agent performance",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
}
//# sourceMappingURL=activity.controller.js.map