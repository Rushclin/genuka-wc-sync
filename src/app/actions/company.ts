"use server";

import prisma from "@/lib/db";
import { CompanyWithConfiguration } from "@/types/company";

export const retriveCompanny = async (
  companyId: string
): Promise<CompanyWithConfiguration> => {
  try {
    const company = await prisma.company.findFirst({
      where: { id: companyId },
      include: {
        configuration: true,
      },
    });

    if (!company) {
      throw new Error("La company n'existe pas", {cause: company});
    }

    return company;
  } catch (error) {
    console.error(error);
    throw new Error(`Une erreur s\'est produite `, { cause: error });
  }
};
