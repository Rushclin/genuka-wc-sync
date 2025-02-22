"use server";

import { extractWooProductDtoInfoFromGenukaProductDto } from "@/lib/utils";
import { ProductDto, VariantDto } from "@/types/product";
import { Configuration } from "@prisma/client";
import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";
import Genuka from "genuka";
import slugify from "slugify";

// export async function create() {
//   fetch(
//     `${process.env.GENUKA_URL}/${process.env.GENUKA_VERSION}/company/products/jdjddjdjsjd`
//   )
//     .then((re) => {
//       console.log(re);
//     })
//     .catch((err) => console.log(err));
// }

// export const syncProductAttribute

export const syncProduct = async (config: Configuration) => {
  try {
    // Init Genuka
    const genuka = await Genuka.initialize({ id: config.companyId });
    const wooApi = new WooCommerceRestApi({
      url: config.apiUrl,
      consumerKey: config.consumerKey,
      consumerSecret: config.consumerSecret,
      version: "wc/v3",
      queryStringAuth: true,
    });

    const genukaProducts = (await genuka.productService.list(
      {}
    )) as ProductDto[];

    // Create product in Woo Commerce
    for (const genukaProduct of genukaProducts.slice(0, 2)) {
      // If product have metadata and in woocommerceId in metadata, update it
      if (genukaProduct.metadata && genukaProduct.metadata.woocommerceId) {
        await updateWooProduct(genukaProduct, config);
      } else {
        await createWooProduct(genukaProduct, genuka, wooApi, config);
      }
    }
  } catch (error: unknown) {
    console.error({ error });
    throw new Error("Une erreur s'est produite lors de la synchronisation", {
      cause: error,
    });
  }
};

export const createWooProduct = async (
  genukaProduct: ProductDto,
  genuka: Genuka,
  wooApi: WooCommerceRestApi,
  config: Configuration
) => {
  try {
    // Test if product have variants ie attribute in WooCommer.
    // Pour creer les variantes, il faut d'abord creer les attributs (chose que sur Genuka on ne stocke pas encore)

    //   console.log(genukaProduct.options);
    const { variants } = genukaProduct;

    //   if (options.length) {
    //     for (const option of options) {
    //       // On doit creer les attributs de WooCommerce ici, option dans Genuka
    //       const res = await wooApi.post(`products/attributes`, {
    //         name: option.title,
    //         slug: slugify(option.title, {replacement: "_"}),
    //         type: "select",
    //         order_by: "menu_order",
    //         has_archives: true,
    //       });
    //       optionIndex.push({ id: res.id });
    //     }
    //   }

    const wooProduct = extractWooProductDtoInfoFromGenukaProductDto(
      genukaProduct,
      []
    );

    const resultCreateWooProduct = await wooApi.post("products", wooProduct);
    //   .then(respoooo => console.log({respoooo})).catch(err => console.log({err}))

    //  wooApi.post("products", wooProduct)
    //  .then(respoooo => console.log({respoooo}))
    //  .catch(err => console.log(err.response))

    // creer le produit

    const { data } = resultCreateWooProduct;

    await createWooProductVariant(variants, data.id, wooApi);

    await updateGenukaProduct(genukaProduct, data.id, config);

    //   console.log("wooProduct", { wooProduct });
  } catch (error) {
    console.error(error);
    throw new Error("Une erreur s'est produite", { cause: error });
  }
};

export const updateWooProduct = async (
  genukaProduct: ProductDto,
  config: Configuration
) => {
  const wooApi = new WooCommerceRestApi({
    url: config.apiUrl,
    consumerKey: config.consumerKey,
    consumerSecret: config.consumerSecret,
    version: "wc/v3",
    queryStringAuth: true,
  });

  console.log("Update", { genukaProduct });
};

export const updateGenukaProduct = async (
  genukaProduct: ProductDto,
  wooProductId: number,
  config: Configuration
): Promise<boolean> => {
  try {
    // Retrieve product
    const res = await  fetch(
      `${process.env.GENUKA_URL}/${process.env.GENUKA_VERSION}/admin/products/${genukaProduct.id}`,
      {
        method: "PUT",
        headers: {
          //   "Content-Type": "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          "X-API-Key": config.apiKey,
          "X-Company": config.companyId,
          // "X-Shop": this.genuka_shop_id,
        },
        body: JSON.stringify({
          ...genukaProduct,
          metadata: {
            woocommerceId: wooProductId,
          },
        }),
      }
    )
    
    if (!res.ok) {
      throw new Error(
        "Une erreur s'est produite lors de la mise à jour des métadonnées",
        { cause: res }
      );
    }

    return true;
  } catch (error) {
    console.error(error);
    throw new Error(
      "Une erreur s'est produite lors de la mise à jour des métadonnées",
      { cause: error }
    );
  }
};

export const createWooProductVariant = async (
  variants: VariantDto[],
  wooProductId: number,
  wooApi: WooCommerceRestApi
) => {
  try {
    if (variants.length) {
      for (const variant of variants) {
        const attributes: { id: number; options: string[] }[] = [];
        const { options } = variant;

        if (options.length) {
          for (const option of options) {
            if (!option) break;
            // On doit creer les attributs de WooCommerce ici, option dans Genuka
            const genukaAttribute = await wooApi.post(`products/attributes`, {
              name: option.title,
              slug: slugify(option.title, { replacement: "_" }),
              type: "select",
              order_by: "menu_order",
              has_archives: true,
            });
            attributes.push({ id: genukaAttribute.id, options: option.values });
          }
        }

        await wooApi.post(`products/${wooProductId}/variations`, {
          regular_price: variant.price.toString(),
          //   image: {
          //     src: 1,
          //   },
          attributes: [
            ...attributes.map((a) => ({
              id: a.id,
              option: a.options.map((i) => i),
            })),
          ],
        });
      }
    }
  } catch (error) {
    console.error("Erreur lors de la creation des variantes");
    throw new Error("Une erreur est survenu lors de a creation des variantes", {
      cause: error,
    });
  }
};
