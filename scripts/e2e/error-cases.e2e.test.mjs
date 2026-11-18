import test, { before, describe } from "node:test";
import assert from "node:assert/strict";

const BASE_URL = (process.env.E2E_BASE_URL || "http://localhost:5173").replace(/\/+$/, "");

function extractCookies(res) {
  const raw = res.headers.getSetCookie
    ? res.headers.getSetCookie()
    : [res.headers.get("set-cookie")].filter(Boolean);
  return raw.map((c) => c.split(";")[0]).join("; ");
}

async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Origin")) {
    headers.set("Origin", BASE_URL);
  }
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    redirect: options.redirect || "manual",
  });
}

let sessionCookie = "";
const testEmail = `e2e-err-${Date.now()}-${Math.floor(Math.random() * 1000)}@flix.test`;
const testPassword = "Password123!";

before(async () => {
  const res = await apiFetch("/api/auth/sign-up/email", {
    method: "POST",
    body: JSON.stringify({
      name: "E2E Error Suite User",
      email: testEmail,
      password: testPassword,
    }),
  });
  assert.equal(res.status, 200, "Setup: user registration should succeed");
  sessionCookie = extractCookies(res);
  assert.ok(sessionCookie.includes("better-auth.session_token"), "Setup: session cookie required");
});

describe("Suite 1: Authentication & Authorization Errors (401 / 403 / Redirects)", () => {
  test("Protected frontend routes redirect unauthenticated requests to /login", async () => {
    for (const route of ["/home", "/my-list", "/profile", "/settings", "/admin"]) {
      const res = await apiFetch(route);
      assert.equal(res.status, 307, `${route} should redirect when unauthenticated`);
      assert.match(res.headers.get("location") || "", /\/login/, `${route} should redirect to /login`);
    }
  });

  test("Protected API endpoints return 401 when no session cookie is sent", async () => {
    const endpoints = [
      "/api/profile/me",
      "/api/my-list",
      "/api/watch-history",
      "/api/dislikes/check?tmdbId=550&mediaType=movie",
      "/api/admin/users",
    ];
    for (const endpoint of endpoints) {
      const res = await apiFetch(endpoint);
      assert.equal(res.status, 401, `${endpoint} should return 401 without session`);
    }
  });

  test("Duplicate email registration fails with 4xx", async () => {
    const res = await apiFetch("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify({
        name: "Duplicate User",
        email: testEmail,
        password: testPassword,
      }),
    });
    assert.ok(res.status >= 400 && res.status < 500, `Expected 4xx for duplicate email, got ${res.status}`);
  });

  test("Invalid password on sign-in returns 401/4xx without session cookie", async () => {
    const res = await apiFetch("/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify({
        email: testEmail,
        password: "DefinitelyWrongPassword!",
      }),
    });
    assert.ok(res.status >= 400 && res.status < 500, `Expected 4xx, got ${res.status}`);
    const cookie = extractCookies(res);
    assert.ok(!cookie.includes("better-auth.session_token"), "Must not issue session cookie on bad password");
  });

  test("Standard user receives 403 Forbidden on admin endpoints", async () => {
    for (const adminEndpoint of ["/api/admin/users", "/api/admin/catalog"]) {
      const res = await apiFetch(adminEndpoint, {
        headers: { Cookie: sessionCookie },
      });
      assert.equal(res.status, 403, `${adminEndpoint} should return 403 for non-admin user`);
    }
  });
});

describe("Suite 2: Input Validation Errors (400 Bad Request)", () => {
  test("PATCH /api/profile/region rejects empty or missing region", async () => {
    const emptyBody = await apiFetch("/api/profile/region", {
      method: "PATCH",
      headers: { Cookie: sessionCookie },
      body: JSON.stringify({}),
    });
    assert.equal(emptyBody.status, 400, "Missing region should return 400");

    const blankRegion = await apiFetch("/api/profile/region", {
      method: "PATCH",
      headers: { Cookie: sessionCookie },
      body: JSON.stringify({ region: "   " }),
    });
    assert.equal(blankRegion.status, 400, "Blank region should return 400");
  });

  test("POST /api/my-list/toggle rejects invalid tmdbId", async () => {
    const res = await apiFetch("/api/my-list/toggle", {
      method: "POST",
      headers: { Cookie: sessionCookie },
      body: JSON.stringify({ tmdbId: -5, mediaType: "movie" }),
    });
    assert.equal(res.status, 400, "Negative tmdbId should return 400");
  });

  test("POST /api/watch-history/update-progress rejects invalid payload", async () => {
    const res = await apiFetch("/api/watch-history/update-progress", {
      method: "POST",
      headers: { Cookie: sessionCookie },
      body: JSON.stringify({ tmdbId: "not-a-number", mediaType: "movie", progressSeconds: -10 }),
    });
    assert.equal(res.status, 400, "Invalid watch history payload should return 400");
  });

  test("GET /api/movies/invalid-id/stream rejects non-numeric tmdbId", async () => {
    const res = await apiFetch("/api/movies/not-a-number/stream", {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(res.status, 400, "Non-numeric tmdbId should return 400");
  });
});

describe("Suite 3: Not Found & Region Availability Errors (404 / Playability)", () => {
  test("GET /api/movies/99999999/stream returns 404 when title has no playable content", async () => {
    const res = await apiFetch("/api/movies/99999999/stream", {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.match(body.error || "", /No playable content/i);
  });

  test("GET /api/movies/99999999/playable reports not playable", async () => {
    const res = await apiFetch("/api/movies/99999999/playable?region=US", {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.playable, false, "Unknown tmdbId must not be playable");
  });

  test("GET /api/movies/129/playable?region=ZZ returns false for unsupported region", async () => {
    const res = await apiFetch("/api/movies/129/playable?region=ZZ", {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.playable, false, "Title should not be playable in unsupported region ZZ");
  });
});
