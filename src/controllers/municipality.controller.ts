import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { Municipality } from "../models/Municipality";
import { Community } from "../models/Community";
import { Area } from "../models/Area";

/**
 * Get all municipalities with their areas and communities
 */
export const getAllMunicipalities = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const municipalities = await Municipality.find()
      .populate("areaId", "name type")
      .populate("communities", "name type")
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
 * Get municipality by ID with populated data
 */
export const getMunicipalityById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const municipality = await Municipality.findById(id)
      .populate("areaId", "name type")
      .populate("communities", "name type");

    if (!municipality) {
      res.status(404).json({
        success: false,
        message: "Municipality not found",
      });
      return;
    }

    res.json({
      success: true,
      data: municipality,
    });
  } catch (error) {
    console.error("Error getting municipality:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get municipality",
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
 * Get municipality statistics
 */
export const getMunicipalityStats = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const municipality = await Municipality.findById(id);
    if (!municipality) {
      res.status(404).json({
        success: false,
        message: "Municipality not found",
      });
      return;
    }

    const communityCount = await Community.countDocuments({
      municipalityId: id,
    });
    const area = await Area.findById(municipality.areaId).select("name");

    const stats = {
      municipality: {
        id: municipality._id,
        name: municipality.name,
        type: municipality.type,
      },
      area: area ? { id: area._id, name: area.name } : null,
      communityCount,
      totalCommunities: communityCount,
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error getting municipality stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get municipality statistics",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

