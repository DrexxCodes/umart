import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'

async function getUserData(token: string) {
  try {
    const decodedToken = await adminAuth.verifyIdToken(token)
    const uid = decodedToken.uid

    const userDoc = await adminDb.collection('users').doc(uid).get()
    if (!userDoc.exists) return null

    const userData = userDoc.data()
    return {
      uid,
      roles: userData?.roles || { isCreator: false, isAdmin: false },
      restrictions: userData?.restrictions || {
        isBanned: false,
        isCreatorBanned: false,
        isPaymentBanned: false,
      },
    }
  } catch (error) {
    console.error('Error verifying token or fetching user:', error)
    return null
  }
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // ── Bypass: auth pages, API routes, static files, and designated error pages
  if (
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname === '/banned' ||
    pathname === '/creator/banned' ||
    pathname === '/admin/not-admin'
  ) {
    return NextResponse.next()
  }

  const authToken = request.cookies.get('__session')?.value

  const isProtectedRoute =
    pathname.startsWith('/creator') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/chat') ||
    pathname.startsWith('/dashboard')

  // ── Sync __isCreator cookie for any page that has a session token
  // This lets the BuyerNav read isCreator without a client-side Firestore call
  if (authToken && !isProtectedRoute) {
    const userData = await getUserData(authToken)
    const response = NextResponse.next()
    response.cookies.set('__isCreator', String(userData?.roles.isCreator ?? false), {
      httpOnly: false,   // must be readable by client JS
      sameSite: 'lax',
      path: '/',
    })
    return response
  }

  if (isProtectedRoute) {
    // No token → redirect to login with return path
    if (!authToken) {
      const loginUrl = new URL('/auth/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    const userData = await getUserData(authToken)

    if (!userData) {
      // Invalid/expired token — clear cookies and send to login
      const response = NextResponse.redirect(
        new URL(`/auth/login?redirect=${encodeURIComponent(pathname)}`, request.url)
      )
      response.cookies.delete('__session')
      response.cookies.delete('__isCreator')
      return response
    }

    // Set __isCreator cookie on every protected page response too
    const isCreatorValue = String(userData.roles.isCreator)

    // Global ban applies to every protected route — check first
    if (userData.restrictions.isBanned) {
      return NextResponse.redirect(new URL('/banned', request.url))
    }

    // ── /creator/* ──────────────────────────────────────────────────────────
    if (pathname.startsWith('/creator')) {
      if (pathname === '/creator/not-creator') {
        if (userData.roles.isCreator) {
          return NextResponse.redirect(new URL('/creator', request.url))
        }
        return NextResponse.next()
      }

      if (userData.restrictions.isCreatorBanned) {
        return NextResponse.redirect(new URL('/creator/banned', request.url))
      }

      if (!userData.roles.isCreator) {
        return NextResponse.redirect(new URL('/creator/not-creator', request.url))
      }

      const res = NextResponse.next()
      res.cookies.set('__isCreator', isCreatorValue, { httpOnly: false, sameSite: 'lax', path: '/' })
      return res
    }

    // ── /admin/* ────────────────────────────────────────────────────────────
    if (pathname.startsWith('/admin')) {
      if (!userData.roles.isAdmin) {
        return NextResponse.redirect(new URL('/admin/not-admin', request.url))
      }
      const res = NextResponse.next()
      res.cookies.set('__isCreator', isCreatorValue, { httpOnly: false, sameSite: 'lax', path: '/' })
      return res
    }

    // ── /chat/* and other protected routes ──────────────────────────────────
    const res = NextResponse.next()
    res.cookies.set('__isCreator', isCreatorValue, { httpOnly: false, sameSite: 'lax', path: '/' })
    return res
  }

  // Public route — no session, clear stale __isCreator if present
  const response = NextResponse.next()
  if (request.cookies.get('__isCreator')) {
    response.cookies.delete('__isCreator')
  }
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|public).*)',
  ],
}