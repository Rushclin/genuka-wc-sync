"use server";

import slugify from "slugify";
import logger, { GlobalLogs } from "@/utils/logger";
import { Option, ProductDto } from "@/types/product";
import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";
import { CompanyWithConfiguration } from "@/types/company";
import { convertGenukaProductToWooCommerceProduct } from "@/lib/utils";
import loggerService from "@/services/database/logger.service";


const globalLogs: GlobalLogs[] = [];

/**
 * Synchronize products from Genuka to WooCommerce
 * @param {CompanyWithConfiguration} companyConfig - Configuration of the company
 */
export const syncProducts = async (companyConfig: CompanyWithConfiguration) => {
  try {
    logger.info("Initializing Genuka and WooCommerce SDK");
    const wooCommerceApi = new WooCommerceRestApi({
      url: companyConfig.configuration!.apiUrl,
      consumerKey: companyConfig.configuration!.consumerKey,
      consumerSecret: companyConfig.configuration!.consumerSecret,
      version: "wc/v3",
      queryStringAuth: true,
    });
    const products = await fetchProductsFromGenuka(companyConfig);
    await upsertWooCommerceProducts(companyConfig, wooCommerceApi, products);
  } catch (error) {
    logger.error(`Error during product synchronization: ${error}`);
    throw new Error("An error occurred during synchronization", {
      cause: error,
    });
  }
};

/**
 * Fetch all products from Genuka
 * @param {CompanyWithConfiguration} companyConfig - Configuration of the company
 * @returns {Promise<ProductDto[]>} - List of products
 */
const fetchProductsFromGenuka = async (
  companyConfig: CompanyWithConfiguration
): Promise<ProductDto[]> => {
  const allProducts: ProductDto[] = [];
  let currentPage = 1;
  let hasNextPage = true;

  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Company": `${companyConfig.configuration?.companyId}`,
    Authorization: `Bearer ${companyConfig.accessToken}`,
  });

  while (hasNextPage) {
    const requestOptions = {
      method: "GET",
      headers,
    };

    const response = await fetch(
      `${process.env.GENUKA_URL}/${process.env.GENUKA_VERSION}/admin/products?page=${currentPage}`,
      requestOptions
    );

    if (!response.ok) {
      throw new Error("Failed to fetch Genuka products");
    }

    const { data, meta } = (await response.json()) as {
      data: ProductDto[];
      meta: { current_page: number; last_page: number };
    };

    allProducts.push(...data);
    currentPage++;
    hasNextPage = currentPage <= meta.last_page;
  }

  return allProducts;
};

export const isSyncing = async (companyConfig: CompanyWithConfiguration, productId: string) => {
  try{

 const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Company": `${companyConfig.configuration?.companyId}`,
    Authorization: `Bearer ${companyConfig.accessToken}`,
  });

  // const res = await fetch(`products/?whereColumn=metadata->woocommerceId&whereOperator=%3D&whereValue=${productId}&per_page=2`)


  }catch(error){
    logger.error("Une erreur s'est produite", error)
    throw new Error("Une erreur s'est produite lors de la verification de l'etat de veroullage", {cause: error})
  }
}

export const fetchProductFromGenukaWithId = async (
  id: string,
  companyConfig: CompanyWithConfiguration
) => {
  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Company": `${companyConfig.configuration?.companyId}`,
    Authorization: `Bearer ${companyConfig.accessToken}`,
  });

  const requestOptions = {
    method: "GET",
    headers,
  };

  const response = await fetch(
    `${process.env.GENUKA_URL}/${process.env.GENUKA_VERSION}/admin/products/${id}`,
    requestOptions
  );

  if (!response.ok) {
    throw new Error("Failed to fetch Genuka products");
  }
  const data = await response.json();

  return data;
};

/**
 * Upsert products in WooCommerce
 * @param {CompanyWithConfiguration} companyConfig - Configuration of the company
 * @param {WooCommerceRestApi} wooCommerceApi - WooCommerce API instance
 * @param {ProductDto[]} genukaProducts - List of products from Genuka
 */
