"use server";

import { CompanyWithConfiguration } from "@/types/company";
import { GenukaOrderDto } from "@/types/order";
import logger, { GlobalLogs } from "@/utils/logger";
import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";
import Genuka from "genuka";

const globalLogs: GlobalLogs[] = [];
interface ResponseGenukaOrdersDto {
  data: GenukaOrderDto[];
}

interface ResponseGenukaOrderDto {
  data: GenukaOrderDto;
}

export const syncOrders = async (
  config: CompanyWithConfiguration
): Promise<boolean> => {
  try {
    logger.debug("Init Woo Commerce and Genuka SDK");

    const genuka = await Genuka.initialize({
      id: config.configuration!.companyId,
    });

    const wooApi = new WooCommerceRestApi({
      url: config.configuration!.apiUrl,
      consumerKey: config.configuration!.consumerKey,
      consumerSecret: config.configuration!.consumerSecret,
      version: "wc/v3",
      queryStringAuth: true,
    });

    logger.info("Retrivez ordres");

    const headers = new Headers();
    headers.append("Accept", "application/json");
    headers.append("X-Company", `${config.configuration?.companyId}`);
    headers.append("Authorization", `Bearer ${config.accessToken}`);

    const requestOptions = {
      method: "GET",
      headers,
    };

    const genukaOrders = await fetch(
      `${process.env.GENUKA_URL}/${process.env.GENUKA_VERSION}/admin/orders?include=products`,
      requestOptions
    );

    const { data } = (await genukaOrders.json()) as ResponseGenukaOrdersDto;

    for (const genukaOrder of data.slice(0, 1)) {
      const { billing } = genukaOrder;
      console.log({ billing });

      // const dddd =
      //   (await genukaProductItem.json()) as GenukaOrderDto
      // console.log(dddd.id);
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
      companyId: config.configuration!.companyId,
    });

    throw new Error("Une erreur s'est produite", { cause: error });
  }
};
