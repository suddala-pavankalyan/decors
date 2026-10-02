export type Category = 'wedding-cards' | 'gift-cards' | 'wall-decor' | 'paints';

export interface Product {
  id: string;
  name: string;
  category: Category;
  price: number;
  color: string; // hex, used for the colour filter + card accent
  colorName: string;
  tags: string[]; // occasion / style
  rating: number;
  description: string;
}

export interface ProductImage {
  url: string;
  alt: string;
}

export interface ProductSummary extends Product {
  image: ProductImage | null;
}

export interface ProductDetail extends Product {
  images: ProductImage[];
  related: ProductSummary[];
}
