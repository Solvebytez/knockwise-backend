import { Request, Response } from "express";
import { User, IUser } from "../models/User";
import { Team } from "../models/Team";
import { Zone } from "../models/Zone";
import { Resident } from "../models/Resident";
import { AgentZoneAssignment } from "../models/AgentZoneAssignment";
import { AgentTeamAssignment } from "../models/AgentTeamAssignment";
import { ScheduledAssignment } from "../models/ScheduledAssignment";
import Route from "../models/Route";
import Activity from "../models/Activity";
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

// Helper function to calculate team status based on zone assignments
const calculateTeamStatus = async (
  teamId: string
): Promise<"ACTIVE" | "INACTIVE"> => {
  try {
    // Check if team has any zone assignments
    const teamZoneAssignments = await AgentZoneAssignment.find({
      teamId: teamId,
      status: { $in: ["ACTIVE", "COMPLETED"] },
      effectiveTo: null,
    });

    // Team is ACTIVE if it has any zone assignments
    const hasZoneAssignment = teamZoneAssignments.length > 0;

    return hasZoneAssignment ? "ACTIVE" : "INACTIVE";
  } catch (error) {
    console.error("Error calculating team status:", error);
    return "INACTIVE";
  }
};

// Helper function to calculate agent status based on zone assignments (individual and team)
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
    // 6. OR if they were previously ACTIVE (don't automatically deactivate)
    const shouldBeActive =
      hasIndividualZoneAssignment ||
      hasIndividualPrimaryZone ||
      hasActiveIndividualZoneAssignment ||
      hasTeamZoneAssignment ||
      hasPendingIndividualScheduledAssignment ||
      hasPendingTeamScheduledAssignment ||
      agent.status === "ACTIVE"; // Keep ACTIVE status if already set

    return shouldBeActive ? "ACTIVE" : "INACTIVE";
  } catch (error) {
    console.error("Error calculating agent status:", error);
    return "INACTIVE";
  }
};

// Helper function to update agent status based on zone assignment and task completion
export const updateAgentStatus = async (agentId: string) => {
  try {
    const agent = await User.findById(agentId);
    if (!agent || agent.role !== "AGENT") return;

    const calculatedStatus = await calculateAgentStatus(agentId);

    // Only update if the agent should be ACTIVE (don't automatically deactivate)
    if (calculatedStatus === "ACTIVE" && agent.status !== "ACTIVE") {
      await User.findByIdAndUpdate(agentId, { status: calculatedStatus });
      console.log(
        `Agent ${agent.name} (${agentId}) status updated to ${calculatedStatus}`
      );
    }
  } catch (error) {
    console.error("Error updating agent status:", error);
  }
};

// Update agent status when zone assignment changes
export const updateAgentStatusOnZoneChange = async (agentId: string) => {
  await updateAgentStatus(agentId);
};

// Update agent zone assignments and automatically update status
export const updateAgentZoneAssignment = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { agentId } = req.params;

    if (!agentId) {
      return res.status(400).json({
        success: false,
        message: "Agent ID is required",
      });
    }

    const { primaryZoneId, zoneIds } = req.body;

    // Validate agent exists
    const agent = await User.findById(agentId);
    if (!agent || agent.role !== "AGENT") {
      return res.status(404).json({
        success: false,
        message: "Agent not found",
      });
    }

    // Update zone assignments
    const updateData: any = {};
    if (primaryZoneId !== undefined) updateData.primaryZoneId = primaryZoneId;
    if (zoneIds !== undefined) updateData.zoneIds = zoneIds;

    const updatedAgent = await User.findByIdAndUpdate(agentId, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedAgent) {
      return res.status(404).json({
        success: false,
        message: "Agent not found",
      });
    }

    // Automatically update status based on new zone assignment
    await updateAgentStatus(agentId);

    // Get the updated agent with new status
    const finalAgent = await User.findById(agentId).select("-password");

    res.json({
      success: true,
      message: "Agent zone assignment updated successfully",
      data: finalAgent,
    });
  } catch (error) {
    console.error("Error updating agent zone assignment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update agent zone assignment",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Create a new user (Superadmin only)
export const createUser = async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      email,
      username,
      contactNumber,
      password,
      role,
      primaryTeamId,
      primaryZoneId,
      teamIds,
      zoneIds,
    } = req.body;

    console.log("createUser", req.body);

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message:
          "An account with this email address already exists. Please use a different email.",
      });
    }

    // Check if username already exists (if provided)
    if (username) {
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        return res.status(409).json({
          success: false,
          message:
            "This username is already taken. Please choose a different username.",
        });
      }
    }

    // Prepare team and zone arrays
    const finalTeamIds = teamIds || [];
    const finalZoneIds = zoneIds || [];

    // Add primary team/zone to arrays if not already included
    if (primaryTeamId && !finalTeamIds.includes(primaryTeamId)) {
      finalTeamIds.push(primaryTeamId);
    }
    if (primaryZoneId && !finalZoneIds.includes(primaryZoneId)) {
      finalZoneIds.push(primaryZoneId);
    }

    // Determine initial status based on zone assignment
    const hasZoneAssignment = finalZoneIds.length > 0 || primaryZoneId;
    const initialStatus = hasZoneAssignment ? "ACTIVE" : "INACTIVE";

    const user = new User({
      name,
      email,
      username,
      contactNumber,
      password: password, // Pre-save hook will hash this automatically
      originalPassword: password, // Store original password for admin viewing
      role,
      status: initialStatus, // Set status based on zone assignment
      primaryTeamId,
      primaryZoneId,
      teamIds: finalTeamIds,
      zoneIds: finalZoneIds,
      createdBy: req.user?.sub, // Set the creator
    });

    await user.save();

    // Create team assignments if teams are provided
    if (finalTeamIds.length > 0) {
      const teamAssignments = finalTeamIds.map(
        (teamId: mongoose.Types.ObjectId) => ({
          agentId: user._id,
          teamId,
          effectiveFrom: new Date(),
          status: "ACTIVE" as const,
          assignedBy: req.user?.sub,
        })
      );

      await AgentTeamAssignment.insertMany(teamAssignments);
    }

    // Create zone assignments if zones are provided
    if (finalZoneIds.length > 0) {
      const zoneAssignments = finalZoneIds.map(
        (zoneId: mongoose.Types.ObjectId) => ({
          agentId: user._id,
          zoneId,
          effectiveFrom: new Date(),
          status: "ACTIVE" as const,
          assignedBy: req.user?.sub,
        })
      );

      await AgentZoneAssignment.insertMany(zoneAssignments);
    }

    // Remove password from response
    const userResponse = user.toObject();
    delete (userResponse as any).password;

    res.status(201).json({
      success: true,
      message: "Team member created successfully",
      data: userResponse,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({
      success: false,
      message:
        "Unable to create team member. Please try again or contact support if the problem persists.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Update user (Superadmin/Subadmin can update agents they created)
export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      username,
      contactNumber,
      password,
      role,
      status,
      teamId,
      zoneId,
    } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check permissions
    const currentUserRole = req.user?.role;
    const userToUpdateRole = user.role;

    // SUPERADMIN can update anyone
    if (currentUserRole === "SUPERADMIN") {
      // Allow update
    }
    // SUBADMIN can only update agents they created
    else if (currentUserRole === "SUBADMIN") {
      // Check if the user to update is an agent
      if (userToUpdateRole !== "AGENT") {
        return res.status(403).json({
          success: false,
          message: "You can only update agents",
        });
      }

      // Check if the current user created this agent
      if (user.createdBy?.toString() !== req.user?.sub) {
        return res.status(403).json({
          success: false,
          message: "You can only update agents you created",
        });
      }

      // SUBADMIN cannot change role or status
      if (role || status) {
        return res.status(403).json({
          success: false,
          message: "You cannot change role or status",
        });
      }
    }
    // AGENT cannot update anyone
    else {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions to update users",
      });
    }

    // Check if email already exists (if email is being updated)
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email, _id: { $ne: id } });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "Email already exists",
        });
      }
    }

    // Check if username already exists (if username is being updated)
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username, _id: { $ne: id } });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "Username already exists",
        });
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (username) updateData.username = username;
    if (contactNumber) updateData.contactNumber = contactNumber;
    if (role) updateData.role = role;
    if (status) updateData.status = status;
    if (teamId) updateData.teamId = teamId;
    if (zoneId) updateData.zoneId = zoneId;

    // Handle password update (findByIdAndUpdate doesn't trigger pre-save hook)
    if (password) {
      const saltRounds = 12;
      updateData.password = await bcrypt.hash(password, saltRounds);
      updateData.originalPassword = password; // Store original password for admin viewing
    }

    const updatedUser = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update user",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Delete user (Superadmin/Subadmin can delete agents they created)
