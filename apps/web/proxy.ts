import { NextResponse, type NextRequest } from "next/server";

/**
 * Guards /internal-review, which shows issue reports (and reporters' contact details).
 *
 * - It must be switched on with INTERNAL_REVIEW=true (otherwise the page itself returns 404).
 * - In production it additionally requires REVIEW_PASSWORD, checked with HTTP Basic auth
 *   (any user name). Without a password set, production refuses outright, so an
 *   INTERNAL_REVIEW=true that slips into a deployment can never expose reports.
 */
export function proxy(request: NextRequest) {
  if (process.env.INTERNAL_REVIEW !== "true") return NextResponse.next();
  const password = process.env.REVIEW_PASSWORD;
  if (!password) {
    return process.env.NODE_ENV === "production" ? new NextResponse("Not found", { status: 404 }) : NextResponse.next();
  }
  const header = request.headers.get("authorization") ?? "";
  let supplied = "";
  try {
    if (header.startsWith("Basic ")) supplied = atob(header.slice(6)).split(":").slice(1).join(":");
  } catch {
    supplied = "";
  }
  if (supplied.length === password.length && constantTimeEqual(supplied, password)) return NextResponse.next();
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Internal review", charset="UTF-8"' },
  });
}

function constantTimeEqual(a: string, b: string): boolean {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const config = { matcher: ["/internal-review/:path*", "/internal-review"] };
