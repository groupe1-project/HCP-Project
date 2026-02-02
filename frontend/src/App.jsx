import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter } from 'recharts';
import LoginPage from './LoginPage';

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

function App() {
  // --- AUTHENTIFICATION (toujours appelé en premier) ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // --- ÉTATS (toujours déclarés, même s'ils ne sont pas utilisés si non authentifié) ---
  const [activeMenu, setActiveMenu] = useState('Themes');
  const [formStep, setFormStep] = useState(0); 
  const [themes, setThemes] = useState([]);
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [selectedSubTheme, setSelectedSubTheme] = useState(null);
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
  const [showEditTable, setShowEditTable] = useState(false);
  const [editTableRows, setEditTableRows] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [columnFilters, setColumnFilters] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savedCharts, setSavedCharts] = useState([]);
  const [currentChartConfig, setCurrentChartConfig] = useState({ id: null, type: 'Histogramme', x: '', y: '', mesure: '' });
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ email: '', newPassword: '', confirmPassword: '' });
  const [searchTheme, setSearchTheme] = useState('');
  const [searchSubTheme, setSearchSubTheme] = useState('');
  const [searchIndicateur, setSearchIndicateur] = useState('');
  const [useCategories, setUseCategories] = useState(false);
  const [categoryNames, setCategoryNames] = useState([{ nom: '', nbSousThemes: 1 }]);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [selectedCategorie, setSelectedCategorie] = useState(null);
  const [openCategorieMenu, setOpenCategorieMenu] = useState(null);
  const [categorieMenuPos, setCategorieMenuPos] = useState({ left: 0, top: 0 });

  // --- TOUS LES useEffect EN MÊME TEMPS ---
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Token ${token}`;
      setIsAuthenticated(true);
    }
    setAuthLoading(false);
  }, []);

  useEffect(() => { 
    if (isAuthenticated) fetchThemes(); 
  }, [isAuthenticated]);

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
    setSavedCharts(selectedSubTheme?.charts_config || []);
  }, [selectedSubTheme]);

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

  const openEditTable = () => {
    setEditTableRows(JSON.parse(JSON.stringify(selectedSubTheme?.data || [])));
    setShowEditTable(true);
  };

  const archiveTheme = async (id) => {
    try {
      await axios.post(`http://127.0.0.1:8000/api/themes/${id}/archive/`);
      showToast('Thème archivé', 'success');
      const res = await axios.get('http://127.0.0.1:8000/api/themes/');
      setThemes(res.data);
      if (selectedTheme && selectedTheme.id === id) setSelectedTheme(res.data.find(t => t.id === id));
    } catch (err) { console.error(err); showToast('Erreur lors de l\'archivage', 'error'); }
  };

  const unarchiveTheme = async (id) => {
    try {
      await axios.post(`http://127.0.0.1:8000/api/themes/${id}/unarchive/`);
      showToast('Thème désarchivé', 'success');
      const res = await axios.get('http://127.0.0.1:8000/api/themes/');
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
      const res = await axios.get('http://127.0.0.1:8000/api/themes/');
      setThemes(res.data);
    } catch (err) {
      console.error(err);
      showToast('Erreur lors de la suppression, restauration de la liste', 'error');
      // rollback to previous state
      setThemes(prev);
      // try refetch as fallback
      try { const res = await axios.get('http://127.0.0.1:8000/api/themes/'); setThemes(res.data); } catch(e){ console.error('Refetch failed', e); }
    }
  };

  const renameTheme = async (id, newName) => {
    try {
      await axios.patch(`http://127.0.0.1:8000/api/themes/${id}/`, { titre: newName });
      alert('Thème renommé');
      const res = await axios.get('http://127.0.0.1:8000/api/themes/');
      setThemes(res.data);
      if (selectedTheme && selectedTheme.id === id) setSelectedTheme(res.data.find(t => t.id === id));
    } catch (err) { console.error(err); alert('Erreur lors du renommage'); }
  };

  const addSubTheme = async (themeId, name, categorieId = null) => {
    try {
      const payload = { nom: name };
      if (categorieId) {
        payload.categorie = categorieId;
      }
      const res = await axios.post(`http://127.0.0.1:8000/api/themes/${themeId}/sous_themes/`, payload);
      alert('Sous-thème ajouté');
      const themesRes = await axios.get('http://127.0.0.1:8000/api/themes/');
      setThemes(themesRes.data);
      const fresh = themesRes.data.find(t => t.id === themeId);
      if (fresh) setSelectedTheme(fresh);
    } catch (err) { console.error(err); alert('Erreur lors de l\'ajout du sous-thème'); }
  };

  const addCategorie = async (themeId, name) => {
    try {
      const theme = themes.find(t => t.id === themeId);
      const ordre = theme?.categories?.length || 0;
      await axios.post('http://127.0.0.1:8000/api/categories/', { nom: name, theme: themeId, ordre });
      alert('Catégorie ajoutée');
      const themesRes = await axios.get('http://127.0.0.1:8000/api/themes/');
      setThemes(themesRes.data);
      const fresh = themesRes.data.find(t => t.id === themeId);
      if (fresh) setSelectedTheme(fresh);
    } catch (err) { console.error(err); alert('Erreur lors de l\'ajout de la catégorie'); }
  };

  const renameSubTheme = async (id, newName) => {
    try {
      await axios.patch(`http://127.0.0.1:8000/api/sousthemes/${id}/`, { nom: newName });
      alert('Sous-thème renommé');
      const res = await axios.get('http://127.0.0.1:8000/api/themes/');
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
      const res = await axios.get('http://127.0.0.1:8000/api/themes/');
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
      const res = await axios.get('http://127.0.0.1:8000/api/themes/');
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
      const res = await axios.get('http://127.0.0.1:8000/api/themes/');
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
      try { const res = await axios.get('http://127.0.0.1:8000/api/themes/'); setThemes(res.data); } catch(e){ console.error('Refetch failed', e); }
    }
  };  

  const toggleThemePublication = async (themeId, newVisibility) => {
    try {
      // Change theme visibility
      await axios.patch(`http://127.0.0.1:8000/api/themes/${themeId}/`, { is_visible: newVisibility });
      
      // Cascade: update all sous-themes of this theme
      const theme = themes.find(t => t.id === themeId);
      if (theme && theme.sous_themes) {
        for (const subTheme of theme.sous_themes) {
          await axios.patch(`http://127.0.0.1:8000/api/sousthemes/${subTheme.id}/`, { is_visible: newVisibility });
        }
      }
      
      // Refresh themes and update selectedTheme
      const themesRes = await axios.get('http://127.0.0.1:8000/api/themes/');
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
      const res = await axios.get('http://127.0.0.1:8000/api/themes/');
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
      await axios.post(`http://127.0.0.1:8000/api/sousthemes/${selectedSubTheme.id}/import/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      alert('Import réussi');
      // refresh
      const themesRes = await axios.get('http://127.0.0.1:8000/api/themes/');
      setThemes(themesRes.data);
      const freshTheme = themesRes.data.find(t => t.id === selectedTheme?.id);
      if (freshTheme) setSelectedTheme(freshTheme);
      const freshSub = freshTheme?.sous_themes?.find(st => st.id === selectedSubTheme.id);
      if (freshSub) {
        setSelectedSubTheme(freshSub);
        if (showEditTable) setEditTableRows(JSON.parse(JSON.stringify(freshSub.data || [])));
      }
    } catch (err) { console.error(err); alert('Erreur lors de l\'import'); }
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
      const res = await axios.get('http://127.0.0.1:8000/api/themes/');
      setThemes(res.data);
    } catch (err) {
      // Affiche la réponse du serveur si disponible pour aider le debug
      console.error("Erreur thèmes", err.response?.data ?? err.message ?? err);
    }
  };

  // Logique de filtrage du tableau
  const filteredData = selectedSubTheme?.data?.filter(row => {
    return Object.keys(columnFilters).every(key => 
      String(row[key] || '').toLowerCase().includes(columnFilters[key].toLowerCase())
    );
  }) || [];

  // Gestion des graphiques
  const handleAddOrUpdateChart = async () => {
    // For Pie charts we still require X and Y (Y aggregated)
    if (!currentChartConfig.x || (!currentChartConfig.y && currentChartConfig.type !== 'Secteur')) return alert("Veuillez choisir les axes X et Y");

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
        chart.y === currentChartConfig.y
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
        });
        const created = res.data;
        setSavedCharts(prev => [...prev, created]);
      }

      // Refresh selected subtheme in state (so charts_config matches)
      const themesRes = await axios.get('http://127.0.0.1:8000/api/themes/');
      const freshTheme = themesRes.data.find(t => t.id === selectedTheme.id);
      const freshSubTheme = freshTheme.sous_themes.find(sub => sub.id === selectedSubTheme.id);
      setSelectedSubTheme(freshSubTheme);
      setSavedCharts(freshSubTheme.charts_config || []);

      setIsModalOpen(false);
      setCurrentChartConfig({ id: null, type: 'Histogramme', x: '', y: '', mesure: '' });
    } catch (err) {
      console.error('Erreur en sauvegarde du graphique', err);
      alert('Erreur lors de la sauvegarde du graphique');
    }
  };

  const openEditModal = (chart) => {
    setCurrentChartConfig(chart);
    setIsModalOpen(true);
  };

  const deleteChart = async (id) => {
    if (!confirm('Supprimer ce graphique ?')) return;
    try {
      await axios.delete(`http://127.0.0.1:8000/api/sousthemes/${selectedSubTheme.id}/charts/${id}/`);
      setSavedCharts(prev => prev.filter(c => c.id !== id));
      // refresh subtheme
      const themesRes = await axios.get('http://127.0.0.1:8000/api/themes/');
      const freshTheme = themesRes.data.find(t => t.id === selectedTheme.id);
      const freshSubTheme = freshTheme.sous_themes.find(sub => sub.id === selectedSubTheme.id);
      setSelectedSubTheme(freshSubTheme);
    } catch (err) {
      console.error('Erreur suppression graphique', err);
      alert('Erreur lors de la suppression');
    }
  };

  // Toggle publication status for a sous-thème
  const toggleSubThemePublication = async (subThemeId, newVisibility) => {
    try {
      await axios.patch(`http://127.0.0.1:8000/api/sousthemes/${subThemeId}/`, { is_visible: newVisibility });
      // refresh themes and update selectedTheme/selectedSubTheme
      const res = await axios.get('http://127.0.0.1:8000/api/themes/');
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
    } catch (err) { alert("Erreur : " + err.message); }
  };

  const saveThemeMeta = async () => {
    if (!selectedTheme) return alert('Aucun thème sélectionné');
    try {
      await axios.patch(`http://127.0.0.1:8000/api/themes/${selectedTheme.id}/`, themeMeta);
      alert('Métadonnées sauvegardées');
      setShowThemeMeta(false);
      // refresh themes and selectedTheme
      const res = await axios.get('http://127.0.0.1:8000/api/themes/');
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
      const res = await axios.get('http://127.0.0.1:8000/api/themes/');
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

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLogin} />;
  }

  // --- RENDU PRINCIPAL (Admin) ---
  return (
    <div className="flex min-h-screen bg-[#f4f1e1] font-sans">
      
      {/* 1. MENU LATÉRAL */}
      <div className="w-64 bg-white border-r-2 border-black flex flex-col">
        <div className="p-4 border-b-2 border-black flex flex-col items-center">
          <img src="src/photos.png" alt="Logo HCP" className="w-24 mb-2" />
        </div>
        <div className="bg-[#1a5d85] text-white py-2 px-4 font-bold text-center border-b border-black">Menu</div>
        <SidebarButton label="Thèmes" active={activeMenu === 'Themes'} onClick={() => {setActiveMenu('Themes'); setFormStep(0);}} />
        <SidebarButton label="Indicateurs" active={activeMenu === 'Indicateurs'} onClick={() => setActiveMenu('Indicateurs')} />
        <SidebarButton label="Espace admin" active={activeMenu === 'Admin'} onClick={() => setActiveMenu('Admin')} />
        <div className="mt-auto p-4 border-t-2 border-black bg-white space-y-2">
          <button onClick={() => { setSettingsForm({ email: localStorage.getItem('user_email') || '', newPassword: '', confirmPassword: '' }); setShowSettings(true); }} className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-3 rounded border-2 border-black shadow-md flex items-center justify-center gap-2">
            ⚙️ Paramètres
          </button>
          <button onClick={handleLogout} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-3 rounded border-2 border-black shadow-md">
            Déconnexion
          </button>
        </div>
      </div>

      {/* 2. CONTENU PRINCIPAL */}
      <div className="flex-1 flex flex-col">
        <div className="bg-[#a2e3f7] p-4 border-b-2 border-black flex justify-center shadow-md relative">
          <h1 className="text-[#1a5d85] text-xl font-bold italic text-center">
            Base de Données Région Béni Mellal-Khénifra قاعدة البيانات الاحصائية لجهة بني ملال خنيفرة
          </h1>
          {isAdminView && (
            <div className="absolute right-6 top-3 bg-yellow-300 text-black px-3 py-1 rounded-full font-bold border-2 border-black">Espace administrateur</div>
          )}
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
                        const res = await axios.get('http://127.0.0.1:8000/api/themes/');
                        const freshTheme = res.data.find(t => t.id === st.theme_id);
                        const freshSubTheme = freshTheme.sous_themes.find(sub => sub.id === st.id);
                        setSelectedTheme(freshTheme);
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
                    <div className="text-sm opacity-75 mb-2">{st.theme_titre}</div>
                    <div className="text-lg">{st.nom}</div>
                    <div className={`absolute bottom-3 right-3 w-5 h-5 rounded-full border border-black ${st.is_visible ? 'bg-green-400' : 'bg-red-500'}`}></div>
                  </div>
                ))}
              </div>
            </div>
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
                            const spaceBelow = window.innerHeight - rect.bottom;
                            const top = spaceBelow > menuHeight ? rect.bottom + 8 : rect.top - menuHeight - 8;
                            setCategorieMenuPos({ left: rect.left, top });
                            setOpenCategorieMenu(openCategorieMenu === t.id ? null : t.id);
                          }}
                          className="bg-white text-black px-3 py-1 rounded-lg border-2 border-black hover:bg-gray-100 text-xl font-bold"
                        >
                          ▼
                        </button>
                      )}
                    </div>
                    <div className="flex mt-4 gap-2">
                      <button onClick={(e) => { 
                        e.stopPropagation(); 
                        const rect = e.currentTarget.getBoundingClientRect(); 
                        const menuHeight = 200; // hauteur estimée du menu
                        const spaceBelow = window.innerHeight - rect.bottom;
                        const top = spaceBelow > menuHeight ? rect.bottom + 8 : rect.top - menuHeight - 8;
                        setActionMenuPos({ left: rect.left, top }); 
                        setOpenActionMenu(openActionMenu === t.id ? null : t.id); 
                        setOpenThemeMenu(null); 
                      }} className="bg-[#99c199] p-1 border border-black rounded shadow">📝</button>

                      <div>
                        <button onClick={(e) => { 
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            const menuHeight = 150;
                            const spaceBelow = window.innerHeight - rect.bottom;
                            const top = spaceBelow > menuHeight ? rect.bottom + 8 : rect.top - menuHeight - 8;
                            setThemeMenuPos({ left: rect.left, top });
                            setOpenThemeMenu(openThemeMenu === t.id ? null : t.id);
                          }} className="bg-[#f0a38e] p-1 border border-black rounded shadow">📂</button>
                      </div>
                    </div>
                    <div className={`absolute bottom-3 right-3 w-5 h-5 rounded-full border border-black ${t.is_visible ? 'bg-green-400' : 'bg-red-500'}`}></div>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => setFormStep(1)}
                className="fixed bottom-10 right-10 bg-[#ffb366] hover:bg-[#ffa347] text-white font-bold py-4 px-8 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              >
                Ajouter un thème
              </button>

              {/* Floating theme menu (renders at viewport level to avoid being clipped) */}
              {openThemeMenu && (
                <div onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', left: themeMenuPos.left, top: themeMenuPos.top, zIndex: 9999 }}>
                  <div className="w-52 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
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
                    <button onClick={(e) => { e.stopPropagation(); showConfirm('Supprimer ce thème ?', async () => { await deleteTheme(openThemeMenu); setOpenThemeMenu(null); }); }} className="w-full text-left px-4 py-2 bg-white text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 6h18" stroke="#B91C1C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 6v12a1 1 0 001 1h6a1 1 0 001-1V6" stroke="#B91C1C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 11v6M14 11v6" stroke="#B91C1C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Supprimer le thème
                    </button>
                  </div>
                </div>
              )}

              {openCategorieMenu && (
                <div onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', left: categorieMenuPos.left, top: categorieMenuPos.top, zIndex: 9999 }} key={`cat-menu-${openCategorieMenu}-${themes.find(x => x.id === openCategorieMenu)?.categories?.length || 0}`}>
                  <div className="w-64 bg-white rounded-lg shadow-2xl border-2 border-black overflow-hidden">
                    <div className="px-4 py-3 border-b-2 border-black text-sm font-bold text-gray-800 bg-gray-100">Choisir une catégorie</div>
                    {(() => {
                      const currentTheme = themes.find(x => x.id === openCategorieMenu);
                      if (!currentTheme || !currentTheme.categories) return null;
                      return currentTheme.categories.sort((a, b) => a.ordre - b.ordre).map(cat => (
                        <button 
                          key={cat.id}
                          onClick={(e) => { 
                            e.stopPropagation();
                            setSelectedTheme(currentTheme);
                            setSelectedCategorie(cat);
                            setOpenCategorieMenu(null);
                            setFormStep(3);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-200 flex items-center gap-2"
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
                      ));
                    })()}
                  </div>
                </div>
              )}

              {openActionMenu && (
                <div onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', left: actionMenuPos.left, top: actionMenuPos.top, zIndex: 9999 }}>
                  <div className="w-56 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
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
          {formStep === 1 && (
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

          {formStep === 2 && (
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
          {formStep === 3 && selectedTheme && (
            <div className="space-y-8">
              <div className="flex justify-between items-center gap-4">
                <button onClick={() => { setFormStep(0); setSelectedCategorie(null); }} className="bg-white px-4 py-2 border-2 border-black rounded-xl font-bold hover:bg-gray-100 shadow-md">⬅ Retour</button>
                <div className="flex items-center gap-3 flex-1 justify-center">
                  <h2 className="bg-[#c2d9ff] px-6 py-2 rounded-xl border-2 border-black font-bold shadow-md">
                    {selectedCategorie ? `${selectedTheme.titre} - ${selectedCategorie.nom}` : `Titre du thème : ${selectedTheme.titre}`}
                  </h2>
                  <div className="flex items-center gap-2">
                    <div className={`w-5 h-5 rounded-full border border-black ${selectedTheme.is_visible ? 'bg-green-400' : 'bg-red-500'}`}></div>
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
                  </div>
                </div>
                <button onClick={() => { setThemeMeta({ definition_text: selectedTheme.definition_text || '', unite_text: selectedTheme.unite_text || '', indication_text: selectedTheme.indication_text || '', source_text: selectedTheme.source_text || '', periodicite_text: selectedTheme.periodicite_text || '', couverture_text: selectedTheme.couverture_text || '' }); setShowThemeMeta(true); }} className="bg-white px-6 py-2 rounded-xl border-2 border-black font-bold shadow-md hover:bg-gray-100">Métadonnées</button>
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
                          const res = await axios.get('http://127.0.0.1:8000/api/themes/');
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
                      <div className="flex justify-center gap-2 mt-4 text-black">
                        <button onClick={(e) => { 
                          e.stopPropagation(); 
                          const rect = e.currentTarget.getBoundingClientRect(); 
                          const menuHeight = 200;
                          const spaceBelow = window.innerHeight - rect.bottom;
                          const top = spaceBelow > menuHeight ? rect.bottom + 8 : rect.top - menuHeight - 8;
                          setSubActionMenuPos({ left: rect.left, top }); 
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
                          const spaceBelow = window.innerHeight - rect.bottom;
                          const top = spaceBelow > menuHeight ? rect.bottom + 8 : rect.top - menuHeight - 8;
                          setSubThemeMenuPos({ left: rect.left, top }); 
                          setOpenSubThemeMenu(openSubThemeMenu === st.id ? null : st.id); 
                          setOpenSubActionMenu(null); 
                          setOpenActionMenu(null); 
                          setOpenThemeMenu(null);
                          setOpenCategorieMenu(null); 
                        }} className="bg-[#f0a38e] p-1 border border-black rounded shadow">📂</button>
                      </div> 
                      <div className={`absolute bottom-3 right-3 w-5 h-5 rounded-full border border-black ${st.is_visible ? 'bg-green-400' : 'bg-red-500'}`}></div>
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
                          className="bg-[#6d92c7] px-6 py-3 cursor-pointer hover:bg-[#5a81b5] transition-colors flex justify-between items-center"
                          onClick={() => setExpandedCategories(prev => ({...prev, [cat.id]: !prev[cat.id]}))}
                        >
                          <h3 className="font-bold text-white text-lg">{cat.nom}</h3>
                          <span className="text-white font-bold text-xl">
                            {expandedCategories[cat.id] ? '▼' : '▶'}
                          </span>
                        </div>
                        
                        {expandedCategories[cat.id] && (
                          <div className="p-4 grid grid-cols-4 gap-6">
                            {filteredSousThemes.map((st, i) => (
                              <div 
                                key={st.id || i} 
                                onClick={async () => { 
                                  try {
                                    const res = await axios.get('http://127.0.0.1:8000/api/themes/');
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
                                <div className="flex justify-center gap-2 mt-4 text-black">
                                  <button onClick={(e) => { 
                                    e.stopPropagation(); 
                                    const rect = e.currentTarget.getBoundingClientRect(); 
                                    const menuHeight = 200;
                                    const spaceBelow = window.innerHeight - rect.bottom;
                                    const top = spaceBelow > menuHeight ? rect.bottom + 8 : rect.top - menuHeight - 8;
                                    setSubActionMenuPos({ left: rect.left, top }); 
                                    setOpenSubActionMenu(openSubActionMenu === st.id ? null : st.id); 
                                    setOpenActionMenu(null); 
                                    setOpenThemeMenu(null); 
                                  }} className="bg-[#99c199] p-1 border border-black rounded shadow">📝</button>
                                  <button onClick={(e) => { 
                                    e.stopPropagation(); 
                                    const rect = e.currentTarget.getBoundingClientRect(); 
                                    const menuHeight = 150;
                                    const spaceBelow = window.innerHeight - rect.bottom;
                                    const top = spaceBelow > menuHeight ? rect.bottom + 8 : rect.top - menuHeight - 8;
                                    setSubThemeMenuPos({ left: rect.left, top }); 
                                    setOpenSubThemeMenu(openSubThemeMenu === st.id ? null : st.id); 
                                    setOpenSubActionMenu(null); 
                                    setOpenActionMenu(null); 
                                    setOpenThemeMenu(null); 
                                  }} className="bg-[#f0a38e] p-1 border border-black rounded shadow">📂</button>
                                </div> 
                                <div className={`absolute bottom-3 right-3 w-5 h-5 rounded-full border border-black ${st.is_visible ? 'bg-green-400' : 'bg-red-500'}`}></div>
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
                          const res = await axios.get('http://127.0.0.1:8000/api/themes/');
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
                      <div className="flex justify-center gap-2 mt-4 text-black">
                        <button onClick={(e) => { 
                          e.stopPropagation(); 
                          const rect = e.currentTarget.getBoundingClientRect(); 
                          const menuHeight = 200;
                          const spaceBelow = window.innerHeight - rect.bottom;
                          const top = spaceBelow > menuHeight ? rect.bottom + 8 : rect.top - menuHeight - 8;
                          setSubActionMenuPos({ left: rect.left, top }); 
                          setOpenSubActionMenu(openSubActionMenu === st.id ? null : st.id); 
                          setOpenActionMenu(null); 
                          setOpenThemeMenu(null); 
                        }} className="bg-[#99c199] p-1 border border-black rounded shadow">📝</button>
                        <button onClick={(e) => { 
                          e.stopPropagation(); 
                          const rect = e.currentTarget.getBoundingClientRect(); 
                          const menuHeight = 150;
                          const spaceBelow = window.innerHeight - rect.bottom;
                          const top = spaceBelow > menuHeight ? rect.bottom + 8 : rect.top - menuHeight - 8;
                          setSubThemeMenuPos({ left: rect.left, top }); 
                          setOpenSubThemeMenu(openSubThemeMenu === st.id ? null : st.id); 
                          setOpenSubActionMenu(null); 
                          setOpenActionMenu(null); 
                          setOpenThemeMenu(null); 
                        }} className="bg-[#f0a38e] p-1 border border-black rounded shadow">📂</button>
                      </div> 
                      <div className={`absolute bottom-3 right-3 w-5 h-5 rounded-full border border-black ${st.is_visible ? 'bg-green-400' : 'bg-red-500'}`}></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ÉTAPE 4 : DÉTAILS SOUS-THÈME DÉVELOPPÉ */}
          {formStep === 4 && selectedSubTheme && (
            <div className="bg-white border-2 border-black p-6 rounded-xl shadow-2xl space-y-6">
              
              <div className="flex justify-between items-start">
                <h3 className="bg-[#c2d9ff] px-6 py-2 border-2 border-black rounded-xl font-bold text-lg shadow-sm">
                  Sous thème : {selectedSubTheme.nom}
                </h3>
                <div className="flex items-center gap-3">
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
                    <option value="Public">Public 📢</option>
                    <option value="Privé">Privé 🔒</option>
                  </select>
                  <button onClick={() => { setSubThemeMeta({ definition_text: selectedSubTheme.definition_text || '', unite_text: selectedSubTheme.unite_text || '', indication_text: selectedSubTheme.indication_text || '', source_text: selectedSubTheme.source_text || '', periodicite_text: selectedSubTheme.periodicite_text || '', couverture_text: selectedSubTheme.couverture_text || '' }); setShowSubThemeMeta(true); }} className="bg-white px-6 py-2 rounded-xl border-2 border-black font-bold shadow-md hover:bg-gray-100">Métadonnées</button>
                  <button onClick={() => setFormStep(3)} className="bg-orange-400 text-white px-4 py-1 border-2 border-black rounded-lg font-bold shadow-md">Fermer</button>
                </div>
              </div>

              {/* TABLEAU AVEC FILTRES PAR COLONNE */}
              <div className="space-y-4">
                <div className="border-2 border-black rounded-lg overflow-auto max-h-80 bg-white shadow-inner">
                  <table className="w-full text-center border-collapse">
                    <thead className="bg-gray-100 border-b-2 border-black font-bold sticky top-0 z-10">
                      <tr>
                        {selectedSubTheme.columns?.map(col => (
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
                      {(showAll ? filteredData : filteredData.slice(0, 3)).map((row, i) => (
                        <tr key={i} className="border-b border-gray-300 h-10 hover:bg-gray-50">
                          {selectedSubTheme.columns?.map(col => (
                            <td key={col} className="border-r border-gray-300 p-2 text-xs">{row[col]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-4 items-center">
                  <button onClick={() => setShowAll(!showAll)} className="bg-[#8ec278] text-white px-6 py-2 border-2 border-black rounded-xl font-bold shadow-md">
                    {showAll ? "Réduire le tableau" : "Afficher tout le tableau"}
                  </button>

                  <button onClick={openEditTable} className="bg-[#ffd56b] text-black px-4 py-2 border-2 border-black rounded-xl font-bold shadow-md">Modifier le tableau</button>

                  <button onClick={exportTableCSV} className="bg-[#62a3ff] text-white px-4 py-2 border-2 border-black rounded-xl font-bold shadow-md">Exporter le tableau</button>
                </div>
              </div>

              {/* ZONE DES GRAPHIQUES GÉNÉRÉS */}
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  {savedCharts.map((chart) => (
                    <div key={chart.id} className="border-4 border-orange-400 p-6 rounded-2xl bg-white shadow-lg relative">
                      <div className="absolute top-4 right-4 flex gap-2">
                        <button onClick={() => openEditModal(chart)} className="bg-blue-500 text-white px-3 py-1 rounded border border-black text-xs font-bold shadow">Modifier</button>
                        <button onClick={() => deleteChart(chart.id)} className="bg-red-500 text-white px-3 py-1 rounded border border-black text-xs font-bold shadow">Supprimer</button>
                      </div>
                      
                      <div className="h-64 w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                          {chart.type === 'Histogramme' ? (
                            <BarChart data={selectedSubTheme.data}>
                              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey={chart.x} /><YAxis /><Tooltip /><Bar dataKey={chart.y} fill="#4a77b4" />
                            </BarChart>
                          ) : chart.type === 'Courbes' ? (
                            <LineChart data={selectedSubTheme.data}>
                              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey={chart.x} /><YAxis /><Tooltip /><Line type="monotone" dataKey={chart.y} stroke="#4a77b4" strokeWidth={3} />
                            </LineChart>
                          ) : chart.type === 'Nuage de points' ? (
                            <ScatterChart>
                              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey={chart.x} /><YAxis dataKey={chart.y} /><Tooltip />
                              <Scatter data={selectedSubTheme.data} fill="#4a77b4" />
                            </ScatterChart>
                          ) : chart.type === 'Secteur' ? (
                            (() => {
                              const map = {};
                              (selectedSubTheme.data || []).forEach(r => {
                                const key = r[chart.x] ?? 'N/A';
                                const val = parseFloat(r[chart.y]) || 0;
                                map[key] = (map[key] || 0) + val;
                              });
                              const pieData = Object.keys(map).map(k => ({ name: k, value: map[k] }));
                              const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#B19CD9', '#FF6F91'];
                              return (
                                <PieChart>
                                  <Pie dataKey="value" data={pieData} nameKey="name" outerRadius={80} fill="#8884d8">
                                    {pieData.map((entry, idx) => <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />)}
                                  </Pie>
                                  <Tooltip />
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
                  ))}
                </div>

                {/* BOUTON DÉCLENCHEUR POP-UP */}
                <button 
                  onClick={() => {
                    setCurrentChartConfig({ id: null, type: 'Histogramme', x: '', y: '', mesure: '' });
                    setIsModalOpen(true);
                  }}
                  className="w-full py-6 border-4 border-dashed border-orange-300 rounded-2xl text-orange-400 font-black text-2xl hover:bg-orange-50 transition-all"
                >
                  + Ajouter un Graphique
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* POP-UP MODALE : CONFIGURATION GRAPHIQUE */}
      {isModalOpen && (
        
     <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50 p-4">
          <div className="bg-[#fef9f2] border-4 border-black p-8 rounded-3xl w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-xl font-black mb-6 text-center uppercase">Paramètres du Graphique</h2>
            
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
                <label className="block font-bold mb-1">Ajouter une mesure / note :</label>
                <textarea 
                  className="w-full p-2 border-2 border-black rounded-lg h-20 outline-none"
                  value={currentChartConfig.mesure}
                  onChange={e => setCurrentChartConfig({...currentChartConfig, mesure: e.target.value})}
                  placeholder="Expliquez ce graphique..."
                />
              </div>
            </div>

            <div className="flex gap-4 mt-8">
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

      {showSubThemeMeta && (
         <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50 p-4">
           <div className="bg-white border-4 border-black p-6 rounded-3xl w-full max-w-2xl max-h-[70vh] overflow-y-auto shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
             <h2 className="text-xl font-black mb-4 text-center">Métadonnées du sous-thème</h2>
             <div className="grid grid-cols-1 gap-4">
               <textarea placeholder="Définition" className="p-2 border-2 border-black rounded h-32" value={subThemeMeta.definition_text} onChange={e => setSubThemeMeta({...subThemeMeta, definition_text: e.target.value})} />
               <div className="flex gap-4">
                 <textarea placeholder="Unité" className="flex-1 p-2 border-2 border-black rounded h-20" value={subThemeMeta.unite_text} onChange={e => setSubThemeMeta({...subThemeMeta, unite_text: e.target.value})} />
                 <textarea placeholder="Périodicité" className="flex-1 p-2 border-2 border-black rounded h-20" value={subThemeMeta.periodicite_text} onChange={e => setSubThemeMeta({...subThemeMeta, periodicite_text: e.target.value})} />
               </div>
               <textarea placeholder="Indication" className="p-2 border-2 border-black rounded h-20" value={subThemeMeta.indication_text} onChange={e => setSubThemeMeta({...subThemeMeta, indication_text: e.target.value})} />
               <div className="flex gap-4">
                 <textarea placeholder="Source" className="flex-1 p-2 border-2 border-black rounded h-20" value={subThemeMeta.source_text} onChange={e => setSubThemeMeta({...subThemeMeta, source_text: e.target.value})} />
                 <textarea placeholder="Couverture" className="flex-1 p-2 border-2 border-black rounded h-20" value={subThemeMeta.couverture_text} onChange={e => setSubThemeMeta({...subThemeMeta, couverture_text: e.target.value})} />
               </div>
             </div>
             <div className="flex gap-4 mt-6">
               <button onClick={() => setShowSubThemeMeta(false)} className="flex-1 bg-gray-200 py-2 border-2 border-black rounded-xl font-bold">Annuler</button>
               <button onClick={saveSubThemeMeta} className="flex-1 bg-[#ffb366] py-2 border-2 border-black rounded-xl font-bold shadow-md">Enregistrer</button>
             </div>
           </div>
         </div>
      )}

      {showThemeMeta && (
         <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50 p-4">
           <div className="bg-white border-4 border-black p-6 rounded-3xl w-full max-w-2xl max-h-[70vh] overflow-y-auto shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
             <h2 className="text-xl font-black mb-4 text-center">Métadonnées du thème</h2>
             <div className="grid grid-cols-1 gap-4">
               <textarea placeholder="Définition" className="p-2 border-2 border-black rounded h-32" value={themeMeta.definition_text} onChange={e => setThemeMeta({...themeMeta, definition_text: e.target.value})} />
               <div className="flex gap-4">
                 <textarea placeholder="Unité" className="flex-1 p-2 border-2 border-black rounded h-20" value={themeMeta.unite_text} onChange={e => setThemeMeta({...themeMeta, unite_text: e.target.value})} />
                 <textarea placeholder="Périodicité" className="flex-1 p-2 border-2 border-black rounded h-20" value={themeMeta.periodicite_text} onChange={e => setThemeMeta({...themeMeta, periodicite_text: e.target.value})} />
               </div>
               <textarea placeholder="Indication" className="p-2 border-2 border-black rounded h-20" value={themeMeta.indication_text} onChange={e => setThemeMeta({...themeMeta, indication_text: e.target.value})} />
               <div className="flex gap-4">
                 <textarea placeholder="Source" className="flex-1 p-2 border-2 border-black rounded h-20" value={themeMeta.source_text} onChange={e => setThemeMeta({...themeMeta, source_text: e.target.value})} />
                 <textarea placeholder="Couverture" className="flex-1 p-2 border-2 border-black rounded h-20" value={themeMeta.couverture_text} onChange={e => setThemeMeta({...themeMeta, couverture_text: e.target.value})} />
               </div>
             </div>
             <div className="flex gap-4 mt-6">
               <button onClick={() => setShowThemeMeta(false)} className="flex-1 bg-gray-200 py-2 border-2 border-black rounded-xl font-bold">Annuler</button>
               <button onClick={saveThemeMeta} className="flex-1 bg-[#ffb366] py-2 border-2 border-black rounded-xl font-bold shadow-md">Enregistrer</button>
             </div>
           </div>
         </div>
      )}

      {/* Modal for renaming / adding sub-theme */}
      {openSubActionMenu && (
        <div onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', left: subActionMenuPos.left, top: subActionMenuPos.top, zIndex: 9999 }}>
          <div className="w-48 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
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
          <div className="w-48 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
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