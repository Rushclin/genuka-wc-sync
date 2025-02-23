"use server";

import { CompanyWithConfiguration } from "@/types/company";
import logger, { GlobalLogs } from "@/utils/logger";
import { Configuration } from "@prisma/client";
import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";
import Genuka from "genuka";

const globalLogs: GlobalLogs[] = [];

export const syncOrders = async (config: CompanyWithConfiguration): Promise<boolean> => {
  try {
    logger.debug("Init Woo Commerce and Genuka SDK");

    const genuka = await Genuka.initialize({ id: config.configuration!.companyId });

    // const wooApi = new WooCommerceRestApi({
    //   url: config.apiUrl,
    //   consumerKey: config.consumerKey,
    //   consumerSecret: config.consumerSecret,
    //   version: "wc/v3",
    //   queryStringAuth: true,
    // });

    logger.info("Retrivez ordres");

    const response = await fetch(
      `${process.env.GENUKA_URL}/${process.env.GENUKA_VERSION}/admin/orders?page=1&limit=10&filter=&sort=-orders_sum_amount&sort=-orders_count&include=orders_sum_amount&include=ordersCount`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        //   "X-Api-Key": config.apiKey,
        //   "X-Auth-Token": config.apiKey,
        //   "X-Company": config.,
          Authorization: `Bearer ${config.accessToken}`,
        },
      }
    )
      .then(async (res) => {
        // const rr = await res.json()
        console.log({ res });
      })
      .catch((err) => console.log({ err }));
    //   console.log({response})

    // const orders = await genuka.customers.me();

    // console.log({ orders });
    return true;
  } catch (error) {
    logger.error(`${error}`);

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
