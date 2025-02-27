import cron from "node-cron";
import { listCompanies } from "@/app/actions/company";
import logger from "./logger";
import { finhisCustomerSync, syncCustomers } from "@/app/actions/customers";
import { finhisProductSync, syncProduct } from "@/app/actions/products";
import { finhisOrdersSync, syncOrders } from "@/app/actions/orders";

const schedule = process.env.NEXT_PUBLIC_SCHEDULE_TASK ?? "0 * * * *";

cron.schedule(schedule, async () => {
  try {
    const companies = await listCompanies();
    logger.debug(
      "On doit faire la synchronisation chez toutes les personnes qui ont installe"
    );
    for (const company of companies) {
      await syncCustomers(company);
      await finhisCustomerSync();
      await syncProduct(company);
      await finhisProductSync();
      await syncOrders(company);
      await finhisOrdersSync();
    }

    console.log("✅ Synchronisation terminée !");
  } catch (error) {
    console.error("❌ Erreur pendant la synchronisation :", error);
  }
});
