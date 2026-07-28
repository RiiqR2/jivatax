export interface RefreshTokenPayload {
  sub: string;
  type: "refresh";
  sessionId: string;
  jti: string;
}
