import { CompanyDBService } from "@/services/database/company.service";
import Genuka from "genuka-api";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("company_id");
  const code = searchParams.get("code");
  const timestamp = searchParams.get("timestamp");
  const hmac = searchParams.get("hmac");
  const redirectTo = decodeURIComponent(searchParams.get("redirect_to") || "/");
  // Validate parameters
  if (!companyId || !code || !timestamp || !hmac) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  try {
    // Exchange code for access token with Genuka
    const tokenResponse = await fetch(`${process.env.GENUKA_URL}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: process.env.GENUKA_CLIENT_ID!,
        client_secret: process.env.GENUKA_CLIENT_SECRET!,
        redirect_uri: process.env.GENUKA_REDIRECT_URI!,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to obtain access token");
    }

    const { access_token } = await tokenResponse.json();
    // Get company data from Genuka
    const genuka = await Genuka.initialize({ id: companyId });
    const company = await genuka.company.retrieve();
    const companyDBService = new CompanyDBService();

    // Store company data in DB
    const appCompany = {
      id: companyId,
      handle: company.handle || null,
      name: company.name,
      description: company.description || null,
      authorizationCode: code || null,
      accessToken: access_token || null,
      logoUrl: company.logoUrl || null,
    };

    await companyDBService.upsertCompany(appCompany);

    // return  NextResponse.redirect(redirectTo);
    return NextResponse.redirect(`${redirectTo}?company_id=${companyId}`);
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json({ error }, { status: 500 });
  }
}
