import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter, Legend } from 'recharts';
import LoginPage from './LoginPage';
import AdministratorsPage from './AdministratorsPage';

// --- COMPOSANTS DE STYLE ---
const SidebarButton = ({ label, onClick, active }) => (
  <button 
    onClick={onClick}
    className={`w-full py-3 px-4 text-left font-bold border-b border-black transition-colors ${
      active ? 'bg-[#4a77b4] text-white shadow-inner' : 'bg-[#6d92c7] text-white hover:bg-[#5a81b5]'
    }`}
  >
    {label}
  </button>
);

function App({ forceVisitor = false }) {
  // --- AUTHENTIFICATION (toujours appelé en premier) ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // --- ÉTATS (toujours déclarés, même s'ils ne sont pas utilisés si non authentifié) ---
  const [activeMenu, setActiveMenu] = useState('Themes');
  const [formStep, setFormStep] = useState(0); 
  const [themes, setThemes] = useState([]);
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [selectedSubTheme, setSelectedSubTheme] = useState(null);
  const [selectedCategorie, setSelectedCategorie] = useState(null);
  const [themeData, setThemeData] = useState({ titre: '', nbSousThemes: 1, statut: 'Public' });
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
  const [showThemeMeta, setShowThemeMeta] = useState(false);
  const [themeMeta, setThemeMeta] = useState({ definition_text: '', unite_text: '', indication_text: '', source_text: '', periodicite_text: '', couverture_text: '' });
  const [showSubThemeMeta, setShowSubThemeMeta] = useState(false);
  const [subThemeMeta, setSubThemeMeta] = useState({ definition_text: '', unite_text: '', indication_text: '', source_text: '', periodicite_text: '', couverture_text: '' });
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
  const [advancedConfig, setAdvancedConfig] = useState({ niveau_geo: null, type_unite: '', est_sommable: true, filtres_disponibles: [] });
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configSubTheme, setConfigSubTheme] = useState(null);
  const [modalVisitorCols, setModalVisitorCols] = useState([]);
  const [modalVisitorFilters, setModalVisitorFilters] = useState([]);
  const [modalVisitorDefaultFilters, setModalVisitorDefaultFilters] = useState({});
  const [publicThemes, setPublicThemes] = useState([]);
  const [showEditTable, setShowEditTable] = useState(false);
  const [editTableRows, setEditTableRows] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [columnFilters, setColumnFilters] = useState({});
  const [dynamicFilters, setDynamicFilters] = useState({});
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

  // --- TOUS LES useEffect EN MÊME TEMPS ---
  const pathHasVisiteur = typeof window !== 'undefined' && window.location.pathname.includes('/visiteur');
  const isVisitor = forceVisitor || pathHasVisiteur;
  const canEdit = isAuthenticated && !isVisitor;
  const themesApiBase = isVisitor ? 'http://127.0.0.1:8000/api/public-themes/' : 'http://127.0.0.1:8000/api/themes/';

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token && !isVisitor) {
      axios.defaults.headers.common['Authorization'] = `Token ${token}`;
      setIsAuthenticated(true);
    }
    setAuthLoading(false);
  }, []);

  useEffect(() => { 
    if (isAuthenticated || isVisitor) fetchThemes(); 
  }, [isAuthenticated]);

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
        setModalVisitorCols(found.visitor_visible_columns || []);
        setModalVisitorFilters(found.visitor_filters || found.filtres_disponibles || []);
        setModalVisitorDefaultFilters(parseDefaultsString(found.visitor_default_filters || {}));
        setConfigModalOpen(true);
      } catch (err) {
        console.error('Erreur ouverture config visiteur', err);
        showToast('Impossible d\'ouvrir la configuration visiteur', 'error');
      }
    };

    window.addEventListener('openVisitorConfig', handler);
    return () => window.removeEventListener('openVisitorConfig', handler);
  }, [themes]);

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

  // Initialize per-chart visitor filters state from savedCharts (defaults)
  useEffect(() => {
    const map = {};
    (savedCharts || []).forEach(chart => {
      const vf = chart.visible_filters || [];
      if (!vf || vf.length === 0) return;
      const obj = {};
      vf.forEach(item => {
        if (!item) return;
        if (typeof item === 'string') {
          obj[item] = '';
        } else if (typeof item === 'object' && item.column) {
          obj[item.column] = item.default || '';
        }
      });
      map[chart.id] = obj;
    });
    setChartVisitorFilters(map);
  }, [savedCharts]);

  // When sub-theme changes, apply visitor-specific filters/defaults if in visitor mode
  useEffect(() => {
    if (!selectedSubTheme) return;
    // If visitor view, prefer visitor_filters and apply visitor_default_filters
    if (isVisitor) {
      const vf = selectedSubTheme.visitor_filters && selectedSubTheme.visitor_filters.length ? selectedSubTheme.visitor_filters : (selectedSubTheme.filtres_disponibles || []);
      // initialize dynamicFilters with defaults where provided
      let defaults = selectedSubTheme.visitor_default_filters || {};
      // If defaults is a string (admin typed plain text), try to parse JSON or 'key=value' pairs or apply heuristics
      if (typeof defaults === 'string' && defaults) {
        // try JSON first
        try {
          defaults = JSON.parse(defaults);
        } catch (e) {
          // try parsing key=value pairs like "Milieu=Total,Province=Azilal"
          const obj = {};
          const parts = defaults.split(',').map(p => p.trim()).filter(Boolean);
          parts.forEach(part => {
            const sep = part.includes('=') ? '=' : (part.includes(':') ? ':' : null);
            if (sep) {
              const [k, v] = part.split(sep).map(s => s.trim());
              if (k && v) obj[k] = v;
            }
          });
          if (Object.keys(obj).length > 0) {
            defaults = obj;
          } else {
            // fallback: assign single value heuristically to first matching filter
            const singleVal = defaults;
            const heuristic = {};
            for (const col of vf) {
              const opts = getUniqueValuesForColumn(col);
              if (opts.includes(String(singleVal))) {
                heuristic[col] = String(singleVal);
                break;
              }
            }
            defaults = heuristic;
          }
        }
      }

      const initial = {};
      vf.forEach(col => {
        initial[col] = (defaults && typeof defaults === 'object' && defaults[col] !== undefined) ? defaults[col] : '';
      });
      setDynamicFilters(initial);
    }
  }, [selectedSubTheme, isVisitor]);

  // --- HELPER FUNCTIONS ---
  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('username');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_role');
    delete axios.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
  };

  const updateAccount = async () => {
    if (settingsForm.newPassword && settingsForm.newPassword !== settingsForm.confirmPassword) {
      showToast('Les mots de passe ne correspondent pas', 'error');
      return;
    }
    try {
      const userId = localStorage.getItem('user_id');
      const payload = { email: settingsForm.email };
      if (settingsForm.newPassword) payload.password = settingsForm.newPassword;
      
      await axios.patch(`http://127.0.0.1:8000/api/users/${userId}/`, payload);
      localStorage.setItem('user_email', settingsForm.email);
      showToast('Informations mises à jour', 'success');
      setShowSettings(false);
      setSettingsForm({ email: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      console.error(err);
      showToast('Erreur lors de la mise à jour', 'error');
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
    const row = selectedSubTheme?.data?.[rowIndex];
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
    const row = selectedSubTheme?.data?.[rowIndex];
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
    setEditTableRows(JSON.parse(JSON.stringify(selectedSubTheme?.data || [])));
    setShowEditTable(true);
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

  const renameTheme = async (id, newName) => {
    try {
      await axios.patch(`http://127.0.0.1:8000/api/themes/${id}/`, { titre: newName });
      alert('Thème renommé');
      const res = await axios.get(themesApiBase);
      setThemes(res.data);
      if (selectedTheme && selectedTheme.id === id) setSelectedTheme(res.data.find(t => t.id === id));
    } catch (err) { console.error(err); alert('Erreur lors du renommage'); }
  };

  const addSubTheme = async (themeId, name, categorieId = null) => {
    try {
      const theme = themes.find(t => t.id === themeId);
      const payload = { nom: name };
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
    } catch (err) { console.error(err); alert('Erreur lors de l\'ajout du sous-thème'); }
  };

  const addCategorie = async (themeId, name) => {
    try {
      const theme = themes.find(t => t.id === themeId);
      const ordre = theme?.categories?.length || 0;
      // Ensure the new category inherits the theme's visibility status
      const payload = { nom: name, theme: themeId, ordre, is_visible: theme?.is_visible ?? true };
      await axios.post('http://127.0.0.1:8000/api/categories/', payload);
      alert('Catégorie ajoutée');
      const themesRes = await axios.get(themesApiBase);
      setThemes(themesRes.data);
      const fresh = themesRes.data.find(t => t.id === themeId);
      if (fresh) setSelectedTheme(fresh);
    } catch (err) { console.error(err); alert('Erreur lors de l\'ajout de la catégorie'); }
  };

  const renameSubTheme = async (id, newName) => {
    try {
      await axios.patch(`http://127.0.0.1:8000/api/sousthemes/${id}/`, { nom: newName });
      alert('Sous-thème renommé');
      const res = await axios.get(themesApiBase);
      setThemes(res.data);
      // update selectedTheme/selectedSubTheme if needed
      if (selectedTheme) {
        const freshTheme = res.data.find(t => t.id === selectedTheme.id);
        if (freshTheme) setSelectedTheme(freshTheme);
        const freshSub = freshTheme?.sous_themes?.find(st => st.id === id);
        if (freshSub) setSelectedSubTheme(freshSub);
        // Update selectedCategorie if present
        if (selectedCategorie && freshTheme) {
          const freshCat = freshTheme.categories?.find(c => c.id === selectedCategorie.id);
          if (freshCat) setSelectedCategorie(freshCat);
        }
      }
    } catch (err) { console.error(err); alert('Erreur lors du renommage du sous-thème'); }
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
    if (!selectedSubTheme) return alert('Aucun sous-thème sélectionné');
    try {
      await axios.patch(`http://127.0.0.1:8000/api/sousthemes/${selectedSubTheme.id}/`, { data_json: editTableRows });
      alert('Tableau sauvegardé');
      setShowEditTable(false);
      // refresh
      const res = await axios.get(themesApiBase);
      setThemes(res.data);
      const freshTheme = res.data.find(t => t.id === selectedTheme?.id);
      if (freshTheme) setSelectedTheme(freshTheme);
      const freshSub = freshTheme?.sous_themes?.find(st => st.id === selectedSubTheme.id);
      if (freshSub) setSelectedSubTheme(freshSub);
    } catch (err) { console.error(err); alert('Erreur lors de la sauvegarde du tableau'); }
  };

  const handleImportFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('Remplacer le tableau existant par ce fichier ?')) { if (e.target) e.target.value = null; return; }
    const fd = new FormData();
    fd.append('file', file);
    try {
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
        setSelectedSubTheme(freshSub);
        if (showEditTable) setEditTableRows(JSON.parse(JSON.stringify(freshSub.data || [])));
      }
    } catch (err) { console.error(err.response?.data || err); alert('Erreur lors de l\'import: ' + (err.response?.data?.error || err.message)); }
    if (e.target) e.target.value = null;
  };

  const exportTableCSV = () => {
    if (!selectedSubTheme || !selectedSubTheme.data || selectedSubTheme.data.length === 0) return alert('Aucun tableau à exporter');
    const cols = selectedSubTheme.columns || [];
    const rows = selectedSubTheme.data || [];
    const header = cols.join(',');
    const lines = rows.map(r => cols.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(selectedSubTheme.nom || 'soustheme').replace(/\s+/g, '_')}_tableau.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const fetchThemes = async () => {
    try {
      const url = isVisitor ? 'http://127.0.0.1:8000/api/public-themes/' : 'http://127.0.0.1:8000/api/themes/';
      const res = await axios.get(url);
      setThemes(res.data);
    } catch (err) {
      // Affiche la réponse du serveur si disponible pour aider le debug
      console.error("Erreur thèmes", err.response?.data ?? err.message ?? err);
    }
  };

  // Fonction pour obtenir les valeurs uniques d'une colonne
  const getUniqueValuesForColumn = (columnName) => {
    const data = selectedSubTheme?.data || [];
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
    const data = selectedSubTheme?.data || [];
    
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

  const filteredData = selectedSubTheme?.data?.filter(row => {
    // Filtre par recherche texte (columnFilters)
    const passesTextFilter = Object.keys(columnFilters).every(key => 
      String(row[key] || '').toLowerCase().includes(columnFilters[key].toLowerCase())
    );
    
    // Filtre par valeurs sélectionnées (dynamicFilters basé sur filtres_disponibles)
    const passesDynamicFilters = Object.keys(dynamicFilters).every(key => {
      const selectedValue = dynamicFilters[key];
      if (!selectedValue) return true; // Pas de filtre sélectionné
      return String(row[key] || '') === selectedValue;
    });
    
    return passesTextFilter && passesDynamicFilters;
  }) || [];

  const visibleColumnsForRender = React.useMemo(() => {
    if (!selectedSubTheme) return [];
    if (isVisitor) {
      return (selectedSubTheme.visitor_visible_columns && selectedSubTheme.visitor_visible_columns.length) ? selectedSubTheme.visitor_visible_columns : (selectedSubTheme.columns || []);
    }
    return selectedSubTheme.columns || [];
  }, [selectedSubTheme, isVisitor]);

  const filtersForRender = React.useMemo(() => {
    if (!selectedSubTheme) return [];
    if (isVisitor) {
      return (selectedSubTheme.visitor_filters && selectedSubTheme.visitor_filters.length) ? selectedSubTheme.visitor_filters : (selectedSubTheme.filtres_disponibles || []);
    }
    return selectedSubTheme.filtres_disponibles || [];
  }, [selectedSubTheme, isVisitor]);

  // Gestion des graphiques
  const handleAddOrUpdateChart = async () => {
    // For Pie charts we still require X and Y (Y aggregated)
    if (!currentChartConfig.x || (!currentChartConfig.y && currentChartConfig.type !== 'Secteur')) return alert("Veuillez choisir les axes X et Y");

    if (currentChartConfig.filter_column && !currentChartConfig.filter_value) {
      return alert("Veuillez choisir une valeur pour le filtre");
    }

    // Type-specific validation (Y numeric for scatter/secteur when present)
    if ((currentChartConfig.type === 'Nuage de points' || currentChartConfig.type === 'Secteur') && selectedSubTheme && currentChartConfig.y) {
      const hasNumeric = (selectedSubTheme.data || []).some(r => {
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
      setSelectedSubTheme(freshSubTheme);
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
      await axios.delete(`http://127.0.0.1:8000/api/sousthemes/${selectedSubTheme.id}/charts/${id}/`);
      setSavedCharts(prev => prev.filter(c => c.id !== id));
      // refresh subtheme
      const themesRes = await axios.get(themesApiBase);
      const freshTheme = themesRes.data.find(t => t.id === selectedTheme.id);
      const freshSubTheme = freshTheme.sous_themes.find(sub => sub.id === selectedSubTheme.id);
      setSelectedSubTheme(freshSubTheme);
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
        if (freshSubTheme) setSelectedSubTheme(freshSubTheme);
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

  const goToTable = () => {
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
    const formData = new FormData();
    formData.append('titre', themeData.titre);
    formData.append('statut', themeData.statut);
    
    // Si on utilise des catégories, envoyer leur configuration
    if (useCategories) {
      formData.append('use_categories', 'true');
      categoryNames.filter(c => c.nom.trim()).forEach((cat, idx) => {
        formData.append(`categories[${idx}][nom]`, cat.nom);
        formData.append(`categories[${idx}][ordre]`, idx);
      });
    }
    
    rows.forEach((row, i) => {
      formData.append(`lignes[${i}][sousTheme]`, row.sousTheme);
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
      await axios.patch(`http://127.0.0.1:8000/api/sousthemes/${selectedSubTheme.id}/`, subThemeMeta);
      alert('Métadonnées du sous-thème sauvegardées');
      setShowSubThemeMeta(false);
      // refresh themes and selectedTheme + selectedSubTheme
      const res = await axios.get(themesApiBase);
      setThemes(res.data);
      const freshTheme = res.data.find(t => t.id === selectedTheme?.id);
      if (freshTheme) setSelectedTheme(freshTheme);
      const freshSub = freshTheme?.sous_themes?.find(st => st.id === selectedSubTheme.id);
      if (freshSub) setSelectedSubTheme(freshSub);
    } catch (err) {
      console.error('Erreur sauvegarde métadonnées sous-thème', err);
      alert('Erreur lors de la sauvegarde des métadonnées du sous-thème');
    }
  };

  const maxId = themes.length > 0 ? Math.max(...themes.map(t => t.id)) : 0;
  const isAdminView = String(activeMenu || '').toLowerCase().includes('admin');
  // Tant que l'interface visiteurs n'est pas développée, l'admin voit tout même dans l'onglet "Thèmes"
  const visibleThemes = isAuthenticated ? themes : themes.filter(t => !t.archived);

  // Affiche le loading ou la page de login/admin
  if (authLoading) {
    return <div className="flex min-h-screen bg-[#f4f1e1] justify-center items-center"><p className="text-xl font-bold">Chargement...</p></div>;
  }

  if (!isAuthenticated && !isVisitor) {
    return <LoginPage onLoginSuccess={handleLogin} />;
  }

  // --- RENDU PRINCIPAL (Admin) ---
  return (
    <div className="flex min-h-screen bg-[#f4f1e1] font-sans">
      
      {/* 1. MENU LATÉRAL */}
      <div className="w-64 bg-white border-r-2 border-black flex flex-col">
        <div className="p-4 border-b-2 border-black flex flex-col items-center">
          <img src="src/Image3.png" alt="Logo HCP" className="w-full h-full object-contain" />
        </div>
        <div className="bg-[#1a5d85] text-white py-2 px-4 font-bold text-center border-b border-black">Menu</div>
        <SidebarButton label="Thèmes" active={activeMenu === 'Themes'} onClick={() => {setActiveMenu('Themes'); setFormStep(0);}} />
        <SidebarButton label="Indicateurs" active={activeMenu === 'Indicateurs'} onClick={() => setActiveMenu('Indicateurs')} />
        {canEdit && (
          <>
            <SidebarButton label="Espace admin" active={activeMenu === 'Admin'} onClick={() => {setActiveMenu('Admin'); setFormStep(0); setSelectedTheme(null); setSelectedSubTheme(null);}} />
            <div className="mt-auto p-4 border-t-2 border-black bg-white space-y-2">
              <button onClick={() => { setSettingsForm({ email: localStorage.getItem('user_email') || '', newPassword: '', confirmPassword: '' }); setShowSettings(true); }} className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-3 rounded border-2 border-black shadow-md flex items-center justify-center gap-2">
                ⚙️ Paramètres
              </button>
              <button onClick={handleLogout} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-3 rounded border-2 border-black shadow-md">
                Déconnexion
              </button>
            </div>
          </>
        )}
      </div>

      {/* 2. CONTENU PRINCIPAL */}
      <div className="flex-1 flex flex-col">
        <div className="bg-[#a2e3f7] p-4 border-b-2 border-black flex justify-center shadow-md relative">
          <h1 className="text-[#1a5d85] text-xl font-bold italic text-center">
            Base de Données Région Béni Mellal-Khénifra قاعدة البيانات الاحصائية لجهة بني ملال خنيفرة
          </h1>
          isAdminView 
        </div>

        <div className="p-6 flex justify-center">
          <div className="relative w-1/2">
            <input 
              type="text" 
              placeholder={
                activeMenu === 'Themes' && formStep === 0 ? 'Rechercher un thème...' : 
                activeMenu === 'Indicateurs' ? 'Rechercher un indicateur...' :
                formStep === 3 ? 'Rechercher un sous-thème...' : 
                'Barre de recherche'
              } 
              className="w-full p-2 border-2 border-black rounded shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white italic outline-none"
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
            <span className="absolute right-3 top-2">🔍</span>
          </div>
        </div>

        <div className="px-8 pb-10 flex-1">
          
          {/* GRILLE DES INDICATEURS (TOUS LES SOUS-THÈMES) */}
          {activeMenu === 'Indicateurs' && (
            <div className="relative min-h-[400px]">
              <div className="grid grid-cols-4 gap-6">
                {themes.flatMap(theme => 
                  (theme.sous_themes || []).map(st => ({...st, theme_titre: theme.titre, theme_id: theme.id}))
                ).filter(st => 
                  st.nom.toLowerCase().includes(searchIndicateur.toLowerCase()) ||
                  st.theme_titre.toLowerCase().includes(searchIndicateur.toLowerCase())
                ).map((st, i) => (
                  <div 
                    key={st.id} 
                    onClick={async () => {
                      try {
                        const res = await axios.get(themesApiBase);
                        const freshTheme = res.data.find(t => t.id === st.theme_id);
                        const freshSubTheme = freshTheme.sous_themes.find(sub => sub.id === st.id);
                        setSelectedTheme(freshTheme);
                        setSelectedSubTheme(freshSubTheme);
                        setSavedCharts(freshSubTheme.charts_config || []);
                        setActiveMenu('Themes');
                        setFormStep(4);
                        setShowAll(false);
                      } catch (err) { console.error(err); }
                    }}
                    className={`relative cursor-pointer p-6 rounded-xl border-2 border-black shadow-lg text-white font-bold text-center hover:scale-105 transition-transform ${st.archived ? 'bg-gray-600 line-through opacity-80' : 'bg-[#4a77b4]'}`}
                  >
                    {st.archived && (
                      <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded-full text-xs font-bold">🚫</div>
                    )}
                    <div className="text-sm opacity-75 mb-2">{st.theme_titre}</div>
                    <div className="text-lg">{st.nom}</div>
                    {canEdit && (
                      <div className={`absolute bottom-3 right-3 w-5 h-5 rounded-full border border-black ${st.is_visible ? 'bg-green-400' : 'bg-red-500'}`}></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PAGE ADMINISTRATEURS */}
          {activeMenu === 'Admin' && (
            <AdministratorsPage />
          )}

          {/* ÉTAPE 0 : GRILLE DES THÈMES */}
          {activeMenu === 'Themes' && formStep === 0 && (
            <div className="relative min-h-[400px]">
              <div className="grid grid-cols-3 gap-6">
                {visibleThemes.filter(t => t.titre.toLowerCase().includes(searchTheme.toLowerCase())).map((t, i) => (
                  <div 
                    key={t.id} 
                    onClick={() => { 
                      if (!t.categories || t.categories.length === 0) {
                        setSelectedTheme(t);
                        setSelectedCategorie(null);
                        setFormStep(3);
                      }
                    }}
                    className={`cursor-pointer p-5 rounded-xl border-2 border-black shadow-lg relative text-white font-bold transition-transform hover:scale-105 ${t.archived ? 'bg-gray-600 line-through opacity-80' : (t.id === maxId ? 'bg-[#ffb366]' : 'bg-[#41699d]')}`}
                  >
                    {t.archived && (
                      <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded-full text-xs font-bold">🚫</div>
                    )}
                    <div className="flex items-center justify-between">
                      <span>Thème {i + 1} : {t.titre}</span>
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
                          className="bg-white text-black px-3 py-1 rounded-lg border-2 border-black hover:bg-gray-100 text-xl font-bold"
                        >
                          ▼
                        </button>
                      )}
                    </div>
                    <div className="flex mt-4 gap-2">
                      {canEdit && (
                        <button onClick={(e) => { 
                          e.stopPropagation(); 
                          const rect = e.currentTarget.getBoundingClientRect(); 
                          const menuHeight = 200; // hauteur estimée du menu
                          const menuWidth = 224; // w-56
                          const spaceBelow = window.innerHeight - rect.bottom;
                          const spaceRight = window.innerWidth - rect.left;
                          const top = spaceBelow > menuHeight ? rect.bottom + 8 : rect.top - menuHeight - 8;
                          const left = spaceRight > menuWidth ? rect.left : rect.right - menuWidth;
                          setActionMenuPos({ left, top }); 
                          setOpenActionMenu(openActionMenu === t.id ? null : t.id); 
                          setOpenThemeMenu(null); 
                        }} className="bg-[#99c199] p-1 border border-black rounded shadow">📝</button>
                      )}

                      <div>
                        {canEdit && (
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
              {canEdit && (
                <button 
                  onClick={() => setFormStep(1)}
                  className="fixed bottom-10 right-10 bg-[#ffb366] hover:bg-[#ffa347] text-white font-bold py-4 px-8 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                >
                  Ajouter un thème
                </button>
              )}

              {/* Floating theme menu (renders at viewport level to avoid being clipped) */}
              {openThemeMenu && (
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
                    {canEdit && (
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
                  <div className="w-64 bg-white rounded-lg shadow-2xl border-2 border-black max-h-96 overflow-y-auto">
                    <div className="px-4 py-3 border-b-2 border-black text-sm font-bold text-gray-800 bg-gray-100">Choisir une catégorie</div>
                    {(() => {
                      const currentTheme = themes.find(x => x.id === openCategorieMenu);
                      if (!currentTheme || !currentTheme.categories) return null;
                      return currentTheme.categories.sort((a, b) => a.ordre - b.ordre).map(cat => (
                        <div key={cat.id} className="px-4 py-3 border-b border-gray-200 hover:bg-blue-50 transition-colors flex items-center gap-2 justify-between">
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation();
                              setSelectedTheme(currentTheme);
                              setSelectedCategorie(cat);
                              setOpenCategorieMenu(null);
                              setFormStep(3);
                            }}
                            className="flex-1 text-left flex items-center gap-2"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M9 3H4a1 1 0 00-1 1v5a1 1 0 001 1h5a1 1 0 001-1V4a1 1 0 00-1-1z" stroke="#4a77b4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M20 3h-5a1 1 0 00-1 1v5a1 1 0 001 1h5a1 1 0 001-1V4a1 1 0 00-1-1z" stroke="#4a77b4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M9 14H4a1 1 0 00-1 1v5a1 1 0 001 1h5a1 1 0 001-1v-5a1 1 0 00-1-1z" stroke="#4a77b4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M20 14h-5a1 1 0 00-1 1v5a1 1 0 001 1h5a1 1 0 001-1v-5a1 1 0 00-1-1z" stroke="#4a77b4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <span className="font-semibold">{cat.nom}</span>
                            <span className="ml-auto text-xs text-gray-500">({cat.sous_themes?.length || 0})</span>
                          </button>
                          {canEdit && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteCategorie(cat.id);
                              }}
                              className="p-1 hover:bg-red-200 rounded transition-colors text-red-600"
                              title="Supprimer cette catégorie"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M10 7V4a1 1 0 011-1h2a1 1 0 011 1v3m-6 0h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {openActionMenu && (
                <div onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', left: actionMenuPos.left, top: actionMenuPos.top, zIndex: 9999 }}>
                  <div className="w-56 bg-white rounded-lg shadow-2xl border border-gray-200 max-h-96 overflow-y-auto">
                    <div className="px-3 py-2 border-b text-sm font-semibold text-gray-700">Actions</div>
                    <button onClick={(e) => { e.stopPropagation(); const t = themes.find(x => x.id === openActionMenu); setActionModalType('rename'); setActionModalValue(t?.titre || ''); setActionModalThemeId(openActionMenu); setShowActionModal(true); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 21v-3" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 14l9-9 3 3-9 9H7v-3z" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Renommer
                    </button>
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
                 <button onClick={() => setFormStep(0)} className="bg-[#f28a8a] text-white px-10 py-2 rounded-lg border-2 border-black font-bold shadow-md">Annuler</button>
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
                       <div className="bg-[#6d92c7] px-4 py-3 border-b-2 border-black">
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
            <div className="space-y-8">
              <div className="flex justify-between items-center gap-4">
                <button onClick={() => { setFormStep(0); setSelectedCategorie(null); }} className="bg-white px-4 py-2 border-2 border-black rounded-xl font-bold hover:bg-gray-100 shadow-md">⬅ Retour</button>
                <div className="flex items-center gap-3 flex-1 justify-center">
                  <h2 className="bg-[#c2d9ff] px-6 py-2 rounded-xl border-2 border-black font-bold shadow-md">
                    {selectedCategorie ? `${selectedTheme.titre} - ${selectedCategorie.nom}` : `Titre du thème : ${selectedTheme.titre}`}
                  </h2>
                  {selectedCategorie ? (
                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <div className={`w-5 h-5 rounded-full border border-black ${selectedCategorie.is_visible ? 'bg-green-400' : 'bg-red-500'}`}></div>
                      )}
                      {canEdit && (
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
                      {canEdit && (
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
                <button onClick={(e) => { e.stopPropagation(); setShowAdvancedConfig(false); setThemeMeta({ definition_text: selectedTheme.definition_text || '', unite_text: selectedTheme.unite_text || '', indication_text: selectedTheme.indication_text || '', source_text: selectedTheme.source_text || '', periodicite_text: selectedTheme.periodicite_text || '', couverture_text: selectedTheme.couverture_text || '' }); setShowThemeMeta(true); }} className="bg-white px-6 py-2 rounded-xl border-2 border-black font-bold shadow-md hover:bg-gray-100">Métadonnées</button>
              </div>
              
              {/* Affichage avec catégories ou sans */}
              {selectedCategorie ? (
                // Affichage d'une seule catégorie
                <div className="grid grid-cols-4 gap-6">
                  {selectedCategorie.sous_themes?.filter(st => st.nom.toLowerCase().includes(searchSubTheme.toLowerCase())).map((st, i) => (
                    <div 
                      key={st.id || i} 
                      onClick={async () => { 
                        try {
                          const res = await axios.get(themesApiBase);
                          const freshTheme = res.data.find(t => t.id === selectedTheme.id);
                          const freshSubTheme = freshTheme.sous_themes.find(sub => sub.id === st.id);
                          setSelectedSubTheme(freshSubTheme);
                          setSavedCharts(freshSubTheme.charts_config || []);
                          setFormStep(4); 
                          setShowAll(false);
                        } catch (err) { console.error(err); }
                      }}
                      className={`relative cursor-pointer p-6 rounded-xl border-2 border-black shadow-lg text-white font-bold text-center hover:scale-105 transition-transform ${st.archived ? 'bg-gray-600 line-through opacity-80' : 'bg-[#4a77b4]'}`}
                    >
                      {st.archived && (
                        <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded-full text-xs font-bold">🚫</div>
                      )}
                      {st.nom}
                      {canEdit && (
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
                          }} className="bg-[#99c199] p-1 border border-black rounded shadow">📝</button>
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
                      {canEdit && (
                        <div className={`absolute bottom-3 right-3 w-5 h-5 rounded-full border border-black ${st.is_visible ? 'bg-green-400' : 'bg-red-500'}`}></div>
                      )}
                    </div>
                  ))}
                </div>
              ) : selectedTheme.categories && selectedTheme.categories.length > 0 ? (
                // Affichage de toutes les catégories (mode dropdown)
                <div className="space-y-4">
                  {selectedTheme.categories.sort((a, b) => a.ordre - b.ordre).map(cat => {
                    const filteredSousThemes = cat.sous_themes?.filter(st => st.nom.toLowerCase().includes(searchSubTheme.toLowerCase())) || [];
                    if (filteredSousThemes.length === 0 && searchSubTheme) return null;
                    
                    return (
                      <div key={cat.id} className="bg-gray-50 border-2 border-black rounded-xl overflow-hidden">
                        <div 
                          className="bg-[#6d92c7] px-6 py-3 hover:bg-[#5a81b5] transition-colors flex justify-between items-center"
                        >
                          <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => setExpandedCategories(prev => ({...prev, [cat.id]: !prev[cat.id]}))}>
                            <h3 className="font-bold text-white text-lg">{cat.nom}</h3>
                            <span className="text-white font-bold text-xl">
                              {expandedCategories[cat.id] ? '▼' : '▶'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            {canEdit && (
                              <>
                                <div className={`w-5 h-5 rounded-full border border-black ${cat.is_visible ? 'bg-green-400' : 'bg-red-500'}`}></div>
                                <select
                                  value={cat.is_visible ? 'Public' : 'Privé'}
                                  onChange={async (e) => {
                                    const val = e.target.value;
                                    const newVis = val === 'Public';
                                    if (!confirm(`Changer la visibilité de la catégorie "${cat.nom}" et de tous ses sous-thèmes ?`)) return;
                                    await toggleCategoriePublication(cat.id, newVis);
                                  }}
                                >
                                  <option value="Public">Public</option>
                                  <option value="Privé">Privé</option>
                                </select>
                              </>
                            )}
                            {!canEdit && (
                              <div className="w-5 h-5 opacity-0" />
                            )}
                          </div>
                        </div>
                        
                        {expandedCategories[cat.id] && (
                          <div className="p-4 grid grid-cols-4 gap-6">
                            {filteredSousThemes.map((st, i) => (
                              <div 
                                key={st.id || i} 
                                onClick={async () => { 
                                  try {
                                    const res = await axios.get(themesApiBase);
                                    const freshTheme = res.data.find(t => t.id === selectedTheme.id);
                                    const freshSubTheme = freshTheme.sous_themes.find(sub => sub.id === st.id);
                                    setSelectedSubTheme(freshSubTheme);
                                    setSavedCharts(freshSubTheme.charts_config || []);
                                    setFormStep(4); 
                                    setShowAll(false);
                                  } catch (err) { console.error(err); }
                                }}
                                className={`relative cursor-pointer p-6 rounded-xl border-2 border-black shadow-lg text-white font-bold text-center hover:scale-105 transition-transform ${st.archived ? 'bg-gray-600 line-through opacity-80' : 'bg-[#4a77b4]'}`}
                              >
                                {st.archived && (
                                  <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded-full text-xs font-bold">🚫</div>
                                )}
                                {st.nom}
                                {canEdit && (
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
                                    }} className="bg-[#99c199] p-1 border border-black rounded shadow">📝</button>
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
                                {canEdit && (
                                  <div className={`absolute bottom-3 right-3 w-5 h-5 rounded-full border border-black ${st.is_visible ? 'bg-green-400' : 'bg-red-500'}`}></div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                // Affichage sans catégories (thèmes classiques)
                <div className="grid grid-cols-4 gap-6">
                  {selectedTheme.sous_themes && selectedTheme.sous_themes.filter(st => st.nom.toLowerCase().includes(searchSubTheme.toLowerCase())).map((st, i) => (
                    <div 
                      key={st.id || i} 
                      onClick={async () => { 
                        try {
                                  const res = await axios.get(themesApiBase);
                          const freshTheme = res.data.find(t => t.id === selectedTheme.id);
                          const freshSubTheme = freshTheme.sous_themes.find(sub => sub.id === st.id);
                          setSelectedSubTheme(freshSubTheme);
                          setSavedCharts(freshSubTheme.charts_config || []);
                          setFormStep(4); 
                          setShowAll(false);
                        } catch (err) { console.error(err); }
                      }}
                      className={`relative cursor-pointer p-6 rounded-xl border-2 border-black shadow-lg text-white font-bold text-center hover:scale-105 transition-transform ${st.archived ? 'bg-gray-600 line-through opacity-80' : 'bg-[#4a77b4]'}`}
                    >
                      {st.archived && (
                        <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded-full text-xs font-bold">🚫</div>
                      )}
                      {st.nom}
                      {canEdit && (
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
                          }} className="bg-[#99c199] p-1 border border-black rounded shadow">📝</button>
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
                      {canEdit && (
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
            <div className="bg-white border-2 border-black p-6 rounded-xl shadow-2xl space-y-6">
              
              <div className="flex justify-between items-start">
                <h3 className="bg-[#c2d9ff] px-6 py-2 border-2 border-black rounded-xl font-bold text-lg shadow-sm">
                  Sous thème : {selectedSubTheme.nom}
                </h3>
                <div className="flex items-center gap-3">
                  {canEdit ? (
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
                        className="flex-1 border-2 border-blue-300 rounded-md p-2 text-lg bg-white outline-none"
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
                      className="bg-red-600 text-white px-4 py-2 rounded-xl border-2 border-black font-bold shadow-md hover:bg-red-700"
                    >
                      ⚙️ Visiteur
                    </button>
                  )}

                  <button onClick={(e) => { e.stopPropagation(); setShowAdvancedConfig(false); setSubThemeMeta({ definition_text: selectedSubTheme.definition_text || '', unite_text: selectedSubTheme.unite_text || '', indication_text: selectedSubTheme.indication_text || '', source_text: selectedSubTheme.source_text || '', periodicite_text: selectedSubTheme.periodicite_text || '', couverture_text: selectedSubTheme.couverture_text || '' }); setShowSubThemeMeta(true); }} className="bg-white px-6 py-2 rounded-xl border-2 border-black font-bold shadow-md hover:bg-gray-100">Métadonnées</button>
                  <button onClick={() => setFormStep(3)} className="bg-orange-400 text-white px-4 py-1 border-2 border-black rounded-lg font-bold shadow-md">Fermer</button>
                </div>
              </div>

              {/* FILTRES DYNAMIQUES - basés sur filtres_disponibles */}
              {filtersForRender && filtersForRender.length > 0 && (
                <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 space-y-3 w-fit">
                  <h3 className="font-bold text-blue-900">🔍 Filtres Disponibles</h3>
                  <div className="flex gap-3">
                    {filtersForRender.map(filterCol => (
                      <div key={filterCol}>
                        <label className="text-sm font-bold text-gray-700 block mb-1">{filterCol}</label>
                        <select
                          value={dynamicFilters[filterCol] || ''}
                          onChange={(e) => setDynamicFilters({...dynamicFilters, [filterCol]: e.target.value})}
                          className="w-40 p-2 border-2 border-blue-300 rounded bg-white outline-none text-sm"
                        >
                          <option value="">-- Tous --</option>
                          {getUniqueValuesForColumn(filterCol).map(val => (
                            <option key={val} value={val}>{val}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* BOUTON CONFIGURATION AVANCÉE */}
              {canEdit && (
                <button onClick={(e) => { e.stopPropagation(); showToast('Ouverture configuration avancée', 'info'); setAdvancedConfig({ niveau_geo: selectedSubTheme?.niveau_geo || null, type_unite: selectedSubTheme?.type_unite || '', est_sommable: selectedSubTheme?.est_sommable ?? true, filtres_disponibles: selectedSubTheme?.filtres_disponibles || [] }); setShowAdvancedConfig(true); }} className="bg-blue-400 text-white px-6 py-2 border-2 border-black rounded-xl font-bold shadow-md hover:bg-blue-500">⚙️ Configuration Avancée</button>
              )}

              {/* TABLEAU AVEC FILTRES PAR COLONNE */}
              <div className="space-y-4">
                <div className="border-2 border-black rounded-lg overflow-auto max-h-80 bg-white shadow-inner">
                  <table className="w-full text-center border-collapse">
                    <thead className="bg-gray-100 border-b-2 border-black font-bold sticky top-0 z-10">
                      <tr>
                        {visibleColumnsForRender.map(col => (
                          <th key={col} className="p-2 border-r border-black min-w-[150px]">
                            <div className="text-blue-800 italic mb-2 uppercase text-[10px]">{col}</div>
                            <input 
                              type="text" 
                              placeholder="Filtrer..."
                              className="w-full p-1 text-xs border border-gray-300 rounded font-normal outline-none focus:border-blue-500"
                              onChange={(e) => setColumnFilters({...columnFilters, [col]: e.target.value})}
                            />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const displayedRows = showAll ? filteredData : filteredData.slice(0, 3);

                        // If visitor, keep original behavior (blank repeated cells)
                        if (isVisitor) {
                          return displayedRows.map((row, i) => {
                            const prev = i > 0 ? displayedRows[i - 1] : null;
                            return (
                              <tr key={i} className="border-b border-gray-300 h-10 hover:bg-gray-50">
                                {visibleColumnsForRender.map((col, idx) => {
                                  let hide = false;
                                  if (prev && prev[col] === row[col]) {
                                    const leftCols = visibleColumnsForRender.slice(0, idx);
                                    const allLeftEqual = leftCols.every(lc => prev[lc] === row[lc]);
                                    hide = allLeftEqual;
                                  }
                                  return (
                                    <td key={col} className="border-r border-gray-300 p-2 text-xs">{hide ? '' : row[col]}</td>
                                  );
                                })}
                              </tr>
                            );
                          });
                        }

                        // Admin view: compute rowSpans for consecutive identical cells in displayedRows
                        const rowCount = displayedRows.length;
                        const spans = {};
                        visibleColumnsForRender.forEach(col => {
                          spans[col] = new Array(rowCount).fill(0);
                          let i = 0;
                          while (i < rowCount) {
                            const val = String((displayedRows[i] && displayedRows[i][col]) ?? '');
                            let j = i + 1;
                            while (j < rowCount && String((displayedRows[j] && displayedRows[j][col]) ?? '') === val) j++;
                            const span = j - i;
                            spans[col][i] = span; // first occurance gets span
                            i = j;
                          }
                        });

                        return displayedRows.map((row, i) => (
                          <tr key={i} className="border-b border-gray-300 h-10 hover:bg-gray-50">
                            {visibleColumnsForRender.map((col) => {
                              const span = spans[col][i] || 0;
                              if (span === 0) return null;
                              return (
                                <td key={col} rowSpan={span} className="border-r border-gray-300 p-2 text-xs align-top">{row[col]}</td>
                              );
                            })}
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-4 items-center">
                  <button onClick={() => setShowAll(!showAll)} className="bg-[#8ec278] text-white px-6 py-2 border-2 border-black rounded-xl font-bold shadow-md">
                    {showAll ? "Réduire le tableau" : "Afficher tout le tableau"}
                  </button>

                  {canEdit && (
                    <button onClick={openEditTable} className="bg-[#ffd56b] text-black px-4 py-2 border-2 border-black rounded-xl font-bold shadow-md">Modifier le tableau</button>
                  )}

                  <button onClick={exportTableCSV} className="bg-[#62a3ff] text-white px-4 py-2 border-2 border-black rounded-xl font-bold shadow-md">Exporter le tableau</button>
                </div>
              </div>

              {/* ZONE DES GRAPHIQUES GÉNÉRÉS */}
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  {savedCharts.map((chart) => {
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
                                  <Bar dataKey={chart.y} fill="#4a77b4" />
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
                                  <Line type="monotone" dataKey={chart.y} stroke="#4a77b4" strokeWidth={3} />
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
                                  <Scatter data={chartData} fill="#4a77b4" />
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
                  })}
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
            </div>
          )}
        </div>
      </div>

      {/* POP-UP MODALE : CONFIGURATION GRAPHIQUE */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50 p-4">
          <div className="bg-[#fef9f2] border-4 border-black p-8 rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-xl font-black mb-6 text-center uppercase sticky top-0 bg-[#fef9f2]">Paramètres du Graphique</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block font-bold mb-1">Type :</label>
                <select 
                  className="w-full p-2 border-2 border-black rounded-lg bg-white"
                  value={currentChartConfig.type}
                  onChange={e => setCurrentChartConfig({...currentChartConfig, type: e.target.value})}
                >
                  <option value="Histogramme">Barres (Histogramme)</option>
                  <option value="Courbes">Lignes (Courbes)</option>
                  <option value="Nuage de points">Nuage de points (Scatter)</option>
                  <option value="Secteur">Secteur (Pie)</option>
                </select>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block font-bold mb-1">Axe X :</label>
                  <select 
                    className="w-full p-2 border-2 border-black rounded-lg bg-white"
                    value={currentChartConfig.x}
                    onChange={e => {
                      const newX = e.target.value;
                      setCurrentChartConfig({...currentChartConfig, x: newX, y: (currentChartConfig.y === newX ? '' : currentChartConfig.y)});
                    }}
                  >
                    <option value="">Sélectionner</option>
                    {selectedSubTheme.columns?.map(c => <option key={c} value={c} disabled={c === currentChartConfig.y}>{c}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block font-bold mb-1">Axe Y :</label>
                  <select 
                    className="w-full p-2 border-2 border-black rounded-lg bg-white"
                    value={currentChartConfig.y}
                    onChange={e => {
                      const newY = e.target.value;
                      setCurrentChartConfig({...currentChartConfig, y: newY, x: (currentChartConfig.x === newY ? '' : currentChartConfig.x)});
                    }}
                  >
                    <option value="">Sélectionner</option>
                    {selectedSubTheme.columns?.map(c => c !== currentChartConfig.x ? <option key={c} value={c}>{c}</option> : null)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Filtre par colonne (optionnel) :</label>
                <select
                  className="w-full p-2 border-2 border-black rounded-lg bg-white"
                  value={currentChartConfig.filter_column || ''}
                  onChange={e => setCurrentChartConfig({
                    ...currentChartConfig,
                    filter_column: e.target.value,
                    filter_value: ''
                  })}
                >
                  <option value="">-- Aucun filtre --</option>
                  {selectedSubTheme.columns?.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {currentChartConfig.filter_column && (
                <div className="p-4 bg-blue-50 border-2 border-blue-300 rounded-lg space-y-3">
                  <label className="block font-bold mb-2 text-blue-900">Sélectionner la valeur '{currentChartConfig.filter_column}' :</label>
                  <select
                    className="w-full p-2 border-2 border-blue-400 rounded-lg bg-white font-bold"
                    value={currentChartConfig.filter_value || ''}
                    onChange={e => setCurrentChartConfig({
                      ...currentChartConfig,
                      filter_value: e.target.value
                    })}
                  >
                    <option value="">-- Choisir une année --</option>
                    {getUniqueValuesForColumn(currentChartConfig.filter_column).map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                  
                  <div className="flex gap-3 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="filter_mode"
                        value="include"
                        checked={currentChartConfig.filter_mode === 'include'}
                        onChange={e => setCurrentChartConfig({...currentChartConfig, filter_mode: e.target.value})}
                        className="w-4 h-4"
                      />
                      <span className="font-bold text-green-700">✓ Inclure</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="filter_mode"
                        value="exclude"
                        checked={currentChartConfig.filter_mode === 'exclude'}
                        onChange={e => setCurrentChartConfig({...currentChartConfig, filter_mode: e.target.value})}
                        className="w-4 h-4"
                      />
                      <span className="font-bold text-red-700">✕ Exclure</span>
                    </label>
                  </div>
                </div>
              )}

              {/* FILTRES SUPPLÉMENTAIRES (MULTIPLES) */}
              {currentChartConfig.filters && currentChartConfig.filters.length > 0 && (
                <div className="p-4 bg-purple-50 border-2 border-purple-300 rounded-lg space-y-3">
                  <h3 className="font-bold text-purple-900">Filtres supplémentaires :</h3>
                  {currentChartConfig.filters.map((filter, idx) => (
                    <div key={idx} className="p-3 bg-white border border-purple-300 rounded space-y-2">
                      <div className="flex gap-2">
                        <select
                          className="flex-1 p-2 border-2 border-purple-300 rounded bg-white font-bold text-sm"
                          value={filter.column || ''}
                          onChange={e => {
                            const newFilters = [...currentChartConfig.filters];
                            newFilters[idx].column = e.target.value;
                            newFilters[idx].value = '';
                            setCurrentChartConfig({...currentChartConfig, filters: newFilters});
                          }}
                        >
                          <option value="">-- Colonne --</option>
                          {selectedSubTheme.columns?.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        
                        {filter.column && (
                          <select
                            className="flex-1 p-2 border-2 border-purple-300 rounded bg-white font-bold text-sm"
                            value={filter.value || ''}
                            onChange={e => {
                              const newFilters = [...currentChartConfig.filters];
                              newFilters[idx].value = e.target.value;
                              setCurrentChartConfig({...currentChartConfig, filters: newFilters});
                            }}
                          >
                            <option value="">-- Valeur --</option>
                            {getUniqueValuesForColumn(filter.column).map(v => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                        )}

                        <button
                          onClick={() => {
                            const newFilters = currentChartConfig.filters.filter((_, i) => i !== idx);
                            setCurrentChartConfig({...currentChartConfig, filters: newFilters});
                          }}
                          className="px-3 py-2 bg-red-300 border-2 border-black rounded font-bold text-sm hover:bg-red-400"
                        >
                          ✕
                        </button>
                      </div>
                      
                      {filter.value && (
                        <div className="flex gap-2 pt-1">
                          <label className="flex items-center gap-2 cursor-pointer text-sm">
                            <input
                              type="radio"
                              checked={(filter.mode || 'include') === 'include'}
                              onChange={() => {
                                const newFilters = [...currentChartConfig.filters];
                                newFilters[idx].mode = 'include';
                                setCurrentChartConfig({...currentChartConfig, filters: newFilters});
                              }}
                              className="w-4 h-4"
                            />
                            <span className="font-bold text-green-700">✓ Inclure</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-sm">
                            <input
                              type="radio"
                              checked={(filter.mode || 'include') === 'exclude'}
                              onChange={() => {
                                const newFilters = [...currentChartConfig.filters];
                                newFilters[idx].mode = 'exclude';
                                setCurrentChartConfig({...currentChartConfig, filters: newFilters});
                              }}
                              className="w-4 h-4"
                            />
                            <span className="font-bold text-red-700">✕ Exclure</span>
                          </label>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  <button
                    onClick={() => {
                      const newFilters = [...currentChartConfig.filters, { column: '', value: '', mode: 'include' }];
                      setCurrentChartConfig({...currentChartConfig, filters: newFilters});
                    }}
                    className="w-full py-2 bg-purple-300 border-2 border-purple-700 rounded font-bold hover:bg-purple-400 text-sm"
                  >
                    + Ajouter un filtre
                  </button>
                </div>
              )}

              {/* BOUTON POUR AJOUTER LE PREMIER FILTRE SUPPLÉMENTAIRE */}
              {(!currentChartConfig.filters || currentChartConfig.filters.length === 0) && currentChartConfig.filter_column && (
                <button
                  onClick={() => {
                    const newFilters = [{ column: '', value: '', mode: 'include' }];
                    setCurrentChartConfig({...currentChartConfig, filters: newFilters});
                  }}
                  className="w-full py-2 bg-purple-200 border-2 border-purple-500 rounded font-bold hover:bg-purple-300 text-sm text-purple-900"
                >
                  + Ajouter un filtre supplémentaire
                </button>
              )}

              {/* Chart-level visible filters for visitors */}
              <div className="p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg space-y-3">
                <h3 className="font-bold text-yellow-900">Filtres visibles pour le visiteur (ce graphique)</h3>
                {(currentChartConfig.visible_filters || []).map((vf, idx) => {
                  const col = (typeof vf === 'string') ? vf : (vf && vf.column) || '';
                  const defVal = (typeof vf === 'object' && vf) ? (vf.default || '') : '';
                  return (
                    <div key={idx} className="p-2 bg-white border rounded flex gap-2 items-center">
                      <select
                        className="flex-1 p-2 border-2 border-yellow-300 rounded bg-white"
                        value={col}
                        onChange={e => {
                          const newVis = [...(currentChartConfig.visible_filters || [])];
                          newVis[idx] = { column: e.target.value, default: '' };
                          setCurrentChartConfig({ ...currentChartConfig, visible_filters: newVis });
                        }}
                      >
                        <option value="">-- Colonne à afficher --</option>
                        {selectedSubTheme.columns?.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>

                      {col && (
                        <select
                          className="w-48 p-2 border-2 border-yellow-300 rounded bg-white"
                          value={defVal}
                          onChange={e => {
                            const newVis = [...(currentChartConfig.visible_filters || [])];
                            const item = (typeof newVis[idx] === 'string') ? { column: newVis[idx], default: '' } : (newVis[idx] || {});
                            item.default = e.target.value;
                            newVis[idx] = item;
                            setCurrentChartConfig({ ...currentChartConfig, visible_filters: newVis });
                          }}
                        >
                          <option value="">-- Défaut (aucun) --</option>
                          {getUniqueValuesForColumn(col).map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      )}

                      <button
                        onClick={() => {
                          const newVis = (currentChartConfig.visible_filters || []).filter((_, i) => i !== idx);
                          setCurrentChartConfig({ ...currentChartConfig, visible_filters: newVis });
                        }}
                        className="px-3 py-2 bg-red-300 border-2 border-black rounded font-bold text-sm hover:bg-red-400"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}

                <button
                  onClick={() => {
                    const newVis = [...(currentChartConfig.visible_filters || []), { column: '', default: '' }];
                    setCurrentChartConfig({ ...currentChartConfig, visible_filters: newVis });
                  }}
                  className="w-full py-2 bg-yellow-200 border-2 border-yellow-700 rounded font-bold hover:bg-yellow-300 text-sm"
                >
                  + Ajouter un filtre visible
                </button>
              </div>

              <div>
                <label className="block font-bold mb-1">Ajouter une mesure / note :</label>
                <textarea 
                  className="w-full p-2 border-2 border-black rounded-lg h-20 outline-none"
                  value={currentChartConfig.mesure}
                  onChange={e => setCurrentChartConfig({...currentChartConfig, mesure: e.target.value})}
                  placeholder="Expliquez ce graphique..."
                />
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block font-bold mb-1">Titre du graphique (affiché au-dessus) :</label>
                  <input
                    type="text"
                    className="w-full p-2 border-2 border-black rounded-lg bg-white"
                    value={currentChartConfig.title || ''}
                    onChange={e => setCurrentChartConfig({...currentChartConfig, title: e.target.value})}
                    placeholder="Titre du graphique"
                  />
                </div>

              <div className="p-4 bg-green-50 border-2 border-green-300 rounded-lg space-y-3">
                <label className="block font-bold mb-1">Grouper par colonne (crée plusieurs séries)</label>
                <select
                  className="w-full p-2 border-2 border-green-300 rounded bg-white"
                  value={currentChartConfig.group_by || ''}
                  onChange={e => setCurrentChartConfig({...currentChartConfig, group_by: e.target.value})}
                >
                  <option value="">-- Aucun --</option>
                  {selectedSubTheme.columns?.map(c => (
                    <option key={c} value={c} disabled={c === currentChartConfig.x}>{c}{c === currentChartConfig.x ? ' (disable : same as X)' : ''}</option>
                  ))}
                </select>
                {currentChartConfig.group_by === currentChartConfig.x && currentChartConfig.group_by !== '' && (
                  <div className="text-sm text-red-600 mt-1">Le groupement sur la même colonne que l'axe X produit des séries avec beaucoup de zéros — choisissez une colonne différente (ex: Province).</div>
                )}
                <div className="text-xs italic text-gray-600">Sélectionnez une colonne dont les valeurs définiront une courbe/série distincte (ex: Province).</div>
              </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block font-bold mb-1">Label Axe X (optionnel)</label>
                    <input
                      type="text"
                      className="w-full p-2 border-2 border-black rounded-lg bg-white"
                      value={currentChartConfig.x_label || ''}
                      onChange={e => setCurrentChartConfig({...currentChartConfig, x_label: e.target.value})}
                      placeholder="Ex: Année, Catégorie"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block font-bold mb-1">Label Axe Y (optionnel)</label>
                    <input
                      type="text"
                      className="w-full p-2 border-2 border-black rounded-lg bg-white"
                      value={currentChartConfig.y_label || ''}
                      onChange={e => setCurrentChartConfig({...currentChartConfig, y_label: e.target.value})}
                      placeholder="Ex: Valeur (%), Effectif"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-8 sticky bottom-0 pt-4 bg-[#fef9f2]">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 bg-gray-200 py-2 border-2 border-black rounded-xl font-bold">Annuler</button>
              <button onClick={handleAddOrUpdateChart} className="flex-1 bg-[#ffb366] py-2 border-2 border-black rounded-xl font-bold shadow-md">
                {currentChartConfig.id ? "Modifier" : "Générer"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showEditTable && (
        <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50 p-4">
          <div className="bg-white border-4 border-black p-6 rounded-3xl w-full max-w-4xl max-h-[80vh] overflow-auto shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-xl font-black mb-4 text-center">Édition du tableau</h2>

            <div className="mb-4 flex gap-4 items-center">
              <label className="bg-[#99c199] text-black px-4 py-2 border-2 border-black rounded-xl font-bold shadow-md cursor-pointer">
                Remplacer par un fichier
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFileChange} />
              </label>
              <div className="text-sm italic text-gray-600">Choisir un fichier Excel pour remplacer le tableau actuel</div>
            </div>

            <div className="overflow-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {(selectedSubTheme.columns || []).map(col => (
                      <th key={col} className="p-2 border border-gray-300 text-xs">{col}</th>
                    ))}
                    <th className="p-2 border border-gray-300 text-xs">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {editTableRows.map((row, ri) => (
                    <tr key={ri} className="hover:bg-gray-50">
                      {(selectedSubTheme.columns || []).map(col => (
                        <td key={col} className="p-1 border">
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
              <button onClick={() => setEditTableRows(prev => [...prev, Object.fromEntries((selectedSubTheme.columns || []).map(c => [c, '']))])} className="bg-green-400 text-white px-4 py-2 rounded">Ajouter ligne</button>
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
                  value={Array.isArray(advancedConfig.filtres_disponibles) ? advancedConfig.filtres_disponibles.join(', ') : ''}
                  onChange={e => {
                    const txt = e.target.value || '';
                    const arr = txt.split(',').map(s => s.trim()).filter(s => s !== '');
                    setAdvancedConfig({...advancedConfig, filtres_disponibles: arr});
                  }}
                  className="w-full p-2 border-2 border-black rounded outline-none"
                />
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button onClick={() => setShowAdvancedConfig(false)} className="flex-1 bg-gray-200 py-2 border-2 border-black rounded-xl font-bold">Annuler</button>
              <button onClick={async () => {
                try {
                  // update local state
                  setSubThemeMeta({...subThemeMeta, niveau_geo: advancedConfig.niveau_geo, type_unite: advancedConfig.type_unite, est_sommable: advancedConfig.est_sommable, filtres_disponibles: advancedConfig.filtres_disponibles});
                  await axios.patch(`http://127.0.0.1:8000/api/sousthemes/${selectedSubTheme.id}/`, {
                    niveau_geo: advancedConfig.niveau_geo,
                    type_unite: advancedConfig.type_unite,
                    est_sommable: advancedConfig.est_sommable,
                    filtres_disponibles: advancedConfig.filtres_disponibles
                  });
                  showToast('Configuration avancée enregistrée', 'success');
                  setShowAdvancedConfig(false);
                  // refresh themes and selected subtheme
                  const res = await axios.get(themesApiBase);
                  setThemes(res.data);
                  const freshTheme = res.data.find(t => t.id === selectedTheme?.id);
                  if (freshTheme) setSelectedTheme(freshTheme);
                  const freshSubTheme = freshTheme?.sous_themes?.find(st => st.id === selectedSubTheme.id);
                  if (freshSubTheme) setSelectedSubTheme(freshSubTheme);
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
             <div className="bg-[#4a77b4] text-white rounded-t-lg px-4 py-3">
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
               <button onClick={() => setShowSubThemeMeta(false)} className="flex-1 bg-[#4a77b4] text-white py-2 rounded-lg font-bold">Fermer</button>
               {!isVisitor && <button onClick={saveSubThemeMeta} className="flex-1 bg-[#ffb366] py-2 border-2 border-black rounded-lg font-bold">Enregistrer</button>}
             </div>
           </div>
         </div>
      )}
      {showThemeMeta && (
         <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
           <div className="bg-white border border-black p-4 rounded-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden shadow-lg">
             <div className="bg-[#4a77b4] text-white rounded-t-lg px-4 py-3">
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
               <button onClick={() => setShowThemeMeta(false)} className="flex-1 bg-[#4a77b4] text-white py-2 rounded-lg font-bold">Fermer</button>
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
                <textarea className="w-full p-2 border-2 border-black rounded min-h-[80px]" value={modalVisitorCols.join(', ')} onChange={e => {
                  const txt = e.target.value || '';
                  const arr = txt.split(',').map(s => s.trim()).filter(s => s !== '');
                  setModalVisitorCols(arr);
                }} />
                <div className="text-sm italic text-gray-600">Séparer les noms de colonnes par des virgules.</div>
              </div>

              <div>
                <label className="block font-bold mb-2">Filtres disponibles</label>
                <textarea className="w-full p-2 border-2 border-black rounded min-h-[80px]" value={modalVisitorFilters.join(', ')} onChange={e => {
                  const txt = e.target.value || '';
                  const arr = txt.split(',').map(s => s.trim()).filter(s => s !== '');
                  setModalVisitorFilters(arr);
                }} />
                <div className="text-sm italic text-gray-600">Colonnes que le visiteur peut utiliser pour filtrer.</div>
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

                  const payload = {
                    visitor_visible_columns: modalVisitorCols,
                    visitor_filters: modalVisitorFilters,
                    visitor_default_filters: parsedDefaults
                  };
                  await axios.patch(`http://127.0.0.1:8000/api/sousthemes/${configSubTheme.id}/`, payload);
                  showToast('Configuration visiteur enregistrée', 'success');
                  // fetch the updated sous-thème and update local state so the view refreshes immediately
                  try {
                    const freshRes = await axios.get(`http://127.0.0.1:8000/api/sousthemes/${configSubTheme.id}/`);
                    const freshSubTheme = freshRes.data;
                    setSelectedSubTheme(freshSubTheme);
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
                          if (st) { setSelectedSubTheme(st); break; }
                        }
                      }
                    } catch (pubErr) {
                      console.warn('Impossible de rafraîchir public-themes', pubErr);
                    }
                  } catch (refreshErr) {
                    console.error('Erreur lors du rafraîchissement du sous-thème', refreshErr);
                  }
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
              const chartData = selectedSubTheme?.data || [];
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
      {openSubActionMenu && (
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

      {openSubThemeMenu && (
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
                if (!actionModalValue) { alert('Le nom est requis'); return; }
                if (actionModalType === 'rename') { await renameTheme(actionModalThemeId, actionModalValue); }
                else if (actionModalType === 'rename_subtheme') { await renameSubTheme(actionModalThemeId, actionModalValue); }
                else if (actionModalType === 'add_categorie') { await addCategorie(actionModalThemeId, actionModalValue); }
                else { 
                  const currentTheme = themes.find(t => t.id === actionModalThemeId);
                  if (currentTheme && currentTheme.categories && currentTheme.categories.length > 0 && !actionModalCategorieId) {
                    return alert('Veuillez sélectionner une catégorie');
                  }
                  await addSubTheme(actionModalThemeId, actionModalValue, actionModalCategorieId); 
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