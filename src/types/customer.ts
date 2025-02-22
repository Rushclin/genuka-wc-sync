export interface GenukaCustomerDto {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    gender: string | null;
    metadata: any | null; // Utilisez un type plus spécifique si vous connaissez la structure de `metadata`
    company_id: string;
    created_at: string; // ou Date si vous convertissez la chaîne en objet Date
    updated_at: string; // ou Date si vous convertissez la chaîne en objet Date
    deleted_at: string | null; // ou Date si vous convertissez la chaîne en objet Date
    birthdate: string | null; // ou Date si vous convertissez la chaîne en objet Date
    type: string;
    company_name: string | null;
    preferred_language: string | null;
    registration_number: string | null;
    tax_number: string | null;
    orders_count: number;
    orders_sum_amount: number;
    tags: string[]; // ou un type plus spécifique si vous connaissez la structure des tags
    addresses: GenukaAddressDto[]; // Remplacez `any` par une interface spécifique si vous connaissez la structure des adresses
    default_address: any | null; // Remplacez `any` par une interface spécifique si vous connaissez la structure de l'adresse
    billing_address: any | null; // Remplacez `any` par une interface spécifique si vous connaissez la structure de l'adresse
    shipping_address: GenukaShippingAddressDto | null; // Remplacez `any` par une interface spécifique si vous connaissez la structure de l'adresse
  }


  interface GenukaAddressDto {
    id: string;
    label: string | null;
    first_name: string;
    last_name: string;
    phone: string;
    email: string | null;
    company: string | null;
    line1: string;
    line2: string | null;
    city: string;
    state: string | null;
    country: string;
    postal_code: string;
    latitude: number | null;
    longitude: number | null;
    is_primary: number; // ou boolean si vous convertissez 0/1 en true/false
    is_billing: number; // ou boolean si vous convertissez 0/1 en true/false
    is_shipping: number; // ou boolean si vous convertissez 0/1 en true/false
    metadata: {
      amount: number;
    };
    addressable_type: string;
    addressable_id: string;
    company_id: string;
    created_at: string; // ou Date si vous convertissez la chaîne en objet Date
    updated_at: string; // ou Date si vous convertissez la chaîne en objet Date
  }

  interface GenukaShippingAddressDto {
    id: string;
    label: string | null;
    first_name: string;
    last_name: string;
    phone: string;
    email: string | null;
    company: string | null;
    line1: string;
    line2: string | null;
    city: string;
    state: string | null;
    country: string;
    postal_code: string;
    latitude: number | null;
    longitude: number | null;
    is_primary: boolean; // Converti en boolean pour plus de clarté
    is_billing: boolean; // Converti en boolean pour plus de clarté
    is_shipping: boolean; // Converti en boolean pour plus de clarté
    metadata: {
      amount: number;
    };
    addressable_type: string;
    addressable_id: string;
    company_id: string;
    created_at: string; // ou Date si vous convertissez la chaîne en objet Date
    updated_at: string; // ou Date si vous convertissez la chaîne en objet Date
  }