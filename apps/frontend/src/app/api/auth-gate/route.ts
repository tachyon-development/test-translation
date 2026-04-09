import { NextRequest, NextResponse } from "next/server";

const SITE_PASSWORD = process.env.SITE_PASSWORD || "";

export async function POST(request: NextRequest) {
  if (!SITE_PASSWORD) {
    return NextResponse.json({ error: "No password configured" }, { status: 500 });
  }

  const { password } = await request.json();

  if (password === SITE_PASSWORD) {
    const response = NextResponse.json({ ok: true });
    response.cookies.set("hospiq-auth", SITE_PASSWORD, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });
    return response;
  }

  return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
}
