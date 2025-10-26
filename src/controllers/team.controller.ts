import { Request, Response } from "express";
import { Team, ITeam } from "../models/Team";
import { User } from "../models/User";
import { Resident } from "../models/Resident";
import { AgentTeamAssignment } from "../models/AgentTeamAssignment";
import { AgentZoneAssignment } from "../models/AgentZoneAssignment";
import { ScheduledAssignment } from "../models/ScheduledAssignment";
import { Zone } from "../models/Zone";
import { Activity } from "../models/Activity";
import { Performance } from "../models/Performance";
import { Route } from "../models/Route";
import { AuthRequest } from "../middleware/auth";
import mongoose from "mongoose";

// Import updateAgentStatus from user controller
const { updateAgentStatus } = require("./user.controller");

// Import updateUserAssignmentStatus from assignment controller
const { updateUserAssignmentStatus } = require("./assignment.controller");

// Import syncAgentZoneIds function from assignment controller
const syncAgentZoneIds = async (agentId: string) => {
  try {
    // Get all active assignments for this agent (individual and team-based)
    const individualAssignments = await AgentZoneAssignment.find({
      agentId: agentId,
      status: { $nin: ["COMPLETED", "CANCELLED"] },
      effectiveTo: null,
    }).populate("zoneId", "_id");

    const agent = await User.findById(agentId);
    if (!agent) {
      console.warn(`Agent ${agentId} not found during zone sync`);
      return;
    }

    // Get team-based assignments for this agent's teams
    const teamAssignments = await AgentZoneAssignment.find({
      teamId: { $in: agent.teamIds },
      status: { $nin: ["COMPLETED", "CANCELLED"] },
      effectiveTo: null,
    }).populate("zoneId", "_id");

    // Combine all zone IDs from both individual and team assignments
    const allZoneIds = [
      ...individualAssignments.map((a) => a.zoneId._id.toString()),
      ...teamAssignments.map((a) => a.zoneId._id.toString()),
    ];

    // Remove duplicates
    const uniqueZoneIds = [...new Set(allZoneIds)];

    // Update the agent's zoneIds to match all current assignments
    await User.findByIdAndUpdate(agentId, {
      zoneIds: uniqueZoneIds,
    });

    console.log(
      `Synced zoneIds for agent ${agent.name}: ${uniqueZoneIds.length} zones`
    );
  } catch (error) {
    console.error("Error syncing agent zoneIds:", error);
    // Don't throw error to prevent transaction rollback, but log it
  }
};

// Helper function to log team changes for audit
const logTeamChange = async (
  action: string,
  teamId: string,
  details: any,
  currentUserId: string
) => {
  try {
    console.log(`[AUDIT] Team ${action}:`, {
      teamId,
      action,
      details,
      performedBy: currentUserId,
      timestamp: new Date().toISOString(),
    });
    // TODO: Add to database audit log table in future
  } catch (error) {
    console.error("Error logging team change:", error);
  }
};

