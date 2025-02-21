// app/api/company/configuration/route.ts
import { NextResponse } from 'next/server'
import prisma from "@/lib/db";
import { ConfigurationDto } from '@/types/company';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('companyId')

  if (!companyId) {
    return NextResponse.json({ error: "Company ID required" }, { status: 400 })
  }

  try {
    const company = await prisma.company.findFirst({
      where: { id: companyId },
      include: {
        configuration: true
      }
    });
    
    return NextResponse.json({ company })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to check configuration" }, { status: 500 })
  }
}


export async function POST(request: Request) {
  try {
    const { apiUrl, consumerKey, consumerSecret, appVersion, companyId, apiKey }: ConfigurationDto = await request.json();
   
    if (!apiUrl || !consumerKey || !consumerSecret || !companyId || !apiKey) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    if (!/^https?:\/\/.+$/.test(apiUrl)) {
      return NextResponse.json({ error: 'Invalid API URL format' }, { status: 400 });
    }

    const data = {
      apiUrl,
      consumerKey,
      consumerSecret,
      appVersion: appVersion || 'wc/v3',
      companyId,
      apiKey
    }

    console.log({data})

    const config = await prisma.configuration.create({
      data: {...data}
    });

    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}