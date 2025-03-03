"use server";

import { extractWooCustomerDtoInfoFromGenukaCustomer } from "@/lib/utils";
import { GenukaCustomerDto, WooCustomerDto } from "@/types/customer";
import logger, { GlobalLogs } from "@/utils/logger";
import { Configuration } from "@prisma/client";
import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";
import loggerService from "../../services/database/logger.service";
import { CompanyWithConfiguration } from "@/types/company";

const syncLogs: GlobalLogs[] = [];

/**
 * Synchronize customers from Genuka to WooCommerce
 * @param config Company configuration with API credentials
 * @returns Promise<boolean> indicating success or failure
 */
export const syncCustomers = async (
  config: CompanyWithConfiguration
): Promise<boolean> => {
  try {
    logger.debug("Initializing WooCommerce and Genuka SDK");
    const wooCommerceApi = new WooCommerceRestApi({
      url: config.configuration!.apiUrl,
      consumerKey: config.configuration!.consumerKey,
      consumerSecret: config.configuration!.consumerSecret,
      version: "wc/v3",
      queryStringAuth: true,
    });

    const genukaCustomers = await fetchAllGenukaCustomers(config);

    logger.info(`Retrieved ${genukaCustomers.length} customers from Genuka`);
    await syncCustomersToWooCommerce(wooCommerceApi, config, genukaCustomers);

    return true;
  } catch (error) {
    logger.error("Error occurred during customer synchronization", error);

    throw new Error("Customer synchronization failed", { cause: error });
  } finally {
    // Save all logs at the end of the process
    await finalizeSyncLogs();
  }
};

/**
 * Fetch all customers from Genuka API with pagination
 * @param config Company configuration with authentication details
 * @returns Promise<GenukaCustomerDto[]> List of customers from Genuka
 */
