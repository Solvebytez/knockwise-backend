import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import PropertyData from '../models/PropertyData';
import Activity from '../models/Activity';

export async function searchProperties(req: AuthRequest, res: Response): Promise<void> {
  const {
    query,
    city,
    state,
    postalCode,
    minValue,
    maxValue,
    propertyType,
    minLeadScore,
    limit = 50,
    page = 1,
  } = req.query as any;

  const filter: any = {};

  if (query) {
    filter.$or = [
      { addressLine1: { $regex: query, $options: 'i' } },
      { ownerName: { $regex: query, $options: 'i' } },
      { mlsId: { $regex: query, $options: 'i' } },
    ];
  }

  if (city) filter.city = { $regex: city, $options: 'i' };
  if (state) filter.state = { $regex: state, $options: 'i' };
  if (postalCode) filter.postalCode = postalCode;
  if (propertyType) filter.propertyType = propertyType;

  if (minValue || maxValue) {
    filter.estimatedValue = {};
    if (minValue) filter.estimatedValue.$gte = Number(minValue);
    if (maxValue) filter.estimatedValue.$lte = Number(maxValue);
  }

  if (minLeadScore) {
    filter.leadScore = { $gte: Number(minLeadScore) };
  }

  const skip = (Number(page) - 1) * Number(limit);
  const properties = await PropertyData.find(filter)
    .sort({ leadScore: -1, estimatedValue: -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await PropertyData.countDocuments(filter);

  res.json({
    properties,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)),
    },
  });
}

export async function getPropertyById(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const property = await PropertyData.findById(id);
  if (!property) {
    res.status(404).json({ message: 'Property not found' });
    return;
  }
  res.json(property);
}

export async function bulkImportProperties(req: AuthRequest, res: Response): Promise<void> {
  const { properties } = req.body as { properties: any[] };
  
  if (!Array.isArray(properties) || properties.length === 0) {
    res.status(400).json({ message: 'Properties array is required' });
    return;
  }

  const results = {
    imported: 0,
    updated: 0,
    errors: 0,
    errorsList: [] as string[],
  };

  for (const prop of properties) {
    try {
      const existing = await PropertyData.findOne({
        addressLine1: prop.addressLine1,
        city: prop.city,
        state: prop.state,
        postalCode: prop.postalCode,
      });

      if (existing) {
        await PropertyData.findByIdAndUpdate(existing._id, {
          ...prop,
          lastUpdated: new Date(),
        });
        
        // Create activity record for property update
        try {
          await Activity.create({
            agentId: req.user!.id,
            activityType: 'PROPERTY_OPERATION',
            propertyId: existing._id,
            operationType: 'UPDATE',
            startedAt: new Date(), // Set startedAt so it counts in "Activities Today"
            notes: `Property data updated via bulk import`,
          });
        } catch (activityError) {
          console.error('Error creating property update activity:', activityError);
          // Don't fail property update if activity creation fails
        }
        
        results.updated++;
      } else {
        const newProperty = await PropertyData.create({
          ...prop,
          lastUpdated: new Date(),
        });
        
        // Create activity record for property creation
        try {
          await Activity.create({
            agentId: req.user!.id,
            activityType: 'PROPERTY_OPERATION',
            propertyId: newProperty._id,
            operationType: 'CREATE',
            startedAt: new Date(), // Set startedAt so it counts in "Activities Today"
            notes: `Property data created via bulk import`,
          });
        } catch (activityError) {
          console.error('Error creating property creation activity:', activityError);
          // Don't fail property creation if activity creation fails
        }
        
        results.imported++;
      }
    } catch (error) {
      results.errors++;
      results.errorsList.push(`Error processing ${prop.addressLine1}: ${error}`);
    }
  }

  res.json(results);
}

export async function updatePropertyScores(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { leadScore, motivationScore, equityScore } = req.body as {
    leadScore?: number;
    motivationScore?: number;
    equityScore?: number;
  };

  const property = await PropertyData.findByIdAndUpdate(
    id,
    {
      ...(leadScore !== undefined && { leadScore }),
      ...(motivationScore !== undefined && { motivationScore }),
      ...(equityScore !== undefined && { equityScore }),
      lastUpdated: new Date(),
    },
    { new: true }
  );

  if (!property) {
    res.status(404).json({ message: 'Property not found' });
    return;
  }

  // Create activity record for property score update
  try {
    const scoreChanges: string[] = [];
    if (leadScore !== undefined) scoreChanges.push(`leadScore: ${leadScore}`);
    if (motivationScore !== undefined) scoreChanges.push(`motivationScore: ${motivationScore}`);
    if (equityScore !== undefined) scoreChanges.push(`equityScore: ${equityScore}`);
    
    await Activity.create({
      agentId: req.user!.id,
      activityType: 'PROPERTY_OPERATION',
      propertyId: id,
      operationType: 'UPDATE',
      startedAt: new Date(), // Set startedAt so it counts in "Activities Today"
      notes: scoreChanges.length > 0 ? `Property scores updated: ${scoreChanges.join(', ')}` : 'Property scores updated',
    });
  } catch (activityError) {
    console.error('Error creating property score update activity:', activityError);
    // Don't fail property update if activity creation fails
  }

  res.json(property);
}
