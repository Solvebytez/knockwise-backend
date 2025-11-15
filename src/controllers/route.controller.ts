import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middleware/auth";
import Route from "../models/Route";
import PropertyData from "../models/PropertyData";
import User from "../models/User";
import Activity from "../models/Activity";

export async function createRoute(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const routeData = {
      ...req.body,
      agentId: req.user!.sub,
      // Use analytics from request body if provided, otherwise use defaults
      analytics: req.body.analytics || {
        totalStops: 0,
        completedStops: 0,
        skippedStops: 0,
        totalDistance: req.body.totalDistance || 0,
        estimatedDuration: req.body.totalDuration || 0,
        efficiency: 0,
        completionRate: 0,
      },
    };

    const route = await Route.create(routeData);
    
    // Create activity record for route creation
    try {
      await Activity.create({
        agentId: req.user!.sub,
        activityType: 'ROUTE_OPERATION',
        zoneId: route.zoneId || null,
        operationType: 'CREATE',
        startedAt: new Date(), // Set startedAt so it counts in "Activities Today"
        notes: `Route "${route.name}" created`,
      });
    } catch (activityError) {
      console.error('Error creating route creation activity:', activityError);
      // Don't fail route creation if activity creation fails
    }
    
    res.status(201).json(route);
  } catch (error) {
    res.status(500).json({
      message: "Error creating route",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function optimizeRoute(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const {
      propertyIds,
      startLocation,
      endLocation,
      optimizationSettings = {},
    } = req.body as {
      propertyIds: string[];
      startLocation?: [number, number];
      endLocation?: [number, number];
      optimizationSettings?: any;
    };

    if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
      res.status(400).json({ message: "Property IDs array is required" });
      return;
    }

    // Get properties with location data
    const properties = await PropertyData.find({
      _id: { $in: propertyIds },
      location: { $exists: true },
    }).limit(optimizationSettings.maxStops || 50);

    if (properties.length === 0) {
      res
        .status(400)
        .json({ message: "No valid properties found with location data" });
      return;
    }

    // Filter out properties without location data
    const validProperties = properties.filter(
      (p) => p.location && p.location.coordinates
    );

    if (validProperties.length === 0) {
      res
        .status(400)
        .json({ message: "No properties with valid location data found" });
      return;
    }

    // Enhanced optimization algorithm based on settings
    const optimizedStops = await optimizeRouteStops(
      validProperties,
      startLocation,
      endLocation,
      optimizationSettings
    );

    const totalDistance = calculateTotalDistance(
      optimizedStops,
      validProperties
    );
    const totalDuration =
      optimizedStops.length *
      (optimizationSettings.estimatedDurationPerStop || 15);

    const route = await Route.create({
      name: `Optimized Route - ${new Date().toLocaleDateString()}`,
      agentId: req.user!.sub,
      date: new Date(),
      stops: optimizedStops,
      totalDistance,
      totalDuration,
      startLocation: startLocation
        ? { type: "Point", coordinates: startLocation }
        : undefined,
      endLocation: endLocation
        ? { type: "Point", coordinates: endLocation }
        : undefined,
      optimizationSettings: {
        maxStops: optimizationSettings.maxStops || 50,
        maxDistance: optimizationSettings.maxDistance || 25,
        optimizationType: optimizationSettings.optimizationType || "FASTEST",
        avoidFerries: optimizationSettings.avoidFerries || false,
        avoidHighways: optimizationSettings.avoidHighways || false,
        avoidTolls: optimizationSettings.avoidTolls || false,
        avoidTraffic: optimizationSettings.avoidTraffic || true,
        startFromOffice: optimizationSettings.startFromOffice || true,
        returnToOffice: optimizationSettings.returnToOffice || true,
        preferredTimeWindow: optimizationSettings.preferredTimeWindow || {
          start: "09:00",
          end: "17:00",
        },
      },
      analytics: {
        totalStops: optimizedStops.length,
        completedStops: 0,
        skippedStops: 0,
        totalDistance,
        estimatedDuration: totalDuration,
        efficiency: 0,
        completionRate: 0,
      },
    });

    // Create activity record for route creation (optimize route)
    try {
      await Activity.create({
        agentId: req.user!.sub,
        activityType: 'ROUTE_OPERATION',
        zoneId: route.zoneId || null,
        operationType: 'CREATE',
        startedAt: new Date(), // Set startedAt so it counts in "Activities Today"
        notes: `Optimized route "${route.name}" created`,
      });
    } catch (activityError) {
      console.error('Error creating route optimization activity:', activityError);
      // Don't fail route creation if activity creation fails
    }

    res.status(201).json(route);
  } catch (error) {
    res.status(500).json({
      message: "Error optimizing route",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function getMyRoutes(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const agentId = req.user!.sub;
    const { page = 1, limit = 20, status, priority, date } = req.query;

    const query: any = { agentId };
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (date) {
      const dateObj = new Date(date as string);
      query.date = {
        $gte: new Date(
          dateObj.getFullYear(),
          dateObj.getMonth(),
          dateObj.getDate()
        ),
        $lt: new Date(
          dateObj.getFullYear(),
          dateObj.getMonth(),
          dateObj.getDate() + 1
        ),
      };
    }

    const routes = await Route.find(query)
      .sort({ date: -1, createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .populate("zoneId", "name")
      .populate("teamId", "name");

    const total = await Route.countDocuments(query);

    res.json({
      routes,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching routes",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function getRouteById(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const route = await Route.findById(id)
      .populate(
        "stops.propertyId",
        "address city state zipCode propertyType leadScore"
      )
      .populate("agentId", "name email")
      .populate("zoneId", "name")
      .populate("teamId", "name")
      .populate("sharing.sharedWith", "name email");

    if (!route) {
      res.status(404).json({ message: "Route not found" });
      return;
    }

    res.json(route);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching route",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function updateRoute(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const route = await Route.findByIdAndUpdate(id, req.body, { new: true });

    if (!route) {
      res.status(404).json({ message: "Route not found" });
      return;
    }

    // Create activity record for route update
    try {
      await Activity.create({
        agentId: req.user!.sub,
        activityType: 'ROUTE_OPERATION',
        zoneId: route.zoneId || null,
        operationType: 'UPDATE',
        startedAt: new Date(), // Set startedAt so it counts in "Activities Today"
        notes: `Route "${route.name}" updated`,
      });
    } catch (activityError) {
      console.error('Error creating route update activity:', activityError);
      // Don't fail route update if activity creation fails
    }

    res.json(route);
  } catch (error) {
    res.status(500).json({
      message: "Error updating route",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function deleteRoute(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const route = await Route.findById(id);

    if (!route) {
      res.status(404).json({ message: "Route not found" });
      return;
    }

    // Store route info before deletion for activity
    const routeName = route.name;
    const routeZoneId = route.zoneId;

    // Delete the route
    await Route.findByIdAndDelete(id);

    // Create activity record for route deletion (before deleting the route)
    try {
      await Activity.create({
        agentId: req.user!.sub,
        activityType: 'ROUTE_OPERATION',
        zoneId: routeZoneId || null,
        operationType: 'DELETE',
        startedAt: new Date(), // Set startedAt so it counts in "Activities Today"
        notes: `Route "${routeName}" deleted`,
      });
    } catch (activityError) {
      console.error('Error creating route deletion activity:', activityError);
      // Don't fail route deletion if activity creation fails
    }

    res.json({ message: "Route deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Error deleting route",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function listRoutes(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      priority,
      agentId,
      teamId,
      zoneId,
      startDate,
      endDate,
      isTemplate,
      tags,
    } = req.query;

    const query: any = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (agentId) query.agentId = agentId;
    if (teamId) query.teamId = teamId;
    if (zoneId) query.zoneId = zoneId;
    if (isTemplate !== undefined) query.isTemplate = isTemplate === "true";
    if (tags) {
      const tagArray = (tags as string).split(",").map((tag) => tag.trim());
      query.tags = { $in: tagArray };
    }
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate as string);
      if (endDate) query.date.$lte = new Date(endDate as string);
    }

    const routes = await Route.find(query)
      .sort({ date: -1, createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .populate("agentId", "name email")
      .populate("zoneId", "name")
      .populate("teamId", "name");

    const total = await Route.countDocuments(query);

    res.json({
      routes,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching routes",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function getTeamRoutes(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { teamId } = req.query;
    const { page = 1, limit = 20, status, priority } = req.query;

    const query: any = { teamId };
    if (status) query.status = status;
    if (priority) query.priority = priority;

    const routes = await Route.find(query)
      .sort({ date: -1, createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .populate("agentId", "name email")
      .populate("zoneId", "name");

    const total = await Route.countDocuments(query);

    res.json({
      routes,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching team routes",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function updateRouteStatus(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body as { status: string };

    const route = await Route.findByIdAndUpdate(id, { status }, { new: true });

    if (!route) {
      res.status(404).json({ message: "Route not found" });
      return;
    }

    res.json(route);
  } catch (error) {
    res.status(500).json({
      message: "Error updating route status",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function duplicateRoute(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const { name, date } = req.body;

    const originalRoute = await Route.findById(id);
    if (!originalRoute) {
      res.status(404).json({ message: "Route not found" });
      return;
    }

    const duplicatedRoute = await Route.create({
      ...originalRoute.toObject(),
      _id: undefined,
      name: name || `${originalRoute.name} (Copy)`,
      date: date ? new Date(date) : new Date(),
      status: "DRAFT",
      parentRouteId: originalRoute._id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create activity record for route duplication (creates a new route)
    try {
      await Activity.create({
        agentId: req.user!.sub,
        activityType: 'ROUTE_OPERATION',
        zoneId: duplicatedRoute.zoneId || null,
        operationType: 'CREATE',
        startedAt: new Date(), // Set startedAt so it counts in "Activities Today"
        notes: `Route "${duplicatedRoute.name}" duplicated from "${originalRoute.name}"`,
      });
    } catch (activityError) {
      console.error('Error creating route duplication activity:', activityError);
      // Don't fail route duplication if activity creation fails
    }

    res.status(201).json(duplicatedRoute);
  } catch (error) {
    res.status(500).json({
      message: "Error duplicating route",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function shareRoute(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const { sharedWith, permissions = "VIEW" } = req.body;

    const route = await Route.findById(id);
    if (!route) {
      res.status(404).json({ message: "Route not found" });
      return;
    }

    // Verify that all users exist
    const users = await User.find({ _id: { $in: sharedWith } });
    if (users.length !== sharedWith.length) {
      res.status(400).json({ message: "Some users not found" });
      return;
    }

    route.sharing = {
      sharedWith: sharedWith.map(
        (id: string) => new mongoose.Types.ObjectId(id)
      ),
      sharedBy: new mongoose.Types.ObjectId(req.user!.sub),
      sharedAt: new Date(),
      permissions,
    };

    await route.save();
    res.json(route);
  } catch (error) {
    res.status(500).json({
      message: "Error sharing route",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function updateStopStatus(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { routeId } = req.params;
    const { stopIndex, status, actualDuration, notes } = req.body;

    const route = await Route.findById(routeId);
    if (!route) {
      res.status(404).json({ message: "Route not found" });
      return;
    }

    if (stopIndex < 0 || stopIndex >= route.stops.length) {
      res.status(400).json({ message: "Invalid stop index" });
      return;
    }

    const stop = route.stops[stopIndex];
    if (!stop) {
      res.status(400).json({ message: "Stop not found" });
      return;
    }

    stop.status = status;
    if (actualDuration) stop.actualDuration = actualDuration;
    if (notes) stop.notes = notes;
    if (status === "COMPLETED") stop.completedAt = new Date();

    await route.save();
    res.json(route);
  } catch (error) {
    res.status(500).json({
      message: "Error updating stop status",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function getRouteAnalytics(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const route = await Route.findById(id);
    if (!route) {
      res.status(404).json({ message: "Route not found" });
      return;
    }

    // Calculate additional analytics
    const analytics = {
      ...route.analytics,
      averageTimePerStop:
        route.analytics.totalStops > 0
          ? route.analytics.estimatedDuration / route.analytics.totalStops
          : 0,
      successRate:
        route.analytics.totalStops > 0
          ? (route.analytics.completedStops / route.analytics.totalStops) * 100
          : 0,
      efficiency:
        route.analytics.actualDuration && route.analytics.estimatedDuration
          ? (route.analytics.estimatedDuration /
              route.analytics.actualDuration) *
            100
          : 0,
    };

    res.json(analytics);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching route analytics",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function exportRoute(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const { format = "json" } = req.query;

    const route = await Route.findById(id)
      .populate(
        "stops.propertyId",
        "address city state zipCode propertyType leadScore"
      )
      .populate("agentId", "name email");

    if (!route) {
      res.status(404).json({ message: "Route not found" });
      return;
    }

    switch (format) {
      case "csv":
        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="route-${id}.csv"`
        );
        res.send(convertRouteToCSV(route));
        break;
      case "pdf":
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="route-${id}.pdf"`
        );
        // TODO: Implement PDF generation
        res.json({ message: "PDF export not yet implemented" });
        break;
      default:
        res.json(route);
    }
  } catch (error) {
    res.status(500).json({
      message: "Error exporting route",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function createTemplate(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { name, description, optimizationSettings, tags } = req.body;

    const template = await Route.create({
      name,
      description,
      agentId: req.user!.sub,
      date: new Date(),
      stops: [],
      isTemplate: true,
      templateName: name,
      optimizationSettings: optimizationSettings || {},
      tags: tags || [],
      analytics: {
        totalStops: 0,
        completedStops: 0,
        skippedStops: 0,
        totalDistance: 0,
        estimatedDuration: 0,
        efficiency: 0,
        completionRate: 0,
      },
    });

    // Create activity record for template creation (creates a route)
    try {
      await Activity.create({
        agentId: req.user!.sub,
        activityType: 'ROUTE_OPERATION',
        zoneId: template.zoneId || null,
        operationType: 'CREATE',
        startedAt: new Date(), // Set startedAt so it counts in "Activities Today"
        notes: `Route template "${name}" created`,
      });
    } catch (activityError) {
      console.error('Error creating route template activity:', activityError);
      // Don't fail template creation if activity creation fails
    }

    res.status(201).json(template);
  } catch (error) {
    res.status(500).json({
      message: "Error creating template",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function getTemplates(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { page = 1, limit = 20 } = req.query;

    const templates = await Route.find({ isTemplate: true })
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .populate("agentId", "name email");

    const total = await Route.countDocuments({ isTemplate: true });

    res.json({
      templates,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching templates",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// Helper functions
async function optimizeRouteStops(
  properties: any[],
  startLocation?: [number, number],
  endLocation?: [number, number],
  settings: any = {}
): Promise<any[]> {
  const optimizedStops = [];
  const unvisited = [...properties];

  let currentLocation = startLocation ||
    properties[0]?.location?.coordinates || [0, 0];
  const maxStops = settings.maxStops || 50;

  while (unvisited.length > 0 && optimizedStops.length < maxStops) {
    let nearestIndex = 0;
    let minDistance = calculateDistance(
      currentLocation,
      unvisited[0]?.location?.coordinates || [0, 0]
    );

    for (let i = 1; i < unvisited.length; i++) {
      const distance = calculateDistance(
        currentLocation,
        unvisited[i]?.location?.coordinates || [0, 0]
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = i;
      }
    }

    const nearestProperty = unvisited.splice(nearestIndex, 1)[0];
    if (nearestProperty?.location?.coordinates) {
      optimizedStops.push({
        propertyId: nearestProperty._id,
        order: optimizedStops.length + 1,
        estimatedDuration: settings.estimatedDurationPerStop || 15,
        status: "PENDING",
      });

      currentLocation = nearestProperty.location.coordinates;
    }
  }

  return optimizedStops;
}

function calculateDistance(
  coord1: [number, number],
  coord2: [number, number]
): number {
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;

  // Haversine formula for distance calculation
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateTotalDistance(stops: any[], properties: any[]): number {
  let totalDistance = 0;
  const propertyMap = new Map(properties.map((p) => [p._id.toString(), p]));

  for (let i = 0; i < stops.length - 1; i++) {
    const currentProperty = propertyMap.get(stops[i].propertyId.toString());
    const nextProperty = propertyMap.get(stops[i + 1].propertyId.toString());

    if (
      currentProperty?.location?.coordinates &&
      nextProperty?.location?.coordinates
    ) {
      totalDistance += calculateDistance(
        currentProperty.location.coordinates,
        nextProperty.location.coordinates
      );
    }
  }

  return Math.round(totalDistance * 100) / 100; // Round to 2 decimal places
}

function convertRouteToCSV(route: any): string {
  const headers = [
    "Order",
    "Address",
    "City",
    "State",
    "ZIP",
    "Property Type",
    "Lead Score",
    "Status",
    "Estimated Duration",
  ];
  const rows = route.stops.map((stop: any, index: number) => [
    index + 1,
    stop.propertyId?.address || "",
    stop.propertyId?.city || "",
    stop.propertyId?.state || "",
    stop.propertyId?.zipCode || "",
    stop.propertyId?.propertyType || "",
    stop.propertyId?.leadScore || "",
    stop.status || "PENDING",
    stop.estimatedDuration || 15,
  ]);

  return [headers, ...rows].map((row) => row.join(",")).join("\n");
}
