import { useState } from 'react';
import {
  BookOpen,
  Camera,
  ChevronLeft,
  ChevronRight,
  Coins,
  FileSpreadsheet,
  Film,
  Link2,
  MessageCircle,
  PlusSquare,
  Share2,
  Users,
  X,
} from 'lucide-react';
import type { Language } from '../types';
import { translations } from '../i18n';
import { GuideIllustration, type GuideSectionId } from './GuideIllustrations';

export type GuideQuickAction = 'add-product' | 'open-settings';

interface GuideModalProps {
  isOpen: boolean;
  lang: Language;
  initialSection?: GuideSectionId;
  onClose: () => void;
  onQuickAction?: (action: GuideQuickAction) => void;
}

interface GuideStep {
  title: string;
  description: string;
}

interface GuideSection {
  id: GuideSectionId;
  navLabel: string;
  title: string;
  summary: string;
  icon: typeof BookOpen;
  quickAction?: GuideQuickAction;
  steps: [GuideStep, GuideStep, GuideStep];
}

function getGuideSections(lang: Language): GuideSection[] {
  if (lang === 'ar') {
    return [
      {
        id: 'add-product',
        navLabel: 'إضافة منتج',
        title: 'إضافة منتج وصور وفيديو',
        summary: 'أضف تحفك بسهولة مع التقاط صور متعددة أو تسجيل فيديو مباشر وتوليد الرمز تلقائياً.',
        icon: PlusSquare,
        quickAction: 'add-product',
        steps: [
          {
            title: 'افتح نموذج الإضافة',
            description: 'اضغط على الزر الأخضر «إضافة منتج» في شريط الأدوات أو أسفل الشاشة.',
          },
          {
            title: 'التقط صوراً أو فيديو',
            description: 'اختر «الكاميرا (صورة / فيديو)» للتصوير المباشر أو «استيراد» لإضافة ملفات من الهاتف.',
          },
          {
            title: 'املأ البيانات واحفظ',
            description: 'أدخل اسم التحفة والأبعاد وسعر البيع ثم اضغط «حفظ»؛ يتم إنشاء الرمز (مثل L0001) تلقائياً.',
          },
        ],
      },
      {
        id: 'add-logo',
        navLabel: 'شعار المتجر',
        title: 'إضافة أو تغيير شعار المتجر',
        summary: 'خصّص شعار متجرك ليظهر أعلى التطبيق وداخل بطاقات المشاركة الرسمية.',
        icon: Camera,
        quickAction: 'open-settings',
        steps: [
          {
            title: 'افتح إعدادات المتجر',
            description: 'اضغط على شعار التطبيق وأيقونة الكاميرا في أعلى يمين الشاشة.',
          },
          {
            title: 'اختر صورة الشعار',
            description: 'اضغط «استيراد شعار» من المعرض أو «التقاط صورة للشعار» بالكاميرا.',
          },
          {
            title: 'احفظ الإعدادات',
            description: 'اضغط «حفظ الإعدادات» لتحديث الشعار فوراً في الشريط العلوي.',
          },
        ],
      },
      {
        id: 'change-currency',
        navLabel: 'تغيير العملة',
        title: 'تغيير العملة وحساب الأسعار',
        summary: 'تتحول جميع الأسعار تلقائياً وفق الصيغة الثابتة: 100 DH = 100 MAD = 10 USD = 10 EUR.',
        icon: Coins,
        quickAction: 'open-settings',
        steps: [
          {
            title: 'افتح نافذة الشعار والعملة',
            description: 'اضغط على اسم المتجر والشعار في أعلى يمين الشاشة.',
          },
          {
            title: 'اختر العملة المطلوبة',
            description: 'حدد MAD أو DH أو EUR أو USD أو TND أو DZD، وسيتم تحويل المبالغ تلقائياً.',
          },
          {
            title: 'أكّد التغيير',
            description: 'اضغط «حفظ الإعدادات» لتطبيق العملة الجديدة على البطاقات والإحصائيات وملف Excel.',
          },
        ],
      },
      {
        id: 'link-accounts',
        navLabel: 'ربط الحسابات',
        title: 'ربط حساب فيسبوك وإنستغرام',
        summary: 'اربط صفحتك على فيسبوك وحسابك الاحترافي على إنستغرام للنشر المباشر في أي وقت.',
        icon: Link2,
        quickAction: 'open-settings',
        steps: [
          {
            title: 'انتقل إلى قسم الحسابات',
            description: 'تجد القسم في «الإعداد الأولي للمتجر» أو داخل «شعار المتجر والعملة».',
          },
          {
            title: 'اربط حساب Meta',
            description: 'اضغط «ربط حساب فيسبوك وإنستغرام» لتسجيل الدخول، أو أدخل اسم صفحتك يدوياً.',
          },
          {
            title: 'حدد الصفحة والحساب المستهدف',
            description: 'اختر صفحة فيسبوك وحساب إنستغرام من القائمة ثم احفظ الإعدادات.',
          },
        ],
      },
      {
        id: 'post-whatsapp',
        navLabel: 'النشر على واتساب',
        title: 'مشاركة بطاقة المنتج عبر واتساب',
        summary: 'يُنشئ التطبيق صورة بطاقة متكاملة (PNG) تضم جميع صور التحفة وسعرها وتفاصيلها.',
        icon: MessageCircle,
        steps: [
          {
            title: 'اضغط على زر المشاركة',
            description: 'من بطاقة المنتج أو تفاصيله، اضغط على أيقونة المشاركة.',
          },
          {
            title: 'اختر «واتساب»',
            description: 'يقوم التطبيق بتجهيز صورة البطاقة مع الصور والمعلومات ونسخ النص تلقائياً.',
          },
          {
            title: 'أرسل البطاقة في المحادثة',
            description: 'اختر العميل أو المجموعة في واتساب وأرسل الصورة مع لصق النص عند الحاجة.',
          },
        ],
      },
      {
        id: 'post-facebook',
        navLabel: 'النشر على فيسبوك',
        title: 'النشر على صفحة فيسبوك',
        summary: 'خصّص منشور فيسبوك بإرفاق بطاقة المنتج أو الصور أو الفيديو مع النص والوسوم.',
        icon: Share2,
        steps: [
          {
            title: 'اختر «فيسبوك» من نافذة المشاركة',
            description: 'افتح مشاركة المنتج ثم اضغط على زر «فيسبوك» الأزرق.',
          },
          {
            title: 'حدد الصيغة واكتب النص',
            description: 'اختر (بطاقة PNG أو صورة أو فيديو أو نص) وعدّل رسالة المنشور والوسوم.',
          },
          {
            title: 'انشر على صفحتك',
            description: 'اضغط «نشر على صفحة فيسبوك» للنشر المباشر أو «مشاركة على فيسبوك» للفتح واللصق.',
          },
        ],
      },
      {
        id: 'post-instagram',
        navLabel: 'النشر على إنستغرام',
        title: 'النشر على إنستغرام والريلز (Reels)',
        summary: 'انشر صورة كلاسيكية أو أنشئ فيديو ريل عمودي (9:16) مباشرة من صور المنتج.',
        icon: Film,
        steps: [
          {
            title: 'افتح «إنستغرام» أو «ريل إنستغرام»',
            description: 'من نافذة المشاركة، اختر «إنستغرام» للمنشورات أو «ريل إنستغرام» للفيديو.',
          },
          {
            title: 'أنشئ فيديو ريل أو عدّل النص',
            description: 'اضغط «إنشاء فيديو ريل من الصور» أو صوّر فيديو، ثم حدد الوصف والوسوم والمدينة.',
          },
          {
            title: 'انشر على إنستغرام',
            description: 'اضغط «نشر مباشرة» أو «تجهيز وفتح إنستغرام» لإتمام النشر.',
          },
        ],
      },
      {
        id: 'search-export',
        navLabel: 'البحث و Excel',
        title: 'البحث، اللغة، الوضع الداكن و Excel',
        summary: 'ابحث فوراً بالرمز أو الاسم، بدّل اللغة أو المظهر، وصدّر كامل المخزون إلى Excel.',
        icon: FileSpreadsheet,
        steps: [
          {
            title: 'بدّل اللغة أو الوضع الداكن',
            description: 'من أعلى يسار الشاشة، اضغط على أيقونة القمر/الشمس أو زر «FR | العربية».',
          },
          {
            title: 'ابحث بالاسم أو بالرمز',
            description: 'اكتب اسم القطعة أو رمزها (مثل L0001) في مربع البحث للوصول السريع.',
          },
          {
            title: 'صدّر ملف Excel',
            description: 'اضغط «تصدير Excel» لتنزيل جدول المخزون كاملاً بالعملة المختارة.',
          },
        ],
      },
      {
        id: 'customers',
        navLabel: 'العملاء والمشتريات',
        title: 'إدارة العملاء وسجل المشتريات',
        summary:
          'أنشئ ملفات العملاء (بائع، هاوٍ، عميل دائم) مع تسجيل المشتريات وتصدير Excel فردي أو جماعي.',
        icon: Users,
        steps: [
          {
            title: 'افتح قسم العملاء وأضف ملفاً',
            description:
              'اضغط على تبويب «العملاء والمشتريات» ثم «عميل جديد» لإدخال الاسم والهاتف (النقر على الرقم يفتح واتساب مباشرة) والعنوان والمدينة والفئة.',
          },
          {
            title: 'سجّل المشتريات',
            description:
              'افتح ملف العميل واضغط «إضافة عملية شراء» لاختيار منتج من المخزون أو كتابته يدوياً مع الكمية والتاريخ.',
          },
          {
            title: 'صدّر إلى Excel (فردي أو جماعي)',
            description:
              'استخدم «تصدير Excel» داخل بطاقة العميل لتصدير ملفه فقط، أو «تصدير Excel (الجميع)» لتصدير كل العملاء.',
          },
        ],
      },
    ];
  }

  return [
    {
      id: 'add-product',
      navLabel: 'Ajouter un produit',
      title: 'Ajouter un produit (Photos & Vidéos)',
      summary:
        'Créez une fiche complète avec plusieurs photos ou vidéos filmées en direct et un code généré automatiquement.',
      icon: PlusSquare,
      quickAction: 'add-product',
      steps: [
        {
          title: 'Ouvrir le formulaire',
          description: 'Appuyez sur le bouton vert « Nouvel article » en haut ou dans la barre mobile.',
        },
        {
          title: 'Capturer photos ou vidéo',
          description:
            'Touchez « Caméra (Photo / Vidéo) » pour filmer en direct ou « Importer » depuis votre galerie.',
        },
        {
          title: 'Renseigner et enregistrer',
          description:
            'Saisissez le nom, les dimensions et le prix de vente puis validez avec « Enregistrer » (code ex. L0001).',
        },
      ],
    },
    {
      id: 'add-logo',
      navLabel: 'Ajouter un logo',
      title: 'Ajouter ou changer le logo',
      summary:
        'Personnalisez votre emblème de boutique dans l’en-tête et sur toutes vos cartes de partage.',
      icon: Camera,
      quickAction: 'open-settings',
      steps: [
        {
          title: 'Ouvrir les paramètres boutique',
          description: 'Touchez le nom et l’icône caméra du logo tout en haut à droite.',
        },
        {
          title: 'Choisir ou photographier le logo',
          description:
            'Appuyez sur « Importer un logo » depuis vos fichiers ou « Prendre en photo ».',
        },
        {
          title: 'Valider le changement',
          description: 'Appuyez sur « Enregistrer les préférences » pour appliquer le nouveau logo.',
        },
      ],
    },
    {
      id: 'change-currency',
      navLabel: 'Changer la devise',
      title: 'Changer la devise d’affichage',
      summary:
        'Tous les montants sont recalculés automatiquement selon la règle : 100 DH = 100 MAD = 10 USD = 10 EUR.',
      icon: Coins,
      quickAction: 'open-settings',
      steps: [
        {
          title: 'Accéder aux réglages boutique',
          description: 'Cliquez sur le logo de la boutique en haut à droite.',
        },
        {
          title: 'Sélectionner la devise',
          description:
            'Choisissez MAD, DH, EUR, USD, TND ou DZD : l’aperçu de conversion s’affiche juste en dessous.',
        },
        {
          title: 'Enregistrer et convertir',
          description:
            'Validez avec « Enregistrer les préférences » pour mettre à jour fiches, totaux et export Excel.',
        },
      ],
    },
    {
      id: 'link-accounts',
      navLabel: 'Lier Facebook / IG',
      title: 'Lier un compte Facebook & Instagram',
      summary:
        'Reliez votre Page Facebook et votre compte Instagram pour publier en un clic dès la création ou à tout moment.',
      icon: Link2,
      quickAction: 'open-settings',
      steps: [
        {
          title: 'Ouvrir la section Réseaux sociaux',
          description:
            'Disponible dans la « Configuration initiale » ou via le bouton logo en haut à droite.',
        },
        {
          title: 'Connecter votre compte Meta',
          description:
            'Appuyez sur « Connecter Facebook & Instagram » pour autoriser l’accès, ou saisissez vos @identifiants.',
        },
        {
          title: 'Choisir la Page et enregistrer',
          description:
            'Sélectionnez la Page Facebook et le compte Instagram cible puis cliquez sur Enregistrer.',
        },
      ],
    },
    {
      id: 'post-whatsapp',
      navLabel: 'Publier WhatsApp',
      title: 'Publier un produit sur WhatsApp',
      summary:
        'Générez automatiquement une carte image PNG réunissant les photos, dimensions, code et prix.',
      icon: MessageCircle,
      steps: [
        {
          title: 'Ouvrir le menu Partager',
          description: 'Appuyez sur l’icône Partager sur une fiche produit ou dans sa vue détaillée.',
        },
        {
          title: 'Appuyer sur WhatsApp',
          description:
            'L’application crée la carte PNG complète avec les photos et copie la légende dans le presse-papiers.',
        },
        {
          title: 'Envoyer au client',
          description:
            'Sélectionnez votre contact ou groupe WhatsApp, joignez la carte générée et collez le texte si besoin.',
        },
      ],
    },
    {
      id: 'post-facebook',
      navLabel: 'Publier Facebook',
      title: 'Publier un produit sur Facebook',
      summary:
        'Préparez votre publication Facebook avec carte PNG, photos, vidéo et hashtags avant de l’envoyer.',
      icon: Share2,
      steps: [
        {
          title: 'Choisir Facebook dans Partager',
          description: 'Depuis la fenêtre de partage du produit, appuyez sur le bouton bleu « Facebook ».',
        },
        {
          title: 'Personnaliser format et texte',
          description:
            'Choisissez Carte PNG, Photo, Vidéo ou Texte, puis ajustez le message et les hashtags.',
        },
        {
          title: 'Publier sur la Page',
          description:
            'Cliquez sur « Publier sur la Page Facebook » (ou « Partager sur Facebook » pour coller directement).',
        },
      ],
    },
    {
      id: 'post-instagram',
      navLabel: 'Publier Instagram',
      title: 'Publier sur Instagram (Post & Reel)',
      summary:
        'Partagez une photo dans le fil ou transformez les photos du produit en Reel vidéo vertical 9:16.',
      icon: Film,
      steps: [
        {
          title: 'Sélectionner Instagram ou Reel',
          description:
            'Dans Partager, touchez « Instagram » pour une photo ou « Reel Instagram » pour une vidéo.',
        },
        {
          title: 'Générer le Reel & la légende',
          description:
            'Appuyez sur « Créer un Reel vidéo depuis les photos » (ou filmez un clip) et complétez légende, hashtags et ville.',
        },
        {
          title: 'Publier sur Instagram',
          description:
            'Appuyez sur « Publier » ou « Préparer & Ouvrir Instagram » pour finaliser votre post ou Reel.',
        },
      ],
    },
    {
      id: 'search-export',
      navLabel: 'Recherche & Excel',
      title: 'Recherche, Langue, Thème & Export Excel',
      summary:
        'Retrouvez une pièce par code ou nom, basculez en Arabe/Français ou mode sombre et exportez votre stock.',
      icon: FileSpreadsheet,
      steps: [
        {
          title: 'Langue & Mode sombre',
          description:
            'En haut à gauche, utilisez le bouton Lune/Soleil et le sélecteur « FR | العربية ».',
        },
        {
          title: 'Recherche rapide par code',
          description:
            'Tapez un nom ou un code (ex. L0001) dans la barre de recherche pour filtrer instantanément.',
        },
        {
          title: 'Exporter vers Excel',
          description:
            'Cliquez sur « Exporter Excel » pour télécharger le catalogue complet au format .xlsx.',
        },
      ],
    },
    {
      id: 'customers',
      navLabel: 'Clients & Achats',
      title: 'Gestion des clients, achats & export Excel',
      summary:
        'Créez vos fiches clients (Vendeur, Amateur, Client régulier), suivez leurs achats et exportez un ou tous les clients vers Excel.',
      icon: Users,
      steps: [
        {
          title: 'Créer un profil client',
          description:
            'Ouvrez l’onglet « Clients & Achats » puis « Nouveau client » pour saisir nom, téléphone (cliquez sur le numéro pour ouvrir WhatsApp), adresse, ville et catégorie.',
        },
        {
          title: 'Enregistrer les achats',
          description:
            'Touchez + ou ouvrez la fiche du client pour ajouter un article (du stock ou libre), quantité, prix et date.',
        },
        {
          title: 'Exporter Excel (Individuel / Tous)',
          description:
            'Cliquez sur l’icône Excel d’un client pour son historique seul, ou « Exporter Excel (Tous) » pour l’ensemble.',
        },
      ],
    },
  ];
}

