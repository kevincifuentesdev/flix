import test, { describe } from "node:test";
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

describe("Flix E2E Full Functional Flow (Browser -> Next.js Proxy -> Express -> PostgreSQL)", () => {
  const uniqueEmail = `e2e-${Date.now()}-${Math.floor(Math.random() * 1000)}@flix.test`;
  const password = "Password123!";
  let sessionCookie = "";
  let playableTmdbId = null;

  test("1. Public pages and unauthenticated error handling (401 & redirect)", async () => {
    const loginPage = await apiFetch("/login");
    assert.equal(loginPage.status, 200, "GET /login should return 200");

    const protectedPage = await apiFetch("/home");
    assert.equal(protectedPage.status, 307, "Unauthenticated /home should redirect");
    assert.match(protectedPage.headers.get("location") || "", /\/login/);

    const unauthApi = await apiFetch("/api/my-list");
    assert.equal(unauthApi.status, 401, "Unauthenticated /api/my-list should return 401");
  });

  test("2. User registration via Better Auth proxy creates user, session cookie, and default profile", async () => {
    const res = await apiFetch("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify({
        name: "E2E Test User",
        email: uniqueEmail,
        password,
      }),
    });

    assert.equal(res.status, 200, "Sign up should succeed with 200");
    sessionCookie = extractCookies(res);
    assert.ok(sessionCookie.includes("better-auth.session_token"), "Session cookie must be set");

    const profileRes = await apiFetch("/api/profile/me", {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(profileRes.status, 200, "GET /api/profile/me should return 200");
    const profile = await profileRes.json();
    assert.equal(profile.displayName, "E2E Test User");
    assert.equal(profile.region, "US");
  });

  test("3. Sign out and sign in with valid & invalid credentials", async () => {
    const badLogin = await apiFetch("/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify({ email: uniqueEmail, password: "WrongPassword!" }),
    });
    assert.ok(badLogin.status >= 400 && badLogin.status < 500, "Invalid password should fail with 4xx");

    const goodLogin = await apiFetch("/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify({ email: uniqueEmail, password }),
    });
    assert.equal(goodLogin.status, 200, "Valid sign-in should return 200");
    const newCookie = extractCookies(goodLogin);
    if (newCookie) sessionCookie = newCookie;
  });

  test("4. Profile settings and region persist across requests", async () => {
    const patchSettings = await apiFetch("/api/profile/settings", {
      method: "PATCH",
      headers: { Cookie: sessionCookie },
      body: JSON.stringify({ language: "es", maturityRating: "PG-13", isKids: false }),
    });
    assert.equal(patchSettings.status, 200);

    const patchRegion = await apiFetch("/api/profile/region", {
      method: "PATCH",
      headers: { Cookie: sessionCookie },
      body: JSON.stringify({ region: "CO" }),
    });
    assert.equal(patchRegion.status, 200);

    const profileRes = await apiFetch("/api/profile/me", {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(profileRes.status, 200);
    const profile = await profileRes.json();
    assert.equal(profile.language, "es");
    assert.equal(profile.maturityRating, "PG-13");
    assert.equal(profile.region, "CO");
  });

  test("5. TMDB catalog endpoints return trending and search results", async () => {
    const trendingRes = await apiFetch("/api/tmdb/trending?language=es-ES", {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(trendingRes.status, 200);
    const trending = await trendingRes.json();
    const results = trending.results || trending.data?.results || [];
    assert.ok(Array.isArray(results) && results.length > 0, "TMDB trending should return items");

    const searchRes = await apiFetch("/api/tmdb/search?query=Inception", {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(searchRes.status, 200);
  });

  test("6. My List add, persist, and remove flow", async () => {
    const tmdbId = 550;
    const toggleAdd = await apiFetch("/api/my-list/toggle", {
      method: "POST",
      headers: { Cookie: sessionCookie },
      body: JSON.stringify({ tmdbId, mediaType: "movie" }),
    });
    assert.equal(toggleAdd.status, 200);
    const addBody = await toggleAdd.json();
    assert.equal(addBody.added, true);

    const listRes = await apiFetch("/api/my-list", {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(listRes.status, 200);
    const items = await listRes.json();
    assert.ok(items.some((item) => Number(item.tmdbId) === tmdbId), "Movie should persist in My List");

    const toggleRemove = await apiFetch("/api/my-list/toggle", {
      method: "POST",
      headers: { Cookie: sessionCookie },
      body: JSON.stringify({ tmdbId, mediaType: "movie" }),
    });
    assert.equal(toggleRemove.status, 200);
    const removeBody = await toggleRemove.json();
    assert.equal(removeBody.added, false);
  });

  test("7. Dislikes toggle and check flow", async () => {
    const tmdbId = 680;
    const toggleRes = await apiFetch("/api/dislikes/toggle", {
      method: "POST",
      headers: { Cookie: sessionCookie },
      body: JSON.stringify({ tmdbId, mediaType: "movie" }),
    });
    assert.equal(toggleRes.status, 200);

    const checkRes = await apiFetch(`/api/dislikes/check?tmdbId=${tmdbId}&mediaType=movie`, {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(checkRes.status, 200);
    const checkBody = await checkRes.json();
    assert.equal(checkBody.disliked, true);
  });

  test("8. Playable catalog, Mux stream resolution, and Watch History persistence", async () => {
    const moviesRes = await apiFetch("/api/movies", {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(moviesRes.status, 200);
    const moviesPayload = await moviesRes.json();
    const movies = moviesPayload.data || moviesPayload;
    assert.ok(Array.isArray(movies) && movies.length > 0, "Should have seeded playable movies");
    playableTmdbId = movies[0].tmdbId;

    const streamRes = await apiFetch(`/api/movies/${playableTmdbId}/stream`, {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(streamRes.status, 200);
    const stream = await streamRes.json();
    assert.ok(stream.muxPlaybackId, "Stream response must include muxPlaybackId");

    const progressRes = await apiFetch("/api/watch-history/update-progress", {
      method: "POST",
      headers: { Cookie: sessionCookie },
      body: JSON.stringify({
        tmdbId: playableTmdbId,
        mediaType: "movie",
        title: "E2E Playable Movie",
        progressSeconds: 95,
        durationSeconds: 3600,
      }),
    });
    assert.equal(progressRes.status, 200);

    const historyRes = await apiFetch("/api/watch-history", {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(historyRes.status, 200);
    const history = await historyRes.json();
    assert.ok(
      history.some((h) => Number(h.tmdbId) === Number(playableTmdbId) && h.progressSeconds === 95),
      "Watch progress should persist in watch_history",
    );
  });

  test("9. Handled error scenarios: 404 non-playable title and 403 non-admin route", async () => {
    const notFoundStream = await apiFetch("/api/movies/99999999/stream", {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(notFoundStream.status, 404, "Missing playable content should return 404");

    const adminForbidden = await apiFetch("/api/admin/users", {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(adminForbidden.status, 403, "Standard user accessing /api/admin/users should return 403");
  });
});
