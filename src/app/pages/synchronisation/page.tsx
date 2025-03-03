"use client"

import { Button } from '@/components/ui/button';
import { useSearchParams } from 'next/navigation';
import React, { useEffect, useState } from 'react'
import { columns } from './columns';
import { DataTable } from './data-table';
import useConfiguration from '@/hooks/use-configuration';
import { finalizeProductSync, syncProducts } from '@/app/actions/products';
import { useToast } from '@/hooks/use-toast';
import Spinner from '@/components/ui/spinner';
import { finalizeSyncLogs, syncCustomers } from '@/app/actions/customers';
import { GlobalLogs } from '@/utils/logger';
import { retrieveGlobalLogs } from '@/app/actions/config';
import { fromPrismaLogToGlobalLogDto } from '@/lib/utils';
import { finhisOrdersSync, syncOrders } from '@/app/actions/orders';

const SynchronisationPage = () => {

    const searchParams = useSearchParams();
    const companyId = searchParams.get("companyId");
    const { toast } = useToast()

    const [loading, setLoading] = useState(false)
    const [globalLogs, setGlobalLogs] = useState<GlobalLogs[]>([])

    useEffect(() => {
        if (companyId) {
            const retreive = async () => {
                const logs = await retrieveGlobalLogs(companyId);
                setGlobalLogs(logs.map(fromPrismaLogToGlobalLogDto))
            }
            retreive()
        }
    }, [companyId, loading])


    if (!companyId) {
        return (
            <div>
                <p className="text-slate-800 text-sm text-center">La companie pour laquelle vous souhaitez installer l&apos;application est introuvable <br /> Il faut passer par le store Genuka pour le faire </p>
            </div>
        )
    }

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { company } = useConfiguration(companyId)
    if (!company) {
        return (
            <div>
                <p className="text-slate-800 text-sm text-center">La companie pour laquelle vous souhaitez installer l&apos;application est introuvable <br /> Il faut passer par le store Genuka pour le faire </p>
            </div>
        )
    }

    if (loading) {
        return (
            <Spinner className='' />
        )
    }

    const { configuration } = company

    if (!configuration) {
        return (
            <div>
                <p className="text-slate-800 text-sm text-center">
                    Vous n&apos;avez pas encore configuré votre Woo Commerce
                </p>
            </div>
        )
    }

    const handlerSyncProducts = async () => {
        setLoading(true)
        syncProducts(company).then(async () => {
            setLoading(false)
        }).catch(() => {
            toast({ description: "Une erreur s'est produite lors de la synchronisation", variant: "destructive" })
            setLoading(false)
        });
        await finalizeProductSync()
    }

    const handlerSyncOrders = async () => {
        setLoading(true)
        syncOrders(company)
            .then(() => {
                setLoading(false)
            })
            .catch(() => {
                setLoading(false)
            })
        await finhisOrdersSync()
    }

    const handlerSyncCustomers = async () => {
        setLoading(true)

        syncCustomers(company)
            .then(() => {
                setLoading(false)
            })
            .catch(() => {
                setLoading(false)
            })

        await finalizeSyncLogs()
    }


    return (
        <div className='w-full h-full p-4 bg-white rounded-md shadow-md'>
            {/* <div className='w-full h-full border border-dashed rounded-lg p-2 '> */}
            <div className='mb-3 grid grid-cols-3 gap-4'>
                <Button onClick={() => handlerSyncProducts()} className='w-full bg-[#873EFF] text-white p-2 rounded-md'>Produits</Button>
                <Button onClick={() => handlerSyncCustomers()} className='w-full bg-[#873EFF] text-white p-2 rounded-md'>Clients</Button>
                <Button onClick={() => handlerSyncOrders()} className='w-full bg-[#873EFF] text-white p-2 rounded-md'>Commandes</Button>
            </div>
            <div className='mt-5'>
                Historique des Logs
            </div>
            <div className='mt-5 max-h-[450px] overflow-y-scroll'>
                <DataTable columns={columns} data={globalLogs} />
            </div>
        </div>
    )
}

export default SynchronisationPage