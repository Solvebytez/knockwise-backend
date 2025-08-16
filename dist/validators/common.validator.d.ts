export declare const mongoIdParam: (paramName?: string) => import("express-validator").ValidationChain;
export declare const mongoIdParams: (paramNames: string[]) => import("express-validator").ValidationChain[];
export declare const paginationQueries: import("express-validator").ValidationChain[];
export declare const dateRangeQueries: import("express-validator").ValidationChain[];
export declare const locationQueries: import("express-validator").ValidationChain[];
export declare const statusQuery: (allowedStatuses: string[]) => import("express-validator").ValidationChain;
export declare const mongoIdQuery: (fieldName: string) => import("express-validator").ValidationChain;
export declare const mongoIdArrayBody: (fieldName: string) => import("express-validator").ValidationChain[];
export declare const optionalIntBody: (fieldName: string, min?: number, max?: number) => import("express-validator").ValidationChain;
export declare const optionalFloatBody: (fieldName: string, min?: number) => import("express-validator").ValidationChain;
export declare const listQueries: (additionalQueries?: any[]) => any[];
export declare const activityListQueries: import("express-validator").ValidationChain[];
export declare const teamActivityListQueries: import("express-validator").ValidationChain[];
export declare const zoneListQueries: import("express-validator").ValidationChain[];
export declare const nearbyPropertiesQueries: import("express-validator").ValidationChain[];
//# sourceMappingURL=common.validator.d.ts.map