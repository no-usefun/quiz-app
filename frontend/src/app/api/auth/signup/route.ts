import { NextResponse } from "next/server";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
).replace(/\/+$/, "");

function getErrorMessage(data: any): string {
  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message;
  }

  if (typeof data?.error === "string" && data.error.trim()) {
    return data.error;
  }

  return "Signup failed.";
}

export async function POST(request: Request) {
  let body: {
    firstName?: unknown;
    lastName?: unknown;
    name?: unknown;
    email?: unknown;
    password?: unknown;
    role?: unknown;
    registrationNo?: unknown;
    college?: unknown;
    department?: unknown;
    phone?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid request body.",
      },
      { status: 400 },
    );
  }

  const firstName =
    typeof body.firstName === "string"
      ? body.firstName.trim()
      : typeof body.name === "string"
        ? body.name.trim().split(/\s+/)[0] || ""
        : "";

  const lastName =
    typeof body.lastName === "string"
      ? body.lastName.trim()
      : typeof body.name === "string"
        ? body.name.trim().split(/\s+/).slice(1).join(" ")
        : "";

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  const requestedRole =
    typeof body.role === "string" ? body.role.trim().toUpperCase() : "";
  if (!firstName || !email || !password) {
    return NextResponse.json(
      {
        success: false,
        error: "First name, email, and password are required.",
      },
      { status: 400 },
    );
  }

  if (requestedRole !== "STUDENT" && requestedRole !== "TEACHER") {
    return NextResponse.json(
      {
        success: false,
        error: "Role must be STUDENT or TEACHER.",
      },
      { status: 400 },
    );
  }

  const registrationNo =
    typeof body.registrationNo === "string"
      ? body.registrationNo.trim().toUpperCase()
      : "";

  const college = typeof body.college === "string" ? body.college.trim() : "";

  const department =
    typeof body.department === "string" ? body.department.trim() : "";

  const phone = typeof body.phone === "string" ? body.phone.trim() : "";

  try {
    /*
     * Spring Boot is the sole registration authority.
     *
     * The backend returns SignupResponse:
     *   {
     *     message,
     *     verificationRequired,
     *     user
     *   }
     *
     * Signup does not return a JWT, so this route must never generate
     * a token or create an authenticated cookie.
     */
    const backendResponse = await fetch(
      `${API_BASE}/api/v1/auth/signup?role=${encodeURIComponent(requestedRole)}`,
      {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        password,
        ...(college ? { college } : {}),
        ...(department ? { department } : {}),
        ...(phone ? { phone } : {}),
        ...(requestedRole === "STUDENT" && registrationNo
          ? { registrationNo }
          : {}),
      }),
      cache: "no-store",
    });

    const data = await backendResponse.json().catch(() => ({}));

    if (!backendResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error: getErrorMessage(data),
          message: data?.message,
          code: data?.error,
        },
        {
          status: backendResponse.status,
        },
      );
    }

    /*
     * Compatibility response for the older AuthForm.
     *
     * `success` means account creation succeeded, NOT that the user is
     * authenticated. Consumers must inspect verificationRequired and route
     * to the email-verification/login flow rather than a dashboard.
     */
    return NextResponse.json(
      {
        success: true,
        message:
          data?.message ||
          (data?.verificationRequired === true
            ? "Account created. Please verify your email before logging in."
            : "Account created successfully. You can now log in."),
        verificationRequired: data?.verificationRequired === true,
        user: data?.user ?? null,
        role: data?.user?.role
          ? String(data.user.role).toUpperCase()
          : requestedRole,
        token: null,
      },
      { status: backendResponse.status },
    );
  } catch (error) {
    console.error("Signup proxy error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Cannot connect to the authentication server.",
      },
      { status: 503 },
    );
  }
}
