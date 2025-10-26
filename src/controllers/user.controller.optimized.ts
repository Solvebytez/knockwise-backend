import { Request, Response } from "express";
import { User, IUser } from "../models/User";
import { Team } from "../models/Team";
import { Zone } from "../models/Zone";
import { Resident } from "../models/Resident";
import { AgentZoneAssignment } from "../models/AgentZoneAssignment";
import { AgentTeamAssignment } from "../models/AgentTeamAssignment";
import { ScheduledAssignment } from "../models/ScheduledAssignment";
import { AuthRequest } from "../middleware/auth";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

// OPTIMIZED: Single aggregation query to calculate agent statuses
const calculateAgentStatusesOptimized = async (
  agentIds: string[]
): Promise<Map<string, "ACTIVE" | "INACTIVE">> => {
  try {
    const statusMap = new Map<string, "ACTIVE" | "INACTIVE">();

    // Single aggregation pipeline to get all agent status information
    const agentStatusData = await User.aggregate([
      {
        $match: {
          _id: { $in: agentIds.map((id) => new mongoose.Types.ObjectId(id)) },
          role: "AGENT",
        },
      },
      {
        $lookup: {
          from: "agentzoneassignments",
          let: { agentId: "$_id", teamIds: "$teamIds" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ["$agentId", "$$agentId"] },
                    { $in: ["$teamId", "$$teamIds"] },
                  ],
                },
                status: { $nin: ["COMPLETED", "CANCELLED"] },
                effectiveTo: null,
              },
            },
          ],
          as: "zoneAssignments",
        },
      },
      {
        $lookup: {
          from: "scheduledassignments",
          let: { agentId: "$_id", teamIds: "$teamIds" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ["$agentId", "$$agentId"] },
                    { $in: ["$teamId", "$$teamIds"] },
                  ],
                },
                status: "PENDING",
              },
            },
          ],
          as: "scheduledAssignments",
        },
      },
      {
        $project: {
          _id: 1,
          status: 1,
          zoneIds: 1,
          primaryZoneId: 1,
          hasZoneAssignments: { $gt: [{ $size: "$zoneAssignments" }, 0] },
          hasScheduledAssignments: {
            $gt: [{ $size: "$scheduledAssignments" }, 0],
          },
          hasIndividualZoneIds: {
            $gt: [{ $size: { $ifNull: ["$zoneIds", []] } }, 0],
          },
          hasPrimaryZone: { $ne: ["$primaryZoneId", null] },
        },
      },
    ]);

    // Process results and determine status
    for (const agent of agentStatusData) {
      const shouldBeActive =
        agent.hasIndividualZoneIds ||
        agent.hasPrimaryZone ||
        agent.hasZoneAssignments ||
        agent.hasScheduledAssignments ||
        agent.status === "ACTIVE";

      statusMap.set(
        agent._id.toString(),
        shouldBeActive ? "ACTIVE" : "INACTIVE"
      );
    }

    // Set default INACTIVE for any agents not found in aggregation
    for (const agentId of agentIds) {
      if (!statusMap.has(agentId)) {
        statusMap.set(agentId, "INACTIVE");
      }
    }

    return statusMap;
  } catch (error) {
    console.error("Error calculating agent statuses:", error);
    // Return default INACTIVE status for all agents on error
    const statusMap = new Map<string, "ACTIVE" | "INACTIVE">();
    for (const agentId of agentIds) {
      statusMap.set(agentId, "INACTIVE");
    }
    return statusMap;
  }
};

// OPTIMIZED: Single aggregation query to get assignment statuses
const calculateAssignmentStatusesOptimized = async (
  agentIds: string[]
): Promise<
  Map<string, { assigned: boolean; hasIndividual: boolean; hasTeam: boolean }>
> => {
  try {
    const assignmentMap = new Map<
      string,
      { assigned: boolean; hasIndividual: boolean; hasTeam: boolean }
    >();

    const assignmentData = await User.aggregate([
      {
        $match: {
          _id: { $in: agentIds.map((id) => new mongoose.Types.ObjectId(id)) },
          role: "AGENT",
        },
      },
      {
        $lookup: {
          from: "agentzoneassignments",
          let: { agentId: "$_id", teamIds: "$teamIds" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ["$agentId", "$$agentId"] },
                    { $in: ["$teamId", "$$teamIds"] },
                  ],
                },
                status: { $nin: ["COMPLETED", "CANCELLED"] },
                effectiveTo: null,
              },
            },
          ],
          as: "assignments",
        },
      },
      {
        $project: {
          _id: 1,
          hasIndividual: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: "$assignments",
                    cond: { $eq: ["$$this.agentId", "$_id"] },
                  },
                },
              },
              0,
            ],
          },
          hasTeam: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: "$assignments",
                    cond: { $ne: ["$$this.agentId", "$_id"] },
                  },
                },
              },
              0,
            ],
          },
        },
      },
    ]);

    for (const agent of assignmentData) {
      const assigned = agent.hasIndividual || agent.hasTeam;
      assignmentMap.set(agent._id.toString(), {
        assigned,
        hasIndividual: agent.hasIndividual,
        hasTeam: agent.hasTeam,
      });
    }

    // Set default values for agents not found
    for (const agentId of agentIds) {
      if (!assignmentMap.has(agentId)) {
        assignmentMap.set(agentId, {
          assigned: false,
          hasIndividual: false,
          hasTeam: false,
        });
      }
    }

    return assignmentMap;
  } catch (error) {
    console.error("Error calculating assignment statuses:", error);
    const assignmentMap = new Map<
      string,
      { assigned: boolean; hasIndividual: boolean; hasTeam: boolean }
    >();
    for (const agentId of agentIds) {
      assignmentMap.set(agentId, {
        assigned: false,
        hasIndividual: false,
        hasTeam: false,
      });
    }
    return assignmentMap;
  }
};

