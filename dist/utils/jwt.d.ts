export interface JwtPayloadBase {
    sub: string;
    role: string;
}
export declare function signAccessToken(payload: JwtPayloadBase): string;
export declare function verifyAccessToken<T extends object = JwtPayloadBase>(token: string): T;
export declare function signRefreshToken(payload: JwtPayloadBase): string;
export declare function verifyRefreshToken<T extends object = JwtPayloadBase>(token: string): T;
//# sourceMappingURL=jwt.d.ts.map