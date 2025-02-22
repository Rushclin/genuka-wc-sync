"use server";

import { extractWooCustomerDtoInfoFromGenukaCustomer } from "@/lib/utils";
import { GenukaCustomerDto } from "@/types/customer";
import { Configuration } from "@prisma/client";
import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";
import Genuka from "genuka";

interface ResponseGenukaCustomerDto {
  data: GenukaCustomerDto[];
}

export const syncCustomers = async (
  config: Configuration
): Promise<boolean> => {
  try {
    // Init Genuka and WooCommerce
    const genuka = await Genuka.initialize({ id: config.companyId });
    const wooApi = new WooCommerceRestApi({
      url: config.apiUrl,
      consumerKey: config.consumerKey,
      consumerSecret: config.consumerSecret,
      version: "wc/v3",
      queryStringAuth: true,
    });

    // Retrives customers
    const response = await fetch(
      `${process.env.GENUKA_URL}/${process.env.GENUKA_VERSION}/admin/customers?page=1&limit=10&filter=&sort=-orders_sum_amount&sort=-orders_count&include=orders_sum_amount&include=ordersCount`,
      {
        method: "GET",
        headers: {
          //   "Content-Type": "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          "X-API-Key": config.apiKey,
          "X-Company": config.companyId,
        },
      }
    );

    const { data } = (await response.json()) as ResponseGenukaCustomerDto;

    for (const d of data) {
      const custumerToCreate = extractWooCustomerDtoInfoFromGenukaCustomer(d);
      const resultCreate = await wooApi.post("customers", custumerToCreate);
      // .then((res) => {
      //   console.log({ res });
      // })
      // .catch((error) => {
      //   console.error(error.toJSON());
      // });
      console.log(resultCreate.data);
      updateGenukaCustomer();
    }

    return true;
  } catch (error) {
    console.error({ error });
    throw new Error("Une erreur s'est produite", { cause: error });
  }
};

const updateGenukaCustomer = () => {};