// Helper function to validate team data consistency
const validateTeamConsistency = async (teamId: string): Promise<boolean> => {
  try {
    const team = await Team.findById(teamId).populate("agentIds");
    if (!team) return false;

    // Check if all team members exist
    const memberIds = team.agentIds.map((agent: any) => agent._id);
    const existingMembers = await User.countDocuments({
      _id: { $in: memberIds },
      role: "AGENT",
    });

    if (existingMembers !== memberIds.length) {
      console.error(
        `Team ${teamId} has ${
          memberIds.length - existingMembers
        } invalid members`
      );
      return false;
    }

    // Check if team assignments are consistent
    const teamAssignments = await AgentTeamAssignment.find({ teamId });
    const assignmentMemberIds = teamAssignments.map((a) =>
      a.agentId.toString()
    );

    const missingAssignments = memberIds.filter(
      (id) => !assignmentMemberIds.includes(id.toString())
    );
    const extraAssignments = assignmentMemberIds.filter(
      (id) => !memberIds.map((m) => m.toString()).includes(id)
    );

    if (missingAssignments.length > 0 || extraAssignments.length > 0) {
      console.error(
        `Team ${teamId} has inconsistent assignments. Missing: ${missingAssignments.length}, Extra: ${extraAssignments.length}`
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error validating team consistency:", error);
    return false;
  }
};

// Helper function to calculate team status based on zone assignments
const calculateTeamStatus = async (
  teamId: string
): Promise<"ACTIVE" | "INACTIVE"> => {
  try {
    // Import ScheduledAssignment model
    const { ScheduledAssignment } = require("../models/ScheduledAssignment");

    // Check if team has any zone assignments (exclude COMPLETED and CANCELLED)
    const teamZoneAssignments = await AgentZoneAssignment.find({
      teamId: teamId,
      status: { $nin: ["COMPLETED", "CANCELLED"] },
      effectiveTo: null,
    });

    // Check if team has any PENDING scheduled assignments
    const scheduledAssignments = await ScheduledAssignment.find({
      teamId: teamId,
      status: "PENDING",
    });

    // Team is ACTIVE if it has any zone assignments (active or scheduled)
    const hasZoneAssignment =
      teamZoneAssignments.length > 0 || scheduledAssignments.length > 0;

    return hasZoneAssignment ? "ACTIVE" : "INACTIVE";
  } catch (error) {
    console.error("Error calculating team status:", error);
    return "INACTIVE";
  }
};

// Helper function to calculate agent status (imported from user controller)
const calculateAgentStatus = async (
  agentId: string
): Promise<"ACTIVE" | "INACTIVE"> => {
  try {
    const agent = await User.findById(agentId);
    if (!agent || agent.role !== "AGENT") return "INACTIVE";

    // Import ScheduledAssignment model
    const { ScheduledAssignment } = require("../models/ScheduledAssignment");

    // Check individual zone assignments
    const hasIndividualZoneAssignment =
      agent.zoneIds && agent.zoneIds.length > 0;
    const hasIndividualPrimaryZone =
      agent.primaryZoneId !== null && agent.primaryZoneId !== undefined;

    // Check team zone assignments (exclude COMPLETED and CANCELLED)
    const teamZoneAssignments = await AgentZoneAssignment.find({
      teamId: { $in: agent.teamIds },
      status: { $nin: ["COMPLETED", "CANCELLED"] },
      effectiveTo: null,
    });

    const hasTeamZoneAssignment = teamZoneAssignments.length > 0;

    // Check individual zone assignments (exclude COMPLETED and CANCELLED)
    const individualZoneAssignments = await AgentZoneAssignment.find({
      agentId: agent._id,
      status: { $nin: ["COMPLETED", "CANCELLED"] },
      effectiveTo: null,
    });

    const hasActiveIndividualZoneAssignment =
      individualZoneAssignments.length > 0;

    // Check PENDING scheduled assignments (individual)
    const pendingIndividualScheduledAssignments =
      await ScheduledAssignment.find({
        agentId: agent._id,
        status: "PENDING",
      });

    const hasPendingIndividualScheduledAssignment =
      pendingIndividualScheduledAssignments.length > 0;

    // Check PENDING scheduled assignments (team)
    const pendingTeamScheduledAssignments = await ScheduledAssignment.find({
      teamId: { $in: agent.teamIds },
      status: "PENDING",
    });

    const hasPendingTeamScheduledAssignment =
      pendingTeamScheduledAssignments.length > 0;

    // Agent is ACTIVE if:
    // 1. Has individual zone assignment (primaryZoneId or zoneIds), OR
    // 2. Has active individual zone assignments, OR
    // 3. Is part of a team that has zone assignments, OR
    // 4. Has PENDING scheduled individual assignments, OR
    // 5. Is part of a team that has PENDING scheduled assignments
    const shouldBeActive =
      hasIndividualZoneAssignment ||
      hasIndividualPrimaryZone ||
      hasActiveIndividualZoneAssignment ||
      hasTeamZoneAssignment ||
      hasPendingIndividualScheduledAssignment ||
      hasPendingTeamScheduledAssignment;

    return shouldBeActive ? "ACTIVE" : "INACTIVE";
  } catch (error) {
    console.error("Error calculating agent status:", error);
    return "INACTIVE";
  }
};

// Helper function to update team status based on zone assignments
const updateTeamStatus = async (teamId: string) => {
  try {
    const team = await Team.findById(teamId);
    if (!team) return;

    const calculatedStatus = await calculateTeamStatus(teamId);

    if (calculatedStatus !== team.status) {
      await Team.findByIdAndUpdate(teamId, { status: calculatedStatus });
      console.log(
        `Team ${team.name} (${teamId}) status updated to ${calculatedStatus}`
      );
    }
  } catch (error) {
    console.error("Error updating team status:", error);
  }
};

// Helper function to update team assignment status based on zone assignments
const updateTeamAssignmentStatus = async (
  teamId: string,
  session?: mongoose.ClientSession
) => {
  try {
    const team = await Team.findById(teamId);
    if (!team) return;

    // Check if team has any active zone assignments (exclude COMPLETED and CANCELLED)
    const activeZoneAssignments = await AgentZoneAssignment.find({
      teamId: teamId,
      status: { $nin: ["COMPLETED", "CANCELLED"] },
      effectiveTo: null,
    });

    // Check if team has any PENDING scheduled assignments
    const { ScheduledAssignment } = require("../models/ScheduledAssignment");
    const scheduledAssignments = await ScheduledAssignment.find({
      teamId: teamId,
      status: "PENDING",
    });

    // Team is ASSIGNED if it has any zone assignments (active or scheduled)
    const hasZoneAssignment =
      activeZoneAssignments.length > 0 || scheduledAssignments.length > 0;
    const newAssignmentStatus = hasZoneAssignment ? "ASSIGNED" : "UNASSIGNED";

    if (newAssignmentStatus !== team.assignmentStatus) {
      const updateOptions = session ? { session } : {};
      await Team.findByIdAndUpdate(
        teamId,
        { assignmentStatus: newAssignmentStatus },
        updateOptions
      );
      console.log(
        `Team ${team.name} (${teamId}) assignment status updated to ${newAssignmentStatus}`
      );
    }
  } catch (error) {
    console.error("Error updating team assignment status:", error);
  }
};

// Create a new team
export const createTeam = async (req: AuthRequest, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { name, description, memberIds, agentIds } = req.body;
    const memberIdsToUse = memberIds || agentIds; // Handle both field names
    const currentUserId = req.user?.sub;

    // Input validation
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Team name is required and must be a non-empty string",
      });
    }

    if (name.trim().length > 100) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Team name must be less than 100 characters",
      });
    }

    if (
      description &&
      typeof description === "string" &&
      description.length > 500
    ) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Team description must be less than 500 characters",
      });
    }

    if (
      !memberIdsToUse ||
      !Array.isArray(memberIdsToUse) ||
      memberIdsToUse.length === 0
    ) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "At least one team member is required",
      });
    }

    if (memberIdsToUse.length > 20) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Team cannot have more than 20 members",
      });
    }

    // Check if team name already exists globally
    const existingTeam = await Team.findOne({
      name,
    }).session(session);

    if (existingTeam) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: "Team with this name already exists",
      });
    }

    // Validate that all member IDs are valid and belong to agents created by this admin
    if (memberIdsToUse && memberIdsToUse.length > 0) {
      const validMembers = await User.find({
        _id: { $in: memberIdsToUse },
        role: "AGENT",
        createdBy: currentUserId,
      })
        .populate("teamIds", "name status")
        .session(session);

      if (validMembers.length !== memberIdsToUse.length) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message:
            "Some member IDs are invalid or do not belong to agents created by you",
        });
      }

      // Enhanced validation with contextual logic
      if (memberIdsToUse.length === 0) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Team must have at least one member",
        });
      }

      // Check if members already have active assignments (contextual warning)
      const membersWithActiveAssignments = await AgentZoneAssignment.find({
        agentId: { $in: memberIdsToUse },
        status: { $nin: ["COMPLETED", "CANCELLED"] },
        effectiveTo: null,
      }).session(session);

      // Check if members have scheduled assignments
      const { ScheduledAssignment } = require("../models/ScheduledAssignment");
      const membersWithScheduledAssignments = await ScheduledAssignment.find({
        agentId: { $in: memberIdsToUse },
        status: "PENDING",
      }).session(session);

      // Collect warnings for admin
      const warnings = [];
      if (membersWithActiveAssignments.length > 0) {
        warnings.push(
          `${membersWithActiveAssignments.length} members have active zone assignments`
        );
      }
      if (membersWithScheduledAssignments.length > 0) {
        warnings.push(
          `${membersWithScheduledAssignments.length} members have scheduled assignments`
        );
      }

      // Check if any members already belong to other teams
      const membersWithOtherTeams = await User.find({
        _id: { $in: memberIdsToUse },
        teamIds: { $exists: true, $ne: [] },
      }).session(session);

      if (membersWithOtherTeams.length > 0) {
        warnings.push(
          `${membersWithOtherTeams.length} members already belong to other teams`
        );
      }

      // Select team leader based on custom logic
      // Priority: 1. Most experienced agent (based on creation date), 2. First in list
      const sortedMembers = validMembers.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      const teamLeaderId = sortedMembers[0]?._id;

      // Create the team
      const team = new Team({
        name,
        description,
        status: "INACTIVE", // Will be updated when zone assignments are made
        createdBy: currentUserId,
        leaderId: teamLeaderId,
        agentIds: memberIdsToUse,
      });

      await team.save({ session });

      // Create team assignments for all members
      const teamAssignments = memberIdsToUse.map(
        (agentId: mongoose.Types.ObjectId) => ({
          agentId,
          teamId: team._id,
          effectiveFrom: new Date(),
          status: "ACTIVE" as const,
          assignedBy: currentUserId,
        })
      );

      await AgentTeamAssignment.insertMany(teamAssignments, { session });

      // Enhanced member assignment with contextual logic
      // Split members based on existing primary team
      const membersWithoutPrimary = await User.find({
        _id: { $in: memberIdsToUse },
        $or: [{ primaryTeamId: { $exists: false } }, { primaryTeamId: null }],
      }).session(session);

      const membersWithPrimary = memberIdsToUse.filter(
        (id) =>
          !membersWithoutPrimary.some(
            (m: any) => m._id.toString() === id.toString()
          )
      );

      // Set primary team only for members who don't have one
      if (membersWithoutPrimary.length > 0) {
        await User.updateMany(
          { _id: { $in: membersWithoutPrimary.map((m: any) => m._id) } },
          {
            $addToSet: { teamIds: team._id },
            $set: { primaryTeamId: team._id },
          },
          { session }
        );
      }

      // Just add to teamIds for members who already have primary
      if (membersWithPrimary.length > 0) {
        await User.updateMany(
          { _id: { $in: membersWithPrimary } },
          { $addToSet: { teamIds: team._id } },
          { session }
        );
      }

      // Zone inheritance logic: Check if members have zones from other teams
      for (const memberId of memberIdsToUse) {
        const agent = await User.findById(memberId).session(session);
        if (agent && agent.teamIds && agent.teamIds.length > 0) {
          // Get zones from other teams this member belongs to
          const otherTeamZones = await AgentZoneAssignment.find({
            teamId: { $in: agent.teamIds },
            status: { $nin: ["COMPLETED", "CANCELLED"] },
            effectiveTo: null,
          }).session(session);

          // Add these zones to the new team (if not already assigned)
          for (const zoneAssignment of otherTeamZones) {
            const existingAssignment = await AgentZoneAssignment.findOne({
              teamId: team._id,
              zoneId: zoneAssignment.zoneId,
              status: { $nin: ["COMPLETED", "CANCELLED"] },
              effectiveTo: null,
            }).session(session);

            if (!existingAssignment) {
              await AgentZoneAssignment.create(
                [
                  {
                    teamId: team._id,
                    zoneId: zoneAssignment.zoneId,
                    status: "ACTIVE",
                    effectiveFrom: new Date(),
                    assignedBy: currentUserId,
                  },
                ],
                { session }
              );
            }
          }
        }
      }

      await session.commitTransaction();

      // Post-creation status synchronization
      await Promise.all(
        memberIdsToUse.map((memberId) => {
          return Promise.all([
            syncAgentZoneIds(memberId),
            updateAgentStatus(memberId),
            updateUserAssignmentStatus(memberId),
          ]);
        })
      );

      // Update team status based on zone assignments
      await updateTeamStatus((team as any)._id.toString());
      await updateTeamAssignmentStatus((team as any)._id.toString(), session);

      // Log team creation for audit with enhanced details
      await logTeamChange(
        "CREATED",
        (team as any)._id.toString(),
        {
          name: team.name,
          description: team.description,
          leaderId: team.leaderId,
          memberCount: memberIdsToUse.length,
          members: memberIdsToUse,
          membersWithoutPrimary: membersWithoutPrimary.length,
          membersWithPrimary: membersWithPrimary.length,
          warnings: warnings,
        },
        currentUserId || "unknown"
      );

      // Populate the response with member details
      const populatedTeam = await Team.findById(team._id)
        .populate("leaderId", "name email")
        .populate("agentIds", "name email status")
        .populate("createdBy", "name email");

      res.status(201).json({
        success: true,
        message: "Team created successfully",
        data: {
          team: populatedTeam,
          contextualInfo: {
            membersAdded: memberIdsToUse.length,
            membersWithoutPrimaryTeam: membersWithoutPrimary.length,
            membersWithExistingPrimary: membersWithPrimary.length,
            membersWithActiveAssignments: membersWithActiveAssignments.length,
            membersWithScheduledAssignments:
              membersWithScheduledAssignments.length,
            membersWithOtherTeams: membersWithOtherTeams.length,
            warnings: warnings.length > 0 ? warnings : null,
          },
        },
      });
    } else {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "At least one team member is required",
      });
    }
  } catch (error) {
    await session.abortTransaction();
    console.error("Error creating team:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create team",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  } finally {
    session.endSession();
  }
};

