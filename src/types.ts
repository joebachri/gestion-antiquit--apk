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
  storeName?: string;
  currency: string;
  facebookHandle?: string;
  instagramHandle?: string;
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

export interface MetaIgAccount {
  id: string;
  username: string;
  name?: string;
  profilePictureUrl?: string;
}

export interface MetaPageAccount {
  id: string;
  name: string;
  pictureUrl?: string;
  igAccount?: MetaIgAccount;
}

export interface MetaAuthStatus {
  configured: boolean;
  callbackUrl: string;
  connected: boolean;
  userName?: string;
  userPicture?: string;
  pages: MetaPageAccount[];
  selectedPageId?: string;
  selectedIgId?: string;
}

export interface FacebookPublishPayload {
  message: string;
  mediaDataUrl?: string;
  mediaType?: 'image' | 'video' | 'none';
  pageId?: string;
}

export interface InstagramPublishPayload {
  caption: string;
  mediaDataUrl: string;
  publishMode: 'post' | 'reel';
  shareToFeed?: boolean;
  location?: string;
  igAccountId?: string;
}

export type CustomerCategory = 'seller' | 'hobbyist' | 'regular' | 'other';

export type PurchasePaymentMethod = 'cash' | 'transfer' | 'check' | 'card' | 'other';

export interface CustomerPurchase {
  id: string;
  customerId: string;
  productId?: string;
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  purchaseDate: string;
  paymentMethod: PurchasePaymentMethod;
  notes: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  category: CustomerCategory;
  notes: string;
  facebookUrl?: string;
  instagramUrl?: string;
  websiteUrl?: string;
  createdAt: string;
  updatedAt: string;
  purchases: CustomerPurchase[];
}

export interface CustomerSummary {
  totalCustomers: number;
  totalPurchases: number;
  totalRevenueMad: number;
}

export interface CustomerPayload {
  name: string;
  phone: string;
  address: string;
  city: string;
  category: CustomerCategory;
  notes: string;
  facebookUrl?: string;
  instagramUrl?: string;
  websiteUrl?: string;
}

export interface CustomerPurchasePayload {
  productId?: string;
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  purchaseDate: string;
  paymentMethod: PurchasePaymentMethod;
  notes: string;
}

