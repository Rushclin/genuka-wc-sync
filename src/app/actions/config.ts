"use server";

import prisma from "@/lib/db";
import { ConfigurationDto } from "@/types/company";

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
