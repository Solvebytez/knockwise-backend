import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { Area } from "../models/Area";
import { Municipality } from "../models/Municipality";
import { Community } from "../models/Community";

/**
 * Get all areas with their municipalities and communities
 */
export const getAllAreas = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const areas = await Area.find()
      .populate({
        path: "municipalities",
        populate: {
          path: "communities",
          model: "Community",
        },
      })
      .sort({ name: 1 });

    res.json({
      success: true,
      data: areas,
    });
  } catch (error) {
    console.error("Error getting areas:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get areas",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get area by ID with populated municipalities and communities
 */
export const getAreaById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const area = await Area.findById(id).populate({
      path: "municipalities",
      populate: {
        path: "communities",
        model: "Community",
      },
    });

    if (!area) {
      res.status(404).json({
        success: false,
        message: "Area not found",
      });
      return;
    }

    res.json({
      success: true,
      data: area,
    });
  } catch (error) {
    console.error("Error getting area:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get area",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get municipalities by area ID
 */
export const getMunicipalitiesByArea = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { areaId } = req.params;

    const municipalities = await Municipality.find({ areaId })
      .populate("communities")
      .sort({ name: 1 });

    res.json({
      success: true,
      data: municipalities,
    });
  } catch (error) {
    console.error("Error getting municipalities:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get municipalities",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get communities by municipality ID
 */
export const getCommunitiesByMunicipality = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { municipalityId } = req.params;

    const communities = await Community.find({ municipalityId }).sort({
      name: 1,
    });

    res.json({
      success: true,
      data: communities,
    });
  } catch (error) {
    console.error("Error getting communities:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get communities",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get communities by area ID (all communities in an area)
 */
export const getCommunitiesByArea = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { areaId } = req.params;

    const communities = await Community.find({ areaId })
      .populate("municipalityId", "name")
      .sort({ name: 1 });

    res.json({
      success: true,
      data: communities,
    });
  } catch (error) {
    console.error("Error getting communities by area:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get communities",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get location hierarchy for a specific community
 */
export const getLocationHierarchy = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { communityId } = req.params;

    const community = await Community.findById(communityId)
      .populate("municipalityId", "name areaId")
      .populate({
        path: "municipalityId",
        populate: {
          path: "areaId",
          model: "Area",
          select: "name",
        },
      });

    if (!community) {
      res.status(404).json({
        success: false,
        message: "Community not found",
      });
      return;
    }

    const hierarchy = {
      community: {
        id: community._id,
        name: community.name,
        type: community.type,
      },
      municipality: {
        id: (community.municipalityId as any)._id,
        name: (community.municipalityId as any).name,
        type: (community.municipalityId as any).type,
      },
      area: {
        id: ((community.municipalityId as any).areaId as any)._id,
        name: ((community.municipalityId as any).areaId as any).name,
        type: ((community.municipalityId as any).areaId as any).type,
      },
    };

    res.json({
      success: true,
      data: hierarchy,
    });
  } catch (error) {
    console.error("Error getting location hierarchy:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get location hierarchy",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Search locations by name (areas, municipalities, or communities)
 */
export const searchLocations = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { query, type } = req.query;

    if (!query || typeof query !== "string") {
      res.status(400).json({
        success: false,
        message: "Search query is required",
      });
      return;
    }

    const searchRegex = new RegExp(query, "i");
    const results: any = {
      areas: [],
      municipalities: [],
      communities: [],
    };

    // Search areas
    if (!type || type === "area") {
      results.areas = await Area.find({ name: searchRegex }).select(
        "name type"
      );
    }

    // Search municipalities
    if (!type || type === "municipality") {
      results.municipalities = await Municipality.find({ name: searchRegex })
        .populate("areaId", "name")
        .select("name type areaId");
    }

    // Search communities
    if (!type || type === "community") {
      results.communities = await Community.find({ name: searchRegex })
        .populate("municipalityId", "name")
        .populate("areaId", "name")
        .select("name type municipalityId areaId");
    }

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Error searching locations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search locations",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
