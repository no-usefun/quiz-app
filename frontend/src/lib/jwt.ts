/**
 * JWT compatibility module.
 *
 * JWT issuance and verification are handled exclusively by the Spring Boot
 * backend. The frontend must never contain the backend JWT secret or create
 * its own JWTs.
 *
 * These exports are retained only to prevent stale imports from breaking
 * compilation during the frontend migration.
 */

/**
 * Frontend JWT signing is intentionally unsupported.
 * Use POST /api/v1/auth/login on the backend instead.
 */
export async function signJWT(
  _payload: Record<string, unknown>,
  _secret?: string,
): Promise<never> {
  throw new Error(
    "Frontend JWT signing is disabled. Authenticate through the backend API.",
  );
}

/**
 * Frontend JWT verification is intentionally unsupported.
 * Use GET /api/v1/auth/me or another authenticated backend endpoint instead.
 */
export async function verifyJWT(
  _token: string,
  _secret?: string,
): Promise<null> {
  return null;
}
