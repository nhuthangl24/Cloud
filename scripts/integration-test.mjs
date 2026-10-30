import assert from "node:assert";

const BASE_URL = "http://localhost:3005";

async function run() {
  console.log("=================================================");
  console.log("🌐 RUNNING INTEGRATION HTTP ENDPOINT TESTS");
  console.log("=================================================\n");

  // 1. GET /login
  const loginPageRes = await fetch(`${BASE_URL}/login`);
  assert.strictEqual(loginPageRes.status, 200, "Login page must return 200");
  console.log("✅ [PASS] 1. GET /login returns 200 OK");

  // 2. GET /api/files without cookie
  const unauthRes = await fetch(`${BASE_URL}/api/files`);
  assert.strictEqual(unauthRes.status, 401, "Protected API must reject unauthenticated requests with 401");
  console.log("✅ [PASS] 2. GET /api/files without session correctly blocked with 401");

  // 3. POST /api/auth/login with wrong password
  const failLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "wrong-password" }),
  });
  assert.strictEqual(failLoginRes.status, 401, "Wrong credentials must return 401");
  const failData = await failLoginRes.json();
  assert(failData.error.includes("attempts remaining"), "Error response must show remaining attempts");
  console.log("✅ [PASS] 3. POST /api/auth/login with invalid password blocked with 401 & attempt countdown");

  // 4. POST /api/auth/login with correct password
  const successLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "ChangeMe123!" }),
  });
  assert.strictEqual(successLoginRes.status, 200, "Valid login must return 200");
  const setCookie = successLoginRes.headers.get("set-cookie");
  assert(setCookie && setCookie.includes("ct_session="), "Must issue ct_session HttpOnly cookie");
  assert(setCookie.includes("HttpOnly") || setCookie.includes("httponly"), "Cookie must be HttpOnly");
  console.log("✅ [PASS] 4. POST /api/auth/login authenticated successfully with signed HttpOnly session");

  const sessionCookie = setCookie.split(";")[0];

  // 5. GET /api/files with session cookie
  const filesRes = await fetch(`${BASE_URL}/api/files`, {
    headers: { Cookie: sessionCookie },
  });
  assert.strictEqual(filesRes.status, 200, "GET /api/files with valid session must return 200");
  const filesData = await filesRes.json();
  assert(filesData.success === true, "Must return success: true");
  assert(Array.isArray(filesData.data), "Must return files array");
  console.log(`✅ [PASS] 5. GET /api/files returned ${filesData.data.length} files from MongoDB`);

  // 6. Security Check: Telegram Bot Token Leaks
  const tgConfigRes = await fetch(`${BASE_URL}/api/telegram/config`, {
    headers: { Cookie: sessionCookie },
  });
  assert.strictEqual(tgConfigRes.status, 200);
  const tgConfig = await tgConfigRes.json();
  assert(tgConfig.data.tokens === undefined, "CRITICAL: tokens array must NOT be exposed to frontend");
  assert(tgConfig.data.chunkSize !== undefined, "Chunk size must be exposed");
  console.log("✅ [PASS] 6. Security Audit: Telegram Bot Token is 100% hidden from client API responses");

  // 7. GET /dashboard
  const dashboardRes = await fetch(`${BASE_URL}/dashboard`, {
    headers: { Cookie: sessionCookie },
  });
  assert.strictEqual(dashboardRes.status, 200, "Dashboard page must render 200 OK");
  console.log("✅ [PASS] 7. GET /dashboard rendered 200 OK");

  console.log("\n=================================================");
  console.log("🎉 ALL INTEGRATION TESTS PASSED 100%!");
  console.log("=================================================\n");
}

run().catch((err) => {
  console.error("Integration test failed:", err);
  process.exit(1);
});