export const upsertWooCommerceProducts = async (
  companyConfig: CompanyWithConfiguration,
  wooCommerceApi: WooCommerceRestApi,
  genukaProducts: ProductDto[]
) => {
  try {
    const results: any[] = [];
    let createdOrUpdatedProduct: any = null;

    for (const genukaProduct of genukaProducts) {
      try {
        if (genukaProduct.metadata && genukaProduct.metadata.woocommerceId) {
          logger.info(
            `Product ${genukaProduct.title} already exists in WooCommerce`
          );
          createdOrUpdatedProduct = await updateWooProduct(
            genukaProduct,
            wooCommerceApi
          );
          globalLogs.push({
            type: "update",
            module: "products",
            date: new Date(),
            id: createdOrUpdatedProduct.id,
            statut: "success",
            companyId: companyConfig.configuration!.companyId,
          });
        } else {
          logger.info(
            `Product ${genukaProduct.title} does not exist in WooCommerce`
          );
          createdOrUpdatedProduct = await createWooProduct(
            genukaProduct,
            wooCommerceApi
          );
          await updateGenukaProduct(
            genukaProduct,
            createdOrUpdatedProduct.id,
            companyConfig
          );
          globalLogs.push({
            type: "create",
            module: "products",
            date: new Date(),
            id: createdOrUpdatedProduct.id,
            statut: "success",
            companyId: companyConfig.configuration!.companyId,
          });
        }
        results.push(createdOrUpdatedProduct);
      } catch (error) {
        console.log(error);
        if (createdOrUpdatedProduct) {
          logger.error(
            `Error processing product ${genukaProduct.title}: ${error}`
          );
          await rollbackChanges(wooCommerceApi, createdOrUpdatedProduct.id);
        }
      }
    }
    return results;
  } catch (error) {
    logger.error(`Error during product upsert: ${error}`);
    throw new Error("An error occurred during product synchronization", {
      cause: error,
    });
  }
};

/**
 * Create a product in WooCommerce
 * @param {ProductDto} genukaProduct - Product data from Genuka
 * @param {WooCommerceRestApi} wooCommerceApi - WooCommerce API instance
 * @returns {Promise<any>} - Created product data
 */
export const createWooProduct = async (
  genukaProduct: ProductDto,
  wooCommerceApi: WooCommerceRestApi
) => {
  try {
    const { variants } = genukaProduct;
    const wooProductData = convertGenukaProductToWooCommerceProduct(
      genukaProduct,
      []
    );

    logger.info(`Creating product in WooCommerce: ${wooProductData.name}`);
    const { data: createdProduct } = await wooCommerceApi.post(
      "products",
      wooProductData
    );

    logger.info(`Product created successfully: ${wooProductData.name}`);

    if (variants.length > 0) {
      logger.info(
        `Creating ${variants.length} variants for product: ${genukaProduct.title}`
      );
      await createOrUpdateWooProductVariants(
        genukaProduct,
        createdProduct.id,
        wooCommerceApi
      );
    }

    return createdProduct;
  } catch (error) {
    logger.error(`Error creating product: ${error}`);
    throw new Error("An error occurred while creating the product", {
      cause: error,
    });
  }
};

/**
 * Update a product in WooCommerce
 * @param {ProductDto} genukaProduct - Product data from Genuka
 * @param {WooCommerceRestApi} wooCommerceApi - WooCommerce API instance
 * @returns {Promise<any>} - Updated product data
 */
export const updateWooProduct = async (
  genukaProduct: ProductDto,
  wooCommerceApi: WooCommerceRestApi
) => {
  try {
    const { variants, metadata } = genukaProduct;
    const wooProductData = convertGenukaProductToWooCommerceProduct(
      genukaProduct,
      []
    );

    logger.info(`Updating product in WooCommerce: ${genukaProduct.title}`);
    const { data: updatedProduct } = await wooCommerceApi.put(
      `products/${metadata!.woocommerceId}`,
      wooProductData
    );
    logger.info(`Product updated successfully: ${genukaProduct.title}`);

    if (variants.length > 0) {
      logger.info(
        `Updating ${variants.length} variants for product: ${genukaProduct.title}`
      );
      await createOrUpdateWooProductVariants(
        genukaProduct,
        updatedProduct.id,
        wooCommerceApi
      );
    }

    return updatedProduct;
  } catch (error) {
    logger.error(`Error updating product: ${error}`);
    throw new Error("An error occurred while updating the product", {
      cause: error,
    });
  }
};

