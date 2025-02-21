import prisma from "@/lib/db";
import type { CompanyCreate } from "@/types/company";

export class CompanyDBService {
  async upsertCompany(data: CompanyCreate) {
    return prisma.company.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  async findByCompanyId(id: string) {
    return prisma.company.findUnique({
      where: { id },
    });
  }

  async findByHandle(handle: string) {
    return prisma.company.findUnique({
      where: { handle },
    });
  }
}
