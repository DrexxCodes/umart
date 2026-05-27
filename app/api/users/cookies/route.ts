import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    }

    // Set cookies - use __session for Firebase token
    const cookieStore = await cookies()
    
    // Store the Firebase ID token in __session cookie
    cookieStore.set('__session', token, cookieOptions)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error setting cookies:', error)
    return NextResponse.json(
      { error: 'Failed to set cookies' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies()
    cookieStore.delete('__session')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error clearing session cookie:', error)
    return NextResponse.json({ error: 'Failed to clear cookie' }, { status: 500 })
  }
}
