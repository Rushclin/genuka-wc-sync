import { GenukaCustomerDto, WooCustomerDto } from "@/types/customer";
import { GenukaOrderDto, WooOrderDto } from "@/types/order";
import {
  ProductDto,
  WooCommerceAttributeDto,
  WooCommerceProductDto,
  WooCommercerProductCreate,
  WooCommerceVariationDto,
} from "@/types/product";
import { GlobalLogs } from "@/utils/logger";
import { Logger } from "@prisma/client";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function mapGenukaToWooCommerce(
  genukaProduct: ProductDto
): WooCommerceProductDto {
  const attributes: WooCommerceAttributeDto[] = genukaProduct.options.map(
    (option) => ({
      name: option.title,
      // options: option.values.map((value) => value.toString()), // Conversion des valeurs en chaînes de caractères
      // visible: true,
      // variation: true,
      has_archives: false,
      order_by: "menu_order",
      slug: option.title,
      type: "select",
    })
  );

  // Transformation des variantes Genuka en variations WooCommerce
  const variations: WooCommerceVariationDto[] = genukaProduct.variants.map(
    (variant) => ({
      // sku: variant.sku || undefined,
      regular_price: variant.price,
      // stock_quantity: variant.estimated_quantity,
      attributes: variant.options.map((optionIndex) => ({
        // name: genukaProduct.options[optionIndex].title,
        option: optionIndex.title,
        // option: genukaProduct.options[optionIndex].values[0].toString(), // Supposant une seule valeur par option
        id: optionIndex.id, // doit venir de Attributs
      })),
    })
  );

  // Transformation des médias Genuka en images WooCommerce
  const images = genukaProduct.medias.map((media) => ({
    src: media.link, // Supposant que 'link' contient l'URL de l'image
    alt: genukaProduct.title,
  }));

  return {
    name: genukaProduct.title,
    slug: genukaProduct.handle,
    type: genukaProduct.variants.length > 1 ? "variable" : "simple",
    status: genukaProduct.published ? "publish" : "draft",
    featured: false, // À ajuster selon vos besoins
    catalog_visibility: "visible",
    description: genukaProduct.content,
    short_description: "", // À remplir si disponible
    sku: genukaProduct.variants[0]?.sku || "", // Utilise le SKU de la première variante si disponible
    price: (genukaProduct.variants[0]?.price / 100).toFixed(2), // Prix de la première variante
    regular_price: (genukaProduct.variants[0]?.price / 100).toFixed(2),
    virtual: false, // À ajuster selon vos besoins
    downloadable: false, // À ajuster selon vos besoins
    tax_status: genukaProduct.is_taxable ? "taxable" : "none",
    manage_stock: true,
    stock_quantity: genukaProduct.variants.reduce(
      (total, variant) => total + (variant.estimated_quantity || 0),
      0
    ),
    backorders: "no",
    sold_individually: false,
    weight: "", // On ne prend pas en compe le poids chez Genuka
    dimensions: {
      length: "",
      width: "",
      height: "",
    },
    shipping_required: !!genukaProduct.is_shippable,
    shipping_taxable: !!genukaProduct.is_taxable,
    categories: [], // À remplir avec les catégories appropriées
    tags: genukaProduct.tags.map((tag) => ({
      id: 0,
      name: tag.name,
      slug: tag.name.toLowerCase().replace(/\s+/g, "-"),
    })), // Génère des tags avec des slugs basés sur le nom
    images: images,
    attributes: attributes,
    default_attributes: [], // À remplir si des attributs par défaut existent
    variations: variations, // Les variations doivent être créées séparément via l'API WooCommerce
    meta_data: [
      {
        key: "_genuka_product_id",
        value: genukaProduct.id,
        id: genukaProduct.id,
      }, // Stocke l'ID du produit Genuka pour référence
      // Ajoutez d'autres métadonnées si nécessaire
    ],

    // On recupere la premiere variante pour donner le prix
    sale_price: variations ? variations[0].regular_price : 0,
  };
}

export function mapWooComerceToWooCommerceProductCreateDto(
  input: WooCommerceProductDto,
  categories: { id: number }[]
): WooCommercerProductCreate {
  const images: { id: number } | { src: string }[] = (input.images || []).map(
    (i) => {
      return {
        src: i.src,
      };
    }
  );
  return {
    categories: categories,
    description: input.description,
    images,
    name: input.name,
    regular_price: input.regular_price,
    short_description: input.description,
    type: input.variations!.length > 0 ? "variable" : "simple",
  };
}

