import type { Language, Product, ProductHistoryEvent, Warehouse } from '../types';

export interface BilingualTextPayload {
  name?: string;
  nameFr?: string;
  nameAr?: string;
  description?: string;
  descriptionFr?: string;
  descriptionAr?: string;
  category?: string;
  categoryFr?: string;
  categoryAr?: string;
  color?: string;
  colorFr?: string;
  colorAr?: string;
}

export function containsArabicScript(text: string): boolean {
  return /[\u0600-\u06FF]/.test(String(text || ''));
}

// Exact curated bilingual pairs for seeded items, common antique names, descriptions, categories, colors, and locations
const EXACT_FR_TO_AR: Record<string, string> = {
  // Seeded product names
  'lanterne fassi en cuivre cisélé': 'فانوس فاسي من النحاس المنقوش',
  'coffre berbère en bois de cèdre sculpté': 'صندوق أمازيغي من خشب الأرز المنحوت',
  'plat ancien en céramique de fès': 'طبق أثري من خزف فاس التقليدي',
  'service à thé royal en argent ciselé': 'طقم شاي ملكي من الفضة المنقوشة',
  // Seeded product descriptions
  "lanterne octogonale ancienne en laiton et cuivre ajouré à motifs géométriques traditionnels de fès, patine authentique d'époque.":
    'فانوس مثمن أثري من النحاس الأصفر والأحمر المخرم بزخارف هندسية فاسية تقليدية مع بريق عتيق أصيل.',
  'coffre de mariage ancien du moyen-atlas en bois de cèdre massif sculpté à la main, ferrures et moraillon en laiton oxydé.':
    'صندوق عروس أثري من الأطلس المتوسط مصنوع من خشب الأرز الصلب المنحوت يدوياً مع زخارف وأقفال نحاسية عتيقة.',
  'grand plat décoratif ancien de fès émaillé vert émeraude et bleu de cobalt, motif floral étoilé peint à la main.':
    'طبق خزفي فاسي كبير للزينة مطلي باللون الأخضر الزمردي والأزرق الكوبالت، بزخارف نجمية وزهرية مرسومة يدوياً.',
  "théière ancienne gravée à la main sur plateau circulaire ciselé en maillechort argenté, accompagnée de son sucrier d'époque.":
    'براد شاي أثري منقوش يدوياً على صينية دائرية فضية مزخرفة، مرفق بسكرية أثرية متناسقة.',
  // Seeded suppliers & warehouses
  'atelier dinanderie fès': 'ورشة النحاس التقليدي فاس',
  'artisanat moyen-atlas': 'صناعة تقليدية الأطلس المتوسط',
  'poterie traditionnelle fès': 'فخار فاس التقليدي',
  'orfèvrerie bab guissa': 'صياغة باب الكيسة',
  'magasin principal': 'المتجر الرئيسي',
  'dépôt principal': 'المستودع الرئيسي',
  'fès': 'فاس',
  'fes': 'فاس',
  'marrakech': 'مراكش',
  'rabat': 'الرباط',
  'casablanca': 'الدار البيضاء',
  'tanger': 'طنجة',
  'meknès': 'مكناس',
  'essaouira': 'الصويرة',
  'agadir': 'أكادير',
  // Categories
  'luminaire': 'إنارة',
  'luminaires': 'إنارة',
  'mobilier': 'أثاث',
  'meuble': 'أثاث',
  'meubles': 'أثاث',
  'céramique': 'خزف',
  'poterie': 'فخار',
  'argenterie': 'فضيات',
  'service à thé': 'أطقم الشاي',
  'tapis': 'زرابي',
  'bijoux': 'مجوهرات',
  'cuivre': 'نحاسيات',
  'dinanderie': 'نحاسيات تقليدية',
  'bois': 'خشبيات',
  'décoration': 'ديكور',
  'textile': 'منسوجات',
  'verrerie': 'زجاجيات',
  'artisanat': 'صناعة تقليدية',
  'antiquité': 'تحف أثرية',
  'antiquités': 'تحف أثرية',
  'divers': 'متنوعات',
  // Colors
  'blanc': 'أبيض',
  'blanche': 'بيضاء',
  'noir': 'أسود',
  'noire': 'سوداء',
  'bleu': 'أزرق',
  'bleue': 'زرقاء',
  'bleu de fès': 'أزرق فاسي',
  'bleu cobalt': 'أزرق كوبالت',
  'vert': 'أخضر',
  'verte': 'خضراء',
  'vert émeraude': 'أخضر زمردي',
  'vert émeraude & bleu': 'أخضر زمردي وأزرق',
  'rouge': 'أحمر',
  'doré': 'ذهبي',
  'dorée': 'ذهبية',
  'or': 'ذهبي',
  'argenté': 'فضي',
  'argentée': 'فضية',
  'argent': 'فضي',
  'cuivré': 'نحاسي',
  'bronze': 'برونزي',
  'laiton': 'نحاس أصفر',
  'marron': 'بني',
  'bois naturel': 'بني خشبي طبيعي',
  'beige': 'بيج',
  'jaune': 'أصفر',
  'orange': 'برتقالي',
  'gris': 'رمادي',
  'turquoise': 'فيروزي',
  'bordeaux': 'عنابي',
  'ivoire': 'عاجي',
  'multicolore': 'متعدد الألوان',
};

