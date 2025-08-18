# Production Setup Guide

This guide will help you set up all the production-ready features for the KnockWise application.

## 1. Email Service Setup (SendGrid)

### Step 1: Create SendGrid Account
1. Go to [SendGrid](https://sendgrid.com/) and create an account
2. Verify your domain or use a single sender verification
3. Create an API key with "Mail Send" permissions

### Step 2: Configure Environment Variables
Add these to your `.env` file:

```env
# Email Configuration
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
FRONTEND_URL=https://yourdomain.com
```

### Step 3: Test Email Service
The email service will automatically fall back to console logging if SendGrid is not configured.

## 2. Socket.IO Setup

### Step 1: Frontend Configuration
The Socket.IO client is already configured in the frontend. Make sure to update the socket URL in `hooks/useSocket.ts` for production:

```typescript
const socket = io('https://your-backend-domain.com', {
  auth: { token },
  transports: ['websocket', 'polling']
});
```

### Step 2: Backend Configuration
Socket.IO is automatically initialized when the server starts. The service includes:
- Authentication middleware
- User and team room management
- Real-time notifications

## 3. Timezone Support

### Step 1: User Timezone Configuration
Users can set their preferred timezone in their profile. The system will:
- Store timezone preference in the user model
- Convert all dates to the user's timezone for display
- Store all dates in UTC in the database

### Step 2: Frontend Timezone Handling
Update the frontend to use the user's timezone:

```typescript
import { TimezoneService } from '@/lib/timezoneService';

// Get user's timezone
const userTimezone = user.timezone || TimezoneService.getUserTimezone();

// Format dates for display
const formattedDate = TimezoneService.formatForDisplay(date, userTimezone);
```

## 4. Assignment Management UI

### Step 1: Add to Navigation
Add the scheduled assignments page to your navigation:

```typescript
// In your navigation component
{
  name: 'Scheduled Assignments',
  href: '/scheduled-assignments',
  icon: Clock
}
```

### Step 2: Create Route
Create a new page for scheduled assignments:

```typescript
// app/(Admin)/scheduled-assignments/page.tsx
import ScheduledAssignments from '@/components/scheduled-assignments';

export default function ScheduledAssignmentsPage() {
  return <ScheduledAssignments />;
}
```

## 5. Backend API Endpoints

### Step 1: Add Scheduled Assignment Routes
Add these routes to your assignment routes:

```typescript
// routes/assignment.routes.ts
router.get('/scheduled', authMiddleware, getScheduledAssignments);
router.put('/scheduled/:id/cancel', authMiddleware, cancelScheduledAssignment);
```

### Step 2: Add Controller Methods
Add these methods to your assignment controller:

```typescript
// controllers/assignment.controller.ts
export async function getScheduledAssignments(req: AuthRequest, res: Response) {
  try {
    const currentUserId = req.user!.sub;
    const assignments = await ScheduledAssignmentService.getScheduledAssignments({
      assignedBy: currentUserId
    });
    
    res.json({
      success: true,
      data: assignments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching scheduled assignments'
    });
  }
}

export async function cancelScheduledAssignment(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const currentUserId = req.user!.sub;
    
    const assignment = await ScheduledAssignmentService.cancelScheduledAssignment(id);
    
    res.json({
      success: true,
      message: 'Assignment cancelled successfully',
      data: assignment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error cancelling assignment'
    });
  }
}
```

## 6. Environment Variables

Create a `.env` file with all required variables:

```env
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/knockwise

# JWT Configuration
JWT_ACCESS_SECRET=your_jwt_access_secret_here
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your_jwt_refresh_secret_here
REFRESH_EXPIRES_IN=30d

# Security Configuration
BCRYPT_SALT_ROUNDS=10
COOKIE_SECRET=your_cookie_secret_here
COOKIE_MAX_AGE=2592000000

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=200

# Email Configuration (SendGrid)
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Frontend URL for email links
FRONTEND_URL=http://localhost:3000

# Server Configuration
PORT=4000
NODE_ENV=development
```

## 7. Production Deployment

### Step 1: Build the Application
```bash
# Backend
npm run build

# Frontend
npm run build
```

### Step 2: Set Production Environment Variables
```env
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com
FRONTEND_URL=https://yourdomain.com
SENDGRID_API_KEY=your_production_sendgrid_key
```

### Step 3: Database Migration
Run the database migration to update existing teams:

```bash
npx ts-node src/scripts/migrate-team-superadmin.ts
```

## 8. Testing the System

### Test Email Notifications
1. Create a scheduled assignment with a future date
2. Check console logs for email notifications (if SendGrid not configured)
3. Configure SendGrid and test actual email delivery

### Test Socket Notifications
1. Open multiple browser tabs with different users
2. Create assignments and verify real-time notifications
3. Test team notifications by joining team rooms

### Test Timezone Support
1. Set different timezones for users
2. Create assignments and verify correct timezone display
3. Test scheduling across different timezones

## 9. Monitoring and Maintenance

### Cron Job Monitoring
The system runs a cron job every 5 minutes to check for scheduled assignments. Monitor the logs for:
- Assignment activations
- Email delivery status
- Socket notification delivery

### Database Monitoring
Monitor the following collections:
- `scheduledassignments` - Pending and activated assignments
- `agentzoneassignments` - Active assignments
- `users` - User timezone preferences

### Email Delivery Monitoring
If using SendGrid:
- Monitor email delivery rates
- Set up webhooks for delivery status
- Configure bounce handling

## 10. Security Considerations

### API Security
- All endpoints are protected with JWT authentication
- Rate limiting is enabled
- CORS is properly configured

### Email Security
- Use SendGrid's domain authentication
- Implement SPF, DKIM, and DMARC records
- Monitor for email abuse

### Socket Security
- Socket connections require valid JWT tokens
- Users can only access their own notifications
- Team notifications are restricted to team members

## 11. Troubleshooting

### Common Issues

1. **Emails not sending**: Check SendGrid API key and domain verification
2. **Socket connection failed**: Verify CORS configuration and token validity
3. **Timezone issues**: Ensure timezone strings are valid IANA timezone identifiers
4. **Assignment not activating**: Check cron job logs and database connectivity

### Debug Commands
```bash
# Check cron job status
tail -f logs/cron.log

# Monitor socket connections
tail -f logs/socket.log

# Check email delivery
tail -f logs/email.log
```

This setup provides a complete production-ready system with email notifications, real-time updates, timezone support, and comprehensive assignment management.
