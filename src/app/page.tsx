"use client"
import { Button } from "@/components/ui/button";
import Spinner from "@/components/ui/spinner";
import useConfiguration from "@/hooks/use-configuration";
import { ArrowRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

export default function Home() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const companyId = searchParams.get("company_id");

  if (!companyId) {
    return (
      <div>
        <p className="text-slate-800 text-sm text-center">La companie pour laquelle vous souhaitez installer l&apos;application est introuvable <br/> Il faut passer par le <a href="https://genuka.com/apps" target="_blank" className="underline">store Genuka</a> pour le faire </p>
      </div>
    )
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { isConfigured, isLoading } = useConfiguration(companyId);

  if (isLoading) {
    return (
      <Spinner className="" />
    )
  }

  const goToConfig = () => {
    router.push(`/pages/config?companyId=${companyId}`, { scroll: false })
  }

  const goToSync = () => {
    router.push(`/pages/synchronisation?companyId=${companyId}`, { scroll: false })
  }

  return (
    <>
      <div className="text-center">
        <h3 className="text-3xl mb-10">
          <span className="text-primary">Bienvennue</span> !
        </h3>
        <div className="">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="text-xl text-slate-700 font-normal">
              <p>Nous sommes heureux que vous ayez choisi notre plugin</p>
              <p className="text-sm">Pour cette première étape, nous allons configurer.</p>
            </div>
          </div>
          <div className="mt-10">
            <Button className="border" onClick={() => isConfigured ? goToSync() : goToConfig()
            }>
              {isConfigured ? <>Commencer la synchronisation</> : <>Configurer Woo Commerce</>} <ArrowRight />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