const EXACT_AR_TO_FR: Record<string, string> = Object.fromEntries(
  Object.entries(EXACT_FR_TO_AR).map(([fr, ar]) => [ar.trim(), capitalizeFr(fr)])
);

function capitalizeFr(text: string): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const RAW_PHRASES_FR_AR: Array<[string, string]> = [
  ['service à thé royal', 'طقم شاي ملكي'],
  ['service à thé', 'طقم شاي'],
  ['en bois de cèdre sculpté', 'من خشب الأرز المنحوت'],
  ['bois de cèdre massif', 'خشب الأرز الصلب'],
  ['bois de cèdre', 'خشب الأرز'],
  ['en cuivre cisélé', 'من النحاس المنقوش'],
  ['en argent ciselé', 'من الفضة المنقوشة'],
  ['en céramique de fès', 'من خزف فاس'],
  ['peint à la main', 'مرسوم يدوياً'],
  ['peinte à la main', 'مرسومة يدوياً'],
  ['sculpté à la main', 'منحوت يدوياً'],
  ['sculptée à la main', 'منحوتة يدوياً'],
  ['gravé à la main', 'منقوش يدوياً'],
  ['gravée à la main', 'منقوشة يدوياً'],
  ['fait main', 'صناعة يدوية'],
  ['faite main', 'صناعة يدوية'],
  ['du moyen-atlas', 'من الأطلس المتوسط'],
  ['moyen-atlas', 'الأطلس المتوسط'],
  ['motifs géométriques', 'زخارف هندسية'],
  ['motif floral', 'زخارف نباتية'],
  ['vert émeraude', 'أخضر زمردي'],
  ['bleu de cobalt', 'أزرق كوبالت'],
  ['bleu cobalt', 'أزرق كوبالت'],
  ['patine authentique', 'بريق عتيق أصيل'],
  ['coffre de mariage', 'صندوق زواج تقليدي'],
  ['plateau circulaire', 'صينية دائرية'],
  ['magasin principal', 'المتجر الرئيسي'],
  ['dépôt principal', 'المستودع الرئيسي'],
  ['lanterne fassi', 'فانوس فاسي'],
  ['lanterne', 'فانوس'],
  ['lustre', 'ثريا'],
  ['suspension', 'مصباح معلق'],
  ['applique', 'مصباح جداري'],
  ['bougeoir', 'شمعدان'],
  ['chandelier', 'شمعدان'],
  ['coffre berbère', 'صندوق أمازيغي'],
  ['coffre', 'صندوق'],
  ['commode', 'خزانة أدراج'],
  ['armoire', 'خزانة'],
  ['table basse', 'طاولة منخفضة'],
  ['table', 'طاولة'],
  ['chaise', 'كرسي'],
  ['miroir', 'مرآة'],
  ['cadre', 'إطار'],
  ['plat décoratif', 'طبق للزينة'],
  ['plat ancien', 'طبق أثري'],
  ['plat', 'طبق'],
  ['assiette', 'صحن'],
  ['bol', 'زبدية'],
  ['vase', 'مزهرية'],
  ['jarre', 'جرة'],
  ['pot', 'إناء'],
  ['théière', 'براد شاي'],
  ['sucrier', 'سكرية'],
  ['plateau', 'صينية'],
  ['aiguière', 'إبريق'],
  ['encensoir', 'مبخرة'],
  ['tapis berbère', 'زربية أمازيغية'],
  ['tapis', 'زربية'],
  ['kilim', 'كليم'],
  ['coussin', 'وسادة'],
  ['tenture', 'ستارة تقليدية'],
  ['collier', 'عقد'],
  ['bracelet', 'سوار'],
  ['bague', 'خاتم'],
  ['fibule', 'بروش أمازيغي'],
  ['poignard', 'خنجر'],
  ['sabre', 'سيف'],
  ['horloge', 'ساعة حائطية'],
  ['lampe', 'مصباح'],
  ['statuette', 'تمثال صغير'],
  ['sculpture', 'منحوتة'],
  ['tableau', 'لوحة'],
  ['en cuivre', 'من النحاس'],
  ['en laiton', 'من النحاس الأصفر'],
  ['en argent', 'من الفضة'],
  ['en bronze', 'من البرونز'],
  ['en bois', 'من الخشب'],
  ['en céramique', 'من الخزف'],
  ['en verre', 'من الزجاج'],
  ['en laine', 'من الصوف'],
  ['en cuir', 'من الجلد'],
  ['en fer forgé', 'من الحديد المطاوع'],
  ['cuivre', 'نحاس'],
  ['laiton', 'نحاس أصفر'],
  ['argent', 'فضة'],
  ['bronze', 'برونز'],
  ['bois', 'خشب'],
  ['cèdre', 'أرز'],
  ['céramique', 'خزف'],
  ['poterie', 'فخار'],
  ['marbre', 'رخام'],
  ['pierre', 'حجر'],
  ['laine', 'صوف'],
  ['soie', 'حرير'],
  ['cuir', 'جلد'],
  ['ciselé', 'منقوش'],
  ['ciselée', 'منقوشة'],
  ['sculpté', 'منحوت'],
  ['sculptée', 'منحوتة'],
  ['gravé', 'محفور'],
  ['gravée', 'محفورة'],
  ['ajouré', 'مخرم'],
  ['ajourée', 'مخرمة'],
  ['émaillé', 'مطلي بالمينا'],
  ['émaillée', 'مطلية بالمينا'],
  ['ancien', 'أثري'],
  ['ancienne', 'أثرية'],
  ['antique', 'عتيق'],
  ['traditionnel', 'تقليدي'],
  ['traditionnelle', 'تقليدية'],
  ['authentique', 'أصيل'],
  ['berbère', 'أمازيغي'],
  ['marocain', 'مغربي'],
  ['marocaine', 'مغربية'],
  ['fassi', 'فاسي'],
  ['royal', 'ملكي'],
  ['royale', 'ملكية'],
  ['grand', 'كبير'],
  ['grande', 'كبيرة'],
  ['petit', 'صغير'],
  ['petite', 'صغيرة'],
  ['octogonal', 'مثمن'],
  ['octogonale', 'مثمنة'],
  ['circulaire', 'دائري'],
  ['rectangulaire', 'مستطيل'],
  ['décoratif', 'تزييني'],
  ['décorative', 'تزيينية'],
  ['de fès', 'من فاس'],
  ['de marrakech', 'من مراكش'],
  ['de rabat', 'من الرباط'],
  ['fès', 'فاس'],
  ['marrakech', 'مراكش'],
  ['rabat', 'الرباط'],
  ['blanc', 'أبيض'],
  ['blanche', 'بيضاء'],
  ['noir', 'أسود'],
  ['noire', 'سوداء'],
  ['bleu', 'أزرق'],
  ['bleue', 'زرقاء'],
  ['vert', 'أخضر'],
  ['verte', 'خضراء'],
  ['rouge', 'أحمر'],
  ['doré', 'ذهبي'],
  ['dorée', 'ذهبية'],
  ['argenté', 'فضي'],
  ['argentée', 'فضية'],
  ['marron', 'بني'],
  ['beige', 'بيج'],
  ['jaune', 'أصفر'],
  ['gris', 'رمادي'],
  ['turquoise', 'فيروزي'],
  ['avec', 'مع'],
  ['et', 'و'],
  ['pour', 'لـ'],
];

