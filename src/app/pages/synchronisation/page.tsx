"use client"
import { Button } from '@/components/ui/button';
import { useSearchParams } from 'next/navigation';
import React from 'react'
import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";
import { columns, Payment } from './columns';
import { DataTable } from './data-table';
import useConfiguration from '@/hooks/useConfiguration';
import Spinner from '@/components/ui/spinner';
import Genuka from 'genuka';
import { ProductDto, WooCommerceProductDto } from '@/types/product';
import { mapGenukaToWooCommerce, mapWooComerceToWooCommerceProductCreateDto } from '@/lib/utils';

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

    if (!companyId) {
        return (
            <Spinner className='' />
        )
    }

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { company } = useConfiguration(companyId)
    if (!company) {
        return (
            <Spinner className='' />
        )
    }

    const { configuration } = company

    const syncProduct = async () => {

        const wooApi = new WooCommerceRestApi({
            url: configuration!.apiUrl,
            consumerKey: configuration!.consumerKey,
            consumerSecret: configuration!.consumerSecret,
            version: "wc/v3",
            queryStringAuth: true
        });

        const genuka = await Genuka.initialize({ id: companyId })

        const genukaProducts = await genuka.productService.list({}) as ProductDto[];

        wooApi.get("products").then(res => console.log(res.data)).catch(err => console.error(err))

        console.log({ genukaProducts })

        for (const product of genukaProducts) {
            // On teste d'abord si le produit existe, donc dispose d'un woocommerceId dans les metadonnees
            if (product.metadata) {
                if (product.metadata.woocommerceId) {
                    // On met a jour le produit
                    const res: WooCommerceProductResponse = await wooApi.get(`products/${product.metadata.woocommerceId}`);
                    console.log(res.data)
                }
                else {
                    // On cree donc le produit
                }
            } else {
                // On cree le produit
                const transformProduct = mapGenukaToWooCommerce(product)
                // On cree les differentes categories 
                if (transformProduct.categories.length) {
                    // On cree les categories
                }
                const productToCreate = mapWooComerceToWooCommerceProductCreateDto(transformProduct, []);
                // Update Genuka product with wooCommerceId 








                console.log({ productToCreate })

                // On doit faire des tests ici. 
                // if(transformProduct.categories.length){
                //     for(const cat of transformProduct.categories){
                //         const res = await wooApi.post(`products/categories`, cat)

                //         }
                // }

                const { data } = await wooApi.post(`products`, productToCreate)
                // genuka.products.queries()

                const updateResponse = await fetch(
                    `${process.env.GENUKA_URL}/${process.env.GENUKA_VERSION}/admin/products/${product.id}`,
                    {
                      method: "PUT",
                      headers: {
                        "Content-Type": "application/json", 
                        "X-API-Key": configuration!.apiKey, 
                        "X-Company": companyId,
                        // "X-Shop": this.genuka_shop_id, 
                      },
                      body: JSON.stringify({
                        metadata: {
                          woocommerceId: data.id, 
                        },
                      }),
                    }
                  );

                  console.log({updateResponse})

                  if(updateResponse.status){

                  }

            }
        }
    }

return (
    <div className='w-full h-full p-4 bg-white rounded-md shadow-md'>
        {/* <div className='w-full h-full border border-dashed rounded-lg p-2 '> */}
        <div className='mb-3 grid grid-cols-3 gap-4'>
            <Button className='w-full bg-[#873EFF] text-white p-2 rounded-md' onClick={() => syncProduct()}>Produits</Button>
            <Button className='w-full bg-[#873EFF] text-white p-2 rounded-md'>Clients</Button>
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