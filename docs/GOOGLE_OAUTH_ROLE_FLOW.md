# Google OAuth / SSO and Role Assignment

## Purpose

This document describes the Google sign-in flow in Quiz App, how the frontend requests a role, how the backend decides which role the account receives, how a session is returned, and which authorization checks protect the API.

**Source of truth:** the Spring Boot backend. The frontend role choice is a request/context value, not proof of authorization.

## Components

| Component | Responsibility |
|---|---|
| `frontend/src/app/login/page.tsx` | Lets the user choose Student or Instructor and starts Google sign-in. |
| `frontend/src/lib/api/endpoints.ts` | Defines `/oauth2/authorization/google` and `/api/v1/auth/me`. |
| `backend/.../config/SecurityConfig.java` | Enables OAuth2 login when `app.auth.oauth2-enabled=true`; protects student and teacher routes by role. |
| `backend/.../security/RoleAwareOAuth2AuthorizationRequestResolver.java` | Validates the requested role and binds it into OAuth state. Online profile only. |
| `backend/.../security/OAuth2AuthenticationSuccessHandler.java` | Validates Google identity, finds/creates the application user, checks role consistency, issues a JWT, and redirects to the frontend. Online profile only. |
| `frontend/src/app/oauth/callback/page.tsx` | Reads the callback result, calls `/api/v1/auth/me`, persists the session, and routes by the backend-returned role. |
| `backend/.../security/JwtAuthenticationFilter.java` and method/security rules | Authenticate subsequent API requests and enforce backend permissions. |

## End-to-end flow

1. **Role selection.** The user opens `/login` and selects Student or Instructor. The login page maps this to `STUDENT` or `TEACHER`. The optional `redirect` value is retained for post-login navigation.
2. **Start Google login.** The frontend stores the selected role in session storage as `dynoquizz_google_role` and navigates the browser to:
   ```text
   GET {NEXT_PUBLIC_API_URL}/oauth2/authorization/google?role=STUDENT
   ```
   The role is `TEACHER` for the instructor flow. Google sign-in is hidden/disabled in LAN exam mode.
3. **Backend validates the requested role.** The online-profile `RoleAwareOAuth2AuthorizationRequestResolver` accepts only `STUDENT` or `TEACHER`, normalizes case, and embeds the role alongside the original OAuth state. Missing or unsupported roles are rejected. The original state remains part of the value so the OAuth callback can be correlated with the authorization request.
4. **Google authenticates the person.** Spring Security handles the Google OpenID Connect authorization-code flow using the configured client registration and redirect URI. Google returns identity claims to the backend callback.
5. **Backend validates the Google identity.** The success handler requires `email_verified=true`, plus an email, subject, and issuer. The stable provider identity is looked up by `issuer + subject`; email alone is not used to silently link an existing account.
6. **Backend resolves the account and role.**
   - If the Google identity is already linked, the existing application user's stored role is authoritative. If it differs from the requested role, the backend rejects login with `ROLE_MISMATCH`. The role is not changed during sign-in.
   - If the identity is not linked but the normalized email already belongs to an application account, the backend rejects the attempt with `SSO_EMAIL_ALREADY_EXISTS`. Automatic linking is intentionally not performed.
   - If neither identity nor email exists, the backend creates a user with the requested role fetched from the database's role table. The current handler sets the account as active and verified, sets auth provider to `GOOGLE`, stores the Google subject, and leaves `registrationNo` null. The provider identity is then saved against the user.
7. **Backend issues a JWT.** On success, the handler creates the existing `AuthResponse` containing the JWT, expiry, and user summary.
8. **Redirect to the frontend callback.** The current success handler redirects to the configured frontend origin at `/oauth/callback` and places the JWT and expiry in the URL fragment (`#token=...`). URL fragments are not sent to the frontend web server in the HTTP request. The callback removes query/hash data from the visible URL as soon as it processes the result.
9. **Frontend confirms backend status.** The callback calls `GET /api/v1/auth/me` with the JWT. It takes the role from this backend response, rejects invalid roles and role mismatch against the stored selection, and rejects an account explicitly returned as inactive.
10. **Frontend persists the session and routes.** The callback stores the token, user summary, and normalized backend role in browser storage and writes the token cookie used by the app. If `profileComplete === false`, the user is sent to `/settings?profile=complete`; otherwise a safe saved redirect is used, or the role's default dashboard:
    - `TEACHER` → `/dashboard/teacher`
    - `STUDENT` → `/dashboard/student`

## Role assignment and authorization rules

### New Google account

The role is selected before redirecting to Google, but it is assigned only by the backend after Google identity validation. The backend looks up the matching `Role` record by name and persists it on the new `User`.

### Existing Google-linked account

The persisted role cannot be changed by choosing a different login option. The requested role must match the stored backend role or login is rejected.

### Existing email with no Google identity link

The backend returns `SSO_EMAIL_ALREADY_EXISTS`. The current implementation does not automatically connect Google to a password-based account. Account linking, if desired in the future, should require an authenticated linking flow.

### API authorization

The backend is responsible for enforcing permissions on every request; hiding a dashboard or setting `dynoquizz_role` in browser storage is not a security boundary. The current security configuration includes:
- `/api/v1/student/**` → requires `ROLE_STUDENT`
- `/api/v1/teacher/**` → requires `ROLE_TEACHER`
- Other non-public routes → require authentication unless a more specific rule applies.

The JWT filter and backend authorization rules must remain authoritative. Never trust a role supplied only by the browser.

