"use server";

import { extractWooCustomerDtoInfoFromGenukaCustomer } from "@/lib/utils";
import { GenukaCustomerDto, WooCustomerDto } from "@/types/customer";
import logger from "@/utils/logger";
import { Configuration } from "@prisma/client";
import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";

interface ResponseGenukaCustomerDto {
  data: GenukaCustomerDto[];
}

interface GlobalLogs {
  type: "create" | "update" | "delete";
  module: "products" | "orders" | "customers";
  date: Date;
  id: number | string;
  statut: "success" | "failed";
}

const globalLogs: GlobalLogs[] = [];

export const syncCustomers = async (
  config: Configuration
): Promise<boolean> => {
  try {
    logger.debug("Init Woo Commerce and Genuka SDK");
    // Init Genuka and WooCommerce
    const wooApi = new WooCommerceRestApi({
      url: config.apiUrl,
      consumerKey: config.consumerKey,
      consumerSecret: config.consumerSecret,
      version: "wc/v3",
      queryStringAuth: true,
    });

    // Retrieve customers
    const response = await fetch(
      `${process.env.GENUKA_URL}/${process.env.GENUKA_VERSION}/admin/customers?page=1&limit=10&filter=&sort=-orders_sum_amount&sort=-orders_count&include=orders_sum_amount&include=ordersCount`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": config.apiKey,
          "X-Company": config.companyId,
        },
      }
    );

    const { data } = (await response.json()) as ResponseGenukaCustomerDto;

    logger.info(`Retrieved ${data.length} customers from Genuka`);

    for (const genukaCustomer of data) {
      const customerToCreate =
        extractWooCustomerDtoInfoFromGenukaCustomer(genukaCustomer);

      // Check if customer already exists
      const existingCustomer = await wooApi.get(
        `customers/?email=${genukaCustomer.email}&role=all`
      );

      if (existingCustomer.data.length === 1) {
        logger.info(`Customer ${genukaCustomer.email} already exists`);
        const { data } = existingCustomer;
        await updateWooCustomer(wooApi, customerToCreate, data[0].id);

        globalLogs.push({
          type: "update",
          module: "customers",
          date: new Date(),
          id: data[0].id,
          statut: "success",
        });
        continue;
      }

      logger.debug(`Trying to create customer ${customerToCreate.email}`);
      await wooApi.post("customers", customerToCreate);
      logger.debug(`Finished creating customer ${customerToCreate.email}`);

      globalLogs.push({
        type: "create",
        module: "customers",
        date: new Date(),
        id: genukaCustomer.id, 
        statut: "success",
      });
    }

    return true;
  } catch (error) {
    logger.error(`${error}`);

    globalLogs.push({
      type: "create", 
      module: "customers",
      date: new Date(),
      id: "N/A", 
      statut: "failed",
    });

    throw new Error("Une erreur s'est produite", { cause: error });
  }
};

/**
 * Update Woo Customer with woocommerceId
 * @param {WooCommerceRestApi} wooApi
 * @param {WooCustomerDto} wooCustomer
 * @param {number} woocommerceId
 */
const updateWooCustomer = async (
  wooApi: WooCommerceRestApi,
  wooCustomer: WooCustomerDto,
  woocommerceId: number
) => {
  try {
    logger.debug(`Trying to update ${wooCustomer.email}`);
    await wooApi.put(`customers/${woocommerceId}`, wooCustomer);
    logger.debug(`Finished updating ${wooCustomer.email}`);
  } catch (error) {
    logger.error(`${error}`);

    // Log the update error
    globalLogs.push({
      type: "update",
      module: "customers",
      date: new Date(),
      id: woocommerceId,
      statut: "failed",
    });

    throw new Error("Une erreur s'est produite", { cause: error });
  }
};

/**
 * Update Genuka Customer with woocommerceId
 * @param {Configuration} config
 * @param {GenukaCustomerDto} genukaCustomer
 * @param {number} woocommerceId
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const updateGenukaCustomer = async (
  config: Configuration,
  genukaCustomer: GenukaCustomerDto,
  woocommerceId: number
) => {
  try {
    const updatedMetadata = {
      ...genukaCustomer.metadata,
      woocommerceId: woocommerceId,
    };

    const response = await fetch(
      `${process.env.GENUKA_URL}/${process.env.GENUKA_VERSION}/admin/customers/${genukaCustomer.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": config.apiKey,
          "X-Company": config.companyId,
        },
        body: JSON.stringify({
          ...genukaCustomer,
          metadata: updatedMetadata,
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Une erreur s'est produite", { cause: response });
    }

    globalLogs.push({
      type: "update",
      module: "customers",
      date: new Date(),
      id: genukaCustomer.id,
      statut: "success",
    });

    return true;
  } catch (error) {
    console.error({ error });

    globalLogs.push({
      type: "update",
      module: "customers",
      date: new Date(),
      id: genukaCustomer.id,
      statut: "failed",
    });

    throw new Error("Une erreur s'est produite", { cause: error });
  }
};

export const finhisCustomerSync = async () => {
  console.log(globalLogs);
};