const PHRASE_GLOSSARY_FR_AR: Array<[string, string]> = [...RAW_PHRASES_FR_AR].sort(
  (a, b) => b[0].length - a[0].length
);

const PHRASE_GLOSSARY_AR_FR: Array<[string, string]> = [...PHRASE_GLOSSARY_FR_AR]
  .map(([fr, ar]): [string, string] => [ar, fr])
  .sort((a, b) => b[0].length - a[0].length);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function translateTextAuto(rawText: string, targetLang: Language): string {
  const text = String(rawText || '').trim();
  if (!text) return '';

  const isInputAr = containsArabicScript(text);
  if (targetLang === 'ar' && isInputAr) return text;
  if (targetLang === 'fr' && !isInputAr) return text;

  const lower = text.toLowerCase();
  if (targetLang === 'ar') {
    if (EXACT_FR_TO_AR[lower]) return EXACT_FR_TO_AR[lower];
    let result = text;
    for (const [fr, ar] of PHRASE_GLOSSARY_FR_AR) {
      const re = new RegExp(`(?<![A-Za-zÀ-ÿ0-9])${escapeRegExp(fr)}(?![A-Za-zÀ-ÿ0-9])`, 'gi');
      result = result.replace(re, ar);
    }
    // Clean up stray French connector prepositions left adjacent to Arabic words
    result = result
      .replace(/(?:^|\s)(?:en|de|du|des|la|le|les|à|au|aux|d'|l')\s+(?=[\u0600-\u06FF])/gi, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return result;
  }

  // targetLang === 'fr'
  if (EXACT_AR_TO_FR[text]) return EXACT_AR_TO_FR[text];
  let result = text;
  for (const [ar, fr] of PHRASE_GLOSSARY_AR_FR) {
    if (result.includes(ar)) {
      result = result.split(ar).join(fr);
    }
  }
  result = result.replace(/\s{2,}/g, ' ').trim();
  return capitalizeFr(result);
}

export function populateBilingualProductFields<T extends BilingualTextPayload>(
  payload: T,
  sourceLang: Language = 'fr'
): T & Required<BilingualTextPayload> {
  const rawName = (payload.name || '').trim();
  const rawDesc = (payload.description || '').trim();
  const rawCat = (payload.category || '').trim();
  const rawColor = (payload.color || '').trim();

  const nameIsAr = rawName ? containsArabicScript(rawName) : sourceLang === 'ar';
  const descIsAr = rawDesc ? containsArabicScript(rawDesc) : sourceLang === 'ar';
  const catIsAr = rawCat ? containsArabicScript(rawCat) : sourceLang === 'ar';
  const colorIsAr = rawColor ? containsArabicScript(rawColor) : sourceLang === 'ar';

  const nameFr = (payload.nameFr || '').trim() || (!nameIsAr ? rawName : translateTextAuto(rawName, 'fr'));
  const nameAr = (payload.nameAr || '').trim() || (nameIsAr ? rawName : translateTextAuto(rawName, 'ar'));

  const descriptionFr =
    (payload.descriptionFr || '').trim() ||
    (!descIsAr ? rawDesc : translateTextAuto(rawDesc, 'fr'));
  const descriptionAr =
    (payload.descriptionAr || '').trim() ||
    (descIsAr ? rawDesc : translateTextAuto(rawDesc, 'ar'));

  const categoryFr =
    (payload.categoryFr || '').trim() || (!catIsAr ? rawCat : translateTextAuto(rawCat, 'fr'));
  const categoryAr =
    (payload.categoryAr || '').trim() || (catIsAr ? rawCat : translateTextAuto(rawCat, 'ar'));

  const colorFr =
    (payload.colorFr || '').trim() || (!colorIsAr ? rawColor : translateTextAuto(rawColor, 'fr'));
  const colorAr =
    (payload.colorAr || '').trim() || (colorIsAr ? rawColor : translateTextAuto(rawColor, 'ar'));

  return {
    ...payload,
    name: rawName || nameFr || nameAr,
    nameFr,
    nameAr,
    description: rawDesc || descriptionFr || descriptionAr,
    descriptionFr,
    descriptionAr,
    category: rawCat || categoryFr || categoryAr,
    categoryFr,
    categoryAr,
    color: rawColor || colorFr || colorAr,
    colorFr,
    colorAr,
  };
}

export function getLocalizedProductText(
  product: Pick<
    Product,
    | 'name'
    | 'nameFr'
    | 'nameAr'
    | 'description'
    | 'descriptionFr'
    | 'descriptionAr'
    | 'category'
    | 'categoryFr'
    | 'categoryAr'
    | 'color'
    | 'colorFr'
    | 'colorAr'
    | 'warehouseName'
    | 'supplier'
  >,
  lang: Language
): {
  name: string;
  description: string;
  category: string;
  color: string;
  warehouseName: string;
  supplier: string;
} {
  if (lang === 'ar') {
    const name =
      (product.nameAr || '').trim() || translateTextAuto(product.nameFr || product.name, 'ar');
    const description =
      (product.descriptionAr || '').trim() ||
      translateTextAuto(product.descriptionFr || product.description, 'ar');
    const category =
      (product.categoryAr || '').trim() ||
      translateTextAuto(product.categoryFr || product.category || '', 'ar');
    const color =
      (product.colorAr || '').trim() ||
      translateTextAuto(product.colorFr || product.color || '', 'ar');
    const warehouseName = translateTextAuto(product.warehouseName || '', 'ar');
    const supplier = translateTextAuto(product.supplier || '', 'ar');
    return { name, description, category, color, warehouseName, supplier };
  }

  const name =
    (product.nameFr || '').trim() || translateTextAuto(product.nameAr || product.name, 'fr');
  const description =
    (product.descriptionFr || '').trim() ||
    translateTextAuto(product.descriptionAr || product.description, 'fr');
  const category =
    (product.categoryFr || '').trim() ||
    translateTextAuto(product.categoryAr || product.category || '', 'fr');
  const color =
    (product.colorFr || '').trim() ||
    translateTextAuto(product.colorAr || product.color || '', 'fr');
  const warehouseName = translateTextAuto(product.warehouseName || '', 'fr');
  const supplier = translateTextAuto(product.supplier || '', 'fr');
  return { name, description, category, color, warehouseName, supplier };
}

export function localizeProduct(product: Product, lang: Language): Product {
  const loc = getLocalizedProductText(product, lang);
  return {
    ...product,
    name: loc.name,
    description: loc.description,
    category: loc.category,
    color: loc.color,
    warehouseName: loc.warehouseName,
    supplier: loc.supplier,
  };
}

export function localizeWarehouse(warehouse: Warehouse, lang: Language): Warehouse {
  return {
    ...warehouse,
    name: translateTextAuto(warehouse.name, lang),
    location: translateTextAuto(warehouse.location || '', lang),
  };
}

export function localizeProductHistoryEvent(
  event: ProductHistoryEvent,
  lang: Language
): ProductHistoryEvent {
  if (lang === 'fr') return event;

  let summary = event.summary || '';
  let details = event.details || '';

  summary = summary
    .replace(/^Fiche créée\s*/i, 'تم إنشاء البطاقة ')
    .replace(/^Fiche initialisée\s*/i, 'تمت تهيئة البطاقة ')
    .replace(/^Article créé\s*/i, 'تمت إضافة المنتج ')
    .replace(/^Mise à jour fiche/i, 'تم تحديث البطاقة')
    .replace(/^Vente QR\s*/i, 'بيع عبر QR ')
    .replace(/^Vente POS\s*/i, 'بيع مباشر ')
    .replace(/^Annulation facture\s*/i, 'إلغاء الفاتورة ')
    .replace(/^Transfert vers\s*/i, 'تحويل إلى ');

  details = details
    .replace(/Fournisseur:\s*/gi, 'المورد: ')
    .replace(/Client:\s*/gi, 'العميل: ')
    .replace(/Client comptoir/gi, 'عميل عابر')
    .replace(/Magasin Principal/gi, 'المتجر الرئيسي');

  details = details
    .split(' · ')
    .map((part) => (containsArabicScript(part) ? part : translateTextAuto(part, 'ar')))
    .join(' · ');

  return {
    ...event,
    summary,
    details,
  };
}
