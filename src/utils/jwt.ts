import { sign, verify, Secret, SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export interface JwtPayloadBase {
  sub: string; // user id
  role: string;
}

export function signAccessToken(payload: JwtPayloadBase): string {
  const options: SignOptions = { expiresIn: env.jwtExpiresIn as unknown as number };
  return sign(payload as object, env.jwtAccessSecret as Secret, options);
}

export function verifyAccessToken<T extends object = JwtPayloadBase>(token: string): T {
  return verify(token, env.jwtAccessSecret as Secret) as T;
}

export function signRefreshToken(payload: JwtPayloadBase): string {
  const options: SignOptions = { expiresIn: env.refreshExpiresIn as unknown as number };
  return sign(payload as object, env.jwtRefreshSecret as Secret, options);
}

export function verifyRefreshToken<T extends object = JwtPayloadBase>(token: string): T {
  return verify(token, env.jwtRefreshSecret as Secret) as T;
}


