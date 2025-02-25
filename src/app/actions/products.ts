"use server";

import { extractWooProductDtoInfoFromGenukaProductDto } from "@/lib/utils";
import loggerService from "@/services/database/logger.service";
import { CompanyWithConfiguration } from "@/types/company";
import { ProductDto, VariantDto } from "@/types/product";
import logger, { GlobalLogs } from "@/utils/logger";
import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";
import slugify from "slugify";

const globalLogs: GlobalLogs[] = [];

/**
 * @param {CompanyWithConfiguration} config
 */
export const syncProduct = async (config: CompanyWithConfiguration) => {
  try {
    logger.info("Init Genuka and Woo Commerce SDK");
    const wooApi = new WooCommerceRestApi({
      url: config.configuration!.apiUrl,
      consumerKey: config.configuration!.consumerKey,
      consumerSecret: config.configuration!.consumerSecret,
      version: "wc/v3",
      queryStringAuth: true,
    });

    const products = await fetchAllGenukaProducts(config);

    await upsertWooProduct(config, wooApi, products);

  } catch (error) {
    logger.error(`${error}`);
    throw new Error("Une erreur s'est produite lors de la synchronisation", {
      cause: error,
    });
  }
};





const fetchAllGenukaProducts = async (
  config: CompanyWithConfiguration
): Promise<ProductDto[]> => {
  const allProducts: ProductDto[] = [];
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



/**
 * Update or Create Woo Commerce product
 * @param {CompanyWithConfiguration} config
 * @param {WooCommerceRestApi} wooApi
 * @param {ProductDto[]} genukaProducts
 */
export const upsertWooProduct = async (
  config: CompanyWithConfiguration,
  wooApi: WooCommerceRestApi,
  genukaProducts: ProductDto[]
) => {
  try {
    const results: any[] = [];
    let res: any = null;
    for (const genukaProduct of genukaProducts) {
      try {
        if (genukaProduct.metadata && genukaProduct.metadata.woocommerceId) {
          logger.info(
            `Product ${genukaProduct.id} already exist in Woo Commerce`
          );

          res = await updateWooProduct(genukaProduct, wooApi);
          globalLogs.push({
            type: "update",
            module: "products",
            date: new Date(),
            id: res.id,
            statut: "success",
            companyId: config.configuration!.companyId,
          });
          results.push(res);
        } else {
          logger.info(`Product ${genukaProduct.id} not exist in Woo Commerce`);
          res = await createWooProduct(genukaProduct, wooApi);
          await updateGenukaProduct(genukaProduct, res.id, config);
          globalLogs.push({
            type: "create",
            module: "products",
            date: new Date(),
            id: res.id,
            statut: "success",
            companyId: config.configuration!.companyId,
          });
          results.push(res);
        }
      } catch (error) {
        logger.error(
          `Error processing order ${genukaProduct.id}. Rolling back changes.`,
          error
        );
        if (res) {
          await rollbackChanges(wooApi, res.id);
        } else {
          await rollbackChanges(wooApi, genukaProduct!.metadata!.woocommerceId);
        }
        continue;
      }
    }
    return results;
  } catch (error) {
    logger.error("Une erreur s'est produite",error);
    globalLogs.push({
      type: "create",
      module: "products",
      date: new Date(),
      id: "N/A",
      statut: "failed",
      companyId: config.configuration!.companyId,
    });
    throw new Error("Une erreur s'est produite lors de la synchronisation", {
      cause: error,
    });
  }
};

export const createWooProduct = async (
  genukaProduct: ProductDto,
  wooApi: WooCommerceRestApi
) => {
  try {
    const { variants } = genukaProduct;

    const wooProduct = extractWooProductDtoInfoFromGenukaProductDto(
      genukaProduct,
      []
    );

    logger.info(`Create product in Woo Commerce ${wooProduct.name}`);
    const { data } = await wooApi.post("products", wooProduct);
    logger.info(`End create product in Woo Commerce ${wooProduct.name}`);

    if (variants.length > 0) {
      logger.info(
        `Create ${variants.length} of product ${genukaProduct.title}`
      );
      await createWooProductVariant(variants, data.id, wooApi);
    }

    return data;
  } catch (error) {
    logger.error(`${error}`);
    throw new Error("Une erreur s'est produite", { cause: error });
  }
};

export const updateWooProduct = async (
  genukaProduct: ProductDto,
  wooApi: WooCommerceRestApi
) => {
  try {
    logger.info(`Trying update ${genukaProduct.title} in Woo Commerce`);
    const wooProduct = extractWooProductDtoInfoFromGenukaProductDto(
      genukaProduct,
      []
    );
    const { metadata } = genukaProduct;
    const result = await wooApi.put(
      `products/${metadata!.woocommerceId}`,
      wooProduct
    );
    logger.info(`End updating product in Woo Commerce`);

    return result.data;
  } catch (error) {
    logger.error(`${error}`);
    throw new Error("Une erreur s'est produite", { cause: error });
  }
};

export const updateGenukaProduct = async (
  genukaProduct: ProductDto,
  woocommerceId: number,
  config: CompanyWithConfiguration
) => {
  try {
    logger.info("Update Specifique metadatavproduct on Genuka");

    const headers = new Headers();
    headers.append("Accept", "application/json");
    headers.append("Content-Type", "application/json");
    headers.append("X-Company", `${config?.configuration!.companyId}`);
    headers.append("Authorization", `Bearer ${config.accessToken}`);

    const updatedMetadata = {
      ...genukaProduct.metadata,
      woocommerceId: woocommerceId,
    };

    const body = JSON.stringify({
      ...genukaProduct,
      metadata: updatedMetadata,
    });

    const res = await fetch(
      `${process.env.GENUKA_URL}/${process.env.GENUKA_VERSION}/admin/products/${genukaProduct.id}`,
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
    logger.error(
      "Une erreur s'est produite lors de la mise a jour du produit dans Genuka",
      error
    );
    throw new Error(
      "Une erreur s'est produite lors de la mise à jour des métadonnées",
      { cause: error }
    );
  }
};

/**
 *
 * @param {VariantDto} variants
 * @param {number} wooProductId
 * @param {WooCommerceRestApi} wooApi
 */
export const createWooProductVariant = async (
  variants: VariantDto[],
  wooProductId: number,
  wooApi: WooCommerceRestApi
) => {
  try {
    for (const variant of variants) {
      let attributes: { id: number; options: string[] }[] = [];
      const { options } = variant;

      if (options.length) {
        logger.info(
          `La variante ${variant.title} dispose de ${options.length} attribut`
        );
        attributes = await createWooAttributes(wooApi, options);
      }

      logger.info(`Creation de la variante`);
      await wooApi.post(`products/${wooProductId}/variations`, {
        regular_price: variant.price.toString(),
        attributes: [
          ...attributes.map((a) => ({
            id: a.id,
            option: a.options.map((i) => i),
          })),
        ],
      });
      logger.info(`Fin de la creation de la variante`);
    }
  } catch (error) {
    logger.error("Erreur lors de la creation des variantes", error);
    throw new Error("Une erreur est survenu lors de a creation des variantes", {
      cause: error,
    });
  }
};

export const createWooAttributes = async (
  wooApi: WooCommerceRestApi,
  options: Array<{ id: string; title: string; values: string[] }>
) => {
  const attributes: { id: number; options: string[] }[] = [];

  try {
    for (const option of options) {
      if (!option) {
        logger.debug("Pas d'option");
        break;
      }
      logger.info(`Creation de l'attribut ${option.title}`);
      // On doit creer les attributs de WooCommerce ici, option dans Genuka
      const genukaAttribute = await wooApi.post(`products/attributes`, {
        name: option.title,
        slug: slugify(option.title, { replacement: "_" }),
        type: "select",
        order_by: "menu_order",
        has_archives: true,
      });
      attributes.push({ id: genukaAttribute.id, options: option.values });
      logger.info(`Fin de la creation de l'attribut ${option.title}`);
    }

    return attributes;
  } catch (error) {
    logger.error(
      "Une erreur s'est produite lors de la creation des attributs",
      error
    );
    throw new Error("Une erreur s'est produite", { cause: error });
  }
};

export const finhisProductSync = async () => {
  for (const global of globalLogs) {
    await loggerService.insert(global);
  }
};

const rollbackChanges = async (
  wooApi: WooCommerceRestApi,
  id: number | string
) => {
  try {
    logger.info(`Rolling back product ${id} in WooCommerce`);
    await wooApi.delete(`products/${id}`, {
      force: true,
    });
  } catch (error) {
    logger.error(`Failed to rollback product ${id}`, error);
  }
};