const STEP_BADGE_COLORS = [
  'bg-[#DC2626] text-white',
  'bg-[#D97706] text-white',
  'bg-[#059669] text-white',
] as const;

const STEP_ACTIVE_BORDERS = [
  'border-[#DC2626] bg-red-50/70 dark:border-[#EF4444] dark:bg-red-950/25',
  'border-[#D97706] bg-amber-50/70 dark:border-[#F59E0B] dark:bg-amber-950/25',
  'border-[#059669] bg-emerald-50/70 dark:border-[#10B981] dark:bg-emerald-950/25',
] as const;

export function GuideModal({
  isOpen,
  lang,
  initialSection = 'add-product',
  onClose,
  onQuickAction,
}: GuideModalProps) {
  const t = translations[lang];
  const sections = getGuideSections(lang);
  const [selectedId, setSelectedId] = useState<GuideSectionId>(initialSection);
  const [activeStep, setActiveStep] = useState<number | null>(null);

  if (!isOpen) return null;

  const currentIndex = Math.max(
    0,
    sections.findIndex((sec) => sec.id === selectedId)
  );
  const currentSection = sections[currentIndex] || sections[0];

  const handleSelectSection = (id: GuideSectionId) => {
    setSelectedId(id);
    setActiveStep(null);
  };

  const handlePrev = () => {
    const prevIdx = (currentIndex - 1 + sections.length) % sections.length;
    handleSelectSection(sections[prevIdx].id);
  };

  const handleNext = () => {
    const nextIdx = (currentIndex + 1) % sections.length;
    handleSelectSection(sections[nextIdx].id);
  };

  const PrevIcon = lang === 'ar' ? ChevronRight : ChevronLeft;
  const NextIcon = lang === 'ar' ? ChevronLeft : ChevronRight;

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-[#DCE7E0] bg-white shadow-2xl sm:rounded-3xl dark:border-[#1E3A2D] dark:bg-[#0F2119]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Bar */}
        <div className="flex items-center justify-between gap-3 border-b border-[#DCE7E0] px-5 py-4 dark:border-[#1E3A2D]">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ECF7F1] text-[#115E3B] dark:bg-[#132B20] dark:text-[#34D399]">
              <BookOpen className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-display text-lg font-bold text-[#0B1F16] sm:text-xl dark:text-[#F2F9F5]">
                {t.guideTitle}
              </h2>
              <p className="truncate text-xs text-[#335947] dark:text-[#9EC0AE]">
                {t.guideSubtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mobile Horizontal Section Strip */}
        <nav
          aria-label={t.guideSectionsLabel}
          className="flex gap-2 overflow-x-auto border-b border-[#DCE7E0] bg-[#F7FAF8] px-4 py-2.5 md:hidden dark:border-[#1E3A2D] dark:bg-[#0A1812]"
        >
          {sections.map((section, idx) => {
            const Icon = section.icon;
            const active = section.id === currentSection.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => handleSelectSection(section.id)}
                className={`flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                  active
                    ? 'border-[#115E3B] bg-[#115E3B] text-white dark:border-[#10B981] dark:bg-[#10B981] dark:text-[#052E1C]'
                    : 'border-[#DCE7E0] bg-white text-[#335947] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#9EC0AE]'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>
                  {idx + 1}. {section.navLabel}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Main Body: Desktop Sidebar + Interactive Content */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Desktop Section Sidebar */}
          <aside
            aria-label={t.guideSectionsLabel}
            className="hidden w-64 shrink-0 overflow-y-auto border-e border-[#DCE7E0] bg-[#F7FAF8] p-3 md:block dark:border-[#1E3A2D] dark:bg-[#0A1812]"
          >
            <div className="space-y-1.5">
              {sections.map((section, idx) => {
                const Icon = section.icon;
                const active = section.id === currentSection.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => handleSelectSection(section.id)}
                    className={`flex min-h-[46px] w-full items-center gap-2.5 rounded-xl px-3 py-2 text-start text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-[#115E3B] text-white dark:bg-[#10B981] dark:text-[#052E1C]'
                        : 'text-[#335947] hover:bg-[#ECF7F1] hover:text-[#0B1F16] dark:text-[#9EC0AE] dark:hover:bg-[#162E23] dark:hover:text-[#F2F9F5]'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${
                        active
                          ? 'bg-white/20 text-white dark:bg-[#052E1C]/15 dark:text-[#052E1C]'
                          : 'bg-white text-[#115E3B] dark:bg-[#0F2119] dark:text-[#34D399]'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{section.navLabel}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Active Section Details + Annotated Visual */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-display text-lg font-bold text-[#0B1F16] sm:text-xl dark:text-[#F2F9F5]">
                  {currentIndex + 1}. {currentSection.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[#335947] sm:text-sm dark:text-[#9EC0AE]">
                  {currentSection.summary}
                </p>
              </div>
              <span className="tabular-nums text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                {currentIndex + 1} / {sections.length}
              </span>
            </div>

            {/* Annotated Screenshot & SVG Arrows */}
            <GuideIllustration
              sectionId={currentSection.id}
              lang={lang}
              activeStep={activeStep}
              onSelectStep={setActiveStep}
            />

            <p className="mt-2 text-center text-[11px] text-[#335947] dark:text-[#9EC0AE]">
              {t.guideHighlightHint}
            </p>

            {/* 3 Numbered Simple Steps matching Arrow Colors */}
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {currentSection.steps.map((step, index) => {
                const stepNum = index + 1;
                const isSelected = activeStep === stepNum;
                return (
                  <button
                    key={stepNum}
                    type="button"
                    onClick={() => setActiveStep(isSelected ? null : stepNum)}
                    className={`flex flex-col items-start rounded-2xl border p-3.5 text-start transition-all ${
                      isSelected
                        ? STEP_ACTIVE_BORDERS[index]
                        : 'border-[#DCE7E0] bg-[#F7FAF8] hover:border-[#115E3B]/40 dark:border-[#1E3A2D] dark:bg-[#091611] dark:hover:border-[#10B981]/40'
                    }`}
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${STEP_BADGE_COLORS[index]}`}
                      >
                        {stepNum}
                      </span>
                      <span className="text-xs font-bold text-[#0B1F16] sm:text-sm dark:text-[#F2F9F5]">
                        {step.title}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-[#335947] dark:text-[#9EC0AE]">
                      {step.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Navigation & Quick Action */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[#DCE7E0] bg-[#F7FAF8] px-4 py-3 sm:px-6 dark:border-[#1E3A2D] dark:bg-[#0A1812]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-white px-3.5 text-xs font-semibold text-[#0B1F16] hover:bg-[#ECF7F1] whitespace-nowrap shrink-0 dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#F2F9F5] dark:hover:bg-[#162E23]"
            >
              <PrevIcon className="h-4 w-4" />
              <span>{t.guidePrevSection}</span>
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-white px-3.5 text-xs font-semibold text-[#0B1F16] hover:bg-[#ECF7F1] whitespace-nowrap shrink-0 dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#F2F9F5] dark:hover:bg-[#162E23]"
            >
              <span>{t.guideNextSection}</span>
              <NextIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {currentSection.quickAction && onQuickAction && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onQuickAction(currentSection.quickAction!);
                }}
                className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#115E3B] px-4 text-xs font-semibold text-white hover:bg-[#0D4A2E] whitespace-nowrap shrink-0 dark:bg-[#10B981] dark:text-[#052E1C]"
              >
                <span>{t.guideTryAction}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="flex min-h-[44px] items-center rounded-xl border border-[#DCE7E0] bg-white px-4 text-xs font-semibold text-[#335947] hover:bg-[#ECF7F1] whitespace-nowrap shrink-0 dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#9EC0AE]"
            >
              {t.close}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
