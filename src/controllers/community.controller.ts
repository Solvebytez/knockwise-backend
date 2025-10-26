import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { Community } from "../models/Community";
import { Municipality } from "../models/Municipality";
import { Area } from "../models/Area";

/**
 * Get all communities with their municipalities and areas
 */
export const getAllCommunities = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const communities = await Community.find()
      .populate("municipalityId", "name type areaId")
      .populate("areaId", "name type")
      .sort({ name: 1 });

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
 * Get community by ID with populated data
 */
export const getCommunityById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const community = await Community.findById(id)
      .populate("municipalityId", "name type areaId")
      .populate("areaId", "name type");

    if (!community) {
      res.status(404).json({
        success: false,
        message: "Community not found",
      });
      return;
    }

    res.json({
      success: true,
      data: community,
    });
  } catch (error) {
    console.error("Error getting community:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get community",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get communities by area ID
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
 * Get community statistics
 */
export const getCommunityStats = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const community = await Community.findById(id)
      .populate("municipalityId", "name areaId")
      .populate("areaId", "name");

    if (!community) {
      res.status(404).json({
        success: false,
        message: "Community not found",
      });
      return;
    }

    const stats = {
      community: {
        id: community._id,
        name: community.name,
        type: community.type,
      },
      municipality: {
        id: (community.municipalityId as any)._id,
        name: (community.municipalityId as any).name,
      },
      area: {
        id: (community.areaId as any)._id,
        name: (community.areaId as any).name,
      },
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error getting community stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get community statistics",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

