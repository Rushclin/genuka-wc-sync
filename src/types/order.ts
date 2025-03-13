import {
  GenukaAddressDto,
  GenukaCustomerDto,
  WooBillingAddressDto,
} from "./customer";
import { ProductDto } from "./product";

interface GenukaOrderShippingDto {
  mode: string;
  amount: number;
  status: string;
  address_id: string;
  address?: GenukaAddressDto;
}

interface GenukaOrderBillingDto {
  total: number;
  method: string;
  status: string;
  subtotal: number;
  address_id: string;
  treasury_account_id: string;
  address?: GenukaAddressDto;

  treasury_account: {
    id: string;
    shop_id: string;
    company_id: string;
    accounting_account_code: number;
    balance: number;
    label: string;
    type: string;
    logoUrl: null;
    metadata: {
      shop_id: string;
      shop_name: string;
      currency_code: string;
      currency_name: string;
    };

    medias: [];
    shop: GenukaShopDto;
  };
  treasury_account_label: string;
}

interface Metadata {
  matchingMediaIds: [];
  woocommerceId: number;
  dateLastSync?: number
}

interface GenukaShopDto {
  id: string;
  name: string;
  slug: string;
  currency_code: string;
  currency_name: string;
  description: string;
  metadata: null;
  company_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: null;
  address: null;
  warehouses: [];
  domains: [];
  logoUrl: "";
  logo: null;
}

export interface GenukaOrderDto {
  id: string;
  company_id: string;
  shop_id: string;
  user_id: string | null;
  customer_id: string;
  reference: string;
  status: "pending" | "completed" | "cancelled" | "other" | string;
  currency: string;
  amount: number;
  source: "EMAIL" | "OTHER" | "WHATSAPP" | string;
  shipping: GenukaOrderShippingDto;
  billing: GenukaOrderBillingDto;
  metadata: Metadata;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  revenue_type: "products" | "services" | "other" | string;
  credit_code: string;
  debit_code: string;
  state: number;
  shipping_fee_id: string | null;
  expires_at: string | null;
  customer_orders_count: number;
  customer: GenukaCustomerDto;
  shipping_fee: number | null;
  medias: any[];
  private_medias: any[];
  signature: string | null;
  amount_due: number;
  shop: GenukaShopDto;
  products: ProductDto[];
  delivery: {
    id: string;
    order_id: string;
    user_id: null;
    company_id: string;
    address_id: string;
    status: string;
    mode: string;
    metadata: null;
    starts_at: null;
    ends_at: null;
    scheduled_at: string;
    tracking_number: string;
    tracking_url: null;
    created_at: string;
    updated_at: string;
    user: null;
    address: GenukaAddressDto;
    order: {
      id: string;
      company_id: string;
      shop_id: string;
      user_id: null;
      customer_id: string;
      reference: string;
      status: string;
      currency: string;
      amount: number;
      source: string;
      shipping: {
        mode: string;
        amount: number;
        status: string;
        address_id: string;
      };
      billing: {
        total: number;
        method: string;
        status: string;
        subtotal: number;
        address_id: string;
        // treasury_account_id: '01jjxyhhqhnry8pqvjgjw2wyp1'
      };
      metadata: { matchingMediaIds: [] };
      // created_at: '2024-04-28T03:07:04.000000Z',
      // updated_at: '2025-01-31T10:31:05.000000Z',
      // deleted_at: null,
      // revenue_type: 'products',
      // credit_code: '701',
      // debit_code: '4111',
      // state: 1,
      // shipping_fee_id: null,
      // expires_at: null
    };
  };
  discounts: [];
  taxes: [];
  addresses: GenukaAddressDto[];
}

interface WooOrderShippingAddressDto {
  first_name: string;
  last_name: string;
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
}

export interface WooOrderLineItemDto {
  product_id: number;
  variation_id?: number;
  quantity: number;
  id? : number
}

interface WooOrderShippingLineDto {
  method_id: string;
  method_title: string;
  total: string;
  id?: number;
}

export interface WooOrderDto {
  payment_method: string;
  payment_method_title: string;
  set_paid: boolean;
  billing: WooBillingAddressDto;
  shipping: WooOrderShippingAddressDto;
  line_items: WooOrderLineItemDto[];
  shipping_lines: WooOrderShippingLineDto[];
  customer_id?: number;
  meta_data: {
    key: string;
    value: string;
  }[];
  source: string;
}

export interface OrderDTO {
  id: string;
  company_id: string;
  shop_id: string;
  user_id: string | null;
  customer_id: string;
  reference: string;
  status: string;
  currency: string;
  amount: number;
  source: string;
  shipping: ShippingDTO;
  billing: BillingDTO;
  metadata: MetadataDTO;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  revenue_type: string;
  credit_code: string;
  debit_code: string;
  state: number;
  shipping_fee_id: string | null;
  expires_at: string | null;
  customer: CustomerDTO;
  delivery: DeliveryDTO;
  shipping_fee: number | null;
  medias: any[];
  private_medias: any[];
  signature: string | null;
  amount_due: number;
}

export interface ShippingDTO {
  mode: string;
  amount: number;
  status: string;
  address_id: string;
}

export interface BillingDTO {
  total: number;
  method: string;
  status: string;
  subtotal: number;
  address_id: string;
  treasury_account_id: string;
}

export interface MetadataDTO {
  matchingMediaIds: string[];
  woocommerceId: number;
  dateLastSync?: number
}

export interface CustomerDTO {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  gender: string | null;
  metadata: any;
  company_id: string;
  created_at: string;
  updated_at: string;
  last_activity: string | null;
  deleted_at: string | null;
  birthdate: string | null;
  type: string;
  company_name: string | null;
  preferred_language: string | null;
  registration_number: string | null;
  tax_number: string | null;
  addresses: AddressDTO[];
  default_address: AddressDTO | null;
  billing_address: AddressDTO | null;
  shipping_address: AddressDTO;
}

export interface AddressDTO {
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
  is_primary: boolean;
  is_billing: boolean;
  is_shipping: boolean;
  metadata: any;
  addressable_type: string;
  addressable_id: string;
  company_id: string;
  created_at: string;
  updated_at: string;
}

export interface DeliveryDTO {
  id: string;
  order_id: string;
  user_id: string | null;
  company_id: string;
  address_id: string;
  status: string;
  mode: string;
  metadata: any;
  starts_at: string | null;
  ends_at: string | null;
  scheduled_at: string;
  tracking_number: string;
  tracking_url: string | null;
  created_at: string;
  updated_at: string;
  address: AddressDTO;
  order: Partial<OrderDTO>;
}
