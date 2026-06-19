import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicRoutes = ['/login', '/register', '/guard-login', '/forgot-password'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Exclude public assets and api routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get('accessToken')?.value;
  const userCookie = request.cookies.get('user')?.value;
  
  const isPublicRoute = publicRoutes.includes(pathname);

  // If trying to access protected route without token
  if (!token && !isPublicRoute && pathname !== '/') {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If trying to access auth routes while logged in
  if (token && userCookie && isPublicRoute) {
    try {
      const user = JSON.parse(userCookie);
      // Redirect to role specific dashboard
      const dashboardUrl = new URL(`/${user.role.toLowerCase().replace('_', '-')}`, request.url);
      return NextResponse.redirect(dashboardUrl);
    } catch {
      // Invalid cookie, let them proceed to login
      request.cookies.delete('user');
      request.cookies.delete('accessToken');
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
