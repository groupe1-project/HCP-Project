import React, { Suspense, lazy, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter, Legend } from 'recharts';
import LoginPage from './LoginPage';
import { DATA_TRANSLATIONS_FR_AR } from './i18n';
import logoMain from './Image3.png';

const AdministratorsPage = lazy(() => import('./AdministratorsPage'));
const ChartModal = lazy(() => import('./components/ChartModal'));

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
const INFO_BANNER_CACHE_KEY = 'info_banner_cache';
const DEFAULT_INFO_BANNER_ITEMS = [{ text: "L'ICP du mois de Janvier 2026 est disponible", text_ar: '', text_en: '', url: '' }];
const AUTH_STORAGE_KEYS = [
  'auth_token',
  'user_id',
  'username',
  'first_name',
  'user_email',
  'user_role',
  'auth_token_admin',
  'user_id_admin',
  'username_admin',
  'first_name_admin',
  'user_email_admin',
  'user_role_admin',
  'auth_token_saisisseur',
  'user_id_saisisseur',
  'username_saisisseur',
  'first_name_saisisseur',
  'user_email_saisisseur',
  'user_role_saisisseur',
  'auth_context',
];

const getAuthStorageItem = (key) => {
  try { return sessionStorage.getItem(key) || ''; } catch { return ''; }
};

const hasAuthStorageItem = (key) => {
  try { return sessionStorage.getItem(key) !== null; } catch { return false; }
};

const setAuthStorageItem = (key, value) => {
  try { sessionStorage.setItem(key, String(value ?? '')); } catch { /* ignore storage errors */ }
  try { localStorage.removeItem(key); } catch { /* ignore storage errors */ }
};

const removeAuthStorageItem = (key) => {
  try { sessionStorage.removeItem(key); } catch { /* ignore storage errors */ }
  try { localStorage.removeItem(key); } catch { /* ignore storage errors */ }
};

const readInfoBannerCache = () => {
  try {
    const raw = localStorage.getItem(INFO_BANNER_CACHE_KEY);
    if (!raw) return DEFAULT_INFO_BANNER_ITEMS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_INFO_BANNER_ITEMS;
  } catch {
    return DEFAULT_INFO_BANNER_ITEMS;
  }
};

// --- COMPOSANTS DE STYLE ---
const SidebarIcon = ({ type }) => {
  const iconProps = {
    viewBox: '0 0 24 24',
    className: 'h-4 w-4',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  };

  switch (type) {
    case 'themes':
      return <svg {...iconProps}><path d="M4 7h16" /><path d="M7 4v16" /><path d="M11 11h9" /><path d="M11 16h9" /></svg>;
    case 'indicators':
      return <svg {...iconProps}><path d="M5 19V9" /><path d="M12 19V5" /><path d="M19 19v-7" /><path d="M3 19h18" /></svg>;
    case 'about':
      return <svg {...iconProps}><circle cx="12" cy="12" r="9" /><path d="M12 10v6" /><path d="M12 7h.01" /></svg>;
    case 'contact':
      return <svg {...iconProps}><path d="M4 6h16v12H4z" /><path d="m4 8 8 6 8-6" /></svg>;
    case 'links':
      return <svg {...iconProps}><path d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 1 0-7.07-7.07L10.7 5.2" /><path d="M14 11a5 5 0 0 0-7.07 0L4.8 13.12a5 5 0 1 0 7.07 7.07l1.41-1.41" /></svg>;
    case 'admin':
      return <svg {...iconProps}><path d="M12 3 4 7v5c0 5 3.4 7.8 8 9 4.6-1.2 8-4 8-9V7l-8-4Z" /><path d="M9.5 12 11 13.5 14.5 10" /></svg>;
    case 'saisisseur':
      return <svg {...iconProps}><path d="M14 4h6v6" /><path d="M10 20H4v-6" /><path d="M20 4 9 15" /><path d="M4 20 15 9" /></svg>;
    default:
      return <svg {...iconProps}><circle cx="12" cy="12" r="8" /></svg>;
  }
};

const SidebarButton = ({ label, onClick, active, centered = false, iconType = 'default' }) => (
  <button 
    onClick={onClick}
    className={`w-full py-3 px-5 ${centered ? 'text-center' : 'text-left'} font-semibold border-b border-[var(--color-border)] transition-colors uppercase tracking-wide ${
      active ? 'bg-[#f1dec0] text-[var(--color-primary)] shadow-sm' : 'bg-[var(--color-surface)] text-[var(--color-primary)] hover:bg-[#f7e8cf]'
    }`}
  >
    <span className={`flex items-center gap-2 ${centered ? 'justify-center' : 'justify-start'}`}>
      <span className="shrink-0">
        <SidebarIcon type={iconType} />
      </span>
      <span>{label}</span>
    </span>
  </button>
);

// --- LANGUAGE SELECTOR ---
const LangSelector = ({ t, i18n }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="h-9 px-3 flex items-center gap-1 bg-[#7A0A4A] hover:bg-[#5E0738] text-white font-semibold rounded-md border border-[#B84C83] text-xs"
      >
        {t('language')} <span className="text-xs">▾</span>
      </button>
      {open && (
        <div className={`absolute ${i18n.language === 'ar' ? 'left-0' : 'right-0'} mt-1 bg-[#fffaf2] border border-[#B84C83] rounded-md shadow-lg min-w-[122px] overflow-hidden`} style={{zIndex: 9999}}>
          <button
            onClick={() => { i18n.changeLanguage('fr'); setOpen(false); }}
            className={`w-full text-left px-3 py-2 text-xs hover:bg-[#f7e8cf] flex items-center gap-2 ${i18n.language === 'fr' ? 'font-bold text-[#7A0A4A]' : 'text-[#6B3150]'}`}
          >
            {i18n.language === 'fr' && <span>✔</span>}
            Français
          </button>
          <button
            onClick={() => { i18n.changeLanguage('ar'); setOpen(false); }}
            className={`w-full text-left px-3 py-2 text-xs hover:bg-[#f7e8cf] flex items-center gap-2 ${i18n.language === 'ar' ? 'font-bold text-[#7A0A4A]' : 'text-[#6B3150]'}`}
          >
            {i18n.language === 'ar' && <span>✔</span>}
            العربية
          </button>
          <button
            onClick={() => { i18n.changeLanguage('en'); setOpen(false); }}
            className={`w-full text-left px-3 py-2 text-xs hover:bg-[#f7e8cf] flex items-center gap-2 ${i18n.language === 'en' ? 'font-bold text-[#7A0A4A]' : 'text-[#6B3150]'}`}
          >
            {i18n.language === 'en' && <span>✔</span>}
            English
          </button>
        </div>
      )}
    </div>
  );
};

function App({ forceVisitor = false }) {
  const { t, i18n } = useTranslation();
  const createMetadataState = () => ({
    definition_text: '',
    definition_text_ar: '',
    definition_text_en: '',
    unite_text: '',
    unite_text_ar: '',
    unite_text_en: '',
    indication_text: '',
    indication_text_ar: '',
    indication_text_en: '',
    source_text: '',
    source_text_ar: '',
    source_text_en: '',
    periodicite_text: '',
    periodicite_text_ar: '',
    periodicite_text_en: '',
    couverture_text: '',
    couverture_text_ar: '',
    couverture_text_en: '',
  });

  // --- RTL + language restriction ---
  useEffect(() => {
    const pathname = (typeof window !== 'undefined' && window.location.pathname)
      ? window.location.pathname.toLowerCase()
      : '/';
    const isAuthLoginRoute = pathname === '/admin/login' || pathname === '/saisisseur/login';
    const isVisitorRoute = forceVisitor || pathname === '/' || pathname === '/visiteur' || pathname.startsWith('/visiteur/');
    const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');
    const isSaisisseurRoute = pathname === '/saisisseur' || pathname.startsWith('/saisisseur/');
    const canUseRouteLanguage = !isAuthLoginRoute && (isVisitorRoute || isAdminRoute || isSaisisseurRoute);

    if (isAuthLoginRoute && i18n.language !== 'fr') {
      i18n.changeLanguage('fr');
    }

    if (!canUseRouteLanguage && i18n.language !== 'fr') {
      i18n.changeLanguage('fr');
    }

    const effectiveLang = isAuthLoginRoute ? 'fr' : (canUseRouteLanguage ? i18n.language : 'fr');
    document.documentElement.dir = effectiveLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = effectiveLang;

    try {
      if (canUseRouteLanguage) {
        localStorage.setItem('app_lang', i18n.language);
      }
    } catch {
      // Ignore localStorage failures in restricted browsing contexts.
    }
  }, [i18n, i18n.language, forceVisitor]);

  // --- AUTHENTIFICATION (toujours appelé en premier) ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState('');
  const [authContext, setAuthContext] = useState(() => {
    return getAuthStorageItem('auth_context');
  });

  // --- ÉTATS (toujours déclarés, même s'ils ne sont pas utilisés si non authentifié) ---
  const [activeMenu, setActiveMenu] = useState(() => {
    if (typeof window === 'undefined') return 'Themes';
    const stored = localStorage.getItem('activeMenu') || 'Themes';
    const p = window.location.pathname.toLowerCase();
    if ((p === '/admin' || p.startsWith('/admin/')) && stored === 'Saisisseur') return 'Admin';
    return stored;
  });
  const [formStep, setFormStep] = useState(0); 
  const [themes, setThemes] = useState([]);
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [selectedSubTheme, setSelectedSubTheme] = useState(null);
  const [selectedCategorie, setSelectedCategorie] = useState(null);
  const [themeData, setThemeData] = useState({ titre: '', titre_ar: '', titre_en: '', nbSousThemes: 1, statut: 'Public' });
  const [themeImageFile, setThemeImageFile] = useState(null);
  const [themeImagePreview, setThemeImagePreview] = useState('');
  const [openThemeMenu, setOpenThemeMenu] = useState(null);
  const [themeMenuPos, setThemeMenuPos] = useState({ left: 0, top: 0 });
  const [openActionMenu, setOpenActionMenu] = useState(null);
  const [actionMenuPos, setActionMenuPos] = useState({ left: 0, top: 0 });
  const [openSubActionMenu, setOpenSubActionMenu] = useState(null);
  const [subActionMenuPos, setSubActionMenuPos] = useState({ left: 0, top: 0 });
  const [openSubThemeMenu, setOpenSubThemeMenu] = useState(null);
  const [subThemeMenuPos, setSubThemeMenuPos] = useState({ left: 0, top: 0 });
  const [confirmModal, setConfirmModal] = useState({ open: false, message: '', onConfirm: null });
  const [toast, setToast] = useState(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionModalType, setActionModalType] = useState('rename');
  const [actionModalValue, setActionModalValue] = useState('');
  const [actionModalValueAr, setActionModalValueAr] = useState('');
  const [actionModalValueEn, setActionModalValueEn] = useState('');
  const [actionModalThemeId, setActionModalThemeId] = useState(null);
  const [actionModalCategorieId, setActionModalCategorieId] = useState(null);
  const [rows, setRows] = useState([]);
  const [assignedSubThemes, setAssignedSubThemes] = useState([]);
  const [saisisseurAssignments, setSaisisseurAssignments] = useState([]);
  const [showThemeMeta, setShowThemeMeta] = useState(false);
  const [themeMeta, setThemeMeta] = useState(createMetadataState);
  const [showSubThemeMeta, setShowSubThemeMeta] = useState(false);
  const [subThemeMeta, setSubThemeMeta] = useState(createMetadataState);
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
  const [advancedConfig, setAdvancedConfig] = useState({ niveau_geo: null, type_unite: '', est_sommable: true, filtres_disponibles: [] });
  const [advancedConfigFiltersText, setAdvancedConfigFiltersText] = useState('');
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configSubTheme, setConfigSubTheme] = useState(null);
  const [modalVisitorCols, setModalVisitorCols] = useState([]);
  const [modalVisitorFilters, setModalVisitorFilters] = useState([]);
  const [_modalVisitorColsText, setModalVisitorColsText] = useState('');
  const [_modalVisitorFiltersText, setModalVisitorFiltersText] = useState('');
  const [modalVisitorHierarchy, setModalVisitorHierarchy] = useState([]);
  const [_modalVisitorHierarchyText, setModalVisitorHierarchyText] = useState('');
  const [modalVisitorDefaultView, setModalVisitorDefaultView] = useState('horizontal');
  const [modalVisitorDefaultFilters, setModalVisitorDefaultFilters] = useState({});
  const [_publicThemes, setPublicThemes] = useState([]);
  const [showEditTable, setShowEditTable] = useState(false);
  const [editTableRows, setEditTableRows] = useState([]);
  const [editTableColumns, setEditTableColumns] = useState([]);
  const [isReplacing, setIsReplacing] = useState(false);
  const [isSmartImporting, setIsSmartImporting] = useState(false);
  const [isAppending, setIsAppending] = useState(false);
  const [isAppendingAI, setIsAppendingAI] = useState(false);
  const [importDialog, setImportDialog] = useState({ open: false, mode: null, file: null, fileAr: null, fileEn: null });
  const importMainInputRef = React.useRef(null);
  const importArInputRef = React.useRef(null);
  const importEnInputRef = React.useRef(null);
  const [showAll, setShowAll] = useState(false);
  const [activeDataTab, setActiveDataTab] = useState('tableau');
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [submitConfirmLoading, setSubmitConfirmLoading] = useState(false);
  const [visitorTableView, setVisitorTableView] = useState('horizontal');
  const [columnFilters, setColumnFilters] = useState({});
  const [dynamicFilters, setDynamicFilters] = useState({});
  const [openFilter, setOpenFilter] = useState(null);
  const [tempFilterSelection, setTempFilterSelection] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savedCharts, setSavedCharts] = useState([]);
  const [currentChartConfig, setCurrentChartConfig] = useState({ 
    id: null, 
    type: 'Histogramme', 
    x: '', 
    y: '', 
    mesure: '', 
    mesure_ar: '',
    mesure_en: '',
    filter_column: '', 
    filter_value: '', 
    filter_mode: 'include',
    filters: [],  // Nouveaux filtres multiples
    visible_filters: [], // chart-level visitor-visible filters
    title: '',
    title_ar: '',
    title_en: '',
    x_label: '',
    y_label: '',
    group_by: ''
  });
  const [chartVisitorFilters, setChartVisitorFilters] = useState({});
  const [excludedRowIndices, setExcludedRowIndices] = useState({});
  const [manageRowsModalChartId, setManageRowsModalChartId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHeaderProfileMenu, setShowHeaderProfileMenu] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ firstName: '', email: '', newPassword: '', confirmPassword: '' });
  const [settingsError, setSettingsError] = useState('');
  const [searchTheme, setSearchTheme] = useState('');
  const [searchSubTheme, setSearchSubTheme] = useState('');
  const [searchIndicateur, setSearchIndicateur] = useState('');
  const [visitorHeaderSearch, setVisitorHeaderSearch] = useState('');
  const [showVisitorHeaderSearch, setShowVisitorHeaderSearch] = useState(false);
  const [useCategories, setUseCategories] = useState(false);
  const [openCategorieMenu, setOpenCategorieMenu] = useState(null);
  const [categorieMenuPos, setCategorieMenuPos] = useState({ left: 0, top: 0 });
  const [categoryNames, setCategoryNames] = useState([{ nom: '', nom_ar: '', nom_en: '', nbSousThemes: 1 }]);
  const [_expandedCategories, setExpandedCategories] = useState({});
  const [selectedVisitorCategoryId, setSelectedVisitorCategoryId] = useState('all');
  const [infoBannerText, setInfoBannerText] = useState(() => readInfoBannerCache()[0]?.text || DEFAULT_INFO_BANNER_ITEMS[0].text);
  const [infoBannerItems, setInfoBannerItems] = useState(() => readInfoBannerCache());
  const [infoBannerDraftItems, setInfoBannerDraftItems] = useState([{ text: '', text_ar: '', text_en: '', url: '' }]);
  const [showInfoBannerEditor, setShowInfoBannerEditor] = useState(false);
  const [savingInfoBanner, setSavingInfoBanner] = useState(false);
  const [loadingInfoBanner, setLoadingInfoBanner] = useState(true);
  const [siteContent, setSiteContent] = useState({
    about_title: 'A propos de la plateforme',
    about_text: '',
    about_title_ar: 'حول المنصة',
    about_text_ar: '',
    about_title_en: 'About the platform',
    about_text_en: '',
    contact_title: 'Contact',
    contact_title_ar: 'اتصل بنا',
    contact_title_en: 'Contact',
    contact_email: '',
    contact_phone: '',
    contact_address: '',
    contact_address_ar: '',
    contact_address_en: '',
    contact_hours: '',
    contact_hours_ar: '',
    contact_hours_en: '',
    useful_links: [],
    useful_links_ar: [],
    useful_links_en: [],
  });
  const [siteContentDraft, setSiteContentDraft] = useState({
    about_title: 'A propos de la plateforme',
    about_text: '',
    about_title_ar: 'حول المنصة',
    about_text_ar: '',
    about_title_en: 'About the platform',
    about_text_en: '',
    contact_title: 'Contact',
    contact_title_ar: 'اتصل بنا',
    contact_title_en: 'Contact',
    contact_email: '',
    contact_phone: '',
    contact_address: '',
    contact_address_ar: '',
    contact_address_en: '',
    contact_hours: '',
    contact_hours_ar: '',
    contact_hours_en: '',
    useful_links: [],
    useful_links_ar: [],
    useful_links_en: [],
  });
  const [savingSiteContent, setSavingSiteContent] = useState(false);

  // --- TOUS LES useEffect EN MأٹME TEMPS ---
  const pathname = (typeof window !== 'undefined' && window.location.pathname) ? window.location.pathname.toLowerCase() : '/';
  const pathHasVisiteur = pathname === '/' || pathname === '/visiteur' || pathname.startsWith('/visiteur/');
  const pathHasSaisisseur = pathname === '/saisisseur' || pathname.startsWith('/saisisseur/');
  const pathHasAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
  const isSaisisseurRoute = pathHasSaisisseur;
  const isVisitor = forceVisitor || pathHasVisiteur;
  const isSaisisseur = isSaisisseurRoute || (userRole === 'SAISISSEUR' && isAuthenticated);
  const canEdit = isAuthenticated && !isVisitor;
  const themesApiBase = isVisitor ? `${API_BASE}/public-themes/` : `${API_BASE}/themes/`;
  const infoBannerApi = `${API_BASE}/info-banner/`;
  const siteContentApi = `${API_BASE}/site-content/`;
  const isInfoMenu = ['Contact', 'APropos', 'LiensUtiles'].includes(activeMenu);
  const canUseTranslatedDataView = isVisitor || pathHasAdmin || isSaisisseurRoute;
  const activeDataLanguage = (canUseTranslatedDataView && (i18n.language === 'ar' || i18n.language === 'en'))
    ? i18n.language
    : 'fr';
  const isArabicDataView = activeDataLanguage === 'ar';
  const isArabicVisitor = isVisitor && i18n.language === 'ar';
  const enableVisitorHeaderSearch = true;
  const localeCode = activeDataLanguage === 'ar' ? 'ar-MA' : activeDataLanguage === 'en' ? 'en-GB' : 'fr-FR';
  const hasEnglishI18nData = Boolean(
    selectedSubTheme?.data_json_i18n?.source_columns?.en &&
    Array.isArray(selectedSubTheme?.data_json_i18n?.source_columns?.en) &&
    selectedSubTheme.data_json_i18n.source_columns.en.length > 0
  );

  const normalizeDataToken = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const bilingualLabelLookup = React.useMemo(() => {
    const frToAr = {};
    const arToFr = {};
    const columnCodeByToken = {};
    const columnLabelsByCode = {};
    const valueLabelsByColumn = {};
    const globalValueLabels = {};
    let canonicalColumns = [];
    let valueColumnCode = null;
    try {
      const raw = selectedSubTheme?.data_json_i18n;
      if (!raw) return { frToAr, arToFr, columnCodeByToken, columnLabelsByCode, valueLabelsByColumn, globalValueLabels, canonicalColumns, valueColumnCode, payload: null };
      const payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!payload || typeof payload !== 'object') return { frToAr, arToFr, columnCodeByToken, columnLabelsByCode, valueLabelsByColumn, globalValueLabels, canonicalColumns, valueColumnCode, payload: null };

      canonicalColumns = Array.isArray(payload.canonical_columns) ? payload.canonical_columns : Object.keys(payload.column_labels || {});
      valueColumnCode = payload.value_column || null;

      const colLabels = payload.column_labels || {};
      Object.entries(colLabels).forEach(([code, labels]) => {
        const fr = String(labels?.fr || '').trim();
        const ar = String(labels?.ar || '').trim();
        const en = String(labels?.en || '').trim();
        columnLabelsByCode[code] = { code, fr, ar, en };
        [code, fr, ar, en].forEach((token) => {
          const normalized = normalizeDataToken(token);
          if (normalized) columnCodeByToken[normalized] = code;
        });
        if (fr && ar) {
          frToAr[fr] = ar;
          arToFr[ar] = fr;
        }
      });

      const valueLabels = payload.value_labels || {};
      Object.entries(valueLabels).forEach(([columnCode, mapping]) => {
        if (!mapping || typeof mapping !== 'object') return;
        valueLabelsByColumn[columnCode] = valueLabelsByColumn[columnCode] || {};
        Object.entries(mapping).forEach(([valueCode, labels]) => {
          const fr = String(labels?.fr || '').trim();
          const ar = String(labels?.ar || '').trim();
          const en = String(labels?.en || '').trim();
          const entry = { code: valueCode, fr, ar, en };
          [valueCode, fr, ar, en].forEach((token) => {
            const normalized = normalizeDataToken(token);
            if (!normalized) return;
            valueLabelsByColumn[columnCode][normalized] = entry;
            if (!globalValueLabels[normalized]) globalValueLabels[normalized] = entry;
          });
          if (fr && ar) {
            frToAr[fr] = ar;
            arToFr[ar] = fr;
          }
        });
      });
      return {
        frToAr,
        arToFr,
        columnCodeByToken,
        columnLabelsByCode,
        valueLabelsByColumn,
        globalValueLabels,
        canonicalColumns,
        valueColumnCode,
        payload,
      };
    } catch {
      // Ignore malformed payload and keep static dictionary fallback.
    }
    return { frToAr, arToFr, columnCodeByToken, columnLabelsByCode, valueLabelsByColumn, globalValueLabels, canonicalColumns, valueColumnCode, payload: null };
  }, [selectedSubTheme?.data_json_i18n]);

  const getCanonicalColumnCode = (columnIdentifier) => {
    const normalized = normalizeDataToken(columnIdentifier);
    if (!normalized) return null;
    return bilingualLabelLookup.columnCodeByToken[normalized] || null;
  };

  const getCanonicalValueCode = (columnIdentifier, valueIdentifier) => {
    const columnCode = getCanonicalColumnCode(columnIdentifier) || String(columnIdentifier || '').trim();
    const normalizedValue = normalizeDataToken(valueIdentifier);
    if (!normalizedValue) return valueIdentifier;
    const mapping = bilingualLabelLookup.valueLabelsByColumn[columnCode] || {};
    return mapping[normalizedValue]?.code || valueIdentifier;
  };

  const EN_COLUMN_FALLBACK_MAP = {
    annee: 'Year',
    annees: 'Years',
    year: 'Year',
    years: 'Years',
    date: 'Date',
    periode: 'Period',
    period: 'Period',
    sexe: 'Gender',
    sex: 'Gender',
    genre: 'Gender',
    gender: 'Gender',
    'etat matrimonial': 'Marital status',
    etatmatrimonial: 'Marital status',
    'marital status': 'Marital status',
    province: 'Province',
    prefecture: 'Prefecture',
    region: 'Region',
    valeur: 'Value',
    value: 'Value',
    total: 'Total',
  };

  const EN_VALUE_FALLBACK_MAP = {
    masculin: 'Male',
    male: 'Male',
    feminin: 'Female',
    féminin: 'Female',
    female: 'Female',
    hommes: 'Men',
    homme: 'Man',
    femmes: 'Women',
    femme: 'Woman',
    celibataire: 'Single',
    célibataire: 'Single',
    celibataires: 'Singles',
    célibataires: 'Singles',
    marie: 'Married',
    marié: 'Married',
    maries: 'Married',
    mariés: 'Married',
    divorce: 'Divorced',
    divorcee: 'Divorced',
    divorcé: 'Divorced',
    divorcees: 'Divorced',
    divorcés: 'Divorced',
    veuf: 'Widower',
    veuve: 'Widow',
    veufs: 'Widowers',
    veuves: 'Widows',
    total: 'Total',
    ensemble: 'Total',
    tous: 'All',
    toutes: 'All',
  };

  const EN_LABEL_TOKEN_MAP = {
    annee: 'Year',
    annees: 'Years',
    periode: 'Period',
    periodes: 'Periods',
    sexe: 'Gender',
    genre: 'Gender',
    etat: 'Status',
    matrimonial: 'Marital',
    province: 'Province',
    prefecture: 'Prefecture',
    region: 'Region',
    categorie: 'Category',
    categories: 'Categories',
    indicateur: 'Indicator',
    indicateurs: 'Indicators',
    valeur: 'Value',
    valeurs: 'Values',
    total: 'Total',
    milieu: 'Area',
    urbain: 'Urban',
    urbaine: 'Urban',
    rural: 'Rural',
    rurale: 'Rural',
  };

  const EN_VALUE_TOKEN_MAP = {
    masculin: 'Male',
    feminin: 'Female',
    celibataire: 'Single',
    celibataires: 'Singles',
    marie: 'Married',
    maries: 'Married',
    divorce: 'Divorced',
    divorcee: 'Divorced',
    divorcees: 'Divorced',
    veuf: 'Widower',
    veuve: 'Widow',
    veufs: 'Widowers',
    veuves: 'Widows',
    total: 'Total',
    ensemble: 'Total',
    tous: 'All',
    toutes: 'All',
  };

  const toTitleCase = (text) => String(text || '')
    .split(' ')
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part))
    .join(' ');

  const translateByEnglishTokens = (rawText, tokenMap) => {
    const cleaned = String(rawText || '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) return cleaned;
    const translated = cleaned
      .split(' ')
      .map((token) => {
        const mapped = tokenMap[normalizeDataToken(token)];
        return mapped || token;
      })
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    return translated;
  };

  const toEnglishValueFallback = (rawValue) => {
    const raw = String(rawValue || '').trim();
    if (!raw) return raw;
    const normalized = normalizeDataToken(raw);
    if (EN_VALUE_FALLBACK_MAP[normalized]) return EN_VALUE_FALLBACK_MAP[normalized];

    if (/(masculin|male|ذكر|مذكر|رجال)/i.test(normalized)) return 'Male';
    if (/(feminin|féminin|female|انثى|أنثى|نساء)/i.test(normalized)) return 'Female';
    if (/(celibataire|célibataire|single|أعزب|عزاب)/i.test(normalized)) return 'Single';
    if (/(marie|marié|married|متزوج)/i.test(normalized)) return 'Married';
    if (/(divorce|divorcé|divorced|مطلق)/i.test(normalized)) return 'Divorced';
    if (/(veuf|veuve|widow|widower|أرمل)/i.test(normalized)) return 'Widow(er)';

    const tokenBased = translateByEnglishTokens(raw, EN_VALUE_TOKEN_MAP);
    if (normalizeDataToken(tokenBased) !== normalized) return toTitleCase(tokenBased);

    return raw;
  };

  const toEnglishLabelFallback = (rawLabel) => {
    const raw = String(rawLabel || '').trim();
    if (!raw) return raw;
    const normalized = normalizeDataToken(raw);
    if (EN_COLUMN_FALLBACK_MAP[normalized]) return EN_COLUMN_FALLBACK_MAP[normalized];

    if (/(annee|année|annees|années|year|years|سنة|سنوات|الفترة|period)/i.test(normalized)) return 'Year';
    if (/(sexe|sex|genre|gender|الجنس|النوع)/i.test(normalized)) return 'Gender';
    if (/(etat matrimonial|état matrimonial|marital|الحالة الاجتماعية)/i.test(normalized)) return 'Marital status';
    if (/(province|prefecture|préfecture|إقليم|عمالة)/i.test(normalized)) return 'Province';
    if (/(region|région|جهة)/i.test(normalized)) return 'Region';

    const tokenBased = translateByEnglishTokens(raw, EN_LABEL_TOKEN_MAP);
    if (normalizeDataToken(tokenBased) !== normalized) return toTitleCase(tokenBased);

    return toTitleCase(
      raw
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    );
  };

  const getLocalizedColumnLabel = (columnIdentifier, langOverride = null) => {
    const fallback = (columnIdentifier === null || columnIdentifier === undefined) ? '' : String(columnIdentifier);
    const targetLang = langOverride || activeDataLanguage;
    const columnCode = getCanonicalColumnCode(columnIdentifier);
    if (!columnCode) {
      if (targetLang === 'ar') {
        if (DATA_TRANSLATIONS_FR_AR[fallback] !== undefined) return DATA_TRANSLATIONS_FR_AR[fallback];
        const normalized = normalizeDataToken(fallback);
        const looksLikeValueColumn = /(valeur|value|metric|mesure|amount|count|nombre|effectif|montant|ratio|taux|pourcentage|percent|قيمة|القيمة|نسبة)/i.test(normalized);
        if (looksLikeValueColumn) {
          const hasPercent = /%|pourcent|percent/i.test(String(fallback));
          return hasPercent ? 'القيمة (%)' : 'القيمة';
        }
      }
      if (targetLang === 'en') return toEnglishLabelFallback(fallback);
      return fallback;
    }
    const labels = bilingualLabelLookup.columnLabelsByCode[columnCode] || {};
    if (targetLang === 'en') {
      // Some imported EN payloads may still contain French labels (e.g. "Sexe", "Annee").
      // Normalize through the EN fallback mapper to guarantee English display.
      return toEnglishLabelFallback(labels.en || labels.fr || fallback);
    }
    return labels[targetLang] || labels.fr || fallback;
  };

  const getLocalizedValueLabel = (columnIdentifier, valueIdentifier, langOverride = null) => {
    if (valueIdentifier === null || valueIdentifier === undefined || valueIdentifier === '—') return valueIdentifier;
    const rawValue = String(valueIdentifier);
    const targetLang = langOverride || activeDataLanguage;
    const columnCode = getCanonicalColumnCode(columnIdentifier) || String(columnIdentifier || '').trim();
    const normalizedValue = normalizeDataToken(valueIdentifier);
    const columnMapping = bilingualLabelLookup.valueLabelsByColumn[columnCode] || {};
    const entry = columnMapping[normalizedValue] || bilingualLabelLookup.globalValueLabels[normalizedValue];
    if (entry) {
      if (targetLang === 'en') {
        // Keep EN consistent even when payload EN values are not translated.
        return toEnglishValueFallback(entry.en || entry.fr || rawValue);
      }
      return entry[targetLang] || entry.fr || rawValue;
    }
    if (targetLang === 'en') {
      return toEnglishValueFallback(rawValue);
    }
    if (targetLang === 'ar') {
      if (bilingualLabelLookup.frToAr[rawValue] !== undefined) return bilingualLabelLookup.frToAr[rawValue];
      if (DATA_TRANSLATIONS_FR_AR[rawValue] !== undefined) return DATA_TRANSLATIONS_FR_AR[rawValue];
    }
    return rawValue;
  };

  const normalizeConfiguredColumns = (items) => {
    if (!Array.isArray(items)) return [];
    return items
      .map((item) => {
        const raw = typeof item === 'string' ? item : (item && item.column) ? item.column : String(item ?? '');
        const canonical = getCanonicalColumnCode(raw);
        return canonical || raw;
      })
      .filter(Boolean);
  };

  const dedupeConfiguredColumns = (items) => {
    const normalized = normalizeConfiguredColumns(items);
    const seen = new Set();
    const unique = [];
    normalized.forEach((item) => {
      const key = normalizeDataToken(item);
      if (!key || seen.has(key)) return;
      seen.add(key);
      unique.push(item);
    });
    return unique;
  };

  const containsConfiguredColumn = (items, candidate) => {
    const candidateKey = normalizeDataToken(candidate);
    if (!candidateKey) return false;
    return dedupeConfiguredColumns(items).some((item) => normalizeDataToken(item) === candidateKey);
  };

  const appendUniqueConfiguredColumn = (items, candidate) => {
    const base = Array.isArray(items) ? items : [];
    if (!candidate || containsConfiguredColumn(base, candidate)) return base;
    return [...base, candidate];
  };

  const localizeConfiguredColumns = (items, langOverride = null) => normalizeConfiguredColumns(items)
    .map((item) => getLocalizedColumnLabel(item, langOverride))
    .filter(Boolean);

  const resolveConfiguredColumnsForRows = (configuredItems, rowColumns, langOverride = null) => {
    const sourceCols = Array.isArray(rowColumns) ? rowColumns : [];
    const sourceLookup = buildSourceColumnLookup(sourceCols);
    const resolved = [];
    const seen = new Set();

    (configuredItems || []).forEach((item) => {
      const localized = getLocalizedColumnLabel(item, langOverride);
      const candidate = resolveSourceColumn(item, sourceLookup)
        || resolveSourceColumn(localized, sourceLookup)
        || resolveSourceColumn(getCanonicalColumnCode(item) || '', sourceLookup)
        || (sourceCols.includes(localized) ? localized : '')
        || localized
        || String(item || '').trim();
      if (!candidate) return;
      const key = normalizeDataToken(candidate);
      if (!key || seen.has(key)) return;
      seen.add(key);
      resolved.push(candidate);
    });

    return resolved;
  };

  const parseVisitorDefaultsObject = (rawVal) => {
    if (rawVal === null || rawVal === undefined) return {};
    if (typeof rawVal === 'object') return rawVal || {};
    if (typeof rawVal === 'string') {
      try { return JSON.parse(rawVal); } catch { /* ignore malformed JSON */ }
      const out = {};
      rawVal.split(',').map(s => s.trim()).filter(Boolean).forEach((part) => {
        const sep = part.includes('=') ? '=' : (part.includes(':') ? ':' : null);
        if (!sep) return;
        const [k, v] = part.split(sep).map((p) => p.trim());
        if (k && v) out[k] = v;
      });
      return out;
    }
    return {};
  };

  const canonicalizeVisitorDefaults = (rawVal) => {
    const parsed = parseVisitorDefaultsObject(rawVal);
    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => {
        const canonicalKey = getCanonicalColumnCode(key) || key;
        return [canonicalKey, getCanonicalValueCode(canonicalKey, value)];
      })
    );
  };

  const localizeVisitorDefaults = (rawVal, langOverride = null) => {
    const parsed = parseVisitorDefaultsObject(rawVal);
    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => {
        const canonicalKey = getCanonicalColumnCode(key) || key;
        return [
          getLocalizedColumnLabel(canonicalKey, langOverride),
          getLocalizedValueLabel(canonicalKey, value, langOverride),
        ];
      })
    );
  };

  const localizeFilterStateMap = (filtersMap, langOverride = null) => {
    const source = filtersMap && typeof filtersMap === 'object' ? filtersMap : {};
    const out = {};
    Object.entries(source).forEach(([rawKey, rawVal]) => {
      const canonicalKey = getCanonicalColumnCode(rawKey) || rawKey;
      const localizedKey = getLocalizedColumnLabel(canonicalKey, langOverride);
      if (!localizedKey) return;

      if (Array.isArray(rawVal)) {
        out[localizedKey] = rawVal.map((entry) => {
          const canonicalValue = getCanonicalValueCode(canonicalKey, entry);
          return getLocalizedValueLabel(canonicalKey, canonicalValue, langOverride);
        });
        return;
      }

      if (rawVal === null || rawVal === undefined || rawVal === '') {
        out[localizedKey] = '';
        return;
      }

      const canonicalValue = getCanonicalValueCode(canonicalKey, rawVal);
      out[localizedKey] = getLocalizedValueLabel(canonicalKey, canonicalValue, langOverride);
    });
    return out;
  };

  const localizeChartVisitorFilterMap = (chartFiltersMap, charts, langOverride = null) => {
    const source = chartFiltersMap && typeof chartFiltersMap === 'object' ? chartFiltersMap : {};
    const out = {};
    Object.entries(source).forEach(([chartId, valuesMap]) => {
      const valueSource = valuesMap && typeof valuesMap === 'object' ? valuesMap : {};
      const currentChart = (charts || []).find((chart) => String(chart.id) === String(chartId));
      const normalized = {};

      Object.entries(valueSource).forEach(([rawKey, rawVal]) => {
        const fromVisibleFilters = currentChart?.visible_filters;
        const matchedFilter = Array.isArray(fromVisibleFilters)
          ? fromVisibleFilters.find((vf) => {
              const vfCol = typeof vf === 'string' ? vf : (vf?.column || '');
              return String(vfCol) === String(rawKey) || normalizeDataToken(vfCol) === normalizeDataToken(rawKey);
            })
          : null;
        const vfColumn = matchedFilter
          ? (typeof matchedFilter === 'string' ? matchedFilter : matchedFilter.column)
          : rawKey;

        const canonicalKey = getCanonicalColumnCode(vfColumn) || getCanonicalColumnCode(rawKey) || rawKey;
        const localizedKey = getLocalizedColumnLabel(canonicalKey, langOverride);
        if (!localizedKey) return;

        if (rawVal === null || rawVal === undefined || rawVal === '') {
          normalized[localizedKey] = '';
          return;
        }

        const canonicalValue = getCanonicalValueCode(canonicalKey, rawVal);
        normalized[localizedKey] = getLocalizedValueLabel(canonicalKey, canonicalValue, langOverride);
      });

      out[chartId] = normalized;
    });
    return out;
  };

  const isPeriodColumnIdentifier = (columnIdentifier) => {
    const canonical = getCanonicalColumnCode(columnIdentifier) || String(columnIdentifier ?? '');
    const normalized = normalizeDataToken(canonical);
    return /(annee|annees|period|periode|periodes|year|years|date|temps|time|سنة|سنوات|السنوات|الفترة|الفترات)/i.test(normalized);
  };

  const isValueColumnIdentifier = (columnIdentifier) => {
    const canonical = getCanonicalColumnCode(columnIdentifier) || String(columnIdentifier ?? '');
    if (bilingualLabelLookup.valueColumnCode && canonical === bilingualLabelLookup.valueColumnCode) return true;
    const normalized = normalizeDataToken(canonical);
    return /(valeur|value|values|metric|mesure|measure|amount|count|nombre|effectif|montant|ratio|taux|pourcentage|percent|قيمة|القيمة|نسبة|المؤشر)/i.test(normalized);
  };

  const looksLikeYearValue = (value) => {
    const raw = String(value ?? '').trim();
    if (!raw) return false;
    return /^(19|20)\d{2}$/.test(raw) || /^(19|20)\d{2}\s*[-/]\s*(19|20)\d{2}$/.test(raw);
  };

  const inferNumericValueColumn = (columns, rows) => {
    const cols = Array.isArray(columns) ? columns : [];
    const dataset = Array.isArray(rows) ? rows : [];
    let best = null;

    cols.forEach((col) => {
      if (isPeriodColumnIdentifier(col)) return;

      let nonEmpty = 0;
      let numeric = 0;
      dataset.forEach((row) => {
        const raw = row?.[col];
        if (raw === null || raw === undefined || String(raw).trim() === '') return;
        nonEmpty += 1;
        const n = Number(String(raw).replace(/,/g, '.').replace(/\s+/g, ''));
        if (!Number.isNaN(n)) numeric += 1;
      });

      if (nonEmpty === 0) return;
      const ratio = numeric / nonEmpty;
      if (!best || ratio > best.ratio || (ratio === best.ratio && numeric > best.numeric)) {
        best = { col, ratio, numeric, nonEmpty };
      }
    });

    if (!best) return null;
    if (best.numeric < 2) return null;
    if (best.ratio < 0.5) return null;
    return best.col;
  };

  const inferPeriodColumnFromValues = (columns, rows, excludedCol = null) => {
    const cols = Array.isArray(columns) ? columns : [];
    const dataset = Array.isArray(rows) ? rows : [];
    let best = null;

    cols.forEach((col) => {
      if (excludedCol && normalizeDataToken(col) === normalizeDataToken(excludedCol)) return;
      let nonEmpty = 0;
      let yearLike = 0;
      const uniqueVals = new Set();

      dataset.forEach((row) => {
        const raw = row?.[col];
        if (raw === null || raw === undefined || String(raw).trim() === '') return;
        nonEmpty += 1;
        const txt = String(raw).trim();
        uniqueVals.add(txt);
        if (looksLikeYearValue(txt)) yearLike += 1;
      });

      if (nonEmpty === 0) return;
      const ratio = yearLike / nonEmpty;
      const score = ratio * 100 + Math.min(uniqueVals.size, 25);
      if (!best || score > best.score) {
        best = { col, ratio, uniqueCount: uniqueVals.size, score };
      }
    });

    if (!best) return null;
    if (best.ratio < 0.5) return null;
    if (best.uniqueCount < 1) return null;
    return best.col;
  };

  // Translate a data value (column name or cell value) from French → Arabic.
  // Safe to call on any value: numbers and '—' are returned unchanged.
  const translateDataValue = (val) => {
    if (activeDataLanguage === 'fr') return (val === null || val === undefined) ? '' : String(val);
    if (val === null || val === undefined || val === '—') return val;
    const s = String(val);
    const normalized = normalizeDataToken(s);
    const columnCode = getCanonicalColumnCode(s);
    if (columnCode) {
      const labels = bilingualLabelLookup.columnLabelsByCode[columnCode] || {};
      if (activeDataLanguage === 'en') {
        return toEnglishLabelFallback(labels.en || labels.fr || s);
      }
      return labels[activeDataLanguage] || labels.fr || s;
    }
    const valueEntry = bilingualLabelLookup.globalValueLabels[normalized];
    if (valueEntry) {
      if (activeDataLanguage === 'en') {
        return toEnglishValueFallback(valueEntry.en || valueEntry.fr || s);
      }
      return valueEntry[activeDataLanguage] || valueEntry.fr || s;
    }
    if (activeDataLanguage === 'en') {
      return toEnglishValueFallback(s);
    }
    if (activeDataLanguage === 'ar') {
      if (bilingualLabelLookup.frToAr[s] !== undefined) return bilingualLabelLookup.frToAr[s];
      return DATA_TRANSLATIONS_FR_AR[s] !== undefined ? DATA_TRANSLATIONS_FR_AR[s] : s;
    }
    return s;
  };

  const parseAssignmentNotes = (rawNotes) => {
    try {
      return rawNotes ? JSON.parse(rawNotes) : {};
    } catch {
      return {};
    }
  };

  const getLocalizedValue = (item, frKey, arKey, enKey = null) => {
    if (!item) return '';
    if (activeDataLanguage === 'ar') {
      return item?.[arKey] || item?.[frKey] || '';
    }
    if (activeDataLanguage === 'en' && enKey) {
      return item?.[enKey] || item?.[frKey] || item?.[arKey] || '';
    }
    return item?.[frKey] || '';
  };

  const getThemeDisplayTitle = (theme) => getLocalizedValue(theme, 'titre', 'titre_ar', 'titre_en');
  const getCategoryDisplayName = (category) => getLocalizedValue(category, 'nom', 'nom_ar', 'nom_en');
  const getSubThemeDisplayName = (subTheme) => getLocalizedValue(subTheme, 'nom', 'nom_ar', 'nom_en');
  const headerSearchTerm = String(visitorHeaderSearch || '').trim().toLowerCase();
  const visitorSubThemeSearchResults = (() => {
    if (!isVisitor || !headerSearchTerm) return [];

    const byId = new Map();
    (themes || []).forEach((theme) => {
      const themeTitleFr = String(theme?.titre || '').trim();
      const themeTitleAr = String(theme?.titre_ar || '').trim();
      const themeTitleEn = String(theme?.titre_en || '').trim();

      const pushCandidate = (subTheme, category = null) => {
        if (!subTheme?.id) return;

        const subNameFr = String(subTheme?.nom || '').trim();
        const subNameAr = String(subTheme?.nom_ar || '').trim();
        const subNameEn = String(subTheme?.nom_en || '').trim();
        const catNameFr = String(category?.nom || '').trim();
        const catNameAr = String(category?.nom_ar || '').trim();
        const catNameEn = String(category?.nom_en || '').trim();
        const haystack = `${subNameFr} ${subNameAr} ${subNameEn} ${themeTitleFr} ${themeTitleAr} ${themeTitleEn} ${catNameFr} ${catNameAr} ${catNameEn}`.toLowerCase();
        if (!haystack.includes(headerSearchTerm)) return;

        const key = String(subTheme.id);
        if (byId.has(key)) return;
        byId.set(key, {
          subThemeId: subTheme.id,
          themeId: theme.id,
          categoryId: category?.id || null,
          subNameFr,
          subNameAr,
          subNameEn,
          themeTitleFr,
          themeTitleAr,
          themeTitleEn,
          catNameFr,
          catNameAr,
          catNameEn,
        });
      };

      (theme?.sous_themes || []).forEach((st) => pushCandidate(st, null));
      (theme?.categories || []).forEach((cat) => {
        (cat?.sous_themes || []).forEach((st) => pushCandidate(st, cat));
      });
    });

    return Array.from(byId.values()).slice(0, 10);
  })();
  const metadataFieldConfigs = [
    { key: 'definition_text', labelKey: 'meta_definition', multiline: true },
    { key: 'unite_text', labelKey: 'meta_unit', multiline: true },
    { key: 'periodicite_text', labelKey: 'meta_periodicity', multiline: true },
    { key: 'indication_text', labelKey: 'meta_indication', multiline: true },
    { key: 'source_text', labelKey: 'meta_source', multiline: true },
    { key: 'couverture_text', labelKey: 'meta_coverage', multiline: true },
  ];

  const getLocalizedMetadataValue = (item, key) => getLocalizedValue(item, key, `${key}_ar`, `${key}_en`);

  const buildMetadataState = (item) => metadataFieldConfigs.reduce((acc, field) => {
    acc[field.key] = item?.[field.key] || '';
    acc[`${field.key}_ar`] = item?.[`${field.key}_ar`] || '';
    acc[`${field.key}_en`] = item?.[`${field.key}_en`] || '';
    return acc;
  }, createMetadataState());

  const getExportViewLabel = (view) => {
    if (view === 'horizontal') return t('export_view_horizontal');
    if (view === 'vertical') return t('export_view_vertical');
    return t('export_view_flat');
  };

  const formatLocalizedNumber = (value, options = {}) => new Intl.NumberFormat(localeCode, options).format(value);

  const renderMetadataViewer = (metaState) => (
    <div className="space-y-4">
      {metadataFieldConfigs.map(({ key, labelKey, multiline }) => {
        const value = getLocalizedMetadataValue(metaState, key);
        return (
          <div key={key}>
            <div className="font-semibold text-[#23354a]">{t(labelKey)}</div>
            <div className={`mt-2 bg-[#fbfdff] p-3 rounded text-gray-700 ${multiline ? 'whitespace-pre-wrap' : ''}`}>{value || '—'}</div>
          </div>
        );
      })}
    </div>
  );

  const renderMetadataEditor = (metaState, setMetaState) => (
    <div className="space-y-4">
      {metadataFieldConfigs.map(({ key, labelKey }) => (
        <div key={key} className="space-y-2">
          <div className="font-semibold">{t(labelKey)}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-gray-600">{t('french_label')}</div>
              <textarea
                placeholder={`${t(labelKey)} (${t('french_label')})`}
                className="mt-1 w-full p-2 border-2 border-black rounded min-h-[100px]"
                value={metaState[key]}
                onChange={e => setMetaState({ ...metaState, [key]: e.target.value })}
              />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-gray-600">{t('arabic_label')}</div>
              <textarea
                placeholder={`${t(labelKey)} (${t('arabic_label')})`}
                className="mt-1 w-full p-2 border-2 border-black rounded min-h-[100px]"
                dir="rtl"
                value={metaState[`${key}_ar`]}
                onChange={e => setMetaState({ ...metaState, [`${key}_ar`]: e.target.value })}
              />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-gray-600">{t('english_label')}</div>
              <textarea
                placeholder={`${t(labelKey)} (${t('english_label')})`}
                className="mt-1 w-full p-2 border-2 border-black rounded min-h-[100px]"
                value={metaState[`${key}_en`]}
                onChange={e => setMetaState({ ...metaState, [`${key}_en`]: e.target.value })}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const sanitizeInfoItems = (rawItems) => {
    if (!Array.isArray(rawItems)) return [];
    return rawItems
      .map((item) => {
        const text = String(item?.text || '').trim();
        const text_ar = String(item?.text_ar || '').trim();
        let url = String(item?.url || '').trim();
        if (!text) return null;
        if (url && !/^https?:\/\//i.test(url)) {
          url = `https://${url}`;
        }
        const text_en = String(item?.text_en || '').trim();
        return { text, text_ar, text_en, url };
      })
      .filter(Boolean);
  };

  const persistInfoBannerCache = (items) => {
    try {
      const sanitized = sanitizeInfoItems(items);
      if (sanitized.length > 0) {
        localStorage.setItem(INFO_BANNER_CACHE_KEY, JSON.stringify(sanitized));
      }
    } catch {
      // Ignore local cache write failures.
    }
  };

  const getSaisisseurAssignmentForSubTheme = (subThemeId, assignments = saisisseurAssignments) => {
    return (assignments || []).find((assignment) => String(assignment.sous_theme) === String(subThemeId)) || null;
  };

  const buildDraftSubTheme = (subTheme, assignment = null) => {
    if (!subTheme) return subTheme;
    if (!isSaisisseur) return subTheme;

    const linkedAssignment = assignment || getSaisisseurAssignmentForSubTheme(subTheme.id);
    if (!linkedAssignment) return subTheme;

    const notes = parseAssignmentNotes(linkedAssignment.notes);
    const draftSubTheme = { ...subTheme };
    const draftI18nTables = (notes.tables_i18n && typeof notes.tables_i18n === 'object') ? notes.tables_i18n : {};
    const draftI18nPayload = (notes.data_json_i18n_draft && typeof notes.data_json_i18n_draft === 'object')
      ? notes.data_json_i18n_draft
      : null;
    const hasDraftI18nPayload = Boolean(
      draftI18nPayload
      && Array.isArray(draftI18nPayload.canonical_columns)
      && draftI18nPayload.canonical_columns.length > 0
      && (
        (Array.isArray(draftI18nPayload.rows) && draftI18nPayload.rows.length > 0)
        || (Array.isArray(draftI18nPayload?.rows_by_language?.fr) && draftI18nPayload.rows_by_language.fr.length > 0)
      )
    );

    const preferredDraftRows = (() => {
      if (Array.isArray(notes.tables) && notes.tables.length > 0) {
        return notes.tables;
      }
      if (activeDataLanguage === 'ar' && Array.isArray(draftI18nTables.ar) && draftI18nTables.ar.length > 0) {
        return draftI18nTables.ar;
      }
      if (activeDataLanguage === 'en' && Array.isArray(draftI18nTables.en) && draftI18nTables.en.length > 0) {
        return draftI18nTables.en;
      }
      return null;
    })();

    if (Array.isArray(preferredDraftRows)) {
      draftSubTheme.data = preferredDraftRows;
      draftSubTheme.data_json = preferredDraftRows;
      // Keep bilingual payload available in draft mode so AR/EN rendering and
      // canonical column resolution still work while editing as saisisseur.
      if (hasDraftI18nPayload) {
        draftSubTheme.data_is_bilingual = true;
        draftSubTheme.data_json_i18n = draftI18nPayload;
      }
    }

    if (hasDraftI18nPayload) {
      draftSubTheme.data_is_bilingual = true;
      draftSubTheme.data_json_i18n = draftI18nPayload;
    }

    if (Array.isArray(notes.columns_order) && notes.columns_order.length > 0) {
      draftSubTheme.columns_order = notes.columns_order;
      draftSubTheme.columns = notes.columns_order;
    } else if (Array.isArray(notes.tables) && notes.tables[0]) {
      const inferredColumns = Object.keys(notes.tables[0]);
      draftSubTheme.columns_order = inferredColumns;
      draftSubTheme.columns = inferredColumns;
    }

    if (Array.isArray(notes.charts)) {
      draftSubTheme.charts_config = notes.charts;
    }

    if (notes.meta && typeof notes.meta === 'object') {
      Object.assign(draftSubTheme, notes.meta);
    }

    if (notes.advancedConfig && typeof notes.advancedConfig === 'object') {
      Object.assign(draftSubTheme, notes.advancedConfig);
    }

    if (notes.visitor_defaults) {
      draftSubTheme.visitor_default_filters = notes.visitor_defaults;
    }

    draftSubTheme.__draftAssignmentId = linkedAssignment.id;
    draftSubTheme.__draftStatus = linkedAssignment.statut;
    return draftSubTheme;
  };

  const applyUpdatedAssignmentToState = (updatedAssignment) => {
    setSaisisseurAssignments((prev) => {
      const exists = (prev || []).some((assignment) => assignment.id === updatedAssignment.id);
      return exists
        ? prev.map((assignment) => (assignment.id === updatedAssignment.id ? updatedAssignment : assignment))
        : [...(prev || []), updatedAssignment];
    });

    setSelectedSubTheme((prev) => {
      if (!prev || String(prev.id) !== String(updatedAssignment.sous_theme)) return prev;
      return buildDraftSubTheme(prev, updatedAssignment);
    });
  };

  const collectCurrentSaisisseurDraftPayload = () => {
    const tableRows = showEditTable && editTableRows.length > 0
      ? editTableRows
      : getTableRows(selectedSubTheme);
    const tableColumns = (showEditTable && editTableColumns.length > 0)
      ? editTableColumns
      : (selectedSubTheme?.columns || selectedSubTheme?.columns_order || (tableRows[0] ? Object.keys(tableRows[0]) : []));

    return {
      tables: tableRows || [],
      columns_order: tableColumns || [],
      charts: savedCharts || [],
      data_json_i18n_draft: (selectedSubTheme?.data_json_i18n && typeof selectedSubTheme.data_json_i18n === 'object')
        ? selectedSubTheme.data_json_i18n
        : undefined,
      meta: {
        definition_text: selectedSubTheme?.definition_text || '',
        definition_text_ar: selectedSubTheme?.definition_text_ar || '',
        definition_text_en: selectedSubTheme?.definition_text_en || '',
        unite_text: selectedSubTheme?.unite_text || '',
        unite_text_ar: selectedSubTheme?.unite_text_ar || '',
        unite_text_en: selectedSubTheme?.unite_text_en || '',
        indication_text: selectedSubTheme?.indication_text || '',
        indication_text_ar: selectedSubTheme?.indication_text_ar || '',
        indication_text_en: selectedSubTheme?.indication_text_en || '',
        source_text: selectedSubTheme?.source_text || '',
        source_text_ar: selectedSubTheme?.source_text_ar || '',
        source_text_en: selectedSubTheme?.source_text_en || '',
        periodicite_text: selectedSubTheme?.periodicite_text || '',
        periodicite_text_ar: selectedSubTheme?.periodicite_text_ar || '',
        periodicite_text_en: selectedSubTheme?.periodicite_text_en || '',
        couverture_text: selectedSubTheme?.couverture_text || '',
        couverture_text_ar: selectedSubTheme?.couverture_text_ar || '',
        couverture_text_en: selectedSubTheme?.couverture_text_en || '',
      },
      visitor_defaults: selectedSubTheme?.visitor_default_filters || modalVisitorDefaultFilters || {},
      advancedConfig: {
        niveau_geo: selectedSubTheme?.niveau_geo || null,
        type_unite: selectedSubTheme?.type_unite || '',
        est_sommable: selectedSubTheme?.est_sommable ?? true,
        filtres_disponibles: selectedSubTheme?.filtres_disponibles || [],
      },
    };
  };

  // Helper: when a saisisseur saves, persist changes as a draft in UserThemeAssignment.notes
  const saveDraftAssignmentForSaisisseur = async (partialNotes = {}, statut = 'En cours') => {
    try {
      const saisisseurToken = getAuthStorageItem('auth_token_saisisseur') || getAuthStorageItem('auth_token');
      const saisisseurRequestConfig = saisisseurToken
        ? { headers: { Authorization: `Token ${saisisseurToken}` } }
        : {};
      const userId = getAuthStorageItem('user_id_saisisseur') || getAuthStorageItem('user_id');
      if (!userId) return alert('Utilisateur non identifié (saisisseur)');
      if (!selectedSubTheme) return alert('Aucun sous-thème sélectionné');

      let existing = getSaisisseurAssignmentForSubTheme(selectedSubTheme.id);
      if (!existing) {
        const resp = await axios.get(`${API_BASE}/user-theme-assignments/`, saisisseurRequestConfig);
        const myAssignments = (resp.data || []).filter((assignment) => String(assignment.user) === String(userId) && assignment.sous_theme);
        setSaisisseurAssignments(myAssignments);
        existing = myAssignments.find((assignment) => String(assignment.sous_theme) === String(selectedSubTheme.id));
      }

      if (!existing) {
        alert('Aucune assignation active trouvée pour ce sous-thème.');
        return;
      }

      // Merge notes with existing
      let mergedNotes = {};
      if (existing && existing.notes) {
        try { mergedNotes = existing.notes ? JSON.parse(existing.notes) : {}; } catch { mergedNotes = {}; }
      }
      mergedNotes = { ...mergedNotes, ...partialNotes };

      const patchResponse = await axios.patch(
        `${API_BASE}/user-theme-assignments/${existing.id}/`,
        { notes: JSON.stringify(mergedNotes), statut },
        saisisseurRequestConfig,
      );
      applyUpdatedAssignmentToState(patchResponse.data);

      // Note: do not mutate global selected subtheme or charts here. Drafts are stored
      // on the server in the assignment notes and should not affect live views
      // visible to admins/visitors until validation.

      showToast('Brouillon enregistré', 'success');
    } catch (err) {
      console.error('Erreur sauvegarde brouillon saisisseur', err);
      alert('Erreur lors de l\'enregistrement du brouillon');
    }
  };

  const submitCurrentSubThemeForReview = async () => {
    try {
      setSubmitConfirmLoading(true);
      const saisisseurToken = getAuthStorageItem('auth_token_saisisseur') || getAuthStorageItem('auth_token');
      const saisisseurRequestConfig = saisisseurToken
        ? { headers: { Authorization: `Token ${saisisseurToken}` } }
        : {};

      const notes = collectCurrentSaisisseurDraftPayload();
      await saveDraftAssignmentForSaisisseur(notes, 'En cours');

      let assignment = getSaisisseurAssignmentForSubTheme(selectedSubTheme?.id);
      if (!assignment?.id) {
        const userId = getAuthStorageItem('user_id_saisisseur') || getAuthStorageItem('user_id');
        const refreshResp = await axios.get(`${API_BASE}/user-theme-assignments/`, saisisseurRequestConfig);
        const myAssignments = (refreshResp.data || []).filter((a) => String(a.user) === String(userId) && a.sous_theme);
        setSaisisseurAssignments(myAssignments);
        assignment = myAssignments.find((a) => String(a.sous_theme) === String(selectedSubTheme?.id));
      }

      if (!assignment?.id) {
        throw new Error('Assignation introuvable pour ce sous-thème.');
      }

      const submitRes = await axios.post(
        `${API_BASE}/user-theme-assignments/${assignment.id}/submit/`,
        {
          message: 'Soumission depuis l\'éditeur du sous-thème',
          progression: 100,
        },
        saisisseurRequestConfig,
      );
      applyUpdatedAssignmentToState(submitRes.data);
      showToast('Soumis aux administrateurs', 'success');
      setSubmitConfirmOpen(false);
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.error || err?.message || 'Impossible de soumettre');
    } finally {
      setSubmitConfirmLoading(false);
    }
  };

  useEffect(() => {
    // Select token/user info based on current route first to avoid cross-tab context takeover.
    try {
      const storedContext = getAuthStorageItem('auth_context') || '';
      let token = null;
      let role = '';
      let resolvedContext = '';

      if (isVisitor) {
        resolvedContext = '';
      } else if (isSaisisseurRoute) {
        resolvedContext = 'saisisseur';
        token = getAuthStorageItem('auth_token_saisisseur');
        role = getAuthStorageItem('user_role_saisisseur') || '';
      } else if (pathHasAdmin) {
        resolvedContext = 'admin';
        token = getAuthStorageItem('auth_token_admin');
        role = getAuthStorageItem('user_role_admin') || '';
      } else if (storedContext === 'saisisseur') {
        resolvedContext = 'saisisseur';
        token = getAuthStorageItem('auth_token_saisisseur');
        role = getAuthStorageItem('user_role_saisisseur') || '';
      } else if (storedContext === 'admin') {
        resolvedContext = 'admin';
        token = getAuthStorageItem('auth_token_admin');
        role = getAuthStorageItem('user_role_admin') || '';
      } else {
        resolvedContext = 'default';
        token = getAuthStorageItem('auth_token');
        role = getAuthStorageItem('user_role') || '';
      }

      if (token && !isVisitor) {
        axios.defaults.headers.common['Authorization'] = `Token ${token}`;
        setIsAuthenticated(true);
      } else {
        delete axios.defaults.headers.common['Authorization'];
        setIsAuthenticated(false);
      }

      setAuthContext(resolvedContext);
      setUserRole(role);
    } catch (e) {
      console.error('Erreur lors de l\'initialisation du token', e);
    } finally {
      setAuthLoading(false);
    }
  }, [isVisitor, isSaisisseurRoute, pathHasAdmin]);

  useEffect(() => {
    // Always reopen step-4 on the table tab when a subtheme is opened.
    if (formStep === 4 && selectedSubTheme) {
      setActiveDataTab('tableau');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formStep, selectedSubTheme?.id]);

  useEffect(() => {
    const fetchInfoBanner = async () => {
      try {
        const res = await axios.get(infoBannerApi);
        const payloadInfos = sanitizeInfoItems(res?.data?.infos || []);
        const fallbackMessage = String(res?.data?.message || '').trim();
        const normalizedInfos = payloadInfos.length > 0
          ? payloadInfos
          : (fallbackMessage ? [{ text: fallbackMessage, text_ar: '', text_en: '', url: '' }] : []);

        if (normalizedInfos.length > 0) {
          setInfoBannerItems(normalizedInfos);
          setInfoBannerDraftItems(normalizedInfos);
          setInfoBannerText(normalizedInfos[0].text);
          persistInfoBannerCache(normalizedInfos);
        }
      } catch (err) {
        console.error('Erreur chargement info banner', err);
      } finally {
        setLoadingInfoBanner(false);
      }
    };

    fetchInfoBanner();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fetchSiteContent = async () => {
      try {
        const res = await axios.get(siteContentApi);
        const payload = {
          about_title: String(res?.data?.about_title || 'A propos de la plateforme'),
          about_text: String(res?.data?.about_text || ''),
          about_title_ar: String(res?.data?.about_title_ar || 'حول المنصة'),
          about_text_ar: String(res?.data?.about_text_ar || ''),
          about_title_en: String(res?.data?.about_title_en || 'About the platform'),
          about_text_en: String(res?.data?.about_text_en || ''),
          contact_title: String(res?.data?.contact_title || 'Contact'),
          contact_title_ar: String(res?.data?.contact_title_ar || 'اتصل بنا'),
          contact_title_en: String(res?.data?.contact_title_en || 'Contact'),
          contact_email: String(res?.data?.contact_email || ''),
          contact_phone: String(res?.data?.contact_phone || ''),
          contact_address: String(res?.data?.contact_address || ''),
          contact_address_ar: String(res?.data?.contact_address_ar || ''),
          contact_address_en: String(res?.data?.contact_address_en || ''),
          contact_hours: String(res?.data?.contact_hours || ''),
          contact_hours_ar: String(res?.data?.contact_hours_ar || ''),
          contact_hours_en: String(res?.data?.contact_hours_en || ''),
          useful_links: Array.isArray(res?.data?.useful_links) ? res.data.useful_links : [],
          useful_links_ar: Array.isArray(res?.data?.useful_links_ar) ? res.data.useful_links_ar : [],
          useful_links_en: Array.isArray(res?.data?.useful_links_en) ? res.data.useful_links_en : [],
        };
        setSiteContent(payload);
        setSiteContentDraft(payload);
      } catch (err) {
        console.error('Erreur chargement contenu site', err);
      }
    };

    fetchSiteContent();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Normalize auth routes to explicit production-style paths.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (authLoading) return;
    const currentPath = window.location.pathname.toLowerCase();

    if (!isAuthenticated) {
      if (currentPath === '/admin' || (currentPath.startsWith('/admin/') && currentPath !== '/admin/login')) {
        window.location.replace('/admin/login');
        return;
      }
      if (currentPath === '/saisisseur' || (currentPath.startsWith('/saisisseur/') && currentPath !== '/saisisseur/login')) {
        window.location.replace('/saisisseur/login');
        return;
      }
      return;
    }

    if (pathHasAdmin && currentPath === '/admin/login') {
      window.location.replace('/admin/dashboard');
      return;
    }
    if (pathHasSaisisseur && currentPath === '/saisisseur/login') {
      window.location.replace('/saisisseur/dashboard');
    }
  }, [authLoading, isAuthenticated, pathHasAdmin, pathHasSaisisseur]);

  // Keep axios Authorization header in sync with route-resolved context
  useEffect(() => {
    try {
      let ctx = authContext || getAuthStorageItem('auth_context');
      if (isSaisisseurRoute) ctx = 'saisisseur';
      else if (pathHasAdmin) ctx = 'admin';
      else if (isVisitor) ctx = '';

      let token = null;
      if (ctx === 'admin') token = getAuthStorageItem('auth_token_admin');
      else if (ctx === 'saisisseur') token = getAuthStorageItem('auth_token_saisisseur');
      else token = getAuthStorageItem('auth_token');

      if (token) axios.defaults.headers.common['Authorization'] = `Token ${token}`;
      else delete axios.defaults.headers.common['Authorization'];
    } catch (e) {
      console.error('Erreur sync auth header', e);
    }
  }, [authContext, isSaisisseurRoute, pathHasAdmin, isVisitor]);

  // When user switches menu or path, prefer the matching auth context if a token exists.
  useEffect(() => {
    try {
      // Route takes strict priority.
      if (pathHasAdmin) {
        if (getAuthStorageItem('auth_token_admin')) {
          setAuthStorageItem('auth_context', 'admin');
          setAuthContext('admin');
          return;
        }
      }

      if (isSaisisseurRoute) {
        if (getAuthStorageItem('auth_token_saisisseur')) {
          setAuthStorageItem('auth_context', 'saisisseur');
          setAuthContext('saisisseur');
          return;
        }
      }

      // Use active menu as hint only when route is ambiguous.
      if (!pathHasAdmin && !isSaisisseurRoute && activeMenu === 'Saisisseur') {
        if (getAuthStorageItem('auth_token_saisisseur')) {
          setAuthStorageItem('auth_context', 'saisisseur');
          setAuthContext('saisisseur');
          return;
        }
      }

      if (!pathHasAdmin && !isSaisisseurRoute && activeMenu === 'Admin') {
        if (getAuthStorageItem('auth_token_admin')) {
          setAuthStorageItem('auth_context', 'admin');
          setAuthContext('admin');
          return;
        }
      }
    } catch {
      // ignore
    }
  }, [activeMenu, isSaisisseurRoute, pathHasAdmin]);

  // Enforce and persist role-based active menu so saisisseur reste sur son espace après refresh
  useEffect(() => {
    // Visitor mode must never open admin/saisisseur workspace even if localStorage has old value
    if (isVisitor) {
      const visitorAllowedMenus = ['Themes', 'Indicateurs', 'APropos', 'Contact', 'LiensUtiles'];
      if (!visitorAllowedMenus.includes(activeMenu)) {
        setActiveMenu('Themes');
        try { localStorage.setItem('activeMenu', 'Themes'); } catch { /* ignore storage errors */ }
        return;
      }
      try { localStorage.setItem('activeMenu', activeMenu); } catch { /* ignore storage errors */ }
      return;
    }

    // If the user is a saisisseur, ensure they don't land on Admin
    if (isSaisisseur && activeMenu === 'Admin') {
      setActiveMenu('Saisisseur');
      try { localStorage.setItem('activeMenu', 'Saisisseur'); } catch { /* ignore storage errors */ }
      return;
    }

    // If not a saisisseur but stored menu is 'Saisisseur', fall back to Themes
    if (!isSaisisseur && activeMenu === 'Saisisseur') {
      setActiveMenu('Themes');
      try { localStorage.setItem('activeMenu', 'Themes'); } catch { /* ignore storage errors */ }
      return;
    }

    // Persist any change to activeMenu
    try { localStorage.setItem('activeMenu', activeMenu); } catch { /* ignore storage errors */ }
  }, [isVisitor, isSaisisseur, activeMenu]);

  useEffect(() => { 
    if (isAuthenticated || isVisitor) fetchThemes(); 
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // For saisisseur: fetch assignments and preload assigned sous-thèmes
  useEffect(() => {
    if (!isSaisisseur) return;
    const loadAssignments = async () => {
      try {
        const userId = getAuthStorageItem('user_id_saisisseur') || getAuthStorageItem('user_id');
        if (!userId) return;
        const resp = await axios.get(`${API_BASE}/user-theme-assignments/`);
        const my = resp.data.filter(a => String(a.user) === String(userId) && a.sous_theme);
        setSaisisseurAssignments(my);
        const subs = [];
        for (const a of my) {
          try {
            const r = await axios.get(`${API_BASE}/sousthemes/${a.sous_theme}/`);
            subs.push({ id: a.sous_theme, nom: r.data.nom, theme: r.data.theme });
          } catch (e) { console.error('Erreur fetch soustheme', e); }
        }
        setAssignedSubThemes(subs);
      } catch (err) {
        console.error('Erreur chargement assignations saisisseur', err);
      }
    };
    loadAssignments();
  }, [isSaisisseur]);

  // When saisisseur opens the indicators form, prefill rows.indicateur with assigned sous-thèmes
  useEffect(() => {
    if (!isSaisisseur) return;
    if (formStep !== 2) return; // indicators form step
    if (!assignedSubThemes || assignedSubThemes.length === 0) return;
    // if rows already contain non-empty indicateur, don't overwrite
    const hasContent = rows.some(r => r.indicateur && String(r.indicateur).trim() !== '');
    if (hasContent) return;

    const preRows = assignedSubThemes.map(s => ({ sousTheme: '', unite: '', definition: '', indicateur: s.nom || '', source: '', periodicite: '', file: null }));
    setRows(preRows);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSaisisseur, formStep, assignedSubThemes]);

  // Recharger les thèmes quand on revient sur l'onglet Themes
  useEffect(() => {
    if ((isAuthenticated || isVisitor) && activeMenu === 'Themes') {
      fetchThemes();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMenu, isAuthenticated]);

  useEffect(() => {
    const handler = () => {
      setOpenThemeMenu(null);
      setOpenActionMenu(null);
      setOpenSubActionMenu(null);
      setOpenSubThemeMenu(null);
      setOpenCategorieMenu(null);
      setOpenFilter(null);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  useEffect(() => {
    if (showAdvancedConfig) {
      console.log('showAdvancedConfig=true — rendering advanced modal');
      showToast('Ouverture de la modale avancée', 'info');
    }
  }, [showAdvancedConfig]);

  useEffect(() => {
    if (!isSaisisseur || !selectedSubTheme) return;
    const assignment = getSaisisseurAssignmentForSubTheme(selectedSubTheme.id);
    if (!assignment) return;

    const draftedSubTheme = buildDraftSubTheme(selectedSubTheme, assignment);
    const draftedRows = getTableRows(draftedSubTheme) || [];
    setSelectedSubTheme((prev) => (prev ? { ...draftedSubTheme, data: draftedRows } : prev));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSaisisseur, saisisseurAssignments, activeDataLanguage, selectedSubTheme?.id]);

  // Écoute globale pour ouvrir la config visiteur depuis le sous-thème
  useEffect(() => {
    const handler = async (ev) => {
      try {
        const subThemeId = ev?.detail;
        if (!subThemeId) return;

        // chercher localement
        let found = null;
        for (const t of themes || []) {
          const st = (t.sous_themes || []).find(s => String(s.id) === String(subThemeId));
          if (st) { found = st; break; }
        }
        if (!found) {
          const res = await axios.get(`${API_BASE}/sousthemes/${subThemeId}/`);
          found = res.data;
        }
        if (!found) return;

        if (isSaisisseur) {
          const assignmentForSt = getSaisisseurAssignmentForSubTheme(found.id);
          if (assignmentForSt) {
            const drafted = buildDraftSubTheme(found, assignmentForSt);
            const draftedRows = getTableRows(drafted) || [];
            found = { ...drafted, data: draftedRows };
          }
        }

        setConfigSubTheme(found);
        const cols = found.visitor_visible_columns || [];
        const rawFilters = found.visitor_filters || found.filtres_disponibles || [];
        const normalizeFilters = (arr) => localizeConfiguredColumns(arr, 'fr');
        const filters = normalizeFilters(rawFilters);
        const hierarchy = normalizeFilters(found.visitor_pivot_columns || []);

        // Start with the live SousTheme values
        let vcCols = localizeConfiguredColumns(cols, 'fr');
        let vcFilters = filters;
        let vcHierarchy = hierarchy;
        let vcDefaultView = (found.visitor_default_view === 'vertical') ? 'vertical' : 'horizontal';
        let vcDefaultFilters = localizeVisitorDefaults(found.visitor_default_filters || {}, 'fr');

        // If saisisseur, prefer the pending visitor_config stored in assignment notes
        if (isSaisisseur) {
          const assignmentForSt = getSaisisseurAssignmentForSubTheme(found.id);
          if (assignmentForSt) {
            try {
              const notesParsed = assignmentForSt.notes ? JSON.parse(assignmentForSt.notes) : {};
              const vc = notesParsed.visitor_config;
              if (vc && typeof vc === 'object') {
                if (Array.isArray(vc.visitor_visible_columns)) vcCols = localizeConfiguredColumns(vc.visitor_visible_columns, 'fr');
                if (Array.isArray(vc.visitor_filters)) vcFilters = localizeConfiguredColumns(vc.visitor_filters, 'fr');
                if (Array.isArray(vc.visitor_pivot_columns)) vcHierarchy = localizeConfiguredColumns(vc.visitor_pivot_columns, 'fr');
                if (vc.visitor_default_view) vcDefaultView = vc.visitor_default_view === 'vertical' ? 'vertical' : 'horizontal';
                if (vc.visitor_default_filters) vcDefaultFilters = localizeVisitorDefaults(vc.visitor_default_filters, 'fr');
              }
            } catch { /* ignore local parse errors */ }
          }
        }

        const safeCols = dedupeConfiguredColumns(vcCols);
        const safeFilters = dedupeConfiguredColumns(vcFilters);
        const safeHierarchy = dedupeConfiguredColumns(vcHierarchy);

        setModalVisitorCols(safeCols);
        setModalVisitorFilters(safeFilters);
        setModalVisitorHierarchy(safeHierarchy);
        setModalVisitorColsText(Array.isArray(safeCols) ? safeCols.join(', ') : String(safeCols || ''));
        setModalVisitorFiltersText(safeFilters.join(', '));
        setModalVisitorHierarchyText(safeHierarchy.join(', '));
        setModalVisitorDefaultView(vcDefaultView);
        setModalVisitorDefaultFilters(vcDefaultFilters);
        setConfigModalOpen(true);
      } catch (err) {
        console.error('Erreur ouverture config visiteur', err);
        showToast('Impossible d\'ouvrir la configuration visiteur', 'error');
      }
    };

    window.addEventListener('openVisitorConfig', handler);
    return () => window.removeEventListener('openVisitorConfig', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themes, isSaisisseur, saisisseurAssignments]);

  useEffect(() => {
    setSavedCharts(selectedSubTheme?.charts_config || []);
    // Initialiser les lignes exclues à partir de la config des graphes
    if (selectedSubTheme?.charts_config) {
      const exclusions = {};
      selectedSubTheme.charts_config.forEach(chart => {
        exclusions[chart.id] = chart.excluded_rows || [];
      });
      setExcludedRowIndices(exclusions);
    } else {
      setExcludedRowIndices({});
    }
  }, [selectedSubTheme]);

  useEffect(() => {
    if (!isVisitor) return;
    setColumnFilters({});
    setDynamicFilters({});
    setTempFilterSelection({});
    setOpenFilter(null);
    setShowAll(false);
    setVisitorTableView((selectedSubTheme?.visitor_default_view === 'vertical') ? 'vertical' : 'horizontal');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubTheme?.id, isVisitor]);

  // Keep visitor filter selections consistent when changing language.
  useEffect(() => {
    if (!isVisitor && !isSaisisseur) return;
    if (isVisitor) {
      setDynamicFilters((prev) => localizeFilterStateMap(prev));
    }
    setChartVisitorFilters((prev) => localizeChartVisitorFilterMap(prev, savedCharts));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDataLanguage, isVisitor, isSaisisseur, savedCharts]);

  // Populate chartVisitorFilters with defaults from each chart's visible_filters
  useEffect(() => {
    try {
      const map = {};
      (savedCharts || []).forEach(chart => {
        const vf = chart.visible_filters || [];
        if (!vf || vf.length === 0) return;
        const defaults = {};
        vf.forEach(item => {
          if (!item) return;
          const rawCol = typeof item === 'string' ? item : (item && item.column) ? item.column : '';
          const col = getLocalizedColumnLabel(rawCol);
          if (!col) return;
          if (typeof item === 'string') {
            defaults[col] = '';
          } else if (item && item.column) {
            defaults[col] = item.default ? getLocalizedValueLabel(rawCol, item.default) : '';
          }
        });
        map[chart.id] = defaults;
      });
      setChartVisitorFilters(map);
    } catch (err) {
      console.error('Error initializing chart visitor filters defaults', err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedCharts, activeDataLanguage]);

  // Apply sub-theme-level visitor default filters (e.g. Annee=2022) to each chart's visitor selections
  useEffect(() => {
    if (!isVisitor || !selectedSubTheme) return;
    try {
      const raw = selectedSubTheme.visitor_default_filters || {};
      const defaultsObj = localizeVisitorDefaults(raw);
      setChartVisitorFilters((prev) => {
        const newMap = { ...(prev || {}) };
        (savedCharts || []).forEach(chart => {
          const vf = chart.visible_filters || [];
          if (!vf || vf.length === 0) return;
          newMap[chart.id] = { ...(newMap[chart.id] || {}) };
          vf.forEach(item => {
            const rawCol = typeof item === 'string' ? item : (item && item.column) || '';
            const col = getLocalizedColumnLabel(rawCol);
            if (!col) return;
            if (defaultsObj && Object.prototype.hasOwnProperty.call(defaultsObj, col)) {
              newMap[chart.id][col] = defaultsObj[col];
            } else if (typeof item === 'object' && item && item.default) {
              const localizedDefault = getLocalizedValueLabel(rawCol, item.default);
              if (!newMap[chart.id][col]) newMap[chart.id][col] = localizedDefault;
            }
          });
        });
        return newMap;
      });
    } catch (err) {
      console.error('Error applying subtheme visitor default filters to charts', err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubTheme, isVisitor, savedCharts, activeDataLanguage]);

  // Apply sub-theme-level visitor default filters to table dynamic filters (so the table is filtered for visitors)
  useEffect(() => {
    if (!isVisitor || !selectedSubTheme) return;
    try {
      const raw = selectedSubTheme.visitor_default_filters || {};
      const defaults = localizeVisitorDefaults(raw);

      const candidateColumns = Array.from(new Set([
        ...localizeConfiguredColumns(selectedSubTheme.visitor_filters || []),
        ...localizeConfiguredColumns(selectedSubTheme.filtres_disponibles || []),
        ...localizeConfiguredColumns(selectedSubTheme.columns || []),
        ...Object.keys((getTableRows(selectedSubTheme) || [])[0] || {}),
      ].filter(Boolean)));

      const periodCol = candidateColumns.find(c => isPeriodColumnIdentifier(c));

      const findLatestPeriodValue = () => {
        if (!periodCol) return null;
        const rows = getTableRows(selectedSubTheme) || [];
        const vals = Array.from(new Set(rows.map(r => String(r?.[periodCol] ?? '')).filter(v => v !== '')));
        if (vals.length === 0) return null;
        vals.sort((a, b) => {
          const na = Number(String(a).replace(/,/g, '.'));
          const nb = Number(String(b).replace(/,/g, '.'));
          const bothNumeric = !Number.isNaN(na) && !Number.isNaN(nb);
          if (bothNumeric) return na - nb;
          return String(a).localeCompare(String(b), localeCode, { numeric: true, sensitivity: 'base' });
        });
        return vals[vals.length - 1];
      };

      setDynamicFilters(prev => {
        const previous = prev || {};
        const next = { ...previous };
        let changed = false;

        if (defaults && Object.keys(defaults).length > 0) {
          Object.entries(defaults).forEach(([k, v]) => {
            if (next[k] !== v) {
              next[k] = v;
              changed = true;
            }
          });
        }

        if (periodCol) {
          const latest = findLatestPeriodValue();
          if (latest !== null && latest !== undefined && latest !== '') {
            const latestString = String(latest);
            const current = next[periodCol];
            const currentSingle = Array.isArray(current)
              ? (current.length === 1 ? String(current[0]) : '')
              : String(current ?? '');
            if (currentSingle !== latestString) {
              // Visitor rule: year/period filter always follows the latest available period.
              next[periodCol] = latestString;
              changed = true;
            }
          }
        }

        return changed ? next : previous;
      });
    } catch (err) {
      console.error('Error applying visitor default filters to table', err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubTheme, isVisitor, activeDataLanguage, localeCode]);

  // Keep chart-level visitor filters initialized from saved charts.
  
  // --- HELPER FUNCTIONS ---
  const localizeVisitorMonolingualRows = (rows) => {
    if (!Array.isArray(rows)) return [];
    if (!isVisitor || activeDataLanguage === 'fr') return rows;

    return rows.map((row) => {
      const out = {};
      Object.entries(row || {}).forEach(([col, value]) => {
        const localizedCol = getLocalizedColumnLabel(col);
        const keepRaw = isValueColumnIdentifier(col) || isPeriodColumnIdentifier(col);
        out[localizedCol] = keepRaw ? value : getLocalizedValueLabel(col, value);
      });
      return out;
    });
  };

  const getTableRows = (sub) => {
    if (!sub) return [];
    if (canUseTranslatedDataView && sub.data_is_bilingual && bilingualLabelLookup.payload && Array.isArray(bilingualLabelLookup.payload.rows)) {
      const canonicalColumns = bilingualLabelLookup.canonicalColumns || [];
      const valueColumnCode = bilingualLabelLookup.valueColumnCode;
      return bilingualLabelLookup.payload.rows.map((row) => {
        const localizedRow = {};
        canonicalColumns.forEach((columnCode) => {
          const displayColumn = getLocalizedColumnLabel(columnCode);
          const rawValue = row?.[columnCode];
          localizedRow[displayColumn] = columnCode === valueColumnCode
            ? (rawValue ?? '')
            : getLocalizedValueLabel(columnCode, rawValue);
        });
        return localizedRow;
      });
    }
    try {
      // Lightweight debug to help trace why imported tables show only header
      if (typeof console !== 'undefined' && console.debug) {
        const info = {
          id: sub.id || null,
          keys: Object.keys(sub || {}),
          hasDataArray: Array.isArray(sub.data),
          dataJsonType: sub.data_json ? typeof sub.data_json : null
        };
        // try to detect rows length when possible
        try {
          if (Array.isArray(sub.data)) info.dataLen = sub.data.length;
          else if (sub.data_json && typeof sub.data_json === 'object' && Array.isArray(sub.data_json.rows)) info.dataJsonRows = sub.data_json.rows.length;
          else if (typeof sub.data_json === 'string') {
            const p = JSON.parse(sub.data_json);
            if (Array.isArray(p)) info.dataJsonRows = p.length;
            else if (p && Array.isArray(p.rows)) info.dataJsonRows = p.rows.length;
          }
        } catch { /* ignore parse errors */ }
        console.debug('getTableRows called:', info);
      }
    } catch (e) {
      console.warn('getTableRows debug failed', e);
    }
    // Prefer explicit `data` if it's an array
    if (Array.isArray(sub.data)) return localizeVisitorMonolingualRows(sub.data);
    // If `data_json` exists, it may be an object or a JSON string
    const dj = sub.data_json ?? sub.dataJson ?? sub.dataJsonString ?? null;
    if (Array.isArray(dj)) return localizeVisitorMonolingualRows(dj);
    if (dj && typeof dj === 'object') {
      if (Array.isArray(dj.rows)) return localizeVisitorMonolingualRows(dj.rows);
      // sometimes the stored object is { "rows": [...] } or similar
      // fallback: try to find the first array value
      const vals = Object.values(dj).find(v => Array.isArray(v));
      if (Array.isArray(vals)) return localizeVisitorMonolingualRows(vals);
    }
    if (typeof dj === 'string') {
      try {
        const parsed = JSON.parse(dj);
        if (Array.isArray(parsed)) return localizeVisitorMonolingualRows(parsed);
        if (parsed && Array.isArray(parsed.rows)) return localizeVisitorMonolingualRows(parsed.rows);
      } catch {
        // not JSON — ignore
      }
    }
    // Last resort: if sub.data is object, try to get values
    if (sub.data && typeof sub.data === 'object') {
      // If it's an object-of-arrays (columns -> arrays), convert to array of row objects
      const colEntries = Object.entries(sub.data).filter(([, v]) => Array.isArray(v));
      if (colEntries.length > 0) {
        const maxLen = Math.max(...colEntries.map(([, v]) => v.length));
        const rows = Array.from({ length: maxLen }, (_, i) => {
          const obj = {};
          colEntries.forEach(([k, v]) => { obj[k] = v[i] !== undefined ? v[i] : ''; });
          return obj;
        });
        return localizeVisitorMonolingualRows(rows);
      }
      // fallback: try to find the first array value
      const vals = Object.values(sub.data).find(v => Array.isArray(v));
      if (Array.isArray(vals)) return localizeVisitorMonolingualRows(vals);
    }

    // Handle other common import wrappers (data_json may contain sheet maps etc.)
    try {
      const djWrapped = sub.data_json && typeof sub.data_json === 'object' ? sub.data_json : null;
      if (djWrapped) {
        // If keys are sheet names mapping to { rows: [...] } or arrays
        for (const key of Object.keys(djWrapped)) {
          const val = djWrapped[key];
          if (Array.isArray(val)) return localizeVisitorMonolingualRows(val);
          if (val && Array.isArray(val.rows)) return localizeVisitorMonolingualRows(val.rows);
          // sometimes sheet -> { data: { columns... } }
          if (val && val.data && typeof val.data === 'object') {
            const entries = Object.entries(val.data).filter(([, v]) => Array.isArray(v));
            if (entries.length > 0) {
              const maxLen = Math.max(...entries.map(([, v]) => v.length));
              return localizeVisitorMonolingualRows(Array.from({ length: maxLen }, (_, i) => {
                const obj = {};
                entries.forEach(([k, v]) => { obj[k] = v[i] !== undefined ? v[i] : ''; });
                return obj;
              }));
            }
          }
        }
      }
    } catch {
      // ignore
    }
    return [];
  };

  const selectSubTheme = (sub) => {
    if (!sub) return setSelectedSubTheme(sub);
    try {
      const draftedSub = buildDraftSubTheme(sub);
      const rows = getTableRows(draftedSub) || [];
      setSelectedSubTheme({ ...draftedSub, data: rows });
    } catch {
      setSelectedSubTheme(buildDraftSubTheme(sub));
    }
  };

  const openVisitorSubThemeFromHeader = async (result) => {
    if (!result?.themeId || !result?.subThemeId) return;

    try {
      const res = await axios.get(themesApiBase);
      const freshTheme = (res.data || []).find((t) => String(t.id) === String(result.themeId));
      if (!freshTheme) return;

      const subFromRoot = (freshTheme.sous_themes || []).find((s) => String(s.id) === String(result.subThemeId));
      const categoryMatch = (freshTheme.categories || []).find((cat) => (cat.sous_themes || []).some((s) => String(s.id) === String(result.subThemeId)));
      const subFromCategory = categoryMatch ? (categoryMatch.sous_themes || []).find((s) => String(s.id) === String(result.subThemeId)) : null;
      const freshSubTheme = subFromRoot || subFromCategory;
      if (!freshSubTheme) return;

      setSelectedTheme(freshTheme);
      setSelectedCategorie(categoryMatch || null);
      setSelectedVisitorCategoryId(categoryMatch ? String(categoryMatch.id) : 'all');
      setExpandedCategories({});
      setActiveMenu('Themes');
      selectSubTheme(freshSubTheme);
      setSavedCharts(freshSubTheme.charts_config || []);
      setFormStep(4);
      setVisitorHeaderSearch('');
      setShowVisitorHeaderSearch(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
    // refresh userRole from stored auth_context
    try {
      const authContext = getAuthStorageItem('auth_context');
      if (authContext === 'admin') setUserRole(getAuthStorageItem('user_role_admin') || '');
      else if (authContext === 'saisisseur') setUserRole(getAuthStorageItem('user_role_saisisseur') || '');
      else setUserRole(getAuthStorageItem('user_role') || '');
    } catch { setUserRole(getAuthStorageItem('user_role') || ''); }
    // refresh authContext state
    try { setAuthContext(getAuthStorageItem('auth_context') || ''); } catch { setAuthContext(''); }
    // if current path is /admin and user is admin, ensure active menu is Admin
    try {
      const p = (typeof window !== 'undefined' && window.location.pathname) ? window.location.pathname.toLowerCase() : '/';
      if (p.startsWith('/admin') && (getAuthStorageItem('user_role_admin') === 'ADMIN' || getAuthStorageItem('user_role') === 'ADMIN')) {
        setActiveMenu('Admin');
        try { localStorage.setItem('activeMenu', 'Admin'); } catch { /* ignore storage errors */ }
      }
    } catch {
      // Ignore route-sync storage errors.
    }
  };

  const handleLogout = () => {
    let targetLoginPath = '/';
    try {
      const currentPath = (typeof window !== 'undefined' && window.location.pathname)
        ? window.location.pathname.toLowerCase()
        : '/';
      if (currentPath.startsWith('/admin')) targetLoginPath = '/admin/login';
      else if (currentPath.startsWith('/saisisseur')) targetLoginPath = '/saisisseur/login';
    } catch {
      // ignore path detection errors
    }

    // remove tokens for all contexts to fully logout
    AUTH_STORAGE_KEYS.forEach((key) => removeAuthStorageItem(key));
    try { localStorage.removeItem('activeMenu'); } catch { /* ignore storage errors */ }
    setAuthContext('');
    delete axios.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
    setUserRole('');

    if (typeof window !== 'undefined' && targetLoginPath !== '/') {
      window.location.replace(targetLoginPath);
    }
  };

  const resolveCurrentAuthStorage = () => {
    let ctx = '';
    if (isSaisisseurRoute || isSaisisseur || userRole === 'SAISISSEUR') ctx = 'saisisseur';
    else if (pathHasAdmin || userRole === 'ADMIN') ctx = 'admin';
    else {
      try {
        ctx = getAuthStorageItem('auth_context') || '';
      } catch {
        ctx = '';
      }
    }

    if (ctx === 'saisisseur') {
      return {
        context: 'saisisseur',
        userId: getAuthStorageItem('user_id_saisisseur') || getAuthStorageItem('user_id'),
        firstName: getAuthStorageItem('first_name_saisisseur') || getAuthStorageItem('first_name') || '',
        email: getAuthStorageItem('user_email_saisisseur') || getAuthStorageItem('user_email') || '',
        token: getAuthStorageItem('auth_token_saisisseur') || getAuthStorageItem('auth_token') || '',
        firstNameKey: hasAuthStorageItem('first_name_saisisseur') ? 'first_name_saisisseur' : 'first_name',
        emailKey: hasAuthStorageItem('user_email_saisisseur') ? 'user_email_saisisseur' : 'user_email',
      };
    }

    if (ctx === 'admin') {
      return {
        context: 'admin',
        userId: getAuthStorageItem('user_id_admin') || getAuthStorageItem('user_id'),
        firstName: getAuthStorageItem('first_name_admin') || getAuthStorageItem('first_name') || '',
        email: getAuthStorageItem('user_email_admin') || getAuthStorageItem('user_email') || '',
        token: getAuthStorageItem('auth_token_admin') || getAuthStorageItem('auth_token') || '',
        firstNameKey: hasAuthStorageItem('first_name_admin') ? 'first_name_admin' : 'first_name',
        emailKey: hasAuthStorageItem('user_email_admin') ? 'user_email_admin' : 'user_email',
      };
    }

    return {
      context: 'default',
      userId: getAuthStorageItem('user_id') || '',
      firstName: getAuthStorageItem('first_name') || '',
      email: getAuthStorageItem('user_email') || '',
      token: getAuthStorageItem('auth_token') || '',
      firstNameKey: 'first_name',
      emailKey: 'user_email',
    };
  };

  const getPasswordChecks = (password) => {
    const value = String(password || '');
    return [
      { id: 'len', label: 'Au moins 12 caracteres', valid: value.length >= 12 },
      { id: 'upper', label: 'Une lettre majuscule', valid: /[A-Z]/.test(value) },
      { id: 'lower', label: 'Une lettre minuscule', valid: /[a-z]/.test(value) },
      { id: 'digit', label: 'Un chiffre', valid: /\d/.test(value) },
      { id: 'special', label: 'Un caractere special (!@#$...)', valid: /[^A-Za-z0-9]/.test(value) },
    ];
  };

  const settingsPasswordChecks = getPasswordChecks(settingsForm.newPassword);
  const settingsHasNewPassword = Boolean(settingsForm.newPassword);
  const settingsPasswordStrong = settingsPasswordChecks.every((rule) => rule.valid);
  const settingsPasswordsMatch = !settingsHasNewPassword || settingsForm.newPassword === settingsForm.confirmPassword;
  const settingsCanSubmit = Boolean(settingsForm.email?.trim())
    && (!settingsHasNewPassword || (settingsPasswordStrong && settingsPasswordsMatch));

  const updateAccount = async () => {
    setSettingsError('');
    if (settingsForm.newPassword && settingsForm.newPassword !== settingsForm.confirmPassword) {
      setSettingsError('Les mots de passe ne correspondent pas.');
      return;
    }

    if (settingsForm.newPassword && !settingsPasswordStrong) {
      setSettingsError('Mot de passe insuffisant: respectez toutes les regles de securite ci-dessous.');
      return;
    }

    const auth = resolveCurrentAuthStorage();
    if (!auth.userId) {
      setSettingsError('Utilisateur non identifie.');
      return;
    }

    try {
      const payload = {
        first_name: String(settingsForm.firstName || '').trim(),
        email: settingsForm.email,
      };
      if (settingsForm.newPassword) payload.password = settingsForm.newPassword;

      const requestConfig = auth.token
        ? { headers: { Authorization: `Token ${auth.token}` } }
        : undefined;

      await axios.patch(`${API_BASE}/users/${auth.userId}/`, payload, requestConfig);
      setAuthStorageItem(auth.firstNameKey, payload.first_name || '');
      setAuthStorageItem(auth.emailKey, settingsForm.email);
      localStorage.setItem(auth.firstNameKey, payload.first_name || '');
      localStorage.setItem(auth.emailKey, settingsForm.email);
      if (auth.context === 'saisisseur') {
        setAuthStorageItem('first_name', payload.first_name || '');
        setAuthStorageItem('user_email', settingsForm.email);
        localStorage.setItem('first_name', payload.first_name || '');
        localStorage.setItem('user_email', settingsForm.email);
      }
      showToast('Informations mises à jour', 'success');
      setSettingsError('');
      setShowSettings(false);
      setSettingsForm({ firstName: '', email: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      console.error(err);
      const serverError = err?.response?.data?.error;
      setSettingsError(serverError || 'Erreur lors de la mise a jour du compte.');
    }
  };

  const saveInfoBanner = async () => {
    const sanitizedInfos = sanitizeInfoItems(infoBannerDraftItems);
    if (sanitizedInfos.length === 0) {
      showToast('Ajoutez au moins une information valide', 'warning');
      return;
    }

    try {
      setSavingInfoBanner(true);
      const res = await axios.put(infoBannerApi, { infos: sanitizedInfos });
      const savedInfos = sanitizeInfoItems(res?.data?.infos || sanitizedInfos);
      const nextInfos = savedInfos.length > 0 ? savedInfos : sanitizedInfos;
      setInfoBannerItems(nextInfos);
      setInfoBannerDraftItems(nextInfos);
      setInfoBannerText(nextInfos[0]?.text || '');
      persistInfoBannerCache(nextInfos);
      setShowInfoBannerEditor(false);
      showToast('Information publiee pour les visiteurs', 'success');
    } catch (err) {
      console.error('Erreur sauvegarde info banner', err);
      const serverError = err?.response?.data?.error;
      showToast(serverError || 'Erreur lors de la mise a jour de l\'info', 'error');
    } finally {
      setSavingInfoBanner(false);
    }
  };

  const sanitizeUsefulLinks = (rawLinks) => {
    if (!Array.isArray(rawLinks)) return [];
    return rawLinks
      .map((item) => {
        const label = String(item?.label || '').trim();
        let url = String(item?.url || '').trim();
        if (!label || !url) return null;
        if (!/^https?:\/\//i.test(url)) {
          url = `https://${url}`;
        }
        return { label, url };
      })
      .filter(Boolean);
  };

  const saveSiteContent = async () => {
    try {
      setSavingSiteContent(true);
      const payload = {
        ...siteContentDraft,
        useful_links: sanitizeUsefulLinks(siteContentDraft.useful_links),
        useful_links_ar: sanitizeUsefulLinks(siteContentDraft.useful_links_ar),
        useful_links_en: sanitizeUsefulLinks(siteContentDraft.useful_links_en),
      };
      const res = await axios.put(siteContentApi, payload);
      const saved = {
        about_title: String(res?.data?.about_title || payload.about_title || 'A propos de la plateforme'),
        about_text: String(res?.data?.about_text || payload.about_text || ''),
        about_title_ar: String(res?.data?.about_title_ar || payload.about_title_ar || 'حول المنصة'),
        about_text_ar: String(res?.data?.about_text_ar || payload.about_text_ar || ''),
        about_title_en: String(res?.data?.about_title_en || payload.about_title_en || 'About the platform'),
        about_text_en: String(res?.data?.about_text_en || payload.about_text_en || ''),
        contact_title: String(res?.data?.contact_title || payload.contact_title || 'Contact'),
        contact_title_ar: String(res?.data?.contact_title_ar || payload.contact_title_ar || 'اتصل بنا'),
        contact_title_en: String(res?.data?.contact_title_en || payload.contact_title_en || 'Contact'),
        contact_email: String(res?.data?.contact_email || payload.contact_email || ''),
        contact_phone: String(res?.data?.contact_phone || payload.contact_phone || ''),
        contact_address: String(res?.data?.contact_address || payload.contact_address || ''),
        contact_address_ar: String(res?.data?.contact_address_ar || payload.contact_address_ar || ''),
        contact_address_en: String(res?.data?.contact_address_en || payload.contact_address_en || ''),
        contact_hours: String(res?.data?.contact_hours || payload.contact_hours || ''),
        contact_hours_ar: String(res?.data?.contact_hours_ar || payload.contact_hours_ar || ''),
        contact_hours_en: String(res?.data?.contact_hours_en || payload.contact_hours_en || ''),
        useful_links: Array.isArray(res?.data?.useful_links) ? res.data.useful_links : payload.useful_links,
        useful_links_ar: Array.isArray(res?.data?.useful_links_ar) ? res.data.useful_links_ar : payload.useful_links_ar,
        useful_links_en: Array.isArray(res?.data?.useful_links_en) ? res.data.useful_links_en : payload.useful_links_en,
      };
      setSiteContent(saved);
      setSiteContentDraft(saved);
      showToast('Contenu mis a jour avec succes', 'success');
    } catch (err) {
      console.error('Erreur sauvegarde contenu site', err);
      const serverData = err?.response?.data;
      const serverError = serverData?.error;
      const fieldErrors = serverData && typeof serverData === 'object'
        ? Object.entries(serverData)
            .filter(([k]) => k !== 'error')
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
            .join(' | ')
        : '';
      showToast(serverError || fieldErrors || 'Erreur lors de la sauvegarde du contenu', 'error');
    } finally {
      setSavingSiteContent(false);
    }
  };

  const showConfirm = (message, onConfirm) => {
    setOpenThemeMenu(null);
    setOpenActionMenu(null);
    setOpenSubActionMenu(null);
    setOpenSubThemeMenu(null);
    setConfirmModal({ open: true, message, onConfirm });
  };
  
  const closeConfirm = () => setConfirmModal({ open: false, message: '', onConfirm: null });
  const handleConfirmOk = async () => { if (confirmModal.onConfirm) await confirmModal.onConfirm(); closeConfirm(); };
  const handleConfirmCancel = () => { closeConfirm(); };
  const showToast = (message, type = 'info') => { setToast({ message, type }); setTimeout(() => setToast(null), 3800); };
  const alert = (message) => {
    const text = String(message || '').trim();
    const lower = text.toLowerCase();
    const inferredType =
      lower.includes('erreur') || lower.includes('impossible') || lower.includes('invalide')
        ? 'error'
        : lower.includes('succ') || lower.includes('enregistr') || lower.includes('sauvegard') || lower.includes('supprim')
          ? 'success'
          : 'info';
    showToast(text || 'Notification', inferredType);
  };
  const getToastUi = (type) => {
    if (type === 'success') {
      return {
        bar: 'bg-emerald-500',
        iconWrap: 'bg-emerald-50 text-emerald-700',
        label: 'Succès',
        icon: '✓',
      };
    }
    if (type === 'error') {
      return {
        bar: 'bg-rose-500',
        iconWrap: 'bg-rose-50 text-rose-700',
        label: 'Erreur',
        icon: '!',
      };
    }
    if (type === 'warning') {
      return {
        bar: 'bg-amber-500',
        iconWrap: 'bg-amber-50 text-amber-700',
        label: 'Attention',
        icon: '!',
      };
    }
    return {
      bar: 'bg-slate-500',
      iconWrap: 'bg-slate-100 text-slate-700',
      label: 'Information',
      icon: 'i',
    };
  };

  const handleDeleteRowFromChart = (chartId, chart, rowIndex) => {
    // Créer une clé unique basée sur X et Y
    const row = getTableRows(selectedSubTheme)[rowIndex];
    if (!row) return;
    const rowKey = `${chart.x}:${row[chart.x]}|${chart.y}:${row[chart.y]}`;
    const newExcluded = [...(excludedRowIndices[chartId] || []), rowKey];
    setExcludedRowIndices(prev => ({
      ...prev,
      [chartId]: newExcluded
    }));
    // Sauvegarder immédiatement dans la base de données
    saveChartExclusions(chartId, newExcluded);
  };

  const handleRestoreRowToChart = (chartId, chart, rowIndex) => {
    const row = getTableRows(selectedSubTheme)[rowIndex];
    if (!row) return;
    const rowKey = `${chart.x}:${row[chart.x]}|${chart.y}:${row[chart.y]}`;
    const newExcluded = (excludedRowIndices[chartId] || []).filter(key => key !== rowKey);
    setExcludedRowIndices(prev => ({
      ...prev,
      [chartId]: newExcluded
    }));
    // Sauvegarder immédiatement dans la base de données
    saveChartExclusions(chartId, newExcluded);
  };

  const isRowExcluded = (chartId, chart, row) => {
    const rowKey = `${chart.x}:${row[chart.x]}|${chart.y}:${row[chart.y]}`;
    return excludedRowIndices[chartId]?.includes(rowKey);
  };

  const saveChartExclusions = async (chartId, excludedRowsList) => {
    try {
      if (isSaisisseur) {
        const nextCharts = (savedCharts || []).map((chart) => (
          chart.id === chartId ? { ...chart, excluded_rows: excludedRowsList } : chart
        ));
        setSavedCharts(nextCharts);
        await saveDraftAssignmentForSaisisseur({ charts: nextCharts }, 'En cours');
        return;
      }

      await axios.put(
        `${API_BASE}/sousthemes/${selectedSubTheme.id}/charts/${chartId}/`,
        {
          excluded_rows: excludedRowsList
        },
        {
          headers: { 'X-HTTP-Method-Override': 'PATCH' }
        }
      );
    } catch (err) {
      console.error('Erreur lors de la sauvegarde des exclusions', err);
    }
  };

  const _handleResetChartExclusions = (chartId) => {
    setExcludedRowIndices(prev => ({
      ...prev,
      [chartId]: []
    }));
  };

  const openEditTable = () => {
    const rowsCopy = JSON.parse(JSON.stringify(getTableRows(selectedSubTheme) || []));
    const baseCols = (selectedSubTheme?.columns || []).length > 0
      ? [...(selectedSubTheme.columns || [])]
      : (rowsCopy[0] ? Object.keys(rowsCopy[0]) : []);

    const sourceCols = Array.from(new Set((rowsCopy || []).flatMap((row) => Object.keys(row || {}))));
    const normalizedRows = mapRowsToTargetColumns(rowsCopy, sourceCols, baseCols);

    setEditTableColumns(baseCols);
    setEditTableRows(normalizedRows);
    setShowEditTable(true);
  };

  const handleEditColumnNameChange = (index, rawValue) => {
    const nextName = String(rawValue ?? '');
    const prevName = editTableColumns[index];
    if (prevName === nextName) return;

    const nextCols = [...editTableColumns];
    nextCols[index] = nextName;
    setEditTableColumns(nextCols);

    setEditTableRows((prevRows) =>
      (prevRows || []).map((row) => {
        const nextRow = { ...row };
        if (Object.prototype.hasOwnProperty.call(nextRow, prevName)) {
          nextRow[nextName] = nextRow[prevName];
          delete nextRow[prevName];
        }
        return nextRow;
      })
    );
  };

  const archiveTheme = async (id) => {
    try {
      await axios.post(`${API_BASE}/themes/${id}/archive/`);
      showToast('Thème archivé', 'success');
      const res = await axios.get(themesApiBase);
      setThemes(res.data);
      if (selectedTheme && selectedTheme.id === id) setSelectedTheme(res.data.find(t => t.id === id));
    } catch (err) { console.error(err); showToast('Erreur lors de l\'archivage', 'error'); }
  };

  const unarchiveTheme = async (id) => {
    try {
      await axios.post(`${API_BASE}/themes/${id}/unarchive/`);
      showToast('Thème désarchivé', 'success');
      const res = await axios.get(themesApiBase);
      setThemes(res.data);
      if (selectedTheme && selectedTheme.id === id) setSelectedTheme(res.data.find(t => t.id === id));
    } catch (err) { console.error(err); showToast('Erreur lors du désarchivage', 'error'); }
  };

  const deleteTheme = async (id) => {
    // Optimistic UI: remove theme immediately
    const prev = themes;
    setThemes(prev.filter(t => t.id !== id));
    setOpenThemeMenu(null);
    if (selectedTheme && selectedTheme.id === id) { setSelectedTheme(null); setFormStep(0); }
    try {
      await axios.delete(`${API_BASE}/themes/${id}/`);
      showToast('Thème supprimé', 'success');
      // refresh to ensure consistent state
      const res = await axios.get(themesApiBase);
      setThemes(res.data);
    } catch (err) {
      console.error(err);
      showToast('Erreur lors de la suppression, restauration de la liste', 'error');
      // rollback to previous state
      setThemes(prev);
      // try refetch as fallback
      try { const res = await axios.get(themesApiBase); setThemes(res.data); } catch(e){ console.error('Refetch failed', e); }
    }
  };

  const normalizeEntityName = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

  const hasDuplicateThemeName = (name, excludeThemeId = null) => {
    const normalized = normalizeEntityName(name);
    if (!normalized) return false;
    return (themes || []).some(t => normalizeEntityName(t.titre) === normalized && Number(t.id) !== Number(excludeThemeId));
  };

  const hasDuplicateSubThemeNameInTheme = (themeId, name, excludeSubThemeId = null) => {
    const normalized = normalizeEntityName(name);
    if (!normalized) return false;
    const parentTheme = (themes || []).find(t => Number(t.id) === Number(themeId));
    const subThemesInTheme = parentTheme?.sous_themes || [];
    return subThemesInTheme.some(st => normalizeEntityName(st.nom) === normalized && Number(st.id) !== Number(excludeSubThemeId));
  };

  const hasDuplicateCategoryNameInTheme = (themeId, name, excludeCategoryId = null) => {
    const normalized = normalizeEntityName(name);
    if (!normalized) return false;
    const parentTheme = (themes || []).find(t => Number(t.id) === Number(themeId));
    const categoriesInTheme = parentTheme?.categories || [];
    return categoriesInTheme.some(cat => normalizeEntityName(cat.nom) === normalized && Number(cat.id) !== Number(excludeCategoryId));
  };

  const renameTheme = async (id, newName, newNameAr = '', newNameEn = '') => {
    const cleanedName = String(newName || '').trim().replace(/\s+/g, ' ');
    if (!cleanedName) {
      alert('Le nom du thème est requis');
      return;
    }
    if (hasDuplicateThemeName(cleanedName, id)) {
      alert('Ce thème existe déjà. Choisissez un autre nom.');
      return;
    }
    try {
      await axios.patch(`${API_BASE}/themes/${id}/`, {
        titre: cleanedName,
        titre_ar: String(newNameAr || '').trim(),
        titre_en: String(newNameEn || '').trim(),
      });
      alert('Thème renommé');
      const res = await axios.get(themesApiBase);
      setThemes(res.data);
      if (selectedTheme && selectedTheme.id === id) setSelectedTheme(res.data.find(t => t.id === id));
    } catch (err) { console.error(err); alert(err.response?.data?.titre?.[0] || err.response?.data?.error || 'Erreur lors du renommage'); }
  };

  const addSubTheme = async (themeId, name, categorieId = null, nameAr = '', nameEn = '') => {
    const cleanedName = String(name || '').trim().replace(/\s+/g, ' ');
    if (!cleanedName) {
      alert('Le nom du sous-thème est requis');
      return;
    }
    if (hasDuplicateSubThemeNameInTheme(themeId, cleanedName)) {
      alert('Ce sous-thème existe déjà dans ce thème.');
      return;
    }
    try {
      const theme = themes.find(t => t.id === themeId);
      const payload = {
        nom: cleanedName,
        nom_ar: String(nameAr || '').trim(),
        nom_en: String(nameEn || '').trim(),
      };
      if (categorieId) {
        payload.categorie = categorieId;
        // Si on ajoute à une catégorie, hériter la visibilité de la catégorie
        const categorie = theme?.categories?.find(c => c.id === categorieId);
        if (categorie) {
          payload.is_visible = categorie.is_visible;
        }
      } else {
        // Si pas de catégorie, hériter la visibilité du thème
        payload.is_visible = theme?.is_visible ?? true;
      }
      await axios.post(`${API_BASE}/themes/${themeId}/sous_themes/`, payload);
      alert('Sous-thème ajouté');
      const themesRes = await axios.get(themesApiBase);
      setThemes(themesRes.data);
      const fresh = themesRes.data.find(t => t.id === themeId);
      if (fresh) setSelectedTheme(fresh);
    } catch (err) { console.error(err); alert(err.response?.data?.nom?.[0] || err.response?.data?.error || 'Erreur lors de l\'ajout du sous-thème'); }
  };

  const addCategorie = async (themeId, name, nameAr = '', nameEn = '') => {
    const cleanedName = String(name || '').trim().replace(/\s+/g, ' ');
    if (!cleanedName) {
      alert('Le nom de la catégorie est requis');
      return;
    }
    if (hasDuplicateCategoryNameInTheme(themeId, cleanedName)) {
      alert('Cette catégorie existe déjà dans ce thème.');
      return;
    }
    try {
      const theme = themes.find(t => t.id === themeId);
      const ordre = theme?.categories?.length || 0;
      // Ensure the new category inherits the theme's visibility status
      const payload = {
        nom: cleanedName,
        nom_ar: String(nameAr || '').trim(),
        nom_en: String(nameEn || '').trim(),
        theme: themeId,
        ordre,
        is_visible: theme?.is_visible ?? true,
      };
      await axios.post(`${API_BASE}/categories/`, payload);
      alert('Catégorie ajoutée');
      const themesRes = await axios.get(themesApiBase);
      setThemes(themesRes.data);
      const fresh = themesRes.data.find(t => t.id === themeId);
      if (fresh) setSelectedTheme(fresh);
    } catch (err) { console.error(err); alert(err.response?.data?.nom?.[0] || err.response?.data?.error || 'Erreur lors de l\'ajout de la catégorie'); }
  };

  const renameCategorie = async (categorieId, newName, newNameAr = '', newNameEn = '') => {
    const cleanedName = String(newName || '').trim().replace(/\s+/g, ' ');
    if (!cleanedName) {
      alert('Le nom de la catégorie est requis');
      return;
    }

    const parentTheme = (themes || []).find((t) => (t.categories || []).some((c) => Number(c.id) === Number(categorieId)));
    const parentThemeId = parentTheme?.id;

    if (parentThemeId && hasDuplicateCategoryNameInTheme(parentThemeId, cleanedName, categorieId)) {
      alert('Cette catégorie existe déjà dans ce thème.');
      return;
    }

    try {
      await axios.patch(`${API_BASE}/categories/${categorieId}/`, {
        nom: cleanedName,
        nom_ar: String(newNameAr || '').trim(),
        nom_en: String(newNameEn || '').trim(),
      });
      alert('Catégorie renommée');

      const themesRes = await axios.get(themesApiBase);
      setThemes(themesRes.data);
      if (selectedTheme) {
        const fresh = themesRes.data.find((t) => t.id === selectedTheme.id);
        if (fresh) setSelectedTheme(fresh);
        if (selectedCategorie && fresh) {
          const freshCat = fresh.categories?.find((c) => c.id === selectedCategorie.id);
          if (freshCat) setSelectedCategorie(freshCat);
        }
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.nom?.[0] || err.response?.data?.error || 'Erreur lors du renommage de la catégorie');
    }
  };

  const renameSubTheme = async (id, newName, newNameAr = '', newNameEn = '') => {
    const cleanedName = String(newName || '').trim().replace(/\s+/g, ' ');
    if (!cleanedName) {
      alert('Le nom du sous-thème est requis');
      return;
    }
    const targetSubTheme =
      (selectedTheme?.sous_themes || []).find(st => Number(st.id) === Number(id)) ||
      (themes || []).flatMap(t => t.sous_themes || []).find(st => Number(st.id) === Number(id));
    const targetThemeId = targetSubTheme?.theme || selectedTheme?.id;
    if (targetThemeId && hasDuplicateSubThemeNameInTheme(targetThemeId, cleanedName, id)) {
      alert('Ce sous-thème existe déjà dans ce thème.');
      return;
    }
    try {
      await axios.patch(`${API_BASE}/sousthemes/${id}/`, {
        nom: cleanedName,
        nom_ar: String(newNameAr || '').trim(),
        nom_en: String(newNameEn || '').trim(),
      });
      alert('Sous-thème renommé');
      const res = await axios.get(themesApiBase);
      setThemes(res.data);
      // update selectedTheme/selectedSubTheme if needed
      if (selectedTheme) {
        const freshTheme = res.data.find(t => t.id === selectedTheme.id);
        if (freshTheme) setSelectedTheme(freshTheme);
        const freshSub = freshTheme?.sous_themes?.find(st => st.id === id);
        if (freshSub) selectSubTheme(freshSub);
        // Update selectedCategorie if present
        if (selectedCategorie && freshTheme) {
          const freshCat = freshTheme.categories?.find(c => c.id === selectedCategorie.id);
          if (freshCat) setSelectedCategorie(freshCat);
        }
      }
    } catch (err) { console.error(err); alert(err.response?.data?.nom?.[0] || err.response?.data?.error || 'Erreur lors du renommage du sous-thème'); }
  };

  const archiveSubTheme = async (id) => {
    try {
      await axios.patch(`${API_BASE}/sousthemes/${id}/`, { archived: true });
      showToast('Sous-thème archivé', 'success');
      const res = await axios.get(themesApiBase);
      setThemes(res.data);
      // Mets à jour selectedTheme avec les sous-thèmes frais
      if (selectedTheme) {
        const freshTheme = res.data.find(t => t.id === selectedTheme.id);
        if (freshTheme) setSelectedTheme(freshTheme);
        // Update selectedCategorie if present
        if (selectedCategorie && freshTheme) {
          const freshCat = freshTheme.categories?.find(c => c.id === selectedCategorie.id);
          if (freshCat) setSelectedCategorie(freshCat);
        }
      }
    } catch (err) { console.error(err); showToast('Erreur lors de l\'archivage du sous-thème', 'error'); }
  };

  const unarchiveSubTheme = async (id) => {
    try {
      await axios.patch(`${API_BASE}/sousthemes/${id}/`, { archived: false });
      showToast('Sous-thème désarchivé', 'success');
      const res = await axios.get(themesApiBase);
      setThemes(res.data);
      // Mets à jour selectedTheme avec les sous-thèmes frais
      if (selectedTheme) {
        const freshTheme = res.data.find(t => t.id === selectedTheme.id);
        if (freshTheme) setSelectedTheme(freshTheme);
        // Update selectedCategorie if present
        if (selectedCategorie && freshTheme) {
          const freshCat = freshTheme.categories?.find(c => c.id === selectedCategorie.id);
          if (freshCat) setSelectedCategorie(freshCat);
        }
      }
    } catch (err) { console.error(err); showToast('Erreur lors du désarchivage du sous-thème', 'error'); }
  };

  const deleteSubTheme = async (id) => {
    // Optimistic UI: remove subtheme immediately from local state
    const prevThemes = themes;
    const prevSelectedTheme = selectedTheme;
    const sid = Number(id);

    // Build the optimistic new themes list (ensure numeric compare)
    const newThemes = prevThemes.map(t => ({ ...t, sous_themes: (t.sous_themes || []).filter(st => Number(st.id) !== sid) }));
    setThemes(newThemes);

    // If the currently selected theme is shown, update it too so the card disappears immediately
    if (selectedTheme) {
      setSelectedTheme(prev => prev ? { ...prev, sous_themes: (prev.sous_themes || []).filter(st => Number(st.id) !== sid) } : prev);
    }

    setOpenSubThemeMenu(null);
    if (selectedSubTheme && selectedSubTheme.id === id) { setSelectedSubTheme(null); setFormStep(3); }
    try {
      await axios.delete(`${API_BASE}/sousthemes/${id}/`);
      showToast('Sous-thème supprimé', 'success');
      // refresh to ensure consistent state
      const res = await axios.get(themesApiBase);
      setThemes(res.data);
      // update selectedTheme to the fresh object if still present
      if (prevSelectedTheme) {
        const fresh = res.data.find(t => t.id === prevSelectedTheme.id);
        if (fresh) setSelectedTheme(fresh);
        else setSelectedTheme(null);
        // Update selectedCategorie if present
        if (selectedCategorie && fresh) {
          const freshCat = fresh.categories?.find(c => c.id === selectedCategorie.id);
          if (freshCat) setSelectedCategorie(freshCat);
          else setSelectedCategorie(null);
        }
      }
    } catch (err) {
      console.error(err.response?.data ?? err);
      const msg = err.response?.data?.error || err.message || 'Erreur lors de la suppression';
      showToast(`Erreur: ${msg}`, 'error');
      // rollback both themes list and selected theme
      setThemes(prevThemes);
      setSelectedTheme(prevSelectedTheme);
      try { const res = await axios.get(themesApiBase); setThemes(res.data); } catch(e){ console.error('Refetch failed', e); }
    }
  };

  const deleteCategorie = async (categorieId) => {
    try {
      showConfirm('Êtes-vous sûr de vouloir supprimer cette catégorie ? Tous les sous-thèmes seront supprimés.', async () => {
        await axios.delete(`${API_BASE}/categories/${categorieId}/`);
        showToast('Catégorie supprimée', 'success');
        
        // Refresh to ensure consistent state
        const res = await axios.get(themesApiBase);
        setThemes(res.data);
        if (selectedTheme) {
          const fresh = res.data.find(t => t.id === selectedTheme.id);
          if (fresh) setSelectedTheme(fresh);
        }
        if (selectedCategorie && selectedCategorie.id === categorieId) {
          setSelectedCategorie(null);
          setFormStep(3);
        }
        setOpenCategorieMenu(null);
      });
      return;
    } catch (err) {
      console.error(err);
      showToast('Erreur lors de la suppression de la catégorie', 'error');
    }
  };

  const toggleThemePublication = async (themeId, newVisibility) => {
    try {
      // Change theme visibility
      await axios.patch(`${API_BASE}/themes/${themeId}/`, { is_visible: newVisibility });
      
      // Cascade: update all categories and their sous-themes
      const theme = themes.find(t => t.id === themeId);
      if (theme) {
        // If theme has categories, cascade to them and their sous-thèmes
        if (theme.categories && theme.categories.length > 0) {
          for (const category of theme.categories) {
            // Use toggle-visibility action to cascade to sous-thèmes
            await axios.post(`${API_BASE}/categories/${category.id}/toggle-visibility/`, { is_visible: newVisibility });
          }
        } else {
          // If no categories, update sous-themes directly
          if (theme.sous_themes) {
            for (const subTheme of theme.sous_themes) {
              await axios.patch(`${API_BASE}/sousthemes/${subTheme.id}/`, { is_visible: newVisibility });
            }
          }
        }
      }
      
      // Refresh themes and update selectedTheme
      const themesRes = await axios.get(themesApiBase);
      setThemes(themesRes.data);
      if (selectedTheme && selectedTheme.id === themeId) {
        const freshTheme = themesRes.data.find(t => t.id === themeId);
        if (freshTheme) setSelectedTheme(freshTheme);
      }
      showToast(`Visibilité du thème mise à jour: ${newVisibility ? 'Public' : 'Privé'}`, 'success');
    } catch (err) { 
      console.error(err); 
      showToast('Erreur lors du changement de statut du thème', 'error');
    }
  };

  const saveEditedTable = async () => {
    try {
      const rawColumns = (editTableColumns || []).map((c) => String(c ?? ''));
      const columnPairs = rawColumns
        .map((raw) => ({ raw, trimmed: raw.trim() }))
        .filter((item) => item.trimmed !== '');
      const finalColumns = columnPairs.map((item) => item.trimmed);

      if (finalColumns.length === 0) {
        alert('Veuillez définir au moins une colonne');
        return;
      }

      if (new Set(finalColumns).size !== finalColumns.length) {
        alert('Les noms des colonnes doivent être uniques');
        return;
      }

      const normalizedRows = (editTableRows || []).map((row) =>
        Object.fromEntries(
          columnPairs.map(({ raw, trimmed }) => [
            trimmed,
            row?.[raw] ?? row?.[trimmed] ?? '',
          ])
        )
      );

      if (isSaisisseur) {
        // Save table rows in assignment notes as draft
        await saveDraftAssignmentForSaisisseur({ tables: normalizedRows, columns_order: finalColumns }, 'En cours');
        alert('Brouillon de la table enregistré');
        setShowEditTable(false);
        return;
      }

      const res = await axios.patch(`${API_BASE}/sousthemes/${selectedSubTheme.id}/`, {
        data_json: normalizedRows,
        columns_order: finalColumns,
      });
      const updated = res.data;
      selectSubTheme(updated);
      alert('Table enregistrée');

      setShowEditTable(false);
      // refresh themes and selection
      const themesRes = await axios.get(themesApiBase);
      setThemes(themesRes.data);
      const freshTheme = themesRes.data.find(t => t.id === selectedTheme?.id);
      if (freshTheme) setSelectedTheme(freshTheme);
      const freshSub = freshTheme?.sous_themes?.find(st => st.id === selectedSubTheme.id);
      if (freshSub) selectSubTheme(freshSub);
    } catch (err) {
      console.error('Erreur en sauvegarde du tableau', err);
      alert('Erreur lors de la sauvegarde du tableau');
      setShowEditTable(false);
    }
  };

  const normalizeCol = (v) => normalizeDataToken(v);

  const buildSourceColumnLookup = (sourceColumns = []) => {
    const lookup = new Map();
    (sourceColumns || []).forEach((sourceCol) => {
      const raw = String(sourceCol || '').trim();
      if (!raw) return;
      const normalized = normalizeCol(raw);
      if (normalized && !lookup.has(`norm:${normalized}`)) {
        lookup.set(`norm:${normalized}`, raw);
      }

      const canonical = getCanonicalColumnCode(raw);
      if (canonical && !lookup.has(`code:${canonical}`)) {
        lookup.set(`code:${canonical}`, raw);
      }

      const englishFallback = normalizeCol(toEnglishLabelFallback(raw));
      if (englishFallback && !lookup.has(`norm:${englishFallback}`)) {
        lookup.set(`norm:${englishFallback}`, raw);
      }
    });
    return lookup;
  };

  const resolveSourceColumn = (targetCol, sourceLookup) => {
    const targetRaw = String(targetCol || '').trim();
    if (!targetRaw) return null;

    const directNorm = normalizeCol(targetRaw);
    if (directNorm && sourceLookup.has(`norm:${directNorm}`)) {
      return sourceLookup.get(`norm:${directNorm}`);
    }

    const canonical = getCanonicalColumnCode(targetRaw);
    if (canonical) {
      if (sourceLookup.has(`code:${canonical}`)) {
        return sourceLookup.get(`code:${canonical}`);
      }

      const labels = bilingualLabelLookup.columnLabelsByCode?.[canonical] || {};
      const candidateLabels = [labels.fr, labels.ar, labels.en].filter(Boolean);
      for (const label of candidateLabels) {
        const labelNorm = normalizeCol(label);
        if (labelNorm && sourceLookup.has(`norm:${labelNorm}`)) {
          return sourceLookup.get(`norm:${labelNorm}`);
        }
      }
    }

    const englishFallback = normalizeCol(toEnglishLabelFallback(targetRaw));
    if (englishFallback && sourceLookup.has(`norm:${englishFallback}`)) {
      return sourceLookup.get(`norm:${englishFallback}`);
    }

    return null;
  };

  const mapRowsToTargetColumns = (rows, sourceColumns, targetColumns) => {
    const sourceLookup = buildSourceColumnLookup(sourceColumns || []);
    return (rows || []).map((row) => {
      const output = {};
      (targetColumns || []).forEach((targetCol) => {
        const sourceCol = resolveSourceColumn(targetCol, sourceLookup);
        output[targetCol] = sourceCol ? (row?.[sourceCol] ?? '') : '';
      });
      return output;
    });
  };

  const readExcelRows = async (excelFile) => {
    const XLSX = await import('xlsx-js-style');
    const buffer = await excelFile.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const sheetName = wb.SheetNames?.[0];
    if (!sheetName) return { columns: [], rows: [] };
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
    const columns = rows.length > 0
      ? Object.keys(rows[0]).map((c) => String(c || '').trim()).filter(Boolean)
      : [];
    const normalizedRows = (rows || []).map((row) =>
      Object.fromEntries(columns.map((col) => [col, row?.[col] ?? '']))
    );
    return { columns, rows: normalizedRows };
  };

  const formatWarningsForAlert = (warnings) => {
    if (!warnings) return '';
    if (Array.isArray(warnings)) return warnings.filter(Boolean).join(' | ');
    if (typeof warnings === 'object') {
      const fr = Array.isArray(warnings.fr) ? warnings.fr.join(' | ') : '';
      const ar = Array.isArray(warnings.ar) ? warnings.ar.join(' | ') : '';
      return [fr ? `FR: ${fr}` : '', ar ? `AR: ${ar}` : ''].filter(Boolean).join(' || ');
    }
    return String(warnings);
  };

  const refreshEditedSubTheme = async () => {
    const themesRes = await axios.get(themesApiBase);
    setThemes(themesRes.data);
    const freshTheme = themesRes.data.find(t => t.id === selectedTheme?.id);
    if (freshTheme) setSelectedTheme(freshTheme);
    const freshSub = freshTheme?.sous_themes?.find(st => st.id === selectedSubTheme.id)
      || (freshTheme?.categories || []).flatMap(cat => cat.sous_themes || []).find(st => st.id === selectedSubTheme.id);
    if (freshSub) {
      selectSubTheme(freshSub);
      if (showEditTable) {
        const refreshedRows = JSON.parse(JSON.stringify(getTableRows(freshSub) || []));
        const refreshedCols = (freshSub.columns || []).length > 0
          ? [...(freshSub.columns || [])]
          : (refreshedRows[0] ? Object.keys(refreshedRows[0]) : []);
        setEditTableColumns(refreshedCols);
        setEditTableRows(
          refreshedRows.map((row) => Object.fromEntries(refreshedCols.map((col) => [col, row?.[col] ?? ''])))
        );
      }
    }
  };

  const executeClassicImport = async (file, fileAr = null, fileEn = null) => {
    if (!file) return;
    if (isSaisisseur) {
      const fd = new FormData();
      fd.append('file', file);
      if (fileAr) fd.append('file_ar', fileAr);
      if (fileEn) fd.append('file_en', fileEn);
      fd.append('free_schema', 'true');

      const result = await axios.post(`${API_BASE}/sousthemes/${selectedSubTheme.id}/import-preview/`, fd);
      const rows = Array.isArray(result?.data?.data) ? result.data.data : [];
      const targetColumns = Array.isArray(result?.data?.columns_order) && result.data.columns_order.length > 0
        ? result.data.columns_order
        : (rows[0] ? Object.keys(rows[0]) : []);
      if (!targetColumns.length) throw new Error('Impossible de déterminer les colonnes cibles après import classique.');

      const draftI18nTables = (result?.data?.tables_i18n && typeof result.data.tables_i18n === 'object')
        ? result.data.tables_i18n
        : { fr: rows };
      const draftI18nPayload = (result?.data?.data_json_i18n_preview && typeof result.data.data_json_i18n_preview === 'object')
        ? result.data.data_json_i18n_preview
        : undefined;

      await saveDraftAssignmentForSaisisseur(
        {
          tables: rows,
          columns_order: targetColumns,
          tables_i18n: draftI18nTables,
          data_json_i18n_draft: draftI18nPayload,
        },
        'En cours'
      );
      setEditTableColumns(targetColumns);
      setEditTableRows(rows);
      const warningText = formatWarningsForAlert(result?.data?.warnings);
      alert(warningText ? `Import brouillon effectue\n${warningText}` : 'Import brouillon effectue.');
      return;
    }

    setIsReplacing(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (fileAr) fd.append('file_ar', fileAr);
      if (fileEn) fd.append('file_en', fileEn);
      fd.append('free_schema', 'true');
      const result = await axios.post(`${API_BASE}/sousthemes/${selectedSubTheme.id}/import/`, fd);
      const warningText = formatWarningsForAlert(result?.data?.warnings);
      alert(warningText ? `Import reussi\n${warningText}` : 'Import reussi');
      await refreshEditedSubTheme();
    } finally {
      setIsReplacing(false);
    }
  };

  const executeSmartImport = async (file, fileAr = null, fileEn = null) => {
    if (!file) return;
    if (isSaisisseur) {
      const fd = new FormData();
      fd.append('file', file);
      if (fileAr) fd.append('file_ar', fileAr);
      if (fileEn) fd.append('file_en', fileEn);
      fd.append('free_schema', 'true');

      const result = await axios.post(`${API_BASE}/sousthemes/${selectedSubTheme.id}/import-smart-preview/`, fd);
      const mappedRows = Array.isArray(result?.data?.data) ? result.data.data : [];
      const targetColumns = Array.isArray(result?.data?.columns_order) && result.data.columns_order.length > 0
        ? result.data.columns_order
        : (mappedRows[0] ? Object.keys(mappedRows[0]) : []);
      if (!targetColumns.length) throw new Error('Impossible de déterminer les colonnes cibles après import IA.');

      const draftI18nTables = (result?.data?.tables_i18n && typeof result.data.tables_i18n === 'object')
        ? result.data.tables_i18n
        : { fr: mappedRows };
      const draftI18nPayload = (result?.data?.data_json_i18n_preview && typeof result.data.data_json_i18n_preview === 'object')
        ? result.data.data_json_i18n_preview
        : undefined;

      await saveDraftAssignmentForSaisisseur(
        {
          tables: mappedRows,
          columns_order: targetColumns,
          tables_i18n: draftI18nTables,
          data_json_i18n_draft: draftI18nPayload,
        },
        'En cours'
      );
      setEditTableColumns(targetColumns);
      setEditTableRows(mappedRows);
      const warningText = formatWarningsForAlert(result?.data?.warnings);
      alert(warningText ? `Import IA brouillon effectue\n${warningText}` : 'Import IA brouillon effectue.');
      return;
    }

    setIsSmartImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (fileAr) fd.append('file_ar', fileAr);
      if (fileEn) fd.append('file_en', fileEn);
      fd.append('free_schema', 'true');
      const result = await axios.post(`${API_BASE}/sousthemes/${selectedSubTheme.id}/import-smart/`, fd);
      const warningText = formatWarningsForAlert(result?.data?.warnings);
      alert(warningText ? `Import IA reussi\n${warningText}` : 'Import IA reussi');
      await refreshEditedSubTheme();
    } finally {
      setIsSmartImporting(false);
    }
  };

  const executeClassicAppend = async (file, fileAr = null, fileEn = null) => {
    if (!file) return;
    if (isSaisisseur) {
      const imported = await readExcelRows(file);
      if (!imported.columns.length) throw new Error('Le fichier importe est vide ou sans colonnes exploitables.');
      const importedAr = fileAr ? await readExcelRows(fileAr) : null;
      const importedEn = fileEn ? await readExcelRows(fileEn) : null;
      const existingRows = editTableRows || [];
      const existingColumns = (editTableColumns && editTableColumns.length > 0) ? editTableColumns : imported.columns;
      const assignment = getSaisisseurAssignmentForSubTheme(selectedSubTheme?.id);
      const existingNotes = parseAssignmentNotes(assignment?.notes);
      const existingI18nTables = (existingNotes.tables_i18n && typeof existingNotes.tables_i18n === 'object') ? existingNotes.tables_i18n : {};
      if (existingColumns.length > 0) {
        const expectedSet = new Set(existingColumns.map((c) => String(c || '').trim()));
        const incomingSet = new Set((imported.columns || []).map((c) => String(c || '').trim()));
        const sameColumns = expectedSet.size === incomingSet.size && [...expectedSet].every((c) => incomingSet.has(c));
        if (!sameColumns) throw new Error('Ajout classique refuse: colonnes incompatibles. Utilisez Ajouter avec IA ou alignez les colonnes du fichier.');
      }
      const normalizedRows = imported.rows.map((row) => Object.fromEntries(existingColumns.map((col) => [col, row?.[col] ?? ''])));
      const mergedRows = [...existingRows, ...normalizedRows];
      const mergedI18nTables = {
        ...existingI18nTables,
        fr: Array.isArray(existingI18nTables.fr) ? [...existingI18nTables.fr, ...normalizedRows] : mergedRows,
      };
      if (importedAr?.rows?.length) {
        const normalizedRowsAr = mapRowsToTargetColumns(importedAr.rows, importedAr.columns, existingColumns);
        mergedI18nTables.ar = Array.isArray(existingI18nTables.ar) ? [...existingI18nTables.ar, ...normalizedRowsAr] : normalizedRowsAr;
      }
      if (importedEn?.rows?.length) {
        const normalizedRowsEn = mapRowsToTargetColumns(importedEn.rows, importedEn.columns, existingColumns);
        mergedI18nTables.en = Array.isArray(existingI18nTables.en) ? [...existingI18nTables.en, ...normalizedRowsEn] : normalizedRowsEn;
      }
      await saveDraftAssignmentForSaisisseur({ tables: mergedRows, columns_order: existingColumns, tables_i18n: mergedI18nTables }, 'En cours');
      setEditTableColumns(existingColumns);
      setEditTableRows(mergedRows);
      alert(`${normalizedRows.length} ligne(s) ajoutee(s) au brouillon.`);
      return;
    }

    setIsAppending(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (fileAr) fd.append('file_ar', fileAr);
      if (fileEn) fd.append('file_en', fileEn);
      fd.append('use_ai', 'false');
      const result = await axios.post(`${API_BASE}/sousthemes/${selectedSubTheme.id}/append/`, fd);
      const warningText = formatWarningsForAlert(result?.data?.warnings);
      const msg = result?.data?.message || 'Lignes ajoutees avec succes';
      alert(warningText ? `${msg}\n${warningText}` : msg);
      await refreshEditedSubTheme();
    } finally {
      setIsAppending(false);
    }
  };

  const executeSmartAppend = async (file, fileAr = null, fileEn = null) => {
    if (!file) return;
    if (isSaisisseur) {
      const fd = new FormData();
      fd.append('file', file);
      if (fileAr) fd.append('file_ar', fileAr);
      if (fileEn) fd.append('file_en', fileEn);

      const result = await axios.post(`${API_BASE}/sousthemes/${selectedSubTheme.id}/append-smart-preview/`, fd);
      const mergedRows = Array.isArray(result?.data?.data) ? result.data.data : [];
      const appendRows = Array.isArray(result?.data?.append_rows) ? result.data.append_rows : [];
      const existingColumns = Array.isArray(result?.data?.columns_order) && result.data.columns_order.length > 0
        ? result.data.columns_order
        : (mergedRows[0] ? Object.keys(mergedRows[0]) : []);
      const assignment = getSaisisseurAssignmentForSubTheme(selectedSubTheme?.id);
      const existingNotes = parseAssignmentNotes(assignment?.notes);
      const existingI18nTables = (existingNotes.tables_i18n && typeof existingNotes.tables_i18n === 'object') ? existingNotes.tables_i18n : {};
      const appendRowsI18n = (result?.data?.append_rows_i18n && typeof result.data.append_rows_i18n === 'object')
        ? result.data.append_rows_i18n
        : { fr: appendRows };
      const mergedI18nTables = {
        ...existingI18nTables,
        fr: Array.isArray(existingI18nTables.fr)
          ? [...existingI18nTables.fr, ...(appendRowsI18n.fr || appendRows)]
          : (appendRowsI18n.fr || mergedRows),
      };
      if (Array.isArray(appendRowsI18n.ar)) {
        mergedI18nTables.ar = Array.isArray(existingI18nTables.ar)
          ? [...existingI18nTables.ar, ...appendRowsI18n.ar]
          : appendRowsI18n.ar;
      }
      if (Array.isArray(appendRowsI18n.en)) {
        mergedI18nTables.en = Array.isArray(existingI18nTables.en)
          ? [...existingI18nTables.en, ...appendRowsI18n.en]
          : appendRowsI18n.en;
      }
      await saveDraftAssignmentForSaisisseur({ tables: mergedRows, columns_order: existingColumns, tables_i18n: mergedI18nTables }, 'En cours');
      setEditTableColumns(existingColumns);
      setEditTableRows(mergedRows);
      const warningText = formatWarningsForAlert(result?.data?.warnings);
      alert(warningText ? `${appendRows.length} ligne(s) ajoutee(s) au brouillon (IA backend).\n${warningText}` : `${appendRows.length} ligne(s) ajoutee(s) au brouillon (IA backend).`);
      return;
    }

    setIsAppendingAI(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (fileAr) fd.append('file_ar', fileAr);
      if (fileEn) fd.append('file_en', fileEn);
      fd.append('use_ai', 'true');
      const result = await axios.post(`${API_BASE}/sousthemes/${selectedSubTheme.id}/append/`, fd);
      const warningText = formatWarningsForAlert(result?.data?.warnings);
      const msg = result?.data?.message || 'Lignes ajoutees avec IA';
      alert(warningText ? `${msg}\n${warningText}` : msg);
      await refreshEditedSubTheme();
    } finally {
      setIsAppendingAI(false);
    }
  };

  const getImportModeMeta = (mode) => {
    if (mode === 'replace') return { title: 'Remplacer par un fichier', description: 'Import classique d\'un tableau analytique. Le fichier arabe est optionnel si le sous-theme n\'est pas encore bilingue.' };
    if (mode === 'smart-replace') return { title: 'Importer avec IA', description: 'Import de fichier complexe avec normalisation IA. Le fichier arabe optionnel sera verifie apres normalisation.' };
    if (mode === 'append') return { title: 'Ajouter au tableau', description: 'Ajout strict de nouvelles lignes. Si le sous-theme est bilingue, le fichier arabe devient obligatoire.' };
    return { title: 'Ajouter avec IA', description: 'Ajout avec remappage IA. Si le sous-theme est bilingue, le fichier arabe devient obligatoire.' };
  };

  const openImportDialog = (mode) => setImportDialog({ open: true, mode, file: null, fileAr: null, fileEn: null });
  const closeImportDialog = () => setImportDialog({ open: false, mode: null, file: null, fileAr: null, fileEn: null });
  const isCurrentImportBusy = isReplacing || isSmartImporting || isAppending || isAppendingAI;

  const handleConfirmImportDialog = async () => {
    const { mode, file, fileAr, fileEn } = importDialog;
    if (!file) {
      alert('Le fichier principal est obligatoire.');
      return;
    }

    if (hasEnglishI18nData && !fileEn) {
      alert('Ce sous-thème contient déjà des données EN. Le fichier anglais est obligatoire.');
      return;
    }

    try {
      if (mode === 'replace') {
        await executeClassicImport(file, fileAr || null, fileEn || null);
      } else if (mode === 'smart-replace') {
        await executeSmartImport(file, fileAr || null, fileEn || null);
      } else if (mode === 'append') {
        await executeClassicAppend(file, fileAr || null, fileEn || null);
      } else if (mode === 'append-smart') {
        await executeSmartAppend(file, fileAr || null, fileEn || null);
      }
      closeImportDialog();
    } catch (err) {
      console.error(err.response?.data || err);
      const report = err.response?.data?.validation_report;
      if (report?.errors?.length) {
        alert(`Validation bilingue refusee:\n- ${report.errors.join('\n- ')}`);
      } else {
        alert(err.response?.data?.error || err.message || 'Erreur lors de l\'import.');
      }
    }
  };

  const getExportSnapshot = () => {
    if (!selectedSubTheme) return null;

    if (isVisitor && activeVisitorView === 'vertical' && visitorVerticalMatrix?.canVertical) {
      const headers = [
        ...(visitorVerticalMatrix.rowCols || []),
        ...((visitorVerticalMatrix.leaves || []).map(leaf => (leaf.values || []).join(' / ')))
      ];
      const rows = (visitorVerticalMatrix.rows || []).map(row => {
        const left = (visitorVerticalMatrix.rowCols || []).map(col => row?.dimensions?.[col] ?? '');
        const right = (visitorVerticalMatrix.leaves || []).map(leaf => row?.cells?.[leaf.key] ?? '');
        return [...left, ...right];
      });
      return { headers, rows, view: 'vertical' };
    }

    if (isVisitor && visitorMatrix?.canPivot) {
      const headers = [
        ...(visitorMatrix.displayGroupCols || []),
        ...(visitorMatrix.periods || [])
      ];
      const rows = (visitorMatrix.rows || []).map(row => {
        const left = (visitorMatrix.displayGroupCols || []).map(col => row?.dimensions?.[col] ?? '');
        const right = (visitorMatrix.periods || []).map(period => row?.values?.[period] ?? '');
        return [...left, ...right];
      });
      return { headers, rows, view: 'horizontal' };
    }

    // fallback (non-visitor or non-pivot table): export currently filtered table
    const headers = visibleColumnsForRender || selectedSubTheme.columns || [];
    const rows = (filteredData || []).map(r => headers.map(c => r?.[c] ?? ''));
    return { headers, rows, view: 'flat' };
  };

  const getExportMetadataEntries = () => {
    if (!selectedSubTheme) return [];
    const raw = [
      [t('meta_definition'), getLocalizedMetadataValue(selectedSubTheme, 'definition_text')],
      [t('meta_unit'), getLocalizedMetadataValue(selectedSubTheme, 'unite_text')],
      [t('meta_periodicity'), getLocalizedMetadataValue(selectedSubTheme, 'periodicite_text')],
      [t('meta_indication'), getLocalizedMetadataValue(selectedSubTheme, 'indication_text')],
      [t('meta_source'), getLocalizedMetadataValue(selectedSubTheme, 'source_text')],
      [t('meta_coverage'), getLocalizedMetadataValue(selectedSubTheme, 'couverture_text')],
    ];
    return raw.filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '');
  };

  const downloadBlob = (content, mimeType, fileName) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const escapeCSVCell = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

  const exportTableCSV = () => {
    const snapshot = getExportSnapshot();
    if (!snapshot || !snapshot.headers || snapshot.headers.length === 0) return alert(t('no_table_to_export'));
    const header = snapshot.headers.map(escapeCSVCell).join(',');
    const lines = (snapshot.rows || []).map(r => r.map(escapeCSVCell).join(','));
    const csv = [header, ...lines].join('\n');
    const fileName = `${(selectedSubTheme?.nom || 'soustheme').replace(/\s+/g, '_')}_${snapshot.view}.csv`;
    downloadBlob(csv, 'text/csv;charset=utf-8;', fileName);
  };

  const exportTableTXT = () => {
    const snapshot = getExportSnapshot();
    if (!snapshot || !snapshot.headers || snapshot.headers.length === 0) return alert(t('no_table_to_export'));
    const lines = [
      snapshot.headers.join('\t'),
      ...(snapshot.rows || []).map(r => r.map(v => String(v ?? '')).join('\t')),
    ];
    const txt = lines.join('\n');
    const fileName = `${(selectedSubTheme?.nom || 'soustheme').replace(/\s+/g, '_')}_${snapshot.view}.txt`;
    downloadBlob(txt, 'text/plain;charset=utf-8;', fileName);
  };

  const exportTableXLSX = async () => {
    const XLSX = await import('xlsx-js-style');
    const snapshot = getExportSnapshot();
    if (!snapshot || !snapshot.headers || snapshot.headers.length === 0) return alert(t('no_table_to_export'));

    const metadata = getExportMetadataEntries();
    const aoa = [];
    const merges = [];
    const title = t('export_subtheme_title', { name: getSubThemeDisplayName(selectedSubTheme), view: getExportViewLabel(snapshot.view) });
    aoa.push([title]);
    if (metadata.length > 0) {
      aoa.push([]);
      metadata.forEach(([k, v]) => aoa.push([k, String(v)]));
    }
    aoa.push([]);

    const tableStartRow = aoa.length;

    const formatValue = (val) => {
      if (val === null || val === undefined) return '';
      return val;
    };

    const isNumericLike = (val) => {
      if (typeof val === 'number') return true;
      const n = Number(String(val ?? '').replace(/,/g, '.'));
      return !Number.isNaN(n) && String(val ?? '').trim() !== '';
    };

    const headerFillPrimary = '188FBE';
    const headerFillSecondary = '167FA8';
    const headerBorder = '0F6B90';
    const bodyBorder = 'D1E2EC';

    let finalHeaders = snapshot.headers;

    if (isVisitor && activeVisitorView === 'vertical' && visitorVerticalMatrix?.canVertical) {
      const rowCols = visitorVerticalMatrix.rowCols || [];
      const leaves = visitorVerticalMatrix.leaves || [];
      const headerRows = visitorVerticalMatrix.headerRows || [];
      const totalCols = rowCols.length + leaves.length;

      finalHeaders = [
        ...rowCols,
        ...leaves.map(leaf => (leaf.values || []).join(' / '))
      ];

      for (let hr = 0; hr < headerRows.length; hr += 1) {
        const row = new Array(totalCols).fill('');
        if (hr === 0) {
          rowCols.forEach((col, idx) => { row[idx] = String(col || ''); });
        }

        let cCursor = rowCols.length;
        (headerRows[hr]?.cells || []).forEach(cell => {
          row[cCursor] = String(cell?.label || '');
          if (cell.colSpan > 1) {
            merges.push({
              s: { r: tableStartRow + hr, c: cCursor },
              e: { r: tableStartRow + hr, c: cCursor + cell.colSpan - 1 }
            });
          }
          cCursor += cell.colSpan || 1;
        });

        aoa.push(row);
      }

      if (headerRows.length > 1 && rowCols.length > 0) {
        rowCols.forEach((_, idx) => {
          merges.push({
            s: { r: tableStartRow, c: idx },
            e: { r: tableStartRow + headerRows.length - 1, c: idx }
          });
        });
      }

      const bodyStart = tableStartRow + headerRows.length;
      const dataRows = visitorVerticalMatrix.rows || [];
      const spanMaps = {};
      const isPeriodCol = (colName) => /(annee|année|period|période|year)/i.test(String(colName || '').toLowerCase());
      rowCols.forEach((col, colIndex) => {
        const spans = new Array(dataRows.length).fill(0);
        let i = 0;
        while (i < dataRows.length) {
          const curVal = String(dataRows[i]?.dimensions?.[col] ?? '—');
          let j = i + 1;
          while (j < dataRows.length) {
            const sameVal = String(dataRows[j]?.dimensions?.[col] ?? '—') === curVal;
            if (!sameVal) break;
            let samePrefix = true;
            for (let p = 0; p < colIndex; p += 1) {
              const prevCol = rowCols[p];
              if (isPeriodCol(prevCol)) continue;
              if (String(dataRows[i]?.dimensions?.[prevCol] ?? '—') !== String(dataRows[j]?.dimensions?.[prevCol] ?? '—')) { samePrefix = false; break; }
            }
            if (!samePrefix) break;
            j += 1;
          }
          spans[i] = j - i;
          i = j;
        }
        spanMaps[col] = spans;
      });

      dataRows.forEach((rowObj, ridx) => {
        const row = [];
        rowCols.forEach(col => row.push(String(rowObj?.dimensions?.[col] ?? '—')));
        leaves.forEach(leaf => row.push(formatValue(rowObj?.cells?.[leaf.key])));
        aoa.push(row);

        rowCols.forEach((col, cidx) => {
          const span = spanMaps[col]?.[ridx] || 0;
          if (span > 1) {
            merges.push({
              s: { r: bodyStart + ridx, c: cidx },
              e: { r: bodyStart + ridx + span - 1, c: cidx }
            });
          }
        });
      });
    } else if (isVisitor && visitorMatrix?.canPivot) {
      const groupCols = visitorMatrix.displayGroupCols || [];
      const periods = visitorMatrix.periods || [];
      finalHeaders = [...groupCols, ...periods];
      aoa.push(finalHeaders);

      const dataRows = visitorMatrix.rows || [];
      const bodyStart = tableStartRow + 1;

      const spanMaps = {};
      groupCols.forEach((col, colIndex) => {
        const spans = new Array(dataRows.length).fill(0);
        let i = 0;
        while (i < dataRows.length) {
          const curVal = String(dataRows[i]?.dimensions?.[col] ?? '—');
          let j = i + 1;
          while (j < dataRows.length) {
            const sameVal = String(dataRows[j]?.dimensions?.[col] ?? '—') === curVal;
            if (!sameVal) break;
            let samePrefix = true;
            for (let p = 0; p < colIndex; p += 1) {
              const prevCol = groupCols[p];
              if (String(dataRows[i]?.dimensions?.[prevCol] ?? '—') !== String(dataRows[j]?.dimensions?.[prevCol] ?? '—')) { samePrefix = false; break; }
            }
            if (!samePrefix) break;
            j += 1;
          }
          spans[i] = j - i;
          i = j;
        }
        spanMaps[col] = spans;
      });

      dataRows.forEach((rowObj, ridx) => {
        const left = groupCols.map(col => String(rowObj?.dimensions?.[col] ?? '—'));
        const right = periods.map(period => formatValue(rowObj?.values?.[period]));
        aoa.push([...left, ...right]);

        groupCols.forEach((col, cidx) => {
          const span = spanMaps[col]?.[ridx] || 0;
          if (span > 1) {
            merges.push({
              s: { r: bodyStart + ridx, c: cidx },
              e: { r: bodyStart + ridx + span - 1, c: cidx }
            });
          }
        });
      });
    } else {
      finalHeaders = snapshot.headers || [];
      aoa.push(finalHeaders);
      (snapshot.rows || []).forEach(r => aoa.push((r || []).map(v => formatValue(v))));
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    if (merges.length > 0) ws['!merges'] = merges;

    const titleAddr = XLSX.utils.encode_cell({ r: 0, c: 0 });
    if (ws[titleAddr]) {
      ws[titleAddr].s = {
        font: { bold: true, sz: 13, color: { rgb: '0B5E83' } },
        alignment: { horizontal: 'left', vertical: 'center' },
      };
    }

    // style metadata labels/values
    if (metadata.length > 0) {
      const metadataStart = 2;
      for (let i = 0; i < metadata.length; i += 1) {
        const kAddr = XLSX.utils.encode_cell({ r: metadataStart + i, c: 0 });
        const vAddr = XLSX.utils.encode_cell({ r: metadataStart + i, c: 1 });
        if (ws[kAddr]) ws[kAddr].s = { font: { bold: true, color: { rgb: '0C4F6D' } } };
        if (ws[vAddr]) ws[vAddr].s = { alignment: { wrapText: true, vertical: 'top' } };
      }
    }

    const headerStart = tableStartRow;
    const bodyStart = (() => {
      if (isVisitor && activeVisitorView === 'vertical' && visitorVerticalMatrix?.canVertical) {
        return tableStartRow + (visitorVerticalMatrix.headerRows || []).length;
      }
      return tableStartRow + 1;
    })();
    const bodyEnd = aoa.length - 1;

    // header styles
    for (let r = headerStart; r < bodyStart; r += 1) {
      for (let c = 0; c < finalHeaders.length; c += 1) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) continue;
        ws[addr].s = {
          fill: { fgColor: { rgb: r === headerStart ? headerFillPrimary : headerFillSecondary } },
          font: { color: { rgb: 'FFFFFF' }, bold: true, sz: r === headerStart ? 12 : 11 },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          border: {
            top: { style: 'thin', color: { rgb: headerBorder } },
            bottom: { style: 'thin', color: { rgb: headerBorder } },
            left: { style: 'thin', color: { rgb: headerBorder } },
            right: { style: 'thin', color: { rgb: headerBorder } },
          },
        };
      }
    }

    // body styles
    for (let r = bodyStart; r <= bodyEnd; r += 1) {
      const isEven = (r - bodyStart) % 2 === 0;
      for (let c = 0; c < finalHeaders.length; c += 1) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) continue;
        const raw = ws[addr].v;
        ws[addr].s = {
          fill: { fgColor: { rgb: isEven ? 'F7FBFE' : 'FFFFFF' } },
          font: { color: { rgb: '0C4F6D' }, sz: 11 },
          alignment: {
            horizontal: isNumericLike(raw) ? 'right' : 'left',
            vertical: 'center',
          },
          border: {
            top: { style: 'thin', color: { rgb: bodyBorder } },
            bottom: { style: 'thin', color: { rgb: bodyBorder } },
            left: { style: 'thin', color: { rgb: bodyBorder } },
            right: { style: 'thin', color: { rgb: bodyBorder } },
          },
        };
      }
    }

    // autosize columns
    ws['!cols'] = finalHeaders.map((h, idx) => ({
      wch: Math.max(14, String(h || '').length + (idx < 3 ? 7 : 3))
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tableau');
    const fileName = `${(selectedSubTheme?.nom || 'soustheme').replace(/\s+/g, '_')}_${snapshot.view}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const fetchThemes = async () => {
    try {
      const url = isVisitor ? `${API_BASE}/public-themes/` : `${API_BASE}/themes/`;
      // Route is authoritative; avoid stale cross-tab auth_context.
      let token = null;
      try {
        if (isVisitor) {
          token = null;
        } else if (pathHasAdmin) {
          token = getAuthStorageItem('auth_token_admin');
        } else if (isSaisisseurRoute) {
          token = getAuthStorageItem('auth_token_saisisseur');
        } else {
          const ctx = authContext || getAuthStorageItem('auth_context');
          if (ctx === 'admin') token = getAuthStorageItem('auth_token_admin');
          else if (ctx === 'saisisseur') token = getAuthStorageItem('auth_token_saisisseur');
          else token = getAuthStorageItem('auth_token');
        }
      } catch { token = getAuthStorageItem('auth_token'); }

      const res = await axios.get(url, token ? { headers: { Authorization: `Token ${token}` } } : {});
      setThemes(res.data);
    } catch (err) {
      // Affiche la réponse du serveur si disponible pour aider le debug
      console.error("Erreur thèmes", err.response?.data ?? err.message ?? err);
    }
  };

  // Fonction pour obtenir les valeurs uniques d'une colonne
  const getUniqueValuesForColumn = (columnName) => {
    const data = getTableRows(selectedSubTheme);
    // Also try the localized equivalent of columnName so it works after a language switch
    const localizedColumnName = getLocalizedColumnLabel(columnName);
    const values = new Set();
    data.forEach(row => {
      const val = row[columnName] !== undefined ? row[columnName] : row[localizedColumnName];
      if (val !== null && val !== undefined && val !== '') {
        values.add(String(val));
      }
    });
    return Array.from(values).sort();
  };

  // Custom tooltip: hide series with zero value for cleaner display
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload) return null;
    // payload items: { name, value, color }
    const items = payload.filter(p => p && Number(p.value) !== 0 && p.value !== null && p.value !== undefined);
    if (!items || items.length === 0) return null;
    return (
      <div className="bg-white p-2 border border-gray-300 rounded shadow-lg">
        <div className="font-bold mb-1">{translateDataValue(label)}</div>
        {items.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div style={{ width: 10, height: 10, background: p.color || p.fill || '#000' }} />
            <div className="font-semibold">{translateDataValue(p.name)}</div>
            <div className="ml-2">: {p.value}</div>
          </div>
        ))}
      </div>
    );
  };

  const chartContainerHeightClass = isArabicDataView ? 'h-[24rem] md:h-[28rem]' : 'h-[22rem] md:h-[26rem]';
  const chartMargin = isArabicDataView
    ? { top: 14, right: 20, bottom: 18, left: 48 }
    : { top: 10, right: 12, bottom: 12, left: 18 };
  const chartYAxisProps = {
    width: isArabicDataView ? 76 : 60,
    tickMargin: isArabicDataView ? 14 : 8,
    axisLine: !isArabicDataView,
    tickLine: !isArabicDataView,
  };

  const renderPieChartLabel = ({ cx, cy, midAngle, outerRadius, name, percent }) => {
    const RADIAN = Math.PI / 180;
    const labelRadius = (outerRadius || 0) + (isArabicDataView ? 44 : 30);
    const x = cx + labelRadius * Math.cos(-midAngle * RADIAN);
    const y = cy + labelRadius * Math.sin(-midAngle * RADIAN);
    const safeName = translateDataValue(name);
    const safePercent = `(${((percent || 0) * 100).toFixed(0)}%)`;
    const textAnchor = x > cx ? 'start' : 'end';

    return (
      <text
        x={x}
        y={y}
        fill="#4d1734"
        textAnchor={textAnchor}
        dominantBaseline="central"
        fontSize={isArabicDataView ? 15 : 13}
        fontWeight="700"
      >
        <tspan x={x} dy="0">{safeName}</tspan>
        <tspan x={x} dy="1.1em">{safePercent}</tspan>
      </text>
    );
  };

  const getFilteredChartData = (chart) => {
    const data = getTableRows(selectedSubTheme);
    const resolveChartColumnValue = (row, columnName) => {
      const localizedColumnName = getLocalizedColumnLabel(columnName);
      if (row[columnName] !== undefined) return row[columnName];
      if (localizedColumnName !== columnName && row[localizedColumnName] !== undefined) return row[localizedColumnName];
      return undefined;
    };
    const matchesChartFilter = (row, columnName, expectedValue) => {
      const rowValue = resolveChartColumnValue(row, columnName);
      const localizedExpectedValue = activeDataLanguage !== 'fr'
        ? getLocalizedValueLabel(columnName, expectedValue)
        : expectedValue;
      return String(rowValue ?? '') === String(expectedValue ?? '') || String(rowValue ?? '') === String(localizedExpectedValue ?? '');
    };
    
    // Appliquer le filtre de colonne primaire
    let filtered = data;
    if (chart?.filter_column && chart?.filter_value) {
      const mode = chart?.filter_mode || 'include';
      if (mode === 'include') {
        filtered = data.filter(row => matchesChartFilter(row, chart.filter_column, chart.filter_value));
      } else {
        filtered = data.filter(row => !matchesChartFilter(row, chart.filter_column, chart.filter_value));
      }
    }
    
    // Appliquer les filtres supplémentaires
    if (chart?.filters && Array.isArray(chart.filters)) {
      chart.filters.forEach(filter => {
        if (filter.column && filter.value) {
          const mode = filter.mode || 'include';
          if (mode === 'include') {
            filtered = filtered.filter(row => matchesChartFilter(row, filter.column, filter.value));
          } else {
            filtered = filtered.filter(row => !matchesChartFilter(row, filter.column, filter.value));
          }
        }
      });
    }
    
    // Appliquer l'exclusion manuelle (clic pour supprimer)
    return filtered.filter(row => !isRowExcluded(chart.id, chart, row));
  };

  // Logique de filtrage du tableau avec les deux types de filtres

  // Helper: resolve a filter key to the correct column name in the current row,
  // handling language switches where dynamicFilters/columnFilters may still hold
  // keys/values from a previous locale.
  const resolveFilterKeyInRow = (key, row) => {
    if (row[key] !== undefined) return { key, value: row[key] };
    // Try the localized equivalent (resolves FR↔AR via canonical codes)
    const localizedKey = getLocalizedColumnLabel(key);
    if (localizedKey !== key && row[localizedKey] !== undefined) return { key: localizedKey, value: row[localizedKey] };
    // Key not found in row; treat as no-op (don't filter out rows for unknown columns)
    return null;
  };

  const sourceTableRows = getTableRows(selectedSubTheme) || [];
  const filteredRows = sourceTableRows.filter(row => {
    // Filtre par recherche texte (columnFilters)
    const passesTextFilter = Object.keys(columnFilters).every(key => {
      const resolved = resolveFilterKeyInRow(key, row);
      if (!resolved) return true;
      return String(resolved.value || '').toLowerCase().includes(columnFilters[key].toLowerCase());
    });

    // Filtre par valeurs sélectionnées (dynamicFilters basé sur filtres_disponibles)
    const passesDynamicFilters = Object.keys(dynamicFilters).every(key => {
      const selectedValue = dynamicFilters[key];
      if (selectedValue === null || selectedValue === undefined) return true;

      const resolved = resolveFilterKeyInRow(key, row);
      if (!resolved) return true; // column not present in row — skip filter
      const rowVal = resolved.value;

      // Translate the selected value to the current language before comparing,
      // so a previously-selected "Masculin" still matches "ط°ظƒط±" after AR switch, etc.
      const localizedSelectedValue = activeDataLanguage !== 'fr'
        ? getLocalizedValueLabel(key, selectedValue)
        : String(selectedValue ?? '');

      if (Array.isArray(selectedValue)) {
        if (selectedValue.length === 0) return true;
        return selectedValue.some(sv => {
          const lv = activeDataLanguage !== 'fr'
            ? getLocalizedValueLabel(key, sv)
            : String(sv ?? '');
          return String(sv) === String(rowVal) || String(lv) === String(rowVal);
        });
      }
      if (selectedValue === '') return true;
      return String(rowVal) === String(selectedValue) || String(rowVal) === String(localizedSelectedValue);
    });

    return passesTextFilter && passesDynamicFilters;
  }) || [];
  const filteredData = (isVisitor && sourceTableRows.length > 0 && filteredRows.length === 0)
    ? sourceTableRows
    : filteredRows;

  const visibleColumnsForRender = React.useMemo(() => {
    if (!selectedSubTheme) return [];
    const rowBasedColumns = (() => {
      const rows = getTableRows(selectedSubTheme) || [];
      return rows[0] ? Object.keys(rows[0]) : [];
    })();

    const fallbackColumns = isVisitor
      ? rowBasedColumns
      : (Array.isArray(selectedSubTheme.columns) && selectedSubTheme.columns.length > 0)
        ? selectedSubTheme.columns
        : (Array.isArray(selectedSubTheme.columns_order) && selectedSubTheme.columns_order.length > 0)
          ? selectedSubTheme.columns_order
          : rowBasedColumns;

    if (isVisitor) {
      const configuredVisitorColumns = Array.isArray(selectedSubTheme.visitor_visible_columns)
        ? selectedSubTheme.visitor_visible_columns
        : [];
      if (configuredVisitorColumns.length > 0) {
        const resolvedVisitorColumns = resolveConfiguredColumnsForRows(configuredVisitorColumns, rowBasedColumns);
        if (resolvedVisitorColumns.length > 0) return resolvedVisitorColumns;
      }
      return fallbackColumns;
    }
    if (isSaisisseur) {
      return rowBasedColumns.length > 0 ? rowBasedColumns : fallbackColumns;
    }
    if (activeDataLanguage !== 'fr') {
      return localizeConfiguredColumns(fallbackColumns);
    }
    return fallbackColumns;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubTheme, isVisitor, activeDataLanguage, i18n.language]);

  const filtersForRender = React.useMemo(() => {
    if (!selectedSubTheme) return [];
    if (isVisitor) {
      const raw = (selectedSubTheme.visitor_filters && selectedSubTheme.visitor_filters.length) ? selectedSubTheme.visitor_filters : (selectedSubTheme.filtres_disponibles || []);
      const rows = getTableRows(selectedSubTheme) || [];
      const rowBasedColumns = rows[0] ? Object.keys(rows[0]) : [];
      const resolvedFilters = resolveConfiguredColumnsForRows(raw, rowBasedColumns);
      return resolvedFilters.length > 0 ? resolvedFilters : localizeConfiguredColumns(raw);
    }
    if (isSaisisseur) {
      return selectedSubTheme.filtres_disponibles || [];
    }
    if (activeDataLanguage !== 'fr') {
      return localizeConfiguredColumns(selectedSubTheme.filtres_disponibles || []);
    }
    return selectedSubTheme.filtres_disponibles || [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubTheme, isVisitor, activeDataLanguage, i18n.language]);

  const visitorMatrix = React.useMemo(() => {
    if (!isVisitor || !selectedSubTheme) return null;

    const cols = (visibleColumnsForRender || []).filter(Boolean);
    const rows = filteredData || [];
    const sourceLookup = buildSourceColumnLookup(cols);

    const resolvedCanonicalValueCol = bilingualLabelLookup.valueColumnCode
      ? (resolveSourceColumn(bilingualLabelLookup.valueColumnCode, sourceLookup) || null)
      : null;

    const periodFromCanonical = (() => {
      const canonicalCols = Array.isArray(bilingualLabelLookup.canonicalColumns)
        ? bilingualLabelLookup.canonicalColumns
        : [];
      for (const code of canonicalCols) {
        if (!isPeriodColumnIdentifier(code)) continue;
        const resolved = resolveSourceColumn(code, sourceLookup);
        if (resolved) return resolved;
      }
      return null;
    })();

    const valueCol = resolvedCanonicalValueCol
      || cols.find(c => isValueColumnIdentifier(c))
      || inferNumericValueColumn(cols, rows)
      || null;

    const periodCol = periodFromCanonical
      || cols.find(c => isPeriodColumnIdentifier(c))
      || inferPeriodColumnFromValues(cols, rows, valueCol)
      || null;

    const groupCols = cols.filter(c => c !== periodCol && c !== valueCol);
    const canPivot = Boolean(periodCol && valueCol && groupCols.length > 0);
    if (!canPivot) {
      const reasons = [];
      if (!periodCol) reasons.push('Colonne période introuvable');
      if (!valueCol) reasons.push('Colonne valeur introuvable');
      if (groupCols.length === 0) reasons.push('Aucune colonne de regroupement');
      return {
        canPivot: false,
        reason: reasons.join(' • ') || 'Configuration insuffisante',
        periodCol,
        valueCol,
        groupCols,
        displayGroupCols: groupCols,
        periods: [],
        rows: [],
      };
    }

    const isTotalToken = (val) => /(total|totale|tous|toutes|tout|ensemble|المجموع|إجمالي)/i.test(String(val ?? '').toLowerCase());

    const displayGroupCols = groupCols;

    const uniquePeriods = Array.from(new Set(rows.map(r => String(r?.[periodCol] ?? '')).filter(v => v !== '')));
    const sortedPeriods = uniquePeriods.sort((a, b) => {
      const na = Number(String(a).replace(/,/g, '.'));
      const nb = Number(String(b).replace(/,/g, '.'));
      const bothNumeric = !Number.isNaN(na) && !Number.isNaN(nb);
      if (bothNumeric) return na - nb;
      return String(a).localeCompare(String(b), localeCode, { numeric: true, sensitivity: 'base' });
    });

    const valueLooksRate = /(%|taux|ratio|pourcentage|ظ†ط³ط¨ط©)/i.test(String(valueCol).toLowerCase());
    const shouldSum = Boolean(selectedSubTheme?.est_sommable) && !valueLooksRate;

    const byGroup = {};
    rows.forEach(row => {
      const dimensions = {};
      displayGroupCols.forEach(col => {
        dimensions[col] = String(row?.[col] ?? '—');
      });
      const groupKey = displayGroupCols.map(col => dimensions[col]).join('||');
      const periodVal = String(row?.[periodCol] ?? '');
      if (!periodVal) return;

      if (!byGroup[groupKey]) {
        const isTotal = displayGroupCols.some(col => isTotalToken(dimensions[col]));
        byGroup[groupKey] = { key: groupKey, dimensions, values: {}, stats: {}, isTotal };
      }

      const rawVal = row?.[valueCol];
      const num = Number(String(rawVal ?? '').replace(/,/g, '.'));
      if (!Number.isNaN(num)) {
        const prev = byGroup[groupKey].stats[periodVal] || { sum: 0, count: 0 };
        prev.sum += num;
        prev.count += 1;
        byGroup[groupKey].stats[periodVal] = prev;
      } else if (byGroup[groupKey].values[periodVal] === undefined) {
        byGroup[groupKey].values[periodVal] = rawVal ?? '';
      }
    });

    const rowsOut = Object.values(byGroup).map(item => {
      const values = { ...(item.values || {}) };
      Object.entries(item.stats || {}).forEach(([period, st]) => {
        const sum = Number(st?.sum || 0);
        const count = Number(st?.count || 0);
        values[period] = shouldSum ? sum : (count > 0 ? (sum / count) : '');
      });
      return { ...item, values };
    }).sort((a, b) => {
      for (const col of displayGroupCols) {
        const av = String(a?.dimensions?.[col] ?? '');
        const bv = String(b?.dimensions?.[col] ?? '');
        const ai = isTotalToken(av);
        const bi = isTotalToken(bv);
        if (ai && !bi) return -1;
        if (!ai && bi) return 1;
        const cmp = av.localeCompare(bv, localeCode, { sensitivity: 'base' });
        if (cmp !== 0) return cmp;
      }
      return 0;
    });

    return {
      canPivot: true,
      periodCol,
      valueCol,
      groupCols,
      displayGroupCols,
      periods: sortedPeriods,
      rows: rowsOut,
      reason: ''
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisitor, selectedSubTheme, visibleColumnsForRender, filteredData, bilingualLabelLookup.canonicalColumns, bilingualLabelLookup.valueColumnCode]);

  const visitorVerticalMatrix = React.useMemo(() => {
    if (!isVisitor || !selectedSubTheme) {
      return { canVertical: false, reason: 'Mode visiteur inactif' };
    }

    const cols = (visibleColumnsForRender || []).filter(Boolean);
    const rows = filteredData || [];
    const sourceLookup = buildSourceColumnLookup(cols);
    const resolvedCanonicalValueCol = bilingualLabelLookup.valueColumnCode
      ? (resolveSourceColumn(bilingualLabelLookup.valueColumnCode, sourceLookup) || null)
      : null;
    const valueCol = visitorMatrix?.valueCol
      || resolvedCanonicalValueCol
      || cols.find(c => isValueColumnIdentifier(c))
      || inferNumericValueColumn(cols, rows)
      || null;
    if (!valueCol) return { canVertical: false, reason: 'Colonne valeur introuvable' };

    const hierarchyRaw = Array.isArray(selectedSubTheme?.visitor_pivot_columns) ? selectedSubTheme.visitor_pivot_columns : [];
    const hierarchyResolved = resolveConfiguredColumnsForRows(hierarchyRaw, cols);
    let hierarchyCols = hierarchyResolved.filter(c => cols.includes(c) && normalizeDataToken(c) !== normalizeDataToken(valueCol));
    if (!hierarchyCols || hierarchyCols.length === 0) {
      const fallbackHierarchySource = (visitorMatrix?.groupCols && visitorMatrix.groupCols.length > 0)
        ? visitorMatrix.groupCols
        : cols;
      const fallbackHierarchy = fallbackHierarchySource
        .filter(c => cols.includes(c) && normalizeDataToken(c) !== normalizeDataToken(valueCol));
      hierarchyCols = fallbackHierarchy;
    }
    if (!hierarchyCols || hierarchyCols.length === 0) return { canVertical: false, reason: 'Aucune hiérarchie exploitable' };

    const rowCols = cols.filter(c => c !== valueCol && !hierarchyCols.includes(c));

    const valueLooksRate = /(%|taux|ratio|pourcentage|ظ†ط³ط¨ط©)/i.test(String(valueCol).toLowerCase());
    const shouldSum = Boolean(selectedSubTheme?.est_sommable) && !valueLooksRate;
    const isTotalToken = (val) => /(total|totale|tous|toutes|tout|ensemble|المجموع|إجمالي)/i.test(String(val ?? '').toLowerCase());

    const compareSmart = (a, b) => {
      const sa = String(a ?? '');
      const sb = String(b ?? '');
      const na = Number(sa.replace(/,/g, '.'));
      const nb = Number(sb.replace(/,/g, '.'));
      const bothNumeric = !Number.isNaN(na) && !Number.isNaN(nb);
      if (bothNumeric) return na - nb;
      return sa.localeCompare(sb, localeCode, { numeric: true, sensitivity: 'base' });
    };

    const leavesMap = new Map();
    const rowMap = new Map();
    const statsMap = new Map();

    rows.forEach((row) => {
      const hierVals = hierarchyCols.map(col => String(row?.[col] ?? '—'));
      const leafKey = hierVals.join('||');
      if (!leavesMap.has(leafKey)) {
        leavesMap.set(leafKey, { key: leafKey, values: hierVals });
      }

      const rowVals = rowCols.map(col => String(row?.[col] ?? '—'));
      const rowKey = rowCols.length > 0 ? rowVals.join('||') : '__all__';
      if (!rowMap.has(rowKey)) {
        rowMap.set(rowKey, {
          key: rowKey,
          dimensions: rowCols.reduce((acc, col, idx) => { acc[col] = rowVals[idx]; return acc; }, {}),
          isTotal: rowCols.some((col, idx) => isTotalToken(rowVals[idx]))
        });
      }

      const raw = row?.[valueCol];
      const num = Number(String(raw ?? '').replace(/,/g, '.'));
      const cellKey = `${rowKey}::${leafKey}`;
      const prev = statsMap.get(cellKey) || { sum: 0, count: 0, raw: '' };
      if (!Number.isNaN(num)) {
        prev.sum += num;
        prev.count += 1;
      } else if (prev.raw === '' || prev.raw === undefined || prev.raw === null) {
        prev.raw = raw ?? '';
      }
      statsMap.set(cellKey, prev);
    });

    const leaves = Array.from(leavesMap.values()).sort((a, b) => {
      for (let i = 0; i < hierarchyCols.length; i++) {
        const cmp = compareSmart(a.values[i], b.values[i]);
        if (cmp !== 0) return cmp;
      }
      return 0;
    });

    const rowsOut = Array.from(rowMap.values()).map(r => {
      const cells = {};
      leaves.forEach(leaf => {
        const st = statsMap.get(`${r.key}::${leaf.key}`);
        if (!st) {
          cells[leaf.key] = '';
        } else if (st.count > 0) {
          cells[leaf.key] = shouldSum ? st.sum : (st.sum / st.count);
        } else {
          cells[leaf.key] = st.raw ?? '';
        }
      });
      return { ...r, cells };
    }).sort((a, b) => {
      if (a.isTotal && !b.isTotal) return -1;
      if (!a.isTotal && b.isTotal) return 1;
      for (const col of rowCols) {
        const cmp = compareSmart(a?.dimensions?.[col], b?.dimensions?.[col]);
        if (cmp !== 0) return cmp;
      }
      return 0;
    });

    const headerRows = hierarchyCols.map((col, level) => {
      const cells = [];
      let i = 0;
      while (i < leaves.length) {
        const label = leaves[i].values[level];
        let j = i + 1;
        while (j < leaves.length) {
          let samePrefix = true;
          for (let p = 0; p < level; p++) {
            if (leaves[j].values[p] !== leaves[i].values[p]) { samePrefix = false; break; }
          }
          if (!samePrefix) break;
          if (leaves[j].values[level] !== label) break;
          j += 1;
        }
        cells.push({ key: `${col}-${i}`, label, colSpan: j - i });
        i = j;
      }
      return { col, cells };
    });

    return {
      canVertical: leaves.length > 0,
      reason: leaves.length > 0 ? '' : 'Aucune donnée après application des filtres',
      hierarchyCols,
      rowCols,
      leaves,
      headerRows,
      rows: rowsOut,
      valueCol
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisitor, selectedSubTheme, visitorMatrix, visibleColumnsForRender, filteredData]);

  const canVisitorVerticalView = Boolean(isVisitor && visitorVerticalMatrix?.canVertical);
  const activeVisitorView = (canVisitorVerticalView && visitorTableView === 'vertical') ? 'vertical' : 'horizontal';

  // Gestion des graphiques
  const handleAddOrUpdateChart = async () => {
    // For Pie charts we still require X and Y (Y aggregated)
    if (!currentChartConfig.x || (!currentChartConfig.y && currentChartConfig.type !== 'Secteur')) return alert("Veuillez choisir les axes X et Y");

    if (currentChartConfig.filter_column && !currentChartConfig.filter_value) {
      return alert("Veuillez choisir une valeur pour le filtre");
    }

    // Type-specific validation (Y numeric for scatter/secteur when present)
    if ((currentChartConfig.type === 'Nuage de points' || currentChartConfig.type === 'Secteur') && selectedSubTheme && currentChartConfig.y) {
      const hasNumeric = getTableRows(selectedSubTheme).some(r => {
        const raw = r[currentChartConfig.y];
        if (raw === null || raw === undefined || raw === '') return false;
        const n = parseFloat(String(raw).replace(/,/g, '.'));
        return !isNaN(n);
      });
      if (!hasNumeric) return alert('La colonne Y sélectionnée ne contient pas de valeurs numériques nécessaires pour ce type de graphique.');
    }

    // Vérifier si un graphique avec le même type, x et y existe déjà (sauf si on modifie le graphique actuel)
    if (!currentChartConfig.id) {
      const duplicate = savedCharts.find(chart => 
        chart.type === currentChartConfig.type && 
        chart.x === currentChartConfig.x && 
        chart.y === currentChartConfig.y &&
        (chart.filter_column || '') === (currentChartConfig.filter_column || '') &&
        (chart.filter_value || '') === (currentChartConfig.filter_value || '')
      );
      if (duplicate) {
        return alert(`Un graphique de type "${currentChartConfig.type}" avec X="${currentChartConfig.x}" et Y="${currentChartConfig.y}" existe déjà pour ce sous-thème.`);
      }
    }

    try {
      if (isSaisisseur) {
        const nextChart = { ...currentChartConfig };
        delete nextChart.__temp;

        const nextCharts = currentChartConfig.id
          ? (savedCharts || []).map((chart) => (chart.id === currentChartConfig.id ? nextChart : chart))
          : [...(savedCharts || []), { ...nextChart, id: nextChart.id || `draft-${Date.now()}` }];

        setSavedCharts(nextCharts);
        await saveDraftAssignmentForSaisisseur({ charts: nextCharts }, 'En cours');
        setIsModalOpen(false);
        setCurrentChartConfig({ id: null, type: 'Histogramme', x: '', y: '', mesure: '', mesure_ar: '', mesure_en: '', filter_column: '', filter_value: '', filter_mode: 'include', filters: [], visible_filters: [], title: '', title_ar: '', title_en: '', x_label: '', y_label: '', group_by: '' });
        return;
      }

      if (currentChartConfig.id) {
        // Update existing chart
        const res = await axios.put(`${API_BASE}/sousthemes/${selectedSubTheme.id}/charts/${currentChartConfig.id}/`, {
          type: currentChartConfig.type,
          x: currentChartConfig.x,
          y: currentChartConfig.y,
          mesure: currentChartConfig.mesure,
          filter_column: currentChartConfig.filter_column,
          filter_value: currentChartConfig.filter_value,
          filter_mode: currentChartConfig.filter_mode,
          filters: currentChartConfig.filters || [],
          visible_filters: currentChartConfig.visible_filters || [],
          title: currentChartConfig.title || '',
          title_ar: currentChartConfig.title_ar || '',
          title_en: currentChartConfig.title_en || '',
          x_label: currentChartConfig.x_label || '',
          y_label: currentChartConfig.y_label || '',
          group_by: currentChartConfig.group_by || '',
          mesure_ar: currentChartConfig.mesure_ar || '',
          mesure_en: currentChartConfig.mesure_en || '',
        });
        const updated = res.data;
        setSavedCharts(prev => prev.map(c => c.id === updated.id ? updated : c));
      } else {
        // Create new chart
        const res = await axios.post(`${API_BASE}/sousthemes/${selectedSubTheme.id}/charts/`, {
          type: currentChartConfig.type,
          x: currentChartConfig.x,
          y: currentChartConfig.y,
          mesure: currentChartConfig.mesure,
          filter_column: currentChartConfig.filter_column,
          filter_value: currentChartConfig.filter_value,
          filter_mode: currentChartConfig.filter_mode,
          filters: currentChartConfig.filters || [],
          visible_filters: currentChartConfig.visible_filters || [],
          title: currentChartConfig.title || '',
          title_ar: currentChartConfig.title_ar || '',
          title_en: currentChartConfig.title_en || '',
          x_label: currentChartConfig.x_label || '',
          y_label: currentChartConfig.y_label || '',
          group_by: currentChartConfig.group_by || '',
          mesure_ar: currentChartConfig.mesure_ar || '',
          mesure_en: currentChartConfig.mesure_en || '',
        });
        const created = res.data;
        setSavedCharts(prev => [...prev, created]);
      }

      // Refresh selected subtheme in state (so charts_config matches)
      const themesRes = await axios.get(themesApiBase);
      const freshTheme = themesRes.data.find(t => t.id === selectedTheme.id);
      const freshSubTheme = freshTheme.sous_themes.find(sub => sub.id === selectedSubTheme.id);
      selectSubTheme(freshSubTheme);
      setSavedCharts(freshSubTheme.charts_config || []);

      setIsModalOpen(false);
      setCurrentChartConfig({ id: null, type: 'Histogramme', x: '', y: '', mesure: '', mesure_ar: '', mesure_en: '', filter_column: '', filter_value: '', filter_mode: 'include', filters: [], visible_filters: [], title: '', title_ar: '', title_en: '', x_label: '', y_label: '', group_by: '' });
    } catch (err) {
      console.error('Erreur en sauvegarde du graphique', err);
      alert('Erreur lors de la sauvegarde du graphique');
    }
  };

  const openEditModal = (chart) => {
    setCurrentChartConfig({ filter_column: '', filter_value: '', filter_mode: 'include', filters: [], ...chart });
    setIsModalOpen(true);
  };

  const deleteChart = async (id) => {
    showConfirm('Supprimer ce graphique ?', async () => {
      try {
        if (isSaisisseur) {
          const nextCharts = (savedCharts || []).filter((chart) => chart.id !== id);
          setSavedCharts(nextCharts);
          await saveDraftAssignmentForSaisisseur({ charts: nextCharts }, 'En cours');
          return;
        }

        await axios.delete(`${API_BASE}/sousthemes/${selectedSubTheme.id}/charts/${id}/`);
        setSavedCharts(prev => prev.filter(c => c.id !== id));
        // refresh subtheme
        const themesRes = await axios.get(themesApiBase);
        const freshTheme = themesRes.data.find(t => t.id === selectedTheme.id);
        const freshSubTheme = freshTheme.sous_themes.find(sub => sub.id === selectedSubTheme.id);
        selectSubTheme(freshSubTheme);
      } catch (err) {
        console.error('Erreur suppression graphique', err);
        alert('Erreur lors de la suppression');
      }
    });
  };

  // Toggle publication status for a sous-thème
  const toggleCategoriePublication = async (categorieId, newVisibility) => {
    try {
      // Call toggle-visibility action to cascade to sous-thèmes
      await axios.post(`${API_BASE}/categories/${categorieId}/toggle-visibility/`, { is_visible: newVisibility });
      // Refresh themes and update selectedCategorie
      const res = await axios.get(themesApiBase);
      setThemes(res.data);
      if (selectedTheme) {
        const freshTheme = res.data.find(t => t.id === selectedTheme.id);
        if (freshTheme) setSelectedTheme(freshTheme);
        // Update selectedCategorie if present
        if (selectedCategorie && freshTheme) {
          const freshCat = freshTheme.categories?.find(c => c.id === selectedCategorie.id);
          if (freshCat) setSelectedCategorie(freshCat);
        }
      }
      showToast(`Visibilité de la catégorie mise à jour: ${newVisibility ? 'Public' : 'Privé'}`, 'success');
    } catch (err) {
      console.error('Erreur changement statut categorie', err);
      showToast('Erreur lors du changement de statut de la catégorie', 'error');
    }
  };

  const toggleSubThemePublication = async (subThemeId, newVisibility) => {
    try {
      await axios.patch(`${API_BASE}/sousthemes/${subThemeId}/`, { is_visible: newVisibility });
      // refresh themes and update selectedTheme/selectedSubTheme
      const res = await axios.get(themesApiBase);
      setThemes(res.data);
      if (selectedTheme) {
        const freshTheme = res.data.find(t => t.id === selectedTheme.id);
        if (freshTheme) setSelectedTheme(freshTheme);
        const freshSubTheme = freshTheme && freshTheme.sous_themes ? freshTheme.sous_themes.find(sub => sub.id === subThemeId) : null;
        if (freshSubTheme) selectSubTheme(freshSubTheme);
        // Update selectedCategorie if present
        if (selectedCategorie && freshTheme) {
          const freshCat = freshTheme.categories?.find(c => c.id === selectedCategorie.id);
          if (freshCat) setSelectedCategorie(freshCat);
        }
      }
    } catch (err) {
      console.error('Erreur changement statut sous-theme', err);
      alert('Erreur lors du changement de statut');
    }
  };

  const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const makeThemeImageBackgroundTransparent = async (inputFile) => {
    if (!inputFile) return inputFile;

    const dataUrl = await fileToDataUrl(inputFile);
    const processedBlob = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas non disponible'));
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        const width = canvas.width;
        const height = canvas.height;

        const isNearWhitePixel = (pixelIndex) => {
          const r = pixels[pixelIndex];
          const g = pixels[pixelIndex + 1];
          const b = pixels[pixelIndex + 2];
          const a = pixels[pixelIndex + 3];
          if (a === 0) return false;
          const maxRGB = Math.max(r, g, b);
          const minRGB = Math.min(r, g, b);
          const isNearWhite = maxRGB >= 245 && minRGB >= 225;
          const lowSaturation = (maxRGB - minRGB) <= 22;
          return isNearWhite && lowSaturation;
        };

        // Only remove background-like white linked to image borders.
        // This preserves light details/colors inside the icon itself.
        const visited = new Uint8Array(width * height);
        const queueX = [];
        const queueY = [];
        let head = 0;

        const tryEnqueue = (x, y) => {
          if (x < 0 || y < 0 || x >= width || y >= height) return;
          const pos = y * width + x;
          if (visited[pos]) return;
          const pixelIndex = pos * 4;
          if (!isNearWhitePixel(pixelIndex)) return;
          visited[pos] = 1;
          queueX.push(x);
          queueY.push(y);
        };

        for (let x = 0; x < width; x += 1) {
          tryEnqueue(x, 0);
          tryEnqueue(x, height - 1);
        }
        for (let y = 0; y < height; y += 1) {
          tryEnqueue(0, y);
          tryEnqueue(width - 1, y);
        }

        while (head < queueX.length) {
          const x = queueX[head];
          const y = queueY[head];
          head += 1;

          const pixelIndex = (y * width + x) * 4;
          pixels[pixelIndex + 3] = 0;

          tryEnqueue(x + 1, y);
          tryEnqueue(x - 1, y);
          tryEnqueue(x, y + 1);
          tryEnqueue(x, y - 1);
        }

        ctx.putImageData(imageData, 0, 0);
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Erreur génération image'));
            return;
          }
          resolve(blob);
        }, 'image/png');
      };
      img.onerror = reject;
      img.src = dataUrl;
    });

    return new File(
      [processedBlob],
      (inputFile.name || 'theme-image').replace(/\.[^.]+$/, '') + '-clean.png',
      { type: 'image/png' }
    );
  };

  const updateThemeImage = async (themeId, imageFile) => {
    if (!themeId || !imageFile) return;
    try {
      const cleanedImage = await makeThemeImageBackgroundTransparent(imageFile);
      const dataUrl = await fileToDataUrl(cleanedImage);
      await axios.patch(`${API_BASE}/themes/${themeId}/`, { theme_image: dataUrl });

      const res = await axios.get(themesApiBase);
      setThemes(res.data);
      if (selectedTheme && selectedTheme.id === themeId) {
        const freshTheme = res.data.find(t => t.id === themeId);
        if (freshTheme) setSelectedTheme(freshTheme);
      }
      showToast('Image du thème mise à jour', 'success');
    } catch (err) {
      console.error('Erreur mise à jour image thème', err);
      alert('Erreur lors de la mise à jour de l\'image du thème');
    }
  };

  const pickAndUpdateThemeImage = (themeId) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
      if (!f) return;
      await updateThemeImage(themeId, f);
    };
    input.click();
  };

  const removeThemeImage = async (themeId) => {
    if (!themeId) return;
    showConfirm('Supprimer l\'image de ce thème ?', async () => {
      try {
        await axios.patch(`${API_BASE}/themes/${themeId}/`, { theme_image: null });

        const res = await axios.get(themesApiBase);
        setThemes(res.data);
        if (selectedTheme && selectedTheme.id === themeId) {
          const freshTheme = res.data.find(t => t.id === themeId);
          if (freshTheme) setSelectedTheme(freshTheme);
        }
        showToast('Image du thème supprimée', 'success');
      } catch (err) {
        console.error('Erreur suppression image thème', err);
        alert('Erreur lors de la suppression de l\'image du thème');
      }
    });
  };

  const goToTable = () => {
    const cleanedThemeTitle = String(themeData.titre || '').trim().replace(/\s+/g, ' ');
    if (!cleanedThemeTitle) {
      alert('Le titre du thème est requis');
      return;
    }
    if (hasDuplicateThemeName(cleanedThemeTitle)) {
      alert('Ce thème existe déjà. Choisissez un autre nom.');
      return;
    }

    if (useCategories) {
      const seenCategories = new Set();
      for (const cat of categoryNames || []) {
        const cleanedCategory = String(cat?.nom || '').trim().replace(/\s+/g, ' ');
        if (!cleanedCategory) continue;
        const normalized = normalizeEntityName(cleanedCategory);
        if (seenCategories.has(normalized)) {
          alert(`Doublon détecté dans les catégories: "${cleanedCategory}"`);
          return;
        }
        seenCategories.add(normalized);
      }
    }

    const seenSubThemes = new Set();
    for (const row of rows || []) {
      const cleanedSubTheme = String(row?.sousTheme || '').trim().replace(/\s+/g, ' ');
      if (!cleanedSubTheme) continue;
      const normalized = normalizeEntityName(cleanedSubTheme);
      if (seenSubThemes.has(normalized)) {
        alert(`Doublon détecté dans le formulaire: "${cleanedSubTheme}"`);
        return;
      }
      seenSubThemes.add(normalized);
    }

    setThemeData(prev => ({ ...prev, titre: cleanedThemeTitle }));
    let initialRows = [];
    
    if (useCategories) {
      // Générer les lignes pour chaque catégorie
      categoryNames.forEach((cat, catIndex) => {
        if (cat.nom.trim()) {
          for (let i = 0; i < cat.nbSousThemes; i++) {
            initialRows.push({
              sousTheme: '', 
              sousTheme_ar: '',
                  sousTheme_en: '',
              unite: '', 
              definition: '', 
              indicateur: '', 
              source: '', 
              periodicite: '', 
              file: null,
              categorieIndex: catIndex
            });
          }
        }
      });
    } else {
      // Mode sans catégories (ancien comportement)
      initialRows = Array.from({ length: themeData.nbSousThemes }, () => ({
        sousTheme: '', 
        sousTheme_ar: '',
        sousTheme_en: '',
        unite: '', 
        definition: '', 
        indicateur: '', 
        source: '', 
        periodicite: '', 
        file: null,
        categorieIndex: 0
      }));
    }
    
    // Préserver les données saisies si la structure n'a pas changé
    if (rows.length === initialRows.length) {
      // Garder les lignes existantes (l'utilisateur revient en arrière)
    } else if (rows.length < initialRows.length) {
      // Ajouter les nouvelles lignes manquantes en préservant les existantes
      const merged = [...rows];
      for (let i = rows.length; i < initialRows.length; i++) {
        merged.push(initialRows[i]);
      }
      setRows(merged);
    } else {
      // Réduire le nombre de lignes
      setRows(rows.slice(0, initialRows.length));
    }
    // Si rows est vide (première ouverture), initialiser
    if (rows.length === 0) {
      setRows(initialRows);
    }
    setFormStep(2);
  };

  const handleFinalSubmit = async () => {
    const cleanedThemeTitle = String(themeData.titre || '').trim().replace(/\s+/g, ' ');
    if (!cleanedThemeTitle) {
      alert('Le titre du thème est requis');
      return;
    }
    if (hasDuplicateThemeName(cleanedThemeTitle)) {
      alert('Ce thème existe déjà. Choisissez un autre nom.');
      return;
    }

    if (useCategories) {
      const seenCategories = new Set();
      for (const cat of categoryNames || []) {
        const cleanedCategory = String(cat?.nom || '').trim().replace(/\s+/g, ' ');
        if (!cleanedCategory) continue;
        const normalized = normalizeEntityName(cleanedCategory);
        if (seenCategories.has(normalized)) {
          alert(`Doublon détecté dans les catégories: "${cleanedCategory}"`);
          return;
        }
        seenCategories.add(normalized);
      }
    }

    // Valider que tous les sous-thèmes ont un nom
    for (let i = 0; i < (rows || []).length; i++) {
      const cleanedSubTheme = String(rows[i]?.sousTheme || '').trim().replace(/\s+/g, ' ');
      if (!cleanedSubTheme) {
        alert(`Le nom du sous-thème est requis (ligne ${i + 1})`);
        return;
      }
    }

    const seenSubThemes = new Set();
    for (const row of rows || []) {
      const cleanedSubTheme = String(row?.sousTheme || '').trim().replace(/\s+/g, ' ');
      if (!cleanedSubTheme) continue;
      const normalized = normalizeEntityName(cleanedSubTheme);
      if (seenSubThemes.has(normalized)) {
        alert(`Doublon détecté dans les sous-thèmes: "${cleanedSubTheme}"`);
        return;
      }
      seenSubThemes.add(normalized);
    }

    const formData = new FormData();
    formData.append('titre', cleanedThemeTitle);
    formData.append('titre_ar', String(themeData.titre_ar || '').trim());
    formData.append('titre_en', String(themeData.titre_en || '').trim());
    formData.append('statut', themeData.statut);
    if (themeImageFile) formData.append('theme_image', themeImageFile);
    
    // Si on utilise des catégories, envoyer leur configuration
    if (useCategories) {
      formData.append('use_categories', 'true');
      categoryNames.filter(c => c.nom.trim()).forEach((cat, idx) => {
        formData.append(`categories[${idx}][nom]`, cat.nom);
        formData.append(`categories[${idx}][nom_ar]`, String(cat.nom_ar || '').trim());
        formData.append(`categories[${idx}][nom_en]`, String(cat.nom_en || '').trim());
        formData.append(`categories[${idx}][ordre]`, idx);
      });
    }
    
    rows.forEach((row, i) => {
      const cleanedSubTheme = String(row.sousTheme || '').trim().replace(/\s+/g, ' ');
      formData.append(`lignes[${i}][sousTheme]`, cleanedSubTheme);
      formData.append(`lignes[${i}][sousTheme_ar]`, String(row.sousTheme_ar || '').trim());
      formData.append(`lignes[${i}][sousTheme_en]`, String(row.sousTheme_en || '').trim());
      formData.append(`lignes[${i}][unite]`, row.unite);
      formData.append(`lignes[${i}][indicateur]`, row.indicateur);
      formData.append(`lignes[${i}][definition]`, row.definition);
      formData.append(`lignes[${i}][source]`, row.source);
      formData.append(`lignes[${i}][periodicite]`, row.periodicite);
      // Si on utilise des catégories, ajouter l'index de catégorie
      if (useCategories && row.categorieIndex !== undefined) {
        formData.append(`lignes[${i}][categorieIndex]`, row.categorieIndex);
      }
      if (row.file) formData.append(`lignes[${i}][file]`, row.file);
    });

    try {
      const res = await axios.post(`${API_BASE}/themes/enregistrer_complet/`, formData);
      const newTheme = res.data && res.data.theme;
      if (newTheme) {
        setThemes(prev => [...prev, newTheme]);
      } else {
        fetchThemes();
      }
      alert("Enregistré !");
      setFormStep(0);
      setUseCategories(false);
      setCategoryNames([{ nom: '', nom_ar: '', nom_en: '', nbSousThemes: 1 }]);
      setThemeImageFile(null);
      setThemeImagePreview('');
      setThemeData({ titre: '', titre_ar: '', titre_en: '', nbSousThemes: 1, statut: 'Public' });
      setRows([]);
    } catch (err) { console.error(err.response?.data || err); alert("Erreur : " + (err.response?.data?.error || err.message)); }
  };

  const saveThemeMeta = async () => {
    if (!selectedTheme) return alert('Aucun thème sélectionné');
    try {
      await axios.patch(`${API_BASE}/themes/${selectedTheme.id}/`, themeMeta);
      alert('Métadonnées sauvegardées');
      setShowThemeMeta(false);
      // refresh themes and selectedTheme
      const res = await axios.get(themesApiBase);
      setThemes(res.data);
      const fresh = res.data.find(t => t.id === selectedTheme.id);
      setSelectedTheme(fresh);
    } catch (err) {
      console.error('Erreur sauvegarde métadonnées', err);
      alert('Erreur lors de la sauvegarde des métadonnées');
    }
  };

  const saveSubThemeMeta = async () => {
    if (!selectedSubTheme) return alert('Aucun sous-thème sélectionné');
    try {
      if (isSaisisseur) {
        await saveDraftAssignmentForSaisisseur({ meta: subThemeMeta }, 'En cours');
        alert('Brouillon des métadonnées enregistré');
        setShowSubThemeMeta(false);
        return;
      }

      await axios.patch(`${API_BASE}/sousthemes/${selectedSubTheme.id}/`, subThemeMeta);
      alert('Métadonnées du sous-thème sauvegardées');
      setShowSubThemeMeta(false);
      // refresh themes and selectedTheme + selectedSubTheme
      const res = await axios.get(themesApiBase);
      setThemes(res.data);
      const freshTheme = res.data.find(t => t.id === selectedTheme?.id);
      if (freshTheme) setSelectedTheme(freshTheme);
      const freshSub = freshTheme?.sous_themes?.find(st => st.id === selectedSubTheme.id);
      if (freshSub) selectSubTheme(freshSub);
    } catch (err) {
      console.error('Erreur sauvegarde métadonnées sous-thème', err);
      alert('Erreur lors de la sauvegarde des métadonnées du sous-thème');
    }
  };

  const maxId = themes.length > 0 ? Math.max(...themes.map(t => t.id)) : 0;
  // Tant que l'interface visiteurs n'est pas développée, l'admin voit tout même dans l'onglet "Thèmes"
  const visibleThemes = isAuthenticated ? themes : themes.filter(t => !t.archived);
  const findSubThemeInTheme = (theme, subThemeId) => {
    if (!theme) return null;
    return (
      (theme.sous_themes || []).find(sub => sub.id === subThemeId) ||
      (theme.categories || []).flatMap(cat => cat.sous_themes || []).find(sub => sub.id === subThemeId) ||
      null
    );
  };
  const assignedSubThemeIdSet = React.useMemo(() => {
    return new Set(
      (saisisseurAssignments || [])
        .filter((a) => a && a.sous_theme && a.assignment_archived !== true)
        .map((a) => String(a.sous_theme))
    );
  }, [saisisseurAssignments]);

  const assignedThemeIdSet = React.useMemo(() => {
    return new Set(
      (saisisseurAssignments || [])
        .filter((a) => a && a.theme && a.assignment_archived !== true)
        .map((a) => String(a.theme))
    );
  }, [saisisseurAssignments]);

  const isSubThemeVisibleForCurrentRole = (subTheme) => {
    if (!isSaisisseur) return true;
    if (!subTheme?.id) return false;
    return assignedSubThemeIdSet.has(String(subTheme.id));
  };

  const isThemeVisibleForCurrentRole = (theme) => {
    if (!isSaisisseur) return true;
    if (assignedThemeIdSet.has(String(theme?.id))) return true;

    const allSubThemes = [
      ...(theme.sous_themes || []),
      ...(theme.categories || []).flatMap(cat => cat.sous_themes || [])
    ];
    if (allSubThemes.some(st => assignedSubThemeIdSet.has(String(st.id)))) return true;

    const themeTitle = String(theme?.titre || '').trim().toLowerCase();
    if (!themeTitle) return false;
    return (saisisseurAssignments || []).some(
      (a) => a && a.assignment_archived !== true && String(a.theme_titre || '').trim().toLowerCase() === themeTitle
    );
  };
  const indicatorsSubThemes = themes.flatMap(theme => {
    const directSubThemes = (theme.sous_themes || []).map(st => ({
      ...st,
      theme_titre: theme.titre,
      theme_titre_ar: theme.titre_ar,
      theme_id: theme.id
    }));
    const categorySubThemes = (theme.categories || []).flatMap(cat =>
      (cat.sous_themes || []).map(st => ({
        ...st,
        theme_titre: theme.titre,
        theme_titre_ar: theme.titre_ar,
        theme_id: theme.id,
        categorie_nom: cat.nom,
        categorie_nom_ar: cat.nom_ar
      }))
    );

    const byId = new Map();
    [...directSubThemes, ...categorySubThemes].forEach(st => {
      if (!byId.has(st.id)) byId.set(st.id, st);
    });
    return Array.from(byId.values());
  }).filter(st => isSubThemeVisibleForCurrentRole(st));

  const sidebarIdentity = React.useMemo(() => {
    if (!isAuthenticated || isVisitor) return null;

    let context = authContext || '';
    if (pathHasAdmin) context = 'admin';
    if (isSaisisseurRoute) context = 'saisisseur';

    const username = context === 'admin'
      ? (getAuthStorageItem('username_admin') || getAuthStorageItem('username'))
      : context === 'saisisseur'
        ? (getAuthStorageItem('username_saisisseur') || getAuthStorageItem('username'))
        : getAuthStorageItem('username');
    const firstName = context === 'admin'
      ? (getAuthStorageItem('first_name_admin') || getAuthStorageItem('first_name'))
      : context === 'saisisseur'
        ? (getAuthStorageItem('first_name_saisisseur') || getAuthStorageItem('first_name'))
        : getAuthStorageItem('first_name');
    const email = context === 'admin'
      ? (getAuthStorageItem('user_email_admin') || getAuthStorageItem('user_email'))
      : context === 'saisisseur'
        ? (getAuthStorageItem('user_email_saisisseur') || getAuthStorageItem('user_email'))
        : getAuthStorageItem('user_email');
    const role = context === 'admin'
      ? (getAuthStorageItem('user_role_admin') || getAuthStorageItem('user_role') || 'ADMIN')
      : context === 'saisisseur'
        ? (getAuthStorageItem('user_role_saisisseur') || getAuthStorageItem('user_role') || 'SAISISSEUR')
        : (getAuthStorageItem('user_role') || userRole || 'UTILISATEUR');

    const normalizeDisplayName = (value) => {
      const raw = String(value || '').trim();
      if (!raw) return '';
      return raw
        .replace(/[._-]+/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
        .join(' ');
    };

    const prettyUsername = normalizeDisplayName(String(username || '').trim() || String(email || '').split('@')[0]);
    const displayName = String(firstName || '').trim() || prettyUsername || String(email || '').trim() || 'Utilisateur';
    const initialSource = displayName.includes('@') ? displayName.split('@')[0] : displayName;
    const chunks = initialSource.split(/\s+/).filter(Boolean);
    const initials = chunks.length > 1
      ? `${chunks[0][0] || ''}${chunks[1][0] || ''}`
      : String(initialSource).slice(0, 2);

    return {
      displayName,
      email: String(email || '').trim(),
      roleLabel: role === 'ADMIN' ? 'Administrateur' : role === 'SAISISSEUR' ? 'Saisisseur' : String(role || 'Utilisateur'),
      initials: String(initials || 'U').toUpperCase(),
    };
  }, [authContext, isAuthenticated, isSaisisseurRoute, isVisitor, pathHasAdmin, userRole]);
  const headerProfileMenuRef = React.useRef(null);

  useEffect(() => {
    if (!showHeaderProfileMenu) return;
    const handleOutside = (event) => {
      if (headerProfileMenuRef.current && !headerProfileMenuRef.current.contains(event.target)) {
        setShowHeaderProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showHeaderProfileMenu]);

  // Affiche le loading ou la page de login/admin
  if (authLoading) {
    return <div className="flex min-h-screen bg-[#f4f1e1] justify-center items-center"><p className="text-xl font-bold">Chargement...</p></div>;
  }

  // If user is not authenticated on a saisisseur route, always show saisisseur login.
  if (!isAuthenticated && pathHasSaisisseur) {
    return <LoginPage onLoginSuccess={handleLogin} loginMode={'saisisseur'} />;
  }

  // If user is not authenticated on an admin route, always show admin login.
  if (!isAuthenticated && pathHasAdmin) {
    return <LoginPage onLoginSuccess={handleLogin} loginMode={'admin'} />;
  }

  if (!isAuthenticated && !isVisitor) {
    try {
      if (!pathname.includes('.')) {
        window.location.replace('/admin/login');
        return null;
      }
    } catch {
      // Ignore URL parsing errors.
    }

    return <LoginPage onLoginSuccess={handleLogin} loginMode={'admin'} />;
  }

  // --- RENDU PRINCIPAL (Admin) ---
  return (
    <div className="app-shell flex h-screen bg-[var(--color-bg)] text-[var(--color-text-main)] overflow-hidden">
      
      {/* 1. MENU LATÉRAL */}
      <div className="w-64 h-screen shrink-0 sticky top-0 bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col shadow-sm overflow-y-auto">
        <div className="p-4 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex flex-col items-center min-h-[210px]">
          <img src={logoMain} alt="Logo HCP" className="w-full h-full object-contain" />
        </div>
        <div className="bg-[#f9fafb] text-[var(--color-text-main)] py-2 px-4 font-semibold text-center border-b border-[var(--color-border)]">{t('menu')}</div>
        <div>
          <SidebarButton label={t('nav_themes')} iconType="themes" centered={isVisitor} active={activeMenu === 'Themes'} onClick={() => {setActiveMenu('Themes'); setFormStep(0);}} />
          <SidebarButton label={t('nav_indicators')} iconType="indicators" centered={isVisitor} active={activeMenu === 'Indicateurs'} onClick={() => setActiveMenu('Indicateurs')} />
          <SidebarButton label={t('nav_about')} iconType="about" centered={isVisitor} active={activeMenu === 'APropos'} onClick={() => { setActiveMenu('APropos'); setFormStep(0); }} />
          <SidebarButton label={t('nav_contact')} iconType="contact" centered={isVisitor} active={activeMenu === 'Contact'} onClick={() => { setActiveMenu('Contact'); setFormStep(0); }} />
          <SidebarButton label={t('nav_links')} iconType="links" centered={isVisitor} active={activeMenu === 'LiensUtiles'} onClick={() => { setActiveMenu('LiensUtiles'); setFormStep(0); }} />
          {canEdit && (
            <SidebarButton
              label={isSaisisseur ? t('nav_saisisseur') : t('nav_admin')}
              iconType={isSaisisseur ? 'saisisseur' : 'admin'}
              centered={isVisitor}
              active={activeMenu === (isSaisisseur ? 'Saisisseur' : 'Admin')}
              onClick={() => { setActiveMenu(isSaisisseur ? 'Saisisseur' : 'Admin'); setFormStep(0); setSelectedTheme(null); setSelectedSubTheme(null); }}
            />
          )}
        </div>
        {canEdit && (
          <div className="mt-auto p-3 border-t border-[var(--color-border)] bg-[linear-gradient(180deg,#f8efdf_0%,#f4e4c7_100%)] space-y-2">
            <button
              onClick={() => {
                const auth = resolveCurrentAuthStorage();
                setSettingsForm({ firstName: auth.firstName || '', email: auth.email || '', newPassword: '', confirmPassword: '' });
                setSettingsError('');
                setShowSettings(true);
              }}
              className="group w-full flex items-center gap-3 rounded-2xl border border-[#d6b58b] bg-[linear-gradient(135deg,#fffdf8_0%,#f8ecda_100%)] px-4 py-3 text-left text-[#6E001F] font-semibold shadow-[0_8px_20px_rgba(122,10,74,0.08)] transition-all hover:-translate-y-[1px] hover:border-[#B03372] hover:shadow-[0_14px_24px_rgba(122,10,74,0.16)]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e4bfd0] bg-[linear-gradient(135deg,#f9e3ee_0%,#f2cadc_100%)] text-[#7A0A4A] shrink-0 transition-transform group-hover:scale-105">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="3.2" />
                  <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.9 1.9 0 0 1 0 2.7 1.9 1.9 0 0 1-2.7 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 0 1-4 0v-.2a1 1 0 0 0-.7-.9 1 1 0 0 0-1.1.2l-.1.1a1.9 1.9 0 0 1-2.7 0 1.9 1.9 0 0 1 0-2.7l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 0 1 0-4h.2a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1.1l-.1-.1a1.9 1.9 0 0 1 0-2.7 1.9 1.9 0 0 1 2.7 0l.1.1a1 1 0 0 0 1.1.2H9a1 1 0 0 0 .6-.9V4a2 2 0 0 1 4 0v.2a1 1 0 0 0 .7.9 1 1 0 0 0 1.1-.2l.1-.1a1.9 1.9 0 0 1 2.7 0 1.9 1.9 0 0 1 0 2.7l-.1.1a1 1 0 0 0-.2 1.1V9c0 .4.2.8.6.9H20a2 2 0 0 1 0 4h-.2a1 1 0 0 0-.9.7Z" />
                </svg>
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm uppercase tracking-wide">{t('settings')}</span>
                <span className="block text-xs text-[#8A5A72] normal-case">Compte et securite</span>
              </span>
              <span className="text-[#9c4d78] transition-transform group-hover:translate-x-0.5">
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 10h12" />
                  <path d="m11 5 5 5-5 5" />
                </svg>
              </span>
            </button>
            <button
              onClick={handleLogout}
              className="group w-full flex items-center gap-3 rounded-2xl border border-[#d9b2b6] bg-[linear-gradient(135deg,#fff8f8_0%,#f9e4e6_100%)] px-4 py-3 text-left text-[#7A0A4A] font-semibold shadow-[0_8px_20px_rgba(122,10,74,0.08)] transition-all hover:-translate-y-[1px] hover:border-[#B03372] hover:shadow-[0_14px_24px_rgba(122,10,74,0.16)]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e7c7cf] bg-[linear-gradient(135deg,#fbe6ea_0%,#f4cfd8_100%)] text-[#7A0A4A] shrink-0 transition-transform group-hover:scale-105">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="M16 17l5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm uppercase tracking-wide">{t('logout')}</span>
                <span className="block text-xs text-[#8A5A72] normal-case">Fermer la session</span>
              </span>
              <span className="text-[#9c4d78] transition-transform group-hover:translate-x-0.5">
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 10h12" />
                  <path d="m11 5 5 5-5 5" />
                </svg>
              </span>
            </button>
          </div>
        )}
      </div>

      {/* 2. CONTENU PRINCIPAL */}
      <div className="flex-1 min-w-0 h-screen flex flex-col overflow-hidden">
        <div className={`bg-[var(--color-primary)] px-4 md:px-6 py-3 border-b border-[#9b2b64] flex items-center gap-3 shadow-[0_6px_18px_rgba(17,24,39,0.14)] relative min-w-0 ${isVisitor ? 'min-h-[64px]' : ''}`}>
          <h1 className={`text-white font-bold text-center tracking-wide leading-tight ${isVisitor ? 'text-[18px] md:text-[24px] w-full px-8 md:px-0 md:absolute md:left-1/2 md:-translate-x-1/2 md:w-[min(62vw,820px)] pointer-events-none break-words' : 'text-[24px] md:text-[32px] flex-1 min-w-0 break-words'}`}>
            {i18n.language === 'ar'
              ? 'قاعدة المعطيات الجهوية لبني ملال-خنيفرة'
              : i18n.language === 'en'
                ? 'Regional Data Platform - Beni Mellal-Khenifra'
                : 'Base de Données Région Béni Mellal-Khénifra'}
          </h1>
          {/* Header search + language selector */}
          {(isVisitor || pathHasAdmin || isSaisisseurRoute) && (
            <div className="flex items-center gap-2 shrink-0 min-w-0" style={{zIndex: 200}}>
              {isVisitor && enableVisitorHeaderSearch && (
                <div
                  className="relative w-[150px] md:w-[210px]"
                  onFocus={() => setShowVisitorHeaderSearch(true)}
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget)) {
                      setShowVisitorHeaderSearch(false);
                    }
                  }}
                >
                  <input
                    type="text"
                    dir={isArabicVisitor ? 'rtl' : 'ltr'}
                    value={visitorHeaderSearch}
                    onChange={(e) => setVisitorHeaderSearch(e.target.value)}
                    placeholder={isArabicVisitor ? 'ابحث عن موضوع فرعي...' : 'Rechercher un sous-thème...'}
                    className={`w-full h-9 text-sm ${isArabicVisitor ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left'} bg-[#fffaf2] border border-[#B84C83] text-[#6B3150] rounded-md outline-none focus:border-[#7A0A4A]`}
                  />
                  <span className={`absolute ${isArabicVisitor ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-[#7A0A4A]`}>⌕</span>

                  {showVisitorHeaderSearch && headerSearchTerm && (
                    <div className={`absolute ${isArabicVisitor ? 'left-0' : 'right-0'} mt-1 w-full bg-[#fffaf2] border border-[#B84C83] rounded-md shadow-lg max-h-72 overflow-y-auto`}>
                      {visitorSubThemeSearchResults.length > 0 ? (
                        visitorSubThemeSearchResults.map((result) => {
                          const subLabel = i18n.language === 'ar'
                            ? (result.subNameAr || result.subNameFr || result.subNameEn)
                            : i18n.language === 'en'
                              ? (result.subNameEn || result.subNameFr || result.subNameAr)
                              : (result.subNameFr || result.subNameAr || result.subNameEn);
                          const themeLabel = i18n.language === 'ar'
                            ? (result.themeTitleAr || result.themeTitleFr || result.themeTitleEn)
                            : i18n.language === 'en'
                              ? (result.themeTitleEn || result.themeTitleFr || result.themeTitleAr)
                              : (result.themeTitleFr || result.themeTitleAr || result.themeTitleEn);
                          const catLabel = i18n.language === 'ar'
                            ? (result.catNameAr || result.catNameFr || result.catNameEn)
                            : i18n.language === 'en'
                              ? (result.catNameEn || result.catNameFr || result.catNameAr)
                              : (result.catNameFr || result.catNameAr || result.catNameEn);

                          return (
                            <button
                              key={`visitor-search-${result.subThemeId}`}
                              type="button"
                              onClick={() => openVisitorSubThemeFromHeader(result)}
                              className={`w-full px-3 py-2 border-b border-[#E7C8DA] last:border-b-0 hover:bg-[#f7e8cf] ${isArabicVisitor ? 'text-right' : 'text-left'}`}
                            >
                              <div className="font-semibold text-[#6E001F] truncate">{subLabel}</div>
                              <div className="text-xs text-[#7A0A4A] truncate">
                                {catLabel ? `${themeLabel} - ${catLabel}` : themeLabel}
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className={`px-3 py-2 text-sm text-[#7A0A4A] ${isArabicVisitor ? 'text-right' : 'text-left'}`}>
                          {isArabicVisitor ? 'لا توجد نتائج' : 'Aucun résultat'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="relative shrink-0">
                <LangSelector t={t} i18n={i18n} />
              </div>

              {sidebarIdentity && (
                <div className="relative shrink-0" ref={headerProfileMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowHeaderProfileMenu((prev) => !prev)}
                    className="h-9 w-9 bg-[#fffaf2] hover:bg-[#f6ebdb] text-[#6E001F] font-semibold rounded-md border border-[#B84C83] flex items-center justify-center"
                    title="Compte utilisateur"
                  >
                    <span className="text-[11px] font-bold tracking-wide">{sidebarIdentity.initials}</span>
                  </button>
                  {showHeaderProfileMenu && (
                    <div className={`absolute ${i18n.language === 'ar' ? 'left-0' : 'right-0'} mt-1 w-64 bg-[#fffaf2] border border-[#B84C83] rounded-md shadow-lg p-3`} style={{ zIndex: 9999 }}>
                      <div className="text-xs text-[#8A5A72]">Bonjour,</div>
                      <div className="text-sm font-bold text-[#6E001F] truncate">{sidebarIdentity.displayName}</div>
                      <div className="text-xs text-[#8A5A72] truncate mt-0.5">{sidebarIdentity.email || sidebarIdentity.roleLabel}</div>
                      <div className="mt-2 inline-flex items-center rounded-full border border-[#e4bfd0] bg-[#fff6fa] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#7A0A4A]">
                        {sidebarIdentity.roleLabel}
                      </div>
                      <div className="mt-3 pt-2 border-t border-[#ead0db] flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const auth = resolveCurrentAuthStorage();
                            setSettingsForm({ firstName: auth.firstName || '', email: auth.email || '', newPassword: '', confirmPassword: '' });
                            setSettingsError('');
                            setShowHeaderProfileMenu(false);
                            setShowSettings(true);
                          }}
                          className="flex-1 px-2 py-1.5 rounded-md border border-[#d8b6c8] bg-white text-[#7A0A4A] text-xs font-semibold hover:bg-[#f7eaf1]"
                        >
                          Parametres
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowHeaderProfileMenu(false);
                            handleLogout();
                          }}
                          className="flex-1 px-2 py-1.5 rounded-md border border-[#e2b6b6] bg-[#fff1f1] text-[#8b1d3f] text-xs font-semibold hover:bg-[#ffe3e3]"
                        >
                          Deconnexion
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>

        <div className="bg-[var(--color-primary)] px-3 md:px-4 py-2 border-b border-[#9b2b64]">
          <div className="w-full max-w-[1200px] mx-auto flex items-center gap-3 min-w-0">
          <span className="bg-[#a12863] text-white px-4 py-1 font-semibold rounded-xl shrink-0">{t('infos')}</span>
          {canEdit && userRole === 'ADMIN' && activeMenu === 'Admin' ? (
            <div className="flex-1 min-w-0 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] px-4 py-1.5 flex items-center justify-between gap-3">
              <span className="text-[var(--color-primary)] font-medium truncate">
                {sanitizeInfoItems(infoBannerItems).length} info(s) configuree(s)
              </span>
              <button
                type="button"
                onClick={() => setShowInfoBannerEditor(true)}
                className="px-4 py-1 rounded-xl font-semibold border bg-[#a12863] text-white border-[#d6619c] hover:bg-[#8f245e] shrink-0"
              >
                {t('manage_infos')}
              </button>
            </div>
          ) : (
            <div className="bg-[var(--color-surface)] text-[var(--color-primary)] px-4 py-1.5 flex-1 min-w-0 rounded-xl font-medium border border-[var(--color-border)] overflow-hidden">
              {(() => {
                const items = (infoBannerItems && infoBannerItems.length > 0)
                  ? infoBannerItems
                  : [{ text: infoBannerText, url: '' }];
                const duration = Math.max(12, items.length * 4);

                if (loadingInfoBanner && items.length === 0) {
                  return <div className="truncate opacity-70">Chargement des informations...</div>;
                }

                const renderTickerItem = (item, idx, copyIdx) => {
                  const localizedText = i18n.language === 'ar'
                    ? (item?.text_ar || item?.text || '')
                    : i18n.language === 'en'
                      ? (item?.text_en || item?.text || item?.text_ar || '')
                      : (item?.text || '');
                  const text = String(localizedText).trim();
                  const url = String(item?.url || '').trim();
                  if (!text) return null;

                  return (
                    <div className="infos-marquee-item" key={`info-${copyIdx}-${idx}`}>
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="infos-marquee-link"
                          title={url}
                        >
                          {text}
                        </a>
                      ) : (
                        <span className="infos-marquee-link">{text}</span>
                      )}
                    </div>
                  );
                };

                return (
                  <div className="infos-marquee" role="region" aria-label="Informations">
                    <div className="infos-marquee-track" style={{ animationDuration: `${duration}s` }}>
                      <div className="infos-marquee-group">
                        {items.map((item, idx) => renderTickerItem(item, idx, 1))}
                      </div>
                      <div className="infos-marquee-group" aria-hidden="true">
                        {items.map((item, idx) => renderTickerItem(item, idx, 2))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          </div>
        </div>

        {formStep !== 4 && activeMenu !== 'Admin' && activeMenu !== 'Saisisseur' && !isInfoMenu && (
          <div className={`px-3 md:px-4 bg-[#f4f5f7] border-b border-[var(--color-border)] max-w-[1200px] w-full mx-auto ${activeMenu === 'Themes' && formStep === 3 ? 'pt-4 pb-3 space-y-2' : 'pt-5 pb-4 space-y-3'}`}>
            {activeMenu === 'Themes' && formStep === 3 && selectedTheme && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setFormStep(0); setSelectedCategorie(null); setSelectedVisitorCategoryId('all'); }}
                  className="bg-[#7A0A4A] text-white w-14 h-11 rounded-xl border border-[#B03372] font-black hover:bg-[#5E0738] shadow-md flex items-center justify-center text-[32px] leading-none"
                  aria-label="Retour"
                  title="Retour"
                >
                  ‹
                </button>
                <h2 className="bg-[#7A0A4A] text-white px-7 py-2 rounded-xl border border-[#B03372] font-bold shadow-md uppercase tracking-wide text-[28px] md:text-[30px] leading-tight">
                  {selectedCategorie ? `${getThemeDisplayTitle(selectedTheme)} - ${getCategoryDisplayName(selectedCategorie)}` : `${getThemeDisplayTitle(selectedTheme)}`}
                </h2>
              </div>
            )}
            <div className="relative w-full">
              <input 
                type="text" 
                placeholder={
                  activeMenu === 'Themes' && formStep === 0 ? t('search_theme') : 
                  activeMenu === 'Indicateurs' ? t('search_indicator') :
                  formStep === 3 ? t('search_subtheme') : 
                  t('search_generic')
                } 
                className="w-full pl-12 pr-4 py-3 border border-[#9d9d9d] rounded-none bg-white text-[#545454] outline-none focus:border-[#B03372]"
                value={
                  activeMenu === 'Indicateurs' ? searchIndicateur :
                  formStep === 0 ? searchTheme : 
                  formStep === 3 ? searchSubTheme : 
                  ''
                }
                onChange={(e) => {
                  if (activeMenu === 'Indicateurs') setSearchIndicateur(e.target.value);
                  else if (formStep === 0) setSearchTheme(e.target.value);
                  else if (formStep === 3) setSearchSubTheme(e.target.value);
                }}
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-2xl text-gray-500">⌕</span>
            </div>
          </div>
        )}
        {formStep === 4 && <div className="h-5" />}

        <div className="px-8 pt-3 pb-10 flex-1 min-h-0 overflow-y-auto bg-white">
          
          {/* GRILLE DES INDICATEURS (TOUS LES SOUS-THأˆMES) */}
          {activeMenu === 'Indicateurs' && (
            <div className="relative min-h-[400px]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {indicatorsSubThemes.filter(st => 
                  getSubThemeDisplayName(st).toLowerCase().includes(searchIndicateur.toLowerCase()) ||
                  String((isVisitor && i18n.language === 'ar') ? (st.theme_titre_ar || st.theme_titre || '') : (st.theme_titre || '')).toLowerCase().includes(searchIndicateur.toLowerCase())
                ).map((st) => (
                  <div 
                    key={st.id} 
                    onClick={async () => {
                      try {
                        const res = await axios.get(themesApiBase);
                        const freshTheme = res.data.find(t => t.id === st.theme_id);
                        const freshSubTheme =
                          (freshTheme?.sous_themes || []).find(sub => sub.id === st.id) ||
                          (freshTheme?.categories || []).flatMap(cat => cat.sous_themes || []).find(sub => sub.id === st.id);
                        if (!freshTheme || !freshSubTheme) return;
                        setSelectedTheme(freshTheme);
                        selectSubTheme(freshSubTheme);
                        setSavedCharts(freshSubTheme.charts_config || []);
                        setActiveMenu('Themes');
                        setFormStep(4);
                        setShowAll(false);
                      } catch (err) { console.error(err); }
                    }}
                    className={`relative cursor-pointer p-4 rounded-sm border border-[#9A4A2A] shadow-md text-[#6E001F] font-bold hover:scale-[1.01] transition-transform min-h-[120px] ${st.archived ? 'bg-gray-600 line-through opacity-80 text-white' : 'bg-[#E6A76A]'}`}
                  >
                    {st.archived && (
                      <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded-full text-xs font-bold">🚫</div>
                    )}
                    <div className="text-xs opacity-80 mb-1 uppercase tracking-wide">{(isVisitor && i18n.language === 'ar') ? (st.theme_titre_ar || st.theme_titre) : st.theme_titre}</div>
                    <div className="text-[20px] leading-tight mt-1">{getSubThemeDisplayName(st)}</div>
                    {canEdit && (
                      <div className={`absolute bottom-3 right-3 w-5 h-5 rounded-full border border-black ${st.is_visible ? 'bg-green-400' : 'bg-red-500'}`}></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PAGE ADMINISTRATEURS / SAISISSEUR */}
          {!isVisitor && (activeMenu === 'Admin' || activeMenu === 'Saisisseur') && (
            <Suspense fallback={<div className="p-4 text-sm text-gray-600">Chargement de l'espace administrateur...</div>}>
              <AdministratorsPage isSaisisseur={isSaisisseur} />
            </Suspense>
          )}

          {activeMenu === 'APropos' && (
            <div className="w-full min-h-[calc(100vh-320px)] flex items-center justify-center px-2 md:px-6 py-6">
              <div className="w-full max-w-5xl bg-gradient-to-b from-[#fffdf8] to-white border-2 border-[#D6B978] rounded-2xl shadow-[0_14px_30px_rgba(16,78,116,0.16)] p-7 space-y-6">
                <h2 className="text-3xl md:text-4xl font-extrabold text-[#7A0A4A] border-b border-[#E7D2A1] pb-3 tracking-tight">
                  {i18n.language === 'ar'
                    ? (siteContent.about_title_ar || siteContent.about_title || t('about_default'))
                    : i18n.language === 'en'
                      ? (siteContent.about_title_en || siteContent.about_title || siteContent.about_title_ar || t('about_default'))
                      : (siteContent.about_title || t('about_default'))}
                </h2>
                {canEdit && userRole === 'ADMIN' ? (
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={siteContentDraft.about_title || ''}
                      onChange={(e) => setSiteContentDraft((prev) => ({ ...prev, about_title: e.target.value }))}
                      className="w-full p-3 border border-[#CCB47F] rounded-xl outline-none focus:border-[#7A0A4A]"
                      placeholder="Titre de la page A propos"
                    />
                    <textarea
                      value={siteContentDraft.about_text || ''}
                      onChange={(e) => setSiteContentDraft((prev) => ({ ...prev, about_text: e.target.value }))}
                      className="w-full min-h-[220px] p-3 border border-[#CCB47F] rounded-xl outline-none focus:border-[#7A0A4A]"
                      placeholder="Texte de presentation visible pour les visiteurs"
                    />
                    <input
                      type="text"
                      value={siteContentDraft.about_title_ar || ''}
                      onChange={(e) => setSiteContentDraft((prev) => ({ ...prev, about_title_ar: e.target.value }))}
                      className="w-full p-3 border border-[#CCB47F] rounded-xl outline-none focus:border-[#7A0A4A]"
                      placeholder="عنوان صفحة حول (عربي)"
                      dir="rtl"
                    />
                    <textarea
                      value={siteContentDraft.about_text_ar || ''}
                      onChange={(e) => setSiteContentDraft((prev) => ({ ...prev, about_text_ar: e.target.value }))}
                      className="w-full min-h-[220px] p-3 border border-[#CCB47F] rounded-xl outline-none focus:border-[#7A0A4A]"
                      placeholder="نص صفحة حول للزوار (عربي)"
                      dir="rtl"
                    />
                    <input
                      type="text"
                      value={siteContentDraft.about_title_en || ''}
                      onChange={(e) => setSiteContentDraft((prev) => ({ ...prev, about_title_en: e.target.value }))}
                      className="w-full p-3 border border-[#CCB47F] rounded-xl outline-none focus:border-[#7A0A4A]"
                      placeholder="About page title (English)"
                    />
                    <textarea
                      value={siteContentDraft.about_text_en || ''}
                      onChange={(e) => setSiteContentDraft((prev) => ({ ...prev, about_text_en: e.target.value }))}
                      className="w-full min-h-[220px] p-3 border border-[#CCB47F] rounded-xl outline-none focus:border-[#7A0A4A]"
                      placeholder="About page text for visitors (English)"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={saveSiteContent}
                        disabled={savingSiteContent}
                        className={`px-5 py-2 rounded-xl font-semibold border ${savingSiteContent ? 'bg-gray-300 text-gray-700 border-gray-400 cursor-not-allowed' : 'bg-[#7A0A4A] text-white border-[#B03372] hover:bg-[#5E0738]'}`}
                      >
                        {savingSiteContent ? t('saving') : t('save')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="leading-8 text-[#243447] whitespace-pre-wrap">
                    {i18n.language === 'ar'
                      ? (siteContent.about_text_ar || siteContent.about_text || t('about_coming_soon'))
                      : i18n.language === 'en'
                        ? (siteContent.about_text_en || siteContent.about_text || siteContent.about_text_ar || t('about_coming_soon'))
                        : (siteContent.about_text || t('about_coming_soon'))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeMenu === 'Contact' && (
            <div className="w-full min-h-[calc(100vh-320px)] flex items-center justify-center px-2 md:px-6 py-6">
              <div className="w-full max-w-5xl bg-gradient-to-b from-[#fffdf8] to-white border-2 border-[#D6B978] rounded-2xl shadow-[0_14px_30px_rgba(16,78,116,0.16)] p-7 space-y-6">
                <h2 className="text-3xl md:text-4xl font-extrabold text-[#7A0A4A] border-b border-[#E7D2A1] pb-3 tracking-tight">
                  {i18n.language === 'ar'
                    ? (siteContent.contact_title_ar || siteContent.contact_title || t('contact_default'))
                    : i18n.language === 'en'
                      ? (siteContent.contact_title_en || siteContent.contact_title || siteContent.contact_title_ar || t('contact_default'))
                      : (siteContent.contact_title || t('contact_default'))}
                </h2>
                {canEdit && userRole === 'ADMIN' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" value={siteContentDraft.contact_title || ''} onChange={(e) => setSiteContentDraft((prev) => ({ ...prev, contact_title: e.target.value }))} className="p-3 border border-[#CCB47F] rounded-xl outline-none focus:border-[#7A0A4A]" placeholder="Titre de la page Contact" />
                    <input type="text" value={siteContentDraft.contact_title_ar || ''} onChange={(e) => setSiteContentDraft((prev) => ({ ...prev, contact_title_ar: e.target.value }))} className="p-3 border border-[#CCB47F] rounded-xl outline-none focus:border-[#7A0A4A]" placeholder="عنوان صفحة اتصل بنا (عربي)" dir="rtl" />
                    <input type="text" value={siteContentDraft.contact_title_en || ''} onChange={(e) => setSiteContentDraft((prev) => ({ ...prev, contact_title_en: e.target.value }))} className="p-3 border border-[#CCB47F] rounded-xl outline-none focus:border-[#7A0A4A]" placeholder="Contact page title (English)" />
                    <input type="email" value={siteContentDraft.contact_email || ''} onChange={(e) => setSiteContentDraft((prev) => ({ ...prev, contact_email: e.target.value }))} className="p-3 border border-[#CCB47F] rounded-xl outline-none focus:border-[#7A0A4A]" placeholder="Email de contact" />
                    <input type="text" value={siteContentDraft.contact_phone || ''} onChange={(e) => setSiteContentDraft((prev) => ({ ...prev, contact_phone: e.target.value }))} className="p-3 border border-[#CCB47F] rounded-xl outline-none focus:border-[#7A0A4A]" placeholder="Telephone" />
                    <input type="text" value={siteContentDraft.contact_hours || ''} onChange={(e) => setSiteContentDraft((prev) => ({ ...prev, contact_hours: e.target.value }))} className="p-3 border border-[#CCB47F] rounded-xl outline-none focus:border-[#7A0A4A]" placeholder="Horaires" />
                    <input type="text" value={siteContentDraft.contact_hours_ar || ''} onChange={(e) => setSiteContentDraft((prev) => ({ ...prev, contact_hours_ar: e.target.value }))} className="p-3 border border-[#CCB47F] rounded-xl outline-none focus:border-[#7A0A4A]" placeholder="ساعات العمل (عربي)" dir="rtl" />
                    <input type="text" value={siteContentDraft.contact_hours_en || ''} onChange={(e) => setSiteContentDraft((prev) => ({ ...prev, contact_hours_en: e.target.value }))} className="p-3 border border-[#CCB47F] rounded-xl outline-none focus:border-[#7A0A4A]" placeholder="Working hours (English)" />
                    <textarea value={siteContentDraft.contact_address || ''} onChange={(e) => setSiteContentDraft((prev) => ({ ...prev, contact_address: e.target.value }))} className="md:col-span-2 min-h-[120px] p-3 border border-[#CCB47F] rounded-xl outline-none focus:border-[#7A0A4A]" placeholder="Adresse postale" />
                    <textarea value={siteContentDraft.contact_address_ar || ''} onChange={(e) => setSiteContentDraft((prev) => ({ ...prev, contact_address_ar: e.target.value }))} className="md:col-span-2 min-h-[120px] p-3 border border-[#CCB47F] rounded-xl outline-none focus:border-[#7A0A4A]" placeholder="العنوان البريدي (عربي)" dir="rtl" />
                    <textarea value={siteContentDraft.contact_address_en || ''} onChange={(e) => setSiteContentDraft((prev) => ({ ...prev, contact_address_en: e.target.value }))} className="md:col-span-2 min-h-[120px] p-3 border border-[#CCB47F] rounded-xl outline-none focus:border-[#7A0A4A]" placeholder="Postal address (English)" />
                    <div className="md:col-span-2 flex justify-end">
                      <button
                        onClick={saveSiteContent}
                        disabled={savingSiteContent}
                        className={`px-5 py-2 rounded-xl font-semibold border ${savingSiteContent ? 'bg-gray-300 text-gray-700 border-gray-400 cursor-not-allowed' : 'bg-[#7A0A4A] text-white border-[#B03372] hover:bg-[#5E0738]'}`}
                      >
                        {savingSiteContent ? t('saving') : t('save')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[#243447]">
                    <div className="bg-[#f8fafc] border border-[#d8e4ec] rounded-xl p-4"><div className="font-semibold text-[#7A0A4A]">{t('email')}</div><div>{siteContent.contact_email || 'contact@hcp.ma'}</div></div>
                    <div className="bg-[#f8fafc] border border-[#d8e4ec] rounded-xl p-4"><div className="font-semibold text-[#7A0A4A]">{t('phone')}</div><div>{siteContent.contact_phone || '-'}</div></div>
                    <div className="bg-[#f8fafc] border border-[#d8e4ec] rounded-xl p-4"><div className="font-semibold text-[#7A0A4A]">{t('address')}</div><div className="whitespace-pre-wrap">{i18n.language === 'ar' ? (siteContent.contact_address_ar || siteContent.contact_address || '-') : i18n.language === 'en' ? (siteContent.contact_address_en || siteContent.contact_address || siteContent.contact_address_ar || '-') : (siteContent.contact_address || '-')}</div></div>
                    <div className="bg-[#f8fafc] border border-[#d8e4ec] rounded-xl p-4"><div className="font-semibold text-[#7A0A4A]">{t('hours')}</div><div>{i18n.language === 'ar' ? (siteContent.contact_hours_ar || siteContent.contact_hours || '-') : i18n.language === 'en' ? (siteContent.contact_hours_en || siteContent.contact_hours || siteContent.contact_hours_ar || '-') : (siteContent.contact_hours || '-')}</div></div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeMenu === 'LiensUtiles' && (
            <div className="w-full min-h-[calc(100vh-320px)] flex items-center justify-center px-2 md:px-6 py-6">
              <div className="w-full max-w-5xl bg-gradient-to-b from-[#fffdf8] to-white border-2 border-[#D6B978] rounded-2xl shadow-[0_14px_30px_rgba(16,78,116,0.16)] p-7 space-y-6">
                <h2 className="text-3xl md:text-4xl font-extrabold text-[#7A0A4A] border-b border-[#E7D2A1] pb-3 tracking-tight">{t('useful_links')}</h2>
                {canEdit && userRole === 'ADMIN' ? (
                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-[#7A0A4A]">Français</div>
                    {(siteContentDraft.useful_links || []).map((link, idx) => (
                      <div key={`link-${idx}`} className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr_auto] gap-2 items-center">
                        <input
                          type="text"
                          value={link?.label || ''}
                          onChange={(e) => setSiteContentDraft((prev) => {
                            const next = [...(prev.useful_links || [])];
                            next[idx] = { ...(next[idx] || {}), label: e.target.value };
                            return { ...prev, useful_links: next };
                          })}
                          placeholder="Label"
                          className="p-2 border border-[#CCB47F] rounded-xl outline-none focus:border-[#7A0A4A]"
                        />
                        <input
                          type="text"
                          value={link?.url || ''}
                          onChange={(e) => setSiteContentDraft((prev) => {
                            const next = [...(prev.useful_links || [])];
                            next[idx] = { ...(next[idx] || {}), url: e.target.value };
                            return { ...prev, useful_links: next };
                          })}
                          placeholder="https://exemple.ma"
                          className="p-2 border border-[#CCB47F] rounded-xl outline-none focus:border-[#7A0A4A]"
                        />
                        <button
                          type="button"
                          onClick={() => setSiteContentDraft((prev) => ({ ...prev, useful_links: (prev.useful_links || []).filter((_, i) => i !== idx) }))}
                          className="px-3 py-2 rounded-xl border border-red-300 text-red-700 hover:bg-red-50"
                        >
                          Supprimer
                        </button>
                      </div>
                    ))}
                    <div className="pt-2 text-sm font-semibold text-[#7A0A4A]" dir="rtl">العربية</div>
                    {(siteContentDraft.useful_links_ar || []).map((link, idx) => (
                      <div key={`link-ar-${idx}`} className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr_auto] gap-2 items-center">
                        <input
                          type="text"
                          value={link?.label || ''}
                          onChange={(e) => setSiteContentDraft((prev) => {
                            const next = [...(prev.useful_links_ar || [])];
                            next[idx] = { ...(next[idx] || {}), label: e.target.value };
                            return { ...prev, useful_links_ar: next };
                          })}
                          placeholder="العنوان"
                          className="p-2 border border-[#CCB47F] rounded-xl outline-none focus:border-[#7A0A4A]"
                          dir="rtl"
                        />
                        <input
                          type="text"
                          value={link?.url || ''}
                          onChange={(e) => setSiteContentDraft((prev) => {
                            const next = [...(prev.useful_links_ar || [])];
                            next[idx] = { ...(next[idx] || {}), url: e.target.value };
                            return { ...prev, useful_links_ar: next };
                          })}
                          placeholder="https://example.ma"
                          className="p-2 border border-[#CCB47F] rounded-xl outline-none focus:border-[#7A0A4A]"
                        />
                        <button
                          type="button"
                          onClick={() => setSiteContentDraft((prev) => ({ ...prev, useful_links_ar: (prev.useful_links_ar || []).filter((_, i) => i !== idx) }))}
                          className="px-3 py-2 rounded-xl border border-red-300 text-red-700 hover:bg-red-50"
                        >
                          Supprimer
                        </button>
                      </div>
                    ))}
                    <div className="pt-2 text-sm font-semibold text-[#7A0A4A]">English</div>
                    {(siteContentDraft.useful_links_en || []).map((link, idx) => (
                      <div key={`link-en-${idx}`} className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr_auto] gap-2 items-center">
                        <input
                          type="text"
                          value={link?.label || ''}
                          onChange={(e) => setSiteContentDraft((prev) => {
                            const next = [...(prev.useful_links_en || [])];
                            next[idx] = { ...(next[idx] || {}), label: e.target.value };
                            return { ...prev, useful_links_en: next };
                          })}
                          placeholder="Label"
                          className="p-2 border border-[#CCB47F] rounded-xl outline-none focus:border-[#7A0A4A]"
                        />
                        <input
                          type="text"
                          value={link?.url || ''}
                          onChange={(e) => setSiteContentDraft((prev) => {
                            const next = [...(prev.useful_links_en || [])];
                            next[idx] = { ...(next[idx] || {}), url: e.target.value };
                            return { ...prev, useful_links_en: next };
                          })}
                          placeholder="https://example.ma"
                          className="p-2 border border-[#CCB47F] rounded-xl outline-none focus:border-[#7A0A4A]"
                        />
                        <button
                          type="button"
                          onClick={() => setSiteContentDraft((prev) => ({ ...prev, useful_links_en: (prev.useful_links_en || []).filter((_, i) => i !== idx) }))}
                          className="px-3 py-2 rounded-xl border border-red-300 text-red-700 hover:bg-red-50"
                        >
                          Supprimer
                        </button>
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-2 justify-between">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSiteContentDraft((prev) => ({ ...prev, useful_links: [...(prev.useful_links || []), { label: '', url: '' }] }))}
                          className="px-4 py-2 rounded-xl border border-[#CCB47F] bg-[#f8f3e7] text-[#7A0A4A] font-semibold hover:bg-[#f2e9d2]"
                        >
                          {t('add_link')} (FR)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSiteContentDraft((prev) => ({ ...prev, useful_links_ar: [...(prev.useful_links_ar || []), { label: '', url: '' }] }))}
                          className="px-4 py-2 rounded-xl border border-[#CCB47F] bg-[#f8f3e7] text-[#7A0A4A] font-semibold hover:bg-[#f2e9d2]"
                          dir="rtl"
                        >
                          إضافة رابط (AR)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSiteContentDraft((prev) => ({ ...prev, useful_links_en: [...(prev.useful_links_en || []), { label: '', url: '' }] }))}
                          className="px-4 py-2 rounded-xl border border-[#CCB47F] bg-[#f8f3e7] text-[#7A0A4A] font-semibold hover:bg-[#f2e9d2]"
                        >
                          Add link (EN)
                        </button>
                      </div>
                      <button
                        onClick={saveSiteContent}
                        disabled={savingSiteContent}
                        className={`px-5 py-2 rounded-xl font-semibold border ${savingSiteContent ? 'bg-gray-300 text-gray-700 border-gray-400 cursor-not-allowed' : 'bg-[#7A0A4A] text-white border-[#B03372] hover:bg-[#5E0738]'}`}
                      >
                        {savingSiteContent ? t('saving') : t('save')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(i18n.language === 'ar'
                      ? (siteContent.useful_links_ar || siteContent.useful_links || [])
                      : i18n.language === 'en'
                        ? (siteContent.useful_links_en || siteContent.useful_links || siteContent.useful_links_ar || [])
                        : (siteContent.useful_links || [])
                    ).map((link, idx) => (
                      <a
                        key={`pub-link-${idx}`}
                        href={link?.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block border border-[#d8e4ec] rounded-xl p-4 bg-[#f8fafc] hover:bg-[#eef6fb]"
                      >
                        <div className="font-semibold text-[#7A0A4A]">{link?.label || 'Lien'}</div>
                        <div className="text-sm text-[#2f4b5a] break-all">{link?.url || ''}</div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ÉTAPE 0 : GRILLE DES THأˆMES */}
          {activeMenu === 'Themes' && formStep === 0 && (
            <div className="relative min-h-[400px]">
              <div className={isVisitor ? 'grid grid-cols-3 gap-4' : 'grid grid-cols-3 gap-2'}>
                {visibleThemes.filter(t => getThemeDisplayTitle(t).toLowerCase().includes(searchTheme.toLowerCase())).filter(t => isThemeVisibleForCurrentRole(t)).map((t, i) => (
                  isVisitor ? (
                    // VERSION VISITEUR : LAYOUT HORIZONTAL AMÉLIORÉ
                    <div 
                      key={t.id} 
                      onClick={() => { 
                        if (!t.categories || t.categories.length === 0) {
                          setSelectedTheme(t);
                          setSelectedCategorie(null);
                          setSelectedVisitorCategoryId('all');
                          setExpandedCategories({});
                          setFormStep(3);
                          return;
                        }

                        setSelectedTheme(t);
                        setSelectedCategorie(null);
                        setSelectedVisitorCategoryId('all');
                        setExpandedCategories({});
                        setFormStep(3);
                      }}
                      className={`cursor-pointer p-5 rounded-lg border-2 shadow-md relative transition-all duration-300 hover:shadow-xl hover:scale-[1.02] flex items-center gap-4 min-h-[160px] ${t.archived ? 'bg-gray-500 opacity-75 border-gray-600' : 'bg-gradient-to-r from-[#E6A76A] to-[#D09150] border-[#B8845C]'}`}
                    >
                      {t.archived && (
                        <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded text-xs font-bold">🚫</div>
                      )}
                      
                      {/* IMAGE أ€ GAUCHE */}
                      {t.theme_image && (
                        <div className="flex-shrink-0">
                          <img
                            src={t.theme_image}
                            alt={getThemeDisplayTitle(t)}
                            className="w-20 h-20 object-contain drop-shadow-md"
                          />
                        </div>
                      )}
                      
                      {/* NUMÉRO ET TITRE أ€ DROITE */}
                      <div className="flex-1 min-w-0">
                        <div className={`font-extrabold text-2xl mb-1 ${t.archived ? 'text-white' : 'text-[#5E0738]'}`}>
                          {String(i + 1).padStart(2, '0')}
                        </div>
                        <h3 className={`uppercase tracking-wide font-semibold leading-snug break-words ${t.archived ? 'text-white line-through' : 'text-[#3F2A1F]'}`} style={{fontSize: '14px'}}>
                          {getThemeDisplayTitle(t)}
                        </h3>
                      </div>

                      {/* FLECHE POUR MENU DÉROULANT DES CATÉGORIES */}
                      {t.categories && t.categories.length > 0 && (
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            const menuHeight = 60 + (t.categories.length * 36); // Estimer hauteur basée sur nb de catégories
                            const menuWidth = 256; // w-64
                            const spaceBelow = window.innerHeight - rect.bottom;
                            const spaceRight = window.innerWidth - rect.left;
                            
                            let top, left;
                            
                            // Positionner en bas si possible, sinon en haut
                            if (spaceBelow > menuHeight + 8) {
                              top = rect.bottom + 8;
                            } else {
                              top = rect.top - menuHeight - 8;
                            }
                            
                            // Positionnement horizontal
                            left = spaceRight > menuWidth ? rect.left : rect.right - menuWidth;
                            
                            // Clamp horizontal seulement pour éviter sortie de l'écran
                            left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
                            
                            // Clamp vertical: juste éviter top négatif, laisser le menu déborder si nécessaire (max-h + overflow-y-auto)
                            top = Math.max(8, top);
                            
                            setCategorieMenuPos({ left, top });
                            setOpenCategorieMenu(openCategorieMenu === t.id ? null : t.id);
                          }}
                          className="text-[#7A0A4A] hover:text-[#5E0738] text-lg leading-none px-1 py-0.5 flex-shrink-0"
                          aria-label="Choisir une catégorie"
                        >
                          ▾
                        </button>
                      )}
                    </div>
                  ) : (
                    // VERSION ADMIN : DESIGN ORIGINAL INCHANGÉ
                    <div 
                      key={t.id} 
                      onClick={() => { 
                        if (!t.categories || t.categories.length === 0) {
                          setSelectedTheme(t);
                          setSelectedCategorie(null);
                          setSelectedVisitorCategoryId('all');
                          setExpandedCategories({});
                          setFormStep(3);
                          return;
                        }

                        setSelectedTheme(t);
                        setSelectedCategorie(null);
                        setSelectedVisitorCategoryId('all');
                        setExpandedCategories({});
                        setFormStep(3);
                      }}
                      className={`cursor-pointer p-4 rounded-sm border border-[#9A4A2A] shadow-md relative text-[#6E001F] transition-transform hover:scale-[1.01] min-h-[132px] ${t.archived ? 'bg-gray-600 line-through opacity-80 text-white' : (t.id === maxId ? 'bg-[#D89253]' : 'bg-[#E6A76A]')}`}
                    >
                      {t.archived && (
                        <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded-full text-xs font-bold">🚫</div>
                      )}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {t.theme_image && (
                            <img
                              src={t.theme_image}
                              alt={getThemeDisplayTitle(t)}
                              className="w-16 h-16 object-contain shrink-0"
                            />
                          )}
                          <span className="uppercase tracking-wide text-[18px] md:text-[20px] leading-snug font-semibold">{`${String(i + 1).padStart(2, '0')}-${getThemeDisplayTitle(t)}`}</span>
                        </div>
                        {t.categories && t.categories.length > 0 && (
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              const menuHeight = 60 + (t.categories.length * 36); // Estimer hauteur basée sur nb de catégories
                              const menuWidth = 256; // w-64
                              const spaceBelow = window.innerHeight - rect.bottom;
                              const spaceRight = window.innerWidth - rect.left;
                              
                              let top, left;
                              
                              // Positionner en bas si possible, sinon en haut
                              if (spaceBelow > menuHeight + 8) {
                                top = rect.bottom + 8;
                              } else {
                                top = rect.top - menuHeight - 8;
                              }
                              
                              // Positionnement horizontal
                              left = spaceRight > menuWidth ? rect.left : rect.right - menuWidth;
                              
                              // Clamp horizontal seulement pour éviter sortie de l'écran
                              left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
                              
                              // Clamp vertical: juste éviter top négatif, laisser le menu déborder si nécessaire (max-h + overflow-y-auto)
                              top = Math.max(8, top);
                              
                              setCategorieMenuPos({ left, top });
                              setOpenCategorieMenu(openCategorieMenu === t.id ? null : t.id);
                            }}
                            className="text-[#7A0A4A] hover:text-[#5E0738] text-lg leading-none px-1 py-0.5"
                            aria-label="Choisir une catégorie"
                          >
                            ▾
                          </button>
                        )}
                      </div>
                    <div className="flex mt-4 gap-2">
                      {canEdit && userRole === 'ADMIN' && (
                        <button onClick={(e) => { 
                          e.stopPropagation(); 
                          const rect = e.currentTarget.getBoundingClientRect(); 
                          const menuHeight = 320; // hauteur estimée réaliste (plus d'options)
                          const menuWidth = 224; // w-56
                          const spaceBelow = window.innerHeight - rect.bottom;
                          const spaceRight = window.innerWidth - rect.left;
                          const desiredTop = spaceBelow > menuHeight ? rect.bottom + 8 : rect.top - menuHeight - 8;
                          const desiredLeft = spaceRight > menuWidth ? rect.left : rect.right - menuWidth;
                          const top = Math.max(8, Math.min(desiredTop, window.innerHeight - menuHeight - 8));
                          const left = Math.max(8, Math.min(desiredLeft, window.innerWidth - menuWidth - 8));
                          setActionMenuPos({ left, top }); 
                          setOpenActionMenu(openActionMenu === t.id ? null : t.id); 
                          setOpenThemeMenu(null); 
                        }} className="bg-[#B89C5A] p-1 border border-black rounded shadow">✎</button>
                      )}

                      <div>
                        {canEdit && userRole === 'ADMIN' && (
                          <button onClick={(e) => { 
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              const menuHeight = 150;
                              const menuWidth = 208; // w-52
                              const spaceBelow = window.innerHeight - rect.bottom;
                              const spaceRight = window.innerWidth - rect.left;
                              const top = spaceBelow > menuHeight ? rect.bottom + 8 : rect.top - menuHeight - 8;
                              const left = spaceRight > menuWidth ? rect.left : rect.right - menuWidth;
                              setThemeMenuPos({ left, top });
                              setOpenThemeMenu(openThemeMenu === t.id ? null : t.id);
                            }} className="bg-[#f0a38e] p-1 border border-black rounded shadow">⚙</button>
                        )}
                      </div>
                    </div>
                    {canEdit && (
                      <div className={`absolute bottom-3 right-3 w-5 h-5 rounded-full border border-black ${t.is_visible ? 'bg-green-400' : 'bg-red-500'}`}></div>
                    )}
                  </div>
                  )
                ))}
              </div>
              {canEdit && userRole === 'ADMIN' && (
                <button 
                  onClick={() => setFormStep(1)}
                  className="fixed bottom-10 right-10 bg-[#B03372] hover:bg-[#7A0A4A] text-white font-bold py-4 px-8 rounded-sm border border-[#B03372] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.35)]"
                >
                  {t('add_theme')}
                </button>
              )}

              {/* Floating theme menu (renders at viewport level to avoid being clipped) */}
              {canEdit && userRole === 'ADMIN' && openThemeMenu && (
                <div onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', left: themeMenuPos.left, top: themeMenuPos.top, zIndex: 9999 }}>
                  <div className="w-52 bg-white rounded-lg shadow-2xl border border-gray-200 max-h-96 overflow-y-auto">
                    <div className="px-3 py-2 border-b text-sm font-semibold text-gray-700">Options</div>
                    {(() => {
                      const ct = themes.find(x => x.id === openThemeMenu);
                      if (ct && ct.archived) {
                        return (
                          <button onClick={(e) => { e.stopPropagation(); showConfirm('Désarchiver ce thème ?', async () => { await unarchiveTheme(openThemeMenu); setOpenThemeMenu(null); }); }} className="w-full text-left px-4 py-2 bg-green-100 text-green-900 hover:bg-green-200 transition-colors flex items-center gap-2">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 7h18" stroke="#166534" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 7v10a1 1 0 001 1h6a1 1 0 001-1V7" stroke="#166534" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 3h4" stroke="#166534" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            Désarchiver le thème
                          </button>
                        );
                      }
                      return (
                        <button onClick={(e) => { e.stopPropagation(); showConfirm('Archiver ce thème ?', async () => { await archiveTheme(openThemeMenu); setOpenThemeMenu(null); }); }} className="w-full text-left px-4 py-2 bg-yellow-100 text-yellow-900 hover:bg-yellow-200 transition-colors flex items-center gap-2">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 7h18" stroke="#92400E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 7v10a1 1 0 001 1h6a1 1 0 001-1V7" stroke="#92400E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 3h4" stroke="#92400E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          Archiver le thème
                        </button>
                      );
                    })()}
                    {canEdit && userRole === 'ADMIN' && (
                      <button onClick={(e) => { e.stopPropagation(); showConfirm('Supprimer ce thème ?', async () => { await deleteTheme(openThemeMenu); setOpenThemeMenu(null); }); }} className="w-full text-left px-4 py-2 bg-white text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 6h18" stroke="#B91C1C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 6v12a1 1 0 001 1h6a1 1 0 001-1V6" stroke="#B91C1C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 11v6M14 11v6" stroke="#B91C1C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        Supprimer le thème
                      </button>
                    )}
                  </div>
                </div>
              )}

              {openCategorieMenu && (
                <div onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', left: categorieMenuPos.left, top: categorieMenuPos.top, zIndex: 9999 }} key={`cat-menu-${openCategorieMenu}-${themes.find(x => x.id === openCategorieMenu)?.categories?.length || 0}`}>
                  <div className={isVisitor ? 'w-[min(16rem,86vw)] bg-[#9F2F76] rounded-none shadow-none border border-[#86285F] max-h-96 overflow-y-auto' : 'w-[min(22rem,92vw)] bg-[#fffdf9] rounded-xl shadow-[0_16px_28px_rgba(94,7,56,0.28)] border border-[#B03372] max-h-96 overflow-y-auto'}>
                    {!isVisitor && (
                      <div className="px-4 py-3 text-sm font-bold text-white bg-gradient-to-r from-[#7A0A4A] to-[#B03372]">Choisir une catégorie</div>
                    )}
                    {(() => {
                      const currentTheme = themes.find(x => x.id === openCategorieMenu);
                      if (!currentTheme || !currentTheme.categories) return null;
                      return currentTheme.categories.sort((a, b) => a.ordre - b.ordre).map(cat => {
                        const isActiveCat = String(selectedCategorie?.id) === String(cat.id);
                        return (
                        <div key={cat.id} className={`last:border-b-0 transition-colors flex items-center gap-2 justify-between ${isVisitor ? `px-3 py-2 border-b border-[#C1649B] ${isActiveCat ? 'bg-[#84265F]' : 'hover:bg-[#AE4D88]'}` : `px-3 py-2 border-b border-[#efd5e5] ${isActiveCat ? 'bg-[#f8ebf2]' : 'hover:bg-[#fdf1f7]'}`}`}>
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation();
                              setSelectedTheme(currentTheme);
                              setSelectedCategorie(cat);
                              setSelectedVisitorCategoryId(String(cat.id));
                              setOpenCategorieMenu(null);
                              setFormStep(3);
                            }}
                            className={isVisitor ? 'flex-1 text-left flex items-center' : 'flex-1 text-left flex items-center gap-2'}
                          >
                            {!isVisitor && (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                                <path d="M9 3H4a1 1 0 00-1 1v5a1 1 0 001 1h5a1 1 0 001-1V4a1 1 0 00-1-1z" stroke="#7A0A4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M20 3h-5a1 1 0 00-1 1v5a1 1 0 001 1h5a1 1 0 001-1V4a1 1 0 00-1-1z" stroke="#7A0A4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M9 14H4a1 1 0 00-1 1v5a1 1 0 001 1h5a1 1 0 001-1v-5a1 1 0 00-1-1z" stroke="#7A0A4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M20 14h-5a1 1 0 00-1 1v5a1 1 0 001 1h5a1 1 0 001-1v-5a1 1 0 00-1-1z" stroke="#7A0A4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                            <span className={`font-semibold truncate ${isVisitor ? (isActiveCat ? 'text-white' : 'text-[#FFE8F5]') : (isActiveCat ? 'text-[#5E0738]' : 'text-[#6E001F]')}`}>{getCategoryDisplayName(cat)}</span>
                            {!isVisitor && (
                              <span className={`ml-auto text-xs ${isActiveCat ? 'text-[#7A0A4A]' : 'text-gray-500'}`}>({cat.sous_themes?.length || 0})</span>
                            )}
                          </button>
                          {canEdit && userRole === 'ADMIN' && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActionModalType('rename_categorie');
                                  setActionModalValue(cat?.nom || '');
                                  setActionModalValueAr(cat?.nom_ar || '');
                                  setActionModalValueEn(cat?.nom_en || '');
                                  setActionModalThemeId(cat.id);
                                  setShowActionModal(true);
                                  setOpenCategorieMenu(null);
                                }}
                                className="p-1 hover:bg-amber-100 rounded transition-colors text-amber-700"
                                title="Renommer cette catégorie"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M3 21v-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M7 14l9-9 3 3-9 9H7v-3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteCategorie(cat.id);
                                }}
                                className="p-1 hover:bg-red-100 rounded transition-colors text-red-600"
                                title="Supprimer cette catégorie"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M10 7V4a1 1 0 011-1h2a1 1 0 011 1v3m-6 0h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                      );});
                    })()}
                  </div>
                </div>
              )}

              {canEdit && userRole === 'ADMIN' && openActionMenu && (
                <div onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', left: actionMenuPos.left, top: actionMenuPos.top, zIndex: 9999 }}>
                  <div className="w-56 bg-white rounded-lg shadow-2xl border border-gray-200 max-h-96 overflow-y-auto">
                    <div className="px-3 py-2 border-b text-sm font-semibold text-gray-700">Actions</div>
                    <button onClick={(e) => { e.stopPropagation(); const t = themes.find(x => x.id === openActionMenu); setActionModalType('rename'); setActionModalValue(t?.titre || ''); setActionModalValueAr(t?.titre_ar || ''); setActionModalValueEn(t?.titre_en || ''); setActionModalThemeId(openActionMenu); setShowActionModal(true); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 21v-3" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 14l9-9 3 3-9 9H7v-3z" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Renommer
                    </button>
                    {canEdit && userRole === 'ADMIN' && (
                      <button onClick={(e) => { e.stopPropagation(); const themeId = openActionMenu; setOpenActionMenu(null); pickAndUpdateThemeImage(themeId); }} className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 7h16v10H4z" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 11l2 2 4-4 2 2" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        Ajouter / Modifier image du thème
                      </button>
                    )}
                    {canEdit && userRole === 'ADMIN' && (
                      <button onClick={(e) => { e.stopPropagation(); const themeId = openActionMenu; setOpenActionMenu(null); removeThemeImage(themeId); }} className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 text-red-600">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 6h18" stroke="#B91C1C" strokeWidth="1.5" strokeLinecap="round"/><path d="M8 6v12a1 1 0 001 1h6a1 1 0 001-1V6" stroke="#B91C1C" strokeWidth="1.5"/><path d="M10 11v6M14 11v6" stroke="#B91C1C" strokeWidth="1.5"/></svg>
                        Supprimer l'image du thème
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); setActionModalType('add_subtheme'); setActionModalValue(''); setActionModalValueAr(''); setActionModalValueEn(''); setActionModalThemeId(openActionMenu); setActionModalCategorieId(null); setShowActionModal(true); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5v14" stroke="#065F46" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 12h14" stroke="#065F46" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Ajouter un sous-thème
                    </button>
                    {(() => {
                      const currentTheme = themes.find(t => t.id === openActionMenu);
                      if (currentTheme && currentTheme.categories && currentTheme.categories.length > 0) {
                        return (
                          <button onClick={(e) => { 
                            e.stopPropagation(); 
                            setActionModalType('add_categorie'); 
                            setActionModalValue(''); 
                            setActionModalValueAr(''); 
                            setActionModalValueEn(''); 
                            setActionModalThemeId(openActionMenu); 
                            setShowActionModal(true); 
                            setOpenActionMenu(null); 
                          }} className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M9 3H4a1 1 0 00-1 1v5a1 1 0 001 1h5a1 1 0 001-1V4a1 1 0 00-1-1z" stroke="#0891b2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M20 3h-5a1 1 0 00-1 1v5a1 1 0 001 1h5a1 1 0 001-1V4a1 1 0 00-1-1z" stroke="#0891b2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M12 12v8M8 16h8" stroke="#0891b2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Ajouter une catégorie
                          </button>
                        );
                      }
                      return null;
                    })()}
                    <button onClick={(e) => { 
                      e.stopPropagation(); 
                      const t = themes.find(x => x.id === openActionMenu);
                      if (!t) return;
                      const newVis = !t.is_visible;
                      showConfirm(`Rendre ce thème ${newVis ? 'Public' : 'Privé'} ainsi que tous ses sous-thèmes ?`, async () => {
                        await toggleThemePublication(openActionMenu, newVis);
                      });
                      setOpenActionMenu(null);
                    }} className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5v14" stroke="#0F172A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 12h14" stroke="#0F172A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Modifier le statut de publication
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ÉTAPES 1 & 2 (Identiques à votre code initial) */}
          {activeMenu === 'Themes' && formStep === 1 && (
             <div className="max-w-5xl mx-auto rounded-3xl border border-[#d9bfd0] bg-[#fffaf3] shadow-[0_22px_48px_rgba(94,7,56,0.14)] overflow-hidden">
               <div className="px-8 py-6 border-b border-[#ecd7e3] bg-gradient-to-r from-[#7A0A4A] to-[#B03372]">
                 <h3 className="text-2xl md:text-3xl font-extrabold text-white tracking-wide">Créer un thème</h3>
                 <p className="mt-1 text-sm text-[#f6dfe9]">Renseignez les informations de base, puis continuez vers la configuration des sous-thèmes.</p>
               </div>

               <div className="p-8 space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] items-center gap-3 md:gap-5">
                 <label className="text-[15px] md:text-base font-bold text-[#5a2436]">Titre du thème*</label>
                 <input type="text" className="w-full rounded-xl border border-[#d7bfd0] bg-white px-4 py-2.5 text-base outline-none focus:border-[#B03372] focus:ring-2 focus:ring-[#f2d5e5]" 
                   value={themeData.titre || ''}
                   onChange={e => setThemeData({...themeData, titre: e.target.value})} />
               </div>

               <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] items-center gap-3 md:gap-5">
                 <label className="text-[15px] md:text-base font-bold text-[#5a2436]">Titre du thème (AR)</label>
                 <input type="text" dir="rtl" className="w-full rounded-xl border border-[#d7bfd0] bg-white px-4 py-2.5 text-base outline-none focus:border-[#B03372] focus:ring-2 focus:ring-[#f2d5e5]"
                   value={themeData.titre_ar || ''}
                   onChange={e => setThemeData({...themeData, titre_ar: e.target.value})} />
               </div>

               <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] items-center gap-3 md:gap-5">
                 <label className="text-[15px] md:text-base font-bold text-[#5a2436]">Theme title (EN)</label>
                 <input type="text" className="w-full rounded-xl border border-[#d7bfd0] bg-white px-4 py-2.5 text-base outline-none focus:border-[#B03372] focus:ring-2 focus:ring-[#f2d5e5]"
                   value={themeData.titre_en || ''}
                   onChange={e => setThemeData({...themeData, titre_en: e.target.value})} />
               </div>

               <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] items-start gap-3 md:gap-5">
                 <label className="text-[15px] md:text-base font-bold text-[#5a2436] pt-2">Image du thème (optionnelle)</label>
                 <div className="flex-1 space-y-2">
                   <input
                     type="file"
                     accept="image/*"
                     className="w-full rounded-xl border border-[#d7bfd0] bg-white px-4 py-2.5 text-sm outline-none"
                     onChange={async (e) => {
                       const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                       if (!f) {
                         setThemeImageFile(null);
                         setThemeImagePreview('');
                         return;
                       }

                       try {
                         const cleanedFile = await makeThemeImageBackgroundTransparent(f);
                         setThemeImageFile(cleanedFile);
                         const url = URL.createObjectURL(cleanedFile);
                         setThemeImagePreview(url);
                       } catch (err) {
                         console.error('Erreur import image thème', err);
                         setThemeImageFile(f);
                         try {
                           const fallbackUrl = URL.createObjectURL(f);
                           setThemeImagePreview(fallbackUrl);
                         } catch {
                           setThemeImagePreview('');
                         }
                       }
                     }}
                   />
                   <div className="text-xs text-[#7a5c6e]">
                     Conseil: prefere une image PNG transparente. Les fonds clairs sont estompes automatiquement sur les tickets visiteurs.
                   </div>
                   {themeImagePreview && (
                     <div className="flex items-center gap-3">
                       <div className="w-12 h-12 border border-[#d8bfd0] rounded-lg bg-[#7A0A4A] flex items-center justify-center overflow-hidden">
                         <img src={themeImagePreview} alt="Aperأ§u" className="w-10 h-10 object-contain" />
                       </div>
                       <button
                         type="button"
                         onClick={() => { setThemeImageFile(null); setThemeImagePreview(''); }}
                         className="rounded-lg border border-[#dcc7d4] bg-white px-3 py-1.5 text-sm font-semibold text-[#6a4b5d] hover:bg-[#faf5f8]"
                       >
                         Retirer
                       </button>
                     </div>
                   )}
                 </div>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] items-center gap-3 md:gap-5">
                 <label className="text-[15px] md:text-base font-bold text-[#5a2436]">Utiliser des catégories ?</label>
                 <input 
                   type="checkbox" 
                   checked={useCategories}
                   onChange={e => {
                     setUseCategories(e.target.checked);
                     if (!e.target.checked) setCategoryNames([{ nom: '', nom_ar: '', nom_en: '', nbSousThemes: 1 }]);
                   }}
                   className="h-5 w-5 cursor-pointer accent-[#7A0A4A]"
                 />
               </div>
               
               {useCategories && (
                 <div className="rounded-2xl border border-[#d8bfd0] bg-[#fff7fb] p-4 space-y-3">
                   <div className="flex justify-between items-center">
                     <label className="text-base font-bold text-[#5a2436]">Configuration des catégories</label>
                     <button 
                       onClick={() => setCategoryNames([...categoryNames, { nom: '', nom_ar: '', nom_en: '', nbSousThemes: 1 }])}
                       className="rounded-lg border border-[#a8cfb0] bg-[#e8f6ea] px-3 py-1.5 text-sm font-semibold text-[#2d6a3c] hover:bg-[#daf0de]"
                     >
                       + Ajouter une catégorie
                     </button>
                   </div>
                   {categoryNames.map((cat, idx) => (
                     <div key={idx} className="rounded-xl border border-[#e1d1dc] p-3 space-y-2 bg-white">
                       <div className="flex gap-2 items-center">
                         <span className="font-bold text-lg w-8">{idx + 1}.</span>
                         <div className="flex-1 flex gap-3">
                           <input 
                             type="text" 
                             value={cat.nom}
                             onChange={e => {
                               const newCats = [...categoryNames];
                               newCats[idx].nom = e.target.value;
                               setCategoryNames(newCats);
                             }}
                             className="flex-1 border border-[#d7bfd0] rounded-lg p-2 outline-none focus:border-[#B03372]"
                             placeholder={`Nom de la catégorie ${idx + 1}`}
                           />
                           <input 
                             type="text" 
                             dir="rtl"
                             value={cat.nom_ar || ''}
                             onChange={e => {
                               const newCats = [...categoryNames];
                               newCats[idx].nom_ar = e.target.value;
                               setCategoryNames(newCats);
                             }}
                             className="flex-1 border border-[#d7bfd0] rounded-lg p-2 outline-none focus:border-[#B03372]"
                             placeholder={`الاسم العربي للفئة ${idx + 1}`}
                           />
                           <input 
                             type="text"
                             value={cat.nom_en || ''}
                             onChange={e => {
                               const newCats = [...categoryNames];
                               newCats[idx].nom_en = e.target.value;
                               setCategoryNames(newCats);
                             }}
                             className="flex-1 border border-[#d7bfd0] rounded-lg p-2 outline-none focus:border-[#B03372]"
                             placeholder={`English category name ${idx + 1}`}
                           />
                           <div className="flex items-center gap-2">
                             <label className="font-semibold whitespace-nowrap">Sous-thèmes:</label>
                             <input 
                               type="number" 
                               min="1"
                               value={cat.nbSousThemes}
                               onChange={e => {
                                 const newCats = [...categoryNames];
                                 newCats[idx].nbSousThemes = parseInt(e.target.value) || 1;
                                 setCategoryNames(newCats);
                               }}
                               className="w-20 border border-[#d7bfd0] rounded-lg p-2 outline-none text-center focus:border-[#B03372]"
                             />
                           </div>
                         </div>
                         {categoryNames.length > 1 && (
                           <button 
                             onClick={() => setCategoryNames(categoryNames.filter((_, i) => i !== idx))}
                             className="rounded-lg border border-[#e3b8c8] bg-[#fff1f6] px-3 py-2 font-bold text-[#9a1f49] hover:bg-[#ffe3ed]"
                           >
                             ✕
                           </button>
                         )}
                       </div>
                     </div>
                   ))}
                 </div>
               )}
               
               {!useCategories && (
                 <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] items-center gap-3 md:gap-5">
                   <label className="text-[15px] md:text-base font-bold text-[#5a2436]">Nombre des Sous-thèmes*</label>
                   <input type="number" min="1" className="w-36 rounded-xl border border-[#d7bfd0] bg-white px-4 py-2.5 text-base outline-none focus:border-[#B03372]"
                     value={themeData.nbSousThemes} onChange={e => setThemeData({...themeData, nbSousThemes: parseInt(e.target.value)})} />
                 </div>
               )}
               
               <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] items-center gap-3 md:gap-5">
                 <label className="text-[15px] md:text-base font-bold text-[#5a2436]">Statut de publication</label>
                 <select className="w-full rounded-xl border border-[#d7bfd0] bg-white px-4 py-2.5 text-base outline-none focus:border-[#B03372]" 
                   onChange={e => setThemeData({...themeData, statut: e.target.value})}>
                   <option value="Public">Public 🌍</option>
                   <option value="Privé">Privé 🔒</option>
                 </select>
               </div>
               <div className="flex justify-end gap-3 mt-8 pt-5 border-t border-[#ecd7e3]">
                 <button onClick={() => { setFormStep(0); setThemeImageFile(null); setThemeImagePreview(''); setRows([]); }} className="rounded-xl border border-[#d9c6d1] bg-white px-5 py-2.5 font-semibold text-[#6a4a5d] hover:bg-[#faf6f8]">Annuler</button>
                 <button onClick={goToTable} className="rounded-xl border border-[#8c1f60] bg-[#7A0A4A] px-5 py-2.5 font-semibold text-white hover:bg-[#5E0738] shadow-sm">Suivant →</button>
               </div>
               </div>
             </div>
          )}

          {activeMenu === 'Themes' && formStep === 2 && (
             <div className="space-y-6 max-w-6xl mx-auto">
               {useCategories ? (
                 // Afficher un tableau par catégorie
                 categoryNames.filter(cat => cat.nom.trim()).map((cat, catIndex) => {
                   const catRows = rows.filter(r => r.categorieIndex === catIndex);
                   const startIdx = rows.findIndex(r => r.categorieIndex === catIndex);
                   
                   return (
                     <div key={catIndex} className="bg-white border-2 border-black rounded-lg shadow-xl overflow-hidden">
                       <div className="bg-[#7A0A4A] px-4 py-3 border-b-2 border-black">
                         <h3 className="text-white font-bold text-lg">Catégorie {catIndex + 1}: {cat.nom}</h3>
                       </div>
                       <table className="w-full border-collapse">
                         <thead className="bg-gray-50">
                           <tr className="border-b border-black">
                             {['Sous - thème*', 'Sous-thème (AR)', 'Sub-theme (EN)', 'Unité*', 'Définition*', 'Indicateur*', 'Source*', 'Périodicité*', 'Data*'].map(h => (
                               <th key={h} className="border-r border-black p-2 text-sm font-bold">{h}</th>
                             ))}
                           </tr>
                         </thead>
                         <tbody>
                           {catRows.map((row, localIdx) => {
                             const globalIdx = startIdx + localIdx;
                             return (
                               <tr key={globalIdx} className="border-b border-black">
                                 <td className="border-r border-black p-1"><input type="text" className="w-full outline-none text-xs" value={row.sousTheme} onChange={e => {const r = [...rows]; r[globalIdx].sousTheme = e.target.value; setRows(r);}} /></td>
                                 <td className="border-r border-black p-1"><input type="text" dir="rtl" className="w-full outline-none text-xs" value={row.sousTheme_ar || ''} onChange={e => {const r = [...rows]; r[globalIdx].sousTheme_ar = e.target.value; setRows(r);}} /></td>
                                 <td className="border-r border-black p-1"><input type="text" className="w-full outline-none text-xs" value={row.sousTheme_en || ''} onChange={e => {const r = [...rows]; r[globalIdx].sousTheme_en = e.target.value; setRows(r);}} /></td>
                                 <td className="border-r border-black p-1"><input type="text" className="w-full outline-none text-xs" value={row.unite} onChange={e => {const r = [...rows]; r[globalIdx].unite = e.target.value; setRows(r);}} /></td>
                                 <td className="border-r border-black p-1"><input type="text" className="w-full outline-none text-xs" value={row.definition} onChange={e => {const r = [...rows]; r[globalIdx].definition = e.target.value; setRows(r);}} /></td>
                                 <td className="border-r border-black p-1"><input type="text" className="w-full outline-none text-xs" value={row.indicateur} onChange={e => {const r = [...rows]; r[globalIdx].indicateur = e.target.value; setRows(r);}} /></td>
                                 <td className="border-r border-black p-1"><input type="text" className="w-full outline-none text-xs" value={row.source} onChange={e => {const r = [...rows]; r[globalIdx].source = e.target.value; setRows(r);}} /></td>
                                 <td className="border-r border-black p-1"><input type="text" className="w-full outline-none text-xs" value={row.periodicite} onChange={e => {const r = [...rows]; r[globalIdx].periodicite = e.target.value; setRows(r);}} /></td>
                                 <td className="p-1 text-center bg-gray-50">
                                   <label className="cursor-pointer">
                                     <span className="text-2xl">📄</span>
                                     <input type="file" className="hidden" onChange={e => {const r = [...rows]; r[globalIdx].file = e.target.files[0]; setRows(r);}} />
                                     {row.file && <div className="text-[10px] text-green-600 font-bold">OK</div>}
                                   </label>
                                 </td>
                               </tr>
                             );
                           })}
                         </tbody>
                       </table>
                     </div>
                   );
                 })
               ) : (
                 // Mode sans catégories (tableau unique)
                 <div className="bg-white border-2 border-black rounded-lg shadow-xl overflow-hidden">
                   <table className="w-full border-collapse">
                     <thead className="bg-gray-50">
                       <tr className="border-b border-black">
                         {['Sous - thème*', 'Sous-thème (AR)', 'Sub-theme (EN)', 'Unité*', 'Définition*', 'Indicateur*', 'Source*', 'Périodicité*', 'Data*'].map(h => (
                           <th key={h} className="border-r border-black p-2 text-sm font-bold">{h}</th>
                         ))}
                       </tr>
                     </thead>
                     <tbody>
                       {rows.map((row, i) => (
                         <tr key={i} className="border-b border-black">
                           <td className="border-r border-black p-1"><input type="text" className="w-full outline-none text-xs" value={row.sousTheme} onChange={e => {const r = [...rows]; r[i].sousTheme = e.target.value; setRows(r);}} /></td>
                           <td className="border-r border-black p-1"><input type="text" dir="rtl" className="w-full outline-none text-xs" value={row.sousTheme_ar || ''} onChange={e => {const r = [...rows]; r[i].sousTheme_ar = e.target.value; setRows(r);}} /></td>
                           <td className="border-r border-black p-1"><input type="text" className="w-full outline-none text-xs" value={row.sousTheme_en || ''} onChange={e => {const r = [...rows]; r[i].sousTheme_en = e.target.value; setRows(r);}} /></td>
                           <td className="border-r border-black p-1"><input type="text" className="w-full outline-none text-xs" value={row.unite} onChange={e => {const r = [...rows]; r[i].unite = e.target.value; setRows(r);}} /></td>
                           <td className="border-r border-black p-1"><input type="text" className="w-full outline-none text-xs" value={row.definition} onChange={e => {const r = [...rows]; r[i].definition = e.target.value; setRows(r);}} /></td>
                           <td className="border-r border-black p-1"><input type="text" className="w-full outline-none text-xs" value={row.indicateur} onChange={e => {const r = [...rows]; r[i].indicateur = e.target.value; setRows(r);}} /></td>
                           <td className="border-r border-black p-1"><input type="text" className="w-full outline-none text-xs" value={row.source} onChange={e => {const r = [...rows]; r[i].source = e.target.value; setRows(r);}} /></td>
                           <td className="border-r border-black p-1"><input type="text" className="w-full outline-none text-xs" value={row.periodicite} onChange={e => {const r = [...rows]; r[i].periodicite = e.target.value; setRows(r);}} /></td>
                           <td className="p-1 text-center bg-gray-50">
                             <label className="cursor-pointer">
                               <span className="text-2xl">📄</span>
                               <input type="file" className="hidden" onChange={e => {const r = [...rows]; r[i].file = e.target.files[0]; setRows(r);}} />
                               {row.file && <div className="text-[10px] text-green-600 font-bold">OK</div>}
                             </label>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               )}
               <div className="flex justify-between pt-4">
                 <button onClick={() => setFormStep(1)} className="rounded-xl border border-[#d9c6d1] bg-white px-5 py-2.5 font-semibold text-[#6a4a5d] hover:bg-[#faf6f8]">⬅ Précédent</button>
                 <button onClick={handleFinalSubmit} className="rounded-xl border border-[#8c1f60] bg-[#7A0A4A] px-5 py-2.5 font-semibold text-white hover:bg-[#5E0738] shadow-sm">Enregistrer →</button>
               </div>
             </div>
          )}

          {/* ÉTAPE 3 : LISTE DES SOUS-THأˆMES */}
          {activeMenu === 'Themes' && formStep === 3 && selectedTheme && (
            <div className="space-y-2">
              {canEdit && userRole === 'ADMIN' && (
              <div className="flex flex-wrap items-center justify-end gap-3">

                {selectedCategorie ? (
                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <div className={`w-5 h-5 rounded-full border border-black ${selectedCategorie.is_visible ? 'bg-green-400' : 'bg-red-500'}`}></div>
                    )}
                    {canEdit && userRole === 'ADMIN' && (
                      <select
                        value={selectedCategorie.is_visible ? 'Public' : 'Privé'}
                        onChange={async (e) => {
                          const val = e.target.value;
                          const newVis = val === 'Public';
                          showConfirm(`Changer la visibilité de la catégorie "${selectedCategorie.nom}" et de tous ses sous-thèmes ?`, async () => {
                            await toggleCategoriePublication(selectedCategorie.id, newVis);
                          });
                        }}
                        className="border-2 border-blue-300 rounded-md p-2 text-sm bg-white outline-none font-bold"
                      >
                        <option value="Public">Public 🌍</option>
                        <option value="Privé">Privé 🔒</option>
                      </select>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <div className={`w-5 h-5 rounded-full border border-black ${selectedTheme.is_visible ? 'bg-green-400' : 'bg-red-500'}`}></div>
                    )}
                    {canEdit && userRole === 'ADMIN' && (
                      <select
                        value={selectedTheme.is_visible ? 'Public' : 'Privé'}
                        onChange={async (e) => {
                          const val = e.target.value;
                          const newVis = val === 'Public';
                          showConfirm('Changer la visibilité du thème et de tous ses sous-thèmes ?', async () => {
                            await toggleThemePublication(selectedTheme.id, newVis);
                          });
                        }}
                        className="border-2 border-blue-300 rounded-md p-2 text-sm bg-white outline-none font-bold"
                      >
                        <option value="Public">Public 🌍</option>
                        <option value="Privé">Privé 🔒</option>
                      </select>
                    )}
                  </div>
                )}
              </div>
              )}
              
              {/* Affichage avec catégories ou sans */}
              {selectedCategorie ? (
                // Affichage d'une seule catégorie
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedCategorie.sous_themes
                    ?.filter(st => getSubThemeDisplayName(st).toLowerCase().includes(searchSubTheme.toLowerCase()))
                    .filter(st => isSubThemeVisibleForCurrentRole(st))
                    .map((st, i) => (
                    <div 
                      key={st.id || i} 
                      onClick={async () => { 
                        try {
                          const res = await axios.get(themesApiBase);
                          const freshTheme = res.data.find(t => t.id === selectedTheme.id);
                          const freshSubTheme = findSubThemeInTheme(freshTheme, st.id);
                          if (!freshSubTheme) return;
                          selectSubTheme(freshSubTheme);
                          setSavedCharts(freshSubTheme.charts_config || []);
                          setFormStep(4); 
                          setShowAll(false);
                        } catch (err) { console.error(err); }
                      }}
                      className={`relative cursor-pointer p-4 rounded-sm border border-[#9A4A2A] shadow-md text-[#6E001F] font-bold text-left hover:scale-[1.01] transition-transform min-h-[120px] ${st.archived ? 'bg-gray-600 line-through opacity-80 text-white' : 'bg-[#E6A76A]'}`}
                    >
                      {st.archived && (
                        <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded-full text-xs font-bold">🚫</div>
                      )}
                      <div className="text-[20px] leading-tight">
                        <span>{getSubThemeDisplayName(st)}</span>
                      </div>
                      {canEdit && userRole === 'ADMIN' && (
                        <div className="flex justify-center gap-2 mt-4 text-black">
                          <button onClick={(e) => { 
                            e.stopPropagation(); 
                            const rect = e.currentTarget.getBoundingClientRect(); 
                            const menuHeight = 200;
                            const menuWidth = 192; // w-48
                            const spaceBelow = window.innerHeight - rect.bottom;
                            const spaceRight = window.innerWidth - rect.left;
                            const top = spaceBelow > menuHeight ? rect.bottom + 8 : rect.top - menuHeight - 8;
                            const left = spaceRight > menuWidth ? rect.left : rect.right - menuWidth;
                            setSubActionMenuPos({ left, top }); 
                            setOpenSubActionMenu(openSubActionMenu === st.id ? null : st.id); 
                            setOpenActionMenu(null); 
                            setOpenThemeMenu(null);
                            setOpenSubThemeMenu(null);
                            setOpenCategorieMenu(null); 
                          }} className="bg-[#B89C5A] p-1 border border-black rounded shadow">✎</button>
                          <button onClick={(e) => { 
                            e.stopPropagation(); 
                            const rect = e.currentTarget.getBoundingClientRect(); 
                            const menuHeight = 150;
                            const menuWidth = 192; // w-48
                            const spaceBelow = window.innerHeight - rect.bottom;
                            const spaceRight = window.innerWidth - rect.left;
                            const top = spaceBelow > menuHeight ? rect.bottom + 8 : rect.top - menuHeight - 8;
                            const left = spaceRight > menuWidth ? rect.left : rect.right - menuWidth;
                            setSubThemeMenuPos({ left, top }); 
                            setOpenSubThemeMenu(openSubThemeMenu === st.id ? null : st.id); 
                            setOpenSubActionMenu(null); 
                            setOpenActionMenu(null); 
                            setOpenThemeMenu(null);
                            setOpenCategorieMenu(null);
                          }} className="bg-[#f0a38e] p-1 border border-black rounded shadow">⚙</button>
                        </div>
                      )}
                      {canEdit && userRole === 'ADMIN' && (
                        <div className={`absolute bottom-3 right-3 w-5 h-5 rounded-full border border-black ${st.is_visible ? 'bg-green-400' : 'bg-red-500'}`}></div>
                      )}
                    </div>
                  ))}
                </div>
              ) : selectedTheme.categories && selectedTheme.categories.length > 0 ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      <button
                        onClick={() => setSelectedVisitorCategoryId('all')}
                        className={`w-full text-left px-3 py-2 rounded-sm border font-bold text-[16px] uppercase tracking-wide transition-colors flex items-center gap-2 ${selectedVisitorCategoryId === 'all' ? 'bg-[#7A0A4A] text-white border-[#B03372]' : 'bg-[#7A0A4A] text-white/90 border-[#A85A84] hover:bg-[#5E0738]'}`}
                      >
                        <span className="text-[12px]">▸</span>
                        <span>{t('all')}</span>
                      </button>
                      {selectedTheme.categories
                        .slice()
                        .sort((a, b) => a.ordre - b.ordre)
                        .map(cat => (
                          <button
                            key={cat.id}
                            onClick={() => setSelectedVisitorCategoryId(String(cat.id))}
                            className={`w-full text-left px-3 py-2 rounded-sm border font-bold text-[16px] uppercase tracking-wide transition-colors flex items-center justify-between gap-2 ${String(selectedVisitorCategoryId) === String(cat.id) ? 'bg-[#7A0A4A] text-white border-[#B03372]' : 'bg-[#7A0A4A] text-white/90 border-[#A85A84] hover:bg-[#5E0738]'}`}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <span className="text-[12px] shrink-0">▸</span>
                              <span className="truncate">{getCategoryDisplayName(cat)}</span>
                            </span>
                            <span className="text-[12px] opacity-90">↗</span>
                          </button>
                        ))}
                    </div>

                    <div className="border-t border-[#B03372] opacity-70" />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(() => {
                        const sortedCats = (selectedTheme.categories || []).slice().sort((a, b) => a.ordre - b.ordre);
                        const allSubThemes = sortedCats.flatMap(cat =>
                          (cat.sous_themes || []).map(st => ({ ...st, category_id: cat.id, category_name: cat.nom, category_name_ar: cat.nom_ar, category_name_en: cat.nom_en }))
                        );
                        const scopedSubThemes = String(selectedVisitorCategoryId) === 'all'
                          ? allSubThemes
                          : allSubThemes.filter(st => String(st.category_id) === String(selectedVisitorCategoryId));

                        const byId = new Map();
                        scopedSubThemes.forEach(st => {
                          if (!byId.has(st.id)) byId.set(st.id, st);
                        });

                        return Array.from(byId.values())
                          .filter(st => getSubThemeDisplayName(st).toLowerCase().includes(searchSubTheme.toLowerCase()))
                          .filter(st => isSubThemeVisibleForCurrentRole(st))
                          .map((st, i) => (
                            <div
                              key={st.id || i}
                              onClick={async () => {
                                try {
                                  const res = await axios.get(themesApiBase);
                                  const freshTheme = res.data.find(t => t.id === selectedTheme.id);
                                  const freshSubTheme = findSubThemeInTheme(freshTheme, st.id);
                                  if (!freshSubTheme) return;
                                  selectSubTheme(freshSubTheme);
                                  setSavedCharts(freshSubTheme.charts_config || []);
                                  setFormStep(4);
                                  setShowAll(false);
                                } catch (err) { console.error(err); }
                              }}
                              className={`relative cursor-pointer p-4 rounded-sm border border-[#9A4A2A] shadow-md text-[#6E001F] font-bold text-left hover:scale-[1.01] transition-transform min-h-[120px] ${st.archived ? 'bg-gray-600 line-through opacity-80 text-white' : 'bg-[#E6A76A]'}`}
                            >
                              {st.archived && (
                                <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded-full text-xs font-bold">🚫</div>
                              )}
                              <div className="text-sm opacity-80 mb-2">{i18n.language === 'ar' ? (st.category_name_ar || st.category_name || st.category_name_en) : i18n.language === 'en' ? (st.category_name_en || st.category_name || st.category_name_ar) : (st.category_name || st.category_name_ar || st.category_name_en)}</div>
                              <div className="text-[20px] leading-tight">
                                <span>{getSubThemeDisplayName(st)}</span>
                              </div>
                              {canEdit && userRole === 'ADMIN' && (
                                <div className="flex justify-center gap-2 mt-4 text-black">
                                  <button onClick={(e) => {
                                    e.stopPropagation();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const menuHeight = 200;
                                    const menuWidth = 192;
                                    const spaceBelow = window.innerHeight - rect.bottom;
                                    const spaceRight = window.innerWidth - rect.left;
                                    const top = spaceBelow > menuHeight ? rect.bottom + 8 : rect.top - menuHeight - 8;
                                    const left = spaceRight > menuWidth ? rect.left : rect.right - menuWidth;
                                    setSubActionMenuPos({ left, top });
                                    setOpenSubActionMenu(openSubActionMenu === st.id ? null : st.id);
                                    setOpenActionMenu(null);
                                    setOpenThemeMenu(null);
                                    setOpenSubThemeMenu(null);
                                    setOpenCategorieMenu(null);
                                  }} className="bg-[#B89C5A] p-1 border border-black rounded shadow">✎</button>
                                  <button onClick={(e) => {
                                    e.stopPropagation();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const menuHeight = 150;
                                    const menuWidth = 192;
                                    const spaceBelow = window.innerHeight - rect.bottom;
                                    const spaceRight = window.innerWidth - rect.left;
                                    const top = spaceBelow > menuHeight ? rect.bottom + 8 : rect.top - menuHeight - 8;
                                    const left = spaceRight > menuWidth ? rect.left : rect.right - menuWidth;
                                    setSubThemeMenuPos({ left, top });
                                    setOpenSubThemeMenu(openSubThemeMenu === st.id ? null : st.id);
                                    setOpenSubActionMenu(null);
                                    setOpenActionMenu(null);
                                    setOpenThemeMenu(null);
                                    setOpenCategorieMenu(null);
                                  }} className="bg-[#f0a38e] p-1 border border-black rounded shadow">⚙</button>
                                </div>
                              )}
                              {canEdit && userRole === 'ADMIN' && (
                                <div className={`absolute bottom-3 right-3 w-5 h-5 rounded-full border border-black ${st.is_visible ? 'bg-green-400' : 'bg-red-500'}`}></div>
                              )}
                            </div>
                          ));
                      })()}
                    </div>
                  </div>
              ) : (
                // Affichage sans catégories (thèmes classiques)
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedTheme.sous_themes && selectedTheme.sous_themes
                    .filter(st => getSubThemeDisplayName(st).toLowerCase().includes(searchSubTheme.toLowerCase()))
                    .filter(st => isSubThemeVisibleForCurrentRole(st))
                    .map((st, i) => (
                    <div 
                      key={st.id || i} 
                      onClick={async () => { 
                        try {
                                  const res = await axios.get(themesApiBase);
                          const freshTheme = res.data.find(t => t.id === selectedTheme.id);
                          const freshSubTheme = findSubThemeInTheme(freshTheme, st.id);
                          if (!freshSubTheme) return;
                          selectSubTheme(freshSubTheme);
                          setSavedCharts(freshSubTheme.charts_config || []);
                          setFormStep(4); 
                          setShowAll(false);
                        } catch (err) { console.error(err); }
                      }}
                      className={`relative cursor-pointer p-4 rounded-sm border border-[#9A4A2A] shadow-md text-[#6E001F] font-bold text-left hover:scale-[1.01] transition-transform min-h-[120px] ${st.archived ? 'bg-gray-600 line-through opacity-80 text-white' : 'bg-[#E6A76A]'}`}
                    >
                      {st.archived && (
                        <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded-full text-xs font-bold">🚫</div>
                      )}
                      <div className="text-[20px] leading-tight">
                        <span>{getSubThemeDisplayName(st)}</span>
                      </div>
                      {canEdit && userRole === 'ADMIN' && (
                        <div className="flex justify-center gap-2 mt-4 text-black">
                          <button onClick={(e) => { 
                            e.stopPropagation(); 
                            const rect = e.currentTarget.getBoundingClientRect(); 
                            const menuHeight = 200;
                            const menuWidth = 192; // w-48
                            const spaceBelow = window.innerHeight - rect.bottom;
                            const spaceRight = window.innerWidth - rect.left;
                            const top = spaceBelow > menuHeight ? rect.bottom + 8 : rect.top - menuHeight - 8;
                            const left = spaceRight > menuWidth ? rect.left : rect.right - menuWidth;
                            setSubActionMenuPos({ left, top }); 
                            setOpenSubActionMenu(openSubActionMenu === st.id ? null : st.id); 
                            setOpenActionMenu(null); 
                            setOpenThemeMenu(null); 
                          }} className="bg-[#B89C5A] p-1 border border-black rounded shadow">✎</button>
                          <button onClick={(e) => { 
                            e.stopPropagation(); 
                            const rect = e.currentTarget.getBoundingClientRect(); 
                            const menuHeight = 150;
                            const menuWidth = 192; // w-48
                            const spaceBelow = window.innerHeight - rect.bottom;
                            const spaceRight = window.innerWidth - rect.left;
                            const top = spaceBelow > menuHeight ? rect.bottom + 8 : rect.top - menuHeight - 8;
                            const left = spaceRight > menuWidth ? rect.left : rect.right - menuWidth;
                            setSubThemeMenuPos({ left, top }); 
                            setOpenSubThemeMenu(openSubThemeMenu === st.id ? null : st.id); 
                            setOpenSubActionMenu(null); 
                            setOpenActionMenu(null); 
                            setOpenThemeMenu(null); 
                          }} className="bg-[#f0a38e] p-1 border border-black rounded shadow">⚙</button>
                        </div>
                      )}
                      {canEdit && userRole === 'ADMIN' && (
                        <div className={`absolute bottom-3 right-3 w-5 h-5 rounded-full border border-black ${st.is_visible ? 'bg-green-400' : 'bg-red-500'}`}></div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ÉTAPE 4 : DÉTAILS SOUS-THأˆME DÉVELOPPÉ */}
          {activeMenu === 'Themes' && formStep === 4 && selectedSubTheme && (
            <div className={`${isVisitor ? 'bg-white border border-[#b56695] shadow-[0_8px_24px_rgba(106,31,82,0.18)]' : 'bg-white border border-[#b8d4e3] shadow-[0_8px_24px_rgba(16,78,116,0.12)]'} p-6 rounded-2xl space-y-6`}>
              
              <div className="flex flex-wrap justify-between items-start gap-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setFormStep(3)}
                    className={`${isVisitor ? 'bg-[#7A0A4A] text-white border-[#B03372] hover:bg-[#5E0738]' : 'bg-[#7A0A4A] text-white border-[#5E0738] hover:bg-[#5E0738]'} w-12 h-12 rounded-xl border font-black text-2xl leading-none shadow-sm flex items-center justify-center`}
                    aria-label="Retour vers les sous-thèmes"
                    title="Retour"
                  >
                    &#8249;
                  </button>
                  <h3 className={`${isVisitor ? 'bg-[#7A0A4A] text-white border border-[#B03372]' : 'bg-[#F2E9D2] text-[#134f70] border border-[#CCB47F]'} px-6 py-2 rounded-xl font-bold text-base shadow-sm`}>
                    {getSubThemeDisplayName(selectedSubTheme)}
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  {canEdit && userRole === 'ADMIN' ? (
                    <>
                      <div className={`w-5 h-5 rounded-full border border-black ${selectedSubTheme.is_visible ? 'bg-green-400' : 'bg-red-500'}`}></div>
                      <select
                        value={selectedSubTheme.is_visible ? 'Public' : 'Privé'}
                        onChange={async (e) => {
                          const val = e.target.value;
                          const newVis = val === 'Public';
                          showConfirm('Changer le statut du sous-thème ?', async () => {
                            await toggleSubThemePublication(selectedSubTheme.id, newVis);
                          });
                        }}
                        className="flex-1 border-2 border-blue-300 rounded-md p-2 text-sm bg-white outline-none"
                      >
                        <option value="Public">Public</option>
                        <option value="Privé">Privé</option>
                      </select>
                    </>
                  ) : (
                    <div className="w-5 h-5 opacity-0" />
                  )}

                  {/* Bouton pour ouvrir la configuration Visiteur depuis la page du sous-thème */}
                  {canEdit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Ouvrir la modale localement sur cette page via événement global
                        try {
                          window.dispatchEvent(new CustomEvent('openVisitorConfig', { detail: selectedSubTheme.id }));
                        } catch {
                          const ev = document.createEvent('CustomEvent');
                          ev.initCustomEvent('openVisitorConfig', true, true, selectedSubTheme.id);
                          window.dispatchEvent(ev);
                        }
                        showToast('Ouverture configuration visiteur', 'info');
                      }}
                      className="h-11 px-4 inline-flex items-center justify-center rounded-xl border border-[#B03372] bg-[#7A0A4A] text-white text-sm font-semibold shadow-sm hover:bg-[#5E0738] transition"
                    >
                      ⚙ Visiteur
                    </button>
                  )}

                  <button onClick={(e) => { e.stopPropagation(); setShowAdvancedConfig(false); setSubThemeMeta(buildMetadataState(selectedSubTheme)); setShowSubThemeMeta(true); }} className={`${isVisitor ? 'bg-white text-[#5E0738] border-[#B88FA4] hover:bg-[#f7f0f4]' : 'bg-white text-[#134f70] border-[#CCB47F] hover:bg-[#f8f3e7]'} h-11 px-4 inline-flex items-center justify-center rounded-xl border text-sm font-semibold shadow-sm transition`}>{t('metadata')}</button>
                  {/* Saisisseur: Enregistrer / Envoyer au admin */}
                  {isSaisisseur && (
                    <>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const notes = collectCurrentSaisisseurDraftPayload();
                            await saveDraftAssignmentForSaisisseur(notes, 'En cours');
                          } catch (err) {
                            console.error(err);
                            alert('Impossible d\'enregistrer le brouillon');
                          }
                        }}
                        className="h-11 px-4 inline-flex items-center justify-center rounded-xl border border-[#d5deea] bg-white text-[#344054] text-sm font-semibold shadow-sm hover:bg-[#f7f9fc] transition"
                      >
                        Enregistrer (brouillon)
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSubmitConfirmOpen(true);
                        }}
                        className="h-11 px-4 inline-flex items-center justify-center rounded-xl border border-[#1e4db7] bg-[#2563eb] text-white text-sm font-semibold shadow-sm hover:bg-[#1d4ed8] transition"
                      >
                        Envoyer à l'admin
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* BOUTON CONFIGURATION AVANCÉE */}
              {canEdit && (
                <button onClick={(e) => { 
                    e.stopPropagation(); 
                    showToast('Ouverture configuration avancée', 'info'); 
                    const init = { niveau_geo: selectedSubTheme?.niveau_geo || null, type_unite: selectedSubTheme?.type_unite || '', est_sommable: selectedSubTheme?.est_sommable ?? true, filtres_disponibles: selectedSubTheme?.filtres_disponibles || [] };
                    setAdvancedConfig(init); 
                    setAdvancedConfigFiltersText(Array.isArray(init.filtres_disponibles) ? init.filtres_disponibles.join(', ') : String(init.filtres_disponibles || ''));
                    setShowAdvancedConfig(true); 
                  }} className="h-11 px-5 inline-flex items-center justify-center rounded-xl border border-[#60a5fa] bg-[#3b82f6] text-white text-sm font-semibold shadow-sm hover:bg-[#2563eb] transition">Configuration Avancée</button>
              )}

              <div className="flex justify-center">
                <div className={`${isVisitor ? 'bg-white border-[#B88FA4]' : 'bg-white border-[#CCB47F]'} inline-flex rounded-xl border p-1 shadow-sm`}>
                  <button
                    type="button"
                    onClick={() => setActiveDataTab('tableau')}
                    className={`px-6 py-2 rounded-lg font-bold text-sm tracking-wide transition-colors ${activeDataTab === 'tableau' ? (isVisitor ? 'bg-[#7A0A4A] text-white border border-[#b74a86]' : 'bg-[#7A0A4A] text-white border border-[#5E0738]') : (isVisitor ? 'text-[#5E0738] hover:bg-[#f3f3f3]' : 'text-[#5E0738] hover:bg-[#f3f3f3]')}`}
                  >
                    {t('tab_table')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDataTab('graphes')}
                    className={`px-6 py-2 rounded-lg font-bold text-sm tracking-wide transition-colors ${activeDataTab === 'graphes' ? (isVisitor ? 'bg-[#7A0A4A] text-white border border-[#b74a86]' : 'bg-[#7A0A4A] text-white border border-[#5E0738]') : (isVisitor ? 'text-[#5E0738] hover:bg-[#f3f3f3]' : 'text-[#5E0738] hover:bg-[#f3f3f3]')}`}
                  >
                    {t('tab_charts')}
                  </button>
                </div>
              </div>

              {/* TABLEAU AVEC FILTRES PAR COLONNE */}
              {activeDataTab === 'tableau' && (
              <div className="space-y-4">
                {/* FILTRES DYNAMIQUES - basés sur filtres_disponibles */}
                {filtersForRender && filtersForRender.length > 0 && (
                  <div className={`${isVisitor ? 'bg-white border-[#B88FA4]' : 'bg-white border-[#CCB47F]'} border rounded-lg p-3 space-y-3 w-fit shadow-sm`}>
                    <h3 className={`font-bold text-sm ${isVisitor ? 'text-[#5E0738]' : 'text-blue-900'}`}>🔎 {t('filters_available')}</h3>
                    <div className="flex flex-wrap gap-3">
                      {filtersForRender.map(filterCol => (
                        <div key={filterCol} className="relative">
                          <label className={`text-xs font-bold block mb-1 ${isVisitor ? 'text-[#5E0738]' : 'text-gray-700'}`}>{filterCol}</label>
                          <button
                            type="button"
                            className={`w-40 text-left px-3 py-1.5 border rounded-md bg-white outline-none text-xs font-medium ${isVisitor ? 'border-[#B88FA4] text-[#5E0738]' : 'border-[#CCB47F]'}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              // open popover and init temp selection from dynamicFilters
                              setOpenFilter(filterCol);
                              setTempFilterSelection(prev => {
                                const raw = dynamicFilters[filterCol];
                                const arr = Array.isArray(raw) ? raw : (raw ? [raw] : []);
                                return { ...(prev || {}), [filterCol]: new Set(arr.map(String)) };
                              });
                            }}
                          >
                            {(() => {
                              const cur = dynamicFilters[filterCol];
                              if (Array.isArray(cur) && cur.length > 0) return t('selected_count', { count: cur.length });
                              if (cur && !Array.isArray(cur)) {
                                return activeDataLanguage !== 'fr'
                                  ? getLocalizedValueLabel(filterCol, cur)
                                  : String(cur);
                              }
                              return t('all_option');
                            })()}
                          </button>

                          {openFilter === filterCol && (
                            <div className={`absolute z-50 left-0 top-full mt-2 bg-white border rounded-lg p-3 w-60 max-h-56 overflow-auto ${isVisitor ? 'border-[#B88FA4] shadow-[0_8px_22px_rgba(106,31,82,0.2)]' : 'border-[#CCB47F] shadow-[0_8px_22px_rgba(15,86,120,0.2)]'}`}>
                              <div className="flex flex-col gap-2">
                                {getUniqueValuesForColumn(filterCol).map(val => {
                                  const set = (tempFilterSelection && tempFilterSelection[filterCol]) || new Set();
                                  const checked = set.has(String(val));
                                  return (
                                    <label key={val} className="flex items-center gap-2 text-sm">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(ev) => {
                                          ev.stopPropagation();
                                          setTempFilterSelection(prev => {
                                            const copy = { ...(prev || {}) };
                                            const s = new Set(copy[filterCol] || []);
                                            if (s.has(String(val))) s.delete(String(val)); else s.add(String(val));
                                            copy[filterCol] = s;
                                            return copy;
                                          });
                                        }}
                                      />
                                      <span>{activeDataLanguage !== 'fr' ? getLocalizedValueLabel(filterCol, val) : val}</span>
                                    </label>
                                  );
                                })}
                              </div>
                              <div className="flex justify-between items-center gap-2 mt-3">
                                <div className="text-xs text-gray-600">{t('options_count', { count: getUniqueValuesForColumn(filterCol).length })}</div>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    className={`px-3 py-1.5 text-white rounded-md text-xs font-semibold ${isVisitor ? 'bg-[#7A0A4A] hover:bg-[#5E0738]' : 'bg-[#7A0A4A]'}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const s = (tempFilterSelection && tempFilterSelection[filterCol]) || new Set();
                                      setDynamicFilters(prev => ({ ...prev, [filterCol]: Array.from(s) }));
                                      setOpenFilter(null);
                                    }}
                                  >{t('apply')}</button>
                                  <button type="button" className="px-3 py-1.5 bg-gray-100 rounded-md text-xs" onClick={(e) => { e.stopPropagation(); setOpenFilter(null); }}>{t('close')}</button>
                                  <button
                                    type="button"
                                    className="px-3 py-1.5 bg-red-500 text-white rounded-md text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTempFilterSelection(prev => ({ ...(prev || {}), [filterCol]: new Set() }));
                                      setDynamicFilters(prev => ({ ...prev, [filterCol]: [] }));
                                      setOpenFilter(null);
                                    }}
                                  >{t('clear')}</button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isVisitor && (
                  <div className="space-y-2">
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => setVisitorTableView('horizontal')}
                        className={`px-4 py-2 border rounded-lg font-bold text-sm shadow-sm transition-colors ${activeVisitorView === 'horizontal' ? (isVisitor ? 'bg-[#7A0A4A] text-white border-[#b74a86]' : 'bg-[#7A0A4A] text-white border-[#5E0738]') : (isVisitor ? 'bg-white text-[#5E0738] border-[#B88FA4] hover:bg-[#f3f3f3]' : 'bg-white text-[#5E0738] border-[#CCB47F] hover:bg-[#f3f3f3]')}`}
                      >{t('horizontal_view')}</button>
                      <button
                        onClick={() => canVisitorVerticalView && setVisitorTableView('vertical')}
                        disabled={!canVisitorVerticalView}
                        className={`px-4 py-2 border rounded-lg font-bold text-sm shadow-sm transition-colors ${activeVisitorView === 'vertical' ? (isVisitor ? 'bg-[#7A0A4A] text-white border-[#b74a86]' : 'bg-[#7A0A4A] text-white border-[#5E0738]') : (isVisitor ? 'bg-white text-[#5E0738] border-[#B88FA4] hover:bg-[#f3f3f3]' : 'bg-white text-[#5E0738] border-[#CCB47F] hover:bg-[#f3f3f3]')} ${!canVisitorVerticalView ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >{t('vertical_view')}</button>
                    </div>

                    {!canVisitorVerticalView && (
                      <div className="text-xs text-[#7A0A4A] bg-[#fdf4f8] border border-[#e8c7d8] rounded-md px-3 py-2">
                        Vue verticale indisponible: {visitorVerticalMatrix?.reason || visitorMatrix?.reason || 'configuration incomplète'}.
                      </div>
                    )}
                  </div>
                )}

                <div className={`${isVisitor ? 'border-2 border-[#A85A84] rounded-xl bg-white shadow-[0_2px_12px_rgba(106,31,82,0.14)]' : 'border-2 border-black rounded-lg bg-white shadow-inner'} overflow-auto max-h-[28rem]`}>
                  {isVisitor && activeVisitorView === 'vertical' && visitorVerticalMatrix?.canVertical ? (
                    <>
                      <div className="sticky top-0 z-20 bg-white border-b border-[#CCB47F] px-4 py-2 text-xs text-[#3F2A1F] font-medium">
                        <span>{t('row_count', { count: (visitorVerticalMatrix.rows || []).length })}</span>
                        <span className="mx-2">•</span>
                        <span>{t('hierarchy_count', { count: (visitorVerticalMatrix.hierarchyCols || []).length })}</span>
                      </div>
                      <table className="w-full border-collapse text-base">
                        <thead className="sticky top-[33px] z-10 bg-gradient-to-r from-[#7A0A4A] to-[#B03372] text-white border-b border-[#7b1e5a] shadow-[inset_0_-1px_0_0_rgba(123,30,90,0.55)]">
                          {(() => {
                            const headerRows = visitorVerticalMatrix.headerRows || [];
                            const rowCols = visitorVerticalMatrix.rowCols || [];
                            if (headerRows.length === 0) return null;
                            return (
                              <>
                                <tr>
                                  {rowCols.map(col => (
                                    <th key={`rowcol-${col}`} rowSpan={headerRows.length} className="p-4 border-r border-[#7b1e5a] min-w-[150px] text-center uppercase tracking-wide font-bold text-base">{translateDataValue(col)}</th>
                                  ))}
                                  {(headerRows[0].cells || []).map(cell => (
                                    <th key={cell.key} colSpan={cell.colSpan} className="p-4 border-r border-[#7b1e5a] text-center font-bold text-base">{cell.label}</th>
                                  ))}
                                </tr>
                                {headerRows.slice(1).map((row, ridx) => (
                                  <tr key={`hrow-${ridx + 1}`}>
                                    {(row.cells || []).map(cell => (
                                      <th key={cell.key} colSpan={cell.colSpan} className="p-2 border-r border-[#7b1e5a] text-center font-semibold text-sm bg-[#8a2f67]">{cell.label}</th>
                                    ))}
                                  </tr>
                                ))}
                              </>
                            );
                          })()}
                        </thead>
                        <tbody>
                          {(() => {
                            const displayedRows = showAll ? (visitorVerticalMatrix.rows || []) : (visitorVerticalMatrix.rows || []).slice(0, 8);
                            const rowCols = visitorVerticalMatrix.rowCols || [];
                            const leaves = visitorVerticalMatrix.leaves || [];

                            const formatValue = (val) => {
                              if (val === null || val === undefined || val === '') return '—';
                              if (typeof val === 'number') {
                                return Number.isInteger(val)
                                  ? formatLocalizedNumber(val)
                                  : formatLocalizedNumber(val, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                              }
                              const n = Number(String(val).replace(/,/g, '.'));
                              if (!Number.isNaN(n)) {
                                return Number.isInteger(n)
                                  ? formatLocalizedNumber(n)
                                  : formatLocalizedNumber(n, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                              }
                              return String(val);
                            };

                            const rowCount = displayedRows.length;
                            const spans = {};
                            const isPeriodCol = (colName) => isPeriodColumnIdentifier(colName);
                            rowCols.forEach((col, colIndex) => {
                              spans[col] = new Array(rowCount).fill(0);
                              let i = 0;
                              while (i < rowCount) {
                                const curVal = String(displayedRows[i]?.dimensions?.[col] ?? '—');
                                let j = i + 1;
                                while (j < rowCount) {
                                  const sameVal = String(displayedRows[j]?.dimensions?.[col] ?? '—') === curVal;
                                  if (!sameVal) break;
                                  let samePrefix = true;
                                  for (let p = 0; p < colIndex; p++) {
                                    const prevCol = rowCols[p];
                                    if (isPeriodCol(prevCol)) continue;
                                    const leftAtI = String(displayedRows[i]?.dimensions?.[prevCol] ?? '—');
                                    const leftAtJ = String(displayedRows[j]?.dimensions?.[prevCol] ?? '—');
                                    if (leftAtI !== leftAtJ) { samePrefix = false; break; }
                                  }
                                  if (!samePrefix) break;
                                  j += 1;
                                }
                                spans[col][i] = j - i;
                                i = j;
                              }
                            });

                            return displayedRows.map((row, i) => (
                              <tr key={row.key || i} className={`${row.isTotal ? 'bg-[#f5f5f5] font-semibold' : (i % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]')} border-b border-[#CCB47F]`}>
                                {rowCols.map(col => {
                                  const span = spans[col][i] || 0;
                                  if (span === 0) return null;
                                  const isYearCol = isPeriodColumnIdentifier(col);
                                  const isProvinceCol = /(province|prefecture|préfecture|region|région|wilaya|عمالة|إقليم|جهة)/i.test(String(col).toLowerCase());
                                  return (
                                    <td
                                      key={`${row.key}-${col}`}
                                      rowSpan={span}
                                      className={`p-4 border-r border-[#D6BE8C] text-[#3F2A1F] ${(isYearCol || isProvinceCol) ? 'text-center align-middle' : 'text-left align-top'}`}
                                    >
                                      <span className={`font-semibold ${(isYearCol || isProvinceCol) ? 'text-2xl leading-snug' : ''}`}>{translateDataValue(String(row?.dimensions?.[col] ?? '—'))}</span>
                                    </td>
                                  );
                                })}
                                {leaves.map((leaf, idx) => (
                                  <td key={`${row.key}-${leaf.key}`} className={`p-4 border-r border-[#DCC897] text-center align-middle text-[#4A062E] text-base tabular-nums ${idx === leaves.length - 1 ? 'bg-[#f7f7f7] font-semibold' : ''}`}>
                                    {formatValue(row?.cells?.[leaf.key])}
                                  </td>
                                ))}
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </>
                  ) : isVisitor && visitorMatrix?.canPivot ? (
                    <>
                      <div className="sticky top-0 z-20 bg-white border-b border-[#CCB47F] px-4 py-2 text-xs text-[#3F2A1F] font-medium">
                        <span>{t('row_count', { count: (visitorMatrix.rows || []).length })}</span>
                        <span className="mx-2">•</span>
                        <span>{t('period_count', { count: (visitorMatrix.periods || []).length })}</span>
                        {visitorMatrix.periods?.length > 0 && (
                          <>
                            <span className="mx-2">•</span>
                            <span>{t('latest_period', { value: visitorMatrix.periods[visitorMatrix.periods.length - 1] })}</span>
                          </>
                        )}
                      </div>
                      <table className="w-full border-collapse text-base">
                      <thead className="sticky top-[33px] z-10 bg-gradient-to-r from-[#7A0A4A] to-[#B03372] text-white border-b border-[#7b1e5a] shadow-[inset_0_-1px_0_0_rgba(123,30,90,0.55)]">
                        <tr>
                          {(visitorMatrix.displayGroupCols || []).map(col => (
                            <th key={col} className="p-4 border-r border-[#7b1e5a] min-w-[170px] text-center uppercase tracking-wide font-bold text-base">{translateDataValue(col)}</th>
                          ))}
                          {visitorMatrix.periods.map((period, idx) => (
                            <th key={period} className={`p-4 border-r border-[#7b1e5a] min-w-[110px] text-center font-bold text-base ${idx === visitorMatrix.periods.length - 1 ? 'bg-[#8a2f67]' : ''}`}>{period}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const displayedRows = showAll ? (visitorMatrix.rows || []) : (visitorMatrix.rows || []).slice(0, 8);
                          const groupCols = visitorMatrix.displayGroupCols || [];
                          const formatValue = (val) => {
                            if (val === null || val === undefined || val === '') return '—';
                            if (typeof val === 'number') {
                              return Number.isInteger(val)
                                ? formatLocalizedNumber(val)
                                : formatLocalizedNumber(val, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                            }
                            const n = Number(String(val).replace(/,/g, '.'));
                            if (!Number.isNaN(n)) {
                              return Number.isInteger(n)
                                ? formatLocalizedNumber(n)
                                : formatLocalizedNumber(n, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                            }
                            return String(val);
                          };

                          const rowCount = displayedRows.length;
                          const spans = {};
                          groupCols.forEach((col, colIndex) => {
                            spans[col] = new Array(rowCount).fill(0);
                            let i = 0;
                            while (i < rowCount) {
                              const curVal = String(displayedRows[i]?.dimensions?.[col] ?? '—');
                              let j = i + 1;
                              while (j < rowCount) {
                                const sameVal = String(displayedRows[j]?.dimensions?.[col] ?? '—') === curVal;
                                if (!sameVal) break;
                                let samePrefix = true;
                                for (let p = 0; p < colIndex; p++) {
                                  const prevCol = groupCols[p];
                                  const leftAtI = String(displayedRows[i]?.dimensions?.[prevCol] ?? '—');
                                  const leftAtJ = String(displayedRows[j]?.dimensions?.[prevCol] ?? '—');
                                  if (leftAtI !== leftAtJ) {
                                    samePrefix = false;
                                    break;
                                  }
                                }
                                if (!samePrefix) break;
                                j += 1;
                              }
                              spans[col][i] = j - i;
                              i = j;
                            }
                          });

                          const latestPeriod = visitorMatrix.periods[visitorMatrix.periods.length - 1];
                          return displayedRows.map((row, i) => (
                            <tr key={row.key || i} className={`${row.isTotal ? 'bg-[#f5f5f5] font-semibold' : (i % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]')} border-b border-[#CCB47F]`}>
                              {groupCols.map((col, colIndex) => {
                                const span = spans[col][i] || 0;
                                if (span === 0) return null;
                                const value = String(row?.dimensions?.[col] ?? '—');
                                const isTotalCell = /(total|totale|tous|toutes|tout|ensemble)/i.test(value.toLowerCase());
                                const isMergedCell = span > 1;
                                const mergedSizeClass = span >= 10 ? 'text-2xl leading-tight' : (span >= 4 ? 'text-xl leading-tight' : (span >= 2 ? 'text-lg' : ''));
                                return (
                                  <td key={`${row.key}-${col}`} rowSpan={span} className={`p-4 border-r border-[#D6BE8C] text-[#3F2A1F] ${isMergedCell ? 'text-center align-middle' : 'text-left align-top'}`}>
                                    <span className={`font-semibold ${isMergedCell ? mergedSizeClass : ''}`}>{translateDataValue(value)}</span>
                                    {isTotalCell && colIndex === groupCols.length - 1 && (
                                      <span className="ml-2 inline-block text-[10px] px-2 py-0.5 rounded-full bg-[#7A0A4A] text-white uppercase tracking-wide">{t('total')}</span>
                                    )}
                                  </td>
                                );
                              })}
                              {visitorMatrix.periods.map(period => (
                                  <td key={`${row.key}-${period}`} className={`p-4 border-r border-[#DCC897] text-center align-middle text-[#4A062E] text-base tabular-nums ${period === latestPeriod ? 'bg-[#f7f7f7] font-semibold' : ''}`}>{formatValue(row.values?.[period])}</td>
                              ))}
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                    </>
                  ) : (
                    <table className="w-full border-collapse text-base">
                      <thead className={`sticky top-0 z-10 ${isVisitor ? 'bg-gradient-to-r from-[#7A0A4A] to-[#B03372] border-[#7b1e5a] shadow-[inset_0_-1px_0_0_rgba(123,30,90,0.55)]' : 'bg-gradient-to-r from-[#7A0A4A] to-[#B03372] border-[#5E0738] shadow-[inset_0_-1px_0_0_rgba(11,94,131,0.55)]'} text-white border-b font-bold`}>
                        <tr>
                          {visibleColumnsForRender.map(col => (
                            <th key={col} className={`p-4 border-r ${isVisitor ? 'border-[#7b1e5a]' : 'border-[#5E0738]'} min-w-[160px] text-center uppercase tracking-wide font-bold text-sm`}>
                              <div className="uppercase text-sm tracking-wide font-bold text-white text-center">{getLocalizedColumnLabel(col, activeDataLanguage) || translateDataValue(col)}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const displayedRows = showAll ? filteredData : filteredData.slice(0, isVisitor ? 8 : 3);
                          const rowCount = displayedRows.length;
                          const isValueColumn = (colName) => /(valeur|value|%|taux|montant|effectif|القيمة)/i.test(String(colName || '').toLowerCase());
                          const spans = {};
                          visibleColumnsForRender.forEach((col, colIndex) => {
                            const valueColumn = isValueColumn(col);
                            spans[col] = new Array(rowCount).fill(0);
                            let i = 0;
                            while (i < rowCount) {
                              if (valueColumn) {
                                spans[col][i] = 1;
                                i += 1;
                                continue;
                              }
                              const curVal = String((displayedRows[i] && displayedRows[i][col]) ?? '');
                              let j = i + 1;
                              while (j < rowCount) {
                                const sameVal = String((displayedRows[j] && displayedRows[j][col]) ?? '') === curVal;
                                if (!sameVal) break;
                                let samePrefix = true;
                                for (let p = 0; p < colIndex; p++) {
                                  const prevCol = visibleColumnsForRender[p];
                                  if (isValueColumn(prevCol)) continue;
                                  const leftAtI = String((displayedRows[i] && displayedRows[i][prevCol]) ?? '');
                                  const leftAtJ = String((displayedRows[j] && displayedRows[j][prevCol]) ?? '');
                                  if (leftAtI !== leftAtJ) {
                                    samePrefix = false;
                                    break;
                                  }
                                }
                                if (!samePrefix) break;
                                j += 1;
                              }
                              spans[col][i] = j - i;
                              i = j;
                            }
                          });

                          return displayedRows.map((row, i) => (
                            <tr key={i} className={`${i % 2 === 0 ? 'bg-white' : (isVisitor ? 'bg-[#fafafa]' : 'bg-[#f8fcff]')} border-b ${isVisitor ? 'border-[#CCB47F] hover:bg-[#f3f3f3]' : 'border-[#D8C49A] hover:bg-[#F7F1E3]'} min-h-10`}>
                              {visibleColumnsForRender.map((col) => {
                                const span = spans[col][i] || 0;
                                if (span === 0) return null;
                                const isNumericCol = isValueColumn(col);
                                const isMergedCell = span > 1;
                                const mergedSizeClass = span >= 10 ? 'text-2xl leading-tight' : (span >= 4 ? 'text-xl leading-tight' : (span >= 2 ? 'text-lg' : ''));
                                return (
                                  <td key={col} rowSpan={span} className={`border-r ${isVisitor ? 'border-[#D6BE8C]' : 'border-[#D8C49A]'} p-3 text-base ${isMergedCell ? 'text-center align-middle' : 'text-center align-middle'} ${isNumericCol ? (isVisitor ? 'tabular-nums text-[#4A062E] font-medium' : 'tabular-nums text-[#5E0738] font-medium') : (isVisitor ? 'text-[#3F2A1F]' : 'text-[#3F2A1F]')}`}>
                                    <span className={`${isMergedCell ? mergedSizeClass : 'text-[1.02rem]'} ${isNumericCol ? 'inline-block w-full text-center' : 'font-semibold'}`}>{isNumericCol ? row[col] : translateDataValue(row[col])}</span>
                                  </td>
                                );
                              })}
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  )}
                </div>
                <div className="flex flex-wrap gap-4 items-center justify-between">
                  <button onClick={() => setShowAll(!showAll)} className="h-11 px-5 inline-flex items-center justify-center rounded-xl border border-[#8a632b] bg-[#9E6F2F] text-white text-sm font-semibold shadow-sm hover:bg-[#875c26] transition">
                    {showAll ? t('reduce_table') : (isVisitor ? t('show_more_rows') : t('show_all_table'))}
                  </button>

                  {canEdit && (userRole === 'ADMIN' || isSaisisseur) && (
                    <button onClick={openEditTable} className="h-11 px-5 inline-flex items-center justify-center rounded-xl border border-[#d9b45f] bg-[#ffd56b] text-[#1f2937] text-sm font-semibold shadow-sm hover:bg-[#f7c94d] transition">Modifier le tableau</button>
                  )}

                  <div className="flex gap-2">
                    <button onClick={exportTableXLSX} className="h-11 px-4 inline-flex items-center justify-center rounded-xl border border-[#1d2730] bg-[#2f3b47] text-white text-sm font-semibold shadow-sm hover:bg-[#26313c] transition">{t('export_xlsx')}</button>
                    <button onClick={exportTableCSV} className="h-11 px-4 inline-flex items-center justify-center rounded-xl border border-[#1d2730] bg-[#2f3b47] text-white text-sm font-semibold shadow-sm hover:bg-[#26313c] transition">{t('export_csv')}</button>
                    <button onClick={exportTableTXT} className="h-11 px-4 inline-flex items-center justify-center rounded-xl border border-[#1d2730] bg-[#2f3b47] text-white text-sm font-semibold shadow-sm hover:bg-[#26313c] transition">{t('export_txt')}</button>
                  </div>
                </div>
              </div>
              )}

              {/* ZONE DES GRAPHIQUES GÉNÉRÉS */}
              {activeDataTab === 'graphes' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  {(() => {
                    const chartsToRender = (savedCharts || []).filter(c => (getFilteredChartData(c) || []).length > 0);
                    if (!chartsToRender || chartsToRender.length === 0) {
                      return (<div className="text-gray-600 italic">Aucun graphique disponible (pas de données après filtrage)</div>);
                    }

                    return chartsToRender.map((chart) => {
                      const baseChartData = getFilteredChartData(chart);
                    // Resolve stored column names against real row keys for current data language.
                    const inferChartDataKey = (rows, columnName) => {
                      if (!columnName) return '';
                      const localized = getLocalizedColumnLabel(columnName);
                      const hasLocalized = (rows || []).some((r) => r && r[localized] !== undefined);
                      if (hasLocalized) return localized;
                      const hasRaw = (rows || []).some((r) => r && r[columnName] !== undefined);
                      if (hasRaw) return columnName;
                      return localized || columnName;
                    };
                    const chartXKey = inferChartDataKey(baseChartData, chart.x);
                    const chartYKey = chart.y ? inferChartDataKey(baseChartData, chart.y) : '';
                    const chartGroupByKey = chart.group_by ? inferChartDataKey(baseChartData, chart.group_by) : '';
                    const chartXAxisLabel = translateDataValue(chart.x_label || chart.x);
                    const chartYAxisLabel = translateDataValue(chart.y_label || (selectedSubTheme?.type_unite || ''));
                    const chartTitle = activeDataLanguage === 'ar'
                      ? (chart.title_ar || chart.title)
                      : activeDataLanguage === 'en'
                        ? (chart.title_en || chart.title)
                        : chart.title;
                    const chartMesure = activeDataLanguage === 'ar'
                      ? (chart.mesure_ar || chart.mesure)
                      : activeDataLanguage === 'en'
                        ? (chart.mesure_en || chart.mesure)
                        : chart.mesure;
                    // Apply per-chart visible filters (visitor and saisisseur UI)
                    const visitorFiltersList = chart.visible_filters || [];
                    const visitorValues = chartVisitorFilters[chart.id] || {};
                    const canUseChartVisibleFilters = isVisitor || isSaisisseur || userRole === 'ADMIN';
                    let chartData = baseChartData;
                    if (canUseChartVisibleFilters && visitorFiltersList && visitorFiltersList.length > 0) {
                      const norm = visitorFiltersList.map(item => (typeof item === 'string' ? { column: item, default: '' } : item || {}));
                      const buildValueCandidates = (columnName, value) => {
                        const candidates = new Set();
                        const push = (v) => {
                          if (v === null || v === undefined || v === '') return;
                          const raw = String(v);
                          const normalized = normalizeDataToken(raw);
                          if (normalized) candidates.add(normalized);
                        };

                        push(value);
                        push(getCanonicalValueCode(columnName, value));
                        push(getLocalizedValueLabel(columnName, value, 'fr'));
                        push(getLocalizedValueLabel(columnName, value, 'ar'));
                        push(getLocalizedValueLabel(columnName, value, 'en'));
                        return candidates;
                      };

                      norm.forEach(vf => {
                        const col = vf.column;
                        const colKey = getLocalizedColumnLabel(col);
                        const fallbackDefault = vf.default ? getLocalizedValueLabel(col, vf.default) : '';
                        const val = visitorValues[colKey] !== undefined ? visitorValues[colKey] : fallbackDefault;
                        const localizedVal = getLocalizedValueLabel(col, val);
                        if (col && (val || localizedVal)) {
                          const selectedCandidates = new Set([
                            ...buildValueCandidates(col, val),
                            ...buildValueCandidates(col, localizedVal),
                          ]);
                          chartData = chartData.filter(row => {
                            const rowRaw = row[colKey] ?? row[col] ?? '';
                            const rowCandidates = buildValueCandidates(col, rowRaw);
                            for (const candidate of rowCandidates) {
                              if (selectedCandidates.has(candidate)) return true;
                            }
                            return false;
                          });
                        }
                      });
                    }

                    // If chart defines a grouping column, prepare multi-series data
                    let multiSeries = null;
                    if (chartGroupByKey) {
                      const groupValues = Array.from(new Set((chartData || []).map(r => String(r[chartGroupByKey] ?? '')))).filter(g => g !== '');
                      const xValues = Array.from(new Set((chartData || []).map(r => String(r[chartXKey] ?? '')))).sort();
                      const aggregation = {};
                      (chartData || []).forEach(r => {
                        const xVal = String(r[chartXKey] ?? 'N/A');
                        const g = String(r[chartGroupByKey] ?? 'N/A');
                        const raw = r[chartYKey];
                        const val = raw === null || raw === undefined || raw === '' ? 0 : parseFloat(String(raw).replace(/,/g, '.')) || 0;
                        aggregation[xVal] = aggregation[xVal] || {};
                        aggregation[xVal][g] = (aggregation[xVal][g] || 0) + val;
                      });
                      const seriesData = xValues.map(xVal => {
                        const obj = { [chartXKey]: xVal };
                        groupValues.forEach(g => { obj[g] = (aggregation[xVal] && aggregation[xVal][g]) ? aggregation[xVal][g] : 0; });
                        return obj;
                      });
                      const seriesScatterData = {};
                      groupValues.forEach(g => {
                        seriesScatterData[g] = xValues.map(xVal => ({
                          [chartXKey]: xVal,
                          [chartYKey]: (aggregation[xVal] && aggregation[xVal][g]) ? aggregation[xVal][g] : 0,
                        }));
                      });
                      multiSeries = { seriesData, groupValues, seriesScatterData };
                    }

                    // Translate x-axis category values and group labels for Arabic display
                    if (isArabicDataView) {
                      if (chartData) {
                        chartData = chartData.map(r => {
                          const row = { ...r };
                          if (chartXKey && row[chartXKey] !== undefined) {
                            row[chartXKey] = translateDataValue(row[chartXKey]);
                          }
                          return row;
                        });
                      }
                      if (multiSeries) {
                        const origGroups = multiSeries.groupValues;
                        const transGroups = origGroups.map(g => translateDataValue(g));
                        const newSeriesData = multiSeries.seriesData.map(r => {
                          const row = {};
                          row[chartXKey] = translateDataValue(r[chartXKey]);
                          origGroups.forEach((g, i) => { row[transGroups[i]] = r[g]; });
                          return row;
                        });
                        const newScatterData = {};
                        origGroups.forEach((g, i) => {
                          newScatterData[transGroups[i]] = (multiSeries.seriesScatterData[g] || []).map(d => ({
                            ...d,
                            [chartXKey]: translateDataValue(d[chartXKey]),
                          }));
                        });
                        multiSeries = { ...multiSeries, groupValues: transGroups, seriesData: newSeriesData, seriesScatterData: newScatterData };
                      }
                    }

                    return (
                      <div key={chart.id} className="border-2 border-[#d6b978] p-5 md:p-6 rounded-2xl bg-[#fffdfa] shadow-[0_10px_24px_rgba(17,24,39,0.08)] relative">
                        {canEdit && (
                          <div className="absolute top-4 right-4 flex gap-2">
                            <button onClick={() => openEditModal(chart)} className="bg-blue-500 text-white px-3 py-1 rounded border border-black text-xs font-bold shadow">Modifier</button>
                            <button onClick={() => deleteChart(chart.id)} className="bg-red-500 text-white px-3 py-1 rounded border border-black text-xs font-bold shadow">Supprimer</button>
                          </div>
                        )}
                        
                        {/* Visible-filters controls (shown for visitor, saisisseur, and admin) */}
                        {canUseChartVisibleFilters && visitorFiltersList && visitorFiltersList.length > 0 && (
                          <div className="mb-4 p-3 bg-[#fff8ef] border border-[#e5cf9d] rounded-xl inline-block max-w-full">
                            <div className="text-[10px] font-bold uppercase tracking-wide text-[#7A0A4A] mb-2">
                              {activeDataLanguage === 'ar' ? 'مرشحات المخطط' : activeDataLanguage === 'en' ? 'Chart filters' : 'Filtres du graphe'}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                            {(visitorFiltersList || []).map((vf, idx) => {
                              const col = (typeof vf === 'string') ? vf : (vf && vf.column) || '';
                              const colKey = getLocalizedColumnLabel(col);
                              const colLabel = getLocalizedColumnLabel(col);
                              const fallbackDefault = (vf && vf.default) ? getLocalizedValueLabel(col, vf.default) : '';
                              const currentVal = (chartVisitorFilters[chart.id] || {})[colKey] || fallbackDefault || '';
                              return (
                                <div key={`${chart.id}-vf-${idx}`} className="flex items-center gap-1.5">
                                  <label className="font-semibold text-xs text-[#4d1734] shrink-0">{colLabel || 'Colonne'}</label>
                                  <select
                                    className="min-w-[140px] max-w-[220px] px-2.5 py-1.5 border border-[#d3b883] rounded-md bg-white text-[#4d1734] text-sm font-medium outline-none focus:border-[#7A0A4A] focus:ring-1 focus:ring-[#f0d6e4]"
                                    value={currentVal}
                                    onChange={e => {
                                      const newMap = { ...(chartVisitorFilters || {}) };
                                      newMap[chart.id] = { ...(newMap[chart.id] || {}) };
                                      newMap[chart.id][colKey] = e.target.value;
                                      setChartVisitorFilters(newMap);
                                    }}
                                  >
                                    <option value="">{t('all_option')}</option>
                                    {col && getUniqueValuesForColumn(col).map(v => <option key={v} value={getLocalizedValueLabel(col, v)}>{getLocalizedValueLabel(col, v)}</option>)}
                                  </select>
                                </div>
                              );
                            })}
                            </div>
                          </div>
                        )}

                        {chartTitle && (
                          <h3 className="text-2xl md:text-[30px] font-extrabold text-center mb-3 text-[#4d1734]">{chartTitle}</h3>
                        )}

                        <div className={`${chartContainerHeightClass} w-full mt-4 bg-white border border-[#eedab0] rounded-xl p-3 md:p-4`}>
                          <ResponsiveContainer width="100%" height="100%">
                            {chart.type === 'Histogramme' ? (
                              multiSeries ? (
                                (() => {
                                  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#B19CD9', '#FF6F91', '#6B7280', '#10B981'];
                                  return (
                                    <BarChart data={multiSeries.seriesData} margin={chartMargin}>
                                      <CartesianGrid strokeDasharray="3 3" />
                                      <XAxis dataKey={chartXKey} label={{ value: chartXAxisLabel, position: 'insideBottom', offset: -5 }} />
                                      <YAxis {...chartYAxisProps} label={{ value: chartYAxisLabel, angle: -90, position: 'insideLeft' }} />
                                      <Tooltip content={<CustomTooltip />} />
                                      <Legend />
                                      {multiSeries.groupValues.map((g, idx) => (
                                        <Bar key={g} dataKey={g} fill={COLORS[idx % COLORS.length]} />
                                      ))}
                                    </BarChart>
                                  );
                                })()
                              ) : (
                                <BarChart data={chartData} barCategoryGap="18%" barGap={6} margin={chartMargin}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey={chartXKey} label={{ value: chartXAxisLabel, position: 'insideBottom', offset: -5 }} />
                                  <YAxis {...chartYAxisProps} label={{ value: chartYAxisLabel, angle: -90, position: 'insideLeft' }} />
                                  <Tooltip content={<CustomTooltip />} />
                                  <Bar dataKey={chartYKey} fill="#7A0A4A" />
                                </BarChart>
                              )
                            ) : chart.type === 'Courbes' ? (
                              multiSeries ? (
                                (() => {
                                  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#B19CD9', '#FF6F91', '#6B7280', '#10B981'];
                                  return (
                                    <LineChart data={multiSeries.seriesData} margin={chartMargin}>
                                      <CartesianGrid strokeDasharray="3 3" />
                                      <XAxis dataKey={chartXKey} label={{ value: chartXAxisLabel, position: 'insideBottom', offset: -5 }} />
                                      <YAxis {...chartYAxisProps} label={{ value: chartYAxisLabel, angle: -90, position: 'insideLeft' }} />
                                      <Tooltip content={<CustomTooltip />} />
                                      <Legend />
                                      {multiSeries.groupValues.map((g, idx) => (
                                        <Line key={g} type="monotone" dataKey={g} stroke={COLORS[idx % COLORS.length]} strokeWidth={3} dot={false} />
                                      ))}
                                    </LineChart>
                                  );
                                })()
                              ) : (
                                <LineChart data={chartData} margin={chartMargin}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey={chartXKey} label={{ value: chartXAxisLabel, position: 'insideBottom', offset: -5 }} />
                                  <YAxis {...chartYAxisProps} label={{ value: chartYAxisLabel, angle: -90, position: 'insideLeft' }} />
                                  <Tooltip content={<CustomTooltip />} />
                                  <Line type="monotone" dataKey={chartYKey} stroke="#7A0A4A" strokeWidth={3} />
                                </LineChart>
                              )
                            ) : chart.type === 'Nuage de points' ? (
                              multiSeries ? (
                                (() => {
                                  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#B19CD9', '#FF6F91', '#6B7280', '#10B981'];
                                  return (
                                    <ScatterChart margin={chartMargin}>
                                      <CartesianGrid strokeDasharray="3 3" />
                                      <XAxis dataKey={chartXKey} label={{ value: chartXAxisLabel, position: 'insideBottom', offset: -5 }} />
                                      <YAxis {...chartYAxisProps} dataKey={chartYKey} label={{ value: chartYAxisLabel, angle: -90, position: 'insideLeft' }} />
                                      <Tooltip content={<CustomTooltip />} />
                                      <Legend />
                                      {multiSeries.groupValues.map((g, idx) => (
                                        <Scatter key={g} name={g} data={multiSeries.seriesScatterData[g]} fill={COLORS[idx % COLORS.length]} />
                                      ))}
                                    </ScatterChart>
                                  );
                                })()
                              ) : (
                                <ScatterChart margin={chartMargin}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey={chartXKey} label={{ value: chartXAxisLabel, position: 'insideBottom', offset: -5 }} />
                                  <YAxis {...chartYAxisProps} dataKey={chartYKey} label={{ value: chartYAxisLabel, angle: -90, position: 'insideLeft' }} />
                                  <Tooltip content={<CustomTooltip />} />
                                  <Scatter data={chartData} fill="#7A0A4A" />
                                </ScatterChart>
                              )
                            ) : chart.type === 'Secteur' ? (
                              (() => {
                                const map = {};
                                if (multiSeries) {
                                  const pieData = multiSeries.groupValues.map(g => {
                                    let total = 0;
                                    multiSeries.seriesData.forEach(d => { total += Number(d[g] || 0); });
                                    return { name: g, value: total };
                                  }).filter(d => d.value > 0);
                                  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#B19CD9', '#FF6F91'];
                                  return (
                                    <PieChart margin={{ top: 28, right: 96, bottom: 44, left: 96 }}>
                                      <Pie dataKey="value" data={pieData} nameKey="name" outerRadius={92} fill="#8884d8" labelLine={{ stroke: '#b45309', strokeWidth: 1.25 }} label={renderPieChartLabel}>
                                        {pieData.map((entry, idx) => <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />)}
                                      </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                      <Legend />
                                    </PieChart>
                                  );
                                }
                                chartData.forEach(r => {
                                  const key = r[chartXKey] ?? 'N/A';
                                  const val = parseFloat(r[chartYKey]) || 0;
                                  map[key] = (map[key] || 0) + val;
                                });
                                const pieData = Object.keys(map).map(k => ({ name: k, value: map[k] }));
                                const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#B19CD9', '#FF6F91'];
                                return (
                                  <PieChart margin={{ top: 28, right: 96, bottom: 44, left: 96 }}>
                                    <Pie dataKey="value" data={pieData} nameKey="name" outerRadius={92} fill="#8884d8" labelLine={{ stroke: '#b45309', strokeWidth: 1.25 }} label={renderPieChartLabel}>
                                      {pieData.map((entry, idx) => <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                  </PieChart>
                                );
                              })()
                            ) : (
                              <div className="text-sm italic">Type de graphique non pris en charge.</div>
                            )}
                          </ResponsiveContainer>
                        </div>
                        {chartMesure && (
                          <div className="mt-4 px-4 py-3 bg-[#f7f8fb] border border-[#d8dee9] rounded-lg text-sm text-[#4b5563] italic">
                            {chartMesure}
                          </div>
                        )}
                      </div>
                    );
                    });
                  })()}
                </div>

                {/* BOUTON DÉCLENCHEUR POP-UP */}
                {canEdit && (
                  <button 
                    onClick={() => {
                      setCurrentChartConfig({ id: null, type: 'Histogramme', x: '', y: '', mesure: '', mesure_ar: '', mesure_en: '', filter_column: '', filter_value: '', filter_mode: 'include', filters: [], visible_filters: [], title: '', title_ar: '', title_en: '', x_label: '', y_label: '' });
                      setIsModalOpen(true);
                    }}
                    className="w-full py-6 border-4 border-dashed border-orange-300 rounded-2xl text-orange-400 font-black text-2xl hover:bg-orange-50 transition-all"
                  >
                    + Ajouter un Graphique
                  </button>
                )}
              </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* POP-UP MODALE : CONFIGURATION GRAPHIQUE (moved to ChartModal) */}
      <Suspense fallback={null}>
        <ChartModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          currentChartConfig={currentChartConfig}
          setCurrentChartConfig={setCurrentChartConfig}
          selectedSubTheme={selectedSubTheme}
          getUniqueValuesForColumn={getUniqueValuesForColumn}
          handleAddOrUpdateChart={handleAddOrUpdateChart}
        />
      </Suspense>
      {showEditTable && (
        <div className="fixed inset-0 bg-black/25 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-5xl max-h-[86vh] overflow-hidden rounded-3xl border border-[#d8b6c8] bg-[#fffaf3] shadow-[0_26px_60px_rgba(94,7,56,0.24)]">
            <div className="px-6 py-4 border-b border-[#e8cfdb] bg-gradient-to-r from-[#7A0A4A] to-[#B03372]">
              <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-wide">Modifier le tableau</h2>
              <p className="text-xs md:text-sm text-[#f7ddea] mt-1">Mettez a jour les colonnes et lignes, puis enregistrez.</p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#e8b8d1] bg-[#fff4fb] px-3 py-1 text-xs font-semibold text-[#6E001F]">
                <span>Colonnes: {(editTableColumns || []).length}</span>
                <span className="text-[#b77c9e]">•</span>
                <span>Lignes: {(editTableRows || []).length}</span>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(86vh-110px)]">
            <div className="mb-5 rounded-2xl border border-[#e6cfe0] bg-white p-4 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5">
              <button onClick={() => openImportDialog('replace')} disabled={isCurrentImportBusy} className={`px-4 py-2.5 rounded-xl font-semibold border transition ${isCurrentImportBusy ? 'opacity-60 cursor-not-allowed' : 'hover:-translate-y-[1px]'} bg-[#fff4e7] text-[#6a3043] border-[#e2c08f]`}>
                <span className="inline-flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 12a9 9 0 1 1-3.1-6.8" />
                    <path d="M21 3v6h-6" />
                  </svg>
                  {isReplacing ? 'Remplacement...' : 'Remplacer par un fichier'}
                </span>
              </button>
              <button onClick={() => openImportDialog('smart-replace')} disabled={isCurrentImportBusy} className={`px-4 py-2.5 rounded-xl font-semibold border transition ${isCurrentImportBusy && !isSmartImporting ? 'opacity-60 cursor-not-allowed' : 'hover:-translate-y-[1px]'} ${isSmartImporting ? 'bg-gray-200 text-[#5a5060] border-gray-300' : 'bg-[#fff1cc] text-[#6a3043] border-[#e5cf8a]'}`}>
                <span className="inline-flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" />
                    <path d="m19.5 3.5.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
                  </svg>
                  {isSmartImporting ? 'Import IA...' : 'Importer avec IA'}
                </span>
              </button>
              <button onClick={() => openImportDialog('append')} disabled={isCurrentImportBusy} className={`px-4 py-2.5 rounded-xl font-semibold border transition ${isCurrentImportBusy && !isAppending ? 'opacity-60 cursor-not-allowed' : 'hover:-translate-y-[1px]'} ${isAppending ? 'bg-gray-200 text-[#5a5060] border-gray-300' : 'bg-[#e7f6de] text-[#2d5b39] border-[#b6d2a7]'}`}>
                <span className="inline-flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                  {isAppending ? 'Ajout...' : 'Ajouter au tableau'}
                </span>
              </button>
              <button onClick={() => openImportDialog('append-smart')} disabled={isCurrentImportBusy} className={`px-4 py-2.5 rounded-xl font-semibold border transition ${isCurrentImportBusy && !isAppendingAI ? 'opacity-60 cursor-not-allowed' : 'hover:-translate-y-[1px]'} ${isAppendingAI ? 'bg-gray-200 text-[#5a5060] border-gray-300' : 'bg-[#e2f0ff] text-[#274f7d] border-[#b7d0ed]'}`}>
                <span className="inline-flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
                  </svg>
                  {isAppendingAI ? 'Ajout IA...' : 'Ajouter avec IA'}
                </span>
              </button>
              </div>
              <div className="mt-3 rounded-xl border border-[#ead6e1] bg-[#fff7fb] px-3 py-2 text-xs text-[#6b4b5d]">
                Import: fichier principal obligatoire. Versions AR/EN selon disponibilite du sous-theme.
              </div>
            </div>

            {importDialog.open && (
              <div className="mb-5 rounded-2xl border-2 border-[#d6b978] bg-[#fff8ee] p-5 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-xl font-extrabold text-[#5a2436]">{getImportModeMeta(importDialog.mode).title}</h3>
                    <p className="text-sm text-[#6b4b3b]">Import rapide avec controle de coherence.</p>
                  </div>
                  <button onClick={closeImportDialog} className="self-start rounded-xl border border-[#d0b17b] bg-white px-4 py-2 text-sm font-semibold text-[#5a2436] hover:bg-[#f8ecd8]">Fermer</button>
                </div>

                {selectedSubTheme?.data_is_bilingual && (
                  <div className="mt-3 rounded-xl border border-[#f0b7cc] bg-[#fff1f7] px-3 py-2 text-sm font-semibold text-[#8b1538]">
                    Sous-theme bilingue: le fichier arabe est obligatoire.
                  </div>
                )}

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-[#e6d4b1] bg-white p-3">
                    <label className="block text-sm font-bold text-[#5a2436] mb-2">Fichier principal <span className="text-[#8b1538]">*</span></label>
                    <input ref={importMainInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => setImportDialog((prev) => ({ ...prev, file: e.target.files?.[0] || null }))} />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => importMainInputRef.current?.click()}
                        disabled={isCurrentImportBusy}
                        className="shrink-0 rounded-lg border border-[#d6b978] bg-[#fff8ee] px-3 py-2 text-xs font-semibold text-[#5a2436] hover:bg-[#f8ecd8] disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Choisir un fichier
                      </button>
                      <div className="min-w-0 flex-1 rounded-lg border border-[#eadcc2] bg-[#fffdf8] px-3 py-2 text-xs text-[#6b4b3b] truncate">
                        {importDialog.file?.name || 'Aucun fichier selectionne'}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-[#6b4b3b]">Obligatoire (fichier principal).</div>
                  </div>
                  <div className="rounded-xl border border-[#e6d4b1] bg-white p-3">
                    <label className="block text-sm font-bold text-[#5a2436] mb-2">Version arabe</label>
                    <input ref={importArInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => setImportDialog((prev) => ({ ...prev, fileAr: e.target.files?.[0] || null }))} />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => importArInputRef.current?.click()}
                        disabled={isCurrentImportBusy}
                        className="shrink-0 rounded-lg border border-[#d6b978] bg-[#fff8ee] px-3 py-2 text-xs font-semibold text-[#5a2436] hover:bg-[#f8ecd8] disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Choisir un fichier
                      </button>
                      <div className="min-w-0 flex-1 rounded-lg border border-[#eadcc2] bg-[#fffdf8] px-3 py-2 text-xs text-[#6b4b3b] truncate">
                        {importDialog.fileAr?.name || 'Aucun fichier selectionne'}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-[#6b4b3b]">Optionnelle sauf sous-theme bilingue.</div>
                  </div>
                  <div className="rounded-xl border border-[#e6d4b1] bg-white p-3">
                    <label className="block text-sm font-bold text-[#5a2436] mb-2">Version anglaise</label>
                    <input ref={importEnInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => setImportDialog((prev) => ({ ...prev, fileEn: e.target.files?.[0] || null }))} />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => importEnInputRef.current?.click()}
                        disabled={isCurrentImportBusy}
                        className="shrink-0 rounded-lg border border-[#d6b978] bg-[#fff8ee] px-3 py-2 text-xs font-semibold text-[#5a2436] hover:bg-[#f8ecd8] disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Choisir un fichier
                      </button>
                      <div className="min-w-0 flex-1 rounded-lg border border-[#eadcc2] bg-[#fffdf8] px-3 py-2 text-xs text-[#6b4b3b] truncate">
                        {importDialog.fileEn?.name || 'Aucun fichier selectionne'}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-[#6b4b3b]">Optionnelle sauf si EN deja active.</div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-[#ecd29f] bg-white px-4 py-3">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-[#d8bfd0] bg-[#fff7fb] px-2.5 py-1 text-[#5a2436]">Mode: <strong>{getImportModeMeta(importDialog.mode).title}</strong></span>
                    <span className="rounded-full border border-[#d8bfd0] bg-[#fff7fb] px-2.5 py-1 text-[#5a2436]">AR: <strong>{importDialog.fileAr ? 'active' : 'off'}</strong></span>
                    <span className="rounded-full border border-[#d8bfd0] bg-[#fff7fb] px-2.5 py-1 text-[#5a2436]">EN: <strong>{importDialog.fileEn ? 'active' : 'off'}</strong></span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button onClick={handleConfirmImportDialog} disabled={isCurrentImportBusy || !importDialog.file} className="rounded-xl border-2 border-black bg-[#7A0A4A] px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:bg-gray-300">Verifier et importer</button>
                  <button onClick={closeImportDialog} disabled={isCurrentImportBusy} className="rounded-xl border-2 border-black bg-white px-4 py-2 font-bold text-[#5a2436] disabled:cursor-not-allowed disabled:opacity-60">Annuler</button>
                </div>
              </div>
            )}

            <div className="overflow-auto rounded-2xl border border-[#dfc6d4] bg-white shadow-sm">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#fff3f8]">
                    {(editTableColumns || []).map((col, ci) => (
                      <th key={`${col}-${ci}`} className="p-2 border border-[#e4d3dd] text-xs">
                        <input
                          className="w-full p-1.5 text-xs font-semibold border border-[#d8c1cf] rounded-md outline-none focus:border-[#B03372]"
                          value={col}
                          onChange={(e) => handleEditColumnNameChange(ci, e.target.value)}
                        />
                      </th>
                    ))}
                    <th className="p-2 border border-[#e4d3dd] text-xs text-[#6a3043]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {editTableRows.map((row, ri) => (
                    <tr key={ri} className="hover:bg-[#fff8fb]">
                      {(editTableColumns || []).map((col, ci) => (
                        <td key={`${col}-${ci}`} className="p-1 border border-[#efe1e9]">
                          <input className="w-full p-1.5 text-xs rounded-md border border-transparent outline-none focus:border-[#cfa9bf]" value={row[col] ?? ''} onChange={e => { const r = [...editTableRows]; r[ri] = {...r[ri], [col]: e.target.value}; setEditTableRows(r); }} />
                        </td>
                      ))}
                      <td className="p-1 border border-[#efe1e9] text-center">
                        <button onClick={() => { const r = [...editTableRows]; r.splice(ri, 1); setEditTableRows(r); }} className="px-3 py-1 rounded-lg border border-[#e4b8c7] bg-[#fff1f6] text-[#9a1f49] text-xs font-semibold hover:bg-[#ffe3ed]">Suppr</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="sticky bottom-0 -mx-6 mt-5 px-6 py-4 border-t border-[#ead6e1] bg-[#fffaf3]/95 backdrop-blur-sm flex flex-wrap gap-3">
              <button onClick={() => setEditTableRows(prev => [...prev, Object.fromEntries((editTableColumns || []).map(c => [c, '']))])} className="px-4 py-2 rounded-xl border border-[#a8cfb0] bg-[#e8f6ea] text-[#2d6a3c] font-semibold hover:bg-[#daf0de]">Ajouter ligne</button>
              <div className="flex-1" />
              <button onClick={() => setShowEditTable(false)} className="px-4 py-2 rounded-xl border border-[#d9c6d1] bg-white text-[#6a4a5d] font-semibold hover:bg-[#faf6f8]">Annuler</button>
              <button onClick={saveEditedTable} className="px-5 py-2 rounded-xl border border-[#8c1f60] bg-[#7A0A4A] text-white font-semibold hover:bg-[#5E0738] shadow-sm">Enregistrer</button>
            </div>
            </div>
          </div>
        </div>
      )}

      {showAdvancedConfig && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[9999] p-4" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white border border-black p-6 rounded-2xl w-full max-w-xl max-h-[80vh] overflow-y-auto shadow-lg z-[10000]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-center mb-4"> Configuration Avancée</h2>
            <div className="space-y-4">
              <div>
                <label className="block font-bold mb-2">Granularité Géographique</label>
                <select
                  value={advancedConfig.niveau_geo || ''}
                  onChange={e => setAdvancedConfig({...advancedConfig, niveau_geo: e.target.value || null})}
                  className="w-full p-2 border-2 border-black rounded bg-white outline-none"
                >
                  <option value="">-- Non défini --</option>
                  <option value="Régionale">Régionale</option>
                  <option value="Provinciale">Provinciale</option>
                  <option value="Communale">Communale</option>
                </select>
              </div>

              <div>
                <label className="block font-bold mb-2">Type d'Unité</label>
                <input
                  type="text"
                  placeholder="Ex: %, Effectif, DH, Km"
                  value={advancedConfig.type_unite || ''}
                  onChange={e => setAdvancedConfig({...advancedConfig, type_unite: e.target.value})}
                  className="w-full p-2 border-2 border-black rounded outline-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  id="est_sommable"
                  type="checkbox"
                  checked={advancedConfig.est_sommable ?? true}
                  onChange={e => setAdvancedConfig({...advancedConfig, est_sommable: e.target.checked})}
                  className="w-5 h-5 border-2 border-black rounded"
                />
                <label htmlFor="est_sommable" className="font-bold">Les données sont sommables (effectifs)</label>
              </div>

              <div>
                <label className="block font-bold mb-2">Colonnes disponibles pour filtrer (séparées par des virgules)</label>
                <input
                  type="text"
                  placeholder="Ex: Année, Sexe, Milieu, Région"
                  value={advancedConfigFiltersText}
                  onChange={e => setAdvancedConfigFiltersText(e.target.value)}
                  className="w-full p-2 border-2 border-black rounded outline-none"
                />
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button onClick={() => setShowAdvancedConfig(false)} className="flex-1 bg-gray-200 py-2 border-2 border-black rounded-xl font-bold">Annuler</button>
              <button onClick={async () => {
                try {
                  // update local state
                  // parse filters text into array before saving
                  const parsed = String(advancedConfigFiltersText || '').split(',').map(s => s.trim()).filter(s => s !== '');
                  setSubThemeMeta({...subThemeMeta, niveau_geo: advancedConfig.niveau_geo, type_unite: advancedConfig.type_unite, est_sommable: advancedConfig.est_sommable, filtres_disponibles: parsed});
                  if (isSaisisseur) {
                    setSelectedSubTheme((prev) => prev ? {
                      ...prev,
                      niveau_geo: advancedConfig.niveau_geo,
                      type_unite: advancedConfig.type_unite,
                      est_sommable: advancedConfig.est_sommable,
                      filtres_disponibles: parsed,
                    } : prev);
                    setAdvancedConfig(prev => ({ ...prev, filtres_disponibles: parsed }));
                    await saveDraftAssignmentForSaisisseur({
                      advancedConfig: {
                        niveau_geo: advancedConfig.niveau_geo,
                        type_unite: advancedConfig.type_unite,
                        est_sommable: advancedConfig.est_sommable,
                        filtres_disponibles: parsed,
                      }
                    }, 'En cours');
                    showToast('Configuration avancée enregistrée en brouillon', 'success');
                    setShowAdvancedConfig(false);
                    return;
                  }

                  await axios.patch(`${API_BASE}/sousthemes/${selectedSubTheme.id}/`, {
                    niveau_geo: advancedConfig.niveau_geo,
                    type_unite: advancedConfig.type_unite,
                    est_sommable: advancedConfig.est_sommable,
                    filtres_disponibles: parsed
                  });
                  // keep advancedConfig synced
                  setAdvancedConfig(prev => ({ ...prev, filtres_disponibles: parsed }));
                  showToast('Configuration avancée enregistrée', 'success');
                  setShowAdvancedConfig(false);
                  // refresh themes and selected subtheme
                  const res = await axios.get(themesApiBase);
                  setThemes(res.data);
                  const freshTheme = res.data.find(t => t.id === selectedTheme?.id);
                  if (freshTheme) setSelectedTheme(freshTheme);
                  const freshSubTheme = freshTheme?.sous_themes?.find(st => st.id === selectedSubTheme.id);
                  if (freshSubTheme) selectSubTheme(freshSubTheme);
                } catch (err) {
                  console.error(err);
                  showToast('Erreur lors de l\'enregistrement', 'error');
                }
              }} className="flex-1 bg-[#ffb366] py-2 border-2 border-black rounded-xl font-bold shadow-md">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {showSubThemeMeta && (
         <div className="fixed inset-0 modal-overlay bg-black/40 flex items-center justify-center z-[2147483000] p-4" onClick={(e) => e.stopPropagation()}>
           <div className="bg-white border border-black p-4 rounded-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden shadow-lg flex flex-col">
             <div className="bg-[#7A0A4A] text-white rounded-t-lg px-4 py-3">
               <h2 className="text-lg font-bold text-center">{t('metadata')}</h2>
             </div>
             <div className="p-4 overflow-y-auto flex-1 min-h-0 space-y-4 text-gray-800">
               {isVisitor ? renderMetadataViewer(subThemeMeta) : renderMetadataEditor(subThemeMeta, setSubThemeMeta)}

              
             </div>
             <div className="flex gap-4 mt-4 px-4 pb-4">
               <button onClick={() => setShowSubThemeMeta(false)} className="flex-1 bg-[#7A0A4A] text-white py-2 rounded-lg font-bold">{t('close')}</button>
               {!isVisitor && <button onClick={saveSubThemeMeta} className="flex-1 bg-[#ffb366] py-2 border-2 border-black rounded-lg font-bold">{t('save')}</button>}
             </div>
           </div>
         </div>
      )}
      {showThemeMeta && (
         <div className="fixed inset-0 modal-overlay bg-black/40 flex items-center justify-center z-[2147483000] p-4" onClick={(e) => e.stopPropagation()}>
           <div className="bg-white border border-black p-4 rounded-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden shadow-lg flex flex-col">
             <div className="bg-[#7A0A4A] text-white rounded-t-lg px-4 py-3">
               <h2 className="text-lg font-bold text-center">{t('metadata')}</h2>
             </div>
             <div className="p-4 overflow-y-auto flex-1 min-h-0 space-y-4 text-gray-800">
               {isVisitor ? renderMetadataViewer(themeMeta) : renderMetadataEditor(themeMeta, setThemeMeta)}
             </div>
             <div className="flex gap-4 mt-4 px-4 pb-4">
               <button onClick={() => setShowThemeMeta(false)} className="flex-1 bg-[#7A0A4A] text-white py-2 rounded-lg font-bold">{t('close')}</button>
               {!isVisitor && <button onClick={saveThemeMeta} className="flex-1 bg-[#ffb366] py-2 border-2 border-black rounded-lg font-bold">{t('save')}</button>}
             </div>
           </div>
         </div>
      )}
      

      

      {/* Visitor configuration modal (in-place) */}
      {configModalOpen && configSubTheme && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setConfigModalOpen(false)}>
          <div className="bg-white border border-black p-6 rounded-2xl w-full max-w-3xl max-h-[80vh] overflow-y-auto shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-center mb-4"> Configuration Visiteur</h2>

            <div className="space-y-4">
              {(() => {
                const configRows = getTableRows(configSubTheme) || [];
                const availableColumns = (configSubTheme.columns && configSubTheme.columns.length)
                  ? localizeConfiguredColumns(configSubTheme.columns, 'fr')
                  : (configSubTheme.columns_order && configSubTheme.columns_order.length)
                    ? localizeConfiguredColumns(configSubTheme.columns_order, 'fr')
                    : localizeConfiguredColumns(Object.keys(configRows[0] || {}), 'fr');

                const moveInList = (setter, index, direction) => {
                  setter((prev) => {
                    const next = [...(prev || [])];
                    const target = index + direction;
                    if (target < 0 || target >= next.length) return next;
                    const tmp = next[index];
                    next[index] = next[target];
                    next[target] = tmp;
                    return next;
                  });
                };

                return (
                  <>
              <div>
                <label className="block font-bold mb-2">Colonnes visibles pour le visiteur</label>
                <div className="space-y-2 max-h-48 overflow-y-auto p-2 border-2 border-black rounded">
                  {modalVisitorCols.length === 0 && <div className="text-sm text-gray-500">Aucune colonne sélectionnée</div>}
                  {modalVisitorCols.map((col, idx) => (
                    <div key={`vc-${col}-${idx}`} className="flex items-center gap-2 bg-white border rounded px-2 py-1">
                      <span className="flex-1 text-sm">{col}</span>
                      <button type="button" className="px-2 py-1 border rounded text-xs" onClick={() => moveInList(setModalVisitorCols, idx, -1)}>↑</button>
                      <button type="button" className="px-2 py-1 border rounded text-xs" onClick={() => moveInList(setModalVisitorCols, idx, 1)}>↓</button>
                      <button type="button" className="px-2 py-1 border rounded text-xs text-red-700" onClick={() => {
                        setModalVisitorCols((prev) => prev.filter((_, i) => i !== idx));
                        setModalVisitorFilters((prev) => prev.filter((f) => normalizeDataToken(f) !== normalizeDataToken(col)));
                        setModalVisitorHierarchy((prev) => prev.filter((h) => normalizeDataToken(h) !== normalizeDataToken(col)));
                        setModalVisitorDefaultFilters((prev) => { const cp = { ...(prev || {}) }; delete cp[col]; return cp; });
                      }}>Retirer</button>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {availableColumns.filter((c) => !containsConfiguredColumn(modalVisitorCols, c)).map((c) => (
                    <button type="button" key={`add-col-${c}`} className="px-2 py-1 border rounded text-xs bg-[#f8f0f4]" onClick={() => setModalVisitorCols((prev) => appendUniqueConfiguredColumn(prev, c))}>+ {c}</button>
                  ))}
                </div>
                <div className="text-sm italic text-gray-600">Choisissez les colonnes puis ordonnez-les avec ↑/↓.</div>
              </div>

              <div>
                <label className="block font-bold mb-2">Filtres disponibles</label>
                <div className="space-y-2 max-h-48 overflow-y-auto p-2 border-2 border-black rounded">
                  {modalVisitorFilters.length === 0 && <div className="text-sm text-gray-500">Aucun filtre sélectionné</div>}
                  {modalVisitorFilters.map((col, idx) => (
                    <div key={`vf-${col}-${idx}`} className="flex items-center gap-2 bg-white border rounded px-2 py-1">
                      <span className="flex-1 text-sm">{col}</span>
                      <button type="button" className="px-2 py-1 border rounded text-xs" onClick={() => moveInList(setModalVisitorFilters, idx, -1)}>↑</button>
                      <button type="button" className="px-2 py-1 border rounded text-xs" onClick={() => moveInList(setModalVisitorFilters, idx, 1)}>↓</button>
                      <button type="button" className="px-2 py-1 border rounded text-xs text-red-700" onClick={() => {
                        setModalVisitorFilters((prev) => prev.filter((_, i) => i !== idx));
                        setModalVisitorDefaultFilters((prev) => { const cp = { ...(prev || {}) }; delete cp[col]; return cp; });
                      }}>Retirer</button>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {modalVisitorCols.filter((c) => !containsConfiguredColumn(modalVisitorFilters, c)).map((c) => (
                    <button type="button" key={`add-filter-${c}`} className="px-2 py-1 border rounded text-xs bg-[#f8f0f4]" onClick={() => setModalVisitorFilters((prev) => appendUniqueConfiguredColumn(prev, c))}>+ {c}</button>
                  ))}
                </div>
                <div className="text-sm italic text-gray-600">Sélectionnez seulement les colonnes utiles pour filtrer.</div>
              </div>

              <div>
                <label className="block font-bold mb-2">Hiérarchie des colonnes (optionnel)</label>
                <div className="space-y-2 max-h-48 overflow-y-auto p-2 border-2 border-black rounded">
                  {modalVisitorHierarchy.length === 0 && <div className="text-sm text-gray-500">Aucune hiérarchie définie</div>}
                  {modalVisitorHierarchy.map((col, idx) => (
                    <div key={`vh-${col}-${idx}`} className="flex items-center gap-2 bg-white border rounded px-2 py-1">
                      <span className="flex-1 text-sm">{col}</span>
                      <button type="button" className="px-2 py-1 border rounded text-xs" onClick={() => moveInList(setModalVisitorHierarchy, idx, -1)}>↑</button>
                      <button type="button" className="px-2 py-1 border rounded text-xs" onClick={() => moveInList(setModalVisitorHierarchy, idx, 1)}>↓</button>
                      <button type="button" className="px-2 py-1 border rounded text-xs text-red-700" onClick={() => setModalVisitorHierarchy((prev) => prev.filter((_, i) => i !== idx))}>Retirer</button>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {modalVisitorCols.filter((c) => !containsConfiguredColumn(modalVisitorHierarchy, c)).map((c) => (
                    <button type="button" key={`add-hierarchy-${c}`} className="px-2 py-1 border rounded text-xs bg-[#f8f0f4]" onClick={() => setModalVisitorHierarchy((prev) => appendUniqueConfiguredColumn(prev, c))}>+ {c}</button>
                  ))}
                </div>
                <div className="text-sm italic text-gray-600">Ordre hiérarchique pour l'en-tête vertical/multi-niveaux.</div>
              </div>

              <div>
                <label className="block font-bold mb-2">Vue par défaut du visiteur</label>
                <select
                  className="w-full p-2 border-2 border-black rounded bg-white"
                  value={modalVisitorDefaultView}
                  onChange={e => setModalVisitorDefaultView(e.target.value === 'vertical' ? 'vertical' : 'horizontal')}
                >
                  <option value="horizontal">Horizontale</option>
                  <option value="vertical">Verticale</option>
                </select>
                <div className="text-sm italic text-gray-600">Le visiteur peut toujours basculer entre les deux vues.</div>
              </div>

              <div>
                <label className="block font-bold mb-2">Filtres par défaut</label>
                <div className="space-y-2 max-h-56 overflow-y-auto p-2 border-2 border-black rounded">
                  {modalVisitorFilters.length === 0 && <div className="text-sm text-gray-500">Sélectionnez d'abord les filtres disponibles</div>}
                  {modalVisitorFilters.map((f) => {
                    const rowsForDefaults = getTableRows(configSubTheme) || [];
                    const sourceColumns = Array.from(new Set(rowsForDefaults.flatMap((r) => Object.keys(r || {}))));
                    const sourceLookup = buildSourceColumnLookup(sourceColumns);
                    const sourceCol = resolveSourceColumn(f, sourceLookup) || f;
                    const opts = Array.from(new Set(rowsForDefaults.map((r) => r && r[sourceCol]).filter((v) => v !== null && v !== undefined)));
                    return (
                      <div key={`default-${f}`} className="text-sm">
                        <label className="block font-semibold mb-1">{f}</label>
                        <select
                          className="w-full p-2 border rounded"
                          value={(modalVisitorDefaultFilters && modalVisitorDefaultFilters[f]) ?? ''}
                          onChange={(e) => setModalVisitorDefaultFilters((prev) => ({ ...(prev || {}), [f]: e.target.value }))}
                        >
                          <option value="">-- Aucun --</option>
                          {opts.map((o) => <option key={String(o)} value={String(o)}>{String(o)}</option>)}
                        </select>
                      </div>
                    );
                  })}
                </div>
                <div className="text-sm italic text-gray-600">Définissez ici les valeurs par défaut des filtres.</div>
              </div>
                  </>
                );
              })()}
            </div>

            <div className="flex gap-4 mt-6">
              <button onClick={() => setConfigModalOpen(false)} className="flex-1 bg-gray-200 py-2 border-2 border-black rounded-xl font-bold">Annuler</button>
              <button onClick={async () => {
                try {
                  const parsedDefaults = canonicalizeVisitorDefaults(modalVisitorDefaultFilters);

                  const parsedCols = dedupeConfiguredColumns(modalVisitorCols);
                  const parsedFilters = dedupeConfiguredColumns(modalVisitorFilters);
                  const parsedHierarchy = dedupeConfiguredColumns(modalVisitorHierarchy);

                  const payload = {
                    visitor_visible_columns: parsedCols,
                    visitor_filters: parsedFilters,
                    visitor_default_filters: parsedDefaults,
                    visitor_pivot_columns: parsedHierarchy,
                    visitor_default_view: modalVisitorDefaultView === 'vertical' ? 'vertical' : 'horizontal'
                  };

                  if (isSaisisseur) {
                    // Saisisseur: store visitor config as a draft in assignment notes (pending admin validation)
                    await saveDraftAssignmentForSaisisseur({ visitor_config: payload }, 'En cours');
                    showToast('Configuration visiteur enregistrée (en attente de validation admin)', 'success');
                  } else {
                    // Admin: apply directly to the SousTheme
                    await axios.patch(`${API_BASE}/sousthemes/${configSubTheme.id}/`, payload);
                    showToast('Configuration visiteur enregistrée', 'success');
                    // fetch the updated sous-thème and update local state so the view refreshes immediately
                    try {
                      const freshRes = await axios.get(`${API_BASE}/sousthemes/${configSubTheme.id}/`);
                      const freshSubTheme = freshRes.data;
                      selectSubTheme(freshSubTheme);
                      // also refresh the themes list to keep things in sync
                      const res = await axios.get(themesApiBase);
                      setThemes(res.data);
                      const freshTheme = res.data.find(t => t.id === selectedTheme?.id);
                      if (freshTheme) setSelectedTheme(freshTheme);
                      // additionally refresh public themes so visitor view can update if needed
                      try {
                        const pub = await axios.get(`${API_BASE}/public-themes/`);
                        setPublicThemes(pub.data);
                        if (typeof window !== 'undefined' && window.location.pathname.includes('/visiteur')) {
                          setThemes(pub.data);
                          // try to find the subtheme in public payload and set it
                          for (const t of pub.data || []) {
                            const st = (t.sous_themes || []).find(s => String(s.id) === String(configSubTheme.id));
                            if (st) { selectSubTheme(st); break; }
                          }
                        }
                      } catch (pubErr) {
                        console.warn('Impossible de rafraîchir public-themes', pubErr);
                      }
                    } catch (refreshErr) {
                      console.error('Erreur lors du rafraîchissement du sous-thème', refreshErr);
                    }
                  }

                  // update modal state to reflect saved values
                  const displayCols = localizeConfiguredColumns(parsedCols, 'fr');
                  const displayFilters = localizeConfiguredColumns(parsedFilters, 'fr');
                  const displayHierarchy = localizeConfiguredColumns(parsedHierarchy, 'fr');
                  setModalVisitorCols(displayCols);
                  setModalVisitorFilters(displayFilters);
                  setModalVisitorHierarchy(displayHierarchy);
                  setModalVisitorColsText(displayCols.join(', '));
                  setModalVisitorFiltersText(displayFilters.join(', '));
                  setModalVisitorHierarchyText(displayHierarchy.join(', '));
                  setVisitorTableView(modalVisitorDefaultView === 'vertical' ? 'vertical' : 'horizontal');
                  setConfigModalOpen(false);
                } catch (err) {
                  console.error(err);
                  showToast('Erreur lors de l\'enregistrement', 'error');
                }
              }} className="flex-1 bg-[#ffb366] py-2 border-2 border-black rounded-xl font-bold">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {submitConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#d5deea] rounded-2xl w-full max-w-md shadow-[0_20px_50px_rgba(24,46,78,0.2)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#e3e9f2] bg-[#f7f9fc] flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#7A0A4A]">Envoyer à l'admin</h3>
              <button
                type="button"
                onClick={() => !submitConfirmLoading && setSubmitConfirmOpen(false)}
                className="text-[#667085] hover:text-[#274d73] text-xl leading-none"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-[#344054] leading-relaxed">
                Cette action envoie le sous-thème courant aux administrateurs pour révision.
              </p>
              <p className="text-xs text-[#667085]">
                Le brouillon actuel sera sauvegardé automatiquement avant l'envoi.
              </p>
            </div>
            <div className="px-5 py-4 border-t border-[#e3e9f2] bg-white flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSubmitConfirmOpen(false)}
                disabled={submitConfirmLoading}
                className="px-4 py-2 rounded-lg border border-[#d5deea] text-[#274d73] font-semibold hover:bg-[#eef4fb] disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={submitCurrentSubThemeForReview}
                disabled={submitConfirmLoading}
                className="px-4 py-2 rounded-lg border border-[#1e4db7] bg-[#2563eb] text-white font-semibold hover:bg-[#1d4ed8] disabled:opacity-60"
              >
                {submitConfirmLoading ? 'Envoi...' : 'Confirmer l\'envoi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Managing Chart Rows */}
      {manageRowsModalChartId !== null && (
        <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50 p-4">
          <div className="bg-white border-4 border-black p-6 rounded-3xl w-full max-w-3xl max-h-[80vh] overflow-y-auto shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            {(() => {
              const managedChart = savedCharts.find(c => String(c.id) === String(manageRowsModalChartId));
              
              if (!managedChart) {
                return (
                  <div className="text-center">
                    <p className="text-red-600 font-bold">⚠ Graphique non trouvé</p>
                    <p className="text-gray-700 mb-2">ID: {manageRowsModalChartId}</p>
                    <p className="text-gray-600 text-sm mb-4">Graphiques: {savedCharts.length}</p>
                    <button onClick={() => setManageRowsModalChartId(null)} className="bg-gray-200 px-4 py-2 border-2 border-black rounded font-bold">Fermer</button>
                  </div>
                );
              }

              const filteredData = getFilteredChartData(managedChart);
              const chartData = getTableRows(selectedSubTheme);
              const totalRows = chartData.length;
              const excludedCount = (excludedRowIndices[manageRowsModalChartId] || []).length;
              const visibleCount = filteredData.length;

              return (
                <>
                  <h2 className="text-2xl font-black mb-2 text-center">📋 Gestion des lignes du graphe</h2>
                  <p className="text-center text-gray-600 mb-4">
                    <strong>{managedChart.type}</strong> • X: <strong>{managedChart.x}</strong> • Y: <strong>{managedChart.y}</strong>
                  </p>
                  
                  <div className="mb-4 bg-blue-100 p-3 rounded border-2 border-blue-400 text-sm">
                    <p>Total: <strong>{totalRows}</strong> lignes | Supprimées: <strong className="text-red-600">{excludedCount}</strong> | Affichées: <strong className="text-green-600">{visibleCount}</strong></p>
                  </div>

                  <div className="mb-4 max-h-[50vh] overflow-y-auto border-2 border-gray-300 rounded p-3 bg-gray-50">
                    <div className="space-y-2">
                      {chartData.map((row, idx) => {
                        const isExcluded = isRowExcluded(manageRowsModalChartId, managedChart, row);
                        const rowKey = `${managedChart.x}:${row[managedChart.x]}|${managedChart.y}:${row[managedChart.y]}`;
                        const rowDisplay = `${managedChart.x}: ${row[managedChart.x]} | ${managedChart.y}: ${row[managedChart.y]}`;

                        return (
                          <div 
                            key={rowKey} 
                            className={`p-2 border rounded flex justify-between items-center text-sm ${
                              isExcluded 
                                ? 'bg-red-100 border-red-400 line-through text-gray-500' 
                                : 'bg-white border-gray-300'
                            }`}
                          >
                            <span>{rowDisplay}</span>
                            <button
                              onClick={() => {
                                if (isExcluded) {
                                  handleRestoreRowToChart(manageRowsModalChartId, managedChart, idx);
                                } else {
                                  handleDeleteRowFromChart(manageRowsModalChartId, managedChart, idx);
                                }
                              }}
                              className={`px-2 py-1 border-2 border-black rounded font-bold text-xs ${
                                isExcluded 
                                  ? 'bg-green-300 hover:bg-green-400' 
                                  : 'bg-red-300 hover:bg-red-400'
                              }`}
                            >
                              {isExcluded ? '↩ Restaurer' : '✕ Supprimer'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex gap-4 mt-6">
                    {excludedCount > 0 && (
                      <button
                        onClick={() => {
                          setExcludedRowIndices({
                            ...excludedRowIndices,
                            [manageRowsModalChartId]: []
                          });
                          saveChartExclusions(manageRowsModalChartId, []);
                        }}
                        className="flex-1 bg-yellow-300 py-2 border-2 border-black rounded-xl font-bold hover:bg-yellow-400 shadow-md"
                      >
                        ↻ Réinitialiser ({excludedCount})
                      </button>
                    )}
                    <button
                      onClick={() => setManageRowsModalChartId(null)}
                      className="flex-1 bg-gray-200 py-2 border-2 border-black rounded-xl font-bold hover:bg-gray-300"
                    >
                      Fermer
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Modal for renaming / adding sub-theme */}
      {canEdit && userRole === 'ADMIN' && openSubActionMenu && (
        <div onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', left: subActionMenuPos.left, top: subActionMenuPos.top, zIndex: 9999 }}>
          <div className="w-48 bg-white rounded-lg shadow-2xl border border-gray-200 max-h-96 overflow-y-auto">
            <div className="px-3 py-2 border-b text-sm font-semibold text-gray-700">Actions</div>
            <button onClick={(e) => { e.stopPropagation(); const st = (selectedTheme?.sous_themes || []).find(s => s.id === openSubActionMenu) || themes.flatMap(t => t.sous_themes || []).find(s => s.id === openSubActionMenu); setActionModalType('rename_subtheme'); setActionModalValue(st?.nom || ''); setActionModalValueAr(st?.nom_ar || ''); setActionModalValueEn(st?.nom_en || ''); setActionModalThemeId(openSubActionMenu); setShowActionModal(true); setOpenSubActionMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 21v-3" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 14l9-9 3 3-9 9H7v-3z" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Renommer
            </button>
            <button onClick={(e) => { e.stopPropagation(); const st = (selectedTheme?.sous_themes || []).find(s => s.id === openSubActionMenu) || themes.flatMap(t => t.sous_themes || []).find(s => s.id === openSubActionMenu); toggleSubThemePublication(openSubActionMenu, !st?.is_visible); setOpenSubActionMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5v14" stroke="#0F172A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 12h14" stroke="#0F172A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Modifier le statut de publication
            </button>
          </div>
        </div>
      )}

      {canEdit && userRole === 'ADMIN' && openSubThemeMenu && (
        <div onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', left: subThemeMenuPos.left, top: subThemeMenuPos.top, zIndex: 9999 }}>
          <div className="w-48 bg-white rounded-lg shadow-2xl border border-gray-200 max-h-96 overflow-y-auto">
            <div className="px-3 py-2 border-b text-sm font-semibold text-gray-700">Options</div>
            {(() => {
              const st = (selectedTheme?.sous_themes || []).find(s => s.id === openSubThemeMenu) || themes.flatMap(t => t.sous_themes || []).find(s => s.id === openSubThemeMenu);
              if (st && st.archived) {
                return (
                  <button onClick={(e) => { e.stopPropagation(); const id = openSubThemeMenu; showConfirm('Désarchiver ce sous-thème ?', async () => { await unarchiveSubTheme(id); setOpenSubThemeMenu(null); }); }} className="w-full text-left px-4 py-2 bg-green-100 text-green-900 hover:bg-green-200 transition-colors flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 7h18" stroke="#166534" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 7v10a1 1 0 001 1h6a1 1 0 001-1V7" stroke="#166534" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 3h4" stroke="#166534" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Désarchiver le sous-thème
                  </button>
                );
              }
              return (
                <button onClick={(e) => { e.stopPropagation(); const id = openSubThemeMenu; showConfirm('Archiver ce sous-thème ?', async () => { await archiveSubTheme(id); setOpenSubThemeMenu(null); }); }} className="w-full text-left px-4 py-2 bg-yellow-100 text-yellow-900 hover:bg-yellow-200 transition-colors flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 7h18" stroke="#92400E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 7v10a1 1 0 001 1h6a1 1 0 001-1V7" stroke="#92400E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 3h4" stroke="#92400E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Archiver le sous-thème
                </button>
              );
            })()}
            <button onClick={(e) => { e.stopPropagation(); const id = openSubThemeMenu; showConfirm('Supprimer ce sous-thème ?', async () => { await deleteSubTheme(id); setOpenSubThemeMenu(null); }); }} className="w-full text-left px-4 py-2 bg-white text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 6h18" stroke="#B91C1C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 6v12a1 1 0 001 1h6a1 1 0 001-1V6" stroke="#B91C1C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 11v6M14 11v6" stroke="#B91C1C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Supprimer le sous-thème
            </button>
          </div>
        </div>
      )}
      {showActionModal && (
        <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50 p-4">
          <div className="bg-white border-4 border-black p-6 rounded-3xl w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-xl font-black mb-4 text-center">{actionModalType === 'rename' ? 'Renommer le thème' : actionModalType === 'rename_subtheme' ? 'Renommer le sous-thème' : actionModalType === 'rename_categorie' ? 'Renommer la catégorie' : actionModalType === 'add_categorie' ? 'Ajouter une catégorie' : 'Ajouter un sous-thème'}</h2>
            <input className="w-full p-2 border-2 border-black rounded mb-3" value={actionModalValue} onChange={e => setActionModalValue(e.target.value)} placeholder={actionModalType === 'rename' ? 'Nouveau nom du thème' : actionModalType === 'rename_subtheme' ? 'Nouveau nom du sous-thème' : actionModalType === 'rename_categorie' ? 'Nouveau nom de la catégorie' : actionModalType === 'add_categorie' ? 'Nom de la catégorie' : 'Nom du sous-thème'} />
            <input className="w-full p-2 border-2 border-black rounded mb-4" value={actionModalValueAr} onChange={e => setActionModalValueAr(e.target.value)} placeholder={actionModalType === 'rename' ? 'الاسم العربي للموضوع' : actionModalType === 'rename_subtheme' ? 'الاسم العربي للموضوع الفرعي' : actionModalType === 'rename_categorie' ? 'الاسم العربي للفئة' : actionModalType === 'add_categorie' ? 'الاسم العربي للفئة' : 'الاسم العربي للموضوع الفرعي'} dir="rtl" />
            <input className="w-full p-2 border-2 border-black rounded mb-4" value={actionModalValueEn} onChange={e => setActionModalValueEn(e.target.value)} placeholder={actionModalType === 'rename' ? 'English theme title' : actionModalType === 'rename_subtheme' ? 'English sub-theme title' : actionModalType === 'rename_categorie' ? 'English category name' : actionModalType === 'add_categorie' ? 'English category name' : 'English sub-theme name'} />
            
            {actionModalType === 'add_subtheme' && (() => {
              const currentTheme = themes.find(t => t.id === actionModalThemeId);
              if (currentTheme && currentTheme.categories && currentTheme.categories.length > 0) {
                return (
                  <div className="mb-4">
                    <label className="block text-sm font-bold mb-2">Catégorie *</label>
                    <select 
                      value={actionModalCategorieId || ''}
                      onChange={e => setActionModalCategorieId(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full border-2 border-black rounded p-2 outline-none bg-white"
                    >
                      <option value="">Choisir une catégorie</option>
                      {currentTheme.categories.sort((a, b) => a.ordre - b.ordre).map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.nom}</option>
                      ))}
                    </select>
                  </div>
                );
              }
              return null;
            })()}
            
            <div className="flex gap-4">
              <button onClick={() => { setShowActionModal(false); setActionModalCategorieId(null); setActionModalValueAr(''); setActionModalValueEn(''); }} className="flex-1 bg-gray-200 py-2 border-2 border-black rounded-xl font-bold">Annuler</button>
              <button onClick={async () => {
                const cleanedModalValue = String(actionModalValue || '').trim().replace(/\s+/g, ' ');
                const cleanedModalValueAr = String(actionModalValueAr || '').trim().replace(/\s+/g, ' ');
                const cleanedModalValueEn = String(actionModalValueEn || '').trim().replace(/\s+/g, ' ');
                if (!cleanedModalValue) { alert('Le nom est requis'); return; }
                if (actionModalType === 'rename') { await renameTheme(actionModalThemeId, cleanedModalValue, cleanedModalValueAr, cleanedModalValueEn); }
                else if (actionModalType === 'rename_subtheme') { await renameSubTheme(actionModalThemeId, cleanedModalValue, cleanedModalValueAr, cleanedModalValueEn); }
                else if (actionModalType === 'rename_categorie') { await renameCategorie(actionModalThemeId, cleanedModalValue, cleanedModalValueAr, cleanedModalValueEn); }
                else if (actionModalType === 'add_categorie') { await addCategorie(actionModalThemeId, cleanedModalValue, cleanedModalValueAr, cleanedModalValueEn); }
                else { 
                  const currentTheme = themes.find(t => t.id === actionModalThemeId);
                  if (currentTheme && currentTheme.categories && currentTheme.categories.length > 0 && !actionModalCategorieId) {
                    return alert('Veuillez sélectionner une catégorie');
                  }
                  await addSubTheme(actionModalThemeId, cleanedModalValue, actionModalCategorieId, cleanedModalValueAr, cleanedModalValueEn); 
                }
                setShowActionModal(false);
                setActionModalCategorieId(null);
                setActionModalValueAr('');
                setActionModalValueEn('');
              }} className="flex-1 bg-[#ffb366] py-2 border-2 border-black rounded-xl font-bold">Valider</button>
            </div>
          </div>
        </div>
      )}

      {/* Settings modal */}
      {showInfoBannerEditor && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 12000, backgroundColor: 'rgba(0,0,0,0.22)' }}>
          <div className="bg-white border-4 border-black p-6 rounded-3xl w-full max-w-4xl max-h-[82vh] overflow-y-auto shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-2xl font-bold text-[#1a5d85]">Gestion des infos</h2>
              <button
                onClick={() => setShowInfoBannerEditor(false)}
                className="px-3 py-1 rounded-lg border border-gray-300 bg-gray-100 hover:bg-gray-200 font-semibold"
              >
                Fermer
              </button>
            </div>

            <div className="space-y-3">
              {(infoBannerDraftItems || []).map((item, idx) => (
                <div key={`info-editor-${idx}`} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2">
                  <input
                    type="text"
                    value={item?.text || ''}
                    onChange={(e) => setInfoBannerDraftItems((prev) => prev.map((it, i) => i === idx ? { ...it, text: e.target.value } : it))}
                    placeholder="Titre FR de l'information"
                    className="bg-white text-[var(--color-primary)] px-3 py-2 rounded-lg font-medium border border-[var(--color-border)] outline-none focus:border-[#B03372]"
                  />
                  <input
                    type="text"
                    value={item?.text_ar || ''}
                    onChange={(e) => setInfoBannerDraftItems((prev) => prev.map((it, i) => i === idx ? { ...it, text_ar: e.target.value } : it))}
                    placeholder="عنوان المعلومة بالعربية"
                    dir="rtl"
                    className="bg-white text-[var(--color-primary)] px-3 py-2 rounded-lg font-medium border border-[var(--color-border)] outline-none focus:border-[#B03372]"
                  />
                  <input
                    type="text"
                    value={item?.text_en || ''}
                    onChange={(e) => setInfoBannerDraftItems((prev) => prev.map((it, i) => i === idx ? { ...it, text_en: e.target.value } : it))}
                    placeholder="Info title in English"
                    className="bg-white text-[var(--color-primary)] px-3 py-2 rounded-lg font-medium border border-[var(--color-border)] outline-none focus:border-[#B03372]"
                  />
                  <input
                    type="text"
                    value={item?.url || ''}
                    onChange={(e) => setInfoBannerDraftItems((prev) => prev.map((it, i) => i === idx ? { ...it, url: e.target.value } : it))}
                    placeholder="Lien partagé (optionnel): https://..."
                    className="bg-white text-[var(--color-primary)] px-3 py-2 rounded-lg font-medium border border-[var(--color-border)] outline-none focus:border-[#B03372]"
                  />
                  <button
                    type="button"
                    onClick={() => setInfoBannerDraftItems((prev) => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)}
                    className="px-3 py-2 rounded-lg font-semibold border bg-[#ffe5ef] text-[#8f245e] border-[#e2b5c8] hover:bg-[#ffd5e7]"
                    title="Supprimer"
                  >
                    Suppr
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 mt-5">
              <button
                type="button"
                  onClick={() => setInfoBannerDraftItems((prev) => [...(prev || []), { text: '', text_ar: '', text_en: '', url: '' }])}
                className="px-4 py-2 rounded-xl font-semibold border bg-white text-[#7A0A4A] border-[#d8b6c8] hover:bg-[#f7eaf1]"
              >
                + Ajouter info
              </button>
              <button
                type="button"
                onClick={saveInfoBanner}
                disabled={savingInfoBanner}
                className={`px-4 py-2 rounded-xl font-semibold border ${savingInfoBanner ? 'bg-gray-300 text-gray-700 border-gray-400 cursor-not-allowed' : 'bg-[#a12863] text-white border-[#d6619c] hover:bg-[#8f245e]'}`}
              >
                {savingInfoBanner ? 'Validation...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 12000, backgroundColor: 'rgba(62, 8, 39, 0.28)' }}>
          <div className="w-full max-w-lg rounded-2xl border border-[#B03372] bg-[#fffaf2] shadow-[0_18px_42px_rgba(94,7,56,0.34)] overflow-hidden">
            <div className="bg-gradient-to-r from-[#7A0A4A] to-[#B03372] px-6 py-4 border-b border-[#8c1f60]">
              <h2 className="text-xl md:text-2xl font-bold text-white">Informations du compte</h2>
              <p className="text-xs md:text-sm text-[#fbe3ef] mt-1">Mettre a jour votre profil, email et mot de passe.</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#6E001F] mb-1.5">Nom affiche</label>
                <input
                  type="text"
                  value={settingsForm.firstName}
                  onChange={(e) => {
                    setSettingsForm({...settingsForm, firstName: e.target.value});
                    if (settingsError) setSettingsError('');
                  }}
                  placeholder="Ex: Salma Jabiri"
                  className="w-full h-11 px-3 rounded-lg border border-[#CCB47F] bg-white text-[#4A062E] outline-none focus:border-[#B03372] focus:ring-2 focus:ring-[#f0c6dd]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#6E001F] mb-1.5">Email</label>
                <input
                  type="email"
                  value={settingsForm.email}
                  onChange={(e) => {
                    setSettingsForm({...settingsForm, email: e.target.value});
                    if (settingsError) setSettingsError('');
                  }}
                  className="w-full h-11 px-3 rounded-lg border border-[#CCB47F] bg-white text-[#4A062E] outline-none focus:border-[#B03372] focus:ring-2 focus:ring-[#f0c6dd]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#6E001F] mb-1.5">Nouveau mot de passe</label>
                <input
                  type="password"
                  value={settingsForm.newPassword}
                  onChange={(e) => {
                    setSettingsForm({...settingsForm, newPassword: e.target.value});
                    if (settingsError) setSettingsError('');
                  }}
                  placeholder="Laisser vide si inchangé"
                  className="w-full h-11 px-3 rounded-lg border border-[#CCB47F] bg-white text-[#4A062E] outline-none placeholder:text-[#9C7087] focus:border-[#B03372] focus:ring-2 focus:ring-[#f0c6dd]"
                />
                {settingsHasNewPassword && (
                  <div className="mt-2 rounded-lg border border-[#efc4d5] bg-[#fff1f7] p-2.5">
                    <div className="mb-1 text-xs font-semibold text-[#8f245e]">Securite du mot de passe</div>
                    <div className="space-y-1">
                      {settingsPasswordChecks.map((rule) => (
                        <div key={rule.id} className={`text-xs ${rule.valid ? 'text-green-700' : 'text-red-700'}`}>
                          {rule.valid ? '✔' : '✖'} {rule.label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#6E001F] mb-1.5">Confirmer le mot de passe</label>
                <input
                  type="password"
                  value={settingsForm.confirmPassword}
                  onChange={(e) => {
                    setSettingsForm({...settingsForm, confirmPassword: e.target.value});
                    if (settingsError) setSettingsError('');
                  }}
                  placeholder="Confirmer le nouveau mot de passe"
                  className="w-full h-11 px-3 rounded-lg border border-[#CCB47F] bg-white text-[#4A062E] outline-none placeholder:text-[#9C7087] focus:border-[#B03372] focus:ring-2 focus:ring-[#f0c6dd]"
                />
                {settingsHasNewPassword && settingsForm.confirmPassword && !settingsPasswordsMatch && (
                  <p className="mt-1 text-xs text-red-700">Les mots de passe ne correspondent pas.</p>
                )}
              </div>

              {settingsError && (
                <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {settingsError}
                </div>
              )}
            </div>

            <div className="px-6 pb-6 pt-2 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  setShowSettings(false);
                  setSettingsError('');
                }}
                className="flex-1 h-11 rounded-lg border border-[#CCB47F] bg-white text-[#6E001F] font-semibold hover:bg-[#f7ead2] transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={updateAccount}
                disabled={!settingsCanSubmit}
                className={`flex-1 h-11 rounded-lg border font-semibold transition-colors ${
                  settingsCanSubmit
                    ? 'border-[#B03372] bg-[#7A0A4A] text-white hover:bg-[#5E0738]'
                    : 'border-gray-300 bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                Enregistrer les modifications
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation modal */}
      {confirmModal.open && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 12000, backgroundColor: 'rgba(0,0,0,0.18)' }}>
          <div className="bg-white border-4 border-black p-6 rounded-3xl w-full max-w-sm shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="text-lg font-bold mb-2">Confirmer</h3>
            <p className="mb-4">{confirmModal.message}</p>
            <div className="flex gap-4">
              <button onClick={handleConfirmCancel} className="flex-1 bg-gray-200 py-2 border-2 border-black rounded-xl font-bold">Annuler</button>
              <button onClick={handleConfirmOk} className="flex-1 bg-[#ffb366] py-2 border-2 border-black rounded-xl font-bold">Confirmer</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed right-5 top-5 z-[12010] w-[min(92vw,360px)]">
          <div className="relative overflow-hidden rounded-2xl border border-[#e7d9e2] bg-white/95 shadow-[0_16px_40px_rgba(15,23,42,0.18)] backdrop-blur-sm">
            <div className={`absolute inset-y-0 left-0 w-1.5 ${getToastUi(toast.type).bar}`} />
            <div className="flex items-start gap-3 px-4 py-3.5">
              <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${getToastUi(toast.type).iconWrap}`}>
                {getToastUi(toast.type).icon}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{getToastUi(toast.type).label}</p>
                <p className="text-sm font-medium text-slate-700 break-words">{toast.message}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;