// OPTIMIZED: getTeamOverview with single aggregation queries
export const getTeamOverviewOptimized = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const currentUserId = req.user?.sub;

    // Get all agents created by current admin
    const agents = await User.find({
      role: "AGENT",
      createdBy: currentUserId,
    }).select("_id name email status createdAt teamIds zoneIds primaryZoneId");

    const agentIds = agents.map((agent) => (agent._id as any).toString());
    const totalAgents = agents.length;

    // OPTIMIZED: Single aggregation query for all agent statuses
    const agentStatusMap = await calculateAgentStatusesOptimized(agentIds);

    // Count active/inactive agents
    let activeAgents = 0;
    let inactiveAgents = 0;

    for (const agentId of agentIds) {
      const status = agentStatusMap.get(agentId);
      if (status === "ACTIVE") {
        activeAgents++;
      } else {
        inactiveAgents++;
      }
    }

    // Get agents created this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const agentsThisMonth = await User.countDocuments({
      role: "AGENT",
      createdBy: currentUserId,
      createdAt: { $gte: startOfMonth },
    });

    // Get total zones count using role-based filtering (consistent with territory stats)
    const { Zone } = require("../models/Zone");
    const { getRoleBasedFilters } = require("../utils/roleFiltering");

    const { zoneFilter } = await getRoleBasedFilters({
      userId: currentUserId,
      userRole: req.user?.role || "",
      primaryTeamId: req.user?.primaryTeamId,
    });

    const totalZones = await Zone.countDocuments(zoneFilter);

    // OPTIMIZED: Single aggregation query for assignment statuses
    const assignmentStatusMap = await calculateAssignmentStatusesOptimized(
      agentIds
    );

    let assignedAgentsCount = 0;
    let unassignedAgentsCount = 0;
    let agentsWithIndividualAssignments = 0;
    let agentsWithTeamAssignments = 0;

    for (const agentId of agentIds) {
      const assignmentStatus = assignmentStatusMap.get(agentId);
      if (assignmentStatus?.assigned) {
        assignedAgentsCount++;
        if (assignmentStatus.hasIndividual) agentsWithIndividualAssignments++;
        if (assignmentStatus.hasTeam) agentsWithTeamAssignments++;
      } else {
        unassignedAgentsCount++;
      }
    }

    // Get total teams count
    const { Team } = require("../models/Team");
    const totalTeams = await Team.countDocuments({
      createdBy: currentUserId,
    });

    // Get active teams count (teams with zone assignments)
    const activeTeams = await AgentZoneAssignment.distinct("teamId", {
      teamId: { $exists: true },
      status: { $in: ["ACTIVE", "COMPLETED"] },
      effectiveTo: null,
    });

    const activeTeamsCount = activeTeams.length;

    res.json({
      success: true,
      data: {
        totalAgents,
        activeAgents,
        inactiveAgents,
        agentsThisMonth,
        totalZones,
        assignedAgentsCount,
        unassignedAgentsCount,
        agentsWithIndividualAssignments,
        agentsWithTeamAssignments,
        totalTeams,
        activeTeamsCount,
      },
    });
  } catch (error) {
    console.error("Error in getTeamOverview:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// OPTIMIZED: getSystemAnalytics with single aggregation queries
export const getSystemAnalyticsOptimized = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const currentUserId = req.user?.sub;

    // Single aggregation to get all system analytics
    const analytics = await User.aggregate([
      {
        $match: {
          createdBy: currentUserId,
        },
      },
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
          activeCount: {
            $sum: {
              $cond: [{ $eq: ["$status", "ACTIVE"] }, 1, 0],
            },
          },
        },
      },
    ]);

    // Process analytics data
    const analyticsMap = new Map();
    for (const item of analytics) {
      analyticsMap.set(item._id, {
        total: item.count,
        active: item.activeCount,
      });
    }

    const totalUsers = analytics.reduce((sum, item) => sum + item.count, 0);
    const totalTeams = analyticsMap.get("SUBADMIN")?.total || 0;
    // Get total zones count using role-based filtering (consistent with territory stats)
    const { getRoleBasedFilters } = require("../utils/roleFiltering");

    const { zoneFilter } = await getRoleBasedFilters({
      userId: currentUserId,
      userRole: req.user?.role || "",
      primaryTeamId: req.user?.primaryTeamId,
    });

    const totalZones = await Zone.countDocuments(zoneFilter);
    const activeAgents = analyticsMap.get("AGENT")?.active || 0;

    res.json({
      success: true,
      data: {
        totalUsers,
        totalTeams,
        totalZones,
        activeAgents,
      },
    });
  } catch (error) {
    console.error("Error in getSystemAnalytics:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