const fetchAllGenukaCustomers = async (
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
      `${process.env.GENUKA_URL}/${process.env.GENUKA_VERSION}/admin/customers?page=${currentPage}&anonymous=false`,
      requestOptions
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch Genuka customers: ${response.statusText}`);
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

/**
 * Process Genuka customers and sync them to WooCommerce
 * @param wooCommerceApi WooCommerce API client
 * @param config Company configuration
 * @param customers List of Genuka customers to sync
 */
export const syncCustomersToWooCommerce = async (
  wooCommerceApi: WooCommerceRestApi,
  config: CompanyWithConfiguration,
  customers: GenukaCustomerDto[]
) => {
  try {
    for (const genukaCustomer of customers) {
      let syncResult = null;
      try {
        const wooCustomerData = extractWooCustomerDtoInfoFromGenukaCustomer(genukaCustomer);

        // Check if customer already exists in WooCommerce by email
        const existingCustomersResponse = await wooCommerceApi.get(
          `customers/?email=${encodeURIComponent(genukaCustomer.email)}&role=all`
        );

        if (existingCustomersResponse.data && existingCustomersResponse.data.length > 0) {
          logger.info(`Customer with email ${genukaCustomer.email} already exists in WooCommerce`);
          const existingCustomerId = existingCustomersResponse.data[0].id;

          syncResult = await updateWooCommerceCustomer(
            wooCommerceApi,
            wooCustomerData,
            existingCustomerId,
            config.configuration!
          );
        } else {
          // Customer doesn't exist, create a new one
          syncResult = await createWooCommerceCustomer(
            wooCommerceApi, 
            config.configuration!, 
            wooCustomerData
          );
          
          // Optional: Update Genuka customer with WooCommerce ID
          // await updateGenukaCustomerWithWooId(config, genukaCustomer, syncResult.id);
        }
      } catch (error) {
        logger.error(
          `Error processing customer ${genukaCustomer.email}. Attempting rollback.`,
          error
        );
        
        if (syncResult && syncResult.id) {
          await rollbackCustomerChanges(wooCommerceApi, syncResult.id);
        }
        // Continue with the next customer instead of stopping the entire process
        continue;
      }
    }
  } catch (error) {
    logger.error("Error during WooCommerce customer synchronization", error);
    throw new Error("WooCommerce customer synchronization failed", {
      cause: error,
    });
  }
};

/**
 * Create a new customer in WooCommerce
 * @param wooCommerceApi WooCommerce API client
 * @param config Configuration with company ID
 * @param customer Customer data to create
 * @returns Created customer data
 */
const createWooCommerceCustomer = async (
  wooCommerceApi: WooCommerceRestApi,
  config: Configuration,
  customer: WooCustomerDto
) => {
  try {
    logger.debug(`Creating customer with email: ${customer.email}`);
    const response = await wooCommerceApi.post("customers", customer);
    logger.debug(`Successfully created customer: ${customer.email}`);

    syncLogs.push({
      type: "create",
      module: "customers",
      date: new Date(),
      id: customer.email,
      statut: "success",
      companyId: config.companyId,
    });
    
    return response.data;
  } catch (error) {
    logger.error(
      `Failed to create customer with email: ${customer.email}`,
      error
    );
    
    syncLogs.push({
      type: "create",
      module: "customers",
      date: new Date(),
      id: customer.email,
      statut: "failed",
      companyId: config.companyId,
    });

    throw new Error("Customer creation failed", { cause: error });
  }
};

/**
 * Update an existing customer in WooCommerce
 * @param wooCommerceApi WooCommerce API client
 * @param wooCustomer Updated customer data
 * @param woocommerceId WooCommerce customer ID
 * @param config Configuration with company ID
 * @returns Updated customer data
 */
const updateWooCommerceCustomer = async (
  wooCommerceApi: WooCommerceRestApi,
  wooCustomer: WooCustomerDto,
  woocommerceId: number,
  config: Configuration
) => {
  try {
    logger.debug(`Updating customer: ${wooCustomer.email}`);
    const response = await wooCommerceApi.put(`customers/${woocommerceId}`, wooCustomer);
    logger.debug(`Successfully updated customer: ${wooCustomer.email}`);

    syncLogs.push({
      type: "update",
      module: "customers",
      date: new Date(),
      id: wooCustomer.email,
      statut: "success",
      companyId: config.companyId,
    });

    return response.data;
  } catch (error) {
    logger.error(
      `Failed to update customer: ${wooCustomer.email}`,
      error
    );

    syncLogs.push({
      type: "update",
      module: "customers",
      date: new Date(),
      id: wooCustomer.email,
      statut: "failed",
      companyId: config.companyId,
    });

    throw new Error("Customer update failed", { cause: error });
  }
};

/**
 * Update a Genuka customer with WooCommerce ID
 * @param config Company configuration
 * @param genukaCustomer Original Genuka customer
 * @param woocommerceId WooCommerce customer ID
 * @returns Boolean indicating success
 */
const updateGenukaCustomerWithWooId = async (
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
      throw new Error(`Failed to update Genuka customer: ${response.statusText}`);
    }

    syncLogs.push({
      type: "update",
      module: "customers",
      date: new Date(),
      id: genukaCustomer.id,
      statut: "success",
      companyId: config.configuration!.companyId,
    });

    return true;
  } catch (error) {
    logger.error(`Failed to update Genuka customer metadata: ${error}`);

    syncLogs.push({
      type: "update",
      module: "customers",
      date: new Date(),
      id: genukaCustomer.id,
      statut: "failed",
      companyId: config.configuration!.companyId,
    });

    throw new Error("Genuka customer update failed", { cause: error });
  }
};

/**
 * Save all collected logs to the database
 */
export const finalizeSyncLogs = async () => {
  for (const logEntry of syncLogs) {
    await loggerService.insert(logEntry);
  }
  // Clear logs after saving
  syncLogs.length = 0;
};

/**
 * Rollback changes by deleting a customer in case of error
 * @param wooCommerceApi WooCommerce API client
 * @param id Customer ID to delete
 */
const rollbackCustomerChanges = async (
  wooCommerceApi: WooCommerceRestApi,
  id: number | string
) => {
  try {
    logger.info(`Rolling back customer ${id} in WooCommerce`);
    await wooCommerceApi.delete(`customers/${id}`, {
      force: true,
    });
    logger.info(`Successfully rolled back customer ${id}`);
  } catch (error) {
    logger.error(`Failed to rollback customer ${id}`, error);
  }
};