import { syncCustomersToWooCommerce } from "@/app/actions/customers";
import { upsertWooCommerceOrders } from "@/app/actions/orders";
import { fetchProductFromGenukaWithId, upsertWooCommerceProducts } from "@/app/actions/products";
import { CompanyDBService } from "@/services/database/company.service";
import { GenukaCustomerDto } from "@/types/customer";
import { OrderDTO } from "@/types/order";
import { ProductDto } from "@/types/product";
import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    console.log(request);

    return NextResponse.json({ status: 200 });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
