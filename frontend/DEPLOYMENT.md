# Frontend LAN and ONLINE deployment checklist

This guide covers the frontend configuration and the corresponding service
settings that must be supplied by the backend and AI-service deployments.
The frontend repository does not change the backend or Python AI service.

## How requests are routed

- All Spring Boot REST requests use the same-origin `/backend` Next.js route.
  `NEXT_PUBLIC_API_URL` selects the upstream Spring Boot origin.
- AI health, reference registration, frame analysis, and stop requests are
  sent directly from the browser to `NEXT_PUBLIC_AI_PROCTORING_URL`.
- AI telemetry uses a browser WebSocket. By default, its URL is derived from
  the AI HTTP URL: `http://` becomes `ws://`, and `https://` becomes `wss://`.
  Set `NEXT_PUBLIC_AI_PROCTORING_WS_URL` only when the WebSocket host differs.
- Google OAuth is a top-level browser redirect directly to the Spring Boot
  `/oauth2/authorization/google` endpoint. Do not point `NEXT_PUBLIC_API_URL`
  to the frontend origin or its `/backend` route.

## LAN mode

Frontend `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_EXAM_MODE=LAN
NEXT_PUBLIC_API_URL=http://<BACKEND_LAN_IP>:8080
NEXT_PUBLIC_AI_PROCTORING_URL=http://<AI_LAN_IP>:8000
# Optional when the WebSocket uses the same host:
# NEXT_PUBLIC_AI_PROCTORING_WS_URL=ws://<AI_LAN_IP>:8000
ALLOWED_DEV_ORIGINS=<FRONTEND_LAN_IP>:3000
```

Backend process environment:

```dotenv
AI_PROCTORING_BASE_URL=http://<AI_LAN_IP>:8000
```

Python AI-service process environment:

```dotenv
SPRING_BOOT_URL=http://<BACKEND_LAN_IP>:8080
PROCTOR_FRONTEND_ORIGINS=http://<FRONTEND_LAN_IP>:3000
```

Replace each placeholder with the current LAN IP for that machine. The frontend
browser, backend host, and AI host must be able to reach the configured IPs and
ports. If the frontend is opened using a different host or port, include that
exact frontend origin in `PROCTOR_FRONTEND_ORIGINS`.

The current LAN template contains the previously used addresses as examples;
confirm they have not changed before testing.

The backend's `local-exam` profile disables Google OAuth. Use the supported
password-based login flow in that profile, or have the backend team enable and
configure OAuth for the intended environment.

## ONLINE mode

Hosted frontend build environment:

```dotenv
NEXT_PUBLIC_EXAM_MODE=ONLINE
NEXT_PUBLIC_API_URL=https://quiz-app-s033.onrender.com
NEXT_PUBLIC_AI_PROCTORING_URL=https://<PUBLIC_AI_SERVICE_HOST>
# Optional only when the WebSocket uses a different host:
# NEXT_PUBLIC_AI_PROCTORING_WS_URL=wss://<PUBLIC_AI_SERVICE_HOST>
```

Hosted Spring Boot backend environment:

```dotenv
AI_PROCTORING_BASE_URL=https://<PUBLIC_AI_SERVICE_HOST>
```

Hosted Python AI-service environment:

```dotenv
SPRING_BOOT_URL=https://quiz-app-s033.onrender.com
PROCTOR_FRONTEND_ORIGINS=https://<PUBLIC_FRONTEND_DOMAIN>
```

The hosted frontend must use an HTTPS AI HTTP endpoint and a WSS WebSocket
endpoint. The frontend derives WSS automatically from an HTTPS AI URL unless
an explicit WebSocket URL is provided. Never deploy a browser-facing AI URL
that points to `localhost`: for a remote student, localhost is that student's
own device.

The Python AI service uses `PROCTOR_FRONTEND_ORIGINS` for its HTTP CORS
allow-list. Include the exact hosted frontend origin (scheme and hostname).
Because the frontend calls AI HTTP endpoints directly from the browser, this
allow-list must be configured on the AI service; a frontend change cannot
override server-side CORS policy.

Google OAuth is enabled only in the backend's online profile. The backend
deployment must provide its Google client ID, client secret, and
`GOOGLE_REDIRECT_URI`, and the Google OAuth client must have that exact redirect
URI registered. The backend success handler must redirect back to the deployed
frontend callback.

## Before testing

1. Set the matching frontend, backend, and AI-service environment variables.
2. Restart the LAN frontend/backend/AI processes after changing their env files.
3. Rebuild and redeploy the frontend after changing any `NEXT_PUBLIC_*` value.
4. Check the AI service `/health` endpoint directly from a student browser and
   confirm the backend `/api/v1/proctoring/ai-health` response reports it
   reachable with YuNet and SFace available.
5. Test login, lobby reference-photo capture, attempt start, WebSocket
   authentication/telemetry, REST fallback, stop/summary delivery, and exam
   submission in the target mode.

A successful frontend build verifies the frontend code only. It does not prove
that the configured backend, database, network routes, AI models, OAuth
credentials, or service-to-service URLs are reachable.
