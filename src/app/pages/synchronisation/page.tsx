"use client"
import { Button } from '@/components/ui/button';
import { useSearchParams } from 'next/navigation';
import React, { useState } from 'react'
import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";
import { columns, Payment } from './columns';
import { DataTable } from './data-table';
import useConfiguration from '@/hooks/use-configuration';
import Genuka from 'genuka';
import { ProductDto, WooCommerceProductDto } from '@/types/product';
import { mapGenukaToWooCommerce, mapWooComerceToWooCommerceProductCreateDto } from '@/lib/utils';
import { syncProduct } from '@/app/actions/products';
import { useToast } from '@/hooks/use-toast';
import Spinner from '@/components/ui/spinner';
import { syncCustomers } from '@/app/actions/customers';

function getData(): Payment[] {
    return Array.from({ length: 100 }, (_, i) => ({
        id: Math.random().toString(36).substring(2, 10), // ID unique aléatoire
        amount: Math.floor(Math.random() * 1000) + 50, // Montant entre 50 et 1050
        status: "failed", // Status aléatoire
        email: `user${i + 1}@example.com`, // Email unique
    }));
}

interface WooCommerceProductResponse {
    data: WooCommerceProductDto;
}

const SynchronisationPage = () => {

    const searchParams = useSearchParams();
    const companyId = searchParams.get("companyId");
    const data = getData()
    const { toast } = useToast()

    const [loading, setLoading] = useState(false)
    console.log({ loading })
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

    // const syncProduct = async () => {

    //     const wooApi = new WooCommerceRestApi({
    //         url: configuration!.apiUrl,
    //         consumerKey: configuration!.consumerKey,
    //         consumerSecret: configuration!.consumerSecret,
    //         version: "wc/v3",
    //         queryStringAuth: true
    //     });

    //     const genuka = await Genuka.initialize({ id: companyId })

    //     const genukaProducts = await genuka.productService.list({}) as ProductDto[];

    //     wooApi.get("products").then(res => console.log(res.data)).catch(err => console.error(err))

    //     console.log({ genukaProducts })

    //     for (const product of genukaProducts) {
    //         // On teste d'abord si le produit existe, donc dispose d'un woocommerceId dans les metadonnees
    //         if (product.metadata && product.metadata.woocommerceId) {

    //             // On met a jour le produit
    //             const res: WooCommerceProductResponse = await wooApi.get(`products/${product.metadata.woocommerceId}`);
    //             console.log(res.data)

    //         } else {
    //             // On cree le produit
    //             const transformProduct = mapGenukaToWooCommerce(product)
    //             // On cree les differentes categories 
    //             if (transformProduct.categories.length) {
    //                 // On cree les categories
    //             }
    //             const productToCreate = mapWooComerceToWooCommerceProductCreateDto(transformProduct, []);
    //             // Update Genuka product with wooCommerceId 
    //             console.log({ productToCreate })

    //             // On doit faire des tests ici. 
    //             // if(transformProduct.categories.length){
    //             //     for(const cat of transformProduct.categories){
    //             //         const res = await wooApi.post(`products/categories`, cat)

    //             //         }
    //             // }

    //             const { data } = await wooApi.post(`products`, productToCreate)
    //             // genuka.products.queries()

    //             const updateResponse = await fetch("/api/company/products",
    //                 {
    //                     method: "PUT",
    //                     //   headers: {
    //                     //     "Content-Type": "application/json", 
    //                     //     "X-API-Key": configuration!.apiKey, 
    //                     //     "X-Company": companyId,
    //                     //     // "X-Shop": this.genuka_shop_id, 
    //                     //   },
    //                     body: JSON.stringify({
    //                         // metadata: {
    //                         //   woocommerceId: data.id, 
    //                         // },
    //                         woocommerceId: data.id,
    //                         apiKey: configuration!.apiKey,
    //                         companyId,
    //                         productId: product.id
    //                     }),
    //                 }
    //             );

    //             console.log({ updateResponse })

    //             if (updateResponse.status) {

    //             }

    //         }
    //     }
    // }

    const handlerSyncProducts = async () => {
        setLoading(true)
        syncProduct(configuration).then(res => {
            console.log({ res })
            setLoading(false)
        }).catch(err => {
            console.log(err)
            toast({ description: "Une erreur s;est produite lors de la synchronisation", variant: "destructive" })
            setLoading(false)
        });
    }

    const handlerSyncCustomers = async () => {
        setLoading(true)

        syncCustomers(configuration)
            .then(res => {
                setLoading(false)
                console.log({ res })
            })
            .catch(err => {
                setLoading(false)

                console.error(err)
            })
    }


    return (
        <div className='w-full h-full p-4 bg-white rounded-md shadow-md'>
            {/* <div className='w-full h-full border border-dashed rounded-lg p-2 '> */}
            <div className='mb-3 grid grid-cols-3 gap-4'>
                <Button onClick={() => handlerSyncProducts()} className='w-full bg-[#873EFF] text-white p-2 rounded-md'>Produits</Button>
                <Button onClick={() => handlerSyncCustomers()} className='w-full bg-[#873EFF] text-white p-2 rounded-md'>Clients</Button>
                <Button className='w-full bg-[#873EFF] text-white p-2 rounded-md'>Commandes</Button>
            </div>
            <div className='mt-5'>
                {companyId} Historique des Logs
            </div>
            <div className='mt-5 max-h-[450px] overflow-y-scroll'>
                <DataTable columns={columns} data={data} />
            </div>
        </div>
    )
}

export default SynchronisationPage