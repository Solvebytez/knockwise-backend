import { Request, Response } from "express";
import mongoose from "mongoose";
import { Zone, IZone } from "../models/Zone";
import { User } from "../models/User";
import { AgentZoneAssignment } from "../models/AgentZoneAssignment";
import { AgentTeamAssignment } from "../models/AgentTeamAssignment";
import { Team } from "../models/Team";
import { Resident, IResident } from "../models/Resident";
import { Property } from "../models/Property";
import { Lead } from "../models/Lead";
import { Activity } from "../models/Activity";
import { Route } from "../models/Route";
import { ScheduledAssignment } from "../models/ScheduledAssignment";
import { Area } from "../models/Area";
import { Municipality } from "../models/Municipality";
import { Community } from "../models/Community";
import { AuthRequest } from "../middleware/auth";

// OPTIMIZED: Single aggregation query for listZones with all related data
export const listZonesOptimized = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, teamId, status, showAll, visualization } = req.query;

    // Check if this is a request for all zones (no pagination parameters)
    const isListAll = !page && !limit;

    const filter: any = {};
    if (teamId) filter.teamId = teamId;
    if (status) filter.status = status;

    // Authorization logic: Users should only see zones they have access to
    if (req.user?.role !== "SUPERADMIN" && visualization !== "true") {
      const userFilter = {
        $or: [{ createdBy: req.user?.id }, { assignedAgentId: req.user?.id }],
      };

      if (req.user?.role === "SUBADMIN") {
        const { Team } = require("../models/Team");
        const userTeams = await Team.find({ createdBy: req.user?.id }).select(
          "_id"
        );
        const userTeamIds = userTeams.map((team: any) => team._id);

        if (userTeamIds.length > 0) {
          (userFilter.$or as any[]).push({ teamId: { $in: userTeamIds } });
        }
      }

      if (showAll) {
        Object.assign(filter, userFilter);
      } else {
        if (teamId) {
          const { Team } = require("../models/Team");
          const team = await Team.findById(teamId);
          if (!team || team.createdBy?.toString() !== req.user?.id) {
            return res.status(403).json({
              success: false,
              message:
                "Access denied: You can only view zones for teams you created",
            });
          }
          filter.teamId = teamId;
        } else {
          Object.assign(filter, userFilter);
        }
      }
    }

    // OPTIMIZED: Single aggregation pipeline to get all zone data
    const pipeline = [
      // Match zones based on filter
      { $match: filter },

      // Lookup team information
      {
        $lookup: {
          from: "teams",
          localField: "teamId",
          foreignField: "_id",
          as: "team",
          pipeline: [{ $project: { name: 1 } }],
        },
      },

      // Lookup creator information
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "_id",
          as: "creator",
          pipeline: [{ $project: { name: 1, email: 1 } }],
        },
      },

      // Lookup active assignments
      {
        $lookup: {
          from: "agentzoneassignments",
          let: { zoneId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$zoneId", "$$zoneId"] },
                status: { $nin: ["COMPLETED", "CANCELLED"] },
                effectiveTo: null,
              },
            },
            {
              $lookup: {
                from: "users",
                localField: "agentId",
                foreignField: "_id",
                as: "agent",
                pipeline: [{ $project: { name: 1, email: 1 } }],
              },
            },
            {
              $lookup: {
                from: "teams",
                localField: "teamId",
                foreignField: "_id",
                as: "team",
                pipeline: [{ $project: { name: 1 } }],
              },
            },
          ],
          as: "activeAssignments",
        },
      },

      // Lookup scheduled assignments
      {
        $lookup: {
          from: "scheduledassignments",
          let: { zoneId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$zoneId", "$$zoneId"] },
                status: "PENDING",
              },
            },
            {
              $lookup: {
                from: "users",
                localField: "agentId",
                foreignField: "_id",
                as: "agent",
                pipeline: [{ $project: { name: 1, email: 1 } }],
              },
            },
            {
              $lookup: {
                from: "teams",
                localField: "teamId",
                foreignField: "_id",
                as: "team",
                pipeline: [{ $project: { name: 1 } }],
              },
            },
          ],
          as: "scheduledAssignments",
        },
      },

      // Lookup resident statistics
      {
        $lookup: {
          from: "residents",
          let: { zoneId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$zoneId", "$$zoneId"] },
              },
            },
            {
              $group: {
                _id: null,
                totalResidents: { $sum: 1 },
                activeResidents: {
                  $sum: {
                    $cond: [
                      {
                        $in: [
                          "$status",
                          [
                            "interested",
                            "visited",
                            "callback",
                            "appointment",
                            "follow-up",
                          ],
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ],
          as: "residentStats",
        },
      },

      // Lookup activity statistics
      {
        $lookup: {
          from: "activities",
          let: { zoneId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$zoneId", "$$zoneId"] },
              },
            },
            {
              $group: {
                _id: null,
                totalActivities: { $sum: 1 },
                lastActivity: { $max: "$createdAt" },
              },
            },
          ],
          as: "activityStats",
        },
      },

      // Project and transform the data
      {
        $project: {
          _id: 1,
          name: 1,
          description: 1,
          status: 1,
          buildingData: 1,
          coordinates: 1,
          createdAt: 1,
          updatedAt: 1,
          teamId: 1,
          assignedAgentId: 1,
          createdBy: 1,

          // Transform team data
          team: { $arrayElemAt: ["$team", 0] },

          // Transform creator data
          creator: { $arrayElemAt: ["$creator", 0] },

          // Process assignments
          currentAssignment: {
            $cond: {
              if: { $gt: [{ $size: "$activeAssignments" }, 0] },
              then: {
                $let: {
                  vars: {
                    teamAssignment: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: "$activeAssignments",
                            cond: { $ne: ["$$this.teamId", null] },
                          },
                        },
                        0,
                      ],
                    },
                    individualAssignment: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: "$activeAssignments",
                            cond: {
                              $and: [
                                { $ne: ["$$this.agentId", null] },
                                { $eq: ["$$this.teamId", null] },
                              ],
                            },
                          },
                        },
                        0,
                      ],
                    },
                  },
                  in: {
                    $cond: {
                      if: { $ne: ["$$individualAssignment", null] },
                      then: {
                        _id: "$$individualAssignment._id",
                        agentId: "$$individualAssignment.agent",
                        teamId: null,
                        effectiveFrom: "$$individualAssignment.effectiveFrom",
                        effectiveTo: "$$individualAssignment.effectiveTo",
                        status: "$$individualAssignment.status",
                      },
                      else: {
                        $cond: {
                          if: { $ne: ["$$teamAssignment", null] },
                          then: {
                            _id: "$$teamAssignment._id",
                            agentId: null,
                            teamId: "$$teamAssignment.team",
                            effectiveFrom: "$$teamAssignment.effectiveFrom",
                            effectiveTo: "$$teamAssignment.effectiveTo",
                            status: "$$teamAssignment.status",
                          },
                          else: null,
                        },
                      },
                    },
                  },
                },
              },
              else: {
                $cond: {
                  if: { $gt: [{ $size: "$scheduledAssignments" }, 0] },
                  then: {
                    $let: {
                      vars: {
                        scheduled: {
                          $arrayElemAt: ["$scheduledAssignments", 0],
                        },
                      },
                      in: {
                        _id: "$$scheduled._id",
                        agentId: "$$scheduled.agent",
                        teamId: "$$scheduled.team",
                        effectiveFrom: "$$scheduled.effectiveFrom",
                        effectiveTo: "$$scheduled.effectiveTo",
                        status: "$$scheduled.status",
                      },
                    },
                  },
                  else: null,
                },
              },
            },
          },

          // Process resident statistics
          totalResidents: {
            $ifNull: [
              { $arrayElemAt: ["$residentStats.totalResidents", 0] },
              0,
            ],
          },
          activeResidents: {
            $ifNull: [
              { $arrayElemAt: ["$residentStats.activeResidents", 0] },
              0,
            ],
          },

          // Process activity statistics
          totalActivities: {
            $ifNull: [
              { $arrayElemAt: ["$activityStats.totalActivities", 0] },
              0,
            ],
          },
          lastActivity: {
            $ifNull: [
              { $arrayElemAt: ["$activityStats.lastActivity", 0] },
              null,
            ],
          },

          // Calculate completion rate
          completionRate: {
            $cond: {
              if: {
                $gt: [
                  { $arrayElemAt: ["$residentStats.totalResidents", 0] },
                  0,
                ],
              },
              then: {
                $round: [
                  {
                    $multiply: [
                      {
                        $divide: [
                          {
                            $arrayElemAt: ["$residentStats.activeResidents", 0],
                          },
                          {
                            $arrayElemAt: ["$residentStats.totalResidents", 0],
                          },
                        ],
                      },
                      100,
                    ],
                  },
                ],
              },
              else: 0,
            },
          },

          // Calculate average knocks
          averageKnocks: {
            $cond: {
              if: {
                $gt: [
                  { $arrayElemAt: ["$residentStats.totalResidents", 0] },
                  0,
                ],
              },
              then: {
                $round: [
                  {
                    $divide: [
                      { $arrayElemAt: ["$activityStats.totalActivities", 0] },
                      { $arrayElemAt: ["$residentStats.totalResidents", 0] },
                    ],
                  },
                ],
              },
              else: 0,
            },
          },
        },
      },

      // Sort by creation date
      { $sort: { createdAt: -1 as 1 | -1 } },
    ];

    // Apply pagination if needed
    if (!isListAll) {
      const pageNum = Number(page) || 1;
      const limitNum = Number(limit) || 10;
      const skip = (pageNum - 1) * limitNum;

      pipeline.push({ $skip: skip } as any);
      pipeline.push({ $limit: limitNum } as any);
    }

    // Execute the aggregation
    const zones = await Zone.aggregate(pipeline);

    // Get total count for pagination
    let total = 0;
    if (!isListAll) {
      const countPipeline = [{ $match: filter }, { $count: "total" }];
      const countResult = await Zone.aggregate(countPipeline);
      total = countResult.length > 0 ? countResult[0].total : 0;
    }

    // Transform the data to match the expected format
    const transformedZones = zones.map((zone) => {
      // Calculate zone status based on assignments and completion
      let calculatedStatus = "DRAFT";

      if (zone.buildingData?.houseStatuses) {
        const houseStatuses = Array.from(
          (zone.buildingData.houseStatuses as any).values()
        );
        const totalHouses = houseStatuses.length;
        const finalStatuses = ["visited", "interested", "not-interested"];
        const completedHouses = houseStatuses.filter((house: any) =>
          finalStatuses.includes(house.status)
        ).length;

        if (totalHouses > 0 && completedHouses === totalHouses) {
          calculatedStatus = "COMPLETED";
        } else if (zone.currentAssignment) {
          const assignmentDate = new Date(zone.currentAssignment.effectiveFrom);
          const now = new Date();
          calculatedStatus = assignmentDate > now ? "SCHEDULED" : "ACTIVE";
        }
      } else if (zone.currentAssignment) {
        const assignmentDate = new Date(zone.currentAssignment.effectiveFrom);
        const now = new Date();
        calculatedStatus = assignmentDate > now ? "SCHEDULED" : "ACTIVE";
      }

      return {
        ...zone,
        status: calculatedStatus,
        teamId: zone.team,
        createdBy: zone.creator,
        lastActivityDate: zone.lastActivity || new Date(),
      };
    });

    res.json({
      success: true,
      data: transformedZones,
      ...(isListAll
        ? {}
        : {
            pagination: {
              page: Number(page) || 1,
              limit: Number(limit) || 10,
              total,
              pages: Math.ceil(total / (Number(limit) || 10)),
            },
          }),
    });
  } catch (error) {
    console.error("Error in listZonesOptimized:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
