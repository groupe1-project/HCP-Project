import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter, Legend } from 'recharts';
import * as XLSX from 'xlsx-js-style';
import LoginPage from './LoginPage';
import AdministratorsPage from './AdministratorsPage';
import ChartModal from './components/ChartModal';

// --- COMPOSANTS DE STYLE ---
const SidebarButton = ({ label, onClick, active }) => (
  <button 
    onClick={onClick}
    className={`w-full py-3 px-5 text-left font-semibold border-b border-[var(--color-border)] transition-colors uppercase tracking-wide ${
      active ? 'bg-[#f1dec0] text-[var(--color-primary)] shadow-sm' : 'bg-[var(--color-surface)] text-[var(--color-primary)] hover:bg-[#f7e8cf]'
    }`}
  >
    {label}
  </button>
);

function App({ forceVisitor = false }) {
  // --- AUTHENTIFICATION (toujours appelé en premier) ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState('');
  const [authContext, setAuthContext] = useState(() => {
    try { return localStorage.getItem('auth_context') || ''; } catch (e) { return ''; }
  });

  // --- ÉTATS (toujours déclarés, même s'ils ne sont pas utilisés si non authentifié) ---
  const [activeMenu, setActiveMenu] = useState(() => {
    if (typeof window === 'undefined') return 'Themes';
    return localStorage.getItem('activeMenu') || 'Themes';
  });
  const [formStep, setFormStep] = useState(0); 
  const [themes, setThemes] = useState([]);
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [selectedSubTheme, setSelectedSubTheme] = useState(null);
  const [selectedCategorie, setSelectedCategorie] = useState(null);
  const [themeData, setThemeData] = useState({ titre: '', nbSousThemes: 1, statut: 'Public' });
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
  const [actionModalThemeId, setActionModalThemeId] = useState(null);
  const [actionModalCategorieId, setActionModalCategorieId] = useState(null);
  const [rows, setRows] = useState([]);
  const [assignedSubThemes, setAssignedSubThemes] = useState([]);
  const [saisisseurAssignments, setSaisisseurAssignments] = useState([]);
  const [showThemeMeta, setShowThemeMeta] = useState(false);
  const [themeMeta, setThemeMeta] = useState({ definition_text: '', unite_text: '', indication_text: '', source_text: '', periodicite_text: '', couverture_text: '' });
  const [showSubThemeMeta, setShowSubThemeMeta] = useState(false);
  const [subThemeMeta, setSubThemeMeta] = useState({ definition_text: '', unite_text: '', indication_text: '', source_text: '', periodicite_text: '', couverture_text: '' });
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
  const [advancedConfig, setAdvancedConfig] = useState({ niveau_geo: null, type_unite: '', est_sommable: true, filtres_disponibles: [] });
  const [advancedConfigFiltersText, setAdvancedConfigFiltersText] = useState('');
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configSubTheme, setConfigSubTheme] = useState(null);
  const [modalVisitorCols, setModalVisitorCols] = useState([]);
  const [modalVisitorFilters, setModalVisitorFilters] = useState([]);
  const [modalVisitorColsText, setModalVisitorColsText] = useState('');
  const [modalVisitorFiltersText, setModalVisitorFiltersText] = useState('');
  const [modalVisitorHierarchy, setModalVisitorHierarchy] = useState([]);
  const [modalVisitorHierarchyText, setModalVisitorHierarchyText] = useState('');
  const [modalVisitorDefaultView, setModalVisitorDefaultView] = useState('horizontal');
  const [modalVisitorDefaultFilters, setModalVisitorDefaultFilters] = useState({});
  const [publicThemes, setPublicThemes] = useState([]);
  const [showEditTable, setShowEditTable] = useState(false);
  const [editTableRows, setEditTableRows] = useState([]);
  const [editTableColumns, setEditTableColumns] = useState([]);
  const [isSmartImporting, setIsSmartImporting] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [activeDataTab, setActiveDataTab] = useState('tableau');
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
    filter_column: '', 
    filter_value: '', 
    filter_mode: 'include',
    filters: [],  // Nouveaux filtres multiples
    visible_filters: [], // chart-level visitor-visible filters
    title: '',
    x_label: '',
    y_label: '',
    group_by: ''
  });
  const [chartVisitorFilters, setChartVisitorFilters] = useState({});
  const [excludedRowIndices, setExcludedRowIndices] = useState({});
  const [manageRowsModalChartId, setManageRowsModalChartId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ email: '', newPassword: '', confirmPassword: '' });
  const [searchTheme, setSearchTheme] = useState('');
  const [searchSubTheme, setSearchSubTheme] = useState('');
  const [searchIndicateur, setSearchIndicateur] = useState('');
  const [useCategories, setUseCategories] = useState(false);
  const [openCategorieMenu, setOpenCategorieMenu] = useState(null);
  const [categorieMenuPos, setCategorieMenuPos] = useState({ left: 0, top: 0 });
  const [categoryNames, setCategoryNames] = useState([{ nom: '', nbSousThemes: 1 }]);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [selectedVisitorCategoryId, setSelectedVisitorCategoryId] = useState('all');
  const [infoBannerText, setInfoBannerText] = useState("L'ICP du mois de Janvier 2026 est disponible");
  const [infoBannerDraft, setInfoBannerDraft] = useState('');
  const [savingInfoBanner, setSavingInfoBanner] = useState(false);
  const [siteContent, setSiteContent] = useState({
    about_title: 'A propos de la plateforme',
    about_text: '',
    contact_title: 'Contact',
    contact_email: '',
    contact_phone: '',
    contact_address: '',
    contact_hours: '',
    useful_links: [],
  });
  const [siteContentDraft, setSiteContentDraft] = useState({
    about_title: 'A propos de la plateforme',
    about_text: '',
    contact_title: 'Contact',
    contact_email: '',
    contact_phone: '',
    contact_address: '',
    contact_hours: '',
    useful_links: [],
  });
  const [savingSiteContent, setSavingSiteContent] = useState(false);

  // --- TOUS LES useEffect EN MÊME TEMPS ---
  const pathname = (typeof window !== 'undefined' && window.location.pathname) ? window.location.pathname.toLowerCase() : '/';
  const pathHasVisiteur = pathname === '/visiteur' || pathname.startsWith('/visiteur/');
  const pathHasSaisisseur = pathname === '/saisisseur' || pathname.startsWith('/saisisseur/');
  const pathHasAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
  const isVisitor = forceVisitor || pathHasVisiteur;
  const isSaisisseur = pathHasSaisisseur || (userRole === 'SAISISSEUR' && isAuthenticated);
  const canEdit = isAuthenticated && !isVisitor;
  const themesApiBase = isVisitor ? 'http://127.0.0.1:8000/api/public-themes/' : 'http://127.0.0.1:8000/api/themes/';
  const infoBannerApi = 'http://127.0.0.1:8000/api/info-banner/';
  const siteContentApi = 'http://127.0.0.1:8000/api/site-content/';
  const isInfoMenu = ['Contact', 'APropos', 'LiensUtiles'].includes(activeMenu);

  const parseAssignmentNotes = (rawNotes) => {
    try {
      return rawNotes ? JSON.parse(rawNotes) : {};
    } catch (e) {
      return {};
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

    if (Array.isArray(notes.tables)) {
      draftSubTheme.data = notes.tables;
      draftSubTheme.data_json = notes.tables;
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
      meta: {
        definition_text: selectedSubTheme?.definition_text || '',
        unite_text: selectedSubTheme?.unite_text || '',
        indication_text: selectedSubTheme?.indication_text || '',
        source_text: selectedSubTheme?.source_text || '',
        periodicite_text: selectedSubTheme?.periodicite_text || '',
        couverture_text: selectedSubTheme?.couverture_text || '',
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
      const saisisseurToken = localStorage.getItem('auth_token_saisisseur') || localStorage.getItem('auth_token');
      const saisisseurRequestConfig = saisisseurToken
        ? { headers: { Authorization: `Token ${saisisseurToken}` } }
        : {};
      const userId = localStorage.getItem('user_id_saisisseur') || localStorage.getItem('user_id');
      if (!userId) return alert('Utilisateur non identifié (saisisseur)');
      if (!selectedSubTheme) return alert('Aucun sous-thème sélectionné');

      let existing = getSaisisseurAssignmentForSubTheme(selectedSubTheme.id);
      if (!existing) {
        const resp = await axios.get('http://127.0.0.1:8000/api/user-theme-assignments/', saisisseurRequestConfig);
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
        try { mergedNotes = existing.notes ? JSON.parse(existing.notes) : {}; } catch (e) { mergedNotes = {}; }
      }
      mergedNotes = { ...mergedNotes, ...partialNotes };

      const patchResponse = await axios.patch(
        `http://127.0.0.1:8000/api/user-theme-assignments/${existing.id}/`,
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

  useEffect(() => {
    // Select token/user info based on stored auth_context (preferred) or current path
    try {
      const authContext = localStorage.getItem('auth_context');
      let token = null;
      let role = '';

      if (authContext === 'admin') {
        token = localStorage.getItem('auth_token_admin');
        role = localStorage.getItem('user_role_admin') || '';
      } else if (authContext === 'saisisseur') {
        token = localStorage.getItem('auth_token_saisisseur');
        role = localStorage.getItem('user_role_saisisseur') || '';
      } else if (pathHasAdmin) {
        token = localStorage.getItem('auth_token_admin');
        role = localStorage.getItem('user_role_admin') || '';
      } else if (pathHasSaisisseur) {
        token = localStorage.getItem('auth_token_saisisseur');
        role = localStorage.getItem('user_role_saisisseur') || '';
      } else {
        token = localStorage.getItem('auth_token');
        role = localStorage.getItem('user_role') || '';
      }

      if (token && !isVisitor) {
        axios.defaults.headers.common['Authorization'] = `Token ${token}`;
        setIsAuthenticated(true);
      } else {
        delete axios.defaults.headers.common['Authorization'];
      }
      setUserRole(role);
    } catch (e) {
      console.error('Erreur lors de l\'initialisation du token', e);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    // Always reopen step-4 on the table tab when a subtheme is opened.
    if (formStep === 4 && selectedSubTheme) {
      setActiveDataTab('tableau');
    }
  }, [formStep, selectedSubTheme?.id]);

  useEffect(() => {
    const fetchInfoBanner = async () => {
      try {
        const res = await axios.get(infoBannerApi);
        const message = String(res?.data?.message || '').trim();
        if (message) {
          setInfoBannerText(message);
          setInfoBannerDraft(message);
        }
      } catch (err) {
        console.error('Erreur chargement info banner', err);
      }
    };

    fetchInfoBanner();
  }, []);

  useEffect(() => {
    const fetchSiteContent = async () => {
      try {
        const res = await axios.get(siteContentApi);
        const payload = {
          about_title: String(res?.data?.about_title || 'A propos de la plateforme'),
          about_text: String(res?.data?.about_text || ''),
          contact_title: String(res?.data?.contact_title || 'Contact'),
          contact_email: String(res?.data?.contact_email || ''),
          contact_phone: String(res?.data?.contact_phone || ''),
          contact_address: String(res?.data?.contact_address || ''),
          contact_hours: String(res?.data?.contact_hours || ''),
          useful_links: Array.isArray(res?.data?.useful_links) ? res.data.useful_links : [],
        };
        setSiteContent(payload);
        setSiteContentDraft(payload);
      } catch (err) {
        console.error('Erreur chargement contenu site', err);
      }
    };

    fetchSiteContent();
  }, []);

  // Keep axios Authorization header in sync with the current auth_context
  useEffect(() => {
    try {
      const ctx = authContext || localStorage.getItem('auth_context');
      let token = null;
      if (ctx === 'admin') token = localStorage.getItem('auth_token_admin');
      else if (ctx === 'saisisseur') token = localStorage.getItem('auth_token_saisisseur');
      else token = localStorage.getItem('auth_token');

      if (token) axios.defaults.headers.common['Authorization'] = `Token ${token}`;
      else delete axios.defaults.headers.common['Authorization'];
    } catch (e) {
      console.error('Erreur sync auth header', e);
    }
  }, [authContext]);

  // When user switches menu or path, prefer the matching auth context if a token exists.
  useEffect(() => {
    try {
      // If activeMenu explicitly Saisisseur, prefer saisisseur context
      if (activeMenu === 'Saisisseur' || pathHasSaisisseur) {
        if (localStorage.getItem('auth_token_saisisseur')) {
          localStorage.setItem('auth_context', 'saisisseur');
          setAuthContext('saisisseur');
          return;
        }
      }

      // If activeMenu explicitly Admin, prefer admin context
      if (activeMenu === 'Admin' || pathHasAdmin) {
        if (localStorage.getItem('auth_token_admin')) {
          localStorage.setItem('auth_context', 'admin');
          setAuthContext('admin');
          return;
        }
      }
    } catch (e) {
      // ignore
    }
  }, [activeMenu, pathHasSaisisseur, pathHasAdmin]);

  // Enforce and persist role-based active menu so saisisseur reste sur son espace après refresh
  useEffect(() => {
    // Visitor mode must never open admin/saisisseur workspace even if localStorage has old value
    if (isVisitor) {
      const visitorAllowedMenus = ['Themes', 'Indicateurs', 'APropos', 'Contact', 'LiensUtiles'];
      if (!visitorAllowedMenus.includes(activeMenu)) {
        setActiveMenu('Themes');
        try { localStorage.setItem('activeMenu', 'Themes'); } catch (e) {}
        return;
      }
      try { localStorage.setItem('activeMenu', activeMenu); } catch (e) {}
      return;
    }

    // If the user is a saisisseur, ensure they don't land on Admin
    if (isSaisisseur && activeMenu === 'Admin') {
      setActiveMenu('Saisisseur');
      try { localStorage.setItem('activeMenu', 'Saisisseur'); } catch (e) {}
      return;
    }

    // If not a saisisseur but stored menu is 'Saisisseur', fall back to Themes
    if (!isSaisisseur && activeMenu === 'Saisisseur') {
      setActiveMenu('Themes');
      try { localStorage.setItem('activeMenu', 'Themes'); } catch (e) {}
      return;
    }

    // Persist any change to activeMenu
    try { localStorage.setItem('activeMenu', activeMenu); } catch (e) {}
  }, [isVisitor, isSaisisseur, activeMenu]);

  useEffect(() => { 
    if (isAuthenticated || isVisitor) fetchThemes(); 
  }, [isAuthenticated]);

  // For saisisseur: fetch assignments and preload assigned sous-thèmes
  useEffect(() => {
    if (!isSaisisseur) return;
    const loadAssignments = async () => {
      try {
        const userId = localStorage.getItem('user_id_saisisseur') || localStorage.getItem('user_id');
        if (!userId) return;
        const resp = await axios.get('http://127.0.0.1:8000/api/user-theme-assignments/');
        const my = resp.data.filter(a => String(a.user) === String(userId) && a.sous_theme);
        setSaisisseurAssignments(my);
        const subs = [];
        for (const a of my) {
          try {
            const r = await axios.get(`http://127.0.0.1:8000/api/sousthemes/${a.sous_theme}/`);
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
  }, [isSaisisseur, formStep, assignedSubThemes]);

  // Recharger les thèmes quand on revient sur l'onglet Themes
  useEffect(() => {
    if ((isAuthenticated || isVisitor) && activeMenu === 'Themes') {
      fetchThemes();
    }
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
  }, [isSaisisseur, saisisseurAssignments]);

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
          const res = await axios.get(`http://127.0.0.1:8000/api/sousthemes/${subThemeId}/`);
          found = res.data;
        }
        if (!found) return;

        // helper to parse possible stored defaults into an object
        const parseDefaultsString = (raw) => {
          if (!raw && raw !== '') return {};
          if (typeof raw === 'object' && raw !== null) return raw;
          if (typeof raw === 'string') {
            try { return JSON.parse(raw); } catch (_) {}
            const obj = {};
            const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
            parts.forEach(part => {
              const sep = part.includes('=') ? '=' : (part.includes(':') ? ':' : null);
              if (sep) {
                const [k, v] = part.split(sep).map(s => s.trim());
                if (k && v) obj[k] = v;
              }
            });
            return obj;
          }
            return {};
          };

        setConfigSubTheme(found);
        const cols = found.visitor_visible_columns || [];
        const rawFilters = found.visitor_filters || found.filtres_disponibles || [];
        const normalizeFilters = (arr) => {
          if (!Array.isArray(arr)) return [];
          return arr.map(item => (typeof item === 'string' ? item : (item && item.column) ? item.column : String(item)));
        };
        const filters = normalizeFilters(rawFilters);
        const hierarchy = normalizeFilters(found.visitor_pivot_columns || []);

        // Start with the live SousTheme values
        let vcCols = cols;
        let vcFilters = filters;
        let vcHierarchy = hierarchy;
        let vcDefaultView = (found.visitor_default_view === 'vertical') ? 'vertical' : 'horizontal';
        let vcDefaultFilters = parseDefaultsString(found.visitor_default_filters || {});

        // If saisisseur, prefer the pending visitor_config stored in assignment notes
        if (isSaisisseur) {
          const assignmentForSt = getSaisisseurAssignmentForSubTheme(found.id);
          if (assignmentForSt) {
            try {
              const notesParsed = assignmentForSt.notes ? JSON.parse(assignmentForSt.notes) : {};
              const vc = notesParsed.visitor_config;
              if (vc && typeof vc === 'object') {
                if (Array.isArray(vc.visitor_visible_columns)) vcCols = vc.visitor_visible_columns;
                if (Array.isArray(vc.visitor_filters)) vcFilters = vc.visitor_filters;
                if (Array.isArray(vc.visitor_pivot_columns)) vcHierarchy = vc.visitor_pivot_columns;
                if (vc.visitor_default_view) vcDefaultView = vc.visitor_default_view === 'vertical' ? 'vertical' : 'horizontal';
                if (vc.visitor_default_filters) vcDefaultFilters = parseDefaultsString(vc.visitor_default_filters);
              }
            } catch (_) {}
          }
        }

        setModalVisitorCols(vcCols);
        setModalVisitorFilters(vcFilters);
        setModalVisitorHierarchy(vcHierarchy);
        setModalVisitorColsText(Array.isArray(vcCols) ? vcCols.join(', ') : String(vcCols || ''));
        setModalVisitorFiltersText(vcFilters.join(', '));
        setModalVisitorHierarchyText(vcHierarchy.join(', '));
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
  }, [selectedSubTheme?.id, isVisitor]);

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
          if (typeof item === 'string') {
            defaults[item] = '';
          } else if (item && item.column) {
            defaults[item.column] = item.default || '';
          }
        });
        map[chart.id] = defaults;
      });
      setChartVisitorFilters(map);
    } catch (err) {
      console.error('Error initializing chart visitor filters defaults', err);
    }
  }, [savedCharts]);

  // Apply sub-theme-level visitor default filters (e.g. Annee=2022) to each chart's visitor selections
  useEffect(() => {
    if (!isVisitor || !selectedSubTheme) return;
    try {
      const raw = selectedSubTheme.visitor_default_filters || {};
      const parse = (rawVal) => {
        if (rawVal === null || rawVal === undefined) return {};
        if (typeof rawVal === 'object') return rawVal || {};
        if (typeof rawVal === 'string') {
          try { return JSON.parse(rawVal); } catch (_) {}
          const out = {};
          rawVal.split(',').map(s => s.trim()).filter(Boolean).forEach(part => {
            const sep = part.includes('=') ? '=' : (part.includes(':') ? ':' : null);
            if (!sep) return;
            const [k, v] = part.split(sep).map(p => p.trim());
            if (k && v) out[k] = v;
          });
          return out;
        }
        return {};
      };

      const defaultsObj = parse(raw);
      const newMap = { ...(chartVisitorFilters || {}) };
      (savedCharts || []).forEach(chart => {
        const vf = chart.visible_filters || [];
        if (!vf || vf.length === 0) return;
        newMap[chart.id] = { ...(newMap[chart.id] || {}) };
        vf.forEach(item => {
          const col = typeof item === 'string' ? item : (item && item.column) || '';
          if (!col) return;
          if (defaultsObj && Object.prototype.hasOwnProperty.call(defaultsObj, col)) {
            newMap[chart.id][col] = defaultsObj[col];
          } else if (typeof item === 'object' && item && item.default) {
            // fallback to per-chart defined default
            if (!newMap[chart.id][col]) newMap[chart.id][col] = item.default;
          }
        });
      });
      setChartVisitorFilters(newMap);
    } catch (err) {
      console.error('Error applying subtheme visitor default filters to charts', err);
    }
  }, [selectedSubTheme, isVisitor, savedCharts]);

  // Apply sub-theme-level visitor default filters to table dynamic filters (so the table is filtered for visitors)
  useEffect(() => {
    if (!isVisitor || !selectedSubTheme) return;
    try {
      const raw = selectedSubTheme.visitor_default_filters || {};
      const parseDefaults = (rawVal) => {
        if (rawVal === null || rawVal === undefined) return {};
        if (typeof rawVal === 'object') return rawVal || {};
        if (typeof rawVal === 'string') {
          try { return JSON.parse(rawVal); } catch (_) {}
          const out = {};
          rawVal.split(',').map(s => s.trim()).filter(Boolean).forEach(part => {
            const sep = part.includes('=') ? '=' : (part.includes(':') ? ':' : null);
            if (!sep) return;
            const [k, v] = part.split(sep).map(p => p.trim());
            if (k && v) out[k] = v;
          });
          return out;
        }
        return {};
      };

      const defaults = parseDefaults(raw);

      const candidateColumns = [
        ...(selectedSubTheme.visitor_filters || []),
        ...(selectedSubTheme.filtres_disponibles || []),
        ...(selectedSubTheme.columns || [])
      ].map(item => (typeof item === 'string' ? item : (item && item.column) ? item.column : String(item))).filter(Boolean);

      const periodCol = candidateColumns.find(c => /(annee|année|period|période|year)/i.test(String(c).toLowerCase()));

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
          return String(a).localeCompare(String(b), 'fr', { numeric: true, sensitivity: 'base' });
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
          return changed ? next : previous;
        }

        if (periodCol) {
          const current = next[periodCol];
          const hasCurrent = Array.isArray(current) ? current.length > 0 : (current !== undefined && current !== null && current !== '');
          if (!hasCurrent) {
            const latest = findLatestPeriodValue();
            if (latest !== null && latest !== undefined && latest !== '') {
              next[periodCol] = String(latest);
              changed = true;
            }
          }
        }

        return changed ? next : previous;
      });
    } catch (err) {
      console.error('Error applying visitor default filters to table', err);
    }
  }, [selectedSubTheme, isVisitor]);

  // Initialize per-chart visitor filters state from savedCharts (defaults)
  useEffect(() => {
    try {
      // If the user navigated to /admin or /saisisseur and a token for that context exists,
      // prefer to set the authContext accordingly so subsequent requests use the right token.
      if (pathHasAdmin && localStorage.getItem('auth_token_admin')) {
        setAuthContext('admin');
      } else if (pathHasSaisisseur && localStorage.getItem('auth_token_saisisseur')) {
        setAuthContext('saisisseur');
      }

      const ctx = authContext || localStorage.getItem('auth_context');
      let token = null;
      let role = '';

      if (ctx === 'admin') {
        token = localStorage.getItem('auth_token_admin');
        role = localStorage.getItem('user_role_admin') || '';
      } else if (ctx === 'saisisseur') {
        token = localStorage.getItem('auth_token_saisisseur');
        role = localStorage.getItem('user_role_saisisseur') || '';
      } else if (pathHasAdmin) {
        token = localStorage.getItem('auth_token_admin');
        role = localStorage.getItem('user_role_admin') || '';
      } else if (pathHasSaisisseur) {
        token = localStorage.getItem('auth_token_saisisseur');
        role = localStorage.getItem('user_role_saisisseur') || '';
      } else {
        token = localStorage.getItem('auth_token');
        role = localStorage.getItem('user_role') || '';
      }

      if (token && !isVisitor) {
        axios.defaults.headers.common['Authorization'] = `Token ${token}`;
        setIsAuthenticated(true);
      } else {
        delete axios.defaults.headers.common['Authorization'];
      }
      setUserRole(role);
    } catch (e) {
      console.error("Erreur lors de l'initialisation du token", e);
    } finally {
      setAuthLoading(false);
    }
  }, [authContext]);
  
  // --- HELPER FUNCTIONS ---
  const getTableRows = (sub) => {
    if (!sub) return [];
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
        } catch (__) { /* ignore parse errors */ }
        console.debug('getTableRows called:', info);
      }
    } catch (e) {
      console.warn('getTableRows debug failed', e);
    }
    // Prefer explicit `data` if it's an array
    if (Array.isArray(sub.data)) return sub.data;
    // If `data_json` exists, it may be an object or a JSON string
    const dj = sub.data_json ?? sub.dataJson ?? sub.dataJsonString ?? null;
    if (Array.isArray(dj)) return dj;
    if (dj && typeof dj === 'object') {
      if (Array.isArray(dj.rows)) return dj.rows;
      // sometimes the stored object is { "rows": [...] } or similar
      // fallback: try to find the first array value
      const vals = Object.values(dj).find(v => Array.isArray(v));
      if (Array.isArray(vals)) return vals;
    }
    if (typeof dj === 'string') {
      try {
        const parsed = JSON.parse(dj);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && Array.isArray(parsed.rows)) return parsed.rows;
      } catch (e) {
        // not JSON — ignore
      }
    }
    // Last resort: if sub.data is object, try to get values
    if (sub.data && typeof sub.data === 'object') {
      // If it's an object-of-arrays (columns -> arrays), convert to array of row objects
      const colEntries = Object.entries(sub.data).filter(([k, v]) => Array.isArray(v));
      if (colEntries.length > 0) {
        const maxLen = Math.max(...colEntries.map(([, v]) => v.length));
        const rows = Array.from({ length: maxLen }, (_, i) => {
          const obj = {};
          colEntries.forEach(([k, v]) => { obj[k] = v[i] !== undefined ? v[i] : ''; });
          return obj;
        });
        return rows;
      }
      // fallback: try to find the first array value
      const vals = Object.values(sub.data).find(v => Array.isArray(v));
      if (Array.isArray(vals)) return vals;
    }

    // Handle other common import wrappers (data_json may contain sheet maps etc.)
    try {
      const djWrapped = sub.data_json && typeof sub.data_json === 'object' ? sub.data_json : null;
      if (djWrapped) {
        // If keys are sheet names mapping to { rows: [...] } or arrays
        for (const key of Object.keys(djWrapped)) {
          const val = djWrapped[key];
          if (Array.isArray(val)) return val;
          if (val && Array.isArray(val.rows)) return val.rows;
          // sometimes sheet -> { data: { columns... } }
          if (val && val.data && typeof val.data === 'object') {
            const entries = Object.entries(val.data).filter(([k, v]) => Array.isArray(v));
            if (entries.length > 0) {
              const maxLen = Math.max(...entries.map(([, v]) => v.length));
              return Array.from({ length: maxLen }, (_, i) => {
                const obj = {};
                entries.forEach(([k, v]) => { obj[k] = v[i] !== undefined ? v[i] : ''; });
                return obj;
              });
            }
          }
        }
      }
    } catch (e) {
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
    } catch (e) {
      setSelectedSubTheme(buildDraftSubTheme(sub));
    }
  };
  const handleLogin = () => {
    setIsAuthenticated(true);
    // refresh userRole from stored auth_context
    try {
      const authContext = localStorage.getItem('auth_context');
      if (authContext === 'admin') setUserRole(localStorage.getItem('user_role_admin') || '');
      else if (authContext === 'saisisseur') setUserRole(localStorage.getItem('user_role_saisisseur') || '');
      else setUserRole(localStorage.getItem('user_role') || '');
    } catch (e) { setUserRole(localStorage.getItem('user_role') || ''); }
    // refresh authContext state
    try { setAuthContext(localStorage.getItem('auth_context') || ''); } catch (e) { setAuthContext(''); }
    // if current path is /admin and user is admin, ensure active menu is Admin
    try {
      const p = (typeof window !== 'undefined' && window.location.pathname) ? window.location.pathname.toLowerCase() : '/';
      if (p.startsWith('/admin') && (localStorage.getItem('user_role_admin') === 'ADMIN' || localStorage.getItem('user_role') === 'ADMIN')) {
        setActiveMenu('Admin');
        try { localStorage.setItem('activeMenu', 'Admin'); } catch (e) {}
      }
    } catch (e) {}
  };

  const handleLogout = () => {
    // remove tokens for all contexts to fully logout
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('username');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_role');
    localStorage.removeItem('auth_token_admin');
    localStorage.removeItem('user_id_admin');
    localStorage.removeItem('username_admin');
    localStorage.removeItem('user_email_admin');
    localStorage.removeItem('user_role_admin');
    localStorage.removeItem('auth_token_saisisseur');
    localStorage.removeItem('user_id_saisisseur');
    localStorage.removeItem('username_saisisseur');
    localStorage.removeItem('user_email_saisisseur');
    localStorage.removeItem('user_role_saisisseur');
    try { localStorage.removeItem('activeMenu'); localStorage.removeItem('auth_context'); } catch (e) {}
    setAuthContext('');
    delete axios.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
    setUserRole('');
  };

  const resolveCurrentAuthStorage = () => {
    let ctx = '';
    try {
      ctx = localStorage.getItem('auth_context') || '';
    } catch (e) {
      ctx = '';
    }

    if (!ctx) {
      if (isSaisisseur) ctx = 'saisisseur';
      else if (pathHasAdmin || userRole === 'ADMIN') ctx = 'admin';
    }

    if (ctx === 'saisisseur') {
      return {
        context: 'saisisseur',
        userId: localStorage.getItem('user_id_saisisseur') || localStorage.getItem('user_id'),
        email: localStorage.getItem('user_email_saisisseur') || localStorage.getItem('user_email') || '',
        token: localStorage.getItem('auth_token_saisisseur') || localStorage.getItem('auth_token') || '',
        emailKey: localStorage.getItem('user_email_saisisseur') !== null ? 'user_email_saisisseur' : 'user_email',
      };
    }

    if (ctx === 'admin') {
      return {
        context: 'admin',
        userId: localStorage.getItem('user_id_admin') || localStorage.getItem('user_id'),
        email: localStorage.getItem('user_email_admin') || localStorage.getItem('user_email') || '',
        token: localStorage.getItem('auth_token_admin') || localStorage.getItem('auth_token') || '',
        emailKey: localStorage.getItem('user_email_admin') !== null ? 'user_email_admin' : 'user_email',
      };
    }

    return {
      context: 'default',
      userId: localStorage.getItem('user_id') || '',
      email: localStorage.getItem('user_email') || '',
      token: localStorage.getItem('auth_token') || '',
      emailKey: 'user_email',
    };
  };

  const updateAccount = async () => {
    if (settingsForm.newPassword && settingsForm.newPassword !== settingsForm.confirmPassword) {
      showToast('Les mots de passe ne correspondent pas', 'error');
      return;
    }

    const auth = resolveCurrentAuthStorage();
    if (!auth.userId) {
      showToast('Utilisateur non identifié', 'error');
      return;
    }

    try {
      const payload = { email: settingsForm.email };
      if (settingsForm.newPassword) payload.password = settingsForm.newPassword;

      const requestConfig = auth.token
        ? { headers: { Authorization: `Token ${auth.token}` } }
        : undefined;

      await axios.patch(`http://127.0.0.1:8000/api/users/${auth.userId}/`, payload, requestConfig);
      localStorage.setItem(auth.emailKey, settingsForm.email);
      if (auth.context === 'saisisseur') localStorage.setItem('user_email', settingsForm.email);
      showToast('Informations mises à jour', 'success');
      setShowSettings(false);
      setSettingsForm({ email: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      console.error(err);
      const serverError = err?.response?.data?.error;
      showToast(serverError || 'Erreur lors de la mise à jour', 'error');
    }
  };

  const saveInfoBanner = async () => {
    const msg = (infoBannerDraft || '').trim();
    if (!msg) {
      showToast('Le message info ne peut pas etre vide', 'warning');
      return;
    }

    try {
      setSavingInfoBanner(true);
      const res = await axios.put(infoBannerApi, { message: msg });
      const savedMessage = String(res?.data?.message || msg).trim();
      setInfoBannerText(savedMessage || msg);
      setInfoBannerDraft(savedMessage || msg);
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
      };
      const res = await axios.put(siteContentApi, payload);
      const saved = {
        about_title: String(res?.data?.about_title || payload.about_title || 'A propos de la plateforme'),
        about_text: String(res?.data?.about_text || payload.about_text || ''),
        contact_title: String(res?.data?.contact_title || payload.contact_title || 'Contact'),
        contact_email: String(res?.data?.contact_email || payload.contact_email || ''),
        contact_phone: String(res?.data?.contact_phone || payload.contact_phone || ''),
        contact_address: String(res?.data?.contact_address || payload.contact_address || ''),
        contact_hours: String(res?.data?.contact_hours || payload.contact_hours || ''),
        useful_links: Array.isArray(res?.data?.useful_links) ? res.data.useful_links : payload.useful_links,
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
        `http://127.0.0.1:8000/api/sousthemes/${selectedSubTheme.id}/charts/${chartId}/`,
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

  const handleResetChartExclusions = (chartId) => {
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

    const normalizedRows = rowsCopy.map((row) =>
      Object.fromEntries(baseCols.map((col) => [col, row?.[col] ?? '']))
    );

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
      await axios.post(`http://127.0.0.1:8000/api/themes/${id}/archive/`);
      showToast('Thème archivé', 'success');
      const res = await axios.get(themesApiBase);
      setThemes(res.data);
      if (selectedTheme && selectedTheme.id === id) setSelectedTheme(res.data.find(t => t.id === id));
    } catch (err) { console.error(err); showToast('Erreur lors de l\'archivage', 'error'); }
  };

  const unarchiveTheme = async (id) => {
    try {
      await axios.post(`http://127.0.0.1:8000/api/themes/${id}/unarchive/`);
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
      await axios.delete(`http://127.0.0.1:8000/api/themes/${id}/`);
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

  const renameTheme = async (id, newName) => {
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
      await axios.patch(`http://127.0.0.1:8000/api/themes/${id}/`, { titre: cleanedName });
      alert('Thème renommé');
      const res = await axios.get(themesApiBase);
      setThemes(res.data);
      if (selectedTheme && selectedTheme.id === id) setSelectedTheme(res.data.find(t => t.id === id));
    } catch (err) { console.error(err); alert(err.response?.data?.titre?.[0] || err.response?.data?.error || 'Erreur lors du renommage'); }
  };

  const addSubTheme = async (themeId, name, categorieId = null) => {
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
      const payload = { nom: cleanedName };
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
      const res = await axios.post(`http://127.0.0.1:8000/api/themes/${themeId}/sous_themes/`, payload);
      alert('Sous-thème ajouté');
      const themesRes = await axios.get(themesApiBase);
      setThemes(themesRes.data);
      const fresh = themesRes.data.find(t => t.id === themeId);
      if (fresh) setSelectedTheme(fresh);
    } catch (err) { console.error(err); alert(err.response?.data?.nom?.[0] || err.response?.data?.error || 'Erreur lors de l\'ajout du sous-thème'); }
  };

  const addCategorie = async (themeId, name) => {
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
      const payload = { nom: cleanedName, theme: themeId, ordre, is_visible: theme?.is_visible ?? true };
      await axios.post('http://127.0.0.1:8000/api/categories/', payload);
      alert('Catégorie ajoutée');
      const themesRes = await axios.get(themesApiBase);
      setThemes(themesRes.data);
      const fresh = themesRes.data.find(t => t.id === themeId);
      if (fresh) setSelectedTheme(fresh);
    } catch (err) { console.error(err); alert(err.response?.data?.nom?.[0] || err.response?.data?.error || 'Erreur lors de l\'ajout de la catégorie'); }
  };

  const renameSubTheme = async (id, newName) => {
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
      await axios.patch(`http://127.0.0.1:8000/api/sousthemes/${id}/`, { nom: cleanedName });
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
      await axios.patch(`http://127.0.0.1:8000/api/sousthemes/${id}/`, { archived: true });
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
      await axios.patch(`http://127.0.0.1:8000/api/sousthemes/${id}/`, { archived: false });
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
      await axios.delete(`http://127.0.0.1:8000/api/sousthemes/${id}/`);
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
      if (!confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ? Tous les sous-thèmes seront supprimés.')) return;
      
      await axios.delete(`http://127.0.0.1:8000/api/categories/${categorieId}/`);
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
    } catch (err) {
      console.error(err);
      showToast('Erreur lors de la suppression de la catégorie', 'error');
    }
  };

  const toggleThemePublication = async (themeId, newVisibility) => {
    try {
      // Change theme visibility
      await axios.patch(`http://127.0.0.1:8000/api/themes/${themeId}/`, { is_visible: newVisibility });
      
      // Cascade: update all categories and their sous-themes
      const theme = themes.find(t => t.id === themeId);
      if (theme) {
        // If theme has categories, cascade to them and their sous-thèmes
        if (theme.categories && theme.categories.length > 0) {
          for (const category of theme.categories) {
            // Use toggle-visibility action to cascade to sous-thèmes
            await axios.post(`http://127.0.0.1:8000/api/categories/${category.id}/toggle-visibility/`, { is_visible: newVisibility });
          }
        } else {
          // If no categories, update sous-themes directly
          if (theme.sous_themes) {
            for (const subTheme of theme.sous_themes) {
              await axios.patch(`http://127.0.0.1:8000/api/sousthemes/${subTheme.id}/`, { is_visible: newVisibility });
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
      const finalColumns = (editTableColumns || [])
        .map((c) => String(c ?? '').trim())
        .filter((c) => c !== '');

      if (finalColumns.length === 0) {
        alert('Veuillez définir au moins une colonne');
        return;
      }

      if (new Set(finalColumns).size !== finalColumns.length) {
        alert('Les noms des colonnes doivent être uniques');
        return;
      }

      const normalizedRows = (editTableRows || []).map((row) =>
        Object.fromEntries(finalColumns.map((col) => [col, row?.[col] ?? '']))
      );

      if (isSaisisseur) {
        // Save table rows in assignment notes as draft
        await saveDraftAssignmentForSaisisseur({ tables: normalizedRows, columns_order: finalColumns }, 'En cours');
        alert('Brouillon de la table enregistré');
        setShowEditTable(false);
        return;
      }

      const res = await axios.patch(`http://127.0.0.1:8000/api/sousthemes/${selectedSubTheme.id}/`, {
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

  const handleImportFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('Remplacer le tableau existant par ce fichier ?')) { if (e.target) e.target.value = null; return; }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('free_schema', 'true');

    const readExcelRows = async (excelFile) => {
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

    try {
      if (isSaisisseur) {
        const imported = await readExcelRows(file);
        if (!imported.columns.length) {
          alert('Le fichier importé est vide ou sans colonnes exploitables.');
          if (e.target) e.target.value = null;
          return;
        }

        await saveDraftAssignmentForSaisisseur({
          tables: imported.rows,
          columns_order: imported.columns,
        }, 'En cours');

        setEditTableColumns(imported.columns);
        setEditTableRows(imported.rows);
        alert('Import effectué en brouillon (saisisseur).');
        if (e.target) e.target.value = null;
        return;
      }

      // Let the browser set the multipart boundary header automatically
      await axios.post(`http://127.0.0.1:8000/api/sousthemes/${selectedSubTheme.id}/import/`, fd);
      alert('Import réussi');
      // refresh
      const themesRes = await axios.get(themesApiBase);
      setThemes(themesRes.data);
      const freshTheme = themesRes.data.find(t => t.id === selectedTheme?.id);
      if (freshTheme) setSelectedTheme(freshTheme);
      const freshSub = freshTheme?.sous_themes?.find(st => st.id === selectedSubTheme.id);
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
    } catch (err) { console.error(err.response?.data || err); alert('Erreur lors de l\'import: ' + (err.response?.data?.error || err.message)); }
    if (e.target) e.target.value = null;
  };

  const handleSmartImportFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('Importer avec IA et remapper vers la structure actuelle du tableau ?')) { if (e.target) e.target.value = null; return; }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('free_schema', 'true');

    const normalizeCol = (v) => String(v || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const readExcelRows = async (excelFile) => {
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

    try {
      if (isSaisisseur) {
        const imported = await readExcelRows(file);
        if (!imported.columns.length) {
          alert('Le fichier importé est vide ou sans colonnes exploitables.');
          if (e.target) e.target.value = null;
          return;
        }

        const targetColumns = (editTableColumns && editTableColumns.length > 0)
          ? editTableColumns
          : (selectedSubTheme?.columns || (getTableRows(selectedSubTheme)?.[0] ? Object.keys(getTableRows(selectedSubTheme)[0]) : []));

        if (!targetColumns || targetColumns.length === 0) {
          await saveDraftAssignmentForSaisisseur({ tables: imported.rows, columns_order: imported.columns }, 'En cours');
          setEditTableColumns(imported.columns);
          setEditTableRows(imported.rows);
          alert('Import brouillon effectué. Aucune structure cible trouvée, colonnes source conservées.');
          if (e.target) e.target.value = null;
          return;
        }

        const sourceByNorm = new Map(imported.columns.map((c) => [normalizeCol(c), c]));
        const mappedRows = imported.rows.map((r) => {
          const out = {};
          targetColumns.forEach((tc) => {
            const src = sourceByNorm.get(normalizeCol(tc));
            out[tc] = src ? (r?.[src] ?? '') : '';
          });
          return out;
        });

        await saveDraftAssignmentForSaisisseur({
          tables: mappedRows,
          columns_order: targetColumns,
        }, 'En cours');

        setEditTableColumns(targetColumns);
        setEditTableRows(mappedRows);
        alert('Import "IA" brouillon effectué (remappage local vers la structure cible).');
        if (e.target) e.target.value = null;
        return;
      }

      setIsSmartImporting(true);
      const result = await axios.post(`http://127.0.0.1:8000/api/sousthemes/${selectedSubTheme.id}/import-smart/`, fd);
      const warnings = result?.data?.warnings || [];
      if (warnings.length > 0) {
        alert(`Import IA termine: ${warnings.join(' | ')}`);
      } else {
        alert('Import IA reussi');
      }

      // refresh
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
    } catch (err) {
      console.error(err.response?.data || err);
      alert('Erreur lors de l\'import IA: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSmartImporting(false);
      if (e.target) e.target.value = null;
    }
  };

  const getExportSnapshot = () => {
    if (!selectedSubTheme) return null;

    if (isVisitor && visitorMatrix?.canPivot) {
      if (activeVisitorView === 'vertical' && visitorVerticalMatrix?.canVertical) {
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
      ['Définition', selectedSubTheme.definition_text],
      ['Unité', selectedSubTheme.unite_text],
      ['Périodicité', selectedSubTheme.periodicite_text],
      ['Indication', selectedSubTheme.indication_text],
      ['Source', selectedSubTheme.source_text],
      ['Couverture', selectedSubTheme.couverture_text],
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
    if (!snapshot || !snapshot.headers || snapshot.headers.length === 0) return alert('Aucun tableau à exporter');
    const header = snapshot.headers.map(escapeCSVCell).join(',');
    const lines = (snapshot.rows || []).map(r => r.map(escapeCSVCell).join(','));
    const csv = [header, ...lines].join('\n');
    const fileName = `${(selectedSubTheme?.nom || 'soustheme').replace(/\s+/g, '_')}_${snapshot.view}.csv`;
    downloadBlob(csv, 'text/csv;charset=utf-8;', fileName);
  };

  const exportTableTXT = () => {
    const snapshot = getExportSnapshot();
    if (!snapshot || !snapshot.headers || snapshot.headers.length === 0) return alert('Aucun tableau à exporter');
    const lines = [
      snapshot.headers.join('\t'),
      ...(snapshot.rows || []).map(r => r.map(v => String(v ?? '')).join('\t')),
    ];
    const txt = lines.join('\n');
    const fileName = `${(selectedSubTheme?.nom || 'soustheme').replace(/\s+/g, '_')}_${snapshot.view}.txt`;
    downloadBlob(txt, 'text/plain;charset=utf-8;', fileName);
  };

  const exportTableXLSX = () => {
    const snapshot = getExportSnapshot();
    if (!snapshot || !snapshot.headers || snapshot.headers.length === 0) return alert('Aucun tableau à exporter');

    const metadata = getExportMetadataEntries();
    const aoa = [];
    const merges = [];
    const title = `Sous-thème: ${selectedSubTheme?.nom || ''} (${snapshot.view})`;
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

    if (isVisitor && visitorMatrix?.canPivot && activeVisitorView === 'vertical' && visitorVerticalMatrix?.canVertical) {
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
      if (isVisitor && visitorMatrix?.canPivot && activeVisitorView === 'vertical' && visitorVerticalMatrix?.canVertical) {
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
      const url = isVisitor ? 'http://127.0.0.1:8000/api/public-themes/' : 'http://127.0.0.1:8000/api/themes/';
      // Determine which token to use for this fetch to ensure correct filtering for saisisseur
      let token = null;
      try {
        const ctx = authContext || localStorage.getItem('auth_context');
        if (ctx === 'admin') token = localStorage.getItem('auth_token_admin');
        else if (ctx === 'saisisseur') token = localStorage.getItem('auth_token_saisisseur');
        else token = localStorage.getItem('auth_token');
      } catch (e) { token = localStorage.getItem('auth_token'); }

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
    const values = new Set();
    data.forEach(row => {
      const val = row[columnName];
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
        <div className="font-bold mb-1">{label}</div>
        {items.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div style={{ width: 10, height: 10, background: p.color || p.fill || '#000' }} />
            <div className="font-semibold">{p.name}</div>
            <div className="ml-2">: {p.value}</div>
          </div>
        ))}
      </div>
    );
  };

  const getFilteredChartData = (chart) => {
    const data = getTableRows(selectedSubTheme);
    
    // Appliquer le filtre de colonne primaire
    let filtered = data;
    if (chart?.filter_column && chart?.filter_value) {
      const mode = chart?.filter_mode || 'include';
      if (mode === 'include') {
        filtered = data.filter(row => String(row[chart.filter_column] ?? '') === String(chart.filter_value));
      } else {
        filtered = data.filter(row => String(row[chart.filter_column] ?? '') !== String(chart.filter_value));
      }
    }
    
    // Appliquer les filtres supplémentaires
    if (chart?.filters && Array.isArray(chart.filters)) {
      chart.filters.forEach(filter => {
        if (filter.column && filter.value) {
          const mode = filter.mode || 'include';
          if (mode === 'include') {
            filtered = filtered.filter(row => String(row[filter.column] ?? '') === String(filter.value));
          } else {
            filtered = filtered.filter(row => String(row[filter.column] ?? '') !== String(filter.value));
          }
        }
      });
    }
    
    // Appliquer l'exclusion manuelle (clic pour supprimer)
    return filtered.filter(row => !isRowExcluded(chart.id, chart, row));
  };

  // Logique de filtrage du tableau avec les deux types de filtres

  const filteredData = getTableRows(selectedSubTheme).filter(row => {
    // Filtre par recherche texte (columnFilters)
    const passesTextFilter = Object.keys(columnFilters).every(key => 
      String(row[key] || '').toLowerCase().includes(columnFilters[key].toLowerCase())
    );
    
    // Filtre par valeurs sélectionnées (dynamicFilters basé sur filtres_disponibles)
    const passesDynamicFilters = Object.keys(dynamicFilters).every(key => {
      const selectedValue = dynamicFilters[key];
      if (selectedValue === null || selectedValue === undefined) return true;
      // support arrays (multi-select) and single-value for backward compatibility
      if (Array.isArray(selectedValue)) {
        if (selectedValue.length === 0) return true;
        return selectedValue.map(String).includes(String(row[key] || ''));
      }
      if (selectedValue === '') return true;
      return String(row[key] || '') === String(selectedValue);
    });
    
    return passesTextFilter && passesDynamicFilters;
  }) || [];

  const visibleColumnsForRender = React.useMemo(() => {
    if (!selectedSubTheme) return [];
    const fallbackColumns =
      (Array.isArray(selectedSubTheme.columns) && selectedSubTheme.columns.length > 0)
        ? selectedSubTheme.columns
        : (Array.isArray(selectedSubTheme.columns_order) && selectedSubTheme.columns_order.length > 0)
          ? selectedSubTheme.columns_order
          : (() => {
              const rows = getTableRows(selectedSubTheme) || [];
              return rows[0] ? Object.keys(rows[0]) : [];
            })();

    if (isVisitor) {
      return (selectedSubTheme.visitor_visible_columns && selectedSubTheme.visitor_visible_columns.length)
        ? selectedSubTheme.visitor_visible_columns
        : fallbackColumns;
    }
    return fallbackColumns;
  }, [selectedSubTheme, isVisitor]);

  const filtersForRender = React.useMemo(() => {
    if (!selectedSubTheme) return [];
    if (isVisitor) {
      const raw = (selectedSubTheme.visitor_filters && selectedSubTheme.visitor_filters.length) ? selectedSubTheme.visitor_filters : (selectedSubTheme.filtres_disponibles || []);
      return (raw || []).map(item => (typeof item === 'string' ? item : (item && item.column) ? item.column : String(item)));
    }
    return selectedSubTheme.filtres_disponibles || [];
  }, [selectedSubTheme, isVisitor]);

  const visitorMatrix = React.useMemo(() => {
    if (!isVisitor || !selectedSubTheme) return null;

    const cols = (visibleColumnsForRender || []).filter(Boolean);
    const normalizedCols = cols.map(c => ({ original: c, lower: String(c).toLowerCase() }));

    const periodEntry = normalizedCols.find(c => /(annee|année|period|période|year)/i.test(c.lower));
    const valueEntry = normalizedCols.find(c => /(valeur|value|taux|%|ratio|montant|nombre|effectif)/i.test(c.lower));
    const periodCol = periodEntry?.original || null;
    const valueCol = valueEntry?.original || null;

    const groupCols = cols.filter(c => c !== periodCol && c !== valueCol);
    const canPivot = Boolean(periodCol && valueCol && groupCols.length > 0);
    if (!canPivot) return { canPivot: false };

    const rows = filteredData || [];
    const isTotalToken = (val) => /(total|totale|tous|toutes|tout|ensemble)/i.test(String(val ?? '').toLowerCase());

    const displayGroupCols = groupCols;

    const uniquePeriods = Array.from(new Set(rows.map(r => String(r?.[periodCol] ?? '')).filter(v => v !== '')));
    const sortedPeriods = uniquePeriods.sort((a, b) => {
      const na = Number(String(a).replace(/,/g, '.'));
      const nb = Number(String(b).replace(/,/g, '.'));
      const bothNumeric = !Number.isNaN(na) && !Number.isNaN(nb);
      if (bothNumeric) return na - nb;
      return String(a).localeCompare(String(b), 'fr', { numeric: true, sensitivity: 'base' });
    });

    const valueLooksRate = /(%|taux|ratio|pourcentage)/i.test(String(valueCol).toLowerCase());
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
        const cmp = av.localeCompare(bv, 'fr', { sensitivity: 'base' });
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
      rows: rowsOut
    };
  }, [isVisitor, selectedSubTheme, visibleColumnsForRender, filteredData]);

  const visitorVerticalMatrix = React.useMemo(() => {
    if (!isVisitor || !selectedSubTheme || !visitorMatrix?.canPivot) return { canVertical: false };

    const cols = (visibleColumnsForRender || []).filter(Boolean);
    const valueCol = visitorMatrix.valueCol;
    if (!valueCol) return { canVertical: false };

    const hierarchyRaw = Array.isArray(selectedSubTheme?.visitor_pivot_columns) ? selectedSubTheme.visitor_pivot_columns : [];
    const hierarchyCols = hierarchyRaw.filter(c => cols.includes(c) && c !== valueCol);
    if (!hierarchyCols || hierarchyCols.length === 0) return { canVertical: false };

    const rowCols = cols.filter(c => c !== valueCol && !hierarchyCols.includes(c));
    const rows = filteredData || [];

    const valueLooksRate = /(%|taux|ratio|pourcentage)/i.test(String(valueCol).toLowerCase());
    const shouldSum = Boolean(selectedSubTheme?.est_sommable) && !valueLooksRate;
    const isTotalToken = (val) => /(total|totale|tous|toutes|tout|ensemble)/i.test(String(val ?? '').toLowerCase());

    const compareSmart = (a, b) => {
      const sa = String(a ?? '');
      const sb = String(b ?? '');
      const na = Number(sa.replace(/,/g, '.'));
      const nb = Number(sb.replace(/,/g, '.'));
      const bothNumeric = !Number.isNaN(na) && !Number.isNaN(nb);
      if (bothNumeric) return na - nb;
      return sa.localeCompare(sb, 'fr', { numeric: true, sensitivity: 'base' });
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
      hierarchyCols,
      rowCols,
      leaves,
      headerRows,
      rows: rowsOut,
      valueCol
    };
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
        setCurrentChartConfig({ id: null, type: 'Histogramme', x: '', y: '', mesure: '', filter_column: '', filter_value: '', filter_mode: 'include', filters: [], visible_filters: [], title: '', x_label: '', y_label: '', group_by: '' });
        return;
      }

      if (currentChartConfig.id) {
        // Update existing chart
        const res = await axios.put(`http://127.0.0.1:8000/api/sousthemes/${selectedSubTheme.id}/charts/${currentChartConfig.id}/`, {
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
          x_label: currentChartConfig.x_label || '',
              y_label: currentChartConfig.y_label || '',
              group_by: currentChartConfig.group_by || '',
        });
        const updated = res.data;
        setSavedCharts(prev => prev.map(c => c.id === updated.id ? updated : c));
      } else {
        // Create new chart
        const res = await axios.post(`http://127.0.0.1:8000/api/sousthemes/${selectedSubTheme.id}/charts/`, {
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
          x_label: currentChartConfig.x_label || '',
              y_label: currentChartConfig.y_label || '',
              group_by: currentChartConfig.group_by || '',
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
      setCurrentChartConfig({ id: null, type: 'Histogramme', x: '', y: '', mesure: '', filter_column: '', filter_value: '', filter_mode: 'include', filters: [], visible_filters: [], title: '', x_label: '', y_label: '', group_by: '' });
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
    if (!confirm('Supprimer ce graphique ?')) return;
    try {
      if (isSaisisseur) {
        const nextCharts = (savedCharts || []).filter((chart) => chart.id !== id);
        setSavedCharts(nextCharts);
        await saveDraftAssignmentForSaisisseur({ charts: nextCharts }, 'En cours');
        return;
      }

      await axios.delete(`http://127.0.0.1:8000/api/sousthemes/${selectedSubTheme.id}/charts/${id}/`);
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
  };

  // Toggle publication status for a sous-thème
  const toggleCategoriePublication = async (categorieId, newVisibility) => {
    try {
      // Call toggle-visibility action to cascade to sous-thèmes
      await axios.post(`http://127.0.0.1:8000/api/categories/${categorieId}/toggle-visibility/`, { is_visible: newVisibility });
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
      await axios.patch(`http://127.0.0.1:8000/api/sousthemes/${subThemeId}/`, { is_visible: newVisibility });
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
      await axios.patch(`http://127.0.0.1:8000/api/themes/${themeId}/`, { theme_image: dataUrl });

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
    if (!confirm('Supprimer l\'image de ce thème ?')) return;
    try {
      await axios.patch(`http://127.0.0.1:8000/api/themes/${themeId}/`, { theme_image: null });

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
        unite: '', 
        definition: '', 
        indicateur: '', 
        source: '', 
        periodicite: '', 
        file: null,
        categorieIndex: 0
      }));
    }
    
    setRows(initialRows);
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
    formData.append('statut', themeData.statut);
    if (themeImageFile) formData.append('theme_image', themeImageFile);
    
    // Si on utilise des catégories, envoyer leur configuration
    if (useCategories) {
      formData.append('use_categories', 'true');
      categoryNames.filter(c => c.nom.trim()).forEach((cat, idx) => {
        formData.append(`categories[${idx}][nom]`, cat.nom);
        formData.append(`categories[${idx}][ordre]`, idx);
      });
    }
    
    rows.forEach((row, i) => {
      const cleanedSubTheme = String(row.sousTheme || '').trim().replace(/\s+/g, ' ');
      formData.append(`lignes[${i}][sousTheme]`, cleanedSubTheme);
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
      const res = await axios.post('http://127.0.0.1:8000/api/themes/enregistrer_complet/', formData);
      const newTheme = res.data && res.data.theme;
      if (newTheme) {
        setThemes(prev => [...prev, newTheme]);
      } else {
        fetchThemes();
      }
      alert("Enregistré !");
      setFormStep(0);
      setUseCategories(false);
      setCategoryNames([{ nom: '', nbSousThemes: 1 }]);
      setThemeImageFile(null);
      setThemeImagePreview('');
    } catch (err) { console.error(err.response?.data || err); alert("Erreur : " + (err.response?.data?.error || err.message)); }
  };

  const saveThemeMeta = async () => {
    if (!selectedTheme) return alert('Aucun thème sélectionné');
    try {
      await axios.patch(`http://127.0.0.1:8000/api/themes/${selectedTheme.id}/`, themeMeta);
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

      await axios.patch(`http://127.0.0.1:8000/api/sousthemes/${selectedSubTheme.id}/`, subThemeMeta);
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
  const isAdminView = String(activeMenu || '').toLowerCase().includes('admin');
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

  const isSubThemeVisibleForCurrentRole = (subTheme) => {
    if (!isSaisisseur) return true;
    if (!subTheme?.id) return false;
    return assignedSubThemeIdSet.has(String(subTheme.id));
  };
  const indicatorsSubThemes = themes.flatMap(theme => {
    const directSubThemes = (theme.sous_themes || []).map(st => ({
      ...st,
      theme_titre: theme.titre,
      theme_id: theme.id
    }));
    const categorySubThemes = (theme.categories || []).flatMap(cat =>
      (cat.sous_themes || []).map(st => ({
        ...st,
        theme_titre: theme.titre,
        theme_id: theme.id,
        categorie_nom: cat.nom
      }))
    );

    const byId = new Map();
    [...directSubThemes, ...categorySubThemes].forEach(st => {
      if (!byId.has(st.id)) byId.set(st.id, st);
    });
    return Array.from(byId.values());
  }).filter(st => isSubThemeVisibleForCurrentRole(st));

  // Affiche le loading ou la page de login/admin
  if (authLoading) {
    return <div className="flex min-h-screen bg-[#f4f1e1] justify-center items-center"><p className="text-xl font-bold">Chargement...</p></div>;
  }

  // Early guard: if path is /saisisseur (or starts with) and user not authenticated,
  // immediately render the saisisseur login page to avoid showing admin login.
  if (!isAuthenticated && pathHasSaisisseur) {
    return <LoginPage onLoginSuccess={handleLogin} loginMode={'saisisseur'} />;
  }

  // If path is /admin and not authenticated, render admin login page
  if (!isAuthenticated && pathHasAdmin) {
    return <LoginPage onLoginSuccess={handleLogin} loginMode={'admin'} />;
  }

  if (!isAuthenticated && !isVisitor) {
    const loginMode = pathHasSaisisseur ? 'saisisseur' : 'admin';
    try {
      // If the path looks like a direct saisisseur username path (e.g. '/jean')
      // and the user is not authenticated nor explicitly on /saisisseur or /admin, redirect to the saisisseur login page.
      if (pathname !== '/' && !pathHasSaisisseur && !pathHasVisiteur && !pathHasAdmin && !pathname.includes('.') ) {
        window.location.replace('/saisisseur');
        return null;
      }
    } catch (e) {}

    return <LoginPage onLoginSuccess={handleLogin} loginMode={loginMode} />;
  }

  // --- RENDU PRINCIPAL (Admin) ---
  return (
    <div className="app-shell flex min-h-screen bg-[var(--color-bg)] text-[var(--color-text-main)]">
      
      {/* 1. MENU LATÉRAL */}
      <div className="w-64 bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col shadow-sm">
        <div className="p-4 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex flex-col items-center min-h-[210px]">
          <img src="src/Image3.png" alt="Logo HCP" className="w-full h-full object-contain" />
        </div>
        <div className="bg-[#f9fafb] text-[var(--color-text-main)] py-2 px-4 font-semibold text-center border-b border-[var(--color-border)]">Menu</div>
        <SidebarButton label="Thèmes" active={activeMenu === 'Themes'} onClick={() => {setActiveMenu('Themes'); setFormStep(0);}} />
        <SidebarButton label="Indicateurs" active={activeMenu === 'Indicateurs'} onClick={() => setActiveMenu('Indicateurs')} />
        <SidebarButton label="A propos" active={activeMenu === 'APropos'} onClick={() => { setActiveMenu('APropos'); setFormStep(0); }} />
        <SidebarButton label="Contact" active={activeMenu === 'Contact'} onClick={() => { setActiveMenu('Contact'); setFormStep(0); }} />
        <SidebarButton label="Liens utiles" active={activeMenu === 'LiensUtiles'} onClick={() => { setActiveMenu('LiensUtiles'); setFormStep(0); }} />
        {canEdit && (
          <>
            <SidebarButton
              label={isSaisisseur ? 'Espace saisisseur' : 'Espace admin'}
              active={activeMenu === (isSaisisseur ? 'Saisisseur' : 'Admin')}
              onClick={() => { setActiveMenu(isSaisisseur ? 'Saisisseur' : 'Admin'); setFormStep(0); setSelectedTheme(null); setSelectedSubTheme(null); }}
            />
          </>
        )}
      </div>

      {/* 2. CONTENU PRINCIPAL */}
      <div className="flex-1 flex flex-col">
        <div className="bg-[var(--color-primary)] px-6 py-3 border-b border-[#9b2b64] flex items-center gap-4 shadow-[0_6px_18px_rgba(17,24,39,0.14)] relative">
          <h1 className="text-white text-[28px] md:text-[34px] font-bold text-center tracking-wide leading-tight flex-1">
            Base de Données Région Béni Mellal-Khénifra قاعدة البيانات الاحصائية لجهة بني ملال خنيفرة
          </h1>
          {canEdit && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const auth = resolveCurrentAuthStorage();
                  setSettingsForm({ email: auth.email || '', newPassword: '', confirmPassword: '' });
                  setShowSettings(true);
                }}
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold py-2 px-3 rounded-xl border border-[#b84c83]"
              >
                Parametres
              </button>
              <button
                onClick={handleLogout}
                className="bg-[var(--color-primary-hover)] hover:bg-[#4A062E] text-white font-semibold py-2 px-3 rounded-xl border border-[#7A0A4A]"
              >
                Deconnexion
              </button>
            </div>
          )}
        </div>

        <div className="bg-[var(--color-primary)] px-6 py-2 border-b border-[#9b2b64] flex items-center gap-3">
          <span className="bg-[#a12863] text-white px-4 py-1 font-semibold rounded-xl">INFOS</span>
          {canEdit && userRole === 'ADMIN' && activeMenu === 'Admin' ? (
            <div className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={infoBannerDraft}
                onChange={(e) => setInfoBannerDraft(e.target.value)}
                placeholder="Ecrire une information pour les visiteurs..."
                className="bg-[var(--color-surface)] text-[var(--color-primary)] px-4 py-1.5 flex-1 rounded-xl font-medium border border-[var(--color-border)] outline-none focus:border-[#B03372]"
              />
              <button
                type="button"
                onClick={saveInfoBanner}
                disabled={savingInfoBanner}
                className={`px-4 py-1.5 rounded-xl font-semibold border ${savingInfoBanner ? 'bg-gray-300 text-gray-700 border-gray-400 cursor-not-allowed' : 'bg-[#a12863] text-white border-[#d6619c] hover:bg-[#8f245e]'}`}
              >
                {savingInfoBanner ? 'Validation...' : 'Valider'}
              </button>
            </div>
          ) : (
            <div className="bg-[var(--color-surface)] text-[var(--color-primary)] px-4 py-1.5 flex-1 rounded-xl font-medium border border-[var(--color-border)]">{infoBannerText}</div>
          )}
        </div>

        {formStep !== 4 && activeMenu !== 'Admin' && !isInfoMenu && (
          <div className={`px-6 bg-[#f4f5f7] border-b border-[var(--color-border)] ${activeMenu === 'Themes' && formStep === 3 ? 'pt-4 pb-3 space-y-2' : 'pt-5 pb-4 space-y-3'}`}>
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
                  {selectedCategorie ? `${selectedTheme.titre} - ${selectedCategorie.nom}` : `${selectedTheme.titre}`}
                </h2>
              </div>
            )}
            <div className="relative w-full">
              <input 
                type="text" 
                placeholder={
                  activeMenu === 'Themes' && formStep === 0 ? 'Rechercher un thème...' : 
                  activeMenu === 'Indicateurs' ? 'Rechercher un indicateur...' :
                  formStep === 3 ? 'Rechercher un sous-thème...' : 
                  'Barre de recherche'
                } 
                className="w-full pl-12 pr-4 py-3 border border-[#9d9d9d] rounded-none bg-[#f2f2f2] text-[#545454] outline-none focus:border-[#B03372]"
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

        <div className="px-8 pt-3 pb-10 flex-1 bg-white">
          
          {/* GRILLE DES INDICATEURS (TOUS LES SOUS-THÈMES) */}
          {activeMenu === 'Indicateurs' && (
            <div className="relative min-h-[400px]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {indicatorsSubThemes.filter(st => 
                  st.nom.toLowerCase().includes(searchIndicateur.toLowerCase()) ||
                  st.theme_titre.toLowerCase().includes(searchIndicateur.toLowerCase())
                ).map((st, i) => (
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
                    <div className="text-xs opacity-80 mb-1 uppercase tracking-wide">{st.theme_titre}</div>
                    <div className="text-[20px] leading-tight mt-1">{st.nom}</div>
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
            <AdministratorsPage isSaisisseur={isSaisisseur} />
          )}

          {activeMenu === 'APropos' && (
            <div className="w-full min-h-[calc(100vh-320px)] flex items-center justify-center px-2 md:px-6 py-6">
              <div className="w-full max-w-5xl bg-gradient-to-b from-[#fffdf8] to-white border-2 border-[#D6B978] rounded-2xl shadow-[0_14px_30px_rgba(16,78,116,0.16)] p-7 space-y-6">
                <h2 className="text-3xl md:text-4xl font-extrabold text-[#7A0A4A] border-b border-[#E7D2A1] pb-3 tracking-tight">{siteContent.about_title || 'A propos de la plateforme'}</h2>
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
                    <div className="flex justify-end">
                      <button
                        onClick={saveSiteContent}
                        disabled={savingSiteContent}
                        className={`px-5 py-2 rounded-xl font-semibold border ${savingSiteContent ? 'bg-gray-300 text-gray-700 border-gray-400 cursor-not-allowed' : 'bg-[#7A0A4A] text-white border-[#B03372] hover:bg-[#5E0738]'}`}
                      >
                        {savingSiteContent ? 'Enregistrement...' : 'Enregistrer'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="leading-8 text-[#243447] whitespace-pre-wrap">{siteContent.about_text || 'Le contenu A propos sera bientot disponible.'}</div>
                )}
              </div>
            </div>
          )}

          {activeMenu === 'Contact' && (
            <div className="w-full min-h-[calc(100vh-320px)] flex items-center justify-center px-2 md:px-6 py-6">
              <div className="w-full max-w-5xl bg-gradient-to-b from-[#fffdf8] to-white border-2 border-[#D6B978] rounded-2xl shadow-[0_14px_30px_rgba(16,78,116,0.16)] p-7 space-y-6">
                <h2 className="text-3xl md:text-4xl font-extrabold text-[#7A0A4A] border-b border-[#E7D2A1] pb-3 tracking-tight">{siteContent.contact_title || 'Contact'}</h2>
                {canEdit && userRole === 'ADMIN' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" value={siteContentDraft.contact_title || ''} onChange={(e) => setSiteContentDraft((prev) => ({ ...prev, contact_title: e.target.value }))} className="p-3 border border-[#CCB47F] rounded-xl outline-none focus:border-[#7A0A4A]" placeholder="Titre de la page Contact" />
                    <input type="email" value={siteContentDraft.contact_email || ''} onChange={(e) => setSiteContentDraft((prev) => ({ ...prev, contact_email: e.target.value }))} className="p-3 border border-[#CCB47F] rounded-xl outline-none focus:border-[#7A0A4A]" placeholder="Email de contact" />
                    <input type="text" value={siteContentDraft.contact_phone || ''} onChange={(e) => setSiteContentDraft((prev) => ({ ...prev, contact_phone: e.target.value }))} className="p-3 border border-[#CCB47F] rounded-xl outline-none focus:border-[#7A0A4A]" placeholder="Telephone" />
                    <input type="text" value={siteContentDraft.contact_hours || ''} onChange={(e) => setSiteContentDraft((prev) => ({ ...prev, contact_hours: e.target.value }))} className="p-3 border border-[#CCB47F] rounded-xl outline-none focus:border-[#7A0A4A]" placeholder="Horaires" />
                    <textarea value={siteContentDraft.contact_address || ''} onChange={(e) => setSiteContentDraft((prev) => ({ ...prev, contact_address: e.target.value }))} className="md:col-span-2 min-h-[120px] p-3 border border-[#CCB47F] rounded-xl outline-none focus:border-[#7A0A4A]" placeholder="Adresse postale" />
                    <div className="md:col-span-2 flex justify-end">
                      <button
                        onClick={saveSiteContent}
                        disabled={savingSiteContent}
                        className={`px-5 py-2 rounded-xl font-semibold border ${savingSiteContent ? 'bg-gray-300 text-gray-700 border-gray-400 cursor-not-allowed' : 'bg-[#7A0A4A] text-white border-[#B03372] hover:bg-[#5E0738]'}`}
                      >
                        {savingSiteContent ? 'Enregistrement...' : 'Enregistrer'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[#243447]">
                    <div className="bg-[#f8fafc] border border-[#d8e4ec] rounded-xl p-4"><div className="font-semibold text-[#7A0A4A]">Email</div><div>{siteContent.contact_email || 'contact@hcp.ma'}</div></div>
                    <div className="bg-[#f8fafc] border border-[#d8e4ec] rounded-xl p-4"><div className="font-semibold text-[#7A0A4A]">Telephone</div><div>{siteContent.contact_phone || '-'}</div></div>
                    <div className="bg-[#f8fafc] border border-[#d8e4ec] rounded-xl p-4"><div className="font-semibold text-[#7A0A4A]">Adresse</div><div className="whitespace-pre-wrap">{siteContent.contact_address || '-'}</div></div>
                    <div className="bg-[#f8fafc] border border-[#d8e4ec] rounded-xl p-4"><div className="font-semibold text-[#7A0A4A]">Horaires</div><div>{siteContent.contact_hours || '-'}</div></div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeMenu === 'LiensUtiles' && (
            <div className="w-full min-h-[calc(100vh-320px)] flex items-center justify-center px-2 md:px-6 py-6">
              <div className="w-full max-w-5xl bg-gradient-to-b from-[#fffdf8] to-white border-2 border-[#D6B978] rounded-2xl shadow-[0_14px_30px_rgba(16,78,116,0.16)] p-7 space-y-6">
                <h2 className="text-3xl md:text-4xl font-extrabold text-[#7A0A4A] border-b border-[#E7D2A1] pb-3 tracking-tight">Liens utiles</h2>
                {canEdit && userRole === 'ADMIN' ? (
                  <div className="space-y-3">
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
                    <div className="flex flex-wrap gap-2 justify-between">
                      <button
                        type="button"
                        onClick={() => setSiteContentDraft((prev) => ({ ...prev, useful_links: [...(prev.useful_links || []), { label: '', url: '' }] }))}
                        className="px-4 py-2 rounded-xl border border-[#CCB47F] bg-[#f8f3e7] text-[#7A0A4A] font-semibold hover:bg-[#f2e9d2]"
                      >
                        + Ajouter un lien
                      </button>
                      <button
                        onClick={saveSiteContent}
                        disabled={savingSiteContent}
                        className={`px-5 py-2 rounded-xl font-semibold border ${savingSiteContent ? 'bg-gray-300 text-gray-700 border-gray-400 cursor-not-allowed' : 'bg-[#7A0A4A] text-white border-[#B03372] hover:bg-[#5E0738]'}`}
                      >
                        {savingSiteContent ? 'Enregistrement...' : 'Enregistrer'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(siteContent.useful_links || []).map((link, idx) => (
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

          {/* ÉTAPE 0 : GRILLE DES THÈMES */}
          {activeMenu === 'Themes' && formStep === 0 && (
            <div className="relative min-h-[400px]">
              <div className="grid grid-cols-3 gap-2">
                {visibleThemes.filter(t => t.titre.toLowerCase().includes(searchTheme.toLowerCase())).map((t, i) => (
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
                        {isVisitor && t.theme_image && (
                          <img
                            src={t.theme_image}
                            alt={t.titre}
                            className="w-16 h-16 object-contain shrink-0"
                          />
                        )}
                        <span className="uppercase tracking-wide text-[18px] md:text-[20px] leading-snug font-semibold">{`${String(i + 1).padStart(2, '0')}-${t.titre}`}</span>
                      </div>
                      {t.categories && t.categories.length > 0 && (
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            const menuHeight = 200;
                            const menuWidth = 256; // w-64
                            const spaceBelow = window.innerHeight - rect.bottom;
                            const spaceRight = window.innerWidth - rect.left;
                            const top = spaceBelow > menuHeight ? rect.bottom + 8 : rect.top - menuHeight - 8;
                            const left = spaceRight > menuWidth ? rect.left : rect.right - menuWidth;
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
                        }} className="bg-[#B89C5A] p-1 border border-black rounded shadow">📝</button>
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
                            }} className="bg-[#f0a38e] p-1 border border-black rounded shadow">📂</button>
                        )}
                      </div>
                    </div>
                    {canEdit && (
                      <div className={`absolute bottom-3 right-3 w-5 h-5 rounded-full border border-black ${t.is_visible ? 'bg-green-400' : 'bg-red-500'}`}></div>
                    )}
                  </div>
                ))}
              </div>
              {canEdit && userRole === 'ADMIN' && (
                <button 
                  onClick={() => setFormStep(1)}
                  className="fixed bottom-10 right-10 bg-[#B03372] hover:bg-[#7A0A4A] text-white font-bold py-4 px-8 rounded-sm border border-[#B03372] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.35)]"
                >
                  Ajouter un thème
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
                  <div className="w-[min(22rem,92vw)] bg-[#fffdf9] rounded-xl shadow-[0_16px_28px_rgba(94,7,56,0.28)] border border-[#B03372] max-h-96 overflow-y-auto">
                    <div className="px-4 py-3 text-sm font-bold text-white bg-gradient-to-r from-[#7A0A4A] to-[#B03372]">Choisir une catégorie</div>
                    {(() => {
                      const currentTheme = themes.find(x => x.id === openCategorieMenu);
                      if (!currentTheme || !currentTheme.categories) return null;
                      return currentTheme.categories.sort((a, b) => a.ordre - b.ordre).map(cat => {
                        const isActiveCat = String(selectedCategorie?.id) === String(cat.id);
                        return (
                        <div key={cat.id} className={`px-3 py-2 border-b border-[#efd5e5] last:border-b-0 transition-colors flex items-center gap-2 justify-between ${isActiveCat ? 'bg-[#f8ebf2]' : 'hover:bg-[#fdf1f7]'}`}>
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation();
                              setSelectedTheme(currentTheme);
                              setSelectedCategorie(cat);
                              setSelectedVisitorCategoryId(String(cat.id));
                              setOpenCategorieMenu(null);
                              setFormStep(3);
                            }}
                            className="flex-1 text-left flex items-center gap-2"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                              <path d="M9 3H4a1 1 0 00-1 1v5a1 1 0 001 1h5a1 1 0 001-1V4a1 1 0 00-1-1z" stroke="#7A0A4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M20 3h-5a1 1 0 00-1 1v5a1 1 0 001 1h5a1 1 0 001-1V4a1 1 0 00-1-1z" stroke="#7A0A4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M9 14H4a1 1 0 00-1 1v5a1 1 0 001 1h5a1 1 0 001-1v-5a1 1 0 00-1-1z" stroke="#7A0A4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M20 14h-5a1 1 0 00-1 1v5a1 1 0 001 1h5a1 1 0 001-1v-5a1 1 0 00-1-1z" stroke="#7A0A4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <span className={`font-semibold truncate ${isActiveCat ? 'text-[#5E0738]' : 'text-[#6E001F]'}`}>{cat.nom}</span>
                            <span className={`ml-auto text-xs ${isActiveCat ? 'text-[#7A0A4A]' : 'text-gray-500'}`}>({cat.sous_themes?.length || 0})</span>
                          </button>
                          {canEdit && userRole === 'ADMIN' && (
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
                    <button onClick={(e) => { e.stopPropagation(); const t = themes.find(x => x.id === openActionMenu); setActionModalType('rename'); setActionModalValue(t?.titre || ''); setActionModalThemeId(openActionMenu); setShowActionModal(true); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2">
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
                    <button onClick={(e) => { e.stopPropagation(); const t = themes.find(x => x.id === openActionMenu); setActionModalType('add_subtheme'); setActionModalValue(''); setActionModalThemeId(openActionMenu); setActionModalCategorieId(null); setShowActionModal(true); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2">
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
                      if (confirm(`Rendre ce thème ${newVis ? 'Public' : 'Privé'} ainsi que tous ses sous-thèmes ?`)) {
                        toggleThemePublication(openActionMenu, newVis);
                      }
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
             <div className="bg-white border-2 border-black p-12 rounded-lg shadow-xl max-w-4xl mx-auto space-y-8">
               <div className="flex items-center gap-6">
                 <label className="text-xl w-64 font-bold">Titre du thème*</label>
                 <input type="text" className="flex-1 border-2 border-blue-300 rounded-md p-2 text-lg outline-none" 
                   onChange={e => setThemeData({...themeData, titre: e.target.value})} />
               </div>

               <div className="flex items-center gap-6">
                 <label className="text-xl w-64 font-bold">Image du thème (optionnelle)</label>
                 <div className="flex-1 space-y-2">
                   <input
                     type="file"
                     accept="image/*"
                     className="w-full border-2 border-blue-300 rounded-md p-2 text-sm bg-white"
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
                         } catch (previewErr) {
                           setThemeImagePreview('');
                         }
                       }
                     }}
                   />
                   <div className="text-xs text-gray-600">
                     Conseil: prefere une image PNG transparente. Les fonds clairs sont estompes automatiquement sur les tickets visiteurs.
                   </div>
                   {themeImagePreview && (
                     <div className="flex items-center gap-3">
                       <div className="w-12 h-12 border border-gray-300 rounded-sm bg-[#7A0A4A] flex items-center justify-center overflow-hidden">
                         <img src={themeImagePreview} alt="Aperçu" className="w-10 h-10 object-contain" />
                       </div>
                       <button
                         type="button"
                         onClick={() => { setThemeImageFile(null); setThemeImagePreview(''); }}
                         className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded-sm text-sm font-semibold"
                       >
                         Retirer
                       </button>
                     </div>
                   )}
                 </div>
               </div>
               
               <div className="flex items-center gap-6">
                 <label className="text-xl w-64 font-bold">Utiliser des catégories ?</label>
                 <input 
                   type="checkbox" 
                   checked={useCategories}
                   onChange={e => {
                     setUseCategories(e.target.checked);
                     if (!e.target.checked) setCategoryNames([{ nom: '', nbSousThemes: 1 }]);
                   }}
                   className="w-6 h-6 cursor-pointer"
                 />
               </div>
               
               {useCategories && (
                 <div className="border-2 border-blue-300 rounded-lg p-4 space-y-3 bg-blue-50">
                   <div className="flex justify-between items-center">
                     <label className="text-lg font-bold">Configuration des catégories</label>
                     <button 
                       onClick={() => setCategoryNames([...categoryNames, { nom: '', nbSousThemes: 1 }])}
                       className="bg-green-500 text-white px-3 py-1 rounded-md font-bold hover:bg-green-600"
                     >
                       + Ajouter une catégorie
                     </button>
                   </div>
                   {categoryNames.map((cat, idx) => (
                     <div key={idx} className="border-2 border-gray-300 rounded-lg p-3 space-y-2 bg-white">
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
                             className="flex-1 border-2 border-blue-300 rounded-md p-2 outline-none"
                             placeholder={`Nom de la catégorie ${idx + 1}`}
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
                               className="w-20 border-2 border-blue-300 rounded-md p-2 outline-none text-center"
                             />
                           </div>
                         </div>
                         {categoryNames.length > 1 && (
                           <button 
                             onClick={() => setCategoryNames(categoryNames.filter((_, i) => i !== idx))}
                             className="bg-red-500 text-white px-3 py-2 rounded-md font-bold hover:bg-red-600"
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
                 <div className="flex items-center gap-6">
                   <label className="text-xl w-64 font-bold">Nombre des Sous-thèmes*</label>
                   <input type="number" min="1" className="w-32 border-2 border-blue-300 rounded-md p-2 text-lg outline-none"
                     value={themeData.nbSousThemes} onChange={e => setThemeData({...themeData, nbSousThemes: parseInt(e.target.value)})} />
                 </div>
               )}
               
               <div className="flex items-center gap-6">
                 <label className="text-xl w-64 font-bold">Statut de publication</label>
                 <select className="flex-1 border-2 border-blue-300 rounded-md p-2 text-lg bg-white outline-none" 
                   onChange={e => setThemeData({...themeData, statut: e.target.value})}>
                   <option value="Public">Public 📢</option>
                   <option value="Privé">Privé 🔒</option>
                 </select>
               </div>
               <div className="flex justify-end gap-4 mt-10">
                 <button onClick={() => { setFormStep(0); setThemeImageFile(null); setThemeImagePreview(''); }} className="bg-[#f28a8a] text-white px-10 py-2 rounded-lg border-2 border-black font-bold shadow-md">Annuler</button>
                 <button onClick={goToTable} className="bg-[#ffb366] text-white px-10 py-2 rounded-lg border-2 border-black font-bold shadow-md">Suivant ➡</button>
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
                             {['Sous - thème*', 'Unité*', 'Définition*', 'Indicateur*', 'Source*', 'Périodicité*', 'Data*'].map(h => (
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
                                 <td className="border-r border-black p-1"><input type="text" className="w-full outline-none text-xs" value={row.unite} onChange={e => {const r = [...rows]; r[globalIdx].unite = e.target.value; setRows(r);}} /></td>
                                 <td className="border-r border-black p-1"><input type="text" className="w-full outline-none text-xs" value={row.definition} onChange={e => {const r = [...rows]; r[globalIdx].definition = e.target.value; setRows(r);}} /></td>
                                 <td className="border-r border-black p-1"><input type="text" className="w-full outline-none text-xs" value={row.indicateur} onChange={e => {const r = [...rows]; r[globalIdx].indicateur = e.target.value; setRows(r);}} /></td>
                                 <td className="border-r border-black p-1"><input type="text" className="w-full outline-none text-xs" value={row.source} onChange={e => {const r = [...rows]; r[globalIdx].source = e.target.value; setRows(r);}} /></td>
                                 <td className="border-r border-black p-1"><input type="text" className="w-full outline-none text-xs" value={row.periodicite} onChange={e => {const r = [...rows]; r[globalIdx].periodicite = e.target.value; setRows(r);}} /></td>
                                 <td className="p-1 text-center bg-gray-50">
                                   <label className="cursor-pointer">
                                     <span className="text-2xl">📤</span>
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
                         {['Sous - thème*', 'Unité*', 'Définition*', 'Indicateur*', 'Source*', 'Périodicité*', 'Data*'].map(h => (
                           <th key={h} className="border-r border-black p-2 text-sm font-bold">{h}</th>
                         ))}
                       </tr>
                     </thead>
                     <tbody>
                       {rows.map((row, i) => (
                         <tr key={i} className="border-b border-black">
                           <td className="border-r border-black p-1"><input type="text" className="w-full outline-none text-xs" value={row.sousTheme} onChange={e => {const r = [...rows]; r[i].sousTheme = e.target.value; setRows(r);}} /></td>
                           <td className="border-r border-black p-1"><input type="text" className="w-full outline-none text-xs" value={row.unite} onChange={e => {const r = [...rows]; r[i].unite = e.target.value; setRows(r);}} /></td>
                           <td className="border-r border-black p-1"><input type="text" className="w-full outline-none text-xs" value={row.definition} onChange={e => {const r = [...rows]; r[i].definition = e.target.value; setRows(r);}} /></td>
                           <td className="border-r border-black p-1"><input type="text" className="w-full outline-none text-xs" value={row.indicateur} onChange={e => {const r = [...rows]; r[i].indicateur = e.target.value; setRows(r);}} /></td>
                           <td className="border-r border-black p-1"><input type="text" className="w-full outline-none text-xs" value={row.source} onChange={e => {const r = [...rows]; r[i].source = e.target.value; setRows(r);}} /></td>
                           <td className="border-r border-black p-1"><input type="text" className="w-full outline-none text-xs" value={row.periodicite} onChange={e => {const r = [...rows]; r[i].periodicite = e.target.value; setRows(r);}} /></td>
                           <td className="p-1 text-center bg-gray-50">
                             <label className="cursor-pointer">
                               <span className="text-2xl">📤</span>
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
               <div className="p-4 flex justify-between bg-gray-50 rounded-lg border-2 border-black">
                 <button onClick={() => setFormStep(1)} className="bg-[#ffb366] text-white px-8 py-2 rounded-lg border-2 border-black font-bold shadow-md">⬅ Précédent</button>
                 <button onClick={handleFinalSubmit} className="bg-[#ffb366] text-white px-10 py-2 rounded-lg border-2 border-black font-bold shadow-md">Enregistrer ➡</button>
               </div>
             </div>
          )}

          {/* ÉTAPE 3 : LISTE DES SOUS-THÈMES */}
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
                          if (!confirm(`Changer la visibilité de la catégorie "${selectedCategorie.nom}" et de tous ses sous-thèmes ?`)) return;
                          await toggleCategoriePublication(selectedCategorie.id, newVis);
                        }}
                        className="border-2 border-blue-300 rounded-md p-2 text-sm bg-white outline-none font-bold"
                      >
                        <option value="Public">Public 📢</option>
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
                          if (!confirm('Changer la visibilité du thème et de tous ses sous-thèmes ?')) return;
                          await toggleThemePublication(selectedTheme.id, newVis);
                        }}
                        className="border-2 border-blue-300 rounded-md p-2 text-sm bg-white outline-none font-bold"
                      >
                        <option value="Public">Public 📢</option>
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
                    ?.filter(st => st.nom.toLowerCase().includes(searchSubTheme.toLowerCase()))
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
                        <span>{st.nom}</span>
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
                          }} className="bg-[#B89C5A] p-1 border border-black rounded shadow">📝</button>
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
                          }} className="bg-[#f0a38e] p-1 border border-black rounded shadow">📂</button>
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
                        <span className="text-[12px]">⏷</span>
                        <span>Tous</span>
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
                              <span className="text-[12px] shrink-0">⏷</span>
                              <span className="truncate">{cat.nom}</span>
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
                          (cat.sous_themes || []).map(st => ({ ...st, category_id: cat.id, category_name: cat.nom }))
                        );
                        const scopedSubThemes = String(selectedVisitorCategoryId) === 'all'
                          ? allSubThemes
                          : allSubThemes.filter(st => String(st.category_id) === String(selectedVisitorCategoryId));

                        const byId = new Map();
                        scopedSubThemes.forEach(st => {
                          if (!byId.has(st.id)) byId.set(st.id, st);
                        });

                        return Array.from(byId.values())
                          .filter(st => st.nom.toLowerCase().includes(searchSubTheme.toLowerCase()))
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
                              <div className="text-sm opacity-80 mb-2">{st.category_name}</div>
                              <div className="text-[20px] leading-tight">
                                <span>{st.nom}</span>
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
                                  }} className="bg-[#B89C5A] p-1 border border-black rounded shadow">📝</button>
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
                                  }} className="bg-[#f0a38e] p-1 border border-black rounded shadow">📂</button>
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
                    .filter(st => st.nom.toLowerCase().includes(searchSubTheme.toLowerCase()))
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
                        <span>{st.nom}</span>
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
                          }} className="bg-[#B89C5A] p-1 border border-black rounded shadow">📝</button>
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
                          }} className="bg-[#f0a38e] p-1 border border-black rounded shadow">📂</button>
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

          {/* ÉTAPE 4 : DÉTAILS SOUS-THÈME DÉVELOPPÉ */}
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
                    {selectedSubTheme.nom}
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canEdit && userRole === 'ADMIN' ? (
                    <>
                      <div className={`w-5 h-5 rounded-full border border-black ${selectedSubTheme.is_visible ? 'bg-green-400' : 'bg-red-500'}`}></div>
                      <select
                        value={selectedSubTheme.is_visible ? 'Public' : 'Privé'}
                        onChange={async (e) => {
                          const val = e.target.value;
                          const newVis = val === 'Public';
                          if (!confirm('Changer le statut du sous-thème ?')) return;
                          await toggleSubThemePublication(selectedSubTheme.id, newVis);
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
                        } catch (err) {
                          const ev = document.createEvent('CustomEvent');
                          ev.initCustomEvent('openVisitorConfig', true, true, selectedSubTheme.id);
                          window.dispatchEvent(ev);
                        }
                        showToast('Ouverture configuration visiteur', 'info');
                      }}
                      className="bg-[#df4a4a] text-white px-4 py-2 rounded-xl border border-[#9a2d2d] font-bold shadow-sm hover:bg-[#c93b3b]"
                    >
                      ⚙️ Visiteur
                    </button>
                  )}

                  <button onClick={(e) => { e.stopPropagation(); setShowAdvancedConfig(false); setSubThemeMeta({ definition_text: selectedSubTheme.definition_text || '', unite_text: selectedSubTheme.unite_text || '', indication_text: selectedSubTheme.indication_text || '', source_text: selectedSubTheme.source_text || '', periodicite_text: selectedSubTheme.periodicite_text || '', couverture_text: selectedSubTheme.couverture_text || '' }); setShowSubThemeMeta(true); }} className={`${isVisitor ? 'bg-white text-[#5E0738] border-[#B88FA4] hover:bg-[#f3f3f3]' : 'bg-white text-[#134f70] border-[#CCB47F] hover:bg-[#f3f3f3]'} px-4 py-2 rounded-xl border font-bold shadow-sm`}>Métadonnées</button>
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
                        className="bg-gray-200 px-4 py-2 rounded-xl border-2 border-black font-bold shadow-md hover:bg-gray-300"
                      >
                        💾 Enregistrer (brouillon)
                      </button>

                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm('Envoyer ce sous-thème aux administrateurs pour révision ?')) return;
                          try {
                            const saisisseurToken = localStorage.getItem('auth_token_saisisseur') || localStorage.getItem('auth_token');
                            const saisisseurRequestConfig = saisisseurToken
                              ? { headers: { Authorization: `Token ${saisisseurToken}` } }
                              : {};
                            const notes = collectCurrentSaisisseurDraftPayload();
                            await saveDraftAssignmentForSaisisseur(notes, 'En cours');
                            let assignment = getSaisisseurAssignmentForSubTheme(selectedSubTheme.id);
                            if (!assignment?.id) {
                              const userId = localStorage.getItem('user_id_saisisseur') || localStorage.getItem('user_id');
                              const refreshResp = await axios.get('http://127.0.0.1:8000/api/user-theme-assignments/', saisisseurRequestConfig);
                              const myAssignments = (refreshResp.data || []).filter((a) => String(a.user) === String(userId) && a.sous_theme);
                              setSaisisseurAssignments(myAssignments);
                              assignment = myAssignments.find((a) => String(a.sous_theme) === String(selectedSubTheme.id));
                            }

                            if (!assignment?.id) {
                              throw new Error('Assignation introuvable pour ce sous-thème.');
                            }

                            const submitRes = await axios.post(
                              `http://127.0.0.1:8000/api/user-theme-assignments/${assignment.id}/submit/`,
                              {
                                message: 'Soumission depuis l\'éditeur du sous-thème',
                                progression: 100,
                              },
                              saisisseurRequestConfig,
                            );
                            applyUpdatedAssignmentToState(submitRes.data);
                            showToast('Soumis aux administrateurs', 'success');
                          } catch (err) {
                            console.error(err);
                            alert(err?.response?.data?.error || err?.message || 'Impossible de soumettre');
                          }
                        }}
                        className="bg-blue-600 text-white px-4 py-2 rounded-xl border-2 border-black font-bold shadow-md hover:bg-blue-700"
                      >
                        📤 Envoyer au admin
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
                  }} className="bg-blue-400 text-white px-6 py-2 border-2 border-black rounded-xl font-bold text-sm shadow-md hover:bg-blue-500">⚙️ Configuration Avancée</button>
              )}

              <div className="flex justify-center">
                <div className={`${isVisitor ? 'bg-white border-[#B88FA4]' : 'bg-white border-[#CCB47F]'} inline-flex rounded-xl border p-1 shadow-sm`}>
                  <button
                    type="button"
                    onClick={() => setActiveDataTab('tableau')}
                    className={`px-6 py-2 rounded-lg font-bold text-sm tracking-wide transition-colors ${activeDataTab === 'tableau' ? (isVisitor ? 'bg-[#7A0A4A] text-white border border-[#b74a86]' : 'bg-[#7A0A4A] text-white border border-[#5E0738]') : (isVisitor ? 'text-[#5E0738] hover:bg-[#f3f3f3]' : 'text-[#5E0738] hover:bg-[#f3f3f3]')}`}
                  >
                    TABLEAU
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDataTab('graphes')}
                    className={`px-6 py-2 rounded-lg font-bold text-sm tracking-wide transition-colors ${activeDataTab === 'graphes' ? (isVisitor ? 'bg-[#7A0A4A] text-white border border-[#b74a86]' : 'bg-[#7A0A4A] text-white border border-[#5E0738]') : (isVisitor ? 'text-[#5E0738] hover:bg-[#f3f3f3]' : 'text-[#5E0738] hover:bg-[#f3f3f3]')}`}
                  >
                    GRAPHES
                  </button>
                </div>
              </div>

              {/* TABLEAU AVEC FILTRES PAR COLONNE */}
              {activeDataTab === 'tableau' && (
              <div className="space-y-4">
                {/* FILTRES DYNAMIQUES - basés sur filtres_disponibles */}
                {filtersForRender && filtersForRender.length > 0 && (
                  <div className={`${isVisitor ? 'bg-white border-[#B88FA4]' : 'bg-white border-[#CCB47F]'} border rounded-lg p-3 space-y-3 w-fit shadow-sm`}>
                    <h3 className={`font-bold text-sm ${isVisitor ? 'text-[#5E0738]' : 'text-blue-900'}`}>🔍 Filtres Disponibles</h3>
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
                              if (Array.isArray(cur) && cur.length > 0) return `${cur.length} sélectionné(s)`;
                              if (cur && !Array.isArray(cur)) return String(cur);
                              return '-- Tous --';
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
                                      <span>{val}</span>
                                    </label>
                                  );
                                })}
                              </div>
                              <div className="flex justify-between items-center gap-2 mt-3">
                                <div className="text-xs text-gray-600">{getUniqueValuesForColumn(filterCol).length} option(s)</div>
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
                                  >Appliquer</button>
                                  <button type="button" className="px-3 py-1.5 bg-gray-100 rounded-md text-xs" onClick={(e) => { e.stopPropagation(); setOpenFilter(null); }}>Fermer</button>
                                  <button
                                    type="button"
                                    className="px-3 py-1.5 bg-red-500 text-white rounded-md text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTempFilterSelection(prev => ({ ...(prev || {}), [filterCol]: new Set() }));
                                      setDynamicFilters(prev => ({ ...prev, [filterCol]: [] }));
                                      setOpenFilter(null);
                                    }}
                                  >Effacer</button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isVisitor && visitorMatrix?.canPivot && (
                  <div className="flex gap-2 items-center">
                    <button
                      onClick={() => setVisitorTableView('horizontal')}
                      className={`px-4 py-2 border rounded-lg font-bold text-sm shadow-sm transition-colors ${activeVisitorView === 'horizontal' ? (isVisitor ? 'bg-[#7A0A4A] text-white border-[#b74a86]' : 'bg-[#7A0A4A] text-white border-[#5E0738]') : (isVisitor ? 'bg-white text-[#5E0738] border-[#B88FA4] hover:bg-[#f3f3f3]' : 'bg-white text-[#5E0738] border-[#CCB47F] hover:bg-[#f3f3f3]')}`}
                    >Vue horizontale</button>
                    <button
                      onClick={() => canVisitorVerticalView && setVisitorTableView('vertical')}
                      disabled={!canVisitorVerticalView}
                      className={`px-4 py-2 border rounded-lg font-bold text-sm shadow-sm transition-colors ${activeVisitorView === 'vertical' ? (isVisitor ? 'bg-[#7A0A4A] text-white border-[#b74a86]' : 'bg-[#7A0A4A] text-white border-[#5E0738]') : (isVisitor ? 'bg-white text-[#5E0738] border-[#B88FA4] hover:bg-[#f3f3f3]' : 'bg-white text-[#5E0738] border-[#CCB47F] hover:bg-[#f3f3f3]')} ${!canVisitorVerticalView ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >Vue verticale</button>
                  </div>
                )}

                <div className={`${isVisitor ? 'border-2 border-[#A85A84] rounded-xl bg-white shadow-[0_2px_12px_rgba(106,31,82,0.14)]' : 'border-2 border-black rounded-lg bg-white shadow-inner'} overflow-auto max-h-[28rem]`}>
                  {isVisitor && visitorMatrix?.canPivot && activeVisitorView === 'vertical' ? (
                    <>
                      <div className="sticky top-0 z-20 bg-white border-b border-[#CCB47F] px-4 py-2 text-xs text-[#3F2A1F] font-medium">
                        <span>{(visitorVerticalMatrix.rows || []).length} ligne(s)</span>
                        <span className="mx-2">•</span>
                        <span>{(visitorVerticalMatrix.hierarchyCols || []).length} niveau(x) hiérarchique(s)</span>
                      </div>
                      <table className="w-full border-collapse text-sm">
                        <thead className="sticky top-[33px] z-10 bg-gradient-to-r from-[#7A0A4A] to-[#B03372] text-white border-b border-[#7b1e5a] shadow-[inset_0_-1px_0_0_rgba(123,30,90,0.55)]">
                          {(() => {
                            const headerRows = visitorVerticalMatrix.headerRows || [];
                            const rowCols = visitorVerticalMatrix.rowCols || [];
                            if (headerRows.length === 0) return null;
                            return (
                              <>
                                <tr>
                                  {rowCols.map(col => (
                                    <th key={`rowcol-${col}`} rowSpan={headerRows.length} className="p-4 border-r border-[#7b1e5a] min-w-[150px] text-left uppercase tracking-wide font-bold text-xs">{col}</th>
                                  ))}
                                  {(headerRows[0].cells || []).map(cell => (
                                    <th key={cell.key} colSpan={cell.colSpan} className="p-4 border-r border-[#7b1e5a] text-center font-bold text-sm">{cell.label}</th>
                                  ))}
                                </tr>
                                {headerRows.slice(1).map((row, ridx) => (
                                  <tr key={`hrow-${ridx + 1}`}>
                                    {(row.cells || []).map(cell => (
                                      <th key={cell.key} colSpan={cell.colSpan} className="p-2 border-r border-[#7b1e5a] text-center font-semibold text-xs bg-[#8a2f67]">{cell.label}</th>
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
                                  ? val.toLocaleString('fr-FR')
                                  : val.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                              }
                              const n = Number(String(val).replace(/,/g, '.'));
                              if (!Number.isNaN(n)) {
                                return Number.isInteger(n)
                                  ? n.toLocaleString('fr-FR')
                                  : n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                              }
                              return String(val);
                            };

                            const rowCount = displayedRows.length;
                            const spans = {};
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
                                  const isYearCol = /(annee|année|period|période|year)/i.test(String(col).toLowerCase());
                                  return (
                                    <td
                                      key={`${row.key}-${col}`}
                                      rowSpan={span}
                                      className={`p-4 border-r border-[#D6BE8C] text-[#3F2A1F] ${isYearCol ? 'text-center align-middle' : 'text-left align-top'}`}
                                    >
                                      <span className={`font-semibold ${isYearCol ? 'text-3xl leading-none' : ''}`}>{String(row?.dimensions?.[col] ?? '—')}</span>
                                    </td>
                                  );
                                })}
                                {leaves.map((leaf, idx) => (
                                  <td key={`${row.key}-${leaf.key}`} className={`p-4 border-r border-[#DCC897] text-right text-[#4A062E] text-sm tabular-nums ${idx === leaves.length - 1 ? 'bg-[#f7f7f7] font-semibold' : ''}`}>
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
                        <span>{(visitorMatrix.rows || []).length} ligne(s)</span>
                        <span className="mx-2">•</span>
                        <span>{(visitorMatrix.periods || []).length} période(s)</span>
                        {visitorMatrix.periods?.length > 0 && (
                          <>
                            <span className="mx-2">•</span>
                            <span>Dernière période: <strong>{visitorMatrix.periods[visitorMatrix.periods.length - 1]}</strong></span>
                          </>
                        )}
                      </div>
                      <table className="w-full border-collapse text-sm">
                      <thead className="sticky top-[33px] z-10 bg-gradient-to-r from-[#7A0A4A] to-[#B03372] text-white border-b border-[#7b1e5a] shadow-[inset_0_-1px_0_0_rgba(123,30,90,0.55)]">
                        <tr>
                          {(visitorMatrix.displayGroupCols || []).map(col => (
                            <th key={col} className="p-4 border-r border-[#7b1e5a] min-w-[170px] text-left uppercase tracking-wide font-bold text-xs">{col}</th>
                          ))}
                          {visitorMatrix.periods.map((period, idx) => (
                            <th key={period} className={`p-4 border-r border-[#7b1e5a] min-w-[110px] text-center font-bold text-sm ${idx === visitorMatrix.periods.length - 1 ? 'bg-[#8a2f67]' : ''}`}>{period}</th>
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
                                ? val.toLocaleString('fr-FR')
                                : val.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                            }
                            const n = Number(String(val).replace(/,/g, '.'));
                            if (!Number.isNaN(n)) {
                              return Number.isInteger(n)
                                ? n.toLocaleString('fr-FR')
                                : n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
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
                                    <span className={`font-semibold ${isMergedCell ? mergedSizeClass : ''}`}>{value}</span>
                                    {isTotalCell && colIndex === groupCols.length - 1 && (
                                      <span className="ml-2 inline-block text-[10px] px-2 py-0.5 rounded-full bg-[#7A0A4A] text-white uppercase tracking-wide">Total</span>
                                    )}
                                  </td>
                                );
                              })}
                              {visitorMatrix.periods.map(period => (
                                  <td key={`${row.key}-${period}`} className={`p-4 border-r border-[#DCC897] text-right text-[#4A062E] text-sm tabular-nums ${period === latestPeriod ? 'bg-[#f7f7f7] font-semibold' : ''}`}>{formatValue(row.values?.[period])}</td>
                              ))}
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                    </>
                  ) : (
                    <table className="w-full border-collapse text-sm">
                      <thead className={`sticky top-0 z-10 ${isVisitor ? 'bg-gradient-to-r from-[#7A0A4A] to-[#B03372] border-[#7b1e5a] shadow-[inset_0_-1px_0_0_rgba(123,30,90,0.55)]' : 'bg-gradient-to-r from-[#7A0A4A] to-[#B03372] border-[#5E0738] shadow-[inset_0_-1px_0_0_rgba(11,94,131,0.55)]'} text-white border-b font-bold`}>
                        <tr>
                          {visibleColumnsForRender.map(col => (
                            <th key={col} className={`p-4 border-r ${isVisitor ? 'border-[#7b1e5a]' : 'border-[#5E0738]'} min-w-[160px] text-left uppercase tracking-wide font-bold text-xs`}>
                              <div className="uppercase text-[11px] tracking-wide font-bold text-white">{col}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const displayedRows = showAll ? filteredData : filteredData.slice(0, isVisitor ? 8 : 3);
                          const rowCount = displayedRows.length;
                          const spans = {};
                          visibleColumnsForRender.forEach(col => {
                            spans[col] = new Array(rowCount).fill(0);
                            let i = 0;
                            while (i < rowCount) {
                              const val = String((displayedRows[i] && displayedRows[i][col]) ?? '');
                              let j = i + 1;
                              while (j < rowCount && String((displayedRows[j] && displayedRows[j][col]) ?? '') === val) j++;
                              spans[col][i] = j - i;
                              i = j;
                            }
                          });

                          return displayedRows.map((row, i) => (
                            <tr key={i} className={`${i % 2 === 0 ? 'bg-white' : (isVisitor ? 'bg-[#fafafa]' : 'bg-[#f8fcff]')} border-b ${isVisitor ? 'border-[#CCB47F] hover:bg-[#f3f3f3]' : 'border-[#D8C49A] hover:bg-[#F7F1E3]'} min-h-10`}>
                              {visibleColumnsForRender.map((col) => {
                                const span = spans[col][i] || 0;
                                if (span === 0) return null;
                                const isNumericCol = /(valeur|value|%|taux|montant|effectif)/i.test(String(col).toLowerCase());
                                const isMergedCell = span > 1;
                                const mergedSizeClass = span >= 10 ? 'text-2xl leading-tight' : (span >= 4 ? 'text-xl leading-tight' : (span >= 2 ? 'text-lg' : ''));
                                return (
                                  <td key={col} rowSpan={span} className={`border-r ${isVisitor ? 'border-[#D6BE8C]' : 'border-[#D8C49A]'} p-3 text-xs ${isMergedCell ? 'text-center align-middle' : 'text-left align-top'} ${isNumericCol ? (isVisitor ? 'tabular-nums text-[#4A062E] font-medium' : 'tabular-nums text-[#5E0738] font-medium') : (isVisitor ? 'text-[#3F2A1F]' : 'text-[#3F2A1F]')}`}>
                                    <span className={`${isMergedCell ? mergedSizeClass : ''} ${isNumericCol ? 'text-right inline-block w-full' : 'font-semibold'}`}>{row[col]}</span>
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
                  <button onClick={() => setShowAll(!showAll)} className="bg-[#9E6F2F] text-white px-6 py-2 border-2 border-black rounded-xl font-bold shadow-md">
                    {showAll ? "Réduire le tableau" : (isVisitor ? "Afficher plus de lignes" : "Afficher tout le tableau")}
                  </button>

                  {canEdit && (userRole === 'ADMIN' || isSaisisseur) && (
                    <button onClick={openEditTable} className="bg-[#ffd56b] text-black px-4 py-2 border-2 border-black rounded-xl font-bold shadow-md">Modifier le tableau</button>
                  )}

                  <div className="flex gap-2">
                    <button onClick={exportTableXLSX} className="bg-[#2f3b47] text-white px-4 py-2 border border-[#1d2730] rounded-lg font-semibold shadow-sm hover:bg-[#26313c]">Exporter XLSX</button>
                    <button onClick={exportTableCSV} className="bg-[#2f3b47] text-white px-4 py-2 border border-[#1d2730] rounded-lg font-semibold shadow-sm hover:bg-[#26313c]">Exporter CSV</button>
                    <button onClick={exportTableTXT} className="bg-[#2f3b47] text-white px-4 py-2 border border-[#1d2730] rounded-lg font-semibold shadow-sm hover:bg-[#26313c]">Exporter TXT</button>
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
                    // Apply per-chart visitor-only filters (do not affect table)
                    const visitorFiltersList = chart.visible_filters || [];
                    const visitorValues = chartVisitorFilters[chart.id] || {};
                    let chartData = baseChartData;
                    if (visitorFiltersList && visitorFiltersList.length > 0) {
                      // normalize list to objects with column/default
                      const norm = visitorFiltersList.map(item => (typeof item === 'string' ? { column: item, default: '' } : item || {}));
                      norm.forEach(vf => {
                        const col = vf.column;
                        const val = visitorValues[col] !== undefined ? visitorValues[col] : (vf.default || '');
                        if (col && val) {
                          chartData = chartData.filter(row => String(row[col] ?? '') === String(val));
                        }
                      });
                    }

                    // If chart defines a grouping column, prepare multi-series data
                    let multiSeries = null;
                    if (chart.group_by) {
                      const groupCol = chart.group_by;
                      const groupValues = Array.from(new Set((chartData || []).map(r => String(r[groupCol] ?? '')))).filter(g => g !== '');
                      const xValues = Array.from(new Set((chartData || []).map(r => String(r[chart.x] ?? '')))).sort();
                      const aggregation = {}; // aggregation[x][group] = sum
                      (chartData || []).forEach(r => {
                        const xVal = String(r[chart.x] ?? 'N/A');
                        const g = String(r[groupCol] ?? 'N/A');
                        const raw = r[chart.y];
                        const val = raw === null || raw === undefined || raw === '' ? 0 : parseFloat(String(raw).replace(/,/g, '.')) || 0;
                        aggregation[xVal] = aggregation[xVal] || {};
                        aggregation[xVal][g] = (aggregation[xVal][g] || 0) + val;
                      });

                      const seriesData = xValues.map(xVal => {
                        const obj = { [chart.x]: xVal };
                        groupValues.forEach(g => { obj[g] = (aggregation[xVal] && aggregation[xVal][g]) ? aggregation[xVal][g] : 0; });
                        return obj;
                      });

                      // For scatter we prepare per-group arrays
                      const seriesScatterData = {};
                      groupValues.forEach(g => {
                        seriesScatterData[g] = xValues.map(xVal => ({ [chart.x]: xVal, [chart.y]: (aggregation[xVal] && aggregation[xVal][g]) ? aggregation[xVal][g] : 0 }));
                      });

                      multiSeries = { seriesData, groupValues, seriesScatterData };
                    }

                    return (
                      <div key={chart.id} className="border-4 border-orange-400 p-6 rounded-2xl bg-white shadow-lg relative">
                        {canEdit && (
                          <div className="absolute top-4 right-4 flex gap-2">
                            <button onClick={() => openEditModal(chart)} className="bg-blue-500 text-white px-3 py-1 rounded border border-black text-xs font-bold shadow">Modifier</button>
                            <button onClick={() => deleteChart(chart.id)} className="bg-red-500 text-white px-3 py-1 rounded border border-black text-xs font-bold shadow">Supprimer</button>
                          </div>
                        )}
                        
                        {/* Visitor-visible filters controls (only shown when configured) */}
                        {visitorFiltersList && visitorFiltersList.length > 0 && (
                          <div className="mb-4 p-3 bg-gray-50 border-2 border-dashed rounded inline-grid gap-3">
                            {(visitorFiltersList || []).map((vf, idx) => {
                              const col = (typeof vf === 'string') ? vf : (vf && vf.column) || '';
                              const currentVal = (chartVisitorFilters[chart.id] || {})[col] || (vf && vf.default) || '';
                              return (
                                <div key={`${chart.id}-vf-${idx}`} className="flex items-center gap-2">
                                  <label className="font-bold text-sm">{col || 'Colonne'}</label>
                                  <select
                                    className="p-2 border-2 border-gray-300 rounded bg-white"
                                    value={currentVal}
                                    onChange={e => {
                                      const newMap = { ...(chartVisitorFilters || {}) };
                                      newMap[chart.id] = { ...(newMap[chart.id] || {}) };
                                      newMap[chart.id][col] = e.target.value;
                                      setChartVisitorFilters(newMap);
                                    }}
                                  >
                                    <option value="">-- Tous --</option>
                                    {col && getUniqueValuesForColumn(col).map(v => <option key={v} value={v}>{v}</option>)}
                                  </select>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {chart.title && (
                          <h3 className="text-lg font-bold text-center mb-2">{chart.title}</h3>
                        )}

                        <div className="h-64 w-full mt-4">
                          <ResponsiveContainer width="100%" height="100%">
                            {chart.type === 'Histogramme' ? (
                              multiSeries ? (
                                (() => {
                                  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#B19CD9', '#FF6F91', '#6B7280', '#10B981'];
                                  return (
                                    <BarChart data={multiSeries.seriesData}>
                                      <CartesianGrid strokeDasharray="3 3" />
                                      <XAxis dataKey={chart.x} label={{ value: chart.x_label || chart.x, position: 'insideBottom', offset: -5 }} />
                                      <YAxis label={{ value: chart.y_label || selectedSubTheme.type_unite || '', angle: -90, position: 'insideLeft' }} />
                                      <Tooltip content={<CustomTooltip />} />
                                      <Legend />
                                      {multiSeries.groupValues.map((g, idx) => (
                                        <Bar key={g} dataKey={g} fill={COLORS[idx % COLORS.length]} />
                                      ))}
                                    </BarChart>
                                  );
                                })()
                              ) : (
                                <BarChart data={chartData} barCategoryGap="18%" barGap={6}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey={chart.x} label={{ value: chart.x_label || chart.x, position: 'insideBottom', offset: -5 }} />
                                  <YAxis label={{ value: chart.y_label || selectedSubTheme.type_unite || '', angle: -90, position: 'insideLeft' }} />
                                  <Tooltip content={<CustomTooltip />} />
                                  <Bar dataKey={chart.y} fill="#7A0A4A" />
                                </BarChart>
                              )
                            ) : chart.type === 'Courbes' ? (
                              multiSeries ? (
                                (() => {
                                  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#B19CD9', '#FF6F91', '#6B7280', '#10B981'];
                                  return (
                                    <LineChart data={multiSeries.seriesData}>
                                      <CartesianGrid strokeDasharray="3 3" />
                                      <XAxis dataKey={chart.x} label={{ value: chart.x_label || chart.x, position: 'insideBottom', offset: -5 }} />
                                      <YAxis label={{ value: chart.y_label || selectedSubTheme.type_unite || '', angle: -90, position: 'insideLeft' }} />
                                      <Tooltip content={<CustomTooltip />} />
                                      <Legend />
                                      {multiSeries.groupValues.map((g, idx) => (
                                        <Line key={g} type="monotone" dataKey={g} stroke={COLORS[idx % COLORS.length]} strokeWidth={3} dot={false} />
                                      ))}
                                    </LineChart>
                                  );
                                })()
                              ) : (
                                <LineChart data={chartData}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey={chart.x} label={{ value: chart.x_label || chart.x, position: 'insideBottom', offset: -5 }} />
                                  <YAxis label={{ value: chart.y_label || selectedSubTheme.type_unite || '', angle: -90, position: 'insideLeft' }} />
                                  <Tooltip content={<CustomTooltip />} />
                                  <Line type="monotone" dataKey={chart.y} stroke="#7A0A4A" strokeWidth={3} />
                                </LineChart>
                              )
                            ) : chart.type === 'Nuage de points' ? (
                              multiSeries ? (
                                (() => {
                                  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#B19CD9', '#FF6F91', '#6B7280', '#10B981'];
                                  return (
                                    <ScatterChart>
                                      <CartesianGrid strokeDasharray="3 3" />
                                      <XAxis dataKey={chart.x} label={{ value: chart.x_label || chart.x, position: 'insideBottom', offset: -5 }} />
                                      <YAxis dataKey={chart.y} label={{ value: chart.y_label || selectedSubTheme.type_unite || '', angle: -90, position: 'insideLeft' }} />
                                      <Tooltip content={<CustomTooltip />} />
                                      <Legend />
                                      {multiSeries.groupValues.map((g, idx) => (
                                        <Scatter key={g} name={g} data={multiSeries.seriesScatterData[g]} fill={COLORS[idx % COLORS.length]} />
                                      ))}
                                    </ScatterChart>
                                  );
                                })()
                              ) : (
                                <ScatterChart>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey={chart.x} label={{ value: chart.x_label || chart.x, position: 'insideBottom', offset: -5 }} />
                                  <YAxis dataKey={chart.y} label={{ value: chart.y_label || selectedSubTheme.type_unite || '', angle: -90, position: 'insideLeft' }} />
                                  <Tooltip content={<CustomTooltip />} />
                                  <Scatter data={chartData} fill="#7A0A4A" />
                                </ScatterChart>
                              )
                            ) : chart.type === 'Secteur' ? (
                              (() => {
                                const map = {};
                                if (multiSeries) {
                                  // aggregate across all X to get totals per group
                                  const pieData = multiSeries.groupValues.map(g => {
                                    let total = 0;
                                    multiSeries.seriesData.forEach(d => { total += Number(d[g] || 0); });
                                    return { name: g, value: total };
                                  }).filter(d => d.value > 0);
                                  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#B19CD9', '#FF6F91'];
                                  return (
                                    <PieChart>
                                      <Pie dataKey="value" data={pieData} nameKey="name" outerRadius={80} fill="#8884d8" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                                        {pieData.map((entry, idx) => <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />)}
                                      </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                      <Legend />
                                    </PieChart>
                                  );
                                }
                                chartData.forEach(r => {
                                  const key = r[chart.x] ?? 'N/A';
                                  const val = parseFloat(r[chart.y]) || 0;
                                  map[key] = (map[key] || 0) + val;
                                });
                                const pieData = Object.keys(map).map(k => ({ name: k, value: map[k] }));
                                const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#B19CD9', '#FF6F91'];
                                return (
                                  <PieChart>
                                    <Pie dataKey="value" data={pieData} nameKey="name" outerRadius={80} fill="#8884d8" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
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
                        {chart.mesure && (
                          <div className="mt-4 p-3 bg-blue-50 border-l-4 border-blue-500 italic text-sm text-gray-700">
                            <strong>Note :</strong> {chart.mesure}
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
                      setCurrentChartConfig({ id: null, type: 'Histogramme', x: '', y: '', mesure: '', filter_column: '', filter_value: '', filter_mode: 'include', filters: [], visible_filters: [], title: '', x_label: '', y_label: '' });
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
      <ChartModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentChartConfig={currentChartConfig}
        setCurrentChartConfig={setCurrentChartConfig}
        selectedSubTheme={selectedSubTheme}
        getUniqueValuesForColumn={getUniqueValuesForColumn}
        handleAddOrUpdateChart={handleAddOrUpdateChart}
      />
      {showEditTable && (
        <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50 p-4">
          <div className="bg-white border-4 border-black p-6 rounded-3xl w-full max-w-4xl max-h-[80vh] overflow-auto shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-xl font-black mb-4 text-center">Édition du tableau</h2>

            <div className="mb-4 flex gap-4 items-center">
              <label className="bg-[#B89C5A] text-black px-4 py-2 border-2 border-black rounded-xl font-bold shadow-md cursor-pointer">
                Remplacer par un fichier
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFileChange} />
              </label>
              <label className={`text-black px-4 py-2 border-2 border-black rounded-xl font-bold shadow-md cursor-pointer ${isSmartImporting ? 'bg-gray-300' : 'bg-[#ffcf80]'}`}>
                {isSmartImporting ? 'Import IA...' : 'Importer avec IA'}
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleSmartImportFileChange} disabled={isSmartImporting} />
              </label>
              <div className="text-sm italic text-gray-600">Choisir un fichier Excel pour remplacer le tableau actuel</div>
            </div>

            <div className="overflow-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {(editTableColumns || []).map((col, ci) => (
                      <th key={`${col}-${ci}`} className="p-2 border border-gray-300 text-xs">
                        <input
                          className="w-full p-1 text-xs font-semibold border border-gray-200 rounded"
                          value={col}
                          onChange={(e) => handleEditColumnNameChange(ci, e.target.value)}
                        />
                      </th>
                    ))}
                    <th className="p-2 border border-gray-300 text-xs">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {editTableRows.map((row, ri) => (
                    <tr key={ri} className="hover:bg-gray-50">
                      {(editTableColumns || []).map((col, ci) => (
                        <td key={`${col}-${ci}`} className="p-1 border">
                          <input className="w-full p-1 text-xs" value={row[col] ?? ''} onChange={e => { const r = [...editTableRows]; r[ri] = {...r[ri], [col]: e.target.value}; setEditTableRows(r); }} />
                        </td>
                      ))}
                      <td className="p-1 border text-center">
                        <button onClick={() => { const r = [...editTableRows]; r.splice(ri, 1); setEditTableRows(r); }} className="bg-red-400 text-white px-2 py-1 rounded">Suppr</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-4 mt-4">
              <button onClick={() => setEditTableRows(prev => [...prev, Object.fromEntries((editTableColumns || []).map(c => [c, '']))])} className="bg-green-400 text-white px-4 py-2 rounded">Ajouter ligne</button>
              <div className="flex-1" />
              <button onClick={() => setShowEditTable(false)} className="bg-gray-200 px-4 py-2 rounded">Annuler</button>
              <button onClick={saveEditedTable} className="bg-[#ffb366] px-4 py-2 rounded">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {showAdvancedConfig && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[9999] p-4" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white border border-black p-6 rounded-2xl w-full max-w-xl max-h-[80vh] overflow-y-auto shadow-lg z-[10000]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-center mb-4">⚙️ Configuration Avancée</h2>
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

                  await axios.patch(`http://127.0.0.1:8000/api/sousthemes/${selectedSubTheme.id}/`, {
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
         <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
           <div className="bg-white border border-black p-4 rounded-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden shadow-lg">
             <div className="bg-[#7A0A4A] text-white rounded-t-lg px-4 py-3">
               <h2 className="text-lg font-bold text-center">Métadonnées</h2>
             </div>
             <div className="p-4 overflow-y-auto max-h-[64vh] space-y-4 text-gray-800">
               {isVisitor ? (
                 <div className="space-y-4">
                   <div>
                     <div className="font-semibold text-[#23354a]">Définition</div>
                     <div className="mt-2 bg-[#fbfdff] p-3 rounded text-gray-700 whitespace-pre-wrap">{subThemeMeta.definition_text || '—'}</div>
                   </div>
                   <div>
                     <div className="font-semibold text-[#23354a]">Unité</div>
                     <div className="mt-2 bg-[#fbfdff] p-3 rounded text-gray-700">{subThemeMeta.unite_text || '—'}</div>
                   </div>
                   <div>
                     <div className="font-semibold text-[#23354a]">Périodicité</div>
                     <div className="mt-2 bg-[#fbfdff] p-3 rounded text-gray-700">{subThemeMeta.periodicite_text || '—'}</div>
                   </div>
                   <div>
                     <div className="font-semibold text-[#23354a]">Indication</div>
                     <div className="mt-2 bg-[#fbfdff] p-3 rounded text-gray-700 whitespace-pre-wrap">{subThemeMeta.indication_text || '—'}</div>
                   </div>
                   <div>
                     <div className="font-semibold text-[#23354a]">Source</div>
                     <div className="mt-2 bg-[#fbfdff] p-3 rounded text-gray-700">{subThemeMeta.source_text || '—'}</div>
                   </div>
                   <div>
                     <div className="font-semibold text-[#23354a]">Couverture</div>
                     <div className="mt-2 bg-[#fbfdff] p-3 rounded text-gray-700">{subThemeMeta.couverture_text || '—'}</div>
                   </div>
                 </div>
               ) : (
                 <div className="space-y-4">
                   <div>
                     <div className="font-semibold">Définition</div>
                     <textarea placeholder="Définition" className="mt-2 w-full p-2 border-2 border-black rounded min-h-[120px]" value={subThemeMeta.definition_text} onChange={e => setSubThemeMeta({...subThemeMeta, definition_text: e.target.value})} />
                   </div>
                   <div>
                     <div className="font-semibold">Unité</div>
                     <textarea placeholder="Unité" className="mt-2 w-full p-2 border-2 border-black rounded h-20" value={subThemeMeta.unite_text} onChange={e => setSubThemeMeta({...subThemeMeta, unite_text: e.target.value})} />
                   </div>
                   <div>
                     <div className="font-semibold">Périodicité</div>
                     <textarea placeholder="Périodicité" className="mt-2 w-full p-2 border-2 border-black rounded h-20" value={subThemeMeta.periodicite_text} onChange={e => setSubThemeMeta({...subThemeMeta, periodicite_text: e.target.value})} />
                   </div>
                   <div>
                     <div className="font-semibold">Indication</div>
                     <textarea placeholder="Indication" className="mt-2 w-full p-2 border-2 border-black rounded h-20" value={subThemeMeta.indication_text} onChange={e => setSubThemeMeta({...subThemeMeta, indication_text: e.target.value})} />
                   </div>
                   <div>
                     <div className="font-semibold">Source</div>
                     <textarea placeholder="Source" className="mt-2 w-full p-2 border-2 border-black rounded h-20" value={subThemeMeta.source_text} onChange={e => setSubThemeMeta({...subThemeMeta, source_text: e.target.value})} />
                   </div>
                   <div>
                     <div className="font-semibold">Couverture</div>
                     <textarea placeholder="Couverture" className="mt-2 w-full p-2 border-2 border-black rounded h-20" value={subThemeMeta.couverture_text} onChange={e => setSubThemeMeta({...subThemeMeta, couverture_text: e.target.value})} />
                   </div>
                 </div>
               )}

              
             </div>
             <div className="flex gap-4 mt-4 px-4 pb-4">
               <button onClick={() => setShowSubThemeMeta(false)} className="flex-1 bg-[#7A0A4A] text-white py-2 rounded-lg font-bold">Fermer</button>
               {!isVisitor && <button onClick={saveSubThemeMeta} className="flex-1 bg-[#ffb366] py-2 border-2 border-black rounded-lg font-bold">Enregistrer</button>}
             </div>
           </div>
         </div>
      )}
      {showThemeMeta && (
         <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
           <div className="bg-white border border-black p-4 rounded-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden shadow-lg">
             <div className="bg-[#7A0A4A] text-white rounded-t-lg px-4 py-3">
               <h2 className="text-lg font-bold text-center">Métadonnées</h2>
             </div>
             <div className="p-4 overflow-y-auto max-h-[64vh] space-y-4 text-gray-800">
               {isVisitor ? (
                 <div className="space-y-4">
                   <div>
                     <div className="font-semibold text-[#23354a]">Définition</div>
                     <div className="mt-2 bg-[#fbfdff] p-3 rounded text-gray-700 whitespace-pre-wrap">{themeMeta.definition_text || '—'}</div>
                   </div>
                   <div>
                     <div className="font-semibold text-[#23354a]">Unité</div>
                     <div className="mt-2 bg-[#fbfdff] p-3 rounded text-gray-700">{themeMeta.unite_text || '—'}</div>
                   </div>
                   <div>
                     <div className="font-semibold text-[#23354a]">Périodicité</div>
                     <div className="mt-2 bg-[#fbfdff] p-3 rounded text-gray-700">{themeMeta.periodicite_text || '—'}</div>
                   </div>
                   <div>
                     <div className="font-semibold text-[#23354a]">Indication</div>
                     <div className="mt-2 bg-[#fbfdff] p-3 rounded text-gray-700 whitespace-pre-wrap">{themeMeta.indication_text || '—'}</div>
                   </div>
                   <div>
                     <div className="font-semibold text-[#23354a]">Source</div>
                     <div className="mt-2 bg-[#fbfdff] p-3 rounded text-gray-700">{themeMeta.source_text || '—'}</div>
                   </div>
                   <div>
                     <div className="font-semibold text-[#23354a]">Couverture</div>
                     <div className="mt-2 bg-[#fbfdff] p-3 rounded text-gray-700">{themeMeta.couverture_text || '—'}</div>
                   </div>
                 </div>
               ) : (
                 <div className="space-y-4">
                   <div>
                     <div className="font-semibold">Définition</div>
                     <textarea placeholder="Définition" className="mt-2 w-full p-2 border-2 border-black rounded min-h-[120px]" value={themeMeta.definition_text} onChange={e => setThemeMeta({...themeMeta, definition_text: e.target.value})} />
                   </div>
                   <div>
                     <div className="font-semibold">Unité</div>
                     <textarea placeholder="Unité" className="mt-2 w-full p-2 border-2 border-black rounded h-20" value={themeMeta.unite_text} onChange={e => setThemeMeta({...themeMeta, unite_text: e.target.value})} />
                   </div>
                   <div>
                     <div className="font-semibold">Périodicité</div>
                     <textarea placeholder="Périodicité" className="mt-2 w-full p-2 border-2 border-black rounded h-20" value={themeMeta.periodicite_text} onChange={e => setThemeMeta({...themeMeta, periodicite_text: e.target.value})} />
                   </div>
                   <div>
                     <div className="font-semibold">Indication</div>
                     <textarea placeholder="Indication" className="mt-2 w-full p-2 border-2 border-black rounded h-20" value={themeMeta.indication_text} onChange={e => setThemeMeta({...themeMeta, indication_text: e.target.value})} />
                   </div>
                   <div>
                     <div className="font-semibold">Source</div>
                     <textarea placeholder="Source" className="mt-2 w-full p-2 border-2 border-black rounded h-20" value={themeMeta.source_text} onChange={e => setThemeMeta({...themeMeta, source_text: e.target.value})} />
                   </div>
                   <div>
                     <div className="font-semibold">Couverture</div>
                     <textarea placeholder="Couverture" className="mt-2 w-full p-2 border-2 border-black rounded h-20" value={themeMeta.couverture_text} onChange={e => setThemeMeta({...themeMeta, couverture_text: e.target.value})} />
                   </div>
                 </div>
               )}
             </div>
             <div className="flex gap-4 mt-4 px-4 pb-4">
               <button onClick={() => setShowThemeMeta(false)} className="flex-1 bg-[#7A0A4A] text-white py-2 rounded-lg font-bold">Fermer</button>
               {!isVisitor && <button onClick={saveThemeMeta} className="flex-1 bg-[#ffb366] py-2 border-2 border-black rounded-lg font-bold">Enregistrer</button>}
             </div>
           </div>
         </div>
      )}
      

      

      {/* Visitor configuration modal (in-place) */}
      {configModalOpen && configSubTheme && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setConfigModalOpen(false)}>
          <div className="bg-white border border-black p-6 rounded-2xl w-full max-w-3xl max-h-[80vh] overflow-y-auto shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-center mb-4">⚙️ Configuration Visiteur</h2>

            <div className="space-y-4">
              <div>
                <label className="block font-bold mb-2">Colonnes visibles pour le visiteur</label>
                <textarea className="w-full p-2 border-2 border-black rounded min-h-[80px]" value={modalVisitorColsText} onChange={e => setModalVisitorColsText(e.target.value)} />
                <div className="text-sm italic text-gray-600">Séparer les noms de colonnes par des virgules. (Le texte est conservé tant que vous n'enregistrez pas.)</div>
              </div>

              <div>
                <label className="block font-bold mb-2">Filtres disponibles</label>
                <textarea className="w-full p-2 border-2 border-black rounded min-h-[80px]" value={modalVisitorFiltersText} onChange={e => setModalVisitorFiltersText(e.target.value)} />
                <div className="text-sm italic text-gray-600">Colonnes que le visiteur peut utiliser pour filtrer. (Le texte est conservé tant que vous n'enregistrez pas.)</div>
              </div>

              <div>
                <label className="block font-bold mb-2">Hiérarchie des colonnes (optionnel)</label>
                <textarea className="w-full p-2 border-2 border-black rounded min-h-[80px]" value={modalVisitorHierarchyText} onChange={e => setModalVisitorHierarchyText(e.target.value)} />
                <div className="text-sm italic text-gray-600">Ordre hiérarchique pour l'entête vertical/multi-niveaux (ex: Année, Sexe, Milieu). Les colonnes non listées restent en affichage normal.</div>
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
                {/* show a human-friendly string while keeping state as an object */}
                {(() => {
                  const formatDefaults = (val) => {
                    if (!val) return '';
                    if (typeof val === 'string') {
                      try { val = JSON.parse(val); } catch (_) {}
                    }
                    if (typeof val === 'object' && val !== null) {
                      return Object.entries(val).map(([k, v]) => `${k}=${v}`).join(', ');
                    }
                    return String(val);
                  };

                  const parseInputToObject = (txt) => {
                    if (!txt && txt !== '') return {};
                    if (typeof txt === 'object') return txt;
                    try { return JSON.parse(txt); } catch (_) {}
                    const obj = {};
                    const parts = String(txt).split(',').map(p => p.trim()).filter(Boolean);
                    parts.forEach(part => {
                      const sep = part.includes('=') ? '=' : (part.includes(':') ? ':' : null);
                      if (sep) {
                        const [k, v] = part.split(sep).map(s => s.trim());
                        if (k && v) obj[k] = v;
                      }
                    });
                    return obj;
                  };

                  return (
                    <input
                      className="w-full p-2 border-2 border-black rounded"
                      value={formatDefaults(modalVisitorDefaultFilters)}
                      onChange={e => setModalVisitorDefaultFilters(e.target.value)}
                      placeholder="Ex: Milieu=Total, Sexe=Masculin"
                    />
                  );
                })()}
                <div className="text-sm italic text-gray-600">Exemple: Milieu=Total ou Année=2020</div>
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button onClick={() => setConfigModalOpen(false)} className="flex-1 bg-gray-200 py-2 border-2 border-black rounded-xl font-bold">Annuler</button>
              <button onClick={async () => {
                try {
                  // normalize modalVisitorDefaultFilters before sending
                  let parsedDefaults = modalVisitorDefaultFilters;
                  if (typeof parsedDefaults === 'string' && parsedDefaults.trim()) {
                    try {
                      parsedDefaults = JSON.parse(parsedDefaults);
                    } catch (e) {
                      const obj = {};
                      const parts = parsedDefaults.split(',').map(p => p.trim()).filter(Boolean);
                      parts.forEach(part => {
                        const sep = part.includes('=') ? '=' : (part.includes(':') ? ':' : null);
                        if (sep) {
                          const [k, v] = part.split(sep).map(s => s.trim());
                          if (k && v) obj[k] = v;
                        }
                      });
                      if (Object.keys(obj).length > 0) parsedDefaults = obj;
                    }
                  }

                  // parse the text fields into arrays (only on save)
                  const parsedCols = String(modalVisitorColsText || '').split(',').map(s => s.trim()).filter(s => s !== '');
                  const parsedFilters = String(modalVisitorFiltersText || '').split(',').map(s => s.trim()).filter(s => s !== '');
                  const parsedHierarchy = String(modalVisitorHierarchyText || '').split(',').map(s => s.trim()).filter(s => s !== '');

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
                    await axios.patch(`http://127.0.0.1:8000/api/sousthemes/${configSubTheme.id}/`, payload);
                    showToast('Configuration visiteur enregistrée', 'success');
                    // fetch the updated sous-thème and update local state so the view refreshes immediately
                    try {
                      const freshRes = await axios.get(`http://127.0.0.1:8000/api/sousthemes/${configSubTheme.id}/`);
                      const freshSubTheme = freshRes.data;
                      selectSubTheme(freshSubTheme);
                      // also refresh the themes list to keep things in sync
                      const res = await axios.get(themesApiBase);
                      setThemes(res.data);
                      const freshTheme = res.data.find(t => t.id === selectedTheme?.id);
                      if (freshTheme) setSelectedTheme(freshTheme);
                      // additionally refresh public themes so visitor view can update if needed
                      try {
                        const pub = await axios.get('http://127.0.0.1:8000/api/public-themes/');
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
                  setModalVisitorCols(parsedCols);
                  setModalVisitorFilters(parsedFilters);
                  setModalVisitorHierarchy(parsedHierarchy);
                  setModalVisitorColsText(parsedCols.join(', '));
                  setModalVisitorFiltersText(parsedFilters.join(', '));
                  setModalVisitorHierarchyText(parsedHierarchy.join(', '));
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

      {/* Modal for Managing Chart Rows */}
      {manageRowsModalChartId !== null && (
        <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50 p-4">
          <div className="bg-white border-4 border-black p-6 rounded-3xl w-full max-w-3xl max-h-[80vh] overflow-y-auto shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            {(() => {
              const managedChart = savedCharts.find(c => String(c.id) === String(manageRowsModalChartId));
              
              if (!managedChart) {
                return (
                  <div className="text-center">
                    <p className="text-red-600 font-bold">⚠️ Graphique non trouvé</p>
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
            <button onClick={(e) => { e.stopPropagation(); const st = (selectedTheme?.sous_themes || []).find(s => s.id === openSubActionMenu) || themes.flatMap(t => t.sous_themes || []).find(s => s.id === openSubActionMenu); setActionModalType('rename_subtheme'); setActionModalValue(st?.nom || ''); setActionModalThemeId(openSubActionMenu); setShowActionModal(true); setOpenSubActionMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2">
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
            <h2 className="text-xl font-black mb-4 text-center">{actionModalType === 'rename' ? 'Renommer le thème' : actionModalType === 'rename_subtheme' ? 'Renommer le sous-thème' : actionModalType === 'add_categorie' ? 'Ajouter une catégorie' : 'Ajouter un sous-thème'}</h2>
            <input className="w-full p-2 border-2 border-black rounded mb-4" value={actionModalValue} onChange={e => setActionModalValue(e.target.value)} placeholder={actionModalType === 'rename' ? 'Nouveau nom du thème' : actionModalType === 'rename_subtheme' ? 'Nouveau nom du sous-thème' : actionModalType === 'add_categorie' ? 'Nom de la catégorie' : 'Nom du sous-thème'} />
            
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
              <button onClick={() => { setShowActionModal(false); setActionModalCategorieId(null); }} className="flex-1 bg-gray-200 py-2 border-2 border-black rounded-xl font-bold">Annuler</button>
              <button onClick={async () => {
                const cleanedModalValue = String(actionModalValue || '').trim().replace(/\s+/g, ' ');
                if (!cleanedModalValue) { alert('Le nom est requis'); return; }
                if (actionModalType === 'rename') { await renameTheme(actionModalThemeId, cleanedModalValue); }
                else if (actionModalType === 'rename_subtheme') { await renameSubTheme(actionModalThemeId, cleanedModalValue); }
                else if (actionModalType === 'add_categorie') { await addCategorie(actionModalThemeId, cleanedModalValue); }
                else { 
                  const currentTheme = themes.find(t => t.id === actionModalThemeId);
                  if (currentTheme && currentTheme.categories && currentTheme.categories.length > 0 && !actionModalCategorieId) {
                    return alert('Veuillez sélectionner une catégorie');
                  }
                  await addSubTheme(actionModalThemeId, cleanedModalValue, actionModalCategorieId); 
                }
                setShowActionModal(false);
                setActionModalCategorieId(null);
              }} className="flex-1 bg-[#ffb366] py-2 border-2 border-black rounded-xl font-bold">Valider</button>
            </div>
          </div>
        </div>
      )}

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 12000, backgroundColor: 'rgba(0,0,0,0.18)' }}>
          <div className="bg-white border-4 border-black p-8 rounded-3xl w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-2xl font-bold mb-6 text-[#1a5d85]">Informations du compte</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block font-bold text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={settingsForm.email}
                  onChange={(e) => setSettingsForm({...settingsForm, email: e.target.value})}
                  className="w-full p-3 border-2 border-black rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-2">Nouveau mot de passe</label>
                <input
                  type="password"
                  value={settingsForm.newPassword}
                  onChange={(e) => setSettingsForm({...settingsForm, newPassword: e.target.value})}
                  placeholder="Laisser vide si inchangé"
                  className="w-full p-3 border-2 border-black rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-2">Confirmer le mot de passe</label>
                <input
                  type="password"
                  value={settingsForm.confirmPassword}
                  onChange={(e) => setSettingsForm({...settingsForm, confirmPassword: e.target.value})}
                  placeholder="Confirmer le nouveau mot de passe"
                  className="w-full p-3 border-2 border-black rounded-lg outline-none"
                />
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button onClick={() => setShowSettings(false)} className="flex-1 bg-gray-200 py-3 border-2 border-black rounded-xl font-bold">Annuler</button>
              <button onClick={updateAccount} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 border-2 border-black rounded-xl font-bold">Enregistrer les modifications</button>
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
        <div className="fixed right-6 top-6 z-60">
          <div className={`px-4 py-2 rounded shadow-lg text-white ${toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : toast.type === 'warning' ? 'bg-yellow-500 text-black' : 'bg-gray-800'}`}>
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;