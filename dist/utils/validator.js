"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
const express_validator_1 = require("express-validator");
function validate(rules) {
    return async (req, res, next) => {
        for (const rule of rules) {
            // eslint-disable-next-line no-await-in-loop
            await rule.run(req);
        }
        console.log('req.body', req.body);
        const result = (0, express_validator_1.validationResult)(req);
        if (result.isEmpty())
            return next();
        console.log('Validation errors:', result.array());
        res.status(422).json({
            success: false,
            message: 'Validation failed',
            errors: result.array()
        });
    };
}
//# sourceMappingURL=validator.js.map