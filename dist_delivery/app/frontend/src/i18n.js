import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  fr: {
    translation: {
      /* Navigation */
      menu: 'Menu',
      nav_themes: 'Thèmes',
      nav_indicators: 'Indicateurs',
      nav_about: 'À propos',
      nav_contact: 'Contact',
      nav_links: 'Liens utiles',
      nav_admin: 'Espace admin',
      nav_saisisseur: 'Espace saisisseur',

      /* Header */
      app_title: 'Base de Données Régionale de Marrakech-Safi',
      language: 'LANGUE',
      settings: 'Paramètres',
      logout: 'Déconnexion',
      infos: 'INFOS',
      manage_infos: 'Gérer les infos',

      /* Search */
      search_theme: 'Rechercher un thème...',
      search_indicator: 'Rechercher un indicateur...',
      search_subtheme: 'Rechercher un sous-thème...',
      search_generic: 'Barre de recherche',

      /* Actions */
      back: 'Retour',
      close: 'Fermer',
      save: 'Enregistrer',
      saving: 'Enregistrement...',
      apply: 'Appliquer',
      clear: 'Effacer',
      add_theme: 'Ajouter un thème',
      add_link: '+ Ajouter un lien',
      delete: 'Supprimer',
      choose_category: 'Choisir une catégorie',
      metadata: 'Métadonnées',

      /* Data tabs */
      tab_table: 'TABLEAU',
      tab_charts: 'GRAPHES',
      filters_available: 'Filtres Disponibles',
      advanced_config: 'Configuration Avancée',
      download: 'Télécharger',
      horizontal_view: 'Vue horizontale',
      vertical_view: 'Vue verticale',
      show_more_rows: 'Afficher plus de lignes',
      show_all_table: 'Afficher tout le tableau',
      reduce_table: 'Réduire le tableau',
      export_xlsx: 'Exporter XLSX',
      export_csv: 'Exporter CSV',
      export_txt: 'Exporter TXT',
      row_count: '{{count}} ligne(s)',
      hierarchy_count: '{{count}} niveau(x) hiérarchique(s)',
      period_count: '{{count}} période(s)',
      latest_period: 'Dernière période : {{value}}',
      selected_count: '{{count}} sélectionné(s)',
      options_count: '{{count}} option(s)',
      all: 'Tous',
      all_option: '-- Tous --',
      total: 'Total',
      no_table_to_export: 'Aucun tableau à exporter',
      export_view_horizontal: 'horizontal',
      export_view_vertical: 'vertical',
      export_view_flat: 'tableau',
      export_subtheme_title: 'Sous-thème : {{name}} ({{view}})',
      meta_definition: 'Définition',
      meta_unit: 'Unité',
      meta_periodicity: 'Périodicité',
      meta_indication: 'Indication',
      meta_source: 'Source',
      meta_coverage: 'Couverture',
      french_label: 'Français',
      arabic_label: 'Arabe',
      english_label: 'Anglais',

      /* Pages */
      useful_links: 'Liens utiles',
      about_default: 'À propos de la plateforme',
      about_coming_soon: 'Le contenu À propos sera bientôt disponible.',
      contact_default: 'Contact',
      email: 'Email',
      phone: 'Téléphone',
      address: 'Adresse',
      hours: 'Horaires',

      /* Languages */
      lang_fr: 'Français',
      lang_ar: 'عربية',
      lang_en: 'English',

      /* Theme */
      theme_step: 'THÈME',
    },
  },
  ar: {
    translation: {
      /* Navigation */
      menu: 'القائمة',
      nav_themes: 'الموضوع',
      nav_indicators: 'المؤشر',
      nav_about: 'حول',
      nav_contact: 'اتصل بنا',
      nav_links: 'روابط مفيدة',
      nav_admin: 'فضاء الإدارة',
      nav_saisisseur: 'فضاء المُدخِل',

      /* Header */
      app_title: 'قاعدة المعطيات الجهوية لبني ملال-خنيفرة',
      language: 'اللغة',
      settings: 'الإعدادات',
      logout: 'تسجيل الخروج',
      infos: 'أخبار',
      manage_infos: 'إدارة الأخبار',

      /* Search */
      search_theme: 'ابحث عن موضوع...',
      search_indicator: 'ابحث عن مؤشر...',
      search_subtheme: 'ابحث عن موضوع فرعي...',
      search_generic: 'شريط البحث',

      /* Actions */
      back: 'رجوع',
      close: 'إغلاق',
      save: 'حفظ',
      saving: 'جاري الحفظ...',
      apply: 'تطبيق',
      clear: 'مسح',
      add_theme: 'إضافة موضوع',
      add_link: '+ إضافة رابط',
      delete: 'حذف',
      choose_category: 'اختر فئة',
      metadata: 'البيانات الوصفية',

      /* Data tabs */
      tab_table: 'الجدول',
      tab_charts: 'الرسوم البيانية',
      filters_available: 'الفلاتر المتاحة',
      advanced_config: 'الإعدادات المتقدمة',
      download: 'تحميل',
      horizontal_view: 'عرض أفقي',
      vertical_view: 'عرض عمودي',
      show_more_rows: 'إظهار المزيد من الصفوف',
      show_all_table: 'إظهار الجدول كاملاً',
      reduce_table: 'تقليص الجدول',
      export_xlsx: 'تصدير XLSX',
      export_csv: 'تصدير CSV',
      export_txt: 'تصدير TXT',
      row_count: '{{count}} صف',
      hierarchy_count: '{{count}} مستوى هرمي',
      period_count: '{{count}} فترة',
      latest_period: 'آخر فترة: {{value}}',
      selected_count: '{{count}} محدد',
      options_count: '{{count}} خيار',
      all: 'الكل',
      all_option: '-- الكل --',
      total: 'المجموع',
      no_table_to_export: 'لا يوجد جدول للتصدير',
      export_view_horizontal: 'أفقي',
      export_view_vertical: 'عمودي',
      export_view_flat: 'جدول',
      export_subtheme_title: 'الموضوع الفرعي: {{name}} ({{view}})',
      meta_definition: 'التعريف',
      meta_unit: 'الوحدة',
      meta_periodicity: 'الدورية',
      meta_indication: 'الدلالة',
      meta_source: 'المصدر',
      meta_coverage: 'التغطية',
      french_label: 'الفرنسية',
      arabic_label: 'العربية',
      english_label: 'الإنجليزية',

      /* Pages */
      useful_links: 'روابط مفيدة',
      about_default: 'حول المنصة',
      about_coming_soon: 'سيتوفر محتوى "حول" قريباً.',
      contact_default: 'اتصل بنا',
      email: 'البريد الإلكتروني',
      phone: 'الهاتف',
      address: 'العنوان',
      hours: 'ساعات العمل',

      /* Languages */
      lang_fr: 'Français',
      lang_ar: 'عربية',
      lang_en: 'English',

      /* Theme */
      theme_step: 'الموضوع',
    },
  },
  en: {
    translation: {
      /* Navigation */
      menu: 'Menu',
      nav_themes: 'Themes',
      nav_indicators: 'Indicators',
      nav_about: 'About',
      nav_contact: 'Contact',
      nav_links: 'Useful links',
      nav_admin: 'Admin space',
      nav_saisisseur: 'Data entry space',

      /* Header */
      app_title: 'Regional Database of Beni Mellal-Khenifra',
      language: 'LANGUAGE',
      settings: 'Settings',
      logout: 'Logout',
      infos: 'INFO',
      manage_infos: 'Manage info',

      /* Search */
      search_theme: 'Search a theme...',
      search_indicator: 'Search an indicator...',
      search_subtheme: 'Search a sub-theme...',
      search_generic: 'Search bar',

      /* Actions */
      back: 'Back',
      close: 'Close',
      save: 'Save',
      saving: 'Saving...',
      apply: 'Apply',
      clear: 'Clear',
      add_theme: 'Add theme',
      add_link: '+ Add link',
      delete: 'Delete',
      choose_category: 'Choose a category',
      metadata: 'Metadata',

      /* Data tabs */
      tab_table: 'TABLE',
      tab_charts: 'CHARTS',
      filters_available: 'Available filters',
      advanced_config: 'Advanced configuration',
      download: 'Download',
      horizontal_view: 'Horizontal view',
      vertical_view: 'Vertical view',
      show_more_rows: 'Show more rows',
      show_all_table: 'Show full table',
      reduce_table: 'Reduce table',
      export_xlsx: 'Export XLSX',
      export_csv: 'Export CSV',
      export_txt: 'Export TXT',
      row_count: '{{count}} row(s)',
      hierarchy_count: '{{count}} hierarchical level(s)',
      period_count: '{{count}} period(s)',
      latest_period: 'Latest period: {{value}}',
      selected_count: '{{count}} selected',
      options_count: '{{count}} option(s)',
      all: 'All',
      all_option: '-- All --',
      total: 'Total',
      no_table_to_export: 'No table to export',
      export_view_horizontal: 'horizontal',
      export_view_vertical: 'vertical',
      export_view_flat: 'table',
      export_subtheme_title: 'Sub-theme: {{name}} ({{view}})',
      meta_definition: 'Definition',
      meta_unit: 'Unit',
      meta_periodicity: 'Periodicity',
      meta_indication: 'Indication',
      meta_source: 'Source',
      meta_coverage: 'Coverage',
      french_label: 'French',
      arabic_label: 'Arabic',
      english_label: 'English',

      /* Pages */
      useful_links: 'Useful links',
      about_default: 'About the platform',
      about_coming_soon: 'About content will be available soon.',
      contact_default: 'Contact',
      email: 'Email',
      phone: 'Phone',
      address: 'Address',
      hours: 'Hours',

      /* Languages */
      lang_fr: 'Français',
      lang_ar: 'عربية',
      lang_en: 'English',

      /* Theme */
      theme_step: 'THEME',
    },
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: (() => { try { return localStorage.getItem('app_lang') || 'fr'; } catch { return 'fr'; } })(),
    fallbackLng: 'fr',
    interpolation: { escapeValue: false },
  });

