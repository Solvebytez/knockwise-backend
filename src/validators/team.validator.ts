import { body, oneOf } from 'express-validator';

export const createTeamValidation = [
  body('name')
    .isString()
    .isLength({ min: 2, max: 100 })
    .withMessage('Team name must be between 2 and 100 characters long')
    .trim(),
  
  body('description')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters')
    .trim(),
  
  oneOf([
    body('memberIds').isArray({ min: 1 }),
    body('agentIds').isArray({ min: 1 })
  ]),
  
  body('memberIds')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one team member is required'),
  
  body('memberIds.*')
    .optional()
    .isMongoId()
    .withMessage('Each member ID must be a valid MongoDB ObjectId'),

  body('agentIds')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one team member is required'),
  
  body('agentIds.*')
    .optional()
    .isMongoId()
    .withMessage('Each member ID must be a valid MongoDB ObjectId'),
];

export const updateTeamValidation = [
  body('name')
    .optional()
    .isString()
    .isLength({ min: 2, max: 100 })
    .withMessage('Team name must be between 2 and 100 characters long')
    .trim(),
  
  body('description')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters')
    .trim(),
  
  body('memberIds')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one team member is required'),
  
  body('memberIds.*')
    .optional()
    .isMongoId()
    .withMessage('Each member ID must be a valid MongoDB ObjectId'),

  body('agentIds')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one team member is required'),
  
  body('agentIds.*')
    .optional()
    .isMongoId()
    .withMessage('Each member ID must be a valid MongoDB ObjectId'),
];
