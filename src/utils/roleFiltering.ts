import { User } from "../models/User";

/**
 * Standardized role-based filtering utility for admin dashboard endpoints
 * Ensures consistent data access across all controllers
 */

export interface RoleFilterOptions {
  userId: string;
  userRole: string;
  primaryTeamId?: string;
}

export interface FilterResult {
  zoneFilter: any;
  assignmentFilter: any;
  activityFilter: any;
  teamFilter: any;
}

/**
 * Get standardized filters based on user role
 * @param options - User information and role
 * @returns Standardized filters for different data types
 */
export async function getRoleBasedFilters(
  options: RoleFilterOptions
): Promise<FilterResult> {
  const { userId, userRole, primaryTeamId } = options;

  // For SUPERADMIN, no filtering needed
  if (userRole === "SUPERADMIN") {
    return {
      zoneFilter: {},
      assignmentFilter: {},
      activityFilter: {},
      teamFilter: {},
    };
  }

  // For SUBADMIN, filter by their team and created resources
  const user = await User.findById(userId);
  const userPrimaryTeamId = primaryTeamId || user?.primaryTeamId;

  if (userPrimaryTeamId) {
    // User has a primary team - include both team and individual resources
    return {
      zoneFilter: {
        $or: [{ teamId: userPrimaryTeamId }, { createdBy: userId }],
      },
      assignmentFilter: {
        $or: [{ teamId: userPrimaryTeamId }, { assignedBy: userId }],
      },
      activityFilter: {
        teamId: userPrimaryTeamId,
      },
      teamFilter: {
        createdBy: userId,
      },
    };
  } else {
    // User has no primary team - only show resources they created
    return {
      zoneFilter: {
        createdBy: userId,
      },
      assignmentFilter: {
        assignedBy: userId,
      },
      activityFilter: {
        agentId: { $in: await getAdminAgentIds(userId) },
      },
      teamFilter: {
        createdBy: userId,
      },
    };
  }
}

/**
 * Get agent IDs created by a specific admin
 * @param adminId - Admin user ID
 * @returns Array of agent IDs
 */
async function getAdminAgentIds(adminId: string): Promise<string[]> {
  const agents = await User.find({
    createdBy: adminId,
    role: "AGENT",
  }).select("_id");

  return agents.map((agent: any) => agent._id.toString());
}

/**
 * Get zone IDs accessible to a user based on their role
 * @param options - User information and role
 * @returns Array of zone IDs
 */
export async function getAccessibleZoneIds(
  options: RoleFilterOptions
): Promise<string[]> {
  const { zoneFilter } = await getRoleBasedFilters(options);

  const { Zone } = require("../models/Zone");
  const zones = await Zone.find(zoneFilter).select("_id");

  return zones.map((zone: any) => zone._id.toString());
}

/**
 * Get team IDs accessible to a user based on their role
 * @param options - User information and role
 * @returns Array of team IDs
 */
export async function getAccessibleTeamIds(
  options: RoleFilterOptions
): Promise<string[]> {
  const { teamFilter } = await getRoleBasedFilters(options);

  const { Team } = require("../models/Team");
  const teams = await Team.find(teamFilter).select("_id");

  return teams.map((team: any) => team._id.toString());
}
