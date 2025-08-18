import { body } from 'express-validator';

export const createAssignmentValidation = [
  body('zoneId')
    .isMongoId()
    .withMessage('Zone ID must be a valid MongoDB ObjectId'),
  body('effectiveFrom')
    .isISO8601()
    .withMessage('Effective from date must be a valid ISO 8601 date'),
  body()
    .custom((value, { req }) => {
      // Either agentId or teamId must be provided, but not both
      const hasAgentId = req.body.agentId;
      const hasTeamId = req.body.teamId;
      
      if (!hasAgentId && !hasTeamId) {
        throw new Error('Either agentId or teamId must be provided');
      }
      
      if (hasAgentId && hasTeamId) {
        throw new Error('Cannot provide both agentId and teamId');
      }
      
      return true;
    })
    .withMessage('Invalid assignment data'),
  body('agentId')
    .optional()
    .isMongoId()
    .withMessage('Agent ID must be a valid MongoDB ObjectId'),
  body('teamId')
    .optional()
    .isMongoId()
    .withMessage('Team ID must be a valid MongoDB ObjectId'),
];
