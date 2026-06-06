/**
 * Next.js 16 proxy (formerly middleware). clerkMiddleware() returns a NextMiddleware
 * which is identical to the NextProxy type — export it directly as the named `proxy`
 * export that Next.js 16 expects.
 *
 * The matcher excludes static assets and image-optimisation routes so Clerk never
 * blocks them, while still protecting /picker, /loading, /map, and /api/*.
 */
import { clerkMiddleware } from "@clerk/nextjs/server";

export const proxy = clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals, static files, and image optimisation.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
