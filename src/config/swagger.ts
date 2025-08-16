import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'KnockWise API',
      version: '1.0.0',
      description: 'API documentation for KnockWise backend',
    },
    servers: [{ url: `http://localhost:${env.port}` }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
        AuthTokens: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
          },
        },
        LoginInput: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 6 },
          },
        },
        RegisterInput: {
          type: 'object',
          required: ['name', 'email', 'password', 'role'],
          properties: {
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 6 },
            role: { type: 'string', enum: ['SUPERADMIN', 'SUBADMIN', 'AGENT'] },
          },
        },
        RefreshInput: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string' },
          },
        },
        LeadStatus: {
          type: 'string',
          enum: ['NEW', 'CONTACTED', 'FOLLOW_UP', 'APPOINTMENT_SET', 'VISITED', 'NOT_INTERESTED', 'CONVERTED', 'LOST'],
        },
        Lead: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            propertyId: { type: 'string' },
            ownerName: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string' },
            notes: { type: 'string' },
            status: { $ref: '#/components/schemas/LeadStatus' },
            priority: { type: 'integer', minimum: 1, maximum: 5 },
            assignedAgentId: { type: 'string' },
            teamId: { type: 'string' },
            zoneId: { type: 'string' },
            lastActivityAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        LeadCreateInput: {
          type: 'object',
          required: ['propertyId'],
          properties: {
            propertyId: { type: 'string' },
            ownerName: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string' },
            notes: { type: 'string' },
            assignedAgentId: { type: 'string' },
            teamId: { type: 'string' },
            zoneId: { type: 'string' },
            priority: { type: 'integer', minimum: 1, maximum: 5 },
          },
        },
        AppointmentStatus: {
          type: 'string',
          enum: ['SCHEDULED', 'RESCHEDULED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'],
        },
        Appointment: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            title: { type: 'string' },
            agentId: { type: 'string' },
            createdById: { type: 'string' },
            propertyId: { type: 'string' },
            leadId: { type: 'string' },
            start: { type: 'string', format: 'date-time' },
            end: { type: 'string', format: 'date-time' },
            status: { $ref: '#/components/schemas/AppointmentStatus' },
            notes: { type: 'string' },
            teamId: { type: 'string' },
          },
        },
        AppointmentCreateInput: {
          type: 'object',
          required: ['agentId', 'start', 'end'],
          properties: {
            title: { type: 'string' },
            agentId: { type: 'string' },
            createdById: { type: 'string' },
            propertyId: { type: 'string' },
            leadId: { type: 'string' },
            start: { type: 'string', format: 'date-time' },
            end: { type: 'string', format: 'date-time' },
            status: { $ref: '#/components/schemas/AppointmentStatus' },
            notes: { type: 'string' },
            teamId: { type: 'string' },
          },
        },
        Assignment: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            agentId: { type: 'string' },
            zoneId: { type: 'string' },
            teamId: { type: 'string' },
            effectiveFrom: { type: 'string', format: 'date-time' },
            effectiveTo: { type: 'string', format: 'date-time', nullable: true },
            createdById: { type: 'string' },
          },
        },
        AssignmentCreateInput: {
          type: 'object',
          required: ['agentId', 'zoneId', 'effectiveFrom'],
          properties: {
            agentId: { type: 'string' },
            zoneId: { type: 'string' },
            effectiveFrom: { type: 'string', format: 'date-time' },
            effectiveTo: { type: 'string', format: 'date-time' },
            teamId: { type: 'string' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['src/routes/**/*.ts', 'src/models/**/*.ts'],
});

export default swaggerSpec;


