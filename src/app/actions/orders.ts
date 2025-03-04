"use server";

import { CompanyWithConfiguration } from "@/types/company";
import { GenukaOrderDto, OrderDTO, WooOrderLineItemDto } from "@/types/order";
import logger, { GlobalLogs } from "@/utils/logger";
import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";
import { upsertWooProducts } from "./products";
import {
  convertApiOrder,
  mapGenukaOrderToWooOrder,
  mapGenukaProductToAddOtherProperties,
} from "@/lib/utils";
import loggerService from "@/services/database/logger.service";
import { syncCustomersToWooCommerce } from "./customers";
import { ProductDto } from "@/types/product";

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

    const data = await fetchAllGenukaOrders(config);
    logger.info(`Retrieve ${data.length} orders`);
    await upsertWooCommerceOrders(wooApi, config, data);

    return true;
  } catch (error) {
    logger.error("An error occurred while syncing orders", error);
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

export const upsertWooCommerceOrders = async (
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

    for (const genukaOrder of orders.slice(0, 5)) {
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

          res = await updateWooOrder(wooApi, data, config);

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
          res = await createWooCommerceOrder(wooApi, config, data);
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
        console.log({ res, orderError });

        logger.error(
          `Error processing order ${genukaOrder.reference}. Rolling back changes.`,
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
const createWooCommerceOrder = async (
  wooApi: WooCommerceRestApi,
  config: CompanyWithConfiguration,
  order: GenukaOrderDto
) => {
  try {
    const { products, customer } = order;

    // 1. Synchroniser le client dans WooCommerce
    if (customer) {
      const [customerSyncResult] = await syncCustomersToWooCommerce(
        wooApi,
        config,
        [customer]
      );
      const wooCustomerId = customerSyncResult.wooCustomerId;

      // 2. Préparer les line items pour la commande
      const lineItems: WooOrderLineItemDto[] = await prepareLineItemsForOrder(
        wooApi,
        config,
        products
      );

      // 3. Mapper la commande Genuka vers le format WooCommerce
      const mappedOrder = mapGenukaOrderToWooOrder(
        order,
        lineItems,
        wooCustomerId
      );

      // 4. Créer la commande dans WooCommerce
      const response = await wooApi.post("orders", mappedOrder);
      return response.data;
    } else {
      // 2. Préparer les line items pour la commande
      const lineItems: WooOrderLineItemDto[] = await prepareLineItemsForOrder(
        wooApi,
        config,
        products
      );

      // 3. Mapper la commande Genuka vers le format WooCommerce
      const mappedOrder = mapGenukaOrderToWooOrder(order, lineItems, 0);

      // 4. Créer la commande dans WooCommerce
      const response = await wooApi.post("orders", mappedOrder);
      return response.data;
    }
  } catch (error) {
    logger.error("An error occurred while creating the order", error);
    throw new Error("An error occurred while creating the order", {
      cause: error,
    });
  }
};

// Fonction pour préparer les line items
const prepareLineItemsForOrder = async (
  wooApi: WooCommerceRestApi,
  config: CompanyWithConfiguration,
  products: ProductDto[]
): Promise<WooOrderLineItemDto[]> => {
  const lineItems: WooOrderLineItemDto[] = [];

  for (const product of products) {
    try {
      let wooProductId: number;

      // Vérifier si le produit existe déjà dans WooCommerce
      if (product.metadata?.woocommerceId) {
        logger.debug("The product already exists in WooCommerce.");
        wooProductId = product.metadata.woocommerceId;
      } else {
        logger.debug(
          "The product does not exist in WooCommerce. Creating it..."
        );
        const createdProducts = await upsertWooProducts(config, wooApi, [
          product,
        ]);
        wooProductId = createdProducts[0].id;
      }

      // Ajouter le produit aux line items
      lineItems.push({
        product_id: wooProductId,
        quantity: product.pivot.quantity,
      });
    } catch (error) {
      logger.error(
        `Error processing product ${product.id || product.title}`,
        error
      );
      // Continuer avec le produit suivant en cas d'erreur
      continue;
    }
  }

  return lineItems;
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
  order: GenukaOrderDto,
  config: CompanyWithConfiguration
) => {
  try {
    const { products, customer, metadata } = order;

    // 1. Synchroniser le client dans WooCommerce
    const [customerSyncResult] = await syncCustomersToWooCommerce(
      wooApi,
      config,
      [customer]
    );
    const wooCustomerId = customerSyncResult.wooCustomerId;

    // 2. Préparer les line items pour la commande
    const lineItems: WooOrderLineItemDto[] = await prepareLineItemsForOrder(
      wooApi,
      config,
      products
    );

    // 3. Mapper la commande Genuka vers le format WooCommerce
    const mappedOrder = mapGenukaOrderToWooOrder(
      order,
      lineItems,
      wooCustomerId
    );

    // 4. Créer la commande dans WooCommerce
    logger.info(`Trying update ${order.reference} in Woo Commerce`);
    // const { metadata } = order;
    const result = await wooApi.put(
      `orders/${metadata.woocommerceId}`,
      mappedOrder
    );
    // .then(res => console.log(res))
    // .catch(err => console.log(err.response))

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
