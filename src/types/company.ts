import { Company, Configuration } from "@prisma/client";

export type CompanyCreate = Omit<Company, "createdAt" | "updatedAt">;

export interface ConfigurationDto {
  id: string;
  companyId: string;

  apiUrl: string;
  consumerKey: string;
  consumerSecret: string;
  appVersion: string;

  apiKey: string;

  createdAt?: string;
  updatedAt?: string;
}

export interface CompanyDto {
  id: string;
  handle?: string;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  authorizationCode?: string | null;
  accessToken?: string | null;
  createdAt: string;
  updatedAt: string;
  configuration?: ConfigurationDto | null;
}

export type CompanyWithConfiguration = Company & {
  configuration: Configuration | null; 
};

