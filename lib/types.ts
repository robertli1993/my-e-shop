export type Product = {
  id: string;
  name: string;
  category: string;
  priceCents: number;
  stock: number;
  image: string;
  alt: string;
  tagline: string;
  description: string;
  specs: [string, string][];
  tags: string[];
  highlights: string[];
  inBox: string[];
  care: string;
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
};

export type CartLine = {
  product: Product;
  qty: number;
};

export type OrderItem = {
  productId: string;
  name: string;
  category: string;
  image: string;
  priceCents: number;
  qty: number;
};

export type OrderEvent = {
  status: string;
  at: string;
};

export type OrderSummary = {
  id: string;
  status: string;
  createdAt: string;
  totalCents: number;
  itemCount: number;
  items: OrderItem[];
};

export type OrderDetail = OrderSummary & {
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  address: {
    fullName: string;
    line1: string;
    line2: string;
    city: string;
    region: string;
    postal: string;
    country: string;
  };
  timeline: OrderEvent[];
};
