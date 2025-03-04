import { upsertWooCommerceOrders } from "@/app/actions/orders";
import { CompanyDBService } from "@/services/database/company.service";
import { GenukaCustomerDto } from "@/types/customer";
import { OrderDTO } from "@/types/order";
import { ProductDto } from "@/types/product";
import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";
import { NextResponse } from "next/server";

type EventType = "order.updated" | "order.created" | "order.deleted";
type Entity = ProductDto | OrderDTO | GenukaCustomerDto;

type WebhookPayload = {
  event: EventType;
  entity: Entity;
};

export async function POST(request: Request) {
  try {
    // 1. Récupérer et parser le corps de la requête
    const body = await request.json();
    const companyDBService = new CompanyDBService();

    // 2. Valider le payload
    if (!body.event || !body.entity) {
      return NextResponse.json(
        { error: "Invalid payload: event or entity missing" },
        { status: 400 }
      );
    }

    const { event, entity }: WebhookPayload = body;

    const config = await companyDBService.findByCompanyId(entity.company_id);

    if (!config) {
      return NextResponse.json(
        { error: `Unknown event type: ${event}` },
        { status: 400 }
      );
    }
    const wooApi = new WooCommerceRestApi({
      url: config.configuration!.apiUrl,
      consumerKey: config.configuration!.consumerKey,
      consumerSecret: config.configuration!.consumerSecret,
      version: "wc/v3",
      queryStringAuth: true,
    });

    // 3. Traiter en fonction de l'événement
    switch (event) {
      case "order.created":
        console.log("Order created:", entity);
        await upsertWooCommerceOrders(wooApi, config, [entity as OrderDTO]);
        break;

      case "order.updated":
        await upsertWooCommerceOrders(wooApi, config, [entity as OrderDTO]);
        break;

      case "order.deleted":
        const order = entity as OrderDTO;
        await wooApi.delete(`orders/${order.metadata.woocommerceId}`);
        break;

      default:
        console.warn("Unknown event type:", event);
        return NextResponse.json(
          { error: `Unknown event type: ${event}` },
          { status: 400 }
        );
    }

    // 4. Répondre avec un statut 200 pour confirmer la réception du webhook
    return NextResponse.json({ status: 200 });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
