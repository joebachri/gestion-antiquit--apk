export type Language = 'fr' | 'ar';

export interface ProductPhoto {
  id: string;
  productId: string;
  photoCode: string;
  imageData: string;
  sortOrder: number;
  createdAt: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  description: string;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  thicknessCm: number;
  piecesCount: number;
  quantity: number;
  referencePrice: number;
  expenses: number;
  sellingPrice: number;
  addedDate: string;
  createdAt: string;
  updatedAt: string;
  photos: ProductPhoto[];
}

export interface InventorySummary {
  totalReferences: number;
  totalUnits: number;
  totalSellingValue: number;
  totalReferenceCost: number;
}

export interface ShopSettings {
  customLogo: string;
  currency: string;
}

export interface ProductPayload {
  name: string;
  description: string;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  thicknessCm: number;
  piecesCount: number;
  quantity: number;
  referencePrice: number;
  expenses: number;
  sellingPrice: number;
  addedDate: string;
  photos: Array<{ id?: string; imageData: string }>;
  regenerateCode?: boolean;
}
