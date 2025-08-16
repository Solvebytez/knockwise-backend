import { NextFunction, Request, Response } from 'express';
import { validationResult } from 'express-validator';

export function validate(rules: any[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    for (const rule of rules) {
      // eslint-disable-next-line no-await-in-loop
      await rule.run(req);
    }
    console.log('req.body', req.body)
    const result = validationResult(req);
    if (result.isEmpty()) return next();
    
    console.log('Validation errors:', result.array());
    res.status(422).json({ 
      success: false,
      message: 'Validation failed',
      errors: result.array() 
    });
  };
}


