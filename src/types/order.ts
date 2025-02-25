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
}

interface GenukaOrderBillingDto {
  total: number;
  method: string;
  status: string;
  subtotal: number;
  address_id: string;
  treasury_account_id: string;
}

interface Metadata {
  matchingMediaIds: [];
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
  source: "EMAIL" | "OTHER" | string;
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
    order: object; // etre recursif ??
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

interface WooOrderLineItemDto {
  product_id: number;
  variation_id?: number;
  quantity: number;
}

interface WooOrderShippingLineDto {
  method_id: string;
  method_title: string;
  total: string;
}

export interface WooOrderDto {
  payment_method: string;
  payment_method_title: string;
  set_paid: boolean;
  billing: WooBillingAddressDto;
  shipping: WooOrderShippingAddressDto;
  line_items: WooOrderLineItemDto[];
  shipping_lines: WooOrderShippingLineDto[];
}