/**
 * Update product metadata in Genuka
 * @param {ProductDto} genukaProduct - Product data from Genuka
 * @param {number} woocommerceId - WooCommerce product ID
 * @param {CompanyWithConfiguration} companyConfig - Configuration of the company
 */
export const updateGenukaProduct = async (
  genukaProduct: ProductDto,
  woocommerceId: number,
  companyConfig: CompanyWithConfiguration
) => {
  try {
    logger.info(
      `Updating metadata for product ${genukaProduct.title} in Genuka`
    );

    const headers = new Headers({
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Company": `${companyConfig.configuration!.companyId}`,
      Authorization: `Bearer ${companyConfig.accessToken}`,
    });

    const updatedMetadata = {
      ...genukaProduct.metadata,
      woocommerceId: woocommerceId,
      dateLastSync: Date.now(),
    };

    const response = await fetch(
      `${process.env.GENUKA_URL}/${process.env.GENUKA_VERSION}/admin/products/${genukaProduct.id}`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({
          ...genukaProduct,
          metadata: updatedMetadata,
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to update product metadata in Genuka");
    }

    logger.info(
      `Metadata updated successfully for product ${genukaProduct.title}`
    );
    return response.json();
  } catch (error) {
    logger.error(`Error updating product metadata: ${error}`);
    throw new Error("An error occurred while updating product metadata", {
      cause: error,
    });
  }
};

/**
 * Create product variants in WooCommerce
 * @param {ProductDto} genukaProduct - Product data from Genuka
 * @param {number} wooProductId - WooCommerce product ID
 * @param {WooCommerceRestApi} wooCommerceApi - WooCommerce API instance
 */
export const createWooProductVariants = async (
  genukaProduct: ProductDto,
  wooProductId: number,
  wooCommerceApi: WooCommerceRestApi
) => {
  try {
    const { variants, options } = genukaProduct;

    for (const variant of variants) {
      const data = {
        regular_price: variant.price.toString(),
        attributes: [
          ...options.map((option) => ({
            name: option.title,
            option: option.values[variant.position - 1],
            variation: true,
            visible: true,
          })),
        ],
        sku: variant.sku,
        stock_quantity: variant.estimated_quantity ?? 1,
        manage_stock: true,
        meta_data: [
          {
            key: "genuka_variant_id",
            value: variant.id,
          },
        ],
      };

      logger.info(`Creating variant: ${variant.title}`);
      await wooCommerceApi
        .post(`products/${wooProductId}/variations`, data)
        .then((response) =>
          logger.info(`Variant created: ${JSON.stringify(response.data)}`)
        )
        .catch((error) =>
          logger.error(`Error creating variant: ${error.response}`)
        );
    }
  } catch (error) {
    logger.error(`Error creating product variants: ${error}`);
    throw new Error("An error occurred while creating product variants", {
      cause: error,
    });
  }
};

export const createOrUpdateWooProductVariants = async (
  genukaProduct: ProductDto,
  wooProductId: number,
  wooCommerceApi: WooCommerceRestApi
) => {
  try {
    const { variants, options } = genukaProduct;

    const existingVariantsResponse = await wooCommerceApi.get(
      `products/${wooProductId}/variations`
    );
    const existingVariants = existingVariantsResponse.data;

    for (const variant of variants) {
      const data = {
        regular_price: variant.price.toString(),
        attributes: [
          ...options.map((option) => ({
            name: option.title,
            option: option.values[variant.position - 1],
            variation: true,
            visible: true,
          })),
        ],
        sku: variant.sku,
        stock_quantity: variant.estimated_quantity ?? 1,
        manage_stock: true,
        meta_data: [
          {
            key: "genuka_variant_id",
            value: variant.id,
          },
        ],
      };

      // Vérifier si la variante existe déjà en utilisant l'identifiant Genuka
      const existingVariant = existingVariants.find((v: any) => {
        const genukaVariantIdMeta = v.meta_data.find(
          (meta: any) => meta.key === "genuka_variant_id"
        );
        return genukaVariantIdMeta && genukaVariantIdMeta.value === variant.id;
      });

      if (existingVariant) {
        logger.info(`Updating variant: ${variant.title}`);
        await wooCommerceApi
          .put(
            `products/${wooProductId}/variations/${existingVariant.id}`,
            data
          )
          .then((response) =>
            logger.info(`Variant updated: ${JSON.stringify(response.data)}`)
          )
          .catch((error) =>
            logger.error(`Error updating variant: ${error.response}`)
          );
      } else {
        logger.info(`Creating variant: ${variant.title}`);
        await wooCommerceApi
          .post(`products/${wooProductId}/variations`, data)
          .then((response) =>
            logger.info(`Variant created: ${JSON.stringify(response.data)}`)
          )
          .catch((error) =>
            logger.error(`Error creating variant: ${error.response}`)
          );
      }
    }
  } catch (error) {
    logger.error(`Error creating/updating product variants: ${error}`);
    throw new Error(
      "An error occurred while creating/updating product variants",
      {
        cause: error,
      }
    );
  }
};

/**
 * Create attributes in WooCommerce
 * @param {WooCommerceRestApi} wooCommerceApi - WooCommerce API instance
 * @param {Option[]} options - List of options from Genuka
 * @returns {Promise<{ id: number; options: string[] }[]>} - List of created attributes
 */
export const createWooAttributes = async (
  wooCommerceApi: WooCommerceRestApi,
  options: Option[]
): Promise<{ id: number; options: string[] }[]> => {
  const attributes: { id: number; options: string[] }[] = [];

  try {
    for (const option of options) {
      if (!option) {
        logger.debug("Skipping empty option");
        continue;
      }

      const slug = slugify(option.title, { replacement: "_" });
      logger.info(`Creating attribute: ${option.title}`);

      const existingAttribute = await getWooAttributeBySlug(
        wooCommerceApi,
        slug
      );
      if (existingAttribute) {
        attributes.push({ id: existingAttribute.id, options: option.values });
      } else {
        const newAttribute = await wooCommerceApi.post("products/attributes", {
          name: option.title,
          slug,
          type: "select",
          order_by: "menu_order",
          has_archives: false,
        });
        attributes.push({ id: newAttribute.id, options: option.values });
      }
      logger.info(`Attribute created successfully: ${option.title}`);
    }

    return attributes;
  } catch (error) {
    logger.error(`Error creating attributes: ${error}`);
    throw new Error("An error occurred while creating attributes", {
      cause: error,
    });
  }
};

/**
 * Fetch WooCommerce attribute by slug
 * @param {WooCommerceRestApi} wooCommerceApi - WooCommerce API instance
 * @param {string} slug - Attribute slug
 * @returns {Promise<any>} - Attribute data
 */
const getWooAttributeBySlug = async (
  wooCommerceApi: WooCommerceRestApi,
  slug: string
): Promise<any> => {
  try {
    logger.info(`Fetching WooCommerce attribute with slug: ${slug}`);
    const response = await wooCommerceApi.get("products/attributes", { slug });

    if (response.data.length === 0) {
      return null;
    }

    return response.data[0];
  } catch (error) {
    logger.error(`Error fetching attribute: ${error}`);
    throw new Error("Failed to fetch WooCommerce attribute", {
      cause: error,
    });
  }
};

/**
 * Rollback changes in WooCommerce
 * @param {WooCommerceRestApi} wooCommerceApi - WooCommerce API instance
 * @param {number | string} productId - Product ID to delete
 */
const rollbackChanges = async (
  wooCommerceApi: WooCommerceRestApi,
  productId: number | string
) => {
  try {
    logger.info(`Rolling back product ${productId} in WooCommerce`);
    await wooCommerceApi.delete(`products/${productId}`, { force: true });
  } catch (error) {
    logger.error(`Failed to rollback product ${productId}: ${error}`);
  }
};

/**
 * Finalize product synchronization
 */
export const finalizeProductSync = async () => {
  for (const log of globalLogs) {
    await loggerService.insert(log);
  }
};