export default i18n;

// ---------------------------------------------------------------------------
// Static vocabulary for translating French data values → Arabic (display only).
// Used by the frontend when the visitor switches to Arabic mode.
// To add new translations: add entries to the object below.
// ---------------------------------------------------------------------------
export const DATA_TRANSLATIONS_FR_AR = {
  // ─── Noms de colonnes ───
  'Annee':              'السنة',
  'Annees':             'السنوات',
  'Année':              'السنة',
  'Années':             'السنوات',
  'Sexe':               'الجنس',
  'Milieu':             'الوسط',
  'Province':           'الإقليم',
  'Region':             'الجهة',
  'Région':             'الجهة',
  'Valeur':             'القيمة',
  'Dimension':          'البُعد',
  "Groupes d'âges":     'الفئات العمرية',
  'Groupes_d_ages':     'الفئات العمرية',
  "Groupe d'âge":       'الفئة العمرية',
  'Groupe_d_age':       'الفئة العمرية',
  'Niveau_Etude':       'مستوى الدراسة',
  'Niveau_Instruction': 'مستوى التعليم',
  'Etat_Matrimonial':   'الحالة العائلية',
  'Etat Matrimonial':   'الحالة العائلية',
  'Activite':           'النشاط',
  'Secteur':            'القطاع',
  'Tranche_Age':        'الشريحة العمرية',
  'Tranche Age':        'الشريحة العمرية',
  'Nationalite':        'الجنسية',
  'Categorie':          'الفئة',
  'Type':               'النوع',
  'Statut':             'الوضع',
  'Commune':            'الجماعة',
  'Indicateur':         'المؤشر',
  'Periode':            'الفترة',

  // ─── Valeurs – Sexe ───
  'Féminin':   'إناث',
  'Feminin':   'إناث',
  'Masculin':  'ذكور',
  'Femme':     'امرأة',
  'Femmes':    'النساء',
  'Homme':     'رجل',
  'Hommes':    'الرجال',

  // ─── Valeurs – Milieu ───
  'Urbain':    'حضري',
  'Urbaine':   'حضرية',
  'Urbaines':  'حضريات',
  'Rural':     'قروي',
  'Rurale':    'قروية',
  'Rurales':   'قرويات',

  // ─── Valeurs – État matrimonial ───
  'Célibataire':  'أعزب/عزباء',
  'Celibataire':  'أعزب/عزباء',
  'Marié':        'متزوج',
  'Marie':        'متزوج',
  'Mariée':       'متزوجة',
  'Mariee':       'متزوجة',
  'Divorcé':      'مطلق',
  'Divorce':      'مطلق',
  'Divorcée':     'مطلقة',
  'Divorcee':     'مطلقة',
  'Veuf':         'أرمل',
  'Veuve':        'أرملة',

  // ─── Valeurs communes ───
  'Total':      'المجموع',
  'Ensemble':   'المجموع الكلي',
  'National':   'وطني',
  'Nationale':  'وطنية',
  'Oui':        'نعم',
  'Non':        'لا',
};
