export interface PersistingObject {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface MediaDto extends PersistingObject {
  //   id: number; // TODO !! Remove
  link: string;
  collection_name: string;
  mime_type: string;
  file_name: string;
  size: number;
  micro: string;
  thumb: string;
  large: string;
  webp: string;
}

export interface TagDto extends PersistingObject {
  company_id: string;
  name: string;
  taggable_type: string;
  taggable_id: string;
}

export interface CollectionDto extends PersistingObject {
  title: string;
  handle: string;
  content: string;
  metadata: Record<string, unknown> | null;
  parent_collection_id: string | null;
  company_id: string;
  medias: MediaDto[];
}

interface Variant extends PersistingObject {
  follow_stock: number;
  title: string;
  price: number;
  compare_at_price: number | null;
  position: number;
  sku: string | null;
  barcode: string | null;
  taxable: number;
  options: Array<{ id: string; title: string; value: string }>;
  metadata: Record<string, unknown> | null;
  product_id: string;
  image_id: string | null;
  whatsapp_product_id: string | null;
  composite_stocks: any[];
  stocks: any[];
  estimated_quantity: number | null;
  supplierproduct: any | null;
}

interface Option extends PersistingObject {
  title: string;
  position: number;
  values: string[];
  metadata: Record<string, unknown>;
  product_id: string;
}

interface Metadata {
  image_ready: boolean;
  matchingMediaIds: string[];
  woocommerceId: number;
  woocommerceWebsiteUrl: string;
}

export interface ProductDto extends PersistingObject {
  title: string;
  type: string;
  handle: string;
  content: string;
  published: number;
  vendor: string | null;
  metadata?: Metadata;
  company_id: string;

  is_shippable: number;
  is_taxable: number;
  supplier_id: string | null;
  tags: TagDto[];
  medias: MediaDto[];
  variants: Variant[];
  options: Option[];
  menus: any[];
}

export interface WooCommerceCreate {
  name: string;
  type: "simple" | "variable" | string;
  // status: 'draft' | 'pending' | 'private' | 'publish';
  regular_price: string;
  description: string;
  short_description: string;
  categories: { id: number }[];
  images: { id: number } | { src: string }[];
}

export interface WooCommerceProductDto {
  // id: number;
  name: string;
  slug?: string;
  permalink?: string;
  // date_created: string;
  // date_created_gmt: string;
  // date_modified: string;
  // date_modified_gmt: string;
  type: "simple" | "variable" | string;
  status: "draft" | "pending" | "private" | "publish";
  featured: boolean;
  catalog_visibility: "visible" | "catalog" | "search" | "hidden";
  description: string;
  short_description: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: number;
  // date_on_sale_from: string | null;
  // date_on_sale_from_gmt: string | null;
  // date_on_sale_to: string | null;
  // date_on_sale_to_gmt: string | null;
  // on_sale: boolean;
  // purchasable: boolean;
  // total_sales: number;
  virtual?: boolean;
  downloadable?: boolean;
  downloads?: any[];
  download_limit?: number;
  download_expiry?: number;
  external_url?: string;
  button_text?: string;
  tax_status?: string;
  tax_class?: string;
  manage_stock?: boolean;
  stock_quantity?: number | null;
  backorders?: string;
  backorders_allowed?: boolean;
  backordered?: boolean;
  low_stock_amount?: number | null;
  sold_individually?: boolean;
  weight?: string;
  dimensions: WooCommerceDimensionsDto;
  shipping_required?: boolean;
  shipping_taxable?: boolean;
  shipping_class?: string;
  shipping_class_id?: number;
  reviews_allowed?: boolean;
  average_rating?: string;
  rating_count?: number;
  upsell_ids?: number[];
  cross_sell_ids?: number[];
  parent_id?: number;
  purchase_note?: string;
  categories: WooCommerceCategoryDto[];
  tags: WooCommerceTagDto[];
  images?: WooCommerceImageDto[];
  attributes?: WooCommerceAttributeDto[];
  default_attributes?: WooCommerceDefaultAttributeDto[];
  variations?: WooCommerceVariationDto[];
  grouped_products?: number[];
  menu_order?: number;
  price_html?: string;
  related_ids?: number[];
  meta_data?: WooCommerceMetaDataDto[];
  stock_status?: string;
  has_options?: boolean;
  post_password?: string;
  global_unique_id?: string;
  brands?: WooCommerceBrandDto[];
  _links?: WooCommerceLinksDto;
}

export interface WooCommerceVariationDto {
  regular_price: number;
  image?: {
    id: number;
  };
  attributes: { id: string; option: string }[];
}
// export interface WooCommerceVairationDto {
//   regular_price: number,
//   attributes: {id: number, option: string}[]
// }

interface WooCommerceTagDto {
  id: number;
  name: string;
  slug: string;
}
interface WooCommerceImageDto {
  id?: number;
  src: string;
  name?: string;
  alt?: string;
}

export interface WooCommerceAttributeDto {
  name: string;
  slug: string;
  type: "select";
  order_by: "menu_order" | "name" | "name_num" | "id";
  has_archives: boolean;
}

interface WooCommerceBrandDto {
  id: number;
  name: string;
  slug: string;
}

interface WooCommerceDefaultAttributeDto {
  id?: number;
  name: string;
  option: string;
}

interface WooCommerceDimensionsDto {
  length: string;
  width: string;
  height: string;
}

export interface WooCommerceCategoryDto {
  // id: number;
  name: string;
  slug: string;
}

interface WooCommerceMetaDataDto {
  id: string;
  key: string;
  value: string;
}

interface WooCommerceLinksDto {
  self: WooCommerceLinkDto[];
  collection: WooCommerceLinkDto[];
}

interface WooCommerceLinkDto {
  href: string;
  targetHints?: {
    allow: string[];
  };
}

export interface WooCommercerProductCreate {
  name: string;
  type: "simple" | "variable" | string;
  regular_price: string;
  description: string;
  short_description: string;
  categories: { id: number }[];
  images: { id: number } | { src: string }[];
}