export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent deleting own account
    if ((user as any)._id.toString() === req.user?.sub) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete your own account",
      });
    }

    // Check permissions
    const currentUserRole = req.user?.role;
    const userToDeleteRole = user.role;

    // SUPERADMIN can delete anyone
    if (currentUserRole === "SUPERADMIN") {
      // Allow deletion
    }
    // SUBADMIN can only delete agents they created
    else if (currentUserRole === "SUBADMIN") {
      // Check if the user to delete is an agent
      if (userToDeleteRole !== "AGENT") {
        return res.status(403).json({
          success: false,
          message: "You can only delete agents",
        });
      }

      // Check if the current user created this agent
      if (user.createdBy?.toString() !== req.user?.sub) {
        return res.status(403).json({
          success: false,
          message: "You can only delete agents you created",
        });
      }
    }
    // AGENT cannot delete anyone
    else {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions to delete users",
      });
    }

    await User.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get user by ID (Superadmin/Subadmin only)
export const getUserById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Error getting user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get user",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// List all users with pagination (Superadmin/Subadmin only)
export const listUsers = async (req: AuthRequest, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      role,
      status,
      teamId,
      search,
      excludeAssigned,
    } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter: any = {};
    if (role) filter.role = role;
    if (status) filter.status = status;
    if (teamId) filter.teamIds = teamId;

    // Add search functionality
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
      ];
    }

    // If user is not superadmin, only show users they created
    if (req.user?.role !== "SUPERADMIN") {
      filter.createdBy = req.user?.sub;
    }

    let users = await User.find(filter)
      .select("-password")
      .populate("primaryTeamId", "name")
      .populate("primaryZoneId", "name")
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    // If excludeAssigned is true, filter out agents who have active or scheduled zone assignments
    if (excludeAssigned === "true" && role === "AGENT") {
      console.log(
        "🔍 Filtering out agents with active/scheduled assignments..."
      );

      const { AgentZoneAssignment } = require("../models/AgentZoneAssignment");
      const { ScheduledAssignment } = require("../models/ScheduledAssignment");

      const filteredUsers = [];

      for (const user of users) {
        // Check for active individual zone assignments
        const hasActiveIndividualAssignments = await AgentZoneAssignment.exists(
          {
            agentId: user._id,
            status: { $nin: ["COMPLETED", "CANCELLED"] },
            effectiveTo: null,
          }
        );

        // Check for pending scheduled individual assignments
        const hasPendingScheduledAssignments = await ScheduledAssignment.exists(
          {
            agentId: user._id,
            status: "PENDING",
          }
        );

        // Check for active team zone assignments (if agent is part of teams)
        let hasActiveTeamAssignments = false;
        if (user.teamIds && user.teamIds.length > 0) {
          hasActiveTeamAssignments = await AgentZoneAssignment.exists({
            teamId: { $in: user.teamIds },
            status: { $nin: ["COMPLETED", "CANCELLED"] },
            effectiveTo: null,
          });
        }

        // Check for pending scheduled team assignments
        let hasPendingTeamScheduledAssignments = false;
        if (user.teamIds && user.teamIds.length > 0) {
          hasPendingTeamScheduledAssignments = await ScheduledAssignment.exists(
            {
              teamId: { $in: user.teamIds },
              status: "PENDING",
            }
          );
        }

        const hasAnyAssignments =
          hasActiveIndividualAssignments ||
          hasPendingScheduledAssignments ||
          hasActiveTeamAssignments ||
          hasPendingTeamScheduledAssignments;

        console.log(
          `🔍 Agent ${user.email}: hasActiveIndividual=${hasActiveIndividualAssignments}, hasPendingScheduled=${hasPendingScheduledAssignments}, hasActiveTeam=${hasActiveTeamAssignments}, hasPendingTeamScheduled=${hasPendingTeamScheduledAssignments}, hasAnyAssignments=${hasAnyAssignments}`
        );

        // Only include agents who don't have any active or scheduled assignments
        if (!hasAnyAssignments) {
          filteredUsers.push(user);
        }
      }

      users = filteredUsers;
      console.log(
        `✅ Filtered ${users.length} agents without active/scheduled assignments`
      );
    }

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Error listing users:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list users",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get my team members (Subadmin/Agent only)
export const getMyTeamMembers = async (req: AuthRequest, res: Response) => {
  try {
    const teamMembers = await User.find({
      teamIds: req.user?.teamIds,
      role: { $in: ["SUBADMIN", "AGENT"] },
    })
      .select("-password")
      .populate("zoneId", "name")
      .sort({ name: 1 });

    res.json({
      success: true,
      data: teamMembers,
    });
  } catch (error) {
    console.error("Error getting team members:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get team members",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Assign agent to team (Subadmin only)
export const assignAgentToTeam = async (req: AuthRequest, res: Response) => {
  try {
    const { agentId, teamId } = req.body;

    // Validate agent exists
    const agent = await User.findById(agentId);
    if (!agent || agent.role !== "AGENT") {
      return res.status(404).json({
        success: false,
        message: "Agent not found",
      });
    }

    // Validate team exists
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    // Update agent's team
    await User.findByIdAndUpdate(agentId, { teamId });

    res.json({
      success: true,
      message: "Agent assigned to team successfully",
    });
  } catch (error) {
    console.error("Error assigning agent to team:", error);
    res.status(500).json({
      success: false,
      message: "Failed to assign agent to team",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get my profile (All authenticated users)
export const getMyProfile = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user?.sub)
      .select("-password")
      .populate("primaryTeamId", "name")
      .populate("primaryZoneId", "name");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: {
        user: user,
      },
    });
  } catch (error) {
    console.error("Error getting profile:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get profile",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Update my profile (All authenticated users)
export const updateMyProfile = async (req: AuthRequest, res: Response) => {
  try {
    const { name, email } = req.body;

    // Check if email already exists (if email is being updated)
    if (email) {
      const existingUser = await User.findOne({
        email,
        _id: { $ne: req.user?.sub },
      });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "Email already exists",
        });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user?.sub,
      { name, email },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get my zone info (Agent only)
export const getMyZoneInfo = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user?.sub).populate("primaryZoneId");

    if (!user || !user.primaryZoneId) {
      return res.status(404).json({
        success: false,
        message: "No zone assigned",
      });
    }

    res.json({
      success: true,
      data: user.primaryZoneId,
    });
  } catch (error) {
    console.error("Error getting zone info:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get zone info",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get all territories assigned to logged-in agent (Agent only)
export const getMyTerritories = async (req: AuthRequest, res: Response) => {
  try {
    const agentId = req.user?.sub;

    if (!agentId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Get agent information
    const agent = await User.findById(agentId);
    if (!agent || agent.role !== "AGENT") {
      return res.status(404).json({
        success: false,
        message: "Agent not found",
      });
    }

    console.log(
      `\n🔍 getMyTerritories: Fetching territories for agent ${agent.name} (${agentId})`
    );
    console.log(
      `📋 getMyTerritories: Agent teams: [${agent.teamIds.join(", ")}]`
    );
    console.log(
      `📋 getMyTerritories: Agent primaryZoneId: ${
        agent.primaryZoneId || "None"
      }`
    );

    // Import ScheduledAssignment model
    const { ScheduledAssignment } = require("../models/ScheduledAssignment");

    // 1. Get all individual zone assignments for this agent
    console.log(`🔍 getMyTerritories: Fetching individual assignments...`);
    const individualZoneAssignments = await AgentZoneAssignment.find({
      agentId: agent._id,
      status: { $nin: ["COMPLETED", "CANCELLED"] },
      effectiveTo: null,
    }).populate({
      path: "zoneId",
      select:
        "name description status createdBy areaId municipalityId communityId",
      populate: [
        {
          path: "areaId",
          select: "name type",
        },
        {
          path: "municipalityId",
          select: "name type",
        },
        {
          path: "communityId",
          select: "name type",
        },
      ],
    });
    console.log(
      `📋 getMyTerritories: Found ${individualZoneAssignments.length} individual assignments`
    );

    // 2. Get all team zone assignments for this agent's teams
    console.log(`🔍 getMyTerritories: Fetching team assignments...`);
    const teamZoneAssignments = await AgentZoneAssignment.find({
      teamId: { $in: agent.teamIds },
      status: { $nin: ["COMPLETED", "CANCELLED"] },
      effectiveTo: null,
    })
      .populate({
        path: "zoneId",
        select:
          "name description status createdBy areaId municipalityId communityId",
        populate: [
          {
            path: "areaId",
            select: "name type",
          },
          {
            path: "municipalityId",
            select: "name type",
          },
          {
            path: "communityId",
            select: "name type",
          },
        ],
      })
      .populate("teamId", "name");
    console.log(
      `📋 getMyTerritories: Found ${teamZoneAssignments.length} team assignments`
    );

    // 3. Get all PENDING scheduled individual assignments
    console.log(
      `🔍 getMyTerritories: Fetching scheduled individual assignments...`
    );
    const pendingIndividualScheduledAssignments =
      await ScheduledAssignment.find({
        agentId: agent._id,
        status: "PENDING",
      }).populate({
        path: "zoneId",
        select:
          "name description status createdBy areaId municipalityId communityId",
        populate: [
          {
            path: "areaId",
            select: "name type",
          },
          {
            path: "municipalityId",
            select: "name type",
          },
          {
            path: "communityId",
            select: "name type",
          },
        ],
      });
    console.log(
      `📋 getMyTerritories: Found ${pendingIndividualScheduledAssignments.length} scheduled individual assignments`
    );

    // 4. Get all PENDING scheduled team assignments
    console.log(`🔍 getMyTerritories: Fetching scheduled team assignments...`);
    const pendingTeamScheduledAssignments = await ScheduledAssignment.find({
      teamId: { $in: agent.teamIds },
      status: "PENDING",
    })
      .populate({
        path: "zoneId",
        select:
          "name description status createdBy areaId municipalityId communityId",
        populate: [
          {
            path: "areaId",
            select: "name type",
          },
          {
            path: "municipalityId",
            select: "name type",
          },
          {
            path: "communityId",
            select: "name type",
          },
        ],
      })
      .populate("teamId", "name");
    console.log(
      `📋 getMyTerritories: Found ${pendingTeamScheduledAssignments.length} scheduled team assignments`
    );

    // Combine all assignments (active + scheduled)
    const allAssignments = [
      ...individualZoneAssignments.map((a) => ({
        assignment: a,
        assignmentType: "individual" as const,
        isScheduled: false,
        teamName: null,
      })),
      ...teamZoneAssignments.map((a) => ({
        assignment: a,
        assignmentType: "team" as const,
        isScheduled: false,
        teamName: (a.teamId as any)?.name || "Unknown Team",
      })),
      ...pendingIndividualScheduledAssignments.map((a: any) => ({
        assignment: a,
        assignmentType: "individual" as const,
        isScheduled: true,
        teamName: null,
      })),
      ...pendingTeamScheduledAssignments.map((a: any) => ({
        assignment: a,
        assignmentType: "team" as const,
        isScheduled: true,
        teamName: (a.teamId as any)?.name || "Unknown Team",
      })),
    ];

    console.log(
      `📋 getMyTerritories: Total assignments before deduplication: ${allAssignments.length}`
    );

    // Create a map to deduplicate zones by zoneId
    const zoneMap = new Map();

    allAssignments.forEach((item) => {
      const zoneId = item.assignment.zoneId._id.toString();

      // If zone not in map or current assignment is not scheduled (prefer active over scheduled)
      if (
        !zoneMap.has(zoneId) ||
        (!item.isScheduled && zoneMap.get(zoneId).isScheduled)
      ) {
        zoneMap.set(zoneId, item);
      }
    });

    console.log(
      `📋 getMyTerritories: Unique territories after deduplication: ${zoneMap.size}`
    );

    // Build territory data with statistics
    const territories = await Promise.all(
      Array.from(zoneMap.values()).map(async (item) => {
        const zone = item.assignment.zoneId;
        const isPrimary =
          zone._id.toString() === agent.primaryZoneId?.toString();

        // Calculate statistics directly from Resident collection for real-time accuracy
        const totalHouses = await Resident.countDocuments({ zoneId: zone._id });

        // Count visited (includes: visited, interested, callback, appointment, follow-up)
        const visitedCount = await Resident.countDocuments({
          zoneId: zone._id,
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

        // Count not visited
        const notVisitedCount = await Resident.countDocuments({
          zoneId: zone._id,
          status: "not-visited",
        });

        // Count interested
        const interestedCount = await Resident.countDocuments({
          zoneId: zone._id,
          status: "interested",
        });

        // Count not interested
        const notInterestedCount = await Resident.countDocuments({
          zoneId: zone._id,
          status: "not-interested",
        });

        // Calculate zone status: COMPLETED if no residents with "not-visited" status
        let calculatedStatus = zone.status; // Default to stored status
        if (totalHouses > 0 && notVisitedCount === 0) {
          calculatedStatus = "COMPLETED";
        } else if (totalHouses > 0 && notVisitedCount > 0) {
          calculatedStatus = "ACTIVE";
        }

        return {
          _id: zone._id,
          name: zone.name,
          description: zone.description,
          status: calculatedStatus, // Use calculated status instead of stored status
          createdBy: zone.createdBy, // Add createdBy field for ownership check
          assignmentType: item.assignmentType,
          isScheduled: item.isScheduled,
          isPrimary: isPrimary,
          teamName: item.teamName,
          teamId:
            item.assignmentType === "team"
              ? (item.assignment.teamId as any)?._id ||
                (item.assignment.teamId as any)
              : null,
          scheduledDate: item.isScheduled
            ? (item.assignment as any).scheduledDate
            : null,
          statistics: {
            totalHouses,
            visitedCount,
            notVisitedCount,
            interestedCount,
            notInterestedCount,
            completionPercentage:
              totalHouses > 0
                ? Math.round((visitedCount / totalHouses) * 100)
                : 0,
          },
          boundary: zone.boundary,
          buildingData: {
            totalBuildings: zone.buildingData?.totalBuildings || totalHouses,
            residentialHomes:
              zone.buildingData?.residentialHomes || totalHouses,
            addresses: (zone.buildingData?.addresses || []).slice(0, 5), // Return only first 5 addresses for preview
          },
          createdAt: zone.createdAt,
          updatedAt: zone.updatedAt,
          lastActivity: zone.lastActivity || zone.updatedAt,
          totalResidents: zone.totalResidents || totalHouses,
          activeResidents: zone.activeResidents || 0,
          completionRate:
            totalHouses > 0
              ? Math.round((visitedCount / totalHouses) * 100)
              : 0,
          averageKnocks: zone.averageKnocks || 0,
          // Add location hierarchy fields
          areaId: zone.areaId,
          municipalityId: zone.municipalityId,
          communityId: zone.communityId,
        };
      })
    );

    // Calculate overall statistics
    const totalTerritories = territories.length;
    const activeTerritories = territories.filter((t) => !t.isScheduled).length;
    const scheduledTerritories = territories.filter(
      (t) => t.isScheduled
    ).length;
    const totalHousesAcrossAll = territories.reduce(
      (sum, t) => sum + t.statistics.totalHouses,
      0
    );
    const totalVisitedAcrossAll = territories.reduce(
      (sum, t) => sum + t.statistics.visitedCount,
      0
    );
    const totalNotVisitedAcrossAll = territories.reduce(
      (sum, t) => sum + t.statistics.notVisitedCount,
      0
    );

    console.log(
      `✅ getMyTerritories: Returning ${territories.length} territories`
    );
    console.log(
      `📊 getMyTerritories: Stats - Active: ${activeTerritories}, Scheduled: ${scheduledTerritories}, Total Houses: ${totalHousesAcrossAll}`
    );

    res.json({
      success: true,
      data: {
        territories,
        summary: {
          totalTerritories,
          activeTerritories,
          scheduledTerritories,
          totalHouses: totalHousesAcrossAll,
          visitedHouses: totalVisitedAcrossAll,
          notVisitedHouses: totalNotVisitedAcrossAll,
          completionPercentage:
            totalHousesAcrossAll > 0
              ? Math.round((totalVisitedAcrossAll / totalHousesAcrossAll) * 100)
              : 0,
        },
      },
    });
  } catch (error) {
    console.error("❌ getMyTerritories: Error fetching territories:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch territories",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get agent dashboard stats (Agent only)
export const getAgentDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const agentId = req.user?.sub;

    if (!agentId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Get agent information
    const agent = await User.findById(agentId);
    if (!agent || agent.role !== "AGENT") {
      return res.status(404).json({
        success: false,
        message: "Agent not found",
      });
    }

    // Get today's date range (start and end of today)
    // Use UTC to avoid timezone issues
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    // Get yesterday's date range (start and end of yesterday)
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    // Debug logging
    console.log("📊 Dashboard Stats - Date Range:", {
      now: now.toISOString(),
      today: today.toISOString(),
      tomorrow: tomorrow.toISOString(),
      yesterday: yesterday.toISOString(),
      agentId: agent._id.toString(),
    });

    // 1. Calculate Total Activities Today
    // Count all activities (VISIT + PROPERTY_OPERATION + ZONE_OPERATION + ROUTE_OPERATION) done today
    const totalActivitiesToday = await Activity.countDocuments({
      agentId: agent._id,
      startedAt: {
        $gte: today,
        $lt: tomorrow,
      },
    });
    
    // Debug: Check activities by type
    const activitiesByType = await Activity.aggregate([
      {
        $match: {
          agentId: agent._id,
          startedAt: {
            $gte: today,
            $lt: tomorrow,
          },
        },
      },
      {
        $group: {
          _id: "$activityType",
          count: { $sum: 1 },
        },
      },
    ]);
    console.log("📊 Dashboard Stats - Activities by Type Today:", activitiesByType);

    // For backward compatibility, keep todayTasksCount name but use activities count
    const todayTasksCount = totalActivitiesToday;

    // 2. Calculate Completed Tasks
    // Completed = Territories where agent has completed activities today OR territories with COMPLETED status
    // Get territories marked as COMPLETED today
    const completedTerritoriesAssignments = await AgentZoneAssignment.find({
      $or: [
        { agentId: agent._id },
        { teamId: { $in: agent.teamIds } },
      ],
      status: "COMPLETED",
      effectiveTo: {
        $gte: today,
        $lt: tomorrow,
      },
    }).populate("zoneId", "_id");

    // Get territories where agent has VISIT activities today (door-knocking)
    // Only VISIT activities count as completed tasks, not property status updates
    const territoriesWithVisitActivitiesToday = await Activity.distinct("zoneId", {
      agentId: agent._id,
      startedAt: {
        $gte: today,
        $lt: tomorrow,
      },
      zoneId: { $ne: null },
      activityType: "VISIT",
    });

    // Combine and deduplicate: territories that are either COMPLETED OR have VISIT activities today
    const completedZoneIds = new Set<string>();
    
    // Add zones from COMPLETED assignments
    completedTerritoriesAssignments.forEach((assignment: any) => {
      let zoneId: string | null = null;
      if (assignment.zoneId) {
        if (typeof assignment.zoneId === 'object' && assignment.zoneId._id) {
          zoneId = assignment.zoneId._id.toString();
        } else if (typeof assignment.zoneId === 'object' && assignment.zoneId.toString) {
          zoneId = assignment.zoneId.toString();
        } else {
          zoneId = assignment.zoneId.toString();
        }
      }
      if (zoneId) {
        completedZoneIds.add(zoneId);
      }
    });

    // Add zones from VISIT activities (convert ObjectIds to strings)
    territoriesWithVisitActivitiesToday.forEach((zoneId: any) => {
      if (zoneId) {
        const zoneIdStr = zoneId.toString ? zoneId.toString() : String(zoneId);
        completedZoneIds.add(zoneIdStr);
      }
    });

    const completedTasksCount = completedZoneIds.size;

    // 3. Calculate Pending Tasks
    const pendingTasksCount = todayTasksCount - completedTasksCount;

    // 4. Get Territories count and Performance
    // Get territories data (reuse existing logic)
    const individualZoneAssignments = await AgentZoneAssignment.find({
      agentId: agent._id,
      status: { $nin: ["COMPLETED", "CANCELLED"] },
      effectiveTo: null,
    }).populate("zoneId", "_id");

    const teamZoneAssignments = await AgentZoneAssignment.find({
      teamId: { $in: agent.teamIds },
      status: { $nin: ["COMPLETED", "CANCELLED"] },
      effectiveTo: null,
    }).populate("zoneId", "_id");

    const pendingIndividualScheduled = await ScheduledAssignment.find({
      agentId: agent._id,
      status: "PENDING",
    }).populate("zoneId", "_id");

    const pendingTeamScheduled = await ScheduledAssignment.find({
      teamId: { $in: agent.teamIds },
      status: "PENDING",
    }).populate("zoneId", "_id");

    // Deduplicate zones
    const zoneMap = new Map();
    [...individualZoneAssignments, ...teamZoneAssignments, ...pendingIndividualScheduled, ...pendingTeamScheduled].forEach((item: any) => {
      const zoneId = item.zoneId?._id?.toString();
      if (zoneId && !zoneMap.has(zoneId)) {
        zoneMap.set(zoneId, item.zoneId);
      }
    });

    const territoriesCount = zoneMap.size;

    // Calculate performance from ACTIVE territories only (visited houses / total houses)
    // Exclude scheduled territories as they haven't started yet
    const activeZoneMap = new Map();
    [...individualZoneAssignments, ...teamZoneAssignments].forEach((item: any) => {
      const zoneId = item.zoneId?._id?.toString();
      if (zoneId && !activeZoneMap.has(zoneId)) {
        activeZoneMap.set(zoneId, item.zoneId);
      }
    });

    let totalHouses = 0;
    let visitedHouses = 0;

    for (const zoneId of activeZoneMap.keys()) {
      const total = await Resident.countDocuments({ zoneId: new mongoose.Types.ObjectId(zoneId) });
      const visited = await Resident.countDocuments({
        zoneId: new mongoose.Types.ObjectId(zoneId),
        status: {
          $in: ["visited", "interested", "callback", "appointment", "follow-up"],
        },
      });
      totalHouses += total;
      visitedHouses += visited;
    }

    const performance = totalHouses > 0 ? Math.round((visitedHouses / totalHouses) * 100) : 0;

    // 5. Calculate Total Routes (all active routes, not just today)
    const totalRoutesCount = await Route.countDocuments({
      agentId: agent._id,
      status: { $nin: ["CANCELLED", "ARCHIVED"] },
    });

    // 6. Get Today's Schedule (routes for today with PLANNED/IN_PROGRESS status)
    const todaySchedule = await Route.find({
      agentId: agent._id,
      date: {
        $gte: today,
        $lt: tomorrow,
      },
      status: { $in: ["PLANNED", "IN_PROGRESS"] },
    })
      .populate("zoneId", "name")
      .populate("teamId", "name")
      .sort({ priority: -1, createdAt: -1 })
      .limit(10);

    // 7. Calculate Total Visits Today (VISIT activities only)
    const totalVisitsToday = await Activity.countDocuments({
      agentId: agent._id,
      activityType: "VISIT",
      startedAt: {
        $gte: today,
        $lt: tomorrow,
      },
    });

    // 7a. Calculate Total Visits Yesterday (VISIT activities only)
    const totalVisitsYesterday = await Activity.countDocuments({
      agentId: agent._id,
      activityType: "VISIT",
      startedAt: {
        $gte: yesterday,
        $lt: today,
      },
    });

    // 8. Calculate Leads Created Today
    const leadsCreatedToday = await Activity.countDocuments({
      agentId: agent._id,
      activityType: "VISIT",
      response: "LEAD_CREATED",
      startedAt: {
        $gte: today,
        $lt: tomorrow,
      },
    });

    // 8a. Calculate Completed Visits Today (successful outcomes)
    // Completed = visits with LEAD_CREATED, APPOINTMENT_SET, or FOLLOW_UP
    const completedVisitsToday = await Activity.countDocuments({
      agentId: agent._id,
      activityType: "VISIT",
      response: { $in: ["LEAD_CREATED", "APPOINTMENT_SET", "FOLLOW_UP"] },
      startedAt: {
        $gte: today,
        $lt: tomorrow,
      },
    });

    // 8b. Calculate Pending Visits Today (needs follow-up or negative outcomes)
    // Pending = visits with NO_ANSWER, NOT_INTERESTED, or CALL_BACK
    const pendingVisitsToday = await Activity.countDocuments({
      agentId: agent._id,
      activityType: "VISIT",
      response: { $in: ["NO_ANSWER", "NOT_INTERESTED", "CALL_BACK"] },
      startedAt: {
        $gte: today,
        $lt: tomorrow,
      },
    });

    // 9. Calculate Total Properties in Zones Created by Current User
    // Find all zones created by the current user
    const zonesCreatedByUser = await Zone.find({
      createdBy: agent._id,
    }).select("_id");

    const zoneIdsCreatedByUser = zonesCreatedByUser.map((zone) => zone._id);
    const totalZonesCreatedByUser = zonesCreatedByUser.length;

    // Count all residents/properties in those zones
    const totalPropertiesInCreatedZones = zoneIdsCreatedByUser.length > 0
      ? await Resident.countDocuments({
          zoneId: { $in: zoneIdsCreatedByUser },
        })
      : 0;

    // 10. Get Recent Activities (last 10 activities, sorted by when they actually happened)
    const recentActivities = await Activity.find({
      agentId: agent._id,
    })
      .populate("propertyId", "addressLine1 city state")
      .populate("zoneId", "name")
      .populate("agentId", "name email")
      .sort({ startedAt: -1 }) // Sort by when activity actually happened, not when record was created
      .limit(10);

    res.json({
      success: true,
      data: {
        stats: {
          todayTasks: todayTasksCount,
          completedTasks: completedTasksCount,
          pendingTasks: pendingTasksCount,
          performance,
          territories: territoriesCount,
          routes: totalRoutesCount,
          totalVisitsToday,
          totalVisitsYesterday,
          leadsCreatedToday,
          completedVisitsToday,
          pendingVisitsToday,
          totalPropertiesInCreatedZones,
          totalZonesCreatedByUser,
        },
        todaySchedule: todaySchedule.map((route) => ({
          _id: route._id,
          name: route.name,
          zoneId: route.zoneId,
          teamId: route.teamId,
          date: route.date,
          status: route.status,
          priority: route.priority,
          stops: route.stops,
          totalDuration: route.totalDuration,
          totalDistance: route.totalDistance,
          optimizationSettings: route.optimizationSettings,
          analytics: route.analytics,
        })),
        recentActivities: recentActivities.map((activity) => ({
          _id: activity._id,
          agentId: activity.agentId,
          propertyId: activity.propertyId,
          zoneId: activity.zoneId,
          residentId: activity.residentId,
          activityType: activity.activityType,
          operationType: activity.operationType,
          startedAt: activity.startedAt,
          endedAt: activity.endedAt,
          durationSeconds: activity.durationSeconds,
          response: activity.response,
          notes: activity.notes,
          createdAt: (activity as any).createdAt,
          updatedAt: (activity as any).updatedAt,
        })),
      },
    });
  } catch (error) {
    console.error("❌ getAgentDashboardStats: Error fetching dashboard stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard stats",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get system analytics (Superadmin only)
export const getSystemAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalTeams = await Team.countDocuments();
    const totalZones = await Zone.countDocuments();
    const activeAgents = await User.countDocuments({
      role: "AGENT",
      status: "ACTIVE",
    });

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
    console.error("Error getting system analytics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get system analytics",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get team performance (Superadmin/Subadmin only)
export const getTeamPerformance = async (req: AuthRequest, res: Response) => {
  try {
    const { teamId } = req.params;
    const { startDate, endDate } = req.query;

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    // Get team members (using new array field)
    const teamMembers = await User.find({
      teamIds: teamId,
      role: "AGENT",
    }).select("name email");

    // Get assignments for this team
    const assignments = await AgentZoneAssignment.find({
      agentId: { $in: teamMembers.map((member) => member._id) },
    }).populate("agentId", "name");

    res.json({
      success: true,
      data: {
        team,
        members: teamMembers,
        assignments,
      },
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

// Get agents created by current admin (Superadmin/Subadmin only)
export const getMyCreatedAgents = async (req: AuthRequest, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      excludeAssigned,
      includeTeamInfo,
      excludeTeamId,
    } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter: any = {
      role: "AGENT",
      createdBy: req.user?.sub,
    };

    // Only add status filter if not requesting 'all' statuses
    if (status && status !== "all") {
      filter.status = status;
    } else if (status !== "all") {
      filter.status = "ACTIVE"; // Default to ACTIVE only if not explicitly requesting 'all'
    }

    // Exclude agents who are already members of the specified team
    if (excludeTeamId) {
      filter.teamIds = { $ne: excludeTeamId };
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
      ];
    }

    let agents;

    if (includeTeamInfo === "true") {
      // Enhanced query with team membership information
      agents = await User.find(filter)
        .select("-password")
        .populate("primaryTeamId", "name status assignmentStatus")
        .populate("primaryZoneId", "name")
        .populate("createdBy", "name email")
        .populate({
          path: "teamIds",
          select: "name status assignmentStatus",
          match: { createdBy: req.user?.sub }, // Only show teams created by current admin
        })
        .skip(skip)
        .limit(Number(limit))
        .sort({ createdAt: -1 });
    } else {
      // Original simple query
      agents = await User.find(filter)
        .select("-password")
        .populate("primaryTeamId", "name")
        .populate("primaryZoneId", "name")
        .populate("createdBy", "name email")
        .skip(skip)
        .limit(Number(limit))
        .sort({ createdAt: -1 });
    }

    // If excludeAssigned is true, filter out agents who have active or scheduled zone assignments
    if (excludeAssigned === "true") {
      console.log(
        "🔍 Filtering out agents with active/scheduled assignments..."
      );

      const filteredAgents = [];

      for (const agent of agents) {
        // Check for active individual zone assignments
        const hasActiveIndividualAssignments =
          !!(await AgentZoneAssignment.exists({
            agentId: agent._id,
            status: { $nin: ["COMPLETED", "CANCELLED"] },
            effectiveTo: null,
          }));

        // Check for pending scheduled individual assignments
        const hasPendingScheduledAssignments =
          !!(await ScheduledAssignment.exists({
            agentId: agent._id,
            status: "PENDING",
          }));

        // Check for active team zone assignments (if agent is part of teams)
        let hasActiveTeamAssignments = false;
        if (agent.teamIds && agent.teamIds.length > 0) {
          hasActiveTeamAssignments = !!(await AgentZoneAssignment.exists({
            teamId: { $in: agent.teamIds },
            status: { $nin: ["COMPLETED", "CANCELLED"] },
            effectiveTo: null,
          }));
        }

        // Check for pending scheduled team assignments
        let hasPendingTeamScheduledAssignments = false;
        if (agent.teamIds && agent.teamIds.length > 0) {
          hasPendingTeamScheduledAssignments =
            !!(await ScheduledAssignment.exists({
              teamId: { $in: agent.teamIds },
              status: "PENDING",
            }));
        }

        const hasAnyAssignments =
          hasActiveIndividualAssignments ||
          hasPendingScheduledAssignments ||
          hasActiveTeamAssignments ||
          hasPendingTeamScheduledAssignments;

        console.log(
          `🔍 Agent ${agent.email}: hasActiveIndividual=${hasActiveIndividualAssignments}, hasPendingScheduled=${hasPendingScheduledAssignments}, hasActiveTeam=${hasActiveTeamAssignments}, hasPendingTeamScheduled=${hasPendingTeamScheduledAssignments}, hasAnyAssignments=${hasAnyAssignments}`
        );

        // Only include agents who don't have any active or scheduled assignments
        if (!hasAnyAssignments) {
          filteredAgents.push(agent);
        }
      }

      agents = filteredAgents;
      console.log(
        `✅ Filtered ${agents.length} agents without active/scheduled assignments`
      );
    }

    // Calculate correct status and get all zone information
    const agentsWithCorrectStatus = await Promise.all(
      agents.map(async (agent: any) => {
        const calculatedStatus = await calculateAgentStatus(
          (agent._id as any).toString()
        );

        // Get team zone information if agent is part of a team
        let teamZoneInfo = null;
        if (agent.primaryTeamId) {
          const teamZoneAssignment = await AgentZoneAssignment.findOne({
            teamId: agent.primaryTeamId._id,
            status: { $nin: ["COMPLETED", "CANCELLED"] },
            effectiveTo: null,
          }).populate("zoneId", "name");

          if (teamZoneAssignment && teamZoneAssignment.zoneId) {
            teamZoneInfo = {
              _id: teamZoneAssignment.zoneId._id,
              name: (teamZoneAssignment.zoneId as any).name,
            };
          }
        }

        // Import ScheduledAssignment model
        const {
          ScheduledAssignment,
        } = require("../models/ScheduledAssignment");

        // Get all individual zone assignments for this agent
        const individualZoneAssignments = await AgentZoneAssignment.find({
          agentId: agent._id,
          status: { $nin: ["COMPLETED", "CANCELLED"] },
          effectiveTo: null,
        }).populate("zoneId", "name");

        // Get all team zone assignments for this agent's teams
        const teamZoneAssignments = await AgentZoneAssignment.find({
          teamId: { $in: agent.teamIds },
          status: { $nin: ["COMPLETED", "CANCELLED"] },
          effectiveTo: null,
        }).populate("zoneId", "name");

        // Get all PENDING scheduled individual assignments
        const pendingIndividualScheduledAssignments =
          await ScheduledAssignment.find({
            agentId: agent._id,
            status: "PENDING",
          }).populate("zoneId", "name");

        // Get all PENDING scheduled team assignments
        const pendingTeamScheduledAssignments = await ScheduledAssignment.find({
          teamId: { $in: agent.teamIds },
          status: "PENDING",
        }).populate("zoneId", "name");

        // Combine all assignments (active + scheduled)
        const allAssignments = [
          ...individualZoneAssignments,
          ...teamZoneAssignments,
          ...pendingIndividualScheduledAssignments,
          ...pendingTeamScheduledAssignments,
        ];

        // Create a map of zones from all assignment records (both active and scheduled)
        // Use a Map to deduplicate zones by zoneId
        const zoneMap = new Map();

        allAssignments.forEach((assignment) => {
          const zoneId = assignment.zoneId._id.toString();
          if (!zoneMap.has(zoneId)) {
            zoneMap.set(zoneId, {
              _id: assignment.zoneId._id,
              name: assignment.zoneId.name,
              isPrimary:
                assignment.zoneId._id.toString() ===
                agent.primaryZoneId?._id?.toString(),
              isScheduled: assignment.status === "PENDING", // Add flag to identify scheduled assignments
            });
          }
        });

        const assignmentZones = Array.from(zoneMap.values());

        // If no assignment records found, fall back to User model's zoneIds
        let allAssignedZones = assignmentZones;
        if (
          assignmentZones.length === 0 &&
          agent.zoneIds &&
          agent.zoneIds.length > 0
        ) {
          // Get zone details from the zoneIds array
          const Zone = require("../models/Zone").default;
          const zones = await Zone.find({ _id: { $in: agent.zoneIds } }).select(
            "name"
          );
          allAssignedZones = zones.map((zone: any) => ({
            _id: zone._id,
            name: zone.name,
            isPrimary:
              zone._id.toString() === agent.primaryZoneId?._id?.toString(),
          }));
        }

        // Determine assignment status based on zone assignments
        const hasZoneAssignment = allAssignments.length > 0;
        const assignmentStatus = hasZoneAssignment ? "ASSIGNED" : "UNASSIGNED";

        // Get team information for all teams the user is a member of
        let teamInfo = null;
        let teamMemberships = null;

        if (agent.teamIds && agent.teamIds.length > 0) {
          if (includeTeamInfo === "true") {
            // Enhanced team membership information
            teamMemberships =
              agent.teamIds
                ?.filter(
                  (team: any) => team && typeof team === "object" && team._id
                )
                .map((team: any) => ({
                  teamId: team._id,
                  teamName: team.name || "Unknown Team",
                  teamStatus: team.status || "UNKNOWN",
                  teamAssignmentStatus: team.assignmentStatus || "UNKNOWN",
                  isPrimary:
                    agent.primaryTeamId?._id?.toString() ===
                    team._id?.toString(),
                })) || [];
          } else {
            // Simple team information
            const Team = require("../models/Team").default;
            const teams = await Team.find({
              _id: { $in: agent.teamIds },
            }).select("name");
            if (teams.length > 0) {
              teamInfo = teams.map((team: any) => ({
                _id: team._id,
                name: team.name,
              }));
            }
          }
        }

        // Create assignment summary for enhanced response
        let assignmentSummary = null;
        if (includeTeamInfo === "true") {
          assignmentSummary = {
            totalActiveZones:
              individualZoneAssignments.length + teamZoneAssignments.length,
            totalScheduledZones:
              pendingIndividualScheduledAssignments.length +
              pendingTeamScheduledAssignments.length,
            hasActiveAssignments:
              individualZoneAssignments.length + teamZoneAssignments.length > 0,
            hasScheduledAssignments:
              pendingIndividualScheduledAssignments.length +
                pendingTeamScheduledAssignments.length >
              0,
            individualZones: individualZoneAssignments.map(
              (a: any) => a.zoneId?.name || "Unknown"
            ),
            teamZones: teamZoneAssignments.map(
              (a: any) => a.zoneId?.name || "Unknown"
            ),
            scheduledZones: [
              ...pendingIndividualScheduledAssignments,
              ...pendingTeamScheduledAssignments,
            ].map((a: any) => a.zoneId?.name || "Unknown"),
            // Enhanced assignment status details
            currentAssignmentStatus: assignmentStatus,
            assignmentDetails: {
              hasIndividualAssignments: individualZoneAssignments.length > 0,
              hasTeamAssignments: teamZoneAssignments.length > 0,
              hasScheduledIndividualAssignments:
                pendingIndividualScheduledAssignments.length > 0,
              hasScheduledTeamAssignments:
                pendingTeamScheduledAssignments.length > 0,
              totalAssignments: allAssignments.length,
              isFullyAssigned: allAssignments.length > 0,
              isPartiallyAssigned:
                (individualZoneAssignments.length > 0 ||
                  teamZoneAssignments.length > 0) &&
                (pendingIndividualScheduledAssignments.length > 0 ||
                  pendingTeamScheduledAssignments.length > 0),
              isOnlyScheduled:
                (pendingIndividualScheduledAssignments.length > 0 ||
                  pendingTeamScheduledAssignments.length > 0) &&
                individualZoneAssignments.length === 0 &&
                teamZoneAssignments.length === 0,
            },
          };
        }

        return {
          ...agent.toObject(),
          status: calculatedStatus, // Use calculated status instead of stored status
          assignmentStatus, // Add assignment status
          teamZoneInfo, // Add team zone information
          allAssignedZones, // Add all individual zone assignments
          teamInfo, // Add team information for all teams user is member of
          teamMemberships, // Enhanced team membership details
          assignmentSummary, // Detailed assignment summary
        };
      })
    );

    // Apply status filter after calculating correct status
    const filteredAgents =
      status && status !== "all"
        ? agentsWithCorrectStatus.filter((agent) => agent.status === status)
        : agentsWithCorrectStatus;

    // Recalculate total count with status filter
    const totalFilter = { ...filter };
    if (status && status !== "all") {
      // For status filtering, we need to check zone assignments (individual and team)
      const allAgents = await User.find(filter).select(
        "primaryZoneId zoneIds teamIds"
      );
      const filteredCount = await Promise.all(
        allAgents.map(async (agent: any) => {
          const calculatedStatus = await calculateAgentStatus(
            (agent._id as any).toString()
          );
          return calculatedStatus === status;
        })
      );
      var total = filteredCount.filter(Boolean).length;
    } else {
      total = await User.countDocuments(filter);
    }

    res.json({
      success: true,
      data: filteredAgents,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Error getting created agents:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get created agents",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get team overview for current admin (Superadmin/Subadmin only)
export const getTeamOverview = async (req: AuthRequest, res: Response) => {
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

    res.json({
      success: true,
      data: {
        totalAgents,
        activeAgents,
        inactiveAgents,
        agentsThisMonth,
        assignedAgents: assignedAgentsCount,
        unassignedAgents: unassignedAgentsCount,
        agentsWithIndividualAssignments,
        agentsWithTeamAssignments,
        totalZones,
      },
    });
  } catch (error) {
    console.error("Error getting team overview:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get team overview",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get recent additions for current admin (Superadmin/Subadmin only)
export const getRecentAdditions = async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 5 } = req.query;
    const currentUserId = req.user?.sub;

    const recentAgents = await User.find({
      role: "AGENT",
      createdBy: currentUserId,
    })
      .select("name email status createdAt primaryZoneId zoneIds")
      .populate("primaryZoneId", "name")
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    // Calculate correct status based on zone assignments
    const agentsWithCorrectStatus = await Promise.all(
      recentAgents.map(async (agent) => {
        // Use the same calculateAgentStatus function that includes scheduled assignments
        const calculatedStatus = await calculateAgentStatus(
          (agent._id as any).toString()
        );

        return {
          _id: agent._id,
          name: agent.name,
          email: agent.email,
          status: calculatedStatus, // Use calculated status instead of stored status
          primaryZoneId: agent.primaryZoneId,
          createdAt: agent.createdAt,
        };
      })
    );

    res.json({
      success: true,
      data: agentsWithCorrectStatus,
    });
  } catch (error) {
    console.error("Error getting recent additions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get recent additions",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Bulk update agent statuses based on zone assignments (for existing agents)
export const bulkUpdateAgentStatuses = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const currentUserId = req.user?.sub;

    // Get all agents created by current admin
    const agents = await User.find({
      role: "AGENT",
      createdBy: currentUserId,
    });

    let updatedCount = 0;
    let inactiveCount = 0;
    let activeCount = 0;

    for (const agent of agents) {
      const hasZoneAssignment = agent.zoneIds && agent.zoneIds.length > 0;
      const hasActiveZoneAssignment =
        agent.primaryZoneId !== null && agent.primaryZoneId !== undefined;

      const shouldBeInactive = !hasZoneAssignment || !hasActiveZoneAssignment;

      if (shouldBeInactive && agent.status === "ACTIVE") {
        await User.findByIdAndUpdate(agent._id, { status: "INACTIVE" });
        inactiveCount++;
        updatedCount++;
      } else if (!shouldBeInactive && agent.status === "INACTIVE") {
        await User.findByIdAndUpdate(agent._id, { status: "ACTIVE" });
        activeCount++;
        updatedCount++;
      }
    }

    res.json({
      success: true,
      message: `Bulk status update completed`,
      data: {
        totalAgents: agents.length,
        updatedCount,
        setToActive: activeCount,
        setToInactive: inactiveCount,
      },
    });
  } catch (error) {
    console.error("Error bulk updating agent statuses:", error);
    res.status(500).json({
      success: false,
      message: "Failed to bulk update agent statuses",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get detailed agent information including password, teams, and zones
export const getDetailedAgent = async (req: AuthRequest, res: Response) => {
  try {
    const { agentId } = req.params;

    if (!agentId) {
      return res.status(400).json({
        success: false,
        message: "Agent ID is required",
      });
    }

    // Get agent with password included
    const agent = await User.findById(agentId).select(
      "+password +originalPassword"
    );
    if (!agent || agent.role !== "AGENT") {
      return res.status(404).json({
        success: false,
        message: "Agent not found",
      });
    }

    // Check if current user has permission to view this agent
    // Only allow if current user created this agent or is a superadmin
    if (
      req.user?.role !== "SUPERADMIN" &&
      agent.createdBy?.toString() !== req.user?.sub
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view this agent",
      });
    }

    // Import ScheduledAssignment model
    const { ScheduledAssignment } = require("../models/ScheduledAssignment");

    // Get all individual zone assignments for this agent
    const individualZoneAssignments = await AgentZoneAssignment.find({
      agentId: agent._id,
      status: { $nin: ["COMPLETED", "CANCELLED"] },
      effectiveTo: null,
    }).populate("zoneId", "name");

    // Get all team zone assignments for this agent's teams
    const teamZoneAssignments = await AgentZoneAssignment.find({
      teamId: { $in: agent.teamIds },
      status: { $nin: ["COMPLETED", "CANCELLED"] },
      effectiveTo: null,
    }).populate("zoneId", "name");

    // Get all PENDING scheduled individual assignments
    const pendingIndividualScheduledAssignments =
      await ScheduledAssignment.find({
        agentId: agent._id,
        status: "PENDING",
      }).populate("zoneId", "name");

    // Get all PENDING scheduled team assignments
    const pendingTeamScheduledAssignments = await ScheduledAssignment.find({
      teamId: { $in: agent.teamIds },
      status: "PENDING",
    }).populate("zoneId", "name");

    // Combine all assignments (active + scheduled)
    const allAssignments = [
      ...individualZoneAssignments,
      ...teamZoneAssignments,
      ...pendingIndividualScheduledAssignments,
      ...pendingTeamScheduledAssignments,
    ];

    // Create a map of zones from all assignment records (both active and scheduled)
    const assignmentZones = allAssignments.map((assignment) => ({
      _id: assignment.zoneId._id,
      name: assignment.zoneId.name,
      isPrimary:
        assignment.zoneId._id.toString() ===
        agent.primaryZoneId?._id?.toString(),
      isScheduled: assignment.status === "PENDING", // Add flag to identify scheduled assignments
    }));

    // Get team information (including teams from assignments)
    const teamIdsFromAssignments = [
      ...teamZoneAssignments.map((a) => a.teamId),
      ...pendingTeamScheduledAssignments.map((a: any) => a.teamId),
    ];

    const allTeamIds = [
      ...new Set([...(agent.teamIds || []), ...teamIdsFromAssignments]),
    ];

    const teams =
      allTeamIds.length > 0
        ? await Team.find({ _id: { $in: allTeamIds } }).select("name")
        : [];

    // Use assignment zones if available, otherwise fall back to User model's zoneIds
    const zones =
      assignmentZones.length > 0
        ? assignmentZones
        : agent.zoneIds && agent.zoneIds.length > 0
        ? await Zone.find({ _id: { $in: agent.zoneIds } }).select("name")
        : [];

    // Get createdBy admin information
    let createdByInfo = null;
    if (agent.createdBy) {
      const adminUser = await User.findById(agent.createdBy).select(
        "name email"
      );
      if (adminUser) {
        createdByInfo = {
          _id: adminUser._id,
          name: adminUser.name,
          email: adminUser.email,
        };
      }
    }

    // Calculate correct status based on zone assignments (including scheduled assignments)
    const calculatedStatus = await calculateAgentStatus(
      (agent._id as any).toString()
    );

    // Get primary team and zone from assignments
    const primaryTeam = teams.length > 0 ? teams[0] : null; // First team as primary
    const primaryZone = zones.length > 0 ? zones[0] : null; // First zone as primary

    const detailedAgent = {
      _id: agent._id,
      name: agent.name,
      email: agent.email,
      username: agent.username,
      contactNumber: agent.contactNumber,
      role: agent.role,
      status: calculatedStatus,
      password: agent.originalPassword || "Password not available", // Return original password for admin view
      primaryTeamId: primaryTeam,
      primaryZoneId: primaryZone,
      teamIds: agent.teamIds,
      zoneIds: agent.zoneIds,
      teams: teams,
      zones: zones,
      createdBy: createdByInfo,
      createdAt: agent.createdAt,
      knockedToday: 0, // This would come from activity tracking
    };

    res.json({
      success: true,
      message: "Agent details retrieved successfully",
      data: detailedAgent,
    });
  } catch (error) {
    console.error("Error getting detailed agent:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get agent details",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Function to refresh assignment statuses for all agents
export const refreshAssignmentStatuses = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const currentUserId = req.user?.sub;
    const {
      updateUserAssignmentStatus,
    } = require("../controllers/assignment.controller");

    // Get all agents created by this admin
    const agents = await User.find({
      role: "AGENT",
      createdBy: currentUserId,
    });

    console.log(
      `🔄 refreshAssignmentStatuses: Processing ${agents.length} agents`
    );

    // Update each agent's assignment status
    const updatePromises = agents.map(async (agent: any) => {
      try {
        await updateUserAssignmentStatus(agent._id.toString());
        return { agentId: agent._id, name: agent.name, success: true };
      } catch (error) {
        console.error(
          `❌ Failed to update assignment status for agent ${agent.name}:`,
          error
        );
        return {
          agentId: agent._id,
          name: agent.name,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });

    const results = await Promise.all(updatePromises);
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    console.log(
      `✅ refreshAssignmentStatuses: Updated ${successful.length} agents, ${failed.length} failed`
    );

    res.json({
      success: true,
      message: "Assignment statuses refreshed successfully",
      data: {
        totalAgents: agents.length,
        successful: successful.length,
        failed: failed.length,
        results,
      },
    });
  } catch (error) {
    console.error("❌ Error refreshing assignment statuses:", error);
    res.status(500).json({
      success: false,
      message: "Failed to refresh assignment statuses",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Function to refresh all agent and team statuses based on zone assignments
export const refreshAllStatuses = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.sub;

    // Get all agents created by this admin
    const agents = await User.find({
      role: "AGENT",
      createdBy: currentUserId,
    });

    // Update each agent's status
    const agentUpdates = agents.map(async (agent: any) => {
      const calculatedStatus = await calculateAgentStatus(
        (agent._id as any).toString()
      );
      if (calculatedStatus !== agent.status) {
        await User.findByIdAndUpdate(agent._id, { status: calculatedStatus });
        return {
          agentId: agent._id,
          name: agent.name,
          oldStatus: agent.status,
          newStatus: calculatedStatus,
        };
      }
      return null;
    });

    const agentResults = await Promise.all(agentUpdates);
    const updatedAgents = agentResults.filter((result) => result !== null);

    // Get all teams created by this admin (filter out teams with no members)
    const allTeams = await Team.find({ createdBy: currentUserId }).populate(
      "agentIds"
    );
    const teams = allTeams.filter(
      (team) => team.agentIds && team.agentIds.length > 0
    );

    // Update each team's status
    const teamUpdates = teams.map(async (team: any) => {
      const calculatedStatus = await calculateTeamStatus(team._id.toString());
      if (calculatedStatus !== team.status) {
        await Team.findByIdAndUpdate(team._id, { status: calculatedStatus });
        return {
          teamId: team._id,
          name: team.name,
          oldStatus: team.status,
          newStatus: calculatedStatus,
        };
      }
      return null;
    });

    const teamResults = await Promise.all(teamUpdates);
    const updatedTeams = teamResults.filter((result) => result !== null);

    res.json({
      success: true,
      message: "All statuses refreshed successfully",
      data: {
        updatedAgents,
        updatedTeams,
        summary: {
          agentsUpdated: updatedAgents.length,
          teamsUpdated: updatedTeams.length,
        },
      },
    });
  } catch (error) {
    console.error("Error refreshing statuses:", error);
    res.status(500).json({
      success: false,
      message: "Failed to refresh statuses",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
