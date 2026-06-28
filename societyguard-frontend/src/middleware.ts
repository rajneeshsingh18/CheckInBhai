import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicRoutes = ['/login', '/register', '/guard-login', '/forgot-password'];

const getRolePath = (role: string) => {
  if (role === 'SOCIETY_ADMIN') return 'admin';
  return role.toLowerCase().replace('_', '-');
};

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

  // If logged in
  if (token && userCookie) {
    let user;
    try {
      user = JSON.parse(userCookie);
    } catch {
      // Invalid cookie, clear and redirect to login
      const res = NextResponse.redirect(new URL('/login', request.url));
      res.cookies.delete('user');
      res.cookies.delete('accessToken');
      res.cookies.delete('refreshToken');
      return res;
    }

    // Redirect logged in user from auth routes to their correct dashboard
    if (isPublicRoute || pathname === '/') {
      const rolePath = getRolePath(user.role);
      const dashboardUrl = new URL(`/${rolePath}`, request.url);
      return NextResponse.redirect(dashboardUrl);
    }

    // Role-based route protection
    if (pathname.startsWith('/guard') && user.role !== 'GUARD') {
      const rolePath = getRolePath(user.role);
      return NextResponse.redirect(new URL(`/${rolePath}`, request.url));
    }
    if (pathname.startsWith('/resident') && user.role !== 'RESIDENT') {
      const rolePath = getRolePath(user.role);
      return NextResponse.redirect(new URL(`/${rolePath}`, request.url));
    }
    if (pathname.startsWith('/admin') && user.role !== 'SOCIETY_ADMIN') {
      const rolePath = getRolePath(user.role);
      return NextResponse.redirect(new URL(`/${rolePath}`, request.url));
    }
    if (pathname.startsWith('/super-admin') && user.role !== 'SUPER_ADMIN') {
      const rolePath = getRolePath(user.role);
      return NextResponse.redirect(new URL(`/${rolePath}`, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
