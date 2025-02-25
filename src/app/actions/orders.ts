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
import loggerService from "@/services/database/logger.service";

const globalLogs: GlobalLogs[] = [];

/**
 * @param config
 * @returns
 */
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
    const data = await fetchAllGenukaOrders(config);
    await upsertWooOrders(wooApi, config, data);
    // Par la suite si on souhaite juste syncroniser un produit (on doit faire le appeler le upsert)
    // console.log("On a le nombre de commande suivant ==> ",data.length)

    return true;
  } catch (error) {
    logger.error("An error occurred while syncing orders", error);

    globalLogs.push({
      type: "create",
      module: "customers",
      date: new Date(),
      id: "N/A",
      statut: "failed",
      companyId: config.configuration!.companyId,
    });

    throw new Error("An error occurred while syncing orders", { cause: error });
  }
};

const fetchAllGenukaOrders = async (
  config: CompanyWithConfiguration
): Promise<OrderDTO[]> => {
  const allOrders: OrderDTO[] = [];
  let currentPage = 1;
  let hasNextPage = true;

  const headers = new Headers();
  headers.append("Accept", "application/json");
  headers.append("Content-Type", "application/json");
  headers.append("X-Company", `${config.configuration?.companyId}`);
  headers.append("Authorization", `Bearer ${config.accessToken}`);

  while (hasNextPage) {
    const requestOptions = {
      method: "GET",
      headers,
    };

    const response = await fetch(
      `${process.env.GENUKA_URL}/${process.env.GENUKA_VERSION}/admin/orders?include=products&include=shop&include=customer&include=delivery&page=${currentPage}`,
      requestOptions
    );

    if (!response.ok) {
      throw new Error("Failed to fetch Genuka orders");
    }

    const { data, meta } = (await response.json()) as {
      data: OrderDTO[];
      meta: { current_page: number; last_page: number };
    };

    allOrders.push(...data);
    currentPage++;

    hasNextPage = currentPage <= meta.last_page;
  }

  return allOrders;
};

export const upsertWooOrders = async (
  wooApi: WooCommerceRestApi,
  config: CompanyWithConfiguration,
  orders: OrderDTO[]
) => {
  try {
    const headers = new Headers();
    headers.append("Accept", "application/json");
    headers.append("Content-Type", "application/json");
    headers.append("X-Company", `${config.configuration?.companyId}`);
    headers.append("Authorization", `Bearer ${config.accessToken}`);

    const requestOptions = {
      method: "GET",
      headers,
    };

    for (const genukaOrder of orders) {
      let res: any = null;
      try {
        const order = await fetch(
          `${process.env.GENUKA_URL}/${process.env.GENUKA_VERSION}/admin/orders/${genukaOrder.id}`,
          requestOptions
        );

        const data = await order.json();

        if (data.metadata && data.metadata.woocommerceId) {
          logger.info(
            `Updating existing order ${data.reference} in WooCommerce`
          );

          res = await updateWooOrder(wooApi, data);

          globalLogs.push({
            type: "update",
            module: "orders",
            date: new Date(),
            id: res.id,
            statut: "success",
            companyId: config.configuration!.companyId,
          });
        } else {
          logger.info(`Creating a new order in WooCommerce`);
          res = await createWooOrder(wooApi, config, data);
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
      } catch (orderError) {
        logger.error(
          `Error processing order ${genukaOrder.id}. Rolling back changes.`,
          orderError
        );
        if (res) {
          await rollbackChanges(wooApi, res.id);
        } else {
          await rollbackChanges(wooApi, genukaOrder.metadata.woocommerceId);
        }
        continue;
      }
    }
  } catch (error) {
    logger.error("An error occurred while upserting orders", error);
    throw new Error("An error occurred while upserting orders", {
      cause: error,
    });
  }
};

/**
 * @param wooApi
 * @param config
 * @param order
 * @returns
 */
const createWooOrder = async (
  wooApi: WooCommerceRestApi,
  config: CompanyWithConfiguration,
  order: GenukaOrderDto
) => {
  try {
    const lineItems: WooOrderLineItemDto[] = [];

    const { products } = order;

    for (const product of products) {
      if (product.metadata) {
        if (!product.metadata.woocommerceId) {
          logger.debug(
            "The product exists but does not have a WooCommerce ID. We need to create it."
          );

          const result = await upsertWooProduct(config, wooApi, [product]);
          lineItems.push({
            product_id: result[0].id,
            quantity: product.pivot.quantity,
          });
        } else {
          logger.debug("The product already exists in WooCommerce.");
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
          "The product has no metadata. We need to create it in WooCommerce."
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
    logger.error("An error occurred while creating the order", error);
    globalLogs.push({
      type: "create",
      module: "orders",
      date: new Date(),
      id: "N/A",
      statut: "failed",
      companyId: config.configuration!.companyId,
    });
    throw new Error("An error occurred while creating the order", {
      cause: error,
    });
  }
};

/**
 * @param config
 * @param order
 * @param woocommerceId
 * @returns
 */
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

    const body = JSON.stringify({
      ...convertApiOrder(order),
      metadata: updatedMetadata,
    });

    const response = await fetch(
      `${process.env.GENUKA_URL}/${process.env.GENUKA_VERSION}/admin/orders/${order.id}`,
      {
        method: "PUT",
        headers,
        body,
      }
    );

    if (!response.ok) {
      throw new Error("An error occurred while updating metadata", {
        cause: response,
      });
    }

    return response.json();
  } catch (error) {
    logger.error("An error has occurred", error);
    globalLogs.push({
      type: "update",
      module: "orders",
      date: new Date(),
      id: "N/A",
      statut: "failed",
      companyId: config.configuration!.companyId,
    });
    throw new Error("An error has occurred", { cause: error });
  }
};

/**
 * updateWooOrder
 * @param wooApi
 * @param order
 * @returns WooCommerData
 */
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

export const finhisOrdersSync = async () => {
  for (const global of globalLogs) {
    await loggerService.insert(global);
  }
};

const rollbackChanges = async (
  wooApi: WooCommerceRestApi,
  id: number | string
) => {
  try {
    logger.info(`Rolling back order ${id} in WooCommerce`);
    await wooApi.delete(`orders/${id}`, {
      force: true,
    });
  } catch (error) {
    logger.error(`Failed to rollback order ${id}`, error);
  }
};