export const extractWooProductDtoInfoFromGenukaProductDto = (
  input: ProductDto,
  categories: { id: number }[]
): WooCommercerProductCreate => {
  const images: { id: number } | { src: string }[] = (input.medias || []).map(
    (i) => {
      return {
        src: i.micro,
      };
    }
  );

  return {
    categories: categories,
    description: input.content,
    images: images.length
      ? images
      : [
          {
            src: "https://genuka.com/favicon.ico",
          },
        ],
    name: input.title,
    regular_price: (input.variants[0]?.price / 100).toFixed(2),
    short_description: input.content,
    type: input.variants.length > 0 ? "variable" : "simple",
  };
};

export const extractWooCustomerDtoInfoFromGenukaCustomer = (
  input: GenukaCustomerDto
): WooCustomerDto => {
  const { addresses } = input;

  const defaultAddress = addresses.length > 0 ? addresses[0] : null;

  return {
    email: input.email,
    first_name: input.first_name,
    last_name: input.last_name,
    username: input.email,
    billing: {
      first_name:
        input.billing_address?.first_name ?? defaultAddress?.first_name ?? "",
      last_name:
        input.billing_address?.last_name ?? defaultAddress?.last_name ?? "",
      company:
        input.billing_address?.company ??
        defaultAddress?.company ??
        "Default company",
      address_1: "Default address",
      address_2: "Default address",
      city:
        input.billing_address?.city ?? defaultAddress?.city ?? "Default City",
      state:
        input.billing_address?.state ??
        defaultAddress?.state ??
        "Default State",
      postcode:
        input.billing_address?.postal_code ??
        defaultAddress?.postal_code ??
        "Default Post Code",
      country:
        input.billing_address?.country ??
        defaultAddress?.country ??
        "Default Country",
      email:
        input.billing_address?.email ??
        defaultAddress?.email ??
        "doe@gmail.com",
      phone:
        input.billing_address?.phone ?? defaultAddress?.phone ?? "0000000000",
    },
    shipping: {
      first_name:
        input.shipping_address?.first_name ?? defaultAddress?.first_name ?? "",
      last_name:
        input.shipping_address?.last_name ?? defaultAddress?.last_name ?? "",
      company:
        input.shipping_address?.company ??
        defaultAddress?.company ??
        "Default Company",
      address_1: "Default address",
      address_2: "Default address",
      city:
        input.shipping_address?.city ?? defaultAddress?.city ?? "Default City",
      state:
        input.shipping_address?.state ??
        defaultAddress?.state ??
        "Default State",
      postcode:
        input.shipping_address?.postal_code ??
        defaultAddress?.postal_code ??
        "Default Post Code",
      country:
        input.shipping_address?.country ??
        defaultAddress?.country ??
        "Default Country",
    },
  };
};

export const fromPrismaLogToGlobalLogDto = (input: Logger): GlobalLogs => {
  return {
    companyId: input.companyId,
    date: input.createdAt,
    id: input.elementId,
    module: input.module,
    statut: input.statut,
    type: input.type,
  };
};

export const mapGenukaOrderToWooOrder = (
  input: GenukaOrderDto
): WooOrderDto => {

  const shippingAdress = input.addresses.find(
    (addr) => addr.id === input.shipping.address_id
  );
  const billinggAdress = input.addresses.find(
    (addr) => addr.id === input.billing.address_id
  );

  return {
    payment_method: input.billing.method,
    payment_method_title: input.billing.method,
    set_paid: false,
    billing: {
      city: billinggAdress?.city ?? "default Value",
      state: billinggAdress?.state ?? "Default Value",
      address_1: billinggAdress?.line1 ?? "Default Value",
      address_2: billinggAdress?.line2 ?? "Default Value",
      country: billinggAdress?.country ?? "Default Value",
      first_name: billinggAdress?.first_name ?? "Default Value",
      last_name: billinggAdress?.last_name ?? "Default Value",
      postcode: billinggAdress?.postal_code ?? "Default Value",
      company: billinggAdress?.company ?? "Default Value",
      email: billinggAdress?.email ?? "Default Value",
      phone: billinggAdress?.phone ?? "Default Value",
    },
    shipping: {
      address_1: shippingAdress?.line1 ?? "Default Value",
      city: shippingAdress?.city ?? "Default City",
      state: shippingAdress?.state ?? "Default State",
      address_2: shippingAdress?.line2 ?? "Default Line",
      country: shippingAdress?.country ?? "Default Country",
      first_name: shippingAdress?.first_name ?? "Default Name",
      last_name: shippingAdress?.last_name ?? "Default Name",
      postcode: shippingAdress?.postal_code ?? "Default Post Code",
    },
    line_items: [
      {
        product_id: 0,
        quantity: 0,
        variation_id: 0,
      },
    ],
    shipping_lines: [
      {
        method_id: "",
        method_title: "",
        total: "",
      },
    ],
  };
};
