import jwt from "jsonwebtoken";

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

const SECRET = process.env.JWT_SECRET!;

export function signToken(payload: JwtPayload, rememberMe = false): string {
  return jwt.sign(payload, SECRET, {
    expiresIn: rememberMe ? "30d" : "1d",
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET) as JwtPayload;
}

export const AUTH_COOKIE = "auth_token";
