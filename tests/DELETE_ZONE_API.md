# Delete Zone/Territory API Documentation

## Overview
The delete zone API provides a comprehensive solution for completely removing a territory/zone and all its associated data from the database. This operation is atomic and uses database transactions to ensure data consistency.

## API Endpoint
```
DELETE /api/zones/delete/:id
```

## Authentication
- **Required**: Bearer token authentication
- **Roles**: SUPERADMIN, SUBADMIN

## Request Parameters
- `id` (path parameter): The MongoDB ObjectId of the zone to delete

## Response Format

### Success Response (200)
```json
{
  "success": true,
  "message": "Zone and all associated data deleted successfully"
}
```

### Error Responses

#### 404 - Zone Not Found
```json
{
  "success": false,
  "message": "Zone not found"
}
```

#### 403 - Access Denied
```json
{
  "success": false,
  "message": "Access denied to delete this zone"
}
```

#### 400 - Active Assignments Exist
```json
{
  "success": false,
  "message": "Cannot delete zone with active agent assignments. Please deactivate all assignments first."
}
```

**Note**: This error is no longer returned. Active assignments are now automatically deactivated during zone deletion.

#### 500 - Server Error
```json
{
  "success": false,
  "message": "Failed to delete zone",
  "error": "Error details"
}
```

## What Gets Deleted

The delete operation **completely removes** the following data in order:

1. **Agent Zone Assignments** - All active assignments are deactivated (status changed to 'INACTIVE' with endDate set)
2. **Scheduled Assignments** - All pending scheduled assignments for this zone are deleted
3. **Properties** - **All properties in this zone are permanently deleted**
4. **Leads** - **All leads in this zone are permanently deleted**
5. **Activities** - **All activities in this zone are permanently deleted**
6. **Routes** - **All routes in this zone are permanently deleted**
7. **Residents** - **All residents in this zone are permanently deleted**
8. **Users** - Zone references are removed from user profiles (primaryZoneId and zoneIds array)
9. **Zone** - The zone itself is finally deleted

**⚠️ Warning**: This operation permanently deletes ALL residential data associated with the zone. This action cannot be undone.

## Database Transaction Safety

The delete operation uses MongoDB transactions to ensure:
- **Atomicity**: Either all operations succeed or all fail
- **Consistency**: Database remains in a consistent state
- **Isolation**: Other operations don't see partial changes
- **Durability**: Changes are permanent once committed

## Prerequisites

Before a zone can be deleted:
1. User must have appropriate permissions (SUPERADMIN or SUBADMIN)
2. User must own the zone (for SUBADMIN users)

**Note**: Active assignments are automatically deactivated during deletion, so no manual deactivation is required.

## Frontend Integration

The frontend implements the delete functionality with:
- Confirmation dialog before deletion
- Loading state during deletion
- Success/error toast notifications
- Automatic refresh of territory list after successful deletion

## Example Usage

### Frontend (React/TypeScript)
```typescript
const confirmDelete = async () => {
  if (territoryToDelete) {
    setIsDeleting(true);
    try {
      const response = await apiInstance.delete(`/zones/delete/${territoryToDelete._id}`);
      
      if (response.data.success) {
        toast.success('Territory deleted successfully');
        refetch(); // Refresh the territories list
      } else {
        toast.error(response.data.message || 'Failed to delete territory');
      }
    } catch (error: any) {
      console.error('Error deleting territory:', error);
      const errorMessage = error.response?.data?.message || 'Failed to delete territory';
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setTerritoryToDelete(null);
    }
  }
};
```

### cURL Example
```bash
curl -X DELETE \
  http://localhost:4000/api/zones/delete/507f1f77bcf86cd799439012 \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json'
```

## Security Considerations

1. **Authentication Required**: All requests must include a valid JWT token
2. **Role-Based Access**: Only SUPERADMIN and SUBADMIN users can delete zones
3. **Ownership Validation**: SUBADMIN users can only delete zones they created
4. **Automatic Assignment Deactivation**: Active assignments are automatically deactivated during deletion
5. **Transaction Safety**: Database transactions prevent partial deletions

## Error Handling

The API provides comprehensive error handling:
- **Validation Errors**: Invalid zone ID format
- **Permission Errors**: Insufficient privileges
- **Business Logic Errors**: Active assignments exist
- **Database Errors**: Connection issues, transaction failures
- **Network Errors**: Timeout, connection refused

## Monitoring and Logging

The delete operation logs:
- Successful deletions with zone details
- Failed deletions with error reasons
- Transaction rollbacks
- Performance metrics

## Testing

To test the delete functionality:
1. Create a test zone
2. Verify it appears in the territory list
3. Click the delete button in the actions menu
4. Confirm deletion in the dialog
5. Verify the zone is removed from the list
6. Check that all associated data is properly cleaned up