// Get all teams for current admin
export const getMyTeams = async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const currentUserId = req.user?.sub;

    const filter: any = {
      createdBy: currentUserId,
    };

    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    const teams = await Team.find(filter)
      .populate("leaderId", "name email")
      .populate("agentIds", "name email status")
      .populate("createdBy", "name email")
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    // Filter out teams that have no members
    const teamsWithMembers = teams.filter(
      (team) => team.agentIds && team.agentIds.length > 0
    );

    // Import ScheduledAssignment model
    const { ScheduledAssignment } = require("../models/ScheduledAssignment");

    // Calculate correct status and zone coverage for each team
    const teamsWithCorrectStatus = await Promise.all(
      teamsWithMembers.map(async (team) => {
        const calculatedStatus = await calculateTeamStatus(
          (team._id as any).toString()
        );

        // Get zone assignments for this team (active and scheduled)
        const activeZoneAssignments = await AgentZoneAssignment.find({
          teamId: team._id,
          status: { $nin: ["COMPLETED", "CANCELLED"] },
          effectiveTo: null,
        }).populate("zoneId", "name");

        const scheduledZoneAssignments = await ScheduledAssignment.find({
          teamId: team._id,
          status: "PENDING",
        }).populate("zoneId", "name");

        // Combine all zone assignments
        const zoneAssignments = [
          ...activeZoneAssignments,
          ...scheduledZoneAssignments,
        ];

        // Calculate zone coverage
        const uniqueZones = new Set();
        zoneAssignments.forEach((assignment: any) => {
          if (assignment.zoneId) {
            uniqueZones.add(assignment.zoneId._id.toString());
          }
        });
        const zoneCoverage = uniqueZones.size;

        return {
          ...team.toObject(),
          status: calculatedStatus, // Use calculated status instead of stored status
          performance: {
            totalMembers: team.agentIds.length,
            activeMembers: 0, // Will be calculated by frontend
            averageKnocks: 0,
            completionRate: 0,
            zoneCoverage, // Add zone coverage for table display
          },
        };
      })
    );

    // Count total teams with members for pagination
    const allTeamsWithMembers = await Team.find(filter)
      .populate("agentIds")
      .then((teams) =>
        teams.filter((team) => team.agentIds && team.agentIds.length > 0)
      );
    const total = allTeamsWithMembers.length;

    res.json({
      success: true,
      data: teamsWithCorrectStatus,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Error getting teams:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get teams",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get team by ID with detailed information
export const getTeamById = async (req: AuthRequest, res: Response) => {
  try {
    const { teamId } = req.params;
    const currentUserId = req.user?.sub;
    const currentUserRole = req.user?.role;

    // Build query based on user role
    let query: any = { _id: teamId };

    // For admins: only show teams they created
    if (currentUserRole === "SUPERADMIN" || currentUserRole === "SUBADMIN") {
      query.createdBy = currentUserId;
    }
    // For agents: show teams they are members of (no createdBy filter)
    // Agents can view any team they belong to

    const team = await Team.findOne(query)
      .populate("leaderId", "name email")
      .populate("agentIds", "name email status assignmentStatus userType")
      .populate("createdBy", "name email");

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    // For agents: verify they are actually a member of this team
    if (currentUserRole === "AGENT") {
      const isMember = team.agentIds.some(
        (agent: any) => agent._id.toString() === currentUserId
      );
      if (!isMember) {
        return res.status(403).json({
          success: false,
          message: "You are not a member of this team",
        });
      }
    }

    // Get performance data for this specific team
    const teamAgentIds = team.agentIds.map((agent: any) => agent._id);

    // Get performance data for team members
    const performanceData = await Performance.aggregate([
      {
        $match: {
          agentId: { $in: teamAgentIds },
        },
      },
      {
        $group: {
          _id: null,
          totalVisits: { $sum: "$totalVisits" },
          totalAppointments: { $sum: "$appointments" },
          totalLeads: { $sum: "$leadsCreated" },
          totalDuration: { $sum: "$totalDurationSeconds" },
        },
      },
    ]);

    // Get route completion data for this team
    const routeData = await Route.aggregate([
      {
        $match: {
          teamId: team._id,
          status: {
            $in: ["COMPLETED", "IN_PROGRESS", "CANCELLED", "ARCHIVED"],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalRoutes: { $sum: 1 },
          completedRoutes: {
            $sum: {
              $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0],
            },
          },
        },
      },
    ]);

    // Import ScheduledAssignment model
    const { ScheduledAssignment } = require("../models/ScheduledAssignment");

    // Get zone assignments for this team (active and scheduled)
    const activeZoneAssignments = await AgentZoneAssignment.find({
      teamId: team._id,
      status: { $nin: ["COMPLETED", "CANCELLED"] },
      effectiveTo: null,
    }).populate("zoneId", "name");

    const scheduledZoneAssignments = await ScheduledAssignment.find({
      teamId: team._id,
      status: "PENDING",
    }).populate("zoneId", "name");

    // Combine all zone assignments
    const zoneAssignments = [
      ...activeZoneAssignments,
      ...scheduledZoneAssignments,
    ];

    // Calculate performance metrics
    let averageKnocks = 0;
    let completionRate = 0;
    let zoneCoverage = 0;

    if (performanceData.length > 0 && performanceData[0].totalVisits > 0) {
      const data = performanceData[0];
      averageKnocks = data.totalVisits;
      completionRate = Math.round(
        ((data.totalAppointments + data.totalLeads) / data.totalVisits) * 100
      );
    }

    // Calculate route completion rate
    let routeCompletionRate = 0;
    if (routeData.length > 0 && routeData[0].totalRoutes > 0) {
      routeCompletionRate = Math.round(
        (routeData[0].completedRoutes / routeData[0].totalRoutes) * 100
      );
    }

    // Use route completion rate if available, otherwise use performance completion rate
    const finalCompletionRate =
      routeCompletionRate > 0 ? routeCompletionRate : completionRate;

    // Calculate zone coverage
    const uniqueZones = new Set();
    zoneAssignments.forEach((assignment: any) => {
      if (assignment.zoneId) {
        uniqueZones.add(assignment.zoneId._id.toString());
      }
    });
    zoneCoverage = uniqueZones.size;

    // Calculate correct status for each member and count active members
    const membersWithCorrectStatus = await Promise.all(
      team.agentIds.map(async (agent: any) => {
        const calculatedStatus = await calculateAgentStatus(
          agent._id.toString()
        );
        return {
          ...agent.toObject(),
          status: calculatedStatus, // Use calculated status instead of stored status
          assignmentStatus: agent.assignmentStatus, // Preserve the assignmentStatus from the populated data
        };
      })
    );

    const activeMembersCount = membersWithCorrectStatus.filter(
      (member) => member.status === "ACTIVE"
    ).length;
    const totalMembers = team.agentIds.length;

    // Calculate correct team status
    const calculatedTeamStatus = await calculateTeamStatus(
      (team._id as any).toString()
    );

    // Add performance data to team object
    const teamWithPerformance = {
      ...team.toObject(),
      status: calculatedTeamStatus, // Use calculated status
      agentIds: membersWithCorrectStatus, // Use members with correct status
      performance: {
        totalMembers,
        activeMembers: activeMembersCount,
        averageKnocks,
        completionRate: finalCompletionRate,
        zoneCoverage,
        totalRoutes: routeData.length > 0 ? routeData[0].totalRoutes : 0,
        completedRoutes:
          routeData.length > 0 ? routeData[0].completedRoutes : 0,
        zoneAssignments: zoneAssignments.map((assignment: any) => ({
          zoneName: assignment.zoneId?.name || "Unknown Zone",
          status: assignment.status,
        })),
      },
    };

    res.json({
      success: true,
      data: teamWithPerformance,
    });
  } catch (error) {
    console.error("Error getting team:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get team",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Update team
export const updateTeam = async (req: AuthRequest, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { teamId } = req.params;
    const { name, description, memberIds, agentIds } = req.body;
    const memberIdsToUse = memberIds || agentIds; // Handle both field names
    const currentUserId = req.user?.sub;

    const team = await Team.findOne({
      _id: teamId,
      createdBy: currentUserId,
    }).session(session);

    if (!team) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    // Check if new name conflicts with existing team globally
    if (name && name !== team.name) {
      const existingTeam = await Team.findOne({
        name,
        _id: { $ne: teamId },
      }).session(session);

      if (existingTeam) {
        await session.abortTransaction();
        return res.status(409).json({
          success: false,
          message: "Team with this name already exists",
        });
      }
    }

    // Get current team members for comparison
    const currentMemberIds = team.agentIds.map((id) => id.toString());
    const newMemberIds = memberIdsToUse
      ? memberIdsToUse.map((id: any) => id.toString())
      : currentMemberIds;

    // Find added and removed members
    const addedMembers = newMemberIds.filter(
      (id: any) => !currentMemberIds.includes(id)
    );
    const removedMembers = currentMemberIds.filter(
      (id) => !newMemberIds.includes(id)
    );

    // Validate minimum team size
    if (memberIdsToUse && memberIdsToUse.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Team must have at least one member",
      });
    }

    // Log the comparison for debugging
    console.log("Member comparison:", {
      currentMemberIds,
      newMemberIds,
      addedMembers,
      removedMembers,
      hasChanges: addedMembers.length > 0 || removedMembers.length > 0,
    });

    // Update team
    const updateData: any = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (memberIdsToUse) {
      updateData.agentIds = memberIdsToUse;

      // Select team leader based on custom logic
      // Priority: 1. Current leader if still in team, 2. Most experienced agent, 3. First in list
      let newLeaderId = memberIdsToUse[0];

      // If current leader is still in the team, keep them
      if (team.leaderId && memberIdsToUse.includes(team.leaderId.toString())) {
        newLeaderId = team.leaderId;
      } else {
        // Find most experienced agent (earliest creation date)
        const validMembers = await User.find({
          _id: { $in: memberIdsToUse },
          role: "AGENT",
          createdBy: currentUserId,
        }).session(session);

        if (validMembers.length > 0) {
          const sortedMembers = validMembers.sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          newLeaderId = sortedMembers[0]?._id;
        }
      }

      updateData.leaderId = newLeaderId;
    }

    const updatedTeam = await Team.findByIdAndUpdate(teamId, updateData, {
      new: true,
      runValidators: true,
      session,
    })
      .populate("leaderId", "name email")
      .populate("agentIds", "name email status")
      .populate("createdBy", "name email");

    // Update team assignments if members changed
    if (memberIdsToUse) {
      // Remove old assignments
      await AgentTeamAssignment.deleteMany({ teamId }, { session });

      // Create new assignments
      const teamAssignments = memberIdsToUse.map(
        (agentId: mongoose.Types.ObjectId) => ({
          agentId,
          teamId,
          effectiveFrom: new Date(),
          status: "ACTIVE" as const,
          assignedBy: currentUserId,
        })
      );

      await AgentTeamAssignment.insertMany(teamAssignments, { session });
    }

    // Sync zone assignments for team members
    if (addedMembers.length > 0 || removedMembers.length > 0) {
      console.log(
        `Team ${team.name} members changed. Added: ${addedMembers.length}, Removed: ${removedMembers.length}`
      );

      // Get all zone assignments for this team
      const teamZoneAssignments = await AgentZoneAssignment.find({
        teamId: teamId,
        status: { $nin: ["COMPLETED", "CANCELLED"] },
        effectiveTo: null,
      }).session(session);

      // Batch operations for better performance
      if (addedMembers.length > 0) {
        // Get team's current zone assignments (active and scheduled only)
        const teamZoneAssignments = await AgentZoneAssignment.find({
          teamId: teamId,
          status: { $in: ["ACTIVE", "SCHEDULED"] },
          effectiveTo: null,
        }).session(session);

        // Check zone limit (max 5 zones per team)
        if (teamZoneAssignments.length >= 5) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: "Team cannot have more than 5 active zones",
          });
        }

        // FIXED: Add team to all added members' teamIds AND create zone assignments
        const teamZoneIds = teamZoneAssignments.map(
          (assignment) => assignment.zoneId
        );

        // Batch update: Add team to all added members' teamIds
        await User.updateMany(
          { _id: { $in: addedMembers } },
          { $addToSet: { teamIds: teamId } },
          { session }
        );

        console.log(
          `Added team ${teamId} to teamIds for ${addedMembers.length} new members`
        );

        // Create zone assignments for new members with team's existing zones
        if (teamZoneIds.length > 0) {
          // Create zone assignments for new members
          const newZoneAssignments = [];
          for (const memberId of addedMembers) {
            for (const zoneId of teamZoneIds) {
              newZoneAssignments.push({
                agentId: memberId,
                zoneId: zoneId,
                teamId: teamId,
                effectiveFrom: new Date(),
                status: "ACTIVE",
                assignedBy: currentUserId,
              });
            }
          }

          if (newZoneAssignments.length > 0) {
            await AgentZoneAssignment.insertMany(newZoneAssignments, {
              session,
            });
            console.log(
              `Created ${newZoneAssignments.length} zone assignments for ${addedMembers.length} new members`
            );
          }
        }

        // Add team zones to members' zoneIds (avoid duplicates)
        for (const memberId of addedMembers) {
          const agent = await User.findById(memberId).session(session);
          if (agent) {
            const existingZoneIds = agent.zoneIds || [];
            const newZoneIds = teamZoneIds.filter(
              (zoneId) => !existingZoneIds.includes(zoneId)
            );

            if (newZoneIds.length > 0) {
              await User.findByIdAndUpdate(
                memberId,
                {
                  $addToSet: { zoneIds: newZoneIds },
                },
                { session }
              );
            }
          }
        }

        // FIXED: Handle existing routes and scheduled assignments for new members
        // Check if new members have existing routes that should be updated
        for (const memberId of addedMembers) {
          const existingRoutes = await Route.find({
            agentId: memberId,
            teamId: { $exists: false }, // Routes not assigned to any team
            status: { $in: ["DRAFT", "PLANNED"] },
          }).session(session);

          if (existingRoutes.length > 0) {
            // Update existing routes to include team assignment
            await Route.updateMany(
              {
                agentId: memberId,
                teamId: { $exists: false },
                status: { $in: ["DRAFT", "PLANNED"] },
              },
              { teamId: teamId },
              { session }
            );
            console.log(
              `Updated ${existingRoutes.length} existing routes for new member ${memberId} to include team ${teamId}`
            );
          }
        }

        console.log(
          `Added team ${teamId} to ${addedMembers.length} members and synced zone assignments`
        );
      }

      if (removedMembers.length > 0) {
        // Note: Minimum team size is already validated above, so this check is redundant
        // The team will always have at least 1 member after the operation

        // FIXED: Remove team from all removed members' teamIds AND zone assignments
        const teamZoneIds = teamZoneAssignments.map(
          (assignment) => assignment.zoneId
        );

        // Batch update: Remove team from all removed members' teamIds
        await User.updateMany(
          { _id: { $in: removedMembers } },
          { $pull: { teamIds: teamId } },
          { session }
        );

        console.log(
          `Removed team ${teamId} from teamIds for ${removedMembers.length} removed members`
        );

        // FIXED: Only remove zone assignments for the specific removed members, NOT all team assignments
        await AgentZoneAssignment.deleteMany(
          {
            teamId: teamId,
            agentId: { $in: removedMembers }, // Only for removed members
            status: { $in: ["ACTIVE", "SCHEDULED"] },
            effectiveTo: null,
          },
          { session }
        );

        console.log(
          `Removed zone assignments for ${removedMembers.length} removed members from team ${teamId}`
        );

        // For removed members: Remove only the team's zones from their zoneIds
        // Keep zones from other teams or individual assignments
        for (const memberId of removedMembers) {
          const member = await User.findById(memberId).session(session);
          if (member && member.zoneIds && member.zoneIds.length > 0) {
            // Remove only the zones that were assigned to this team
            const zonesToRemove = teamZoneIds.filter((zoneId) =>
              member.zoneIds.includes(zoneId)
            );

            if (zonesToRemove.length > 0) {
              await User.findByIdAndUpdate(
                memberId,
                {
                  $pull: { zoneIds: { $in: zonesToRemove } },
                },
                { session }
              );
              console.log(
                `Removed ${zonesToRemove.length} team zones from removed member ${memberId}`
              );
            }
          }
        }

        // Clear primaryTeamId if it was this team
        await User.updateMany(
          { _id: { $in: removedMembers }, primaryTeamId: teamId },
          { $unset: { primaryTeamId: 1 } },
          { session }
        );

        // Clear primaryZoneId for removed members who no longer have zone assignments
        for (const memberId of removedMembers) {
          const member = await User.findById(memberId).session(session);
          if (member && member.zoneIds && member.zoneIds.length === 0) {
            await User.findByIdAndUpdate(
              memberId,
              {
                $unset: { primaryZoneId: 1 },
              },
              { session }
            );
          }
        }

        // FIXED: Update ScheduledAssignment records for removed members
        // Cancel or reassign scheduled assignments for removed members
        const scheduledAssignmentsToUpdate = await ScheduledAssignment.find({
          teamId: teamId,
          status: "PENDING",
        }).session(session);

        if (scheduledAssignmentsToUpdate.length > 0) {
          // For team-based scheduled assignments, we need to check if any remaining members can take them
          const remainingMembers = newMemberIds.filter(
            (id: any) => !removedMembers.includes(id)
          );

          if (remainingMembers.length === 0) {
            // No remaining members, cancel all scheduled assignments
            await ScheduledAssignment.updateMany(
              { teamId: teamId, status: "PENDING" },
              { status: "CANCELLED" },
              { session }
            );
            console.log(
              `Cancelled ${scheduledAssignmentsToUpdate.length} scheduled assignments for team ${teamId} (no remaining members)`
            );
          } else {
            // Keep team-based assignments but they'll be handled by remaining members
            console.log(
              `Kept ${scheduledAssignmentsToUpdate.length} scheduled assignments for remaining team members`
            );
          }
        }

        // FIXED: Update Route records for removed members
        // Routes assigned to removed members should be cancelled or reassigned
        const routesToUpdate = await Route.find({
          teamId: teamId,
          status: { $in: ["DRAFT", "PLANNED"] }, // Only update routes that haven't started
        }).session(session);

        if (routesToUpdate.length > 0) {
          const remainingMembers = newMemberIds.filter(
            (id: any) => !removedMembers.includes(id)
          );

          if (remainingMembers.length === 0) {
            // No remaining members, cancel all routes
            await Route.updateMany(
              { teamId: teamId, status: { $in: ["DRAFT", "PLANNED"] } },
              { status: "CANCELLED" },
              { session }
            );
            console.log(
              `Cancelled ${routesToUpdate.length} routes for team ${teamId} (no remaining members)`
            );
          } else {
            // For routes assigned to removed members, reassign to remaining members
            for (const route of routesToUpdate) {
              if (removedMembers.includes(route.agentId.toString())) {
                // Reassign to first remaining member
                await Route.findByIdAndUpdate(
                  route._id,
                  {
                    agentId: remainingMembers[0],
                  },
                  { session }
                );
                console.log(
                  `Reassigned route ${route._id} from removed member to ${remainingMembers[0]}`
                );
              }
            }
          }
        }

        console.log(
          `Removed team ${teamId} from ${removedMembers.length} members and synced zone assignments`
        );
      }

      // Update team status
      if (teamId) {
        await updateTeamStatus(teamId.toString());
      }
    }

    await session.commitTransaction();

    // Post-transaction operations (outside transaction to avoid failures)
    try {
      // Sync zoneIds and status for all affected members
      if (addedMembers.length > 0) {
        await Promise.all(
          addedMembers.map((memberId: string) => syncAgentZoneIds(memberId))
        );
        await Promise.all(
          addedMembers.map((memberId: string) => updateAgentStatus(memberId))
        );
        await Promise.all(
          addedMembers.map((memberId: string) =>
            updateUserAssignmentStatus(memberId)
          )
        );
      }

      if (removedMembers.length > 0) {
        await Promise.all(
          removedMembers.map((memberId: string) => syncAgentZoneIds(memberId))
        );
        await Promise.all(
          removedMembers.map((memberId: string) => updateAgentStatus(memberId))
        );
        await Promise.all(
          removedMembers.map((memberId: string) =>
            updateUserAssignmentStatus(memberId)
          )
        );
      }

      // Update team status
      if (teamId) {
        await updateTeamStatus(teamId.toString());
      }

      // Update assignment status for remaining members (those not added or removed)
      const remainingMembers = newMemberIds.filter(
        (id: any) => !addedMembers.includes(id) && !removedMembers.includes(id)
      );
      if (remainingMembers.length > 0) {
        await Promise.all(
          remainingMembers.map((memberId: string) =>
            updateUserAssignmentStatus(memberId)
          )
        );
      }

      // Log team update for audit
      if (teamId) {
        await logTeamChange(
          "UPDATED",
          teamId.toString(),
          {
            name: name || team.name,
            description:
              description !== undefined ? description : team.description,
            addedMembers,
            removedMembers,
            newLeaderId: updateData.leaderId,
            previousLeaderId: team.leaderId,
          },
          currentUserId || "unknown"
        );

        // Validate data consistency after update
        const isConsistent = await validateTeamConsistency(teamId.toString());
        if (!isConsistent) {
          console.warn(
            `Team ${teamId} data consistency check failed after update`
          );
          // Don't fail the request, but log the warning
        }
      }
    } catch (postUpdateError) {
      console.error("Error in post-transaction operations:", postUpdateError);
      // Don't fail the main request, but log the error
    }

    res.json({
      success: true,
      message: "Team updated successfully",
      data: updatedTeam,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error updating team:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update team",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  } finally {
    session.endSession();
  }
};

// Delete team
export const deleteTeam = async (req: AuthRequest, res: Response) => {
  try {
    const { teamId } = req.params;
    const currentUserId = req.user?.sub;

    const team = await Team.findOne({
      _id: teamId,
      createdBy: currentUserId,
    });

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    // Remove team assignments
    await AgentTeamAssignment.deleteMany({ teamId });

    // Update users to remove team references
    await User.updateMany(
      { teamIds: teamId },
      {
        $pull: { teamIds: teamId },
        $unset: { primaryTeamId: 1 },
      }
    );

    // Delete the team
    await Team.findByIdAndDelete(teamId);

    res.json({
      success: true,
      message: "Team deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting team:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete team",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get team statistics for dashboard
export const getTeamStats = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.sub;

    // Get total teams
    const totalTeams = await Team.countDocuments({ createdBy: currentUserId });

    // Get total members (agents created by this admin)
    const totalMembers = await User.countDocuments({
      role: "AGENT",
      createdBy: currentUserId,
    });

    // Get teams with zone assignments (active or scheduled)
    const teamsWithZoneAssignments = await Team.aggregate([
      { $match: { createdBy: new mongoose.Types.ObjectId(currentUserId) } },
      {
        $lookup: {
          from: "agentzoneassignments",
          localField: "_id",
          foreignField: "teamId",
          as: "zoneAssignments",
        },
      },
      {
        $lookup: {
          from: "scheduledassignments",
          localField: "_id",
          foreignField: "teamId",
          as: "scheduledAssignments",
        },
      },
      {
        $match: {
          $or: [
            {
              zoneAssignments: {
                $elemMatch: {
                  status: { $nin: ["COMPLETED", "CANCELLED"] },
                  effectiveTo: null,
                },
              },
            },
            {
              scheduledAssignments: {
                $elemMatch: {
                  status: "PENDING",
                },
              },
            },
          ],
        },
      },
    ]);

    // Get inactive teams (teams without any zone assignments)
    const inactiveTeams = totalTeams - teamsWithZoneAssignments.length;

    // Get active members (members who have zone assignments - active or scheduled)
    const activeMembers = await User.aggregate([
      {
        $match: {
          role: "AGENT",
          createdBy: new mongoose.Types.ObjectId(currentUserId),
        },
      },
      {
        $lookup: {
          from: "agentteamassignments",
          localField: "_id",
          foreignField: "agentId",
          as: "teamAssignments",
        },
      },
      {
        $lookup: {
          from: "agentzoneassignments",
          localField: "_id",
          foreignField: "agentId",
          as: "zoneAssignments",
        },
      },
      {
        $lookup: {
          from: "scheduledassignments",
          localField: "_id",
          foreignField: "agentId",
          as: "scheduledAssignments",
        },
      },
      {
        $lookup: {
          from: "agentzoneassignments",
          localField: "teamIds",
          foreignField: "teamId",
          as: "teamZoneAssignments",
        },
      },
      {
        $lookup: {
          from: "scheduledassignments",
          localField: "teamIds",
          foreignField: "teamId",
          as: "teamScheduledAssignments",
        },
      },
      {
        $match: {
          $or: [
            {
              teamAssignments: {
                $elemMatch: {
                  status: { $nin: ["COMPLETED", "CANCELLED"] },
                  effectiveTo: null,
                },
              },
            }, // Member has active team assignments
            {
              zoneAssignments: {
                $elemMatch: {
                  status: { $nin: ["COMPLETED", "CANCELLED"] },
                  effectiveTo: null,
                },
              },
            }, // Member has active individual zone assignments
            {
              scheduledAssignments: {
                $elemMatch: {
                  status: "PENDING",
                },
              },
            }, // Member has scheduled individual assignments
            {
              teamZoneAssignments: {
                $elemMatch: {
                  status: { $nin: ["COMPLETED", "CANCELLED"] },
                  effectiveTo: null,
                },
              },
            }, // Member's team has active zone assignments
            {
              teamScheduledAssignments: {
                $elemMatch: {
                  status: "PENDING",
                },
              },
            }, // Member's team has scheduled assignments
          ],
        },
      },
      {
        $count: "activeMembers",
      },
    ]);

    const activeMembersCount =
      activeMembers.length > 0 ? activeMembers[0].activeMembers : 0;
    const inactiveMembersCount = totalMembers - activeMembersCount;

    // Get assigned and unassigned members count
    const assignedMembers = await User.countDocuments({
      role: "AGENT",
      createdBy: currentUserId,
      assignmentStatus: "ASSIGNED",
    });

    const unassignedMembers = await User.countDocuments({
      role: "AGENT",
      createdBy: currentUserId,
      assignmentStatus: "UNASSIGNED",
    });

    // Get total zones that are assigned to teams or agents created by this admin
    const adminTeams = await Team.find({ createdBy: currentUserId }).select(
      "_id"
    );
    const adminAgents = await User.find({
      role: "AGENT",
      createdBy: currentUserId,
    }).select("_id");

    const teamIds = adminTeams.map((team) => team._id);
    const agentIds = adminAgents.map((agent) => agent._id);

    // Import ScheduledAssignment model
    const { ScheduledAssignment } = require("../models/ScheduledAssignment");

    // Count zones based on active AgentZoneAssignment records
    const activeZoneAssignments = await AgentZoneAssignment.countDocuments({
      $or: [
        {
          agentId: { $in: agentIds },
          status: { $nin: ["COMPLETED", "CANCELLED"] },
          effectiveTo: null,
        },
        {
          teamId: { $in: teamIds },
          status: { $nin: ["COMPLETED", "CANCELLED"] },
          effectiveTo: null,
        },
      ],
    });

    // Count zones based on PENDING scheduled assignments
    const scheduledZoneAssignments = await ScheduledAssignment.countDocuments({
      $or: [
        { agentId: { $in: agentIds }, status: "PENDING" },
        { teamId: { $in: teamIds }, status: "PENDING" },
      ],
    });

    const totalZones = activeZoneAssignments + scheduledZoneAssignments;

    // Calculate real performance data from activities
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Use the existing agentIds from above

    // Calculate completed tasks (completed routes)
    const completedTasks = await Route.countDocuments({
      agentId: { $in: agentIds },
      status: "COMPLETED",
      updatedAt: { $gte: thirtyDaysAgo },
    });

    // Calculate active sessions (activities in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activeSessions = await Activity.countDocuments({
      agentId: { $in: agentIds },
      startedAt: { $gte: sevenDaysAgo },
    });

    // Calculate average performance based on actual activity data
    const performanceData = await Performance.aggregate([
      {
        $match: {
          agentId: { $in: agentIds },
          date: { $gte: thirtyDaysAgo.toISOString().split("T")[0] },
        },
      },
      {
        $group: {
          _id: null,
          totalAppointments: { $sum: "$appointments" },
          totalLeads: { $sum: "$leadsCreated" },
          totalVisits: { $sum: "$totalVisits" },
          count: { $sum: 1 },
        },
      },
    ]);

    let averagePerformance = 0;
    if (performanceData.length > 0 && performanceData[0].totalVisits > 0) {
      const data = performanceData[0];
      // Calculate performance as: (appointments + leads) / total visits * 100
      averagePerformance = Math.round(
        ((data.totalAppointments + data.totalLeads) / data.totalVisits) * 100
      );
    }

    // Get top performing team based on actual performance
    const topPerformingTeam = await Team.aggregate([
      { $match: { createdBy: new mongoose.Types.ObjectId(currentUserId) } },
      {
        $lookup: {
          from: "performances",
          localField: "agentIds",
          foreignField: "agentId",
          as: "performances",
        },
      },
      {
        $addFields: {
          totalPerformance: {
            $reduce: {
              input: "$performances",
              initialValue: 0,
              in: {
                $add: [
                  "$$value",
                  {
                    $cond: [
                      { $gt: ["$$this.totalVisits", 0] },
                      {
                        $multiply: [
                          {
                            $divide: [
                              {
                                $add: [
                                  "$$this.appointments",
                                  "$$this.leadsCreated",
                                ],
                              },
                              "$$this.totalVisits",
                            ],
                          },
                          100,
                        ],
                      },
                      0,
                    ],
                  },
                ],
              },
            },
          },
          performanceCount: { $size: "$performances" },
        },
      },
      {
        $addFields: {
          avgPerformance: {
            $cond: [
              { $gt: ["$performanceCount", 0] },
              { $divide: ["$totalPerformance", "$performanceCount"] },
              0,
            ],
          },
        },
      },
      { $sort: { avgPerformance: -1 } },
      { $limit: 1 },
    ]);

    // Get recent activity (last 30 days)
    const newMembers = await User.countDocuments({
      role: "AGENT",
      createdBy: currentUserId,
      createdAt: { $gte: thirtyDaysAgo },
    });

    // Calculate agents with individual-only vs team-level assignments
    // Based on actual zone assignments (same logic as territory-map table)

    // Get all zones created by this admin
    const allZones = await Zone.find({
      createdBy: currentUserId,
    }).select("_id");

    let agentsWithIndividualOnlyAssignments = 0;
    let agentsWithTeamAssignments = 0;
    const agentAssignmentTypes = new Map(); // Track each agent's assignment types

    console.log(`📊 Analyzing ${allZones.length} zones for assignment types`);

    // Debug: Let's see what zones we're analyzing
    for (const zone of allZones) {
      console.log(`🔍 Zone ID: ${zone._id}`);
    }

    for (const zone of allZones) {
      // Get all active assignments for this zone (same logic as territory-map)
      const activeAssignments = await AgentZoneAssignment.find({
        zoneId: zone._id,
        status: { $nin: ["COMPLETED", "CANCELLED"] },
        effectiveTo: null,
      });

      console.log(
        `🔍 Zone ${zone._id} has ${activeAssignments.length} active assignments`
      );
      for (const assignment of activeAssignments) {
        console.log(
          `  - Assignment: agentId=${assignment.agentId}, teamId=${assignment.teamId}, status=${assignment.status}`
        );
      }

      // Check if this zone has team assignments
      const teamAssignment = activeAssignments.find(
        (assignment) => assignment.teamId
      );

      // Handle team assignments (agents can have both team AND individual assignments)
      if (teamAssignment) {
        // This zone has team-level assignment
        // Find all agents in this team and mark them as having team assignments
        console.log(
          `🔍 Found team assignment for team ${teamAssignment.teamId} in zone ${zone._id}`
        );
        const teamMembers = await User.find({
          teamIds: teamAssignment.teamId,
          role: "AGENT",
          createdBy: currentUserId,
        }).select("_id");

        for (const member of teamMembers) {
          const agentId = (member._id as any).toString();
          console.log(`🔍 Marking agent ${agentId} as having team assignments`);
          if (!agentAssignmentTypes.has(agentId)) {
            agentAssignmentTypes.set(agentId, {
              hasIndividual: false,
              hasTeam: false,
            });
          }
          agentAssignmentTypes.get(agentId)!.hasTeam = true;
        }
      }

      // Handle individual assignments (agents can have both team AND individual assignments)
      if (activeAssignments.length > 0) {
        // Check for individual assignments in this zone
        for (const assignment of activeAssignments) {
          if (assignment.agentId && !assignment.teamId) {
            // This is an individual assignment (has agentId but no teamId)
            const agentId = assignment.agentId.toString();
            console.log(
              `🔍 Found individual assignment for agent ${agentId} in zone ${zone._id}`
            );
            if (!agentAssignmentTypes.has(agentId)) {
              agentAssignmentTypes.set(agentId, {
                hasIndividual: false,
                hasTeam: false,
              });
            }
            agentAssignmentTypes.get(agentId)!.hasIndividual = true;
          }
        }
      }
    }

    // Also check scheduled assignments
    const scheduledAssignments = await ScheduledAssignment.find({
      status: "PENDING",
    })
      .populate("zoneId", "createdBy")
      .populate("agentId", "_id")
      .populate("teamId", "_id");

    for (const scheduled of scheduledAssignments) {
      if (
        scheduled.zoneId &&
        currentUserId &&
        scheduled.zoneId.createdBy.toString() === currentUserId.toString()
      ) {
        if (scheduled.teamId) {
          // Team scheduled assignment
          const teamMembers = await User.find({
            teamIds: scheduled.teamId._id,
            role: "AGENT",
            createdBy: currentUserId,
          }).select("_id");

          for (const member of teamMembers) {
            const agentId = (member._id as any).toString();
            if (!agentAssignmentTypes.has(agentId)) {
              agentAssignmentTypes.set(agentId, {
                hasIndividual: false,
                hasTeam: false,
              });
            }
            agentAssignmentTypes.get(agentId).hasTeam = true;
          }
        } else if (scheduled.agentId) {
          // Individual scheduled assignment
          const agentId = scheduled.agentId._id.toString();
          if (!agentAssignmentTypes.has(agentId)) {
            agentAssignmentTypes.set(agentId, {
              hasIndividual: false,
              hasTeam: false,
            });
          }
          agentAssignmentTypes.get(agentId).hasIndividual = true;
        }
      }
    }

    // Debug: Print all agents and their assignment types
    console.log(`📊 Total agents tracked: ${agentAssignmentTypes.size}`);
    for (const [agentId, assignmentTypes] of agentAssignmentTypes) {
      console.log(
        `📊 Agent ${agentId}: hasTeam=${assignmentTypes.hasTeam}, hasIndividual=${assignmentTypes.hasIndividual}`
      );
    }

    // Count agents based on their assignment types
    // NOTE: An agent can be counted in BOTH categories if they have both types of assignments
    for (const [agentId, assignmentTypes] of agentAssignmentTypes) {
      // Count agents with team assignments (regardless of individual assignments)
      if (assignmentTypes.hasTeam) {
        agentsWithTeamAssignments++;
        console.log(
          `✅ Agent ${agentId} counted as Team-Based (has team assignments)`
        );
      }

      // Count agents with individual assignments (regardless of team assignments)
      if (assignmentTypes.hasIndividual) {
        agentsWithIndividualOnlyAssignments++;
        console.log(
          `✅ Agent ${agentId} counted as Independent (has individual assignments)`
        );
      }

      // Log if agent has both
      if (assignmentTypes.hasTeam && assignmentTypes.hasIndividual) {
        console.log(
          `📋 Agent ${agentId} has BOTH team AND individual assignments - counted in BOTH categories`
        );
      }
    }

    console.log(
      `📊 Final counts: Team-based=${agentsWithTeamAssignments}, Independent=${agentsWithIndividualOnlyAssignments}`
    );

    const stats = {
      totalTeams,
      totalMembers,
      activeMembers: activeMembersCount,
      inactiveMembers: inactiveMembersCount,
      assignedMembers,
      unassignedMembers,
      inactiveTeams, // Teams without work assignments
      totalZones,
      averagePerformance,
      topPerformingTeam: {
        name: topPerformingTeam.length > 0 ? topPerformingTeam[0].name : "N/A",
        performance:
          topPerformingTeam.length > 0
            ? Math.round(topPerformingTeam[0].avgPerformance)
            : 0,
      },
      recentActivity: {
        newMembers,
        completedTasks,
        activeSessions,
      },
      agentsWithTeamAssignments,
      agentsWithIndividualOnlyAssignments,
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error getting team stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get team stats",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get team performance data
export const getTeamPerformance = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.sub;

    const allTeams = await Team.find({ createdBy: currentUserId })
      .populate("agentIds", "name email status zoneId")
      .populate("leaderId", "name email");

    // Filter out teams with no members
    const teams = allTeams.filter(
      (team) => team.agentIds && team.agentIds.length > 0
    );

    const performanceData = await Promise.all(
      teams.map(async (team) => {
        // Import ScheduledAssignment model
        const {
          ScheduledAssignment,
        } = require("../models/ScheduledAssignment");

        // Get zone assignments for this team (active and scheduled)
        const activeZoneAssignments = await AgentZoneAssignment.find({
          teamId: team._id,
          status: { $nin: ["COMPLETED", "CANCELLED"] },
          effectiveTo: null,
        }).populate("zoneId", "name");

        const scheduledZoneAssignments = await ScheduledAssignment.find({
          teamId: team._id,
          status: "PENDING",
        }).populate("zoneId", "name");

        // Combine all zone assignments
        const zoneAssignments = [
          ...activeZoneAssignments,
          ...scheduledZoneAssignments,
        ];

        // Calculate zone coverage
        const assignedZones = new Set();
        zoneAssignments.forEach((assignment: any) => {
          if (assignment.zoneId) {
            assignedZones.add(assignment.zoneId._id.toString());
          }
        });

        // Count active members using correct status calculation
        const activeMembers = await Promise.all(
          team.agentIds.map(async (agent: any) => {
            const calculatedStatus = await calculateAgentStatus(
              agent._id.toString()
            );
            return calculatedStatus === "ACTIVE";
          })
        );

        const activeMembersCount = activeMembers.filter(Boolean).length;

        // Calculate real performance data for this team
        const teamAgentIds = team.agentIds.map((agent: any) => agent._id);

        // Get performance data for team members
        const performanceData = await Performance.aggregate([
          {
            $match: {
              agentId: { $in: teamAgentIds },
            },
          },
          {
            $group: {
              _id: null,
              totalVisits: { $sum: "$totalVisits" },
              totalAppointments: { $sum: "$appointments" },
              totalLeads: { $sum: "$leadsCreated" },
              totalDuration: { $sum: "$totalDurationSeconds" },
            },
          },
        ]);

        // Get route completion data for this team
        const routeData = await Route.aggregate([
          {
            $match: {
              teamId: team._id,
              status: {
                $in: ["COMPLETED", "IN_PROGRESS", "CANCELLED", "ARCHIVED"],
              },
            },
          },
          {
            $group: {
              _id: null,
              totalRoutes: { $sum: 1 },
              completedRoutes: {
                $sum: {
                  $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0],
                },
              },
              inProgressRoutes: {
                $sum: {
                  $cond: [{ $eq: ["$status", "IN_PROGRESS"] }, 1, 0],
                },
              },
              cancelledRoutes: {
                $sum: {
                  $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0],
                },
              },
              archivedRoutes: {
                $sum: {
                  $cond: [{ $eq: ["$status", "ARCHIVED"] }, 1, 0],
                },
              },
            },
          },
        ]);

        // Calculate performance metrics from actual Resident data
        let averageKnocks = 0;
        let completionRate = 0;

        // Get all zone IDs for this team
        const teamZoneIds = Array.from(assignedZones);

        if (teamZoneIds.length > 0) {
          // Calculate from Resident collection for real-time accuracy
          const totalResidents = await Resident.countDocuments({
            zoneId: { $in: teamZoneIds },
          });

          const visitedResidents = await Resident.countDocuments({
            zoneId: { $in: teamZoneIds },
            status: {
              $in: [
                "visited",
                "interested",
                "callback",
                "appointment",
                "follow-up",
              ],
            },
          });

          // Completion rate = visited / total * 100
          if (totalResidents > 0) {
            completionRate = Math.round(
              (visitedResidents / totalResidents) * 100
            );
          }

          // Average knocks from performance data if available
          if (
            performanceData.length > 0 &&
            performanceData[0].totalVisits > 0
          ) {
            averageKnocks = performanceData[0].totalVisits;
          }
        }

        const finalCompletionRate = completionRate;

        return {
          teamId: (team._id as mongoose.Types.ObjectId).toString(),
          teamName: team.name,
          memberCount: team.agentIds.length,
          activeMembers: activeMembersCount,
          averageKnocks,
          completionRate: finalCompletionRate,
          zoneCoverage: assignedZones.size,
        };
      })
    );

    res.json({
      success: true,
      data: performanceData,
    });
  } catch (error) {
    console.error("Error getting team performance:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get team performance",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
