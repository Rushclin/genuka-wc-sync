import prisma from "@/lib/db";
import logger, { GlobalLogs } from "../../utils/logger";
import { Logger } from "@prisma/client";

class LoggerDBService {
  async insert(data: GlobalLogs) {
    try {
      const { id, module, statut, type, companyId } = data;
      const result = prisma.logger.create({
        data: {
          elementId: id.toString(),
          module,
          statut,
          type,
          companyId,
        },
      });
      return result;
    } catch (error) {
      logger.error(`Une erreur s'est produite ${error}`);
      throw new Error("Une erreur s'est produite ", { cause: error });
    }
  }

  async retrieve(companyId: string): Promise<Logger[]> {
    try {
      return prisma.logger.findMany({
        where: {
          companyId,
        },
      });
    } catch (error) {
      logger.error(`Une erreur s'est produite ${error}`);
      throw new Error("Une erreur s'est produite ", { cause: error });
    }
  }
}

export default new LoggerDBService();
