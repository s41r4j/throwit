import { NextRequest, NextResponse } from "next/server";

const OLD_HOSTS = new Set(["throwit.in", "www.throwit.in"]);

export function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  if (!host || !OLD_HOSTS.has(host)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.hostname = "throwit.s41r4j.in";
  url.port = "";
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|paper-logo.webp).*)"],
};