## Current behavior and policy gaps to be aware of

These are important implementation details, not assumptions:

1. **No teacher approval gate is visible in the current OAuth success handler.** A previously unseen Google account that selects `TEACHER` is currently created with the `TEACHER` role and `active=true`. If instructors must be approved by an administrator or matched against an allowlist, add that policy in the backend before issuing a JWT. Do not rely on frontend role selection to enforce it.
2. **Student onboarding may be incomplete after OAuth.** New SSO users have `registrationNo=null`; the callback routes users to profile completion only if the `/api/v1/auth/me` response reports `profileComplete=false`. Confirm that backend profile-completion logic correctly marks new student accounts incomplete.
3. **OAuth code exchange is not the current success-handler response.** The frontend callback supports a `code` result and calls `/api/v1/auth/oauth2/exchange` if one is returned, but the current backend success handler sends a JWT in the URL fragment. Do not assume the exchange endpoint is active merely because it appears in the frontend endpoint map. A short-lived, single-use exchange code would be preferable to redirecting a JWT, and should be implemented end-to-end before changing the callback contract.
4. **OAuth components are online-profile scoped.** Both the custom authorization resolver and success handler use `@Profile("online")`. OAuth must be enabled with the online Spring profile and `app.auth.oauth2-enabled=true`; otherwise these components are not available.
5. **Frontend role and redirect storage are temporary UX state only.** The role stored in session storage helps the callback detect a mismatch, but the backend must independently validate the role and identity as described above.
6. **Use an allowlisted production frontend origin.** The success handler builds the callback from `app.frontend-url` and rejects invalid origins; do not derive redirect destinations from user-controlled query parameters.

## Configuration checklist

### Spring Boot online profile

Configure these values in the deployment environment; do not commit real secrets:

| Property / environment variable | Purpose |
|---|---|
| `SPRING_PROFILES_ACTIVE=online` (or equivalent profile activation) | Loads online-profile OAuth components and properties. |
| `app.auth.oauth2-enabled=true` | Enables OAuth2 login in `SecurityConfig`. Set in `application-online.properties`. |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID. |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret; keep it backend-only. |
| `GOOGLE_REDIRECT_URI` | Backend OAuth callback URI registered with Google; must match the deployed backend URL and Google Console configuration. |
| `app.frontend-url` | Frontend origin only, e.g. `https://quiz.example.com`; backend appends `/oauth/callback`. Do not include a path, query, or fragment. |
| `NEXT_PUBLIC_API_URL` | Frontend-visible base URL of the backend, e.g. `https://api.example.com`. |

The online properties request Google scopes `openid`, `profile`, and `email`, and use the `authorization_code` grant.

### Google Cloud Console

1. Configure the OAuth consent screen and required audience/test users for the deployment.
2. Create/use a Web application OAuth client.
3. Register the exact backend callback URL represented by `GOOGLE_REDIRECT_URI` as an authorized redirect URI.
4. Use HTTPS in production and make sure the configured frontend origin is the intended production origin.
5. Keep the client secret in backend environment configuration only.

## Failure cases and expected outcomes

| Condition | Expected behavior |
|---|---|
| Missing/invalid requested role | OAuth authorization request rejected. |
| Google email is not verified | `SSO_EMAIL_NOT_VERIFIED`. |
| Google identity claims are incomplete | `SSO_IDENTITY_INVALID`. |
| Linked Google account role differs from selected role | `ROLE_MISMATCH`; user should select the correct login role. |
| Email exists but Google identity is not linked | `SSO_EMAIL_ALREADY_EXISTS`; use the existing account. |
| Role record missing in database for a new user | Account creation fails; backend logs the processing error. |
| Frontend origin is missing/invalid | Success redirect cannot be completed; configure `app.frontend-url`. |
| Backend `/api/v1/auth/me` rejects the JWT | Frontend callback clears the incomplete OAuth session and displays an error. |

## Verification checklist

- [ ] Google login is available only in the online deployment, not LAN exam mode.
- [ ] Student selection sends `role=STUDENT`; Instructor selection sends `role=TEACHER`.
- [ ] Missing and invalid role values are rejected by the backend.
- [ ] A new Student account receives the Student role from the database role table.
- [ ] A new Instructor account follows the intended instructor-registration/approval policy.
- [ ] Existing linked accounts cannot change roles by choosing a different login option.
- [ ] Existing email accounts are not silently linked to Google.
- [ ] The callback fetches `/api/v1/auth/me` and uses its role, not browser-provided role data, for navigation.
- [ ] Student endpoints reject Teacher JWTs, and Teacher endpoints reject Student JWTs.
- [ ] Expired/invalid JWTs are rejected and the frontend does not retain a partial session.
- [ ] Google redirect URI and `app.frontend-url` match the deployed origins.
- [ ] If moving to code exchange, backend endpoint, single-use code storage/expiry, callback contract, and tests are implemented together.

## Relevant source files

- `backend/src/main/java/com/quiz_app/backend/config/SecurityConfig.java`
- `backend/src/main/java/com/quiz_app/backend/security/RoleAwareOAuth2AuthorizationRequestResolver.java`
- `backend/src/main/java/com/quiz_app/backend/security/OAuth2AuthenticationSuccessHandler.java`
- `backend/src/main/resources/application-online.properties`
- `frontend/src/app/login/page.tsx`
- `frontend/src/app/oauth/callback/page.tsx`
- `frontend/src/lib/api/endpoints.ts`
