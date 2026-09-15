import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/news/:path*",
    "/editor/:path*",
    "/content/:path*",
    "/settings/:path*",
    "/analytics/:path*",
    "/media/:path*",
    "/strategy/:path*",
    "/calendar/:path*",
    "/", 
  ]
};
