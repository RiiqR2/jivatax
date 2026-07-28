import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import type { Request, Response } from "express";
import type { Repository } from "typeorm";
import { AuthCookieService } from "./auth-cookie.service";
import { AuthService } from "./auth.service";
import type { AuthSessionEntity } from "./entities/auth-session.entity";
import type { OrganizationMemberEntity } from "../organizations/entities/organization-member.entity";
import type { UsersService } from "../users/users.service";

const accessSecret = "access-secret-with-at-least-thirty-two-bytes";
const refreshSecret = "refresh-secret-with-at-least-thirty-two-bytes";

function harness(cookies: Record<string, string>) {
  const updates: Array<{ criteria: unknown; values: unknown }> = [];
  const cleared: Array<{ name: string; options: unknown }> = [];
  const config = {
    get: (key: string, fallback?: unknown) =>
      ({
        JWT_ACCESS_SECRET: accessSecret,
        JWT_REFRESH_SECRET: refreshSecret,
      })[key] ?? fallback,
  } as ConfigService;
  const cookieService = new AuthCookieService(config);
  const jwt = {
    verifyAsync: async (
      token: string,
      options: { secret: string; ignoreExpiration?: boolean },
    ) => {
      assert.equal(options.ignoreExpiration, true);
      if (token === "expired-access" && options.secret === accessSecret)
        return { sessionId: "session-1" };
      if (token === "valid-refresh" && options.secret === refreshSecret)
        return { sessionId: "session-1" };
      throw new Error("invalid token");
    },
  } as unknown as JwtService;
  const sessions = {
    update: async (criteria: unknown, values: unknown) => {
      updates.push({ criteria, values });
    },
  } as unknown as Repository<AuthSessionEntity>;
  const service = new AuthService(
    {} as UsersService,
    jwt,
    config,
    cookieService,
    sessions,
    {} as Repository<OrganizationMemberEntity>,
  );
  const request = { cookies } as Request;
  const response = {
    clearCookie: (name: string, options: unknown) => {
      cleared.push({ name, options });
    },
  } as unknown as Response;
  return { service, request, response, updates, cleared };
}

describe("AuthService logout", () => {
  it("revokes the session identified by an expired access token and clears both cookies", async () => {
    const test = harness({ "jivatax.access": "expired-access" });
    await test.service.logout(test.request, test.response);
    assert.equal(test.updates.length, 1);
    const criteria = test.updates[0].criteria as {
      id: string;
      revokedAt: { _type: string };
    };
    assert.equal(criteria.id, "session-1");
    assert.equal(criteria.revokedAt._type, "isNull");
    assert.ok(
      (test.updates[0].values as { revokedAt: Date }).revokedAt instanceof Date,
    );
    assert.deepEqual(
      test.cleared.map(({ name }) => name),
      ["jivatax.access", "jivatax.refresh"],
    );
  });

  it("falls back to the refresh token and remains idempotent after revocation", async () => {
    const test = harness({ "jivatax.refresh": "valid-refresh" });
    await test.service.logout(test.request, test.response);
    await test.service.logout(test.request, test.response);
    assert.equal(test.updates.length, 2);
    assert.equal(test.cleared.length, 4);
  });

  it("clears cookies without exposing data when no token identifies a session", async () => {
    const test = harness({ "jivatax.access": "invalid" });
    const result = await test.service.logout(test.request, test.response);
    assert.equal(result, undefined);
    assert.equal(test.updates.length, 0);
    assert.equal(test.cleared.length, 2);
  });
});
