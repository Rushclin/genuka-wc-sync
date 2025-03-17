import { syncCustomersToWooCommerce } from "@/app/actions/customers";
import { upsertWooCommerceOrders } from "@/app/actions/orders";
import {
  fetchProductFromGenukaWithId,
  upsertWooCommerceProducts,
} from "@/app/actions/products";
import { CompanyDBService } from "@/services/database/company.service";
import { GenukaCustomerDto } from "@/types/customer";
import { OrderDTO } from "@/types/order";
import { ProductDto } from "@/types/product";
import logger from "@/utils/logger";
import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";
import { NextResponse } from "next/server";

type EventType =
  | "order.updated"
  | "order.created"
  | "order.deleted"
  | "product.created"
  | "product.updated"
  | "product.deleted"
  | "customer.created"
  | "customer.updated"
  | "customer.deleted";

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

    // console.log({event}, entity.id, entity.metadata?.dateLastSync)

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

    logger.debug("Doit on synchroniser ? ", shouldSyncEntity(entity));

    if (!shouldSyncEntity(entity)) {
      return NextResponse.json({
        message:
          "L'entite a ete synchronise il ya quelques instant, donc surement un SPAM",
        status: 200,
      });
    }
    // 3. Traiter en fonction de l'événement
    switch (event) {
      case "order.created":
        console.log("Created new order");
        await upsertWooCommerceOrders(wooApi, config, [entity as OrderDTO]);
        break;

      case "order.updated":
        console.log("Updated order");
        await upsertWooCommerceOrders(wooApi, config, [entity as OrderDTO]);
        break;

      case "order.deleted":
        console.log("Deleted order");
        const order = entity as OrderDTO;
        await wooApi.delete(`orders/${order.metadata.woocommerceId}`);
        break;

      case "product.created":
        console.log("Created product");
        const request = entity as ProductDto;
        const createdProduct = await fetchProductFromGenukaWithId(request.id, config);

        await upsertWooCommerceProducts(config, wooApi, [createdProduct]);
        break;

      case "product.updated":
        console.log("Updated product");
        const updatedProduct = entity as ProductDto;
        const product = await fetchProductFromGenukaWithId(updatedProduct.id, config);

        await upsertWooCommerceProducts(config, wooApi, [product]);
        break;

      case "product.deleted":
        console.log("Deleted product");
        const deletedProduct = entity as ProductDto;
        console.log({ deletedProduct });
        break;

      case "customer.created":
        console.log("Created Customer");
        const createdCustomer = entity as GenukaCustomerDto;
        await syncCustomersToWooCommerce(wooApi, config, [createdCustomer]);
        break;

      case "customer.updated":
        console.log("Updated Customer");
        const updatedCustomer = entity as GenukaCustomerDto;
        await syncCustomersToWooCommerce(wooApi, config, [updatedCustomer]);
        break;

      case "customer.deleted":
        const deletedCustomer = entity as GenukaCustomerDto;
        const existingCustomer = await wooApi.get(
          `customers/?email=${encodeURIComponent(
            deletedCustomer.email
          )}&role=all`
        );

        if (existingCustomer.data && existingCustomer.data.length > 0) {
          await wooApi.delete(`customers/${existingCustomer.data[0].id}`, {
            force: true,
          });
        }
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

const shouldSyncEntity = (entity: Entity): boolean => {
  const now = Date.now();
  const { metadata } = entity;

  if (!metadata || !metadata.dateLastSync) {
    return true; // Synchroniser si le timestamp n'existe pas
  }

  const dateLastSync = metadata.dateLastSync * 1000;
  return now - dateLastSync >= 60000;
};
