import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter } from 'recharts';

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
  // --- ÉTATS ---
  const [activeMenu, setActiveMenu] = useState('Themes');
  const [formStep, setFormStep] = useState(0); 
  const [themes, setThemes] = useState([]);
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [selectedSubTheme, setSelectedSubTheme] = useState(null);
  const [themeData, setThemeData] = useState({ titre: '', nbSousThemes: 1, statut: 'Public' });
  const [rows, setRows] = useState([]);

  // Métadonnées du Thème (UI)
  const [showThemeMeta, setShowThemeMeta] = useState(false);
  const [themeMeta, setThemeMeta] = useState({ definition_text: '', unite_text: '', indication_text: '', source_text: '', periodicite_text: '', couverture_text: '' });

  // Métadonnées du Sous-thème (UI)
  const [showSubThemeMeta, setShowSubThemeMeta] = useState(false);
  const [subThemeMeta, setSubThemeMeta] = useState({ definition_text: '', unite_text: '', indication_text: '', source_text: '', periodicite_text: '', couverture_text: '' });

  // Edition / import du tableau du sous-thème
  const [showEditTable, setShowEditTable] = useState(false);
  const [editTableRows, setEditTableRows] = useState([]);

  const openEditTable = () => {
    setEditTableRows(JSON.parse(JSON.stringify(selectedSubTheme?.data || [])));
    setShowEditTable(true);
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

  // États pour le Tableau & Filtres
  const [showAll, setShowAll] = useState(false);
  const [columnFilters, setColumnFilters] = useState({});

  // États pour les Graphiques (Pop-up & Gestion)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savedCharts, setSavedCharts] = useState([]); 
  const [currentChartConfig, setCurrentChartConfig] = useState({ id: null, type: 'Histogramme', x: '', y: '', mesure: '' });

  useEffect(() => { fetchThemes(); }, []);

  // Sync savedCharts when selectedSubTheme changes
  useEffect(() => {
    setSavedCharts(selectedSubTheme?.charts_config || []);
  }, [selectedSubTheme]);

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
      }
    } catch (err) {
      console.error('Erreur changement statut sous-theme', err);
      alert('Erreur lors du changement de statut');
    }
  };

  const goToTable = () => {
    const initialRows = Array.from({ length: themeData.nbSousThemes }, () => ({
      sousTheme: '', unite: '', definition: '', indicateur: '', source: '', periodicite: '', file: null
    }));
    setRows(initialRows);
    setFormStep(2);
  };

  const handleFinalSubmit = async () => {
    const formData = new FormData();
    formData.append('titre', themeData.titre);
    formData.append('statut', themeData.statut);
    rows.forEach((row, i) => {
      formData.append(`lignes[${i}][sousTheme]`, row.sousTheme);
      formData.append(`lignes[${i}][unite]`, row.unite);
      formData.append(`lignes[${i}][indicateur]`, row.indicateur);
      formData.append(`lignes[${i}][definition]`, row.definition);
      formData.append(`lignes[${i}][source]`, row.source);
      formData.append(`lignes[${i}][periodicite]`, row.periodicite);
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
        <div className="mt-auto p-4 border-t border-black bg-white flex items-center font-bold italic">⚙️ Paramètres</div>
      </div>

      {/* 2. CONTENU PRINCIPAL */}
      <div className="flex-1 flex flex-col">
        <div className="bg-[#a2e3f7] p-4 border-b-2 border-black flex justify-center shadow-md">
          <h1 className="text-[#1a5d85] text-xl font-bold italic text-center">
            Base de Données Région Béni Mellal-Khénifra قاعدة البيانات الاحصائية لجهة بني ملال خنيفرة
          </h1>
        </div>

        <div className="p-6 flex justify-center">
          <div className="relative w-1/2">
            <input type="text" placeholder="Barre de recherche" className="w-full p-2 border-2 border-black rounded shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white italic outline-none" />
            <span className="absolute right-3 top-2">🔍</span>
          </div>
        </div>

        <div className="px-8 pb-10 flex-1">
          
          {/* ÉTAPE 0 : GRILLE DES THÈMES */}
          {activeMenu === 'Themes' && formStep === 0 && (
            <div className="relative min-h-[400px]">
              <div className="grid grid-cols-3 gap-6">
                {themes.map((t, i) => (
                  <div 
                    key={t.id} 
                    onClick={() => { setSelectedTheme(t); setFormStep(3); }}
                    className={`cursor-pointer p-5 rounded-xl border-2 border-black shadow-lg relative text-white font-bold transition-transform hover:scale-105 ${t.id === maxId ? 'bg-[#ffb366]' : 'bg-[#41699d]'}`}
                  >
                    Thème {i + 1} : {t.titre}
                    <div className="flex mt-4 gap-2">
                      <button className="bg-[#99c199] p-1 border border-black rounded shadow">📝</button>
                      <button className="bg-[#f0a38e] p-1 border border-black rounded shadow">📂</button>
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
                 <label className="text-xl w-64 font-bold">Nombre des Sous-thèmes*</label>
                 <input type="number" min="1" className="w-32 border-2 border-blue-300 rounded-md p-2 text-lg outline-none"
                   value={themeData.nbSousThemes} onChange={e => setThemeData({...themeData, nbSousThemes: parseInt(e.target.value)})} />
               </div>
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
             <div className="bg-white border-2 border-black rounded-lg shadow-xl overflow-hidden max-w-6xl mx-auto">
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
                       <td className="border-r border-black p-1"><input type="text" className="w-full outline-none text-xs" onChange={e => {const r = [...rows]; r[i].sousTheme = e.target.value; setRows(r);}} /></td>
                       <td className="border-r border-black p-1"><input type="text" className="w-full outline-none text-xs" onChange={e => {const r = [...rows]; r[i].unite = e.target.value; setRows(r);}} /></td>
                       <td className="border-r border-black p-1"><input type="text" className="w-full outline-none text-xs" onChange={e => {const r = [...rows]; r[i].definition = e.target.value; setRows(r);}} /></td>
                       <td className="border-r border-black p-1"><input type="text" className="w-full outline-none text-xs" onChange={e => {const r = [...rows]; r[i].indicateur = e.target.value; setRows(r);}} /></td>
                       <td className="border-r border-black p-1"><input type="text" className="w-full outline-none text-xs" onChange={e => {const r = [...rows]; r[i].source = e.target.value; setRows(r);}} /></td>
                       <td className="border-r border-black p-1"><input type="text" className="w-full outline-none text-xs" onChange={e => {const r = [...rows]; r[i].periodicite = e.target.value; setRows(r);}} /></td>
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
               <div className="p-4 flex justify-between bg-gray-50">
                 <button onClick={() => setFormStep(1)} className="bg-[#ffb366] text-white px-8 py-2 rounded-lg border-2 border-black font-bold shadow-md">⬅ Précédent</button>
                 <button onClick={handleFinalSubmit} className="bg-[#ffb366] text-white px-10 py-2 rounded-lg border-2 border-black font-bold shadow-md">Enregistrer ➡</button>
               </div>
             </div>
          )}

          {/* ÉTAPE 3 : LISTE DES SOUS-THÈMES */}
          {formStep === 3 && selectedTheme && (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <button onClick={() => setFormStep(0)} className="bg-white px-4 py-2 border-2 border-black rounded-xl font-bold hover:bg-gray-100 shadow-md">⬅ Retour</button>
                <h2 className="bg-[#c2d9ff] px-6 py-2 rounded-xl border-2 border-black font-bold shadow-md text-center">Titre du thème : {selectedTheme.titre}</h2>
                <button onClick={() => { setThemeMeta({ definition_text: selectedTheme.definition_text || '', unite_text: selectedTheme.unite_text || '', indication_text: selectedTheme.indication_text || '', source_text: selectedTheme.source_text || '', periodicite_text: selectedTheme.periodicite_text || '', couverture_text: selectedTheme.couverture_text || '' }); setShowThemeMeta(true); }} className="bg-white px-6 py-2 rounded-xl border-2 border-black font-bold shadow-md hover:bg-gray-100">Métadonnées</button>
              </div>
              <div className="grid grid-cols-4 gap-6">
                {selectedTheme.sous_themes && selectedTheme.sous_themes.map((st, i) => (
                  <div 
                    key={st.id || i} 
                    onClick={async () => { 
                      try {
                        const res = await axios.get('http://127.0.0.1:8000/api/themes/');
                        const freshTheme = res.data.find(t => t.id === selectedTheme.id);
                        const freshSubTheme = freshTheme.sous_themes.find(sub => sub.id === st.id);
                        setSelectedSubTheme(freshSubTheme);                         setSavedCharts(freshSubTheme.charts_config || []);                        setFormStep(4); 
                        setShowAll(false);
                      } catch (err) { console.error(err); }
                    }}
                    className="relative cursor-pointer bg-[#4a77b4] p-6 rounded-xl border-2 border-black shadow-lg text-white font-bold text-center hover:scale-105 transition-transform"
                  >
                    {st.nom}
                    <div className="flex justify-center gap-2 mt-4 text-black">
                      <button className="bg-[#99c199] p-1 border border-black rounded shadow">📝</button>
                      <button className="bg-[#f0a38e] p-1 border border-black rounded shadow">📂</button>
                    </div>
                    <div className={`absolute bottom-3 right-3 w-5 h-5 rounded-full border border-black ${st.is_visible ? 'bg-green-400' : 'bg-red-500'}`}></div>
                  </div>
                ))}
              </div>
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
    </div>
  );
}

export default App;