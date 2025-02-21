"use client";
import { CompanyDto } from "@/types/company";
import { useState, useEffect } from "react";

interface ConfigurationResponse {
  company: CompanyDto;
}

const useConfiguration = (companyId: string) => {
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [company, setCompany] = useState<CompanyDto | undefined>(undefined)

  useEffect(() => {
    const verifyConfiguration = async () => {
      try {
        const response = await fetch(
          `/api/company/configuration?companyId=${companyId}`
        );
        
        const data: ConfigurationResponse = await response.json();
        const { company } = data;

        setCompany(company);
        setIsConfigured(company.configuration ? true : false);
      } catch (error) {
        console.error(
          "Erreur lors de la vérification de la configuration :",
          error
        );
        setIsConfigured(false);
      } finally {
        setIsLoading(false);
      }
    };

    verifyConfiguration();
  }, [companyId]);

  return { isConfigured, isLoading, company };
};

export default useConfiguration;
