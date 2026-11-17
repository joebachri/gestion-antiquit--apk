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
