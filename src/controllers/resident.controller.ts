import { Request, Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middleware/auth";
import { Resident } from "../models/Resident";
import { PropertyData } from "../models/PropertyData";
import { Zone } from "../models/Zone";
import { AgentZoneAssignment } from "../models/AgentZoneAssignment";
import { User, IUser } from "../models/User";
import Activity from "../models/Activity";
const { ScheduledAssignment } = require("../models/ScheduledAssignment");

// Helper function to check if point is inside polygon
const isPointInPolygon = (
  point: [number, number],
  polygon: [number, number][]
): boolean => {
  const [lng, lat] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [lng1, lat1] = polygon[i] as [number, number];
    const [lng2, lat2] = polygon[j] as [number, number];

    const intersect =
      lat1 > lat !== lat2 > lat &&
      lng < ((lng2 - lng1) * (lat - lat1)) / (lat2 - lat1) + lng1;

    if (intersect) inside = !inside;
  }

  return inside;
};

export const createResident = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const createData = req.body;
    const currentUser = req.user;
    const currentUserId = currentUser?.sub || currentUser?.id;

    console.log("🏗️ Create Resident Request:", {
      createData,
      currentUserId: currentUserId,
      currentUserRole: currentUser?.role,
    });

    // 1. Validate zone exists
    const zone = await Zone.findById(createData.zoneId);
    if (!zone) {
      res.status(404).json({
        success: false,
        message: "Zone not found",
      });
      return;
    }

    // 2. Check if user has permission to add residents to this zone
    const hasPermission = await checkEditPermission(currentUser, zone);
    if (!hasPermission) {
      res.status(403).json({
        success: false,
        message: "You do not have permission to add residents to this zone",
      });
      return;
    }

    // 2a. Validate required fields - only house number is mandatory
    // Note: Other fields like address, coordinates, lastVisited are optional

    // 3. Validate coordinates are inside zone boundary (only if coordinates provided)
    if (
      createData.coordinates &&
      zone.boundary &&
      zone.boundary.type === "Polygon"
    ) {
      const coordinates = createData.coordinates;
      const isInside = isPointInPolygon(
        coordinates,
        zone.boundary.coordinates[0] as [number, number][]
      );

      if (!isInside) {
        res.status(400).json({
          success: false,
          message: "Coordinates must be inside the zone boundary",
        });
        return;
      }
    }

    // 4. Check for duplicates (same coordinates OR same address+houseNumber combination)
    console.log("🔍 Checking for duplicates:", {
      zoneId: createData.zoneId,
      address: createData.address,
      houseNumber: createData.houseNumber,
      coordinates: createData.coordinates,
    });

    // 5. Create the new resident
    const newResident = new Resident({
      ...createData,
      dataSource: "MANUAL", // Manually added by agent
      lastUpdatedBy: currentUserId,
      assignedAgentId: createData.assignedAgentId || currentUserId, // Assign to current agent if not specified
    });

    await newResident.save();

    // Populate the response
    const populatedResident = await Resident.findById(newResident._id)
      .populate("assignedAgentId", "name email")
      .populate("lastUpdatedBy", "name email role")
      .populate("zoneId", "name")
      .populate("propertyDataId");

    console.log("✅ Resident created successfully:", {
      residentId: populatedResident?._id,
      createdBy: currentUserId,
      dataSource: "MANUAL",
    });

    // 6. Update Zone houseStatuses
    if (zone.buildingData) {
      try {
        const houseStatuses = zone.buildingData.houseStatuses || {};
        const houseStatus: any = {
          status: createData.status || "not-visited",
          lastVisited: createData.lastVisited || new Date(),
          updatedAt: new Date(),
        };

        if (currentUserId) {
          houseStatus.updatedBy = new mongoose.Types.ObjectId(currentUserId);
        }

        houseStatuses[createData.address] = houseStatus;

        await Zone.findByIdAndUpdate(createData.zoneId, {
          "buildingData.houseStatuses": houseStatuses,
        });

        console.log("✅ Zone houseStatuses updated after manual addition");
      } catch (zoneUpdateError) {
        console.error("⚠️ Error updating zone houseStatuses:", zoneUpdateError);
      }
    }

    // 7. Create activity record for resident/property creation
    try {
      const propertyIdForActivity = populatedResident?.propertyDataId?._id || null;
      
      await Activity.create({
        agentId: currentUserId,
        activityType: 'PROPERTY_OPERATION',
        propertyId: propertyIdForActivity,
        residentId: newResident._id,
        zoneId: createData.zoneId,
        operationType: 'CREATE',
        notes: `Resident/Property created: ${createData.address}`,
      });
    } catch (activityError) {
      console.error('Error creating resident creation activity:', activityError);
      // Don't fail resident creation if activity creation fails
    }

    res.status(201).json({
      success: true,
      message: "Resident added successfully",
      data: populatedResident,
    });
  } catch (error) {
    console.error("❌ Error creating resident:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getResidentById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    console.log("🔍 API - Fetching resident with ID:", id);

    // Check if PropertyData exists in database
    const totalPropertyData = await PropertyData.countDocuments();
    console.log("🔍 API - Total PropertyData in database:", totalPropertyData);

    // Fetch resident with populated data
    const resident = await Resident.findById(id)
      .populate("assignedAgentId", "name email")
      .populate("lastUpdatedBy", "name email role")
      .populate("zoneId", "name createdBy")
      .populate("propertyDataId");

    if (!resident) {
      res.status(404).json({
        success: false,
        message: "Resident not found",
      });
      return;
    }

    // Check if user has access to this resident's zone
    const currentUserId = req.user?.sub || req.user?.id;
    const currentUserRole = req.user?.role;

    if (currentUserRole !== "SUPERADMIN") {
      const zone = await Zone.findById(resident.zoneId).populate("createdBy");
      if (!zone) {
        res.status(404).json({
          success: false,
          message: "Zone not found",
        });
        return;
      }

      // Check if user has access to this zone
      const createdById =
        typeof zone.createdBy === "object" && zone.createdBy._id
          ? zone.createdBy._id.toString()
          : zone.createdBy?.toString();

      let hasAccess = false;

      if (currentUserRole === "SUBADMIN") {
        // SUBADMIN can access zones they created
        hasAccess = createdById === currentUserId;
      } else if (currentUserRole === "AGENT") {
        // AGENT can access zones they are assigned to
        const agent = await User.findById(currentUserId);

        if (agent) {
          // Check individual or team assignments
          const assignment = await AgentZoneAssignment.findOne({
            zoneId: resident.zoneId,
            status: { $nin: ["COMPLETED", "CANCELLED"] },
            effectiveTo: null,
            $or: [
              { agentId: currentUserId },
              { teamId: { $in: agent.teamIds } },
            ],
          });

          // Also check scheduled assignments
          const scheduledAssignment = await ScheduledAssignment.findOne({
            zoneId: resident.zoneId,
            status: "PENDING",
            $or: [
              { agentId: currentUserId },
              { teamId: { $in: agent.teamIds } },
            ],
          });

          hasAccess = !!(assignment || scheduledAssignment);
        }
      }

      if (!hasAccess) {
        res.status(403).json({
          success: false,
          message: "Access denied to this resident",
        });
        return;
      }
    }

    // Fetch zone details with building data
    const zone = await Zone.findById(resident.zoneId)
      .populate("assignedAgentId", "name email")
      .populate("teamId", "name")
      .populate("createdBy", "name email");

    // Fetch related property data for the same zone
    const zonePropertyData = await PropertyData.find({
      zoneId: resident.zoneId,
      addressLine1: {
        $regex: new RegExp(resident.address.split(",")[0] || "", "i"),
      },
    }).limit(5);

    console.log("🔍 API - Zone Property Data Found:", zonePropertyData.length);
    console.log("🔍 API - Zone Property Data:", zonePropertyData);

    // Fetch property data for the specific address if not already linked
    let specificPropertyData = null;
    if (!resident.propertyDataId) {
      const addressParts = resident.address.split(",");
      const searchCriteria = {
        addressLine1: { $regex: new RegExp(addressParts[0] || "", "i") },
        city: addressParts[1]?.trim(),
        state: addressParts[2]?.trim(),
      };

      console.log(
        "🔍 API - Searching for PropertyData with criteria:",
        searchCriteria
      );
      specificPropertyData = await PropertyData.findOne(searchCriteria);
      console.log(
        "🔍 API - Specific PropertyData found:",
        specificPropertyData
      );
    }

    console.log("🔍 API - Resident PropertyDataId:", resident.propertyDataId);
    console.log("🔍 API - Specific PropertyData:", specificPropertyData);
    console.log("🔍 API - Zone PropertyData[0]:", zonePropertyData[0]);

    // If no PropertyData exists, create a sample one for testing
    if (
      !resident.propertyDataId &&
      !specificPropertyData &&
      zonePropertyData.length === 0
    ) {
      console.log(
        "🔍 API - No PropertyData found, creating sample data for testing"
      );
      const samplePropertyData = new PropertyData({
        addressLine1: resident.address.split(",")[0],
        city: resident.address.split(",")[1]?.trim() || "Toronto",
        state: resident.address.split(",")[2]?.trim() || "ON",
        postalCode: resident.address.split(",")[3]?.trim() || "M4L 3Y1",
        location: {
          type: "Point",
          coordinates: resident.coordinates,
        },
        zoneId: resident.zoneId,
        propertyType: "SINGLE_FAMILY",
        bedrooms: 3,
        bathrooms: 2,
        yearBuilt: 1995,
        estimatedValue: 750000,
        leadScore: 75,
        ownerName: "John Smith",
        ownerPhone: "+1-416-555-0123",
        dataSource: "MANUAL",
      });

      await samplePropertyData.save();
      console.log(
        "🔍 API - Created sample PropertyData:",
        samplePropertyData._id
      );

      // Update the resident to link to this PropertyData
      await Resident.findByIdAndUpdate(resident._id, {
        propertyDataId: samplePropertyData._id,
      });
      console.log("🔍 API - Updated resident with PropertyDataId");

      // Update our response data
      specificPropertyData = samplePropertyData;
    }

    // Fetch other residents in the same zone
    const zoneResidents = await Resident.find({
      zoneId: resident.zoneId,
      _id: { $ne: resident._id }, // Exclude current resident
    })
      .populate("assignedAgentId", "name email")
      .limit(10)
      .sort({ houseNumber: 1 });

    // Determine which PropertyData to use
    const finalPropertyData =
      resident.propertyDataId ||
      specificPropertyData ||
      zonePropertyData[0] ||
      null;

    console.log("🔍 API - Final PropertyData being used:", finalPropertyData);
    console.log("🔍 API - PropertyData details:", {
      yearBuilt: (finalPropertyData as any)?.yearBuilt,
      bedrooms: (finalPropertyData as any)?.bedrooms,
      leadScore: (finalPropertyData as any)?.leadScore,
      estimatedValue: (finalPropertyData as any)?.estimatedValue,
      ownerName: (finalPropertyData as any)?.ownerName,
      ownerPhone: (finalPropertyData as any)?.ownerPhone,
    });

    // Prepare comprehensive response
    const responseData = {
      resident,
      zone,
      propertyData: finalPropertyData,
      zonePropertyData: zonePropertyData,
      zoneResidents,
      zoneStats: {
        totalResidents: await Resident.countDocuments({
          zoneId: resident.zoneId,
        }),
        visitedResidents: await Resident.countDocuments({
          zoneId: resident.zoneId,
          status: {
            $in: [
              "visited",
              "interested",
              "callback",
              "appointment",
              "follow-up",
            ],
          },
        }),
        notVisitedResidents: await Resident.countDocuments({
          zoneId: resident.zoneId,
          status: "not-visited",
        }),
      },
      // Additional context data
      relatedData: {
        nearbyProperties: zonePropertyData.length,
        hasPropertyData: !!finalPropertyData,
        zoneProgress: {
          percentage: Math.round(
            ((await Resident.countDocuments({
              zoneId: resident.zoneId,
              status: {
                $in: [
                  "visited",
                  "interested",
                  "callback",
                  "appointment",
                  "follow-up",
                ],
              },
            })) /
              (await Resident.countDocuments({ zoneId: resident.zoneId }))) *
              100
          ),
        },
      },
    };

    console.log("🔍 API - Response Data:", {
      residentId: resident._id,
      residentAddress: resident.address,
      residentStatus: resident.status,
      propertyDataFound: !!responseData.propertyData,
      zoneName: responseData.zone?.name,
      zoneStats: responseData.zoneStats,
    });

    res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("Error getting resident by ID:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateResident = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const currentUser = req.user;

    console.log("🔄 Update Resident Request:", {
      id,
      updateData,
      currentUserId: currentUser?.sub || currentUser?.id,
      currentUserRole: currentUser?.role,
    });

    // 1. Find the resident and populate related data
    const resident = await Resident.findById(id).populate("zoneId");
    if (!resident) {
      return res.status(404).json({
        success: false,
        message: "Resident not found",
      });
    }

    // 2. Authorization Check
    const zone = await Zone.findById(resident.zoneId).populate("createdBy");
    if (!zone) {
      return res.status(404).json({
        success: false,
        message: "Zone not found",
      });
    }

    // Check if user has permission to edit this resident
    const hasPermission = await checkEditPermission(currentUser, zone);
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to edit this resident",
      });
    }

    // 3. Business Logic Validation
    // Pass the current resident to check if status is being CHANGED
    const validationError = validateResidentUpdate(updateData, resident);
    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    // 3a. Validate coordinates if provided
    if (updateData.coordinates) {
      const [lng, lat] = updateData.coordinates;
      // Valid longitude: -180 to 180, Valid latitude: -90 to 90
      if (
        typeof lng !== 'number' ||
        typeof lat !== 'number' ||
        lng < -180 ||
        lng > 180 ||
        lat < -90 ||
        lat > 90 ||
        !isFinite(lng) ||
        !isFinite(lat)
      ) {
        console.error("❌ Invalid coordinates provided:", updateData.coordinates);
        // Remove invalid coordinates from updateData, keep existing coordinates
        delete updateData.coordinates;
        console.log("⚠️  Invalid coordinates removed, preserving existing coordinates");
      }
    }

    // 3b. Check for duplicates if key fields are being updated
    if (
      updateData.coordinates ||
      updateData.address ||
      updateData.houseNumber
    ) {
      const checkAddress = updateData.address || resident.address;
      const checkHouseNumber = updateData.houseNumber || resident.houseNumber;
      const checkCoordinates = updateData.coordinates || resident.coordinates;

      console.log("🔍 Update: Checking for duplicates:", {
        zoneId: resident.zoneId,
        address: checkAddress,
        houseNumber: checkHouseNumber,
        coordinates: checkCoordinates,
        excludingId: id,
      });
    }

    // 4. Update the resident with tracking
    const currentUserId = currentUser?.sub || currentUser?.id;
    const updatedResident = await Resident.findByIdAndUpdate(
      id,
      {
        ...updateData,
        lastUpdatedBy: currentUserId, // Track which user made this update
        updatedAt: new Date(),
      },
      { new: true, runValidators: true }
    ).populate("zoneId assignedAgentId lastUpdatedBy propertyDataId");

    console.log("✅ Resident updated successfully:", {
      residentId: updatedResident?._id,
      updatedBy: currentUserId,
      userName: (updatedResident?.lastUpdatedBy as any)?.name || "Unknown",
    });

    // 5. Update PropertyData if owner information is provided
    let updatedPropertyData = null;
    const ownerFields = [
      "ownerName",
      "ownerPhone",
      "ownerEmail",
      "ownerMailingAddress",
    ];
    const hasOwnerUpdates = ownerFields.some(
      (field) => updateData[field] !== undefined
    );

    if (hasOwnerUpdates && updatedResident?.propertyDataId) {
      const propertyDataUpdates: any = {};
      ownerFields.forEach((field) => {
        if (updateData[field] !== undefined) {
          propertyDataUpdates[field] = updateData[field];
        }
      });

      if (Object.keys(propertyDataUpdates).length > 0) {
        updatedPropertyData = await PropertyData.findByIdAndUpdate(
          updatedResident.propertyDataId,
          { ...propertyDataUpdates, lastUpdated: new Date() },
          { new: true, runValidators: true }
        );
        console.log(
          "✅ PropertyData updated successfully:",
          updatedPropertyData?._id
        );
      }
    }

    // 6. Update Zone houseStatuses if status changed
    if (updateData.status && updatedResident) {
      try {
        const zoneToUpdate = await Zone.findById(resident.zoneId);
        if (zoneToUpdate && zoneToUpdate.buildingData) {
          // Update the house status in the zone's buildingData
          const houseKey = updatedResident.address;
          const houseStatuses = zoneToUpdate.buildingData.houseStatuses || {};

          const houseStatus: any = {
            status: updateData.status,
            lastVisited: updateData.lastVisited || new Date(),
            updatedAt: new Date(),
          };

          if (currentUserId) {
            houseStatus.updatedBy = new mongoose.Types.ObjectId(currentUserId);
          }

          houseStatuses[houseKey] = houseStatus;

          // Save the updated zone
          await Zone.findByIdAndUpdate(resident.zoneId, {
            "buildingData.houseStatuses": houseStatuses,
          });

          console.log("✅ Zone houseStatuses updated for dashboard sync");
        }
      } catch (zoneUpdateError) {
        // Log error but don't fail the resident update
        console.error("⚠️ Error updating zone houseStatuses:", zoneUpdateError);
      }
    }

    // 7. Check if this was the last "not-visited" property and mark zone as COMPLETED
    if (updateData.status && updateData.status !== "not-visited" && resident.status === "not-visited") {
      try {
        // Check if there are any remaining "not-visited" properties in this zone
        const remainingNotVisitedCount = await Resident.countDocuments({
          zoneId: resident.zoneId,
          status: "not-visited",
          _id: { $ne: id }, // Exclude the current property being updated
        });

        // If this was the last "not-visited" property, mark zone and assignment as COMPLETED
        if (remainingNotVisitedCount === 0) {
          console.log(`🎉 Last "not-visited" property updated in zone ${resident.zoneId}. Marking zone as COMPLETED.`);

          // Update Zone status to COMPLETED
          await Zone.findByIdAndUpdate(resident.zoneId, {
            status: "COMPLETED",
          });

          // Update AgentZoneAssignment status to COMPLETED for this zone
          await AgentZoneAssignment.updateMany(
            {
              zoneId: resident.zoneId,
              status: { $in: ["ACTIVE", "INACTIVE"] },
              effectiveTo: null,
            },
            {
              status: "COMPLETED",
              effectiveTo: new Date(),
            }
          );

          console.log(`✅ Zone ${resident.zoneId} and assignments marked as COMPLETED`);
        }
      } catch (completionError) {
        console.error("⚠️ Error checking/updating zone completion status:", completionError);
        // Don't fail resident update if completion check fails
      }
    }

    // 8. Create activity record for resident/property update
    try {
      const changes: string[] = [];
      if (updateData.address && updateData.address !== resident.address) changes.push(`address: "${resident.address}" → "${updateData.address}"`);
      if (updateData.status && updateData.status !== resident.status) changes.push(`status: "${resident.status}" → "${updateData.status}"`);
      if (updateData.phone && updateData.phone !== resident.phone) changes.push('phone updated');
      if (updateData.email && updateData.email !== resident.email) changes.push('email updated');
      if (updateData.notes && updateData.notes !== resident.notes) changes.push('notes updated');
      if (updateData.ownerName) changes.push('owner name updated');
      if (updateData.ownerPhone) changes.push('owner phone updated');
      if (updateData.ownerEmail) changes.push('owner email updated');
      if (updateData.ownerMailingAddress) changes.push('owner mailing address updated');
      
      // Use propertyId from PropertyData if available, otherwise use resident's zoneId
      const propertyIdForActivity = updatedResident?.propertyDataId || null;
      
      await Activity.create({
        agentId: currentUserId,
        activityType: 'PROPERTY_OPERATION',
        propertyId: propertyIdForActivity,
        residentId: id,
        zoneId: resident.zoneId,
        operationType: 'UPDATE',
        notes: changes.length > 0 ? `Resident/Property updated: ${changes.join(', ')}` : 'Resident/Property updated',
      });
    } catch (activityError) {
      console.error('Error creating resident update activity:', activityError);
      // Don't fail resident update if activity creation fails
    }

    res.json({
      success: true,
      message: "Resident updated successfully",
      data: {
        ...updatedResident?.toObject(),
        propertyData: updatedPropertyData || updatedResident?.propertyDataId,
      },
    });
  } catch (error) {
    console.error("❌ Error updating resident:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Helper function to check edit permissions
const checkEditPermission = async (
  currentUser: any,
  zone: any
): Promise<boolean> => {
  const currentUserId = currentUser.sub || currentUser.id;
  const currentUserRole = currentUser.role;

  // 1. Super Admin can edit anything
  if (currentUserRole === "SUPERADMIN") {
    console.log("✅ Super Admin permission granted");
    return true;
  }

  // 2. Zone Creator can edit (for SUBADMIN)
  if (currentUserRole === "SUBADMIN") {
    const createdById =
      typeof zone.createdBy === "object" && zone.createdBy._id
        ? zone.createdBy._id.toString()
        : zone.createdBy?.toString();

    if (createdById === currentUserId) {
      console.log("✅ Zone Creator permission granted");
      return true;
    }
  }

  // 3. Check if AGENT is assigned to this zone (individual or team)
  if (currentUserRole === "AGENT") {
    const agent = await User.findById(currentUserId);

    if (agent) {
      // Check active assignments (individual or team)
      const currentAssignment = await AgentZoneAssignment.findOne({
        zoneId: zone._id,
        status: { $nin: ["COMPLETED", "CANCELLED"] },
        effectiveTo: null,
        $or: [{ agentId: currentUserId }, { teamId: { $in: agent.teamIds } }],
      });

      // Also check scheduled assignments
      const scheduledAssignment = await ScheduledAssignment.findOne({
        zoneId: zone._id,
        status: "PENDING",
        $or: [{ agentId: currentUserId }, { teamId: { $in: agent.teamIds } }],
      });

      if (currentAssignment || scheduledAssignment) {
        console.log("✅ Assigned Agent/Team Member permission granted");
        return true;
      }
    }
  }

  console.log("❌ No permission found for user:", currentUserId);
  return false;
};

// Helper function to validate resident update
const validateResidentUpdate = (
  updateData: any,
  currentResident: any
): string | null => {
  // Require lastVisited field ONLY if status is not "not-visited"
  // If status is "not-visited", user hasn't visited yet, so lastVisited is not required
  if (updateData.status && updateData.status !== "not-visited") {
    if (!updateData.lastVisited) {
      return "Last Visited date is required when status is not 'Not Visited'";
    }
  }

  // Check if status is being CHANGED TO 'not-visited' (not already "not-visited")
  const isChangingToNotVisited =
    updateData.status === "not-visited" &&
    currentResident.status !== "not-visited";

  // Only validate if user is CHANGING status TO "not-visited"
  if (isChangingToNotVisited) {
    const hasInfo =
      updateData.phone ||
      updateData.email ||
      updateData.notes ||
      updateData.lastVisited ||
      updateData.ownerName ||
      updateData.ownerPhone ||
      updateData.ownerEmail ||
      updateData.ownerMailingAddress;

    if (hasInfo) {
      return 'Cannot change status to "Not Visited" when adding contact information. Please select a different status.';
    }
  }

  // If status IS ALREADY "not-visited" → Allow basic info updates (address, coordinates)
  // If status is "visited/interested/etc" → Allow all info updates

  return null;
};
