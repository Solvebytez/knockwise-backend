import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Resident } from '../models/Resident';
import { PropertyData } from '../models/PropertyData';
import { Zone } from '../models/Zone';
import { AgentZoneAssignment } from '../models/AgentZoneAssignment';
import { IUser } from '../models/User';

export const getResidentById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    console.log('🔍 API - Fetching resident with ID:', id);
    
    // Check if PropertyData exists in database
    const totalPropertyData = await PropertyData.countDocuments();
    console.log('🔍 API - Total PropertyData in database:', totalPropertyData);
    
    // Fetch resident with populated data
    const resident = await Resident.findById(id)
      .populate('assignedAgentId', 'name email')
      .populate('zoneId', 'name createdBy')
      .populate('propertyDataId');

    if (!resident) {
      res.status(404).json({ 
        success: false,
        message: 'Resident not found' 
      });
      return;
    }

    // Check if user has access to this resident's zone
    if (req.user?.role !== 'SUPERADMIN') {
      const zone = await Zone.findById(resident.zoneId).populate('createdBy');
      if (!zone) {
        res.status(404).json({ 
          success: false,
          message: 'Zone not found' 
        });
        return;
      }

      // Check if user has access to this zone
      const createdById = typeof zone.createdBy === 'object' && zone.createdBy._id 
        ? zone.createdBy._id.toString() 
        : zone.createdBy?.toString();
        
      const hasAccess = 
        createdById === req.user?.id || // Zone creator
        zone.assignedAgentId?.toString() === req.user?.id || // Directly assigned agent
        zone.teamId?.toString() === req.user?.primaryTeamId; // Team member

      if (!hasAccess) {
        res.status(403).json({ 
          success: false,
          message: 'Access denied to this resident' 
        });
        return;
      }
    }

    // Fetch zone details with building data
    const zone = await Zone.findById(resident.zoneId)
      .populate('assignedAgentId', 'name email')
      .populate('teamId', 'name')
      .populate('createdBy', 'name email');

    // Fetch related property data for the same zone
    const zonePropertyData = await PropertyData.find({ 
      zoneId: resident.zoneId,
      addressLine1: { $regex: new RegExp(resident.address.split(',')[0] || '', 'i') }
    }).limit(5);

    console.log('🔍 API - Zone Property Data Found:', zonePropertyData.length);
    console.log('🔍 API - Zone Property Data:', zonePropertyData);

    // Fetch property data for the specific address if not already linked
    let specificPropertyData = null;
    if (!resident.propertyDataId) {
      const addressParts = resident.address.split(',');
      const searchCriteria = {
        addressLine1: { $regex: new RegExp(addressParts[0] || '', 'i') },
        city: addressParts[1]?.trim(),
        state: addressParts[2]?.trim()
      };
      
      console.log('🔍 API - Searching for PropertyData with criteria:', searchCriteria);
      specificPropertyData = await PropertyData.findOne(searchCriteria);
      console.log('🔍 API - Specific PropertyData found:', specificPropertyData);
    }

    console.log('🔍 API - Resident PropertyDataId:', resident.propertyDataId);
    console.log('🔍 API - Specific PropertyData:', specificPropertyData);
    console.log('🔍 API - Zone PropertyData[0]:', zonePropertyData[0]);

    // If no PropertyData exists, create a sample one for testing
    if (!resident.propertyDataId && !specificPropertyData && zonePropertyData.length === 0) {
      console.log('🔍 API - No PropertyData found, creating sample data for testing');
      const samplePropertyData = new PropertyData({
        addressLine1: resident.address.split(',')[0],
        city: resident.address.split(',')[1]?.trim() || 'Toronto',
        state: resident.address.split(',')[2]?.trim() || 'ON',
        postalCode: resident.address.split(',')[3]?.trim() || 'M4L 3Y1',
        location: {
          type: 'Point',
          coordinates: resident.coordinates
        },
        zoneId: resident.zoneId,
        propertyType: 'SINGLE_FAMILY',
        bedrooms: 3,
        bathrooms: 2,
        yearBuilt: 1995,
        estimatedValue: 750000,
        leadScore: 75,
        ownerName: 'John Smith',
        ownerPhone: '+1-416-555-0123',
        dataSource: 'MANUAL'
      });
      
      await samplePropertyData.save();
      console.log('🔍 API - Created sample PropertyData:', samplePropertyData._id);
      
      // Update the resident to link to this PropertyData
      await Resident.findByIdAndUpdate(resident._id, { propertyDataId: samplePropertyData._id });
      console.log('🔍 API - Updated resident with PropertyDataId');
      
      // Update our response data
      specificPropertyData = samplePropertyData;
    }

    // Fetch other residents in the same zone
    const zoneResidents = await Resident.find({ 
      zoneId: resident.zoneId,
      _id: { $ne: resident._id } // Exclude current resident
    })
    .populate('assignedAgentId', 'name email')
    .limit(10)
    .sort({ houseNumber: 1 });

    // Determine which PropertyData to use
    const finalPropertyData = resident.propertyDataId || specificPropertyData || zonePropertyData[0] || null;
    
    console.log('🔍 API - Final PropertyData being used:', finalPropertyData);
    console.log('🔍 API - PropertyData details:', {
      yearBuilt: (finalPropertyData as any)?.yearBuilt,
      bedrooms: (finalPropertyData as any)?.bedrooms,
      leadScore: (finalPropertyData as any)?.leadScore,
      estimatedValue: (finalPropertyData as any)?.estimatedValue,
      ownerName: (finalPropertyData as any)?.ownerName,
      ownerPhone: (finalPropertyData as any)?.ownerPhone
    });

    // Prepare comprehensive response
    const responseData = {
      resident,
      zone,
      propertyData: finalPropertyData,
      zonePropertyData: zonePropertyData,
      zoneResidents,
      zoneStats: {
        totalResidents: await Resident.countDocuments({ zoneId: resident.zoneId }),
        visitedResidents: await Resident.countDocuments({ 
          zoneId: resident.zoneId, 
          status: { $in: ['visited', 'interested', 'callback', 'appointment', 'follow-up'] }
        }),
        notVisitedResidents: await Resident.countDocuments({ 
          zoneId: resident.zoneId, 
          status: 'not-visited'
        })
      },
      // Additional context data
      relatedData: {
        nearbyProperties: zonePropertyData.length,
        hasPropertyData: !!finalPropertyData,
        zoneProgress: {
          percentage: Math.round((await Resident.countDocuments({ 
            zoneId: resident.zoneId, 
            status: { $in: ['visited', 'interested', 'callback', 'appointment', 'follow-up'] }
          }) / await Resident.countDocuments({ zoneId: resident.zoneId })) * 100)
        }
      }
    };

    console.log('🔍 API - Response Data:', {
      residentId: resident._id,
      residentAddress: resident.address,
      residentStatus: resident.status,
      propertyDataFound: !!responseData.propertyData,
      zoneName: responseData.zone?.name,
      zoneStats: responseData.zoneStats
    });

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error getting resident by ID:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
}

