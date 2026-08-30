import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims() verifierar JWT:t lokalt mot ett cachat nyckelset (JWKS)
  // istället för att ringa Supabase Auth-servern för varje request, som
  // getUser() alltid gör. Det tar bort ett helt nätverks-round-trip från
  // VARJE sidnavigering i hela appen — den enda anledningen till att
  // proxy.ts behöver kolla sessionen alls är att avgöra om man ska
  // omdirigeras, inte för att hämta profildata (det gör sidan själv).
  const {
    data,
  } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  const isPublicPath = request.nextUrl.pathname.startsWith("/login");
  const isApiPath = request.nextUrl.pathname.startsWith("/api");

  if (!user && !isPublicPath && !isApiPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
