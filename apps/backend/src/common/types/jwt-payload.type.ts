export interface JwtPayload {
  /** User ObjectId string. */
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}