export const updateResident = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const currentUser = req.user;

    console.log('🔄 Update Resident Request:', { id, updateData, currentUserId: currentUser?.id });

    // 1. Find the resident and populate related data
    const resident = await Resident.findById(id).populate('zoneId');
    if (!resident) {
      return res.status(404).json({
        success: false,
        message: 'Resident not found'
      });
    }

    // 2. Authorization Check
    const zone = await Zone.findById(resident.zoneId).populate('createdBy');
    if (!zone) {
      return res.status(404).json({
        success: false,
        message: 'Zone not found'
      });
    }

    // Check if user has permission to edit this resident
    const hasPermission = await checkEditPermission(currentUser, zone);
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to edit this resident'
      });
    }

    // 3. Business Logic Validation
    const validationError = validateResidentUpdate(updateData);
    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    // 4. Update the resident
    const updatedResident = await Resident.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).populate('zoneId assignedAgentId propertyDataId');

    console.log('✅ Resident updated successfully:', updatedResident?._id);

    // 5. Update PropertyData if owner information is provided
    let updatedPropertyData = null;
    const ownerFields = ['ownerName', 'ownerPhone', 'ownerEmail', 'ownerMailingAddress'];
    const hasOwnerUpdates = ownerFields.some(field => updateData[field] !== undefined);
    
    if (hasOwnerUpdates && updatedResident?.propertyDataId) {
      const propertyDataUpdates: any = {};
      ownerFields.forEach(field => {
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
        console.log('✅ PropertyData updated successfully:', updatedPropertyData?._id);
      }
    }

    res.json({
      success: true,
      message: 'Resident updated successfully',
      data: {
        ...updatedResident?.toObject(),
        propertyData: updatedPropertyData || updatedResident?.propertyDataId
      }
    });

  } catch (error) {
    console.error('❌ Error updating resident:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Helper function to check edit permissions
const checkEditPermission = async (currentUser: any, zone: any): Promise<boolean> => {
  // 1. Super Admin can edit anything
  if (currentUser.role === 'SUPERADMIN') {
    console.log('✅ Super Admin permission granted');
    return true;
  }

  // 2. Zone Creator can edit
  if (zone.createdBy) {
    const createdById = typeof zone.createdBy === 'object' && zone.createdBy._id 
      ? zone.createdBy._id.toString() 
      : zone.createdBy.toString();
    
    if (createdById === currentUser.id) {
      console.log('✅ Zone Creator permission granted');
      return true;
    }
  }

  // 3. Check if user is assigned agent to this zone
  const currentAssignment = await AgentZoneAssignment.findOne({
    zoneId: zone._id,
    status: 'ACTIVE',
    $or: [
      { agentId: currentUser.id },
      { teamId: { $in: currentUser.teamIds } }
    ]
  });

  if (currentAssignment) {
    console.log('✅ Assigned Agent/Team Member permission granted');
    return true;
  }

  console.log('❌ No permission found for user:', currentUser.id);
  return false;
};

// Helper function to validate resident update
const validateResidentUpdate = (updateData: any): string | null => {
  // Check if status is being set to 'not-visited' but other info exists
  if (updateData.status === 'not-visited') {
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
      return 'Cannot set status to "Not Visited" when resident information is present. Please select a different status.';
    }
  }

  return null;
};
