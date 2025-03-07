"use client"
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ConfigurationDto } from '@/types/company';
import { useRouter, useSearchParams } from 'next/navigation';
import Spinner from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import { saveConfiguration } from '@/app/actions/config';

const ConfigPage = () => {
  const searchParams = useSearchParams();
  const router = useRouter()
  const { toast } = useToast()

  const companyId = searchParams.get("companyId");

  const [isLoading, setIsLoading] = useState(false)

  if (!companyId) {
    return (
      <Spinner className='' />
    )
  }

  const {
    register,
    handleSubmit,
    formState: { errors },
    // eslint-disable-next-line react-hooks/rules-of-hooks
  } = useForm<ConfigurationDto>({
    defaultValues: {
      apiUrl: "http://",
      appVersion: "wc/v3",
      companyId,
      //   consumerKey: "",
      //   consumerSecret: "",
    }
  });

  const onSubmit = async (data: ConfigurationDto) => {
    try {
      setIsLoading(true)
      const response = await saveConfiguration(data)

      if (!response) {
        toast({
          description: "Une erreur s'est produite.",
          variant: "destructive",
        })
      }

      setIsLoading(false)
      toast({
        description: "Votre configuration a bien été prise en compte.",
      })
      router.push(`/pages/synchronisation?companyId=${companyId}`, { scroll: false })

    } catch (error) {
      console.error("Erreur lors de l'envoi des données:", error);
      setIsLoading(false)
    }
  };

  if (isLoading) {
    return (
      <Spinner className='' />
    )
  }

  return (
    <div className='border border-dashed w-full max-w-5xl mx-auto rounded-md p-4 bg-white shadow-md'>
      <h2 className='text-xl font-semibold text-gray-700 mb-4'>Configuration</h2>

      <div className='flex gap-4'>
        <div className='w-1/2'>
          <p className='text-gray-600 text-md font-light'>
            Pour éffectuer la configuration complète, veuillez suivre ces étapes.
          </p>
          <h4 className='mt-3 font-bold'>Woo Commerce</h4>
          <div className='px-5 mt-2 text-md font-light'>
            <ul className='list-decimal'>
              <li>Aller dans votre boutique <span className='font-bold'>Woo Commerce</span></li>
              <li>Puis choisir l&apos;option <span className='font-bold'>Réglages</span></li>
              <li>Ensuite, choisir l&apos;option <span className='font-bold'>Avancé</span></li>
              <li>Enfin, choisir l&apos;option <span className='font-bold'>API REST</span></li>
              <li>Cliquer sur l&apos;option ajouter une nouvelle clef </li>
              <li>Remplir les champs adepquetes et choisir le droit de <span className='font-bold'>Lecture/Ecriture</span> </li>
            </ul>
          </div>

          <h4 className='mt-3 font-bold'>Genuka</h4>
          <div className='px-5 mt-2 text-md font-light'>
            <ul className='list-decimal'>
              <li>Aller dans votre boutique <span className='font-bold'>Genuka</span></li>
              <li>Ensuite dans <span className='font-bold'>Parametres</span> </li>
              <li>Choisir l&apos;option clef <span className='font-bold'>API et remplir</span> </li>
            </ul>
          </div>

        </div>

        <div className='w-1/2'>
          <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
            <div>
              <label className='block text-sm font-medium text-gray-600'>API URL</label>
              <Input
                className='w-full border rounded-md p-2'
                type='url'
                {...register('apiUrl', { required: 'L’URL de l’API est requise.', pattern: { value: /^(https?:\/\/)?[\w.-]+(?:\.[\w\.-]+)+[\w\-._~:/?#[\]@!$&'()*+,;=.]+$/, message: 'URL invalide' } })}
              />
              {errors.apiUrl && <p className='text-red-500 text-sm'>{errors.apiUrl.message?.toString()}</p>}
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-600'>Consumer Key</label>
              <Input
                className='w-full border rounded-md p-2'
                type='text'
                {...register('consumerKey', { required: 'La clé consommateur est requise.' })}
              />
              {errors.consumerKey && <p className='text-red-500 text-sm'>{errors.consumerKey.message?.toString()}</p>}
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-600'>Consumer Secret</label>
              <Input
                className='w-full border rounded-md p-2'
                type='password'
                {...register('consumerSecret', { required: 'Le secret consommateur est requis.' })}
              />
              {errors.consumerSecret && <p className='text-red-500 text-sm'>{errors.consumerSecret.message?.toString()}</p>}
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-600'>App Version</label>
              <Input
                className='w-full border rounded-md p-2 bg-gray-100'
                type='text'
                defaultValue='wc/v3'
                {...register('appVersion', { required: 'La version de l’application est requise.' })}
                readOnly
              />
            </div>

            <div className='mt-5'>
              <label className='block text-sm font-medium text-gray-600'>Cle d&apos;API</label>
              <Input
                className='w-full border rounded-md p-2'
                type='password'
                {...register('apiKey', { required: 'La clé d\'API est requise.' })}
              />
              {errors.apiKey && <p className='text-red-500 text-sm'>{errors.apiKey.message?.toString()}</p>}
            </div>

            <Button type='submit' className='w-full bg-[#873EFF] text-white p-2 rounded-md'>
              Sauvegarder
            </Button>
          </form>
        </div>
      </div>
    </div>);
};

export default ConfigPage;
