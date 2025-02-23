export interface GenukaCustomerDto {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  gender: string | null;
  metadata: any | null; 
  company_id: string;
  created_at: string; 
  updated_at: string; 
  deleted_at: string | null; 
  birthdate: string | null; 
  type: string;
  company_name: string | null;
  preferred_language: string | null;
  registration_number: string | null;
  tax_number: string | null;
  orders_count: number;
  orders_sum_amount: number;
  tags: string[];
  addresses: GenukaAddressDto[]; 
  default_address: GenukaAddressDto | null; 
  billing_address: GenukaAddressDto | null;
  shipping_address: GenukaAddressDto | null; 
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
  is_primary: number;
  is_billing: number;
  is_shipping: number;
  metadata: {
    amount: number;
  };
  addressable_type: string;
  addressable_id: string;
  company_id: string;
  created_at: string; 
  updated_at: string; 
}

export interface WooCustomerDto {
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  billing: WooBillingAddressDto;
  shipping: WooShippingAddressDto;
}

interface WooBillingAddressDto {
  first_name: string;
  last_name: string;
  company: string;
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  email: string;
  phone: string;
}

interface WooShippingAddressDto {
  first_name: string;
  last_name: string;
  company: string;
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
}
