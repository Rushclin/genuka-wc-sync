"use server";

import prisma from "@/lib/db";
import { ConfigurationDto } from "@/types/company";
import { Logger } from "@prisma/client";

export const saveConfiguration = async (
  data: ConfigurationDto
): Promise<boolean> => {
  try {
    await prisma.configuration.create({
      data: { ...data },
    });

    return true;
  } catch (error) {
    throw new Error("Une erreur s'est produite", { cause: error });
  }
};

// export const retrieveConfiguration = async (
//   companyId: string
// ): Promise<CompanyWithConfiguration> => {
//   try {
//     return prisma.configuration.findFirst({
//       where: {
//         companyId,
//       },
//       include: {
//         company: true,
//       },
//     });
//   } catch (error) {
//     throw new Error("Une erreur s'est produite", { cause: error });
//   }
// };

export const retrieveGlobalLogs = async (
  companyId: string
): Promise<Logger[]> => {
  try {
    return prisma.logger.findMany({
      where: {
        companyId,
      },
    });
  } catch (error) {
    throw new Error("Une erreur s'est produite", { cause: error });
  }
};
