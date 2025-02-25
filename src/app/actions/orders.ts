"use server";

import { CompanyWithConfiguration } from "@/types/company";
import { GenukaOrderDto, OrderDTO, WooOrderLineItemDto } from "@/types/order";
import logger, { GlobalLogs } from "@/utils/logger";
import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";
import { upsertWooProduct } from "./products";
import {
  convertApiOrder,
  mapGenukaOrderToWooOrder,
  mapGenukaProductToAddOtherProperties,
} from "@/lib/utils";

const globalLogs: GlobalLogs[] = [];
interface ResponseGenukaOrdersDto {
  data: OrderDTO[];
}

export const syncOrders = async (
  config: CompanyWithConfiguration
): Promise<boolean> => {
  try {
    logger.debug("Init Woo Commerce and Genuka SDK");
    const wooApi = new WooCommerceRestApi({
      url: config.configuration!.apiUrl,
      consumerKey: config.configuration!.consumerKey,
      consumerSecret: config.configuration!.consumerSecret,
      version: "wc/v3",
      queryStringAuth: true,
    });

    logger.info("Retrieve orders");

    const headers = new Headers();
    headers.append("Accept", "application/json");
    headers.append("Content-Type", "application/json");
    headers.append("X-Company", `${config.configuration?.companyId}`);
    headers.append("Authorization", `Bearer ${config.accessToken}`);

    const requestOptions = {
      method: "GET",
      headers,
    };

    const genukaOrders = await fetch(
      `${process.env.GENUKA_URL}/${process.env.GENUKA_VERSION}/admin/orders?include=products&include=shop&include=customer&include=delivery`,
      requestOptions
    );

    const { data } = (await genukaOrders.json()) as ResponseGenukaOrdersDto;

    for (const genukaOrder of data.slice(0, 1)) {
      const order = await fetch(
        `${process.env.GENUKA_URL}/${process.env.GENUKA_VERSION}/admin/orders/${genukaOrder.id}`,
        requestOptions
      );

      const data = await order.json();

      if (data.metadata && data.metadata.woocommerceId) {
        logger.info(
          `La commande ${data.reference} existe deja, on doit juste mettre a jour`
        );

        const res = await updateWooOrder(wooApi, data);

        globalLogs.push({
          type: "update",
          module: "orders",
          date: new Date(),
          id: res.id,
          statut: "success",
          companyId: config.configuration!.companyId,
        });
      } else {
        logger.info(`La commande n'existe pas encore`);
        const res = await createWooOrder(wooApi, config, data);
        const { products } = data;
        const productsWithPriceAndQte = products.map(
          mapGenukaProductToAddOtherProperties
        );
        await updateGenukaOrder(
          config,
          { ...data, products: productsWithPriceAndQte },
          res.id
        );
        globalLogs.push({
          type: "update",
          module: "products",
          date: new Date(),
          id: res.id,
          statut: "success",
          companyId: config.configuration!.companyId,
        });
      }
    }

    return true;
  } catch (error) {
    logger.error("Une erreur s'est produite", error);

    globalLogs.push({
      type: "create",
      module: "customers",
      date: new Date(),
      id: "N/A",
      statut: "failed",
      companyId: config.configuration!.companyId,
    });

    throw new Error("Une erreur s'est produite", { cause: error });
  }
};

const createWooOrder = async (
  wooApi: WooCommerceRestApi,
  config: CompanyWithConfiguration,
  order: GenukaOrderDto
) => {
  try {
    const lineItems: WooOrderLineItemDto[] = [];

    const { products } = order;

    for (const product of products.slice(0, 1)) {
      if (product.metadata) {
        if (!product.metadata.woocommerceId) {
          logger.debug(
            "Le produit existe mais n'a pas de WooCommerce ID. Nous devons procéder à sa création."
          );

          const result = await upsertWooProduct(config, wooApi, [product]);
          lineItems.push({
            product_id: result[0].id,
            quantity: product.pivot.quantity,
          });
        } else {
          logger.debug("Le produit existe déjà dans WooCommerce.");
          const res = await wooApi.get(
            `products/${product.metadata.woocommerceId}`
          );
          const result = res.data;
          lineItems.push({
            product_id: result.id,
            quantity: product.pivot.quantity,
          });
        }
      } else {
        logger.debug(
          "Le produit n'a pas de metadata. Nous devons le créer dans WooCommerce."
        );

        const result = await upsertWooProduct(config, wooApi, [product]);
        lineItems.push({
          product_id: result[0].id,
          quantity: product.pivot.quantity,
        });
      }

      const mappedOrder = mapGenukaOrderToWooOrder(order, lineItems);
      const res = await wooApi.post("orders", mappedOrder);
      return res.data;
    }
  } catch (error) {
    logger.error(
      "Une erreur s'est produite lors de la creation de la commande",
      error
    );
    throw new Error(
      "Une erreur s'est produite lors de la creation de la commande",
      { cause: error }
    );
  }
};

const updateGenukaOrder = async (
  config: CompanyWithConfiguration,
  order: GenukaOrderDto,
  woocommerceId: number
) => {
  try {
    const headers = new Headers();
    headers.append("Accept", "application/json");
    headers.append("Content-Type", "application/json");
    headers.append("X-Company", `${config.configuration?.companyId}`);
    headers.append("Authorization", `Bearer ${config.accessToken}`);

    const updatedMetadata = {
      ...order.metadata,
      woocommerceId,
    };

    console.log("===================>", order.reference);

    const body = JSON.stringify({
      ...convertApiOrder(order),
      metadata: updatedMetadata,
    });

    const res = await fetch(
      `${process.env.GENUKA_URL}/${process.env.GENUKA_VERSION}/admin/orders/${order.id}`,
      {
        method: "PUT",
        headers,
        body,
      }
    );

    if (!res.ok) {
      throw new Error(
        "Une erreur s'est produite lors de la mise à jour des métadonnées",
        { cause: res }
      );
    }

    return res.json();
  } catch (error) {
    logger.error("Une erreur s'est produite", error);
    throw new Error("Une erreur s'est produite", { cause: error });
  }
};

const updateWooOrder = async (
  wooApi: WooCommerceRestApi,
  order: GenukaOrderDto
) => {
  try {
    logger.info(`Trying update ${order.reference} in Woo Commerce`);
    const { metadata } = order;
    const result = await wooApi.put(`orders/${metadata.woocommerceId}`, order);
    logger.info(`End updating orders in Woo Commerce`);

    return result.data;
  } catch (error) {
    logger.error("Une erreur s'est produite", error);
    throw new Error("Une erreur s'est produite", { cause: error });
  }
};
