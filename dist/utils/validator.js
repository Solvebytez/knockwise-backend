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
        const result = (0, express_validator_1.validationResult)(req);
        if (result.isEmpty())
            return next();
        res.status(422).json({ errors: result.array() });
    };
}
//# sourceMappingURL=validator.js.map