import { GenukaCustomerDto, WooCustomerDto } from "@/types/customer";
import {
  GenukaOrderDto,
  WooOrderDto,
  WooOrderLineItemDto,
} from "@/types/order";
import { ProductDto, WooCommercerProductCreate } from "@/types/product";
import { GlobalLogs } from "@/utils/logger";
import { Logger } from "@prisma/client";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const convertGenukaProductToWooCommerceProduct = (
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

  const { options } = input;

  const productAttributes: {
    name: string;
    position: number;
    visible: boolean;
    options: string[];
    variation: boolean;
  }[] = [];

  for (const option of options) {
    productAttributes.push({
      name: option.title,
      position: option.position,
      visible: true,
      options: option.values.filter((f) => f !== null),
      variation: true,
    });
  }

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
    regular_price: input.variants[0]?.price.toString(),
    short_description: input.content,
    type: input.variants.length > 1 ? "variable" : "simple",
    attributes: input.variants.length > 1 ? productAttributes : [],
  };
};

export const extractWooCustomerDtoInfoFromGenukaCustomer = (
  input: GenukaCustomerDto
): WooCustomerDto => {
  const { addresses } = input;
  const shippingAdress = addresses.find(
    (addr) => addr.addressable_id === input.shipping_address?.addressable_id
  );
  const billingAdress = addresses.find(
    (addr) => addr.addressable_id === input.billing_address?.addressable_id
  );

  return {
    email: input.email,
    first_name: input.first_name,
    last_name: input.last_name,
    username: input.email,
    billing: {
      city: billingAdress?.city ?? "Default Value",
      state: billingAdress?.state ?? "Default Value",
      address_1: billingAdress?.line1 ?? "Default Value",
      address_2: billingAdress?.line2 ?? "Default Value",
      country: billingAdress?.country ?? "Default Value",
      first_name: billingAdress?.first_name ?? "Default Value",
      last_name: billingAdress?.last_name ?? "Default Value",
      postcode: billingAdress?.postal_code ?? "Default Value",
      company: billingAdress?.company ?? "Default Value",
      email: billingAdress?.email ?? "john@gmail.com",
      phone: billingAdress?.phone ?? "Default Value",
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
      company: shippingAdress?.company ?? "Default Company",
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
  input: GenukaOrderDto,
  lineItems: WooOrderLineItemDto[],
  customer_id: number | null // Permettre customer_id d'être null
): WooOrderDto => {
  // Valeurs par défaut pour les adresses
  const defaultAddress = {
    city: "Default City",
    state: "Default State",
    address_1: "Default Address Line 1",
    address_2: "Default Address Line 2",
    country: "Default Country",
    first_name: "Default First Name",
    last_name: "Default Last Name",
    postal_code: "Default Postal Code",
    company: "Default Company",
    email: "john@gmail.com",
    phone: "Default Phone",
  };

  // Récupérer les adresses de livraison et de facturation
  const shippingAddress = input.customer
    ? input.customer.addresses.find((addr) => addr.id === input.shipping.address_id)
    : null;
  const billingAddress = input.customer
    ? input.customer.addresses.find((addr) => addr.id === input.billing.address_id)
    : null;

  // Retourner l'objet WooOrderDto avec des valeurs par défaut si nécessaire
  return {
    customer_id: customer_id ?? 0, // Si customer_id est null, utiliser 0 (ou une autre valeur par défaut)
    payment_method: input.billing.method,
    payment_method_title: input.billing.method,
    set_paid: input.shipping.status !== "pending", // Si le statut n'est pas "pending", la commande est payée
    billing: {
      city: billingAddress?.city ?? defaultAddress.city,
      state: billingAddress?.state ?? defaultAddress.state,
      address_1: billingAddress?.line1 ?? defaultAddress.address_1,
      address_2: billingAddress?.line2 ?? defaultAddress.address_2,
      country: billingAddress?.country ?? defaultAddress.country,
      first_name: billingAddress?.first_name ?? defaultAddress.first_name,
      last_name: billingAddress?.last_name ?? defaultAddress.last_name,
      postcode: billingAddress?.postal_code ?? defaultAddress.postal_code,
      company: billingAddress?.company ?? defaultAddress.company,
      email: billingAddress?.email ?? defaultAddress.email,
      phone: billingAddress?.phone ?? defaultAddress.phone,
    },
    shipping: {
      address_1: shippingAddress?.line1 ?? defaultAddress.address_1,
      city: shippingAddress?.city ?? defaultAddress.city,
      state: shippingAddress?.state ?? defaultAddress.state,
      address_2: shippingAddress?.line2 ?? defaultAddress.address_2,
      country: shippingAddress?.country ?? defaultAddress.country,
      first_name: shippingAddress?.first_name ?? defaultAddress.first_name,
      last_name: shippingAddress?.last_name ?? defaultAddress.last_name,
      postcode: shippingAddress?.postal_code ?? defaultAddress.postal_code,
    },
    line_items: lineItems,
    shipping_lines: [
      {
        method_id: input.billing.method,
        method_title: input.billing.method,
        total: input.billing.total.toString(),
      },
    ],
  };
};
export const mapGenukaProductToAddOtherProperties = (
  input: ProductDto
): ProductDto => {
  return {
    ...input,
    price: input.pivot.price,
    quantity: input.pivot.quantity,
  };
};

export const convertApiOrder = (order: GenukaOrderDto): GenukaOrderDto => {
  return {
    ...order,
    shop_id: order.shop?.id || order.shop_id,
    customer: order.customer,
    shop: order.shop || {},
    products:
      (order.products || [])
        .reduce((acc, product) => {
          // Supprime les doublons
          if (acc.some((p) => p.title === product.title)) return acc;
          return [...acc, product];
        }, [] as typeof order.products)
        .map((p) => ({
          ...p,
          tmpId: `${p.id}-${p.pivot.variant_id}`,
          product_id: p.id,
          variant_id: p.pivot.variant_id,
          title: p.title,
          price: p.pivot.price,
          quantity: p.pivot.quantity,
          medias: p.medias,
        })) || [],
    shipping: {
      ...order.shipping,
      address: order.addresses?.find(
        (a) => a.id === order.shipping.address_id
      ) ?? {
        line1: "Default value",
        city: "Default value",
        company: "Default value",
        country: "Default value",
        email: "default@gmail.com",
        first_name: "default value",
        label: "Default value",
      },
    },
    billing: {
      ...order.billing,
      address: order.addresses?.find((a) => a.id === order.billing.address_id),
    },
    // metadata: order.metadata || {
    //   note: "",
    // },
    // shipping: {
    //   address_id: null,
    //   mode: "delivery",
    //   amount: 0,
    //   ...order.shipping,
    //   address: order.addresses?.find((a) => a.id === order.shipping?.address_id),
    // },
    // billing: {
    //   address_id: null,
    //   address: {},
    //   method: "cash",
    //   status: "pending",
    //   ...order.billing,
    //   address: order.addresses?.find((a) => a.id === order.billing?.address_id),
    // },
  };
};
