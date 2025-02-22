import { NextResponse } from "next/server";


export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    console.log({searchParams})
      return NextResponse.json({ succes: "Bien recu" }, { status: 200 });
  }
  


export async function POST(request: Request) {
  try {
    const {metadata} = await request.json()
    const { genukaProductId, wooProductId, config } = metadata

console.log({metadata})
    const response = await fetch(
      `${process.env.GENUKA_URL}/${process.env.GENUKA_VERSION}/admin/products/${genukaProductId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": config.apiKey,
          "X-Company": config.companyId,
          // "X-Shop": this.genuka_shop_id,
        },
        body: JSON.stringify({
          metadata: {
            woocommerceId: wooProductId,
          },
        }),
      }
    );

    if (!response.ok) {
        console.log("L'erreur ",{response})
      return NextResponse.json(
        { success: false, error: "Failed to update product" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating product:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update product" },
      { status: 500 }
    );
  }
}
