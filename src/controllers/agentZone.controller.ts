import { Response } from "express";
import { Zone } from "../models/Zone";
import { User } from "../models/User";
import { Resident } from "../models/Resident";
import { Community } from "../models/Community";
import { Area } from "../models/Area";
import { Municipality } from "../models/Municipality";
import { AgentZoneAssignment } from "../models/AgentZoneAssignment";
import { ScheduledAssignment } from "../models/ScheduledAssignment";
import { AuthRequest } from "../middleware/auth";
import {
  processBuildingData,
  extractHouseNumber,
  getHouseNumberStats,
} from "../utils/addressParser";
import {
  checkDuplicateBuildings,
  checkZoneOverlap,
  validateZoneBoundary,
} from "../utils/zoneOverlapChecker";
import { updateUserAssignmentStatus } from "./assignment.controller";
import {
  detectBuildingsWithinPolygon,
  type PolygonPoint,
} from "../utils/buildingDetection";

const normalizePolygonInput = (input: any): PolygonPoint[] => {
  if (!Array.isArray(input)) {
    return [];
  }

  const normalized: PolygonPoint[] = [];

  input.forEach((point) => {
    let latitude: number | undefined;
    let longitude: number | undefined;

    if (Array.isArray(point) && point.length >= 2) {
      // Assume GeoJSON order [lng, lat]
      longitude = Number(point[0]);
      latitude = Number(point[1]);
    } else if (point && typeof point === "object") {
      latitude =
        typeof point.latitude === "number"
          ? point.latitude
          : typeof point.lat === "number"
          ? point.lat
          : Array.isArray(point.coordinates) && point.coordinates.length >= 2
          ? Number(point.coordinates[1])
          : undefined;

      longitude =
        typeof point.longitude === "number"
          ? point.longitude
          : typeof point.lng === "number"
          ? point.lng
          : Array.isArray(point.coordinates) && point.coordinates.length >= 2
          ? Number(point.coordinates[0])
          : undefined;
    }

    if (
      typeof latitude === "number" &&
      Number.isFinite(latitude) &&
      typeof longitude === "number" &&
      Number.isFinite(longitude)
    ) {
      normalized.push({ latitude, longitude });
    }
  });

  return normalized;
};

export const detectAgentZoneBuildings = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    console.log("🎯 detectAgentZoneBuildings: incoming request");
    console.log("🎯 detectAgentZoneBuildings: user id", req.user?.id);

    if (req.user?.role !== "AGENT") {
      console.warn(
        "⛔ detectAgentZoneBuildings: unauthorized role",
        req.user?.role
      );
      return res.status(403).json({
        success: false,
        message: "This endpoint is only available for AGENT users",
      });
    }

    const { polygon, boundary } = req.body || {};
    console.log("🎯 detectAgentZoneBuildings: body received", {
      hasPolygon: Array.isArray(polygon),
      hasBoundaryCoordinates: Boolean(boundary?.coordinates),
    });

    let source: any = polygon;
    if (!Array.isArray(source) && boundary?.coordinates) {
      if (
        Array.isArray(boundary.coordinates[0]) &&
        Array.isArray(boundary.coordinates[0][0])
      ) {
        source = boundary.coordinates[0];
      }
    }

    const normalizedPolygon = normalizePolygonInput(source);
    console.log(
      "🎯 detectAgentZoneBuildings: normalized polygon length",
      normalizedPolygon.length
    );

    if (normalizedPolygon.length < 3) {
      console.warn(
        "⚠️ detectAgentZoneBuildings: insufficient polygon points",
        normalizedPolygon.length
      );
      return res.status(400).json({
        success: false,
        message:
          "A polygon with at least three coordinates is required to detect buildings.",
      });
    }

    const detection = await detectBuildingsWithinPolygon(normalizedPolygon);
    console.log("✅ detectAgentZoneBuildings: detection completed", {
      buildingCount: detection.buildings.length,
      warningCount: detection.warnings.length,
    });

    return res.status(200).json({
      success: true,
      data: detection,
    });
  } catch (error) {
    console.error(
      "🎯 detectAgentZoneBuildings: Error detecting buildings:",
      error
    );
    return res.status(500).json({
      success: false,
      message: "Failed to detect buildings for the provided polygon.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Create a new zone and auto-assign it to the creating agent
 * This endpoint is specifically for AGENT role users
 */
export const createAgentZone = async (req: AuthRequest, res: Response) => {
  try {
    console.log("🎯 createAgentZone: Starting agent zone creation...");

    // Verify the user is an AGENT
    if (req.user?.role !== "AGENT") {
      return res.status(403).json({
        success: false,
        message: "This endpoint is only available for AGENT users",
      });
    }

    const agentId = req.user.id;
    console.log(`🎯 createAgentZone: Creating zone for agent ${agentId}`);

    const {
      name,
      description,
      boundary,
      buildingData,
      communityId,
      areaId,
      municipalityId,
    } = req.body;

    // Validate required fields
    if (!name || !boundary) {
      return res.status(400).json({
        success: false,
        message: "Zone name and boundary are required",
      });
    }

    // Check if zone name already exists
    const existingZone = await Zone.findOne({ name });
    if (existingZone) {
      return res.status(409).json({
        success: false,
        message: "Zone with this name already exists",
      });
    }

    // Check for overlapping zones
    const overlapResult = await checkZoneOverlap(boundary, undefined, req.user);
    if (overlapResult.hasOverlap) {
      const overlappingZoneNames = overlapResult.overlappingZones
        .map((zone) => zone.name)
        .join(", ");
      return res.status(409).json({
        success: false,
        message: `This territory overlaps with existing zone(s): ${overlappingZoneNames}`,
        data: {
          overlappingZones: overlapResult.overlappingZones,
          overlapPercentage: overlapResult.overlapPercentage,
        },
      });
    }

    // Check if any user has already created a zone with this exact boundary
    const existingZoneWithSameBoundary = await Zone.findOne({
      boundary: boundary,
    });
    if (existingZoneWithSameBoundary) {
      return res.status(409).json({
        success: false,
        message: `A zone with this exact boundary already exists: ${existingZoneWithSameBoundary.name}`,
        data: {
          duplicateZone: {
            id: existingZoneWithSameBoundary._id,
            name: existingZoneWithSameBoundary.name,
            createdBy: existingZoneWithSameBoundary.createdBy,
          },
        },
      });
    }

    // Validate and process location hierarchy if provided
    let validatedAreaId = areaId;
    let validatedMunicipalityId = municipalityId;
    let validatedCommunityId = communityId;

    if (communityId) {
      console.log("🎯 createAgentZone: Validating location hierarchy...");

      // Validate community
      const community = await Community.findById(communityId);
      if (!community) {
        return res.status(404).json({
          success: false,
          message: "Community not found",
        });
      }

      // Validate municipality
      const municipality = await Municipality.findById(
        community.municipalityId
      );
      if (!municipality) {
        return res.status(404).json({
          success: false,
          message: "Municipality not found for the selected community",
        });
      }

      // Validate area
      const area = await Area.findById(community.areaId);
      if (!area) {
        return res.status(404).json({
          success: false,
          message: "Area not found for the selected community",
        });
      }

      // Set validated IDs
      validatedAreaId = community.areaId;
      validatedMunicipalityId = community.municipalityId;
      validatedCommunityId = communityId;

      console.log("🎯 createAgentZone: Location hierarchy validated:", {
        area: area.name,
        municipality: municipality.name,
        community: community.name,
      });
    }

    // Process building data if provided
    let processedBuildingData = undefined;
    if (buildingData && buildingData.addresses && buildingData.coordinates) {
      processedBuildingData = processBuildingData(
        buildingData.addresses,
        buildingData.coordinates
      );

      // Check for duplicate buildings across all zones
      console.log("🎯 createAgentZone: Checking for duplicate buildings...");
      console.log(
        "🎯 createAgentZone: Addresses to check:",
        processedBuildingData.addresses
      );
      const duplicateAddresses = await checkDuplicateBuildings(
        processedBuildingData.addresses
      );
      console.log(
        "🎯 createAgentZone: Duplicate addresses found:",
        duplicateAddresses
      );

      if (duplicateAddresses.length > 0) {
        return res.status(409).json({
          success: false,
          message: `${duplicateAddresses.length} buildings are already assigned to other territories`,
          data: {
            duplicateAddresses,
            duplicateCount: duplicateAddresses.length,
          },
        });
      }
    }

    // Create the zone with auto-assignment to the creating agent
    const zone = new Zone({
      name,
      description,
      boundary,
      assignedAgentId: agentId, // Auto-assign to the creating agent
      teamId: null, // Agents cannot assign to teams
      buildingData: processedBuildingData,
      status: "ACTIVE", // Immediately active since it's assigned
      zoneType: "MAP",
      createdBy: agentId,
      areaId: validatedAreaId,
      municipalityId: validatedMunicipalityId,
      communityId: validatedCommunityId,
    });

    await zone.save();
    console.log(`🎯 createAgentZone: Zone created with ID: ${zone._id}`);

    // Create residents if building data is provided
    if (processedBuildingData && processedBuildingData.addresses.length > 0) {
      console.log("🏠 Creating residents for agent zone...");
      console.log(
        `📊 Total addresses to process: ${processedBuildingData.addresses.length}`
      );

      const residents = processedBuildingData.addresses.map(
        (address, index) => {
          const coordinates = processedBuildingData.coordinates[index];
          const houseNumber = extractHouseNumber(address);

          return new Resident({
            zoneId: zone._id,
            address,
            coordinates,
            houseNumber,
            status: "not-visited",
            dataSource: "AUTO",
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      );

      await Resident.insertMany(residents);
      console.log(
        `✅ Created ${residents.length} residents for agent zone: ${zone._id}`
      );
    } else {
      console.log("⚠️ No residents to create for agent zone:", zone._id);
    }

    // Update community with the new zone if location hierarchy is provided
    if (validatedCommunityId) {
      await Community.findByIdAndUpdate(validatedCommunityId, {
        $addToSet: { zoneIds: zone._id },
      });
      console.log(
        "🎯 createAgentZone: Updated community with new zone ID:",
        zone._id
      );
    }

    // Create agent zone assignment record
    const agentAssignment = new AgentZoneAssignment({
      agentId: agentId,
      zoneId: zone._id,
      effectiveFrom: new Date(),
      status: "ACTIVE",
      assignedBy: agentId, // Self-assigned
    });

    await agentAssignment.save();
    console.log(
      `🎯 createAgentZone: Agent assignment created: ${agentAssignment._id}`
    );

    // Update agent's zoneIds array
    await User.findByIdAndUpdate(agentId, {
      $addToSet: { zoneIds: zone._id },
    });
    console.log(`🎯 createAgentZone: Updated agent ${agentId} with new zone`);

    // Update agent assignment status
    if (agentId) {
      await updateUserAssignmentStatus(agentId);
    }
    console.log(`🎯 createAgentZone: Updated agent assignment status`);

    // Populate the response with zone details
    const populatedZone = await Zone.findById(zone._id)
      .populate([
        { path: "assignedAgentId", select: "name email" },
        { path: "areaId", select: "name type" },
        { path: "municipalityId", select: "name type" },
        { path: "communityId", select: "name type" },
      ])
      .select("-__v");

    // Get house number statistics for response
    let houseNumberStats = null;
    if (processedBuildingData) {
      houseNumberStats = getHouseNumberStats(
        processedBuildingData.houseNumbers
      );
    }

    // Create activity record for zone creation
    try {
      const Activity = require("../models/Activity").default;
      await Activity.create({
        agentId: agentId,
        activityType: "ZONE_OPERATION",
        zoneId: zone._id,
        operationType: "CREATE",
        startedAt: new Date(), // Set startedAt so it counts in "Activities Today"
        notes: `Zone "${name}" created`,
      });
      console.log("🎯 createAgentZone: Activity created for zone creation");
    } catch (activityError) {
      console.error(
        "🎯 createAgentZone: Error creating zone creation activity:",
        activityError
      );
      // Don't fail zone creation if activity creation fails
    }

    console.log("🎯 createAgentZone: Zone creation completed successfully");

    res.status(201).json({
      success: true,
      message: "Zone created and assigned to you successfully",
      data: {
        ...(populatedZone?.toObject() || {}),
        houseNumberStats,
      },
    });
  } catch (error) {
    console.error("🎯 createAgentZone: Error creating agent zone:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create zone",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Create a manual zone for mobile (no boundary required)
 * This endpoint is specifically for AGENT role users creating manual zones
 * Manual zones don't have boundaries and properties are added individually
 */
export const createMobileManualZone = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    console.log("📱 createMobileManualZone: Starting manual zone creation...");

    // Verify the user is an AGENT
    if (req.user?.role !== "AGENT") {
      return res.status(403).json({
        success: false,
        message: "This endpoint is only available for AGENT users",
      });
    }

    const agentId = req.user.id;
    console.log(
      `📱 createMobileManualZone: Creating manual zone for agent ${agentId}`
    );

    const { name, description, areaId, municipalityId, communityId } = req.body;

    // Validate required fields (no boundary required for manual zones)
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Zone name is required",
      });
    }

    // Validate location hierarchy if provided
    if (communityId || municipalityId || areaId) {
      if (!communityId || !municipalityId || !areaId) {
        return res.status(400).json({
          success: false,
          message:
            "All location hierarchy fields (areaId, municipalityId, communityId) must be provided together",
        });
      }

      // Validate community
      const community = await Community.findById(communityId);
      if (!community) {
        return res.status(404).json({
          success: false,
          message: "Community not found",
        });
      }

      // Validate municipality
      const municipality = await Municipality.findById(
        community.municipalityId
      );
      if (!municipality) {
        return res.status(404).json({
          success: false,
          message: "Municipality not found for the selected community",
        });
      }

      // Validate area
      const area = await Area.findById(community.areaId);
      if (!area) {
        return res.status(404).json({
          success: false,
          message: "Area not found for the selected community",
        });
      }

      // Ensure IDs match the hierarchy
      if (
        areaId !== community.areaId.toString() ||
        municipalityId !== community.municipalityId.toString()
      ) {
        return res.status(400).json({
          success: false,
          message: "Location hierarchy IDs do not match",
        });
      }

      console.log("📱 createMobileManualZone: Location hierarchy validated:", {
        area: area.name,
        municipality: municipality.name,
        community: community.name,
      });
    }

    // Check if zone name already exists
    const existingZone = await Zone.findOne({ name });
    if (existingZone) {
      return res.status(409).json({
        success: false,
        message: "Zone with this name already exists",
      });
    }

    // Create the manual zone (no boundary, no overlap check)
    const zoneData: any = {
      name,
      description: description || undefined,
      assignedAgentId: agentId,
      teamId: null,
      status: "ACTIVE",
      zoneType: "MANUAL", // Set as manual zone
      createdBy: agentId,
    };

    // Only include location hierarchy if provided
    if (areaId) zoneData.areaId = areaId;
    if (municipalityId) zoneData.municipalityId = municipalityId;
    if (communityId) zoneData.communityId = communityId;

    const zone = new Zone(zoneData);

    console.log(
      "📱 createMobileManualZone: Zone data before save:",
      JSON.stringify(zoneData, null, 2)
    );
    await zone.save();
    console.log(
      `📱 createMobileManualZone: Manual zone created with ID: ${zone._id}`
    );
    console.log(
      "📱 createMobileManualZone: Saved zone zoneType:",
      zone.zoneType
    );
    console.log(
      "📱 createMobileManualZone: Saved zone full data:",
      JSON.stringify(zone.toObject(), null, 2)
    );

    // Update community with the new zone if location hierarchy is provided
    if (communityId) {
      await Community.findByIdAndUpdate(communityId, {
        $addToSet: { zoneIds: zone._id },
      });
      console.log(
        "📱 createMobileManualZone: Updated community with new zone ID:",
        zone._id
      );
    }

    // Create agent zone assignment record
    const agentAssignment = new AgentZoneAssignment({
      agentId: agentId,
      zoneId: zone._id,
      effectiveFrom: new Date(),
      status: "ACTIVE",
      assignedBy: agentId, // Self-assigned
    });

    console.log(
      "📱 createMobileManualZone: Agent assignment data before save:",
      JSON.stringify({
        agentId: agentAssignment.agentId,
        zoneId: agentAssignment.zoneId,
        status: agentAssignment.status,
        effectiveFrom: agentAssignment.effectiveFrom,
      }, null, 2)
    );

    await agentAssignment.save();
    console.log(
      `📱 createMobileManualZone: Agent assignment created: ${agentAssignment._id}`
    );
    console.log(
      "📱 createMobileManualZone: Agent assignment after save:",
      JSON.stringify(agentAssignment.toObject(), null, 2)
    );

    // Update agent's zoneIds array
    await User.findByIdAndUpdate(agentId, {
      $addToSet: { zoneIds: zone._id },
    });
    console.log(
      `📱 createMobileManualZone: Updated agent ${agentId} with new zone`
    );

    // Update agent assignment status
    if (agentId) {
      await updateUserAssignmentStatus(agentId);
    }
    console.log(`📱 createMobileManualZone: Updated agent assignment status`);

    // Populate the response with zone details
    const populatedZone = await Zone.findById(zone._id)
      .populate([
        { path: "assignedAgentId", select: "name email" },
        { path: "areaId", select: "name type" },
        { path: "municipalityId", select: "name type" },
        { path: "communityId", select: "name type" },
      ])
      .lean();

    console.log(
      "📱 createMobileManualZone: Populated zone zoneType:",
      populatedZone?.zoneType
    );
    console.log(
      "📱 createMobileManualZone: Populated zone data:",
      JSON.stringify(populatedZone, null, 2)
    );

    // Create activity record for zone creation
    try {
      const Activity = require("../models/Activity").default;
      await Activity.create({
        agentId: agentId,
        activityType: "ZONE_OPERATION",
        zoneId: zone._id,
        operationType: "CREATE",
        startedAt: new Date(),
        notes: `Manual zone "${name}" created`,
      });
      console.log(
        "📱 createMobileManualZone: Activity created for zone creation"
      );
    } catch (activityError) {
      console.error(
        "📱 createMobileManualZone: Error creating zone creation activity:",
        activityError
      );
      // Don't fail zone creation if activity creation fails
    }

    console.log(
      "📱 createMobileManualZone: Manual zone creation completed successfully"
    );

    res.status(201).json({
      success: true,
      message: "Manual zone created successfully",
      data: populatedZone || zone.toObject(),
    });
  } catch (error) {
    console.error(
      "📱 createMobileManualZone: Error creating manual zone:",
      error
    );
    res.status(500).json({
      success: false,
      message: "Failed to create manual zone",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Update an agent's own zone
 * Agents can only update zones they created
 */
export const updateAgentZone = async (req: AuthRequest, res: Response) => {
  try {
    console.log("🎯 updateAgentZone: Starting agent zone update...");

    // Verify the user is an AGENT
    if (req.user?.role !== "AGENT") {
      return res.status(403).json({
        success: false,
        message: "This endpoint is only available for AGENT users",
      });
    }

    const agentId = req.user.id;
    const { id } = req.params;
    const {
      name,
      description,
      boundary,
      buildingData,
      communityId,
      status,
      assignedAgentId,
      teamId,
      effectiveFrom,
      removeAssignment,
      isBoundaryUpdateOnly,
      isNameDescriptionUpdateOnly,
      isDateOnlyChange,
    } = req.body;

    console.log("🎯 updateAgentZone: Request body received:");
    console.log("  - name:", name);
    console.log("  - description:", description);
    console.log("  - boundary:", boundary ? "provided" : "not provided");
    console.log(
      "  - buildingData:",
      buildingData ? "provided" : "not provided"
    );
    console.log("  - communityId:", communityId);
    console.log("  - status:", status);
    console.log("  - assignedAgentId:", assignedAgentId);
    console.log("  - teamId:", teamId);
    console.log("  - effectiveFrom:", effectiveFrom);
    console.log("  - removeAssignment:", removeAssignment);
    console.log("  - isBoundaryUpdateOnly:", isBoundaryUpdateOnly);
    console.log(
      "  - isNameDescriptionUpdateOnly:",
      isNameDescriptionUpdateOnly
    );
    console.log("  - isDateOnlyChange:", isDateOnlyChange);

    console.log(`🎯 updateAgentZone: Agent ${agentId} updating zone ${id}`);

    // Find the zone and verify ownership
    const zone = await Zone.findById(id);
    if (!zone) {
      return res.status(404).json({
        success: false,
        message: "Zone not found",
      });
    }

    // Verify the agent owns this zone
    if (zone.createdBy?.toString() !== agentId) {
      return res.status(403).json({
        success: false,
        message: "You can only update zones you created",
      });
    }

    // Check if zone name already exists (excluding current zone)
    if (name && name !== zone.name) {
      const existingZone = await Zone.findOne({
        name,
        _id: { $ne: id },
      });
      if (existingZone) {
        return res.status(409).json({
          success: false,
          message: "Zone with this name already exists",
        });
      }
    }

    // Check for overlapping zones (excluding current zone)
    if (boundary) {
      const overlapResult = await checkZoneOverlap(boundary, id, req.user);
      if (overlapResult.hasOverlap) {
        const overlappingZoneNames = overlapResult.overlappingZones
          .map((zone) => zone.name)
          .join(", ");
        return res.status(409).json({
          success: false,
          message: `This territory overlaps with existing zone(s): ${overlappingZoneNames}`,
          data: {
            overlappingZones: overlapResult.overlappingZones,
            overlapPercentage: overlapResult.overlapPercentage,
          },
        });
      }
    }

    // Process building data if provided
    let processedBuildingData = zone.buildingData;
    if (buildingData && buildingData.addresses && buildingData.coordinates) {
      processedBuildingData = processBuildingData(
        buildingData.addresses,
        buildingData.coordinates
      );

      // Check for duplicate buildings (excluding current zone)
      const duplicateAddresses = await checkDuplicateBuildings(
        processedBuildingData?.addresses || []
      );
      const filteredDuplicates = duplicateAddresses.filter((addr) => {
        return !zone.buildingData?.addresses?.includes(addr);
      });

      if (filteredDuplicates.length > 0) {
        return res.status(409).json({
          success: false,
          message: `${filteredDuplicates.length} buildings are already assigned to other territories`,
          data: {
            duplicateAddresses: filteredDuplicates,
            duplicateCount: filteredDuplicates.length,
          },
        });
      }
    }

    // Check for boundary overlap if boundary is being updated
    if (boundary) {
      // Validate boundary format
      if (!validateZoneBoundary(boundary)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid zone boundary format. Please ensure the polygon is properly closed.",
        });
      }

      // Check for zone overlap
      const overlapResult = await checkZoneOverlap(boundary, id, req.user);
      if (overlapResult.hasOverlap) {
        const overlappingZoneNames = overlapResult.overlappingZones
          .map((zone) => zone.name)
          .join(", ");
        return res.status(409).json({
          success: false,
          message: `This territory overlaps with existing zone(s): ${overlappingZoneNames}`,
          data: {
            overlappingZones: overlapResult.overlappingZones,
            overlapPercentage: overlapResult.overlapPercentage,
          },
        });
      }
    }

    // Update zone
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (boundary !== undefined) updateData.boundary = boundary;
    if (processedBuildingData) {
      updateData.buildingData = processedBuildingData;

      // Delete existing residents for this zone and create new ones
      await Resident.deleteMany({ zoneId: id });
      console.log("🗑️ Deleted existing residents for zone:", id);

      // Create new residents if building data is provided
      if (processedBuildingData.addresses.length > 0) {
        console.log("🏠 Creating residents with house number extraction...");
        console.log(
          `📊 Total addresses to process: ${processedBuildingData.addresses.length}`
        );

        const residents = processedBuildingData.addresses.map(
          (address, index) => {
            const coordinates = processedBuildingData.coordinates[index];
            const houseNumber = extractHouseNumber(address);

            return new Resident({
              zoneId: id,
              address,
              coordinates,
              houseNumber,
              status: "not-visited",
              dataSource: "AUTO",
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        );

        await Resident.insertMany(residents);
        console.log(
          `✅ Created ${residents.length} residents for agent zone: ${id}`
        );
      } else {
        console.log("⚠️ No residents to create for agent zone:", id);
      }
    }

    // Handle assignment updates (same logic as admin controller)
    console.log("🎯 updateAgentZone: Checking assignment logic...");
    console.log("  - isDateOnlyChange:", isDateOnlyChange);
    console.log("  - removeAssignment:", removeAssignment);
    console.log("  - assignedAgentId:", assignedAgentId);

    // If this is only a boundary update, skip all assignment processing
    if (isBoundaryUpdateOnly) {
      console.log(
        "🎯 BOUNDARY UPDATE ONLY: Skipping assignment processing to preserve current status"
      );
      console.log(`📋 Preserving current status: ${zone.status}`);
      console.log(
        `📋 Preserving current assignment: ${zone.assignedAgentId || "None"}`
      );
      console.log(`📋 Preserving current team: ${zone.teamId || "None"}`);

      // Keep current assignment and status
      updateData.assignedAgentId = zone.assignedAgentId;
      updateData.teamId = zone.teamId;
      updateData.status = zone.status;

      console.log("✅ Boundary update only - assignment processing skipped");
    } else if (isNameDescriptionUpdateOnly) {
      console.log(
        "🎯 NAME/DESCRIPTION UPDATE ONLY: Skipping assignment processing to preserve current status"
      );
      console.log(`📋 Preserving current status: ${zone.status}`);
      console.log(
        `📋 Preserving current assignment: ${zone.assignedAgentId || "None"}`
      );
      console.log(`📋 Preserving current team: ${zone.teamId || "None"}`);

      // Keep current assignment and status
      updateData.assignedAgentId = zone.assignedAgentId;
      updateData.teamId = zone.teamId;
      updateData.status = zone.status;

      console.log(
        "✅ Name/description update only - assignment processing skipped"
      );
    } else if (isDateOnlyChange) {
      // DATE-ONLY CHANGE: Only the effective date is being changed
      console.log(
        "🎯 DATE-ONLY CHANGE: Preserving assignments and updating effective date only"
      );
      console.log(
        `📋 Current assigned agent: ${zone.assignedAgentId || "None"}`
      );
      console.log(`📋 New effective date: ${effectiveFrom}`);

      const effectiveDate = new Date(effectiveFrom);
      const now = new Date();
      const isFutureDate = effectiveDate > now;
      const isPastDate = effectiveDate < now;

      console.log(`📋 Effective Date: ${effectiveDate}`);
      console.log(`📋 Current Time: ${now}`);
      console.log(`📋 Is Future Date: ${isFutureDate}`);
      console.log(`📋 Is Past Date: ${isPastDate}`);

      // Validate that assignment date is not in the past
      if (isPastDate) {
        return res.status(400).json({
          success: false,
          message:
            "Assignment date cannot be in the past. Please select today's date or a future date.",
        });
      }

      // Preserve current assignments
      updateData.assignedAgentId = zone.assignedAgentId;
      updateData.teamId = zone.teamId;

      if (zone.assignedAgentId) {
        // Individual assignment - update the effective date
        console.log("🔄 Updating individual assignment effective date...");

        if (isFutureDate) {
          // Future date - create scheduled assignment
          console.log("📅 Creating scheduled assignment for future date...");

          // Cancel existing scheduled assignments
          await ScheduledAssignment.updateMany(
            { zoneId: id, agentId: zone.assignedAgentId, status: "PENDING" },
            { status: "CANCELLED" }
          );

          // Create new scheduled assignment
          const scheduledAssignmentData = {
            agentId: zone.assignedAgentId,
            zoneId: id,
            assignedBy: req.user?.id,
            scheduledDate: effectiveDate,
            effectiveFrom: effectiveDate,
            status: "PENDING" as const,
          };

          await ScheduledAssignment.create(scheduledAssignmentData);
          updateData.status = "SCHEDULED";
          console.log("✅ Created scheduled assignment for future date");
        } else {
          // Current/past date - update active assignment
          console.log("🎯 Updating active assignment effective date...");

          // Cancel any pending scheduled assignments
          await ScheduledAssignment.updateMany(
            { zoneId: id, agentId: zone.assignedAgentId, status: "PENDING" },
            { status: "CANCELLED" }
          );

          // Update existing active assignment
          await AgentZoneAssignment.updateMany(
            { zoneId: id, agentId: zone.assignedAgentId, status: "ACTIVE" },
            { effectiveFrom: effectiveDate }
          );

          updateData.status = "ACTIVE";
          console.log("✅ Updated active assignment effective date");
        }
      }
    } else if (removeAssignment) {
      // Remove assignment
      console.log("🔄 Removing assignment...");

      // Cancel any scheduled assignments
      await ScheduledAssignment.updateMany(
        { zoneId: id, status: "PENDING" },
        { status: "CANCELLED" }
      );

      // Remove active assignments
      await AgentZoneAssignment.updateMany(
        { zoneId: id, status: "ACTIVE" },
        { status: "INACTIVE" }
      );

      updateData.assignedAgentId = null;
      updateData.teamId = null;
      updateData.status = "DRAFT";
      console.log("✅ Assignment removed");
    } else if (assignedAgentId) {
      // Assign to agent (self-assignment for agents)
      console.log(`🔄 Assigning zone to agent: ${assignedAgentId}`);

      const effectiveDate = effectiveFrom
        ? new Date(effectiveFrom)
        : new Date();
      const now = new Date();
      const isFutureDate = effectiveDate > now;
      const isPastDate = effectiveDate < now;

      // Validate that assignment date is not in the past
      if (isPastDate) {
        return res.status(400).json({
          success: false,
          message:
            "Assignment date cannot be in the past. Please select today's date or a future date.",
        });
      }

      if (isFutureDate) {
        // Future assignment
        console.log("📅 Creating scheduled assignment for future date...");

        // Cancel existing scheduled assignments
        await ScheduledAssignment.updateMany(
          { zoneId: id, status: "PENDING" },
          { status: "CANCELLED" }
        );

        // Create new scheduled assignment
        const scheduledAssignmentData = {
          agentId: assignedAgentId,
          zoneId: id,
          assignedBy: req.user?.id,
          scheduledDate: effectiveDate,
          effectiveFrom: effectiveDate,
          status: "PENDING" as const,
        };

        await ScheduledAssignment.create(scheduledAssignmentData);
        updateData.assignedAgentId = assignedAgentId;
        updateData.status = "SCHEDULED";
        console.log("✅ Created scheduled assignment for future date");
      } else {
        // Immediate assignment
        console.log("🎯 Creating immediate assignment...");

        // Cancel any pending scheduled assignments
        await ScheduledAssignment.updateMany(
          { zoneId: id, status: "PENDING" },
          { status: "CANCELLED" }
        );

        // Remove existing assignments
        await AgentZoneAssignment.updateMany(
          { zoneId: id, status: "ACTIVE" },
          { status: "INACTIVE" }
        );

        // Create new assignment
        const assignmentData = {
          agentId: assignedAgentId,
          zoneId: id,
          effectiveFrom: effectiveDate,
          status: "ACTIVE",
          assignedBy: req.user?.id,
        };

        await AgentZoneAssignment.create(assignmentData);
        updateData.assignedAgentId = assignedAgentId;
        updateData.status = "ACTIVE";
        console.log("✅ Created immediate assignment");
      }
    }

    console.log("🎯 updateAgentZone: Final updateData to be applied:");
    console.log(JSON.stringify(updateData, null, 2));

    const updatedZone = await Zone.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate([
      { path: "assignedAgentId", select: "name email" },
      { path: "areaId", select: "name type" },
      { path: "municipalityId", select: "name type" },
      { path: "communityId", select: "name type" },
    ]);

    console.log("🎯 updateAgentZone: Zone updated successfully");

    // Create activity record for zone update
    try {
      const Activity = require("../models/Activity").default;
      const changes: string[] = [];
      if (name && name !== zone.name)
        changes.push(`name: "${zone.name}" → "${name}"`);
      if (description !== undefined && description !== zone.description)
        changes.push("description updated");
      if (boundary) changes.push("boundary updated");
      if (buildingData) changes.push("building data updated");
      if (status && status !== zone.status)
        changes.push(`status: "${zone.status}" → "${status}"`);

      await Activity.create({
        agentId: agentId,
        activityType: "ZONE_OPERATION",
        zoneId: id,
        operationType: "UPDATE",
        startedAt: new Date(), // Set startedAt so it counts in "Activities Today"
        notes:
          changes.length > 0
            ? `Zone updated: ${changes.join(", ")}`
            : "Zone updated",
      });
      console.log("🎯 updateAgentZone: Activity created for zone update");
    } catch (activityError) {
      console.error(
        "🎯 updateAgentZone: Error creating zone update activity:",
        activityError
      );
      // Don't fail zone update if activity creation fails
    }

    res.json({
      success: true,
      message: "Zone updated successfully",
      data: updatedZone,
    });
  } catch (error) {
    console.error("🎯 updateAgentZone: Error updating agent zone:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update zone",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get zones created by the current agent
 */
export const getAgentZones = async (req: AuthRequest, res: Response) => {
  try {
    console.log("🎯 getAgentZones: Fetching agent zones...");

    // Verify the user is an AGENT
    if (req.user?.role !== "AGENT") {
      return res.status(403).json({
        success: false,
        message: "This endpoint is only available for AGENT users",
      });
    }

    const agentId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    console.log(`🎯 getAgentZones: Fetching zones for agent ${agentId}`);

    // Find zones created by this agent
    const zones = await Zone.find({ createdBy: agentId })
      .populate([
        { path: "assignedAgentId", select: "name email" },
        { path: "areaId", select: "name type" },
        { path: "municipalityId", select: "name type" },
        { path: "communityId", select: "name type" },
      ])
      .sort({ createdAt: -1 })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit));

    const total = await Zone.countDocuments({ createdBy: agentId });

    console.log(
      `🎯 getAgentZones: Found ${zones.length} zones for agent ${agentId}`
    );

    res.json({
      success: true,
      data: zones,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("🎯 getAgentZones: Error fetching agent zones:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch zones",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get a specific zone created by the current agent
 */
export const getAgentZoneById = async (req: AuthRequest, res: Response) => {
  try {
    console.log("🎯 getAgentZoneById: Fetching agent zone by ID...");

    // Verify the user is an AGENT
    if (req.user?.role !== "AGENT") {
      return res.status(403).json({
        success: false,
        message: "This endpoint is only available for AGENT users",
      });
    }

    const agentId = req.user.id;
    const { id } = req.params;

    console.log(`🎯 getAgentZoneById: Agent ${agentId} fetching zone ${id}`);

    // Find the zone - either created by agent OR assigned to agent
    const zone = await Zone.findOne({
      _id: id,
      $or: [
        { createdBy: agentId }, // Zone created by this agent
        { assignedAgentId: agentId }, // Zone assigned to this agent
      ],
    }).populate([
      { path: "assignedAgentId", select: "name email" },
      { path: "areaId", select: "name type" },
      { path: "municipalityId", select: "name type" },
      { path: "communityId", select: "name type" },
    ]);

    if (!zone) {
      return res.status(404).json({
        success: false,
        message: "Zone not found or you don't have permission to access it",
      });
    }

    console.log(`🎯 getAgentZoneById: Zone found: ${zone.name}`);

    res.json({
      success: true,
      data: zone,
    });
  } catch (error) {
    console.error("🎯 getAgentZoneById: Error fetching agent zone:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch zone",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get zone location hierarchy for agent zones
 */
export const getAgentZoneLocation = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    console.log("🎯 getAgentZoneLocation: Fetching agent zone location...");

    // Verify the user is an AGENT
    if (req.user?.role !== "AGENT") {
      res.status(403).json({
        success: false,
        message: "This endpoint is only available for AGENT users",
      });
      return;
    }

    const agentId = req.user.id;
    const { id } = req.params;

    console.log(
      `🎯 getAgentZoneLocation: Agent ${agentId} fetching location for zone ${id}`
    );

    // Find the zone - either created by agent OR assigned to agent
    const zone = await Zone.findOne({
      _id: id,
      $or: [
        { createdBy: agentId }, // Zone created by this agent
        { assignedAgentId: agentId }, // Zone assigned to this agent
      ],
    })
      .populate([
        { path: "areaId", select: "name type" },
        { path: "municipalityId", select: "name type" },
        { path: "communityId", select: "name type" },
      ])
      .select("name areaId municipalityId communityId");

    if (!zone) {
      res.status(404).json({
        success: false,
        message: "Zone not found or you don't have permission to access it",
      });
      return;
    }

    console.log(`🎯 getAgentZoneLocation: Zone found: ${zone.name}`);

    res.json({
      success: true,
      data: {
        zone: {
          id: zone._id,
          name: zone.name,
        },
        area:
          zone.areaId &&
          typeof zone.areaId === "object" &&
          "name" in zone.areaId
            ? {
                id: zone.areaId._id,
                name: (zone.areaId as any).name,
              }
            : null,
        municipality:
          zone.municipalityId &&
          typeof zone.municipalityId === "object" &&
          "name" in zone.municipalityId
            ? {
                id: zone.municipalityId._id,
                name: (zone.municipalityId as any).name,
              }
            : null,
        community:
          zone.communityId &&
          typeof zone.communityId === "object" &&
          "name" in zone.communityId
            ? {
                id: zone.communityId._id,
                name: (zone.communityId as any).name,
              }
            : null,
      },
    });
  } catch (error) {
    console.error(
      "🎯 getAgentZoneLocation: Error fetching agent zone location:",
      error
    );
    res.status(500).json({
      success: false,
      message: "Failed to fetch zone location",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Check for zone overlaps (Agent version)
 */
export const checkAgentZoneOverlap = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    console.log("🎯 checkAgentZoneOverlap: Starting overlap check...");

    // Verify the user is an AGENT
    if (req.user?.role !== "AGENT") {
      return res.status(403).json({
        success: false,
        message: "This endpoint is only available for AGENT users",
      });
    }

    const { boundary, excludeZoneId } = req.body;

    if (!boundary) {
      return res.status(400).json({
        success: false,
        message: "Boundary is required",
      });
    }

    console.log(
      "🎯 checkAgentZoneOverlap: Checking overlap for boundary:",
      boundary
    );
    console.log("🎯 checkAgentZoneOverlap: Excluding zone ID:", excludeZoneId);

    // Use the same overlap checking logic as the admin controller
    const overlapResult = await checkZoneOverlap(
      boundary,
      excludeZoneId,
      req.user
    );

    console.log("🎯 checkAgentZoneOverlap: Overlap result:", overlapResult);

    res.json({
      success: true,
      data: overlapResult,
    });
  } catch (error) {
    console.error("🎯 checkAgentZoneOverlap: Error checking overlap:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check overlap",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Delete a zone created by the current agent
 */
export const deleteAgentZone = async (req: AuthRequest, res: Response) => {
  try {
    console.log("🎯 deleteAgentZone: Starting agent zone deletion...");

    // Verify the user is an AGENT
    if (req.user?.role !== "AGENT") {
      return res.status(403).json({
        success: false,
        message: "This endpoint is only available for AGENT users",
      });
    }

    const agentId = req.user.id;
    const { id } = req.params;

    console.log(`🎯 deleteAgentZone: Agent ${agentId} deleting zone ${id}`);

    // Find the zone and verify ownership
    const zone = await Zone.findOne({ _id: id, createdBy: agentId });
    if (!zone) {
      return res.status(404).json({
        success: false,
        message: "Zone not found or you don't have permission to delete it",
      });
    }

    // Remove zone from community if assigned
    if (zone.communityId) {
      await Community.findByIdAndUpdate(zone.communityId, {
        $pull: { zoneIds: zone._id },
      });
      console.log(`🎯 deleteAgentZone: Removed zone from community`);
    }

    // Remove agent zone assignment
    await AgentZoneAssignment.deleteMany({ zoneId: zone._id });
    console.log(`🎯 deleteAgentZone: Removed agent assignments`);

    // Remove zone from agent's zoneIds array
    await User.findByIdAndUpdate(agentId, {
      $pull: { zoneIds: zone._id },
    });
    console.log(`🎯 deleteAgentZone: Removed zone from agent's zoneIds`);

    // Create activity record for zone deletion (before deleting the zone)
    try {
      const Activity = require("../models/Activity").default;
      await Activity.create({
        agentId: agentId,
        activityType: "ZONE_OPERATION",
        zoneId: id,
        operationType: "DELETE",
        startedAt: new Date(), // Set startedAt so it counts in "Activities Today"
        notes: `Zone "${zone.name}" deleted`,
      });
      console.log("🎯 deleteAgentZone: Activity created for zone deletion");
    } catch (activityError) {
      console.error(
        "🎯 deleteAgentZone: Error creating zone deletion activity:",
        activityError
      );
      // Don't fail zone deletion if activity creation fails
    }

    // Delete the zone
    await Zone.findByIdAndDelete(zone._id);
    console.log(`🎯 deleteAgentZone: Zone deleted successfully`);

    // Update agent assignment status
    if (agentId) {
      await updateUserAssignmentStatus(agentId);
    }
    console.log(`🎯 deleteAgentZone: Updated agent assignment status`);

    res.json({
      success: true,
      message: "Zone deleted successfully",
    });
  } catch (error) {
    console.error("🎯 deleteAgentZone: Error deleting agent zone:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete zone",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
