"use client";
import { retriveCompanny } from "@/app/actions/company";
import {  CompanyWithConfiguration } from "@/types/company";
import { useState, useEffect } from "react";

const useConfiguration = (companyId: string) => {
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [company, setCompany] = useState<CompanyWithConfiguration | undefined>(undefined)

  useEffect(() => {
    const verifyConfiguration = async () => {
      try {
        const response = await retriveCompanny(companyId);

        setCompany(response);
        setIsConfigured(response.configuration ? true : false);
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
