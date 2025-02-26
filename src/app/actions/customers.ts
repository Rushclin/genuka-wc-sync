"use server";

import { extractWooCustomerDtoInfoFromGenukaCustomer } from "@/lib/utils";
import { GenukaCustomerDto, WooCustomerDto } from "@/types/customer";
import logger, { GlobalLogs } from "@/utils/logger";
import { Configuration } from "@prisma/client";
import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";
import loggerService from "../../services/database/logger.service";
import { CompanyWithConfiguration } from "@/types/company";

const globalLogs: GlobalLogs[] = [];

export const syncCustomers = async (
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

    // // Retrieve customers
    // const response = await fetch(
    //   `${process.env.GENUKA_URL}/${process.env.GENUKA_VERSION}/admin/customers?page=1&limit=10&filter=&sort=-orders_sum_amount&sort=-orders_count&include=orders_sum_amount&include=ordersCount`,
    //   {
    //     method: "GET",
    //     headers: {
    //       "Content-Type": "application/json",
    //       "X-API-Key": config.apiKey,
    //       "X-Company": config.companyId,
    //     },
    //   }
    // );

    // const { data } = (await response.json()) as ResponseGenukaCustomerDto;
    const data = await fetchAllGenukaCusomers(config);

    logger.info(`Retrieved ${data.length} customers from Genuka`);
    await upsertWooCustomers(wooApi, config, data);

    return true;
  } catch (error) {
    logger.error("Une erreur s'est produite lors de l'UPSERT du client", error);

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

const fetchAllGenukaCusomers = async (
  config: CompanyWithConfiguration
): Promise<GenukaCustomerDto[]> => {
  const allCustomers: GenukaCustomerDto[] = [];
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
      `${process.env.GENUKA_URL}/${process.env.GENUKA_VERSION}/admin/customers?page=${currentPage}`,
      requestOptions
    );

    if (!response.ok) {
      throw new Error("Failed to fetch Genuka customers");
    }

    const { data, meta } = (await response.json()) as {
      data: GenukaCustomerDto[];
      meta: { current_page: number; last_page: number };
    };

    allCustomers.push(...data);
    currentPage++;

    hasNextPage = currentPage <= meta.last_page;
  }

  return allCustomers;
};

export const upsertWooCustomers = async (
  wooApi: WooCommerceRestApi,
  config: CompanyWithConfiguration,
  customers: GenukaCustomerDto[]
) => {
  try {
    let result: any = null;
    for (const genukaCustomer of customers) {
      try {
        const customerToCreate =
          extractWooCustomerDtoInfoFromGenukaCustomer(genukaCustomer);

        // Check if customer already exists
        const existingCustomer = await wooApi.get(
          `customers/?email=${genukaCustomer.email}&role=all`
        );

        if (existingCustomer.data.length === 1) {
          logger.info(`Customer ${genukaCustomer.email} already exists`);
          const { data } = existingCustomer;

          result = await updateWooCustomer(
            wooApi,
            customerToCreate,
            data[0].id,
            config.configuration!
          );
          continue;
        }

        result = await createWooCustomer(wooApi, config.configuration!, customerToCreate);
        // Pas obligé, car la vérification se fait avec le mail qui est unique
        // await updateGenukaCustomer(config, genukaCustomer, result.id);
      } catch (error) {
        logger.error(
          `Error processing order ${genukaCustomer.id}. Rolling back changes.`,
          error
        );
        if (result) {
          await rollbackChanges(wooApi, result.id);
        } 
        // else {
        //   await rollbackChanges(
        //     wooApi,
        //     genukaCustomer.metadata!.woocommerceId
        //   );
        // }
        continue;
      }
    }
  } catch (error) {
    logger.error(
      "Une erreur s'est produite lors de l'UPSERT du customer",
      error
    );

    throw new Error("Une erreur s'est produite lors de l'UPSERT du customer", {
      cause: error,
    });
  }
};

const createWooCustomer = async (
  wooApi: WooCommerceRestApi,
  config: Configuration,
  customer: WooCustomerDto
) => {
  try {
    logger.debug(`Trying to create customer ${customer.email}`);
    const res = await wooApi.post("customers", customer);
    logger.debug(`Finished creating customer ${customer.email}`);

    globalLogs.push({
      type: "create",
      module: "customers",
      date: new Date(),
      id: customer.email,
      statut: "success",
      companyId: config.companyId,
    });
    return res.data;
  } catch (error) {
    logger.error(
      "Une erreur s'est produite lors de l'UPSERT du customer",
      error
    );
    globalLogs.push({
      type: "create",
      module: "customers",
      date: new Date(),
      id: customer.email,
      statut: "failled",
      companyId: config.companyId,
    });

    throw new Error("Une erreur s'est produite lors de l'UPSERT du customer", {
      cause: error,
    });
  }
};

/**
 * Update Woo Customer with woocommerceId
 * @param {WooCommerceRestApi} wooApi
 * @param {WooCustomerDto} wooCustomer
 * @param {number} woocommerceId
 * @param {config} Configuration
 */
const updateWooCustomer = async (
  wooApi: WooCommerceRestApi,
  wooCustomer: WooCustomerDto,
  woocommerceId: number,
  config: Configuration
) => {
  try {
    logger.debug(`Trying to update ${wooCustomer.email}`);
    const res = await wooApi.put(`customers/${woocommerceId}`, wooCustomer);
    logger.debug(`Finished updating ${wooCustomer.email}`);

    globalLogs.push({
      type: "update",
      module: "customers",
      date: new Date(),
      id: wooCustomer.email,
      statut: "success",
      companyId: config.companyId,
    });

    return res.data;
  } catch (error) {
    logger.error(
      "Une erreur s'est produite lors de la mise a jour du customer",
      error
    );

    globalLogs.push({
      type: "update",
      module: "customers",
      date: new Date(),
      id: wooCustomer.email,
      statut: "failed",
      companyId: config.companyId,
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
  config: CompanyWithConfiguration,
  genukaCustomer: GenukaCustomerDto,
  woocommerceId: number
) => {
  try {
    const headers = new Headers();
    headers.append("Accept", "application/json");
    headers.append("Content-Type", "application/json");
    headers.append("X-Company", `${config?.configuration!.companyId}`);
    headers.append("Authorization", `Bearer ${config.accessToken}`);

    const updatedMetadata = {
      ...genukaCustomer.metadata,
      woocommerceId: woocommerceId,
    };
    const body = JSON.stringify({
      ...genukaCustomer,
      metadata: updatedMetadata,
    });

    const response = await fetch(
      `${process.env.GENUKA_URL}/${process.env.GENUKA_VERSION}/admin/customers/${genukaCustomer.id}`,
      {
        method: "PUT",
        headers,
        body,
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
      companyId: config.configuration!.companyId,
    });

    return true;
  } catch (error) {
    logger.error(`${error}`);

    globalLogs.push({
      type: "update",
      module: "customers",
      date: new Date(),
      id: genukaCustomer.id,
      statut: "failed",
      companyId: config.configuration!.companyId,
    });

    throw new Error("Une erreur s'est produite", { cause: error });
  }
};

export const finhisCustomerSync = async () => {
  for (const global of globalLogs) {
    await loggerService.insert(global);
  }
};

const rollbackChanges = async (
  wooApi: WooCommerceRestApi,
  id: number | string
) => {
  try {
    logger.info(`Rolling back customer ${id} in WooCommerce`);
    await wooApi.delete(`customers/${id}`, {
      force: true,
    });
  } catch (error) {
    logger.error(`Failed to rollback customer ${id}`, error);
  }
};
