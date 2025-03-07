"use server";

import { CompanyWithConfiguration } from "@/types/company";
import {
  GenukaOrderDto,
  OrderDTO,
  WooOrderDto,
  WooOrderLineItemDto,
} from "@/types/order";
import logger, { GlobalLogs } from "@/utils/logger";
import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";
import { upsertWooProducts } from "./products";
import {
  convertApiOrder,
  mapGenukaOrderToWooOrder,
  mapGenukaOrderToWooOrderUpdate,
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

          res = await updateWooCommerceOrder(wooApi, data, config);

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
    console.log(error);
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
      const mappedOrder = await mapGenukaOrderToWooOrder(
        order,
        lineItems,
        wooCustomerId,
        wooApi
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
      const mappedOrder = await mapGenukaOrderToWooOrder(
        order,
        lineItems,
        0,
        wooApi
      );

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

// const prepareLineItemsForOrder = async (
//   wooApi: WooCommerceRestApi,
//   config: CompanyWithConfiguration,
//   products: ProductDto[]
// ): Promise<WooOrderLineItemDto[]> => {
//   const lineItemsMap: { [key: number]: WooOrderLineItemDto } = {};

//   for (const product of products) {
//     try {
//       let wooProductId: number;

//       // Vérifier si le produit existe déjà dans WooCommerce
//       if (product.metadata?.woocommerceId) {
//         logger.debug("The product already exists in WooCommerce.");
//         wooProductId = product.metadata.woocommerceId;
//       } else {
//         logger.debug(
//           "The product does not exist in WooCommerce. Creating it..."
//         );
//         const createdProducts = await upsertWooProducts(config, wooApi, [
//           product,
//         ]);
//         wooProductId = createdProducts[0].id;
//       }

//       // Vérifier si le produit est déjà dans les line items
//       if (lineItemsMap[wooProductId]) {
//         // Mettre à jour la quantité si le produit existe déjà
//         logger.debug(
//           `Updating quantity for product ${wooProductId}. Current quantity: ${lineItemsMap[wooProductId].quantity}, adding ${product.pivot.quantity}`
//         );
//         lineItemsMap[wooProductId].quantity += product.pivot.quantity;
//       } else {
//         // Ajouter le produit aux line items s'il n'existe pas
//         logger.debug(
//           `Adding product ${wooProductId} with quantity ${product.pivot.quantity}`
//         );
//         lineItemsMap[wooProductId] = {
//           product_id: wooProductId,
//           quantity: product.pivot.quantity,
//         };
//       }
//     } catch (error) {
//       logger.error(
//         `Error processing product ${product.id || product.title}`,
//         error
//       );
//       // Continuer avec le produit suivant en cas d'erreur
//       continue;
//     }
//   }

//   // Convertir l'objet en tableau de line items
//   const lineItems = Object.values(lineItemsMap);
//   logger.debug("Final line items:", lineItems);
//   return lineItems;
// };

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
 * updateWooCommerceOrder
 * @param wooApi
 * @param order
 * @returns WooCommerData
 */
export const updateWooCommerceOrder = async (
  wooApi: WooCommerceRestApi,
  order: GenukaOrderDto,
  config: CompanyWithConfiguration
) => {
  try {
    const { products, customer, metadata } = order;

    // 1. Synchroniser le client dans WooCommerce (si le client existe)
    const wooCustomerId = customer
      ? (await syncCustomersToWooCommerce(wooApi, config, [customer]))[0]
          .wooCustomerId
      : 0; // Si aucun client, utiliser 0

    // 2. Préparer les line items pour la commande
    const lineItems: WooOrderLineItemDto[] = await prepareLineItemsForOrder(
      wooApi,
      config,
      products
    );

    const response = await wooApi.get(`orders/${metadata.woocommerceId}`);
    const existingOrder = response.data;
    const { updatedLineItems, updatedShippingLines } = combineLines(
      existingOrder,
      lineItems,
      order.shipping.amount.toString()
    );

    // console.log({ updatedLineItems, updatedShippingLines });

    // 3. Mapper la commande Genuka vers le format WooCommerce
    const mappedOrder = mapGenukaOrderToWooOrderUpdate(
      order,
      updatedLineItems,
      updatedShippingLines,
      wooCustomerId,
    );

    // // -------------
    // const updatedOrder = {
    //   line_items: [],
    //   shipping_lines: [],
    // };

    // // 3. Envoyer la commande vide pour effacer les anciennes lignes
    // const result = await wooApi.put(`orders/${metadata.woocommerceId}`, updatedOrder);

    // -----------

    // 4. Mettre à jour la commande dans WooCommerce
    logger.info(`Trying to update order ${order.reference} in WooCommerce`);
    const result = await wooApi.put(
      `orders/${metadata.woocommerceId}`,
      mappedOrder
    );
    // .then(res  => console.log(res))
    // .catch(err => console.log(err.response))

    logger.info(`Finished updating order ${order.reference} in WooCommerce`);

    return result.data;
  } catch (error) {
    console.log(error);
    logger.error("An error occurred while updating the order", error);
    throw new Error("An error occurred while updating the order", {
      cause: error,
    });
  }
};

// const combineLines = (
//   order: WooOrderDto,
//   lineItems: WooOrderLineItemDto[],
//   total: string
// ) => {
//   // Mettre à jour ou ajouter les line_items
//   const updatedLineItems = [...order.line_items];

//   lineItems.forEach((newItem) => {
//     const existingItemIndex = updatedLineItems.findIndex(
//       (item) => item.product_id === newItem.product_id
//     );

//     console.log({existingItemIndex})

//     if (existingItemIndex !== -1) {
//       // Mettre à jour l'élément existant
//       updatedLineItems[existingItemIndex] = {
//         ...updatedLineItems[existingItemIndex],
//         quantity: newItem.quantity,
//       };
//     } else {
//       // Ajouter un nouvel élément
//       updatedLineItems.push(newItem);
//     }
//   });

//   // Mettre à jour ou ajouter les shipping_lines
//   const updatedShippingLines = [...order.shipping_lines];

//   order.shipping_lines.forEach((newShippingLine) => {
//     const existingShippingLineIndex = updatedShippingLines.findIndex(
//       (line) => line.method_id === newShippingLine.method_id
//     );

//     if (existingShippingLineIndex !== -1) {
//       // Mettre à jour la ligne de livraison existante
//       updatedShippingLines[existingShippingLineIndex] = {
//         ...updatedShippingLines[existingShippingLineIndex],
//         total: total,
//       };
//     } else {
//       // Ajouter une nouvelle ligne de livraison
//       updatedShippingLines.push({
//         ...newShippingLine,
//         total: total,
//       });
//     }
//   });

//   // console.log({ updatedLineItems, updatedShippingLines });

//   const hh = updatedLineItems.map(r => ({
//     product_id : r.product_id,
//     variation_id: r.variation_id,
//     quantity: r.quantity
//   }))

//   console.log({hh})

//   return { updatedLineItems, updatedShippingLines };
// };

// const combineLines = (
//   order: WooOrderDto,
//   lineItems: WooOrderLineItemDto[],
//   total: string
// ) => {
//   // Mettre à jour ou ajouter les line_items
//   const updatedLineItems = order.line_items.reduce<WooOrderLineItemDto[]>((acc, item) => {
//     const newItem = lineItems.find((newItem) => newItem.product_id === item.product_id);
//     if (newItem) {
//       acc.push({ ...item, quantity: newItem.quantity });
//     } else {
//       acc.push(item);
//     }
//     return acc;
//   }, []);

//   // Ajouter les nouveaux éléments qui ne sont pas encore présents
//   lineItems.forEach((newItem) => {
//     if (!updatedLineItems.some((item) => item.product_id === newItem.product_id)) {
//       updatedLineItems.push(newItem);
//     }
//   });

//   // Mettre à jour ou ajouter les shipping_lines
//   const updatedShippingLines = order.shipping_lines.reduce<typeof order.shipping_lines>((acc, line) => {
//     const existingShippingLine = acc.find((existing) => existing.method_id === line.method_id);
//     if (existingShippingLine) {
//       existingShippingLine.total = total;
//     } else {
//       acc.push({ ...line, total: total });
//     }
//     return acc;
//   }, [...order.shipping_lines]);

//   return { updatedLineItems, updatedShippingLines };
// };

const combineLines = (
  order: WooOrderDto,
  lineItems: any[],
  total: string
) => {
  const productQuantityMap = new Map<number, number>();

  order.line_items.forEach((item) => {
    productQuantityMap.set(
      item.product_id,
      (productQuantityMap.get(item.product_id) || 0) + item.quantity
    );
  });

  lineItems.forEach((newItem) => {
    productQuantityMap.set(
      newItem.product_id,
      (productQuantityMap.get(newItem.product_id) || 0) + newItem.quantity
    );
  });

  const updatedLineItems = Array.from(productQuantityMap.entries()).map(
    ([productId, _]) => {
      const existingItem = order.line_items.find(
        (item) => item.product_id === productId
      );

      if (existingItem) {
        return {
          ...existingItem,
          quantity: existingItem.quantity,
        };
      } else {
        const newItemData = lineItems.find(
          (item) => item.product_id === productId
        );
        return {
          product_id: productId,
          quantity: newItemData.quantity,
          ...(newItemData || {}),
        };
      }
    }
  );

  const shippingMap = new Map<string, any>();

  order.shipping_lines.forEach((line) => {
    shippingMap.set(line.method_id, { ...line });
  });

  if (total) {
    shippingMap.forEach((line) => {
      line.total = total;
    });

    if (shippingMap.size === 0) {
      shippingMap.set("flat_rate", {
        method_id: "flat_rate",
        method_title: "Flat Rate",
        total: total,
      });
    }
  }

  const updatedShippingLines = Array.from(shippingMap.values());

  return { updatedLineItems, updatedShippingLines };
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
