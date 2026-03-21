import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

const API_BASE = 'http://127.0.0.1:8000/api';
const ADMIN_SEEN_SUBMISSIONS_KEY = 'admin_seen_submission_markers';

const AdministratorsPage = ({ isSaisisseur = false }) => {
  // État pour l'onglet actif
  const [activeTab, setActiveTab] = useState('users'); // 'users' ou 'themes'
  
  // États pour les utilisateurs/saisisseurs
  const [saisisseurs, setSaisisseurs] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState(localStorage.getItem('user_role') || '');
  const [errorMessage, setErrorMessage] = useState('');
  
  // États pour la gestion des thèmes
  const [allThemes, setAllThemes] = useState([]);
  const [expandedThemes, setExpandedThemes] = useState({});
  // États pour le formulaire d'ajout
  const [newSaisisseur, setNewSaisisseur] = useState({
    name: '',
    email: '',
    role: 'SAISISSEUR'
  });
  
  // États pour les demandes
  const [userRequests, setUserRequests] = useState([]);
  const [selectedSaisisseur, setSelectedSaisisseur] = useState(null);
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [selectedSubTheme, setSelectedSubTheme] = useState(null);
  const [themes, setThemes] = useState([]);
  const [subThemes, setSubThemes] = useState([]);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configSubTheme, setConfigSubTheme] = useState(null);
  const [modalVisitorCols, setModalVisitorCols] = useState([]);
  const [modalVisitorFilters, setModalVisitorFilters] = useState([]);
  const [modalVisitorDefaultFilters, setModalVisitorDefaultFilters] = useState({});
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState(null);
  const [previewTablePage, setPreviewTablePage] = useState(1);
  const [previewPageSize, setPreviewPageSize] = useState(-1);
  const [seenSubmissionMarkers, setSeenSubmissionMarkers] = useState(() => {
    try {
      const raw = localStorage.getItem(ADMIN_SEEN_SUBMISSIONS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  });
  const [notificationBootstrapDone, setNotificationBootstrapDone] = useState(false);
  
  // États pour les assignations multiples
  const [pendingAssignments, setPendingAssignments] = useState([]);
  const [showAssignmentQueue, setShowAssignmentQueue] = useState(false);

  // États dédiés à l'espace saisisseur
  const [myAssignments, setMyAssignments] = useState([]);
  const [myLoading, setMyLoading] = useState(false);
  const [selectedMyAssignment, setSelectedMyAssignment] = useState(null);
  const [myProgression, setMyProgression] = useState(0);
  const [myComment, setMyComment] = useState('');

  const getAdminAuthConfig = () => {
    const adminToken = localStorage.getItem('auth_token_admin');
    return adminToken ? { headers: { Authorization: `Token ${adminToken}` } } : {};
  };
  
  // Charger les utilisateurs au montage
  useEffect(() => {
    // Configure axios with the token relevant to the current page context.
    try {
      const token = isSaisisseur
        ? (localStorage.getItem('auth_token_saisisseur') || localStorage.getItem('auth_token'))
        : localStorage.getItem('auth_token_admin');
      if (token) axios.defaults.headers.common['Authorization'] = `Token ${token}`;
    } catch (e) {}

    // Pour un saisisseur, charger uniquement ses assignations
    if (isSaisisseur) {
      fetchMyAssignments();
      return;
    }

    fetchSaisisseurs();
    fetchThemes();
    fetchUserRequests();
  }, [isSaisisseur]);

  useEffect(() => {
    if (isSaisisseur) return undefined;
    const intervalId = window.setInterval(() => {
      fetchSaisisseurs();
    }, 30000);
    return () => window.clearInterval(intervalId);
  }, [isSaisisseur, notificationBootstrapDone, seenSubmissionMarkers]);

  const parseAssignmentNotes = (rawNotes) => {
    try {
      return rawNotes ? JSON.parse(rawNotes) : {};
    } catch (e) {
      return { _raw: rawNotes || '' };
    }
  };

  const normalizeSubmissionNotes = (rawNotes) => {
    let notes = parseAssignmentNotes(rawNotes);

    // Handle double-encoded JSON payloads.
    if (typeof notes === 'string') {
      try { notes = JSON.parse(notes); } catch (e) { notes = { _raw: String(notes || '') }; }
    }

    // Some legacy payloads stored data under `saisisseur_draft`.
    if (notes && typeof notes === 'object' && notes.saisisseur_draft && typeof notes.saisisseur_draft === 'object') {
      notes = { ...notes, ...notes.saisisseur_draft };
    }

    // Normalize alternative keys to the preview keys.
    if (notes && typeof notes === 'object') {
      if (!Array.isArray(notes.tables) && Array.isArray(notes.data_json)) {
        notes.tables = notes.data_json;
      }
      if (!Array.isArray(notes.tables) && Array.isArray(notes.table)) {
        notes.tables = notes.table;
      }
      if (!Array.isArray(notes.charts) && Array.isArray(notes.charts_config)) {
        notes.charts = notes.charts_config;
      }
      if (!Array.isArray(notes.columns_order) && Array.isArray(notes.columns)) {
        notes.columns_order = notes.columns;
      }
    }

    return notes && typeof notes === 'object' ? notes : {};
  };

  const persistSeenSubmissionMarkers = (nextMarkers) => {
    setSeenSubmissionMarkers(nextMarkers);
    try {
      localStorage.setItem(ADMIN_SEEN_SUBMISSIONS_KEY, JSON.stringify(nextMarkers));
    } catch (_) {}
  };

  const getAssignmentSubmissionMeta = (assignment) => {
    const notes = normalizeSubmissionNotes(assignment?.notes);
    const history = Array.isArray(notes.workflow_history) ? notes.workflow_history.slice().reverse() : [];
    const lastSubmitEvent = history.find((entry) => entry && entry.action === 'submit');
    const comment = String(notes.last_submit_comment || lastSubmitEvent?.message || '').trim();
    const submittedAt = String(lastSubmitEvent?.at || assignment?.date_modification || '').trim();
    const marker = assignment?.statut === 'En attente'
      ? `${assignment.id}:${submittedAt || comment || 'pending'}`
      : null;
    return { comment, submittedAt, marker };
  };

  const playAdminNotificationSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.001, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.08, audioCtx.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.28);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.3);
      oscillator.onended = () => {
        if (typeof audioCtx.close === 'function') audioCtx.close().catch(() => {});
      };
    } catch (_) {}
  };

  const markSubmissionAsSeen = (assignment) => {
    const { marker } = getAssignmentSubmissionMeta(assignment);
    if (!marker) return;
    persistSeenSubmissionMarkers({ ...seenSubmissionMarkers, [String(assignment.id)]: marker });
  };

  const PREVIEW_PAGE_SIZE = 12;
  const PREVIEW_CHART_COLORS = ['#7A0A4A', '#B03372', '#C95A9A', '#8C4F6A', '#D485B2', '#5E0738'];

  const parseNumber = (value) => {
    const normalized = String(value ?? '').replace(/\s/g, '').replace(',', '.');
    const num = Number(normalized);
    return Number.isFinite(num) ? num : null;
  };

  const applyChartFilters = (rows, chart) => {
    let filtered = Array.isArray(rows) ? rows.slice() : [];

    if (chart?.filter_column && String(chart.filter_value ?? '') !== '') {
      const mode = chart.filter_mode || 'include';
      filtered = filtered.filter((row) => {
        const eq = String(row?.[chart.filter_column] ?? '') === String(chart.filter_value ?? '');
        return mode === 'exclude' ? !eq : eq;
      });
    }

    if (Array.isArray(chart?.filters)) {
      chart.filters.forEach((f) => {
        if (!f?.column || String(f.value ?? '') === '') return;
        const mode = f.mode || 'include';
        filtered = filtered.filter((row) => {
          const eq = String(row?.[f.column] ?? '') === String(f.value ?? '');
          return mode === 'exclude' ? !eq : eq;
        });
      });
    }

    return filtered;
  };

  const makeChartPreviewData = (chart, notes) => {
    const rows = Array.isArray(notes?.tables) ? notes.tables : [];
    const source = applyChartFilters(rows, chart);
    const xKey = chart?.x;
    const yKey = chart?.y;
    const groupKey = chart?.group_by;

    if (!xKey) return [];

    const smartSort = (values) => {
      return [...values].sort((a, b) => {
        const na = Number(String(a).replace(',', '.'));
        const nb = Number(String(b).replace(',', '.'));
        const bothNumeric = Number.isFinite(na) && Number.isFinite(nb);
        if (bothNumeric) return na - nb;
        return String(a).localeCompare(String(b), 'fr', { numeric: true, sensitivity: 'base' });
      });
    };

    if (groupKey) {
      const groupValues = Array.from(
        new Set(source.map((row) => String(row?.[groupKey] ?? '')).filter((v) => v !== ''))
      );
      const xValues = smartSort(
        Array.from(new Set(source.map((row) => String(row?.[xKey] ?? '—'))))
      );

      if (groupValues.length > 0) {
        const aggregation = {};
        source.forEach((row) => {
          const xVal = String(row?.[xKey] ?? '—');
          const gVal = String(row?.[groupKey] ?? '—');
          const yVal = parseNumber(row?.[yKey]);
          aggregation[xVal] = aggregation[xVal] || {};
          aggregation[xVal][gVal] = (aggregation[xVal][gVal] || 0) + (yVal === null ? 0 : yVal);
        });

        const seriesData = xValues.map((xVal) => {
          const out = { name: xVal };
          groupValues.forEach((gVal) => {
            out[gVal] = aggregation?.[xVal]?.[gVal] || 0;
          });
          return out;
        });

        if (chart?.type === 'Nuage de points') {
          const scatterSeriesData = {};
          groupValues.forEach((gVal) => {
            scatterSeriesData[gVal] = xValues.map((xVal, idx) => {
              const parsedX = parseNumber(xVal);
              return {
                x: parsedX === null ? idx + 1 : parsedX,
                y: aggregation?.[xVal]?.[gVal] || 0,
              };
            });
          });
          return { grouped: true, groupValues, scatterSeriesData, seriesData };
        }

        if (chart?.type === 'Secteur') {
          const pieData = groupValues
            .map((gVal) => {
              let total = 0;
              seriesData.forEach((item) => {
                total += Number(item?.[gVal] || 0);
              });
              return { name: gVal, value: total };
            })
            .filter((item) => item.value > 0);
          return { grouped: true, pieData, groupValues, seriesData };
        }

        return { grouped: true, groupValues, seriesData };
      }
    }

    if (chart?.type === 'Nuage de points') {
      return source
        .map((row, idx) => {
          const yVal = parseNumber(row?.[yKey]);
          if (yVal === null) return null;
          const xVal = parseNumber(row?.[xKey]);
          return {
            x: xVal === null ? idx + 1 : xVal,
            y: yVal,
          };
        })
        .filter(Boolean)
        .slice(0, 200);
    }

    const grouped = new Map();
    source.forEach((row) => {
      const xVal = String(row?.[xKey] ?? '—');
      const yVal = parseNumber(row?.[yKey]);
      const current = grouped.get(xVal) || 0;
      grouped.set(xVal, current + (yVal === null ? 1 : yVal));
    });

    return Array.from(grouped.entries()).map(([name, value]) => ({ name, value }));
  };

  const fetchMyAssignments = async () => {
    try {
      setMyLoading(true);
      const response = await axios.get(`${API_BASE}/user-theme-assignments/`);
      const data = Array.isArray(response.data) ? response.data : [];
      setMyAssignments(data);
      if (selectedMyAssignment) {
        const refreshed = data.find(a => a.id === selectedMyAssignment.id);
        if (refreshed) {
          setSelectedMyAssignment(refreshed);
          setMyProgression(refreshed.progression || 0);
        }
      }
    } catch (error) {
      console.error('Erreur chargement assignations saisisseur:', error);
    } finally {
      setMyLoading(false);
    }
  };

  const openMyAssignment = (assignment) => {
    setSelectedMyAssignment(assignment);
    setMyProgression(assignment.progression || 0);
    setMyComment('');
  };

  const saveMyDraft = async () => {
    if (!selectedMyAssignment) return;
    try {
      const saisisseurToken = localStorage.getItem('auth_token_saisisseur') || localStorage.getItem('auth_token');
      const saisisseurRequestConfig = saisisseurToken
        ? { headers: { Authorization: `Token ${saisisseurToken}` } }
        : {};
      const notesObj = parseAssignmentNotes(selectedMyAssignment.notes);
      notesObj.saisisseur_draft = {
        comment: String(myComment || '').trim(),
        updated_at: new Date().toISOString(),
      };
      const history = Array.isArray(notesObj.workflow_history) ? notesObj.workflow_history : [];
      history.push({
        at: new Date().toISOString(),
        actor: 'saisisseur',
        action: 'draft_save',
        message: String(myComment || '').trim(),
      });
      notesObj.workflow_history = history;

      await axios.patch(
        `${API_BASE}/user-theme-assignments/${selectedMyAssignment.id}/`,
        {
          notes: JSON.stringify(notesObj),
          progression: Number(myProgression || 0),
          statut: 'En cours',
        },
        saisisseurRequestConfig,
      );
      alert('Brouillon enregistré.');
      await fetchMyAssignments();
    } catch (error) {
      console.error('Erreur sauvegarde brouillon:', error);
      alert(error.response?.data?.error || 'Erreur lors de la sauvegarde du brouillon');
    }
  };

  const submitMyAssignment = async () => {
    if (!selectedMyAssignment) return;
    try {
      const saisisseurToken = localStorage.getItem('auth_token_saisisseur') || localStorage.getItem('auth_token');
      const saisisseurRequestConfig = saisisseurToken
        ? { headers: { Authorization: `Token ${saisisseurToken}` } }
        : {};
      await axios.post(
        `${API_BASE}/user-theme-assignments/${selectedMyAssignment.id}/submit/`,
        {
          message: String(myComment || '').trim(),
          progression: Number(myProgression || 0),
        },
        saisisseurRequestConfig,
      );
      alert('Soumission envoyée à l\'administrateur.');
      await fetchMyAssignments();
    } catch (error) {
      console.error('Erreur soumission:', error);
      alert(error.response?.data?.error || 'Erreur lors de la soumission');
    }
  };

  // Vérifier les permissions
  useEffect(() => {
    if (userRole && userRole !== 'ADMIN') {
      // alert('Accès refusé. Seuls les administrateurs peuvent accéder à cette page.');
    }
  }, [userRole]);

  // Fermer le menu kebab quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openMenuId && !event.target.closest('button')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuId]);

  // Écouter les demandes d'ouverture de la configuration visiteur depuis d'autres composants
  useEffect(() => {
    const handler = async (e) => {
      try {
        const subThemeId = e?.detail;
        if (!subThemeId) return;

        // S'assurer que les thèmes sont chargés
        if (!themes || themes.length === 0) await fetchThemes();

        // Chercher le sous-thème dans la liste locale
        let found = null;
        for (const t of themes || []) {
          const st = (t.sous_themes || []).find(s => String(s.id) === String(subThemeId) || s.id === subThemeId);
          if (st) { found = st; break; }
        }

        // Si non trouvé localement, tenter de le récupérer depuis l'API
        if (!found) {
          const res = await axios.get(`${API_BASE}/sousthemes/${subThemeId}/`);
          found = res.data;
        }

        if (found) {
          setConfigSubTheme(found);
          setModalVisitorCols(found.visitor_visible_columns || []);
          const rawFilters = found.visitor_filters || found.filtres_disponibles || [];
          const normalizeFilters = (arr) => {
            if (!Array.isArray(arr)) return [];
            return arr.map(item => (typeof item === 'string' ? item : (item && item.column) ? item.column : String(item)));
          };
          setModalVisitorFilters(normalizeFilters(rawFilters));
          setModalVisitorDefaultFilters(found.visitor_default_filters || {});
          setConfigModalOpen(true);
          setActiveTab('themes');
        }
      } catch (err) {
        console.error('Erreur lors de l\'ouverture de la configuration visiteur', err);
      }
    };

    window.addEventListener('openVisitorConfig', handler);
    return () => window.removeEventListener('openVisitorConfig', handler);
  }, [themes]);

  // Espace saisisseur: exécution des tâches et coordination avec l'admin
  if (isSaisisseur) {
    const waiting = myAssignments.filter(a => a.statut === 'En attente').length;
    const done = myAssignments.filter(a => a.statut === 'Complété').length;
    const inProgress = myAssignments.filter(a => a.statut === 'En cours').length;
    const notesObj = parseAssignmentNotes(selectedMyAssignment?.notes);
    const history = Array.isArray(notesObj.workflow_history) ? notesObj.workflow_history.slice().reverse() : [];
    const lastReview = notesObj.admin_last_review || null;

    return (
      <div className="min-h-screen bg-[#f8f2f5] p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="bg-[#7A0A4A] text-white py-4 px-6 font-bold text-2xl rounded-2xl shadow-[0_10px_24px_rgba(122,10,74,0.28)]">
            🧾 Espace Saisisseur
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-white border border-[#d8b6c8] rounded-xl p-4">
              <div className="text-xs text-[#9a6f85]">Tâches assignées</div>
              <div className="text-2xl font-black text-[#7A0A4A]">{myAssignments.length}</div>
            </div>
            <div className="bg-white border border-[#d8b6c8] rounded-xl p-4">
              <div className="text-xs text-[#9a6f85]">En cours</div>
              <div className="text-2xl font-black text-[#7A0A4A]">{inProgress}</div>
            </div>
            <div className="bg-white border border-[#d8b6c8] rounded-xl p-4">
              <div className="text-xs text-[#9a6f85]">Soumises</div>
              <div className="text-2xl font-black text-[#b26a00]">{waiting}</div>
            </div>
            <div className="bg-white border border-[#d8b6c8] rounded-xl p-4">
              <div className="text-xs text-[#9a6f85]">Validées</div>
              <div className="text-2xl font-black text-[#1a7f4b]">{done}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border-2 border-[#d8b6c8] rounded-2xl overflow-hidden">
              <div className="px-4 py-3 bg-[#7A0A4A] text-white font-bold">Mes tâches</div>
              <div className="max-h-[420px] overflow-auto">
                {myLoading ? (
                  <div className="p-4 text-[#7A0A4A]">Chargement...</div>
                ) : myAssignments.length === 0 ? (
                  <div className="p-4 text-gray-500">Aucune tâche assignée.</div>
                ) : (
                  myAssignments.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => openMyAssignment(a)}
                      className={`w-full text-left px-4 py-3 border-b border-[#efdce6] hover:bg-[#fcf4f8] ${selectedMyAssignment?.id === a.id ? 'bg-[#fcf0f6]' : ''}`}
                    >
                      <div className="font-semibold text-[#4d1734]">{a.theme_titre || 'Thème'}{a.sous_theme_nom ? ` > ${a.sous_theme_nom}` : ''}</div>
                      <div className="text-xs text-[#8c4f6a] mt-1">Priorité: {a.priorite || 'Normale'} | Statut: {a.statut}</div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white border-2 border-[#d8b6c8] rounded-2xl p-4 space-y-4">
              {!selectedMyAssignment ? (
                <div className="text-gray-500">Sélectionnez une tâche pour commencer.</div>
              ) : (
                <>
                  <div>
                    <h3 className="text-lg font-black text-[#7A0A4A]">{selectedMyAssignment.theme_titre || 'Thème'}{selectedMyAssignment.sous_theme_nom ? ` > ${selectedMyAssignment.sous_theme_nom}` : ''}</h3>
                    <div className="text-sm text-[#8c4f6a]">Statut actuel: {selectedMyAssignment.statut}</div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-[#7A0A4A] mb-2">Progression</label>
                    <input type="range" min="0" max="100" value={myProgression} onChange={(e) => setMyProgression(Number(e.target.value))} className="w-full" />
                    <div className="text-sm text-[#4d1734] mt-1">{myProgression}%</div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-[#7A0A4A] mb-2">Message pour l'admin</label>
                    <textarea
                      value={myComment}
                      onChange={(e) => setMyComment(e.target.value)}
                      className="w-full min-h-[110px] p-3 border border-[#d8b6c8] rounded-lg outline-none focus:border-[#B03372]"
                      placeholder="Expliquez l'avancement, les points bloquants ou les remarques..."
                    />
                  </div>

                  {lastReview && (
                    <div className={`p-3 rounded-lg border ${lastReview.decision === 'reject' ? 'bg-[#fff1f1] border-[#f1b5b5]' : 'bg-[#eefcf4] border-[#b8e6c8]'}`}>
                      <div className="font-semibold text-sm">Dernier retour admin: {lastReview.decision === 'reject' ? 'Correction demandée' : 'Approuvé'}</div>
                      <div className="text-sm mt-1">{lastReview.message || '—'}</div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={saveMyDraft} className="flex-1 px-4 py-2 bg-white text-[#7A0A4A] border border-[#B03372] rounded-lg font-bold hover:bg-[#f7eaf1]">💾 Enregistrer brouillon</button>
                    <button onClick={submitMyAssignment} className="flex-1 px-4 py-2 bg-[#7A0A4A] text-white border border-[#B03372] rounded-lg font-bold hover:bg-[#5E0738]">📤 Soumettre à l'admin</button>
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-[#7A0A4A] mb-2">Historique</h4>
                    <div className="max-h-[160px] overflow-auto border border-[#efdce6] rounded-lg p-2 bg-[#fcf4f8]">
                      {history.length === 0 ? (
                        <div className="text-xs text-gray-500">Aucun historique.</div>
                      ) : (
                        history.map((h, idx) => (
                          <div key={`h-${idx}`} className="text-xs border-b border-[#efdce6] py-1 last:border-b-0">
                            <div className="font-semibold text-[#6b2949]">{h.action} • {h.actor}</div>
                            <div className="text-[#8c4f6a]">{h.message || '—'}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const fetchSaisisseurs = async () => {
    try {
      const adminConfig = getAdminAuthConfig();
      // Charger les utilisateurs
      const usersResponse = await axios.get(`${API_BASE}/users/`, adminConfig);
      const filteredUsers = usersResponse.data.filter(user => 
        user.role === 'SAISISSEUR'
      );
      
      // Charger les assignations
      const assignmentsResponse = await axios.get(`${API_BASE}/user-theme-assignments/`, adminConfig);
      const nextAssignments = assignmentsResponse.data;
      setAssignments(nextAssignments);

      const currentMarkers = nextAssignments.reduce((acc, assignment) => {
        const { marker } = getAssignmentSubmissionMeta(assignment);
        if (marker) acc[String(assignment.id)] = marker;
        return acc;
      }, {});

      if (!isSaisisseur) {
        if (!notificationBootstrapDone) {
          persistSeenSubmissionMarkers({ ...currentMarkers, ...seenSubmissionMarkers });
          setNotificationBootstrapDone(true);
        } else {
          const hasNewSubmission = Object.entries(currentMarkers).some(([assignmentId, marker]) => seenSubmissionMarkers[assignmentId] !== marker);
          if (hasNewSubmission) {
            playAdminNotificationSound();
          }
        }
      }
      
      // Fusionner: ajouter toutes les assignations aux utilisateurs
      const usersWithAssignments = filteredUsers.map(user => {
        const userAssignments = nextAssignments.filter(a => a.user === user.id);
        return {
          ...user,
          assignments: userAssignments
        };
      });
      
      setSaisisseurs(usersWithAssignments);
    } catch (error) {
      console.error('Erreur lors du chargement des saisisseurs:', error);
    }
  };

  const fetchThemes = async () => {
    try {
      const response = await axios.get(`${API_BASE}/themes/`, getAdminAuthConfig());
      setThemes(response.data);
      setAllThemes(response.data); // Pour la gestion des thèmes
    } catch (error) {
      console.error('Erreur lors du chargement des thèmes:', error);
    }
  };

  const fetchUserRequests = async () => {
    try {
      const adminConfig = getAdminAuthConfig();
      if (!adminConfig.headers) return;
      const response = await axios.get(`${API_BASE}/user-requests/`, adminConfig);
      setUserRequests(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement des demandes:', error);
      if (error.response?.status !== 403) {
        alert(error.response?.data?.error || 'Erreur lors du chargement des demandes');
      }
    }
  };

  // Fonctions pour la gestion des thèmes
  const toggleThemeVisibility = async (themeId, currentVisibility) => {
    const newVisibility = !currentVisibility;
    
    // Mise à jour optimiste du state local
    const updateThemes = (prevThemes) => prevThemes.map(theme => {
      if (theme.id === themeId) {
        return {
          ...theme,
          is_visible: newVisibility,
          categories: theme.categories?.map(cat => ({ ...cat, is_visible: newVisibility })),
          sous_themes: theme.sous_themes?.map(st => ({ ...st, is_visible: newVisibility }))
        };
      }
      return theme;
    });
    
    setThemes(updateThemes);
    setAllThemes(updateThemes);
    
    try {
      await axios.patch(`${API_BASE}/themes/${themeId}/`, {
        is_visible: newVisibility
      });
    } catch (error) {
      console.error('Erreur lors du changement de visibilité du thème:', error);
      alert('Erreur lors de la mise à jour du statut');
      await fetchThemes(); // Recharger en cas d'erreur
    }
  };

  const toggleThemeArchive = async (themeId, currentArchived) => {
    const newArchived = !currentArchived;
    
    // Mise à jour optimiste du state local
    const updateThemes = (prevThemes) => prevThemes.map(theme => {
      if (theme.id === themeId) {
        return {
          ...theme,
          archived: newArchived,
          sous_themes: theme.sous_themes?.map(st => ({ ...st, archived: newArchived }))
        };
      }
      return theme;
    });
    
    setThemes(updateThemes);
    setAllThemes(updateThemes);
    
    try {
      await axios.patch(`${API_BASE}/themes/${themeId}/`, {
        archived: newArchived
      });
    } catch (error) {
      console.error('Erreur lors de l\'archivage du thème:', error);
      alert('Erreur lors de l\'archivage');
      await fetchThemes(); // Recharger en cas d'erreur
    }
  };

  const toggleSubThemeVisibility = async (subThemeId, currentVisibility) => {
    const newVisibility = !currentVisibility;
    
    // Mise à jour optimiste du state local
    const updateThemes = (prevThemes) => prevThemes.map(theme => ({
      ...theme,
      sous_themes: theme.sous_themes?.map(st => 
        st.id === subThemeId ? { ...st, is_visible: newVisibility } : st
      )
    }));
    
    setThemes(updateThemes);
    setAllThemes(updateThemes);
    
    try {
      await axios.patch(`${API_BASE}/sousthemes/${subThemeId}/`, {
        is_visible: newVisibility
      });
    } catch (error) {
      console.error('Erreur lors du changement de visibilité du sous-thème:', error);
      alert('Erreur lors de la mise à jour du statut');
      await fetchThemes(); // Recharger en cas d'erreur
    }
  };

  const toggleSubThemeArchive = async (subThemeId, currentArchived) => {
    const newArchived = !currentArchived;
    
    // Mise à jour optimiste du state local
    const updateThemes = (prevThemes) => prevThemes.map(theme => ({
      ...theme,
      sous_themes: theme.sous_themes?.map(st => 
        st.id === subThemeId ? { ...st, archived: newArchived } : st
      )
    }));
    
    setThemes(updateThemes);
    setAllThemes(updateThemes);
    
    try {
      await axios.patch(`${API_BASE}/sousthemes/${subThemeId}/`, {
        archived: newArchived
      });
    } catch (error) {
      console.error('Erreur lors de l\'archivage du sous-thème:', error);
      alert('Erreur lors de l\'archivage');
      await fetchThemes(); // Recharger en cas d'erreur
    }
  };

  const toggleThemeExpansion = (themeId) => {
    setExpandedThemes(prev => ({
      ...prev,
      [themeId]: !prev[themeId]
    }));
  };

  const handleAddSaisisseur = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    try {
      setLoading(true);
      // Créer l'utilisateur
      const response = await axios.post(`${API_BASE}/user-requests/create_user_with_email/`, {
        name: newSaisisseur.name,
        email: newSaisisseur.email,
        role: newSaisisseur.role
      });

      // Afficher un message de succès
      alert('Saisisseur ajouté avec succès! Un email a été envoyé avec les identifiants.');
      
      // Réinitialiser le formulaire
      setNewSaisisseur({ name: '', email: '', role: 'SAISISSEUR' });
      setShowAddModal(false);
      
      // Recharger les données
      fetchSaisisseurs();
    } catch (error) {
      console.error('Erreur complet:', error.response?.data || error);
      const errorMsg = error.response?.data?.error || error.response?.data?.errors || error.message || 'Erreur lors de l\'ajout du saisisseur';
      setErrorMessage(errorMsg);
      alert(`Erreur: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRequestStatus = async (requestId, newStatus) => {
    try {
      await axios.patch(`${API_BASE}/user-requests/${requestId}/update_statut/`, {
        statut: newStatus
      });
      
      // Recharger les données
      fetchUserRequests();
      fetchSaisisseurs();
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
      alert('Erreur lors de la mise à jour du statut');
    }
  };

  const handleResetPassword = async (requestId) => {
    try {
      await axios.post(`${API_BASE}/user-requests/${requestId}/reset_password/`);
      alert('Mot de passe réinitialisé et email envoyé!');
    } catch (error) {
      console.error('Erreur lors de la réinitialisation du mot de passe:', error);
      alert('Erreur lors de la réinitialisation du mot de passe');
    }
  };

  const handleThemeChange = async (themeId) => {
    setSelectedTheme(themeId);
    setSelectedSubTheme(null);
    setSubThemes([]);
    
    if (themeId) {
      try {
        const response = await axios.get(`${API_BASE}/sousthemes/?theme=${themeId}`);
        const filteredSubThemes = response.data || [];
        setSubThemes(filteredSubThemes);
      } catch (error) {
        console.error('Erreur lors du chargement des sous-thèmes:', error);
        setSubThemes([]);
      }
    }
  };

  // Fonction pour obtenir les thèmes/sous-thèmes déjà assignés à un utilisateur
  const getAssignedThemes = (userId) => {
    if (!userId) return { themeIds: [], subThemeIds: [] };
    const userAssignments = assignments.filter(a => a.user === userId && a.assignment_archived !== true);
    return {
      themeIds: userAssignments.filter(a => a.theme && !a.sous_theme).map(a => a.theme),
      subThemeIds: userAssignments.filter(a => a.sous_theme).map(a => a.sous_theme)
    };
  };

  // Fonction pour filtrer les thèmes disponibles
  // Ne pas afficher un thème déjà assigné globalement (sans sous-thème) à n'importe quel utilisateur.
  // Ne pas afficher un thème si tous ses sous-thèmes sont déjà assignés.
  const getAvailableThemes = () => {
    const globallyAssignedThemeIds = assignments
      .filter(a => a.assignment_archived !== true && a.theme && !a.sous_theme)
      .map(a => a.theme);
    
    const assignedSubThemeIds = assignments
      .filter(a => a.assignment_archived !== true && a.sous_theme)
      .map(a => a.sous_theme);
    
    return themes.filter(t => {
      // Exclure les thèmes assignés globalement
      if (globallyAssignedThemeIds.includes(t.id)) {
        return false;
      }
      
      // Exclure les thèmes dont tous les sous-thèmes sont assignés
      if (t.sous_themes && t.sous_themes.length > 0) {
        const allSubThemesAssigned = t.sous_themes.every(st => assignedSubThemeIds.includes(st.id));
        if (allSubThemesAssigned) {
          return false;
        }
      }
      
      return true;
    });
  };

  // Fonction pour filtrer les sous-thèmes disponibles
  // Si le thème est déjà assigné en entier, aucun sous-thème ne doit être assignable.
  // Exclure aussi les sous-thèmes déjà assignés à n'importe quel utilisateur.
  const getAvailableSubThemes = () => {
    if (!selectedTheme) return subThemes;
    const globallyAssignedThemeIds = assignments
      .filter(a => a.assignment_archived !== true && a.theme && !a.sous_theme)
      .map(a => a.theme);
    if (globallyAssignedThemeIds.includes(parseInt(selectedTheme))) {
      return [];
    }
    // Exclure les sous-thèmes assignés à n'importe quel utilisateur
    const assignedSubThemeIds = assignments
      .filter(a => a.assignment_archived !== true && a.sous_theme)
      .map(a => a.sous_theme);
    return subThemes.filter(st => !assignedSubThemeIds.includes(st.id));
  };

  // Ajouter une assignation à la queue
  const addToPendingAssignments = () => {
    if (!selectedSaisisseur || !selectedTheme) {
      alert('Veuillez sélectionner un saisisseur et un thème');
      return;
    }

    const assignment = {
      user: selectedSaisisseur,
      theme: selectedTheme,
      sous_theme: selectedSubTheme || null,
      themeTitle: themes.find(t => t.id === parseInt(selectedTheme))?.titre || 'Thème',
      subThemeTitle: selectedSubTheme ? subThemes.find(st => st.id === selectedSubTheme)?.nom : null
    };

    // Vérifier que cette assignation n'existe pas déjà dans la queue
    const exists = pendingAssignments.some(
      a => a.theme === assignment.theme && a.sous_theme === assignment.sous_theme && a.user === assignment.user
    );

    if (exists) {
      alert('Cette assignation est déjà en attente');
      return;
    }

    setPendingAssignments([...pendingAssignments, assignment]);
    setSelectedTheme(null);
    setSelectedSubTheme(null);
    setSubThemes([]);
    setShowAssignmentQueue(true);
  };

  // Supprimer une assignation de la queue
  const removeFromPendingAssignments = (index) => {
    setPendingAssignments(pendingAssignments.filter((_, i) => i !== index));
  };

  // Soumettre toutes les assignations en attente
  const handleAssignTheme = async () => {
    if (pendingAssignments.length === 0) {
      alert('Aucune assignation à effectuer');
      return;
    }

    try {
      setLoading(true);
      for (const assignment of pendingAssignments) {
        await axios.post(`${API_BASE}/user-theme-assignments/`, {
          user: assignment.user,
          theme: assignment.theme,
          sous_theme: assignment.sous_theme || null,
          statut: 'En cours'
        });
      }

      alert(`${pendingAssignments.length} assignation(s) effectuée(s) avec succès!`);
      fetchSaisisseurs();
      setPendingAssignments([]);
      setShowAssignmentQueue(false);
      setSelectedTheme(null);
      setSelectedSubTheme(null);
      setSelectedSaisisseur(null);
    } catch (error) {
      console.error('Erreur lors de l\'assignation:', error);
      alert(error.response?.data?.detail || 'Erreur lors de l\'assignation');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordUser = async (userId) => {
    if (!confirm('Réinitialiser le mot de passe de ce saisisseur?')) return;
    
    try {
      const response = await axios.post(`${API_BASE}/users/${userId}/reset_password/`);
      alert('Mot de passe réinitialisé avec succès! Un email a été envoyé.');
      console.log('Nouveau mot de passe:', response.data.password);
    } catch (error) {
      console.error('Erreur lors de la réinitialisation:', error);
      alert('Erreur lors de la réinitialisation du mot de passe');
    }
  };

  const handleDeleteSaisisseur = async (userId) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce saisisseur? Cette action est irréversible.')) return;
    
    try {
      await axios.delete(`${API_BASE}/users/${userId}/`);
      alert('Saisisseur supprimé avec succès');
      fetchSaisisseurs();
      setOpenMenuId(null);
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      alert(error.response?.data?.error || 'Erreur lors de la suppression');
    }
  };

  const handleArchiveSaisisseur = async (userId) => {
    if (!confirm('Archiver ce saisisseur? Il ne pourra plus se connecter.')) return;
    
    try {
      await axios.post(`${API_BASE}/users/${userId}/archive/`);
      alert('Saisisseur archivé avec succès');
      fetchSaisisseurs();
      setOpenMenuId(null);
    } catch (error) {
      console.error('Erreur lors de l\'archivage:', error);
      alert(error.response?.data?.error || 'Erreur lors de l\'archivage');
    }
  };

  const handleUnarchiveSaisisseur = async (userId) => {
    if (!confirm('Réactiver ce saisisseur? Il pourra se reconnecter.')) return;

    try {
      await axios.post(`${API_BASE}/users/${userId}/unarchive/`);
      alert('Saisisseur réactivé avec succès');
      fetchSaisisseurs();
      setOpenMenuId(null);
    } catch (error) {
      console.error('Erreur lors de la réactivation:', error);
      alert(error.response?.data?.error || 'Erreur lors de la réactivation');
    }
  };

  const handleChangePriority = async (assignmentId, newPriority) => {
    try {
      await axios.patch(`${API_BASE}/user-theme-assignments/${assignmentId}/`, {
        priorite: newPriority
      });
      alert(`Priorité changée à: ${newPriority}`);
      fetchSaisisseurs();
      setOpenMenuId(null);
    } catch (error) {
      console.error('Erreur lors du changement de priorité:', error);
      alert(error.response?.data?.error || 'Erreur lors du changement de priorité');
    }
  };

  const handleArchiveAssignment = async (assignmentId) => {
    if (!confirm('Archiver cette tâche ? Le compte utilisateur restera actif.')) return;

    try {
      await axios.post(`${API_BASE}/user-theme-assignments/${assignmentId}/archive/`);
      alert('Tâche archivée avec succès');
      fetchSaisisseurs();
      setOpenMenuId(null);
    } catch (error) {
      console.error('Erreur lors de l\'archivage de la tâche:', error);
      alert(error.response?.data?.error || 'Erreur lors de l\'archivage de la tâche');
    }
  };

  const handleUnarchiveAssignment = async (assignmentId) => {
    if (!confirm('Désarchiver cette tâche ?')) return;

    try {
      await axios.post(`${API_BASE}/user-theme-assignments/${assignmentId}/unarchive/`);
      alert('Tâche désarchivée avec succès');
      fetchSaisisseurs();
      setOpenMenuId(null);
    } catch (error) {
      console.error('Erreur lors du désarchivage de la tâche:', error);
      alert(error.response?.data?.error || 'Erreur lors du désarchivage de la tâche');
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    if (!confirm('Supprimer cette assignation ? Cette action est irréversible.')) return;
    try {
      await axios.delete(`${API_BASE}/user-theme-assignments/${assignmentId}/`);
      alert('Assignation supprimée');
      fetchSaisisseurs();
      setOpenMenuId(null);
    } catch (error) {
      console.error("Erreur lors de la suppression de l'assignation:", error);
      alert(error.response?.data?.error || 'Erreur lors de la suppression');
    }
  };

  const handleValidateSaisisseur = async (assignmentId) => {
    try {
      const adminComment = prompt('Commentaire de validation (optionnel):', '') || '';
      await axios.post(`${API_BASE}/user-theme-assignments/${assignmentId}/review/`, {
        decision: 'approve',
        message: adminComment.trim(),
      });

      alert('Soumission approuvée et appliquée.');
      fetchSaisisseurs();
      setOpenMenuId(null);
    } catch (error) {
      console.error('Erreur lors de la validation:', error);
      alert(error.response?.data?.error || 'Erreur lors de la validation');
    }
  };

  const handleRejectSaisisseur = async (assignmentId) => {
    const reason = prompt('Précisez les corrections demandées:', '');
    if (reason === null) return;

    try {
      await axios.post(`${API_BASE}/user-theme-assignments/${assignmentId}/review/`, {
        decision: 'reject',
        message: String(reason || '').trim(),
      });
      alert('Retour envoyé au saisisseur.');
      fetchSaisisseurs();
      setOpenMenuId(null);
    } catch (error) {
      console.error('Erreur lors du rejet:', error);
      alert(error.response?.data?.error || 'Erreur lors de l\'envoi du retour');
    }
  };

  const handleOpenSubmissionPreview = async (assignmentId) => {
    try {
      setOpenMenuId(null);
      const res = await axios.get(`${API_BASE}/user-theme-assignments/${assignmentId}/`);
      const assignment = res.data;
      const notesObj = normalizeSubmissionNotes(assignment.notes);
      markSubmissionAsSeen(assignment);
      setPreviewContent({ assignment, notes: notesObj });
      setPreviewTablePage(1);
      setPreviewPageSize(-1);
      setPreviewModalOpen(true);
    } catch (err) {
      console.error('Erreur ouverture soumission:', err);
      alert(err?.response?.data?.error || err?.message || 'Impossible d\'ouvrir la soumission');
    }
  };

  const getRoleLabel = (role) => {
    return role === 'SAISISSEUR' ? 'Saisisseur' : 'Administrateur';
  };

  const unreadSubmissionCount = assignments.filter((assignment) => {
    const { marker } = getAssignmentSubmissionMeta(assignment);
    return marker && seenSubmissionMarkers[String(assignment.id)] !== marker;
  }).length;

  const submissionNotifications = assignments
    .map((assignment) => ({
      assignment,
      ...getAssignmentSubmissionMeta(assignment),
    }))
    .filter((item) => item.marker || item.comment)
    .sort((a, b) => String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')));

  const formatAssignmentDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-[#f8f2f5] p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-[#7A0A4A] text-white py-4 px-6 font-bold text-2xl border-b-4 border-[#B03372] mb-6 rounded-t-3xl shadow-[0_10px_24px_rgba(122,10,74,0.28)]">
          🛡️ Espace d'Administration
        </div>

        {/* Onglets de navigation */}
        <div className="flex gap-2 mb-6 bg-white border-2 border-b-0 border-[#d8b6c8] p-3 rounded-t-3xl shadow-[0_10px_20px_rgba(122,10,74,0.12)]">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 py-3 px-6 rounded-2xl font-bold text-lg transition-all border ${
              activeTab === 'users'
                ? 'bg-[#7A0A4A] text-white border-[#7A0A4A] shadow-[0_8px_18px_rgba(122,10,74,0.35)]'
                : 'bg-[#f7eaf1] text-[#7A0A4A] border-[#d8b6c8] hover:bg-[#f4e3ed]'
            }`}
          >
            👥 GESTION DES SAISISSEURS
          </button>
          <button
            onClick={() => setActiveTab('themes')}
            className={`flex-1 py-3 px-6 rounded-2xl font-bold text-lg transition-all border ${
              activeTab === 'themes'
                ? 'bg-[#B03372] text-white border-[#B03372] shadow-[0_8px_18px_rgba(122,10,74,0.28)]'
                : 'bg-[#f7eaf1] text-[#7A0A4A] border-[#d8b6c8] hover:bg-[#f4e3ed]'
            }`}
          >
            📊 GESTION DES THEMES
          </button>
        </div>

        {/* Section Espace Administrateurs */}
        {activeTab === 'users' && (
          <>
            {/* Header section */}
            <div className="flex justify-between items-center mb-6 bg-white border-2 border-t-0 border-[#d8b6c8] px-6 py-4 rounded-b-2xl shadow-[0_10px_20px_rgba(122,10,74,0.12)]">
              <h2 className="text-2xl font-black text-[#7A0A4A]">Gestion des Utilisateurs</h2>
              <div className="space-x-2 flex">
                <button
                  onClick={async () => {
                    await fetchSaisisseurs();
                    setShowNotificationsModal(true);
                  }}
                  className={`relative px-4 py-2 border rounded-xl font-bold shadow-[0_6px_14px_rgba(122,10,74,0.18)] transition ${unreadSubmissionCount > 0 ? 'bg-[#b85282] text-white border-[#991b1b] hover:bg-[#991b1b]' : 'bg-white text-[#7A0A4A] border-[#B03372] hover:bg-[#f7eaf1]'}`}
                  disabled={loading}
                  title="Messages reçus des saisisseurs"
                >
                  🔔
                  {unreadSubmissionCount > 0 && (
                    <span className="absolute -top-2 -right-2 inline-flex items-center justify-center min-w-6 h-6 px-1 rounded-full bg-[#FFD166] text-[#5E0738] text-xs font-black">
                      {unreadSubmissionCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 bg-[#7A0A4A] text-white border border-[#B03372] rounded-xl font-bold hover:bg-[#5E0738] shadow-[0_8px_16px_rgba(122,10,74,0.25)] transition"
                  disabled={loading}
                >
                  ➕ Ajouter
                </button>
            </div>
        </div>

        {/* Formulaire d'assignation */}
        <div className="bg-white border-2 border-[#d8b6c8] p-6 mb-6 rounded-3xl shadow-[0_10px_20px_rgba(122,10,74,0.12)]">
          <h3 className="text-2xl font-black mb-4 text-[#7A0A4A]">🔗 Assigner Thème à Utilisateur</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-bold mb-2 text-[#7A0A4A]">Utilisateur</label>
              <select
                value={selectedSaisisseur || ''}
                onChange={(e) => {
                  setSelectedSaisisseur(parseInt(e.target.value) || null);
                  setSelectedTheme(null);
                  setSelectedSubTheme(null);
                  setSubThemes([]);
                }}
                className="w-full px-3 py-2 border border-[#d8b6c8] rounded-lg outline-none font-semibold bg-white text-[#4d1734] focus:border-[#B03372]"
              >
                <option value="">-- Sélectionner --</option>
                {saisisseurs.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.first_name || s.username} ({getRoleLabel(s.role)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold mb-2 text-[#7A0A4A]">Thème</label>
              <select
                value={selectedTheme || ''}
                onChange={(e) => handleThemeChange(e.target.value)}
                disabled={!selectedSaisisseur}
                className="w-full px-3 py-2 border border-[#d8b6c8] rounded-lg outline-none font-semibold bg-white disabled:bg-[#f3e8ef] text-[#4d1734] focus:border-[#B03372]"
              >
                <option value="">-- Sélectionner --</option>
                {getAvailableThemes().map(theme => (
                  <option key={theme.id} value={theme.id}>{theme.titre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold mb-2 text-[#7A0A4A]">Sous-Thème (optionnel)</label>
              <select
                value={selectedSubTheme || ''}
                onChange={(e) => setSelectedSubTheme(e.target.value || null)}
                className="w-full px-3 py-2 border border-[#d8b6c8] rounded-lg outline-none font-semibold bg-white disabled:bg-[#f3e8ef] text-[#4d1734] focus:border-[#B03372]"
                disabled={!selectedTheme}
              >
                <option value="">-- Aucun --</option>
                {getAvailableSubThemes().map(st => (
                  <option key={st.id} value={st.id}>{st.nom}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={addToPendingAssignments}
            className="w-full px-4 py-3 bg-[#B03372] text-white border border-[#B03372] rounded-xl font-bold hover:bg-[#8f245e] shadow-[0_8px_16px_rgba(122,10,74,0.28)] transition"
            disabled={!selectedSaisisseur || !selectedTheme || loading}
          >
            ➕ Ajouter à la Queue
          </button>

          {/* Afficher la queue d'assignations */}
          {pendingAssignments.length > 0 && (
            <div className="mt-6 p-4 bg-[#fcf4f8] border border-[#d8b6c8] rounded-2xl">
              <h4 className="text-lg font-bold mb-3 text-[#7A0A4A]">📦 Assignations en Attente ({pendingAssignments.length})</h4>
              <div className="space-y-2 mb-4">
                {pendingAssignments.map((assignment, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white border border-[#d8b6c8] p-3 rounded-lg">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">
                        <strong>{saisisseurs.find(s => s.id === assignment.user)?.first_name || 'Utilisateur'}</strong>
                      </p>
                      <p className="text-sm text-[#6b2949]">
                        Thème: <strong>{assignment.themeTitle}</strong>
                        {assignment.subThemeTitle && ` > Sous-thème: ${assignment.subThemeTitle}`}
                      </p>
                    </div>
                    <button
                      onClick={() => removeFromPendingAssignments(idx)}
                      className="ml-4 px-3 py-1 bg-[#ca5f8f] text-white border border-[#ca5f8f] rounded font-bold hover:bg-[#b24f7c] transition"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAssignTheme}
                  className="flex-1 px-4 py-2 bg-[#7A0A4A] text-white border border-[#B03372] rounded-xl font-bold hover:bg-[#5E0738] shadow-[0_8px_16px_rgba(122,10,74,0.25)] transition"
                  disabled={loading}
                >
                  ✓ Valider les Assignations
                </button>
                <button
                  onClick={() => {
                    setPendingAssignments([]);
                    setShowAssignmentQueue(false);
                  }}
                  className="flex-1 px-4 py-2 bg-white text-[#7A0A4A] border border-[#B03372] rounded-xl font-bold hover:bg-[#f7eaf1] shadow-[0_6px_12px_rgba(122,10,74,0.15)] transition"
                  disabled={loading}
                >
                  ✕ Annuler
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tableau des Saisisseurs */}
        <div className="bg-white border-2 border-[#d8b6c8] rounded-3xl overflow-hidden shadow-[0_10px_20px_rgba(122,10,74,0.12)]">
          <div className="px-6 py-4 bg-[#7A0A4A] text-white border-b border-[#B03372]">
            <h2 className="text-xl font-black">📋 Utilisateurs</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#B03372] text-white border-b border-[#a12663]">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-bold">Nom</th>
                  <th className="px-6 py-3 text-left text-sm font-bold">Email</th>
                  <th className="px-6 py-3 text-left text-sm font-bold">Rôle</th>
                  <th className="px-6 py-3 text-left text-sm font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {saisisseurs.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                      Aucun saisisseur trouvé. Cliquez sur "Ajouter un Saisisseur" pour en créer.
                    </td>
                  </tr>
                ) : (
                  saisisseurs.map((saisisseur) => {
                    const isArchived = saisisseur.is_active === false;
                    return (
                      <tr
                        key={saisisseur.id}
                        className={`border-b border-[#efdce6] transition ${isArchived ? 'bg-[#f6f1f4] text-gray-400' : 'hover:bg-[#fcf4f8]'}`}
                      >
                        <td className={`px-6 py-3 font-medium ${isArchived ? 'line-through' : ''}`}>
                          {saisisseur.first_name || saisisseur.username}
                        </td>
                        <td className="px-6 py-3 text-[#6b2949]">{saisisseur.email}</td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-[#f4e3ed] text-[#7A0A4A] rounded text-sm font-medium">
                              {getRoleLabel(saisisseur.role)}
                            </span>
                            {isArchived && (
                              <span className="px-2 py-1 bg-[#efdce6] text-[#7A0A4A] rounded text-xs font-bold">Archivé</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-3 relative">
                          <button
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const menuHeight = 200;
                              const menuWidth = 224;
                              const margin = 10;
                              
                              let top, left;
                              
                              // Déterminer la position verticale
                              const spaceBelow = window.innerHeight - rect.bottom - margin;
                              const spaceAbove = rect.top - margin;
                              
                              if (spaceBelow >= menuHeight) {
                                // Afficher sous le bouton
                                top = rect.bottom + 4;
                              } else if (spaceAbove >= menuHeight) {
                                // Afficher au-dessus du bouton
                                top = rect.top - menuHeight - 4;
                              } else {
                                // Forcer une position qui garantit la visibilité complète
                                top = window.innerHeight - menuHeight - margin;
                                if (top < margin) top = margin;
                              }
                              
                              // Déterminer la position horizontale
                              left = rect.left;
                              if (left + menuWidth > window.innerWidth - margin) {
                                left = window.innerWidth - menuWidth - margin;
                              }
                              if (left < margin) left = margin;
                              
                              setMenuPosition({ top, left });
                              setOpenMenuId(openMenuId === `user-${saisisseur.id}` ? null : `user-${saisisseur.id}`);
                            }}
                            className="px-3 py-1 bg-[#f4e3ed] hover:bg-[#d8b6c8] text-[#7A0A4A] rounded text-sm transition font-bold"
                            title="Actions"
                          >
                            ⋮
                          </button>
                          {openMenuId === `user-${saisisseur.id}` && (
                            <div style={{ position: 'fixed', top: menuPosition.top, left: menuPosition.left, zIndex: 9999, maxHeight: '200px' }} className="w-56 bg-white rounded-lg shadow-xl border border-[#d8b6c8] overflow-y-auto">
                              <button
                                onClick={() => {
                                  handleResetPasswordUser(saisisseur.id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-[#f8edf3] flex items-center gap-2 text-sm"
                              >
                                🔒 Réinitialiser le mot de passe
                              </button>
                              {isArchived ? (
                                <button
                                  onClick={() => {
                                    handleUnarchiveSaisisseur(saisisseur.id);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-[#f8edf3] flex items-center gap-2 text-sm border-t border-[#efdce6]"
                                >
                                  ↩️ Désarchiver
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    handleArchiveSaisisseur(saisisseur.id);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-[#f8edf3] flex items-center gap-2 text-sm border-t border-[#efdce6]"
                                >
                                  📦 Archiver
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  handleDeleteSaisisseur(saisisseur.id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-[#fce8ef] text-[#ca5f8f] flex items-center gap-2 text-sm border-t border-[#efdce6] rounded-b-lg"
                              >
                                🗑️ Supprimer
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tableau des Assignations */}
        <div className="bg-white border-2 border-[#d8b6c8] rounded-3xl overflow-hidden shadow-[0_10px_20px_rgba(122,10,74,0.12)] mt-6">
          <div className="px-6 py-4 bg-[#7A0A4A] text-white border-b border-[#B03372]">
            <h2 className="text-xl font-black">🧩 Taches Affectees</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#B03372] text-white border-b border-[#a12663]">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-bold">Utilisateur</th>
                  <th className="px-6 py-3 text-left text-sm font-bold">Tache</th>
                  <th className="px-4 py-3 text-center text-sm font-bold">Priorite</th>
                  <th className="px-4 py-3 text-center text-sm font-bold">Progression</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Date debut</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Date fin</th>
                  <th className="px-4 py-3 text-center text-sm font-bold">Statut</th>
                  <th className="px-6 py-3 text-left text-sm font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignments.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                      Aucune assignation trouvee.
                    </td>
                  </tr>
                ) : (
                  assignments.map((assignment) => {
                    const matchedUser = saisisseurs.find(s => s.id === assignment.user);
                    const userName = assignment.user_name || matchedUser?.first_name || 'Utilisateur';
                    const isUserArchived = assignment.user_is_active === false || matchedUser?.is_active === false;
                    const isAssignmentArchived = assignment.assignment_archived === true;
                    const isRowArchived = isUserArchived || isAssignmentArchived;
                    const taskLabel = assignment.sous_theme_nom
                      ? `${assignment.theme_titre ? `${assignment.theme_titre} > ` : ''}${assignment.sous_theme_nom}`
                      : assignment.theme_titre || '—';
                    
                    // Priority badge styling
                    const priorityStyles = {
                      'Haute': 'bg-red-100 text-red-800 border-red-300',
                      'Normale': 'bg-blue-100 text-blue-800 border-blue-300',
                      'Basse': 'bg-gray-100 text-gray-600 border-gray-300'
                    };
                    const priorityBadge = priorityStyles[assignment.priorite] || priorityStyles['Normale'];
                    
                    // Progress bar color
                    const progression = assignment.progression || 0;
                    const progressColor = progression >= 75 ? 'bg-green-500' : progression >= 40 ? 'bg-yellow-500' : 'bg-blue-500';
                    
                    return (
                      <tr
                        key={assignment.id}
                        className={`border-b border-[#efdce6] transition ${isRowArchived ? 'bg-[#f6f1f4] text-gray-400' : 'hover:bg-[#fcf4f8]'}`}
                      >
                        <td className={`px-6 py-3 font-medium ${isRowArchived ? 'line-through' : ''}`}>
                          {userName}
                        </td>
                        <td className="px-6 py-3 text-[#6b2949]">
                          <div className="flex items-center gap-2">
                            <span>{taskLabel}</span>
                            {isAssignmentArchived && (
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#efdce6] text-[#7A0A4A]">Archivée</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-semibold border ${priorityBadge}`}>
                            {assignment.priorite || 'Normale'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-[#efdce6] rounded-full h-2 overflow-hidden">
                              <div 
                                className={`h-full ${progressColor} transition-all`} 
                                style={{ width: `${progression}%` }}
                              ></div>
                            </div>
                            <span className="text-xs font-medium text-[#6b2949] w-10 text-right">
                              {progression}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#6b2949]">
                          {formatAssignmentDate(assignment.date_assignation)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {assignment.date_completion ? (
                            <span className="text-green-700 font-medium">
                              ✓ {formatAssignmentDate(assignment.date_completion)}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={
                            assignment.statut === 'Complété'
                              ? 'px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium inline-block'
                              : assignment.statut === 'En attente'
                              ? 'px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium inline-block'
                              : 'px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium inline-block'
                          }>
                            {assignment.statut}
                          </span>
                        </td>
                        <td className="px-6 py-3 relative">
                          <button
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const menuHeight = 320;
                              const menuWidth = 224;
                              const margin = 10;
                              
                              let top, left;
                              
                              // Déterminer la position verticale
                              const spaceBelow = window.innerHeight - rect.bottom - margin;
                              const spaceAbove = rect.top - margin;
                              
                              if (spaceBelow >= menuHeight) {
                                // Afficher sous le bouton
                                top = rect.bottom + 4;
                              } else if (spaceAbove >= menuHeight) {
                                // Afficher au-dessus du bouton
                                top = rect.top - menuHeight - 4;
                              } else {
                                // Forcer une position qui garantit la visibilité complète
                                top = window.innerHeight - menuHeight - margin;
                                if (top < margin) top = margin;
                              }
                              
                              // Déterminer la position horizontale
                              left = rect.left;
                              if (left + menuWidth > window.innerWidth - margin) {
                                left = window.innerWidth - menuWidth - margin;
                              }
                              if (left < margin) left = margin;
                              
                              setMenuPosition({ top, left });
                              setOpenMenuId(openMenuId === `assign-${assignment.id}` ? null : `assign-${assignment.id}`);
                            }}
                            className="px-3 py-1 bg-[#f4e3ed] hover:bg-[#d8b6c8] text-[#7A0A4A] rounded text-sm transition font-bold"
                            title="Actions"
                          >
                            ⋮
                          </button>
                          {openMenuId === `assign-${assignment.id}` && (
                            <div style={{ position: 'fixed', top: menuPosition.top, left: menuPosition.left, zIndex: 9999, maxHeight: '320px' }} className="w-56 bg-white rounded-lg shadow-xl border border-[#d8b6c8] overflow-y-auto">
                              <div className="px-4 py-2 text-xs font-bold text-[#7A0A4A] border-b border-[#efdce6]">Changer la priorité</div>
                              <button
                                onClick={() => handleChangePriority(assignment.id, 'Haute')}
                                className="w-full text-left px-4 py-2 hover:bg-[#fce8ef] flex items-center gap-2 text-sm"
                              >
                                🔴 Haute
                              </button>
                              <button
                                onClick={() => handleChangePriority(assignment.id, 'Normale')}
                                className="w-full text-left px-4 py-2 hover:bg-[#f8edf3] flex items-center gap-2 text-sm"
                              >
                                🔵 Normale
                              </button>
                              <button
                                onClick={() => handleChangePriority(assignment.id, 'Basse')}
                                className="w-full text-left px-4 py-2 hover:bg-[#f8edf3] flex items-center gap-2 text-sm border-b border-[#efdce6]"
                              >
                                ⚪ Basse
                              </button>
                              <button
                                onClick={() => {
                                  handleValidateSaisisseur(assignment.id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-[#eefcf4] flex items-center gap-2 text-sm"
                              >
                                ✅ Approuver la soumission
                              </button>
                              <button
                                onClick={() => {
                                  handleRejectSaisisseur(assignment.id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-[#fff1f1] text-[#ca5f8f] flex items-center gap-2 text-sm"
                              >
                                🛠️ Demander des corrections
                              </button>
                              <button
                                onClick={() => {
                                  handleOpenSubmissionPreview(assignment.id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-[#f8edf3] flex items-center gap-2 text-sm border-t border-[#efdce6]"
                              >
                                🔍 Aperçu de la soumission
                              </button>
                              {isAssignmentArchived ? (
                                <button
                                  onClick={() => {
                                    handleUnarchiveAssignment(assignment.id);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-[#f8edf3] flex items-center gap-2 text-sm border-t border-[#efdce6]"
                                >
                                  ↩️ Désarchiver la tâche
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    handleArchiveAssignment(assignment.id);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-[#f8edf3] flex items-center gap-2 text-sm border-t border-[#efdce6]"
                                >
                                  📦 Archiver la tâche
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  handleDeleteAssignment(assignment.id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-[#fce8ef] text-[#ca5f8f] flex items-center gap-2 text-sm border-t border-[#efdce6] rounded-b-lg"
                              >
                                🗑️ Supprimer
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {/* Section Gestion des Thèmes */}
      {activeTab === 'themes' && (
        <>
          <div className="flex justify-between items-center mb-6 bg-white border-2 border-[#d8b6c8] px-6 py-4 rounded-3xl shadow-[0_10px_20px_rgba(122,10,74,0.12)]">
            <h1 className="text-3xl font-black text-[#7A0A4A]">📊 Gestion des Thèmes</h1>
            <div className="text-lg font-bold text-[#7A0A4A] bg-[#f4e3ed] px-4 py-2 rounded-xl border border-[#d8b6c8]">
              Total: {allThemes.length} thème(s)
            </div>
          </div>

          {/* Tableau des thèmes */}
          <div className="bg-white border-2 border-[#d8b6c8] rounded-3xl overflow-hidden shadow-[0_10px_20px_rgba(122,10,74,0.12)]">
            <table className="w-full">
              <thead className="bg-[#7A0A4A] text-white border-b border-[#B03372]">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-bold uppercase tracking-wider w-12"></th>
                  <th className="px-6 py-3 text-left text-sm font-bold uppercase tracking-wider">Thème</th>
                  <th className="px-6 py-3 text-center text-sm font-bold uppercase tracking-wider w-32">Statut</th>
                  <th className="px-6 py-3 text-center text-sm font-bold uppercase tracking-wider w-32">Archivage</th>
                  <th className="px-6 py-3 text-center text-sm font-bold uppercase tracking-wider w-32">Sous-thèmes</th>
                  <th className="px-6 py-3 text-center text-sm font-bold uppercase tracking-wider w-40">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {allThemes.map((theme) => (
                  <React.Fragment key={theme.id}>
                    {/* Ligne Thème */}
                    <tr className="hover:bg-[#fcf4f8] transition">
                      <td className="px-6 py-4">
                        <button
                          onClick={() => toggleThemeExpansion(theme.id)}
                          className="text-[#7A0A4A] hover:text-[#5E0738] font-bold text-xl"
                        >
                          {expandedThemes[theme.id] ? '▼' : '▶'}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-[#4d1734]">{theme.titre}</div>
                        <div className="text-xs text-[#9a6f85]">ID: {theme.id}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          theme.is_visible 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {theme.is_visible ? '🌐 Public' : '🔒 Privé'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          theme.archived 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {theme.archived ? '📦 Archivé' : '✓ Actif'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-[#7A0A4A] font-semibold">
                          {theme.sous_themes?.length || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => toggleThemeVisibility(theme.id, theme.is_visible)}
                            className={`px-3 py-1 rounded font-bold text-xs ${
                              theme.is_visible
                                ? 'bg-gray-300 hover:bg-gray-400 text-gray-800'
                                : 'bg-green-500 hover:bg-green-600 text-white'
                            }`}
                            title={theme.is_visible ? 'Rendre privé' : 'Rendre public'}
                          >
                            {theme.is_visible ? '🔒 Privé' : '🌐 Public'}
                          </button>
                          <button
                            onClick={() => toggleThemeArchive(theme.id, theme.archived)}
                            className={`px-3 py-1 rounded font-bold text-xs ${
                              theme.archived
                                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                                : 'bg-red-300 hover:bg-red-400 text-red-800'
                            }`}
                            title={theme.archived ? 'Désarchiver' : 'Archiver'}
                          >
                            {theme.archived ? '↩ Restaurer' : '📦 Archiver'}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Sous-thèmes (affichés si thème expandé) */}
                    {expandedThemes[theme.id] && theme.sous_themes && theme.sous_themes.length > 0 && (
                      theme.sous_themes.map((subTheme) => (
                        <tr key={subTheme.id} className="bg-[#fcf4f8] hover:bg-[#f7eaf1] transition">
                          <td className="px-6 py-3"></td>
                          <td className="px-6 py-3 pl-12">
                            <div className="flex items-center">
                              <span className="text-[#B03372] mr-2">└─</span>
                              <div>
                                <div className="flex items-center gap-3">
                                  <div className="font-semibold text-[#4d1734]">{subTheme.nom}</div>
                                  {/* 'Visiteur' button removed from admin themes list */}
                                </div>
                                <div className="text-xs text-[#9a6f85]">ID: {subTheme.id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                              subTheme.is_visible 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {subTheme.is_visible ? '🌐 Public' : '🔒 Privé'}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                              subTheme.archived 
                                ? 'bg-red-100 text-red-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {subTheme.archived ? '📦 Archivé' : '✓ Actif'}
                            </span>
                          </td>
                          <td className="px-6 py-3"></td>
                          <td className="px-6 py-3 text-center">
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => toggleSubThemeVisibility(subTheme.id, subTheme.is_visible)}
                                className={`px-2 py-1 rounded font-bold text-xs ${
                                  subTheme.is_visible
                                    ? 'bg-gray-300 hover:bg-gray-400 text-gray-800'
                                    : 'bg-green-500 hover:bg-green-600 text-white'
                                }`}
                                title={subTheme.is_visible ? 'Rendre privé' : 'Rendre public'}
                              >
                                {subTheme.is_visible ? '🔒' : '🌐'}
                              </button>
                              <button
                                onClick={() => toggleSubThemeArchive(subTheme.id, subTheme.archived)}
                                className={`px-2 py-1 rounded font-bold text-xs ${
                                  subTheme.archived
                                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                                    : 'bg-red-300 hover:bg-red-400 text-red-800'
                                }`}
                                title={subTheme.archived ? 'Désarchiver' : 'Archiver'}
                              >
                                {subTheme.archived ? '↩' : '📦'}
                              </button>
                                {/* 'Visiteur' button removed from admin actions */}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}

                    {/* Message si aucun sous-thème */}
                    {expandedThemes[theme.id] && (!theme.sous_themes || theme.sous_themes.length === 0) && (
                      <tr className="bg-[#fcf4f8]">
                        <td colSpan="6" className="px-6 py-3 text-center text-gray-500 italic">
                          Aucun sous-thème pour ce thème
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>

            {allThemes.length === 0 && (
              <div className="p-8 text-center text-gray-500 italic font-semibold">
                📭 Aucun thème créé
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal - Ajouter Utilisateur */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white border-2 border-[#d8b6c8] p-8 rounded-3xl w-full max-w-md shadow-[0_16px_32px_rgba(122,10,74,0.24)]">
            <h2 className="text-3xl font-black mb-6 text-center text-[#7A0A4A]">➕ Ajouter Utilisateur</h2>
            {errorMessage && (
              <div className="mb-4 p-4 bg-[#ca5f8f] border border-[#b85282] text-white rounded-xl font-bold">
                ⚠️ {errorMessage}
              </div>
            )}
            <form onSubmit={handleAddSaisisseur}>
              <div className="mb-4">
                <label className="block text-sm font-bold mb-2 text-[#7A0A4A]">Nom Complet</label>
                <input
                  type="text"
                  required
                  value={newSaisisseur.name}
                  onChange={(e) => setNewSaisisseur({ ...newSaisisseur, name: e.target.value })}
                  className="w-full px-3 py-2 border border-[#d8b6c8] rounded-lg outline-none font-semibold focus:border-[#B03372]"
                  placeholder="Nom et Prénom"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-bold mb-2 text-[#7A0A4A]">Email</label>
                <input
                  type="email"
                  required
                  value={newSaisisseur.email}
                  onChange={(e) => setNewSaisisseur({ ...newSaisisseur, email: e.target.value })}
                  className="w-full px-3 py-2 border border-[#d8b6c8] rounded-lg outline-none font-semibold focus:border-[#B03372]"
                  placeholder="email@exemple.com"
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-bold mb-2 text-[#7A0A4A]">Rôle</label>
                <select
                  value={newSaisisseur.role}
                  onChange={(e) => setNewSaisisseur({ ...newSaisisseur, role: e.target.value })}
                  className="w-full px-3 py-2 border border-[#d8b6c8] rounded-lg outline-none font-semibold bg-white text-[#4d1734] focus:border-[#B03372]"
                >
                  <option value="SAISISSEUR">Saisisseur</option>
                  <option value="ADMIN">Administrateur</option>
                </select>
              </div>
              <div className="flex gap-4 mt-8">
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-[#7A0A4A] text-white border border-[#B03372] rounded-xl font-bold hover:bg-[#5E0738] shadow-[0_8px_16px_rgba(122,10,74,0.25)] transition"
                >
                  ✓ Ajouter
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-3 bg-white text-[#7A0A4A] border border-[#B03372] rounded-xl font-bold hover:bg-[#f7eaf1] shadow-[0_6px_12px_rgba(122,10,74,0.16)] transition"
                >
                  ✕ Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal - Boîte de Réception */}
      {showRequestsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl border-2 border-[#d8b6c8] p-6 max-w-5xl w-full my-8 max-h-[90vh] overflow-auto shadow-[0_16px_32px_rgba(122,10,74,0.24)]">
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-[#7A0A4A]">📬 Boîte de Réception des Demandes</h2>
              <button
                onClick={() => setShowRequestsModal(false)}
                className="text-[#9a6f85] hover:text-[#7A0A4A] text-2xl"
              >
                ✕
              </button>
            </div>

            {userRequests.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Aucune demande
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[#f8edf3] border-b border-[#e5c9d7] text-[#7A0A4A]">
                      <th className="px-4 py-3 text-left font-semibold">Nom</th>
                      <th className="px-4 py-3 text-left font-semibold">Email</th>
                      <th className="px-4 py-3 text-left font-semibold">Rôle Demandé</th>
                      <th className="px-4 py-3 text-left font-semibold">Statut</th>
                      <th className="px-4 py-3 text-left font-semibold">Demande</th>
                      <th className="px-4 py-3 text-left font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userRequests.map((req) => (
                      <tr key={req.id} className="border-b border-[#efdce6] hover:bg-[#fcf4f8] transition">
                        <td className="px-4 py-3 font-medium">{req.requester_name}</td>
                        <td className="px-4 py-3 text-sm text-[#6b2949]">{req.requester_email}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-[#f4e3ed] text-[#7A0A4A] rounded text-xs font-medium">
                            {getRoleLabel(req.requested_role)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={req.statut}
                            onChange={(e) => handleUpdateRequestStatus(req.id, e.target.value)}
                            className={`px-2 py-1 border rounded text-sm font-medium cursor-pointer focus:outline-none
                              ${req.statut === 'Nouveau' ? 'bg-yellow-50 border-yellow-200' : 
                                req.statut === 'Approuvé' ? 'bg-green-50 border-green-200' :
                                req.statut === 'Rejeté' ? 'bg-red-50 border-red-200' :
                                'bg-blue-50 border-blue-200'}
                            `}
                          >
                            <option value="Nouveau">🆕 Nouveau</option>
                            <option value="En attente">⏳ En attente</option>
                            <option value="Approuvé">✓ Approuvé</option>
                            <option value="Rejeté">✗ Rejeté</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#6b2949] max-w-xs truncate" title={req.demande_texte || ''}>
                          {req.demande_texte || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleResetPassword(req.id)}
                            className="px-3 py-1 bg-[#B03372] text-white rounded hover:bg-[#8f245e] text-xs font-medium transition"
                            title="Réinitialiser le mot de passe"
                          >
                            🔑 Mot de passe
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2 sticky bottom-0 bg-white pt-4">
              <button
                onClick={() => setShowRequestsModal(false)}
                className="px-4 py-2 bg-[#7A0A4A] text-white rounded hover:bg-[#5E0738] transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {showNotificationsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl border-2 border-[#d8b6c8] p-6 max-w-4xl w-full my-8 max-h-[90vh] overflow-auto shadow-[0_16px_32px_rgba(122,10,74,0.24)]">
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-[#7A0A4A]">🔔 Messages reçus</h2>
              <button
                onClick={() => setShowNotificationsModal(false)}
                className="text-[#9a6f85] hover:text-[#7A0A4A] text-2xl"
              >
                ✕
              </button>
            </div>

            {submissionNotifications.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Aucun message reçu
              </div>
            ) : (
              <div className="space-y-3">
                {submissionNotifications.map((item) => {
                  const matchedUser = saisisseurs.find((user) => user.id === item.assignment.user);
                  const userName = item.assignment.user_name || matchedUser?.first_name || 'Utilisateur';
                  const taskLabel = item.assignment.sous_theme_nom
                    ? `${item.assignment.theme_titre ? `${item.assignment.theme_titre} > ` : ''}${item.assignment.sous_theme_nom}`
                    : item.assignment.theme_titre || '—';
                  const isUnread = item.marker && seenSubmissionMarkers[String(item.assignment.id)] !== item.marker;

                  return (
                    <button
                      key={item.assignment.id}
                      type="button"
                      onClick={async () => {
                        await handleOpenSubmissionPreview(item.assignment.id);
                        setShowNotificationsModal(false);
                      }}
                      className={`w-full text-left border rounded-xl p-4 transition ${isUnread ? 'border-[#B03372] bg-[#fff7db] hover:bg-[#ffefb3]' : 'border-[#e5c9d7] bg-white hover:bg-[#fcf4f8]'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-bold text-[#7A0A4A]">{userName}</div>
                          <div className="text-sm text-[#6b2949] mt-1">{taskLabel}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isUnread && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#b85282] text-white">Nouveau</span>
                          )}
                          <span className="text-xs text-[#8c4f6a]">{item.submittedAt ? formatAssignmentDate(item.submittedAt) : '—'}</span>
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-[#4d1734] whitespace-pre-wrap">
                        {item.comment || 'Soumission reçue sans commentaire.'}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2 sticky bottom-0 bg-white pt-4">
              <button
                onClick={() => setShowNotificationsModal(false)}
                className="px-4 py-2 bg-[#7A0A4A] text-white rounded hover:bg-[#5E0738] transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Aperçu Soumission Saisisseur */}
      {previewModalOpen && previewContent && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border-2 border-[#d8b6c8] p-6 max-w-4xl w-full max-h-[90vh] overflow-auto shadow-[0_16px_32px_rgba(122,10,74,0.24)]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-[#7A0A4A]">Aperçu de la soumission — {previewContent.assignment.theme_titre}{previewContent.assignment.sous_theme_nom ? ` > ${previewContent.assignment.sous_theme_nom}` : ''}</h2>
              <button onClick={() => setPreviewModalOpen(false)} className="text-[#9a6f85] hover:text-[#7A0A4A] text-2xl">✕</button>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="border border-[#e5c9d7] rounded-lg p-3 bg-[#fcf4f8]">
                  <div className="text-xs text-[#8c4f6a]">Lignes tableau</div>
                  <div className="text-2xl font-black text-[#7A0A4A]">{Array.isArray(previewContent.notes.tables) ? previewContent.notes.tables.length : 0}</div>
                </div>
                <div className="border border-[#e5c9d7] rounded-lg p-3 bg-[#fcf4f8]">
                  <div className="text-xs text-[#8c4f6a]">Colonnes</div>
                  <div className="text-2xl font-black text-[#7A0A4A]">{(Array.isArray(previewContent.notes.columns_order) && previewContent.notes.columns_order.length > 0
                    ? previewContent.notes.columns_order.length
                    : Object.keys(previewContent.notes.tables?.[0] || {}).length)}</div>
                </div>
                <div className="border border-[#e5c9d7] rounded-lg p-3 bg-[#fcf4f8]">
                  <div className="text-xs text-[#8c4f6a]">Graphiques</div>
                  <div className="text-2xl font-black text-[#7A0A4A]">{Array.isArray(previewContent.notes.charts) ? previewContent.notes.charts.length : 0}</div>
                </div>
              </div>

              {String(previewContent.notes.last_submit_comment || '').trim() !== '' && (
                <div>
                  <h3 className="font-bold mb-2">Message du saisisseur</h3>
                  <div className="border border-[#e5c9d7] rounded-lg p-3 bg-[#fff7db] text-[#5E0738] whitespace-pre-wrap">
                    {String(previewContent.notes.last_submit_comment || '').trim()}
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-bold mb-2">Métadonnées</h3>
                {Object.entries(previewContent.notes.meta || {}).filter(([, value]) => String(value || '').trim() !== '').length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {Object.entries(previewContent.notes.meta || {}).filter(([, value]) => String(value || '').trim() !== '').map(([key, value]) => (
                      <div key={key} className="border border-[#e5c9d7] rounded-lg p-3 bg-[#fcf4f8]">
                        <div className="text-xs uppercase tracking-wide text-[#8c4f6a]">{key}</div>
                        <div className="text-sm text-[#4d1734] mt-1 whitespace-pre-wrap">{String(value)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-600">Aucune métadonnée renseignée</div>
                )}
              </div>

              <div>
                <h3 className="font-bold mb-2">Graphiques</h3>
                {Array.isArray(previewContent.notes.charts) && previewContent.notes.charts.length > 0 ? (
                  <div className="space-y-2">
                    {previewContent.notes.charts.map((chart, index) => (
                      <div key={index} className="border border-[#e5c9d7] rounded-lg p-3 bg-white">
                        <div className="font-semibold text-[#7A0A4A]">{chart.title || `Graphique ${index + 1}`}</div>
                        <div className="text-sm text-[#4d1734] mt-1">
                          Type: {chart.type || '—'} | X: {chart.x || '—'} | Y: {chart.y || '—'}
                        </div>
                        {(chart.filter_column || chart.filter_value) && (
                          <div className="text-xs text-[#8c4f6a] mt-1">
                            Filtre principal: {chart.filter_column || '—'} = {chart.filter_value || '—'} ({chart.filter_mode || 'include'})
                          </div>
                        )}
                        {Array.isArray(chart.filters) && chart.filters.length > 0 && (
                          <div className="text-xs text-[#8c4f6a] mt-1">
                            Filtres additionnels: {chart.filters.map((f) => `${f.column || 'col'}=${f.value || ''}`).join(' | ')}
                          </div>
                        )}
                        <div className="mt-3 h-52 border border-[#efdce6] rounded bg-[#fffafb] p-2">
                          {(() => {
                            const previewData = makeChartPreviewData(chart, previewContent.notes);
                            const isArrayData = Array.isArray(previewData);
                            const hasData = isArrayData
                              ? previewData.length > 0
                              : Boolean(
                                  (Array.isArray(previewData?.seriesData) && previewData.seriesData.length > 0) ||
                                  (Array.isArray(previewData?.pieData) && previewData.pieData.length > 0) ||
                                  (previewData?.scatterSeriesData && Object.keys(previewData.scatterSeriesData).length > 0)
                                );

                            if (!hasData) {
                              return <div className="h-full flex items-center justify-center text-sm text-gray-500">Données insuffisantes pour l'aperçu</div>;
                            }

                            if (chart.type === 'Secteur') {
                              const pieData = Array.isArray(previewData)
                                ? previewData
                                : (previewData?.pieData || []);
                              return (
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={70} label>
                                      {pieData.map((_, idx) => (
                                        <Cell key={`slice-${idx}`} fill={PREVIEW_CHART_COLORS[idx % PREVIEW_CHART_COLORS.length]} />
                                      ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                  </PieChart>
                                </ResponsiveContainer>
                              );
                            }

                            if (chart.type === 'Nuage de points') {
                              if (!Array.isArray(previewData) && previewData?.grouped && previewData?.scatterSeriesData) {
                                return (
                                  <ResponsiveContainer width="100%" height="100%">
                                    <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                                      <CartesianGrid strokeDasharray="3 3" />
                                      <XAxis dataKey="x" type="number" />
                                      <YAxis dataKey="y" type="number" />
                                      <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                                      <Legend />
                                      {previewData.groupValues.map((g, idx) => (
                                        <Scatter
                                          key={g}
                                          name={g}
                                          data={previewData.scatterSeriesData[g] || []}
                                          fill={PREVIEW_CHART_COLORS[idx % PREVIEW_CHART_COLORS.length]}
                                        />
                                      ))}
                                    </ScatterChart>
                                  </ResponsiveContainer>
                                );
                              }

                              return (
                                <ResponsiveContainer width="100%" height="100%">
                                  <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="x" type="number" />
                                    <YAxis dataKey="y" type="number" />
                                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                                    <Scatter data={previewData} fill="#B03372" />
                                  </ScatterChart>
                                </ResponsiveContainer>
                              );
                            }

                            if (chart.type === 'Courbe' || chart.type === 'Courbes') {
                              if (!Array.isArray(previewData) && previewData?.grouped && Array.isArray(previewData?.seriesData)) {
                                return (
                                  <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={previewData.seriesData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                                      <CartesianGrid strokeDasharray="3 3" />
                                      <XAxis dataKey="name" />
                                      <YAxis />
                                      <Tooltip />
                                      <Legend />
                                      {previewData.groupValues.map((g, idx) => (
                                        <Line
                                          key={g}
                                          type="monotone"
                                          dataKey={g}
                                          stroke={PREVIEW_CHART_COLORS[idx % PREVIEW_CHART_COLORS.length]}
                                          strokeWidth={2}
                                          dot={false}
                                        />
                                      ))}
                                    </LineChart>
                                  </ResponsiveContainer>
                                );
                              }

                              return (
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={previewData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Line type="monotone" dataKey="value" stroke="#7A0A4A" strokeWidth={2} dot={false} />
                                  </LineChart>
                                </ResponsiveContainer>
                              );
                            }

                            if (!Array.isArray(previewData) && previewData?.grouped && Array.isArray(previewData?.seriesData)) {
                              return (
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={previewData.seriesData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    {previewData.groupValues.map((g, idx) => (
                                      <Bar key={g} dataKey={g} fill={PREVIEW_CHART_COLORS[idx % PREVIEW_CHART_COLORS.length]} radius={[3, 3, 0, 0]} />
                                    ))}
                                  </BarChart>
                                </ResponsiveContainer>
                              );
                            }

                            return (
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={previewData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="name" />
                                  <YAxis />
                                  <Tooltip />
                                  <Bar dataKey="value" fill="#7A0A4A" radius={[4, 4, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-600">Aucun graphique soumis</div>
                )}
              </div>

              <div>
                <h3 className="font-bold mb-2">Tableau (aperçu)</h3>
                {Array.isArray(previewContent.notes.tables) && previewContent.notes.tables.length > 0 ? (
                  (() => {
                    const columns = (Array.isArray(previewContent.notes.columns_order) && previewContent.notes.columns_order.length > 0
                      ? previewContent.notes.columns_order
                      : Object.keys(previewContent.notes.tables[0] || {}));
                    const allRows = previewContent.notes.tables || [];
                    const pageSize = previewPageSize === -1 ? allRows.length || 1 : previewPageSize;
                    const totalPages = Math.max(1, Math.ceil(allRows.length / pageSize));
                    const safePage = Math.min(previewTablePage, totalPages);
                    const start = (safePage - 1) * pageSize;
                    const pageRows = allRows.slice(start, start + pageSize);

                    return (
                      <>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="text-xs text-[#8c4f6a]">Colonnes: {columns.length}</div>
                          <div className="flex items-center gap-2 text-sm">
                            <label className="text-[#6b2949]">Lignes par page</label>
                            <select
                              value={previewPageSize}
                              onChange={(e) => {
                                setPreviewPageSize(Number(e.target.value));
                                setPreviewTablePage(1);
                              }}
                              className="border border-[#d8b6c8] rounded px-2 py-1 bg-white text-[#7A0A4A]"
                            >
                              <option value={12}>12</option>
                              <option value={25}>25</option>
                              <option value={50}>50</option>
                              <option value={100}>100</option>
                              <option value={-1}>Tout afficher</option>
                            </select>
                          </div>
                        </div>

                        <div className="overflow-auto border border-[#e5c9d7] rounded-lg">
                          <table className="w-full table-auto text-sm">
                            <thead className="bg-[#f8edf3] text-[#7A0A4A]">
                              <tr>
                                {columns.map((header) => (
                                  <th key={header} className="px-2 py-1 text-left border-b border-[#e5c9d7]">{header}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {pageRows.map((row, rowIdx) => (
                                <tr key={rowIdx} className="border-t border-[#efdce6] odd:bg-white even:bg-[#fcf4f8]">
                                  {columns.map((header, colIdx) => (
                                    <td key={`${rowIdx}-${colIdx}`} className="px-2 py-1">{String(row?.[header] ?? '')}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="mt-3 flex items-center justify-between text-sm text-[#6b2949]">
                          <div>
                            Lignes {start + 1} à {Math.min(start + pageSize, allRows.length)} sur {allRows.length}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={safePage <= 1}
                              onClick={() => setPreviewTablePage((p) => Math.max(1, p - 1))}
                              className={`px-3 py-1 border rounded ${safePage <= 1 ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-white text-[#7A0A4A] border-[#d8b6c8] hover:bg-[#f7eaf1]'}`}
                            >
                              Précédent
                            </button>
                            <span className="font-semibold">Page {safePage} / {totalPages}</span>
                            <button
                              type="button"
                              disabled={safePage >= totalPages}
                              onClick={() => setPreviewTablePage((p) => Math.min(totalPages, p + 1))}
                              className={`px-3 py-1 border rounded ${safePage >= totalPages ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-white text-[#7A0A4A] border-[#d8b6c8] hover:bg-[#f7eaf1]'}`}
                            >
                              Suivant
                            </button>
                          </div>
                        </div>
                      </>
                    );
                  })()
                ) : (
                  <div className="text-sm text-gray-600">Aucun tableau soumis</div>
                )}
              </div>

              {/* Configuration Visiteur soumise par le saisisseur */}
              {previewContent.notes.visitor_config && typeof previewContent.notes.visitor_config === 'object' && (
                <div>
                  <h3 className="font-bold mb-2">Configuration Visiteur (soumise par le saisisseur)</h3>
                  <div className="border border-[#e5c9d7] rounded-lg p-4 bg-[#fcf4f8] space-y-3">
                    {(() => {
                      const vc = previewContent.notes.visitor_config;
                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <div className="text-xs uppercase tracking-wide text-[#8c4f6a] mb-1">Colonnes visibles</div>
                            {Array.isArray(vc.visitor_visible_columns) && vc.visitor_visible_columns.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {vc.visitor_visible_columns.map(c => (
                                  <span key={c} className="bg-[#f4e3ed] text-[#7A0A4A] px-2 py-0.5 rounded text-xs border border-[#d8b6c8]">{c}</span>
                                ))}
                              </div>
                            ) : <span className="text-sm text-gray-500">Toutes les colonnes</span>}
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-wide text-[#8c4f6a] mb-1">Filtres disponibles</div>
                            {Array.isArray(vc.visitor_filters) && vc.visitor_filters.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {vc.visitor_filters.map(f => (
                                  <span key={f} className="bg-[#f4e3ed] text-[#7A0A4A] px-2 py-0.5 rounded text-xs border border-[#d8b6c8]">{f}</span>
                                ))}
                              </div>
                            ) : <span className="text-sm text-gray-500">Aucun</span>}
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-wide text-[#8c4f6a] mb-1">Colonnes pivot / hiérarchie</div>
                            {Array.isArray(vc.visitor_pivot_columns) && vc.visitor_pivot_columns.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {vc.visitor_pivot_columns.map(c => (
                                  <span key={c} className="bg-[#f4e3ed] text-[#7A0A4A] px-2 py-0.5 rounded text-xs border border-[#d8b6c8]">{c}</span>
                                ))}
                              </div>
                            ) : <span className="text-sm text-gray-500">Aucune</span>}
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-wide text-[#8c4f6a] mb-1">Vue par défaut</div>
                            <span className="text-sm text-[#4d1734]">{vc.visitor_default_view === 'vertical' ? 'Verticale' : 'Horizontale'}</span>
                          </div>
                          {vc.visitor_default_filters && Object.keys(vc.visitor_default_filters).length > 0 && (
                            <div className="md:col-span-2">
                              <div className="text-xs uppercase tracking-wide text-[#8c4f6a] mb-1">Filtres par défaut</div>
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(vc.visitor_default_filters).map(([k, v]) => (
                                  <span key={k} className="bg-[#f4e3ed] text-[#7A0A4A] px-2 py-0.5 rounded text-xs border border-[#d8b6c8]">{k} = {String(v)}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setPreviewModalOpen(false)} className="px-4 py-2 bg-[#f4e3ed] text-[#7A0A4A] border border-[#d8b6c8] rounded">Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal - Configuration Visiteur par Sous-thème */}
      {configModalOpen && configSubTheme && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white border-2 border-[#d8b6c8] p-6 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-[0_16px_32px_rgba(122,10,74,0.24)]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-black text-[#7A0A4A]">Configurer la vue Visiteur — {configSubTheme.nom}</h2>
              <button onClick={() => setConfigModalOpen(false)} className="text-[#9a6f85] hover:text-[#7A0A4A] text-2xl">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="font-bold mb-2 block">Colonnes disponibles</label>
                <div className="space-y-2 max-h-64 overflow-y-auto p-2 bg-[#fcf4f8] rounded border border-[#e5c9d7]">
                  {(configSubTheme.columns && configSubTheme.columns.length ? configSubTheme.columns : Object.keys((configSubTheme.data && configSubTheme.data[0]) || {})).map(c => (
                    <label key={c} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="w-4 h-4" checked={modalVisitorCols.includes(c)} onChange={(e) => {
                        if (e.target.checked) setModalVisitorCols(prev => Array.from(new Set([...prev, c])));
                        else setModalVisitorCols(prev => prev.filter(x => x !== c));
                      }} />
                      <span>{c}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold mb-2 block">Filtres disponibles</label>
                <div className="space-y-2 max-h-64 overflow-y-auto p-2 bg-[#fcf4f8] rounded border border-[#e5c9d7]">
                  {(configSubTheme.columns && configSubTheme.columns.length ? configSubTheme.columns : Object.keys((configSubTheme.data && configSubTheme.data[0]) || {})).map(c => (
                    <label key={`f-${c}`} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="w-4 h-4" checked={modalVisitorFilters.includes(c)} onChange={(e) => {
                        if (e.target.checked) setModalVisitorFilters(prev => Array.from(new Set([...prev, c])));
                        else setModalVisitorFilters(prev => prev.filter(x => x !== c));
                        if (!e.target.checked) setModalVisitorDefaultFilters(prev => { const copy = {...prev}; delete copy[c]; return copy; });
                      }} />
                      <span>{c}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold mb-2 block">Filtres par défaut</label>
                <div className="space-y-2 max-h-64 overflow-y-auto p-2 bg-[#fcf4f8] rounded border border-[#e5c9d7]">
                  {modalVisitorFilters.length === 0 && <div className="text-sm text-gray-600">Aucun filtre sélectionné</div>}
                  {modalVisitorFilters.map(f => {
                    const opts = Array.from(new Set((configSubTheme.data || []).map(r => r && r[f]).filter(v => v !== null && v !== undefined)));
                    return (
                      <div key={`d-${f}`} className="text-sm">
                        <label className="block font-semibold">{f}</label>
                        <select className="w-full p-2 rounded border border-[#d8b6c8]" value={modalVisitorDefaultFilters[f] ?? ''} onChange={(e) => setModalVisitorDefaultFilters(prev => ({...prev, [f]: e.target.value}))}>
                          <option value="">-- Aucun --</option>
                          {opts.map(o => <option key={String(o)} value={String(o)}>{String(o)}</option>)}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button className="px-4 py-2 bg-[#7A0A4A] text-white rounded font-bold hover:bg-[#5E0738]" onClick={async () => {
                try {
                  const payload = {
                    visitor_visible_columns: modalVisitorCols,
                    visitor_filters: modalVisitorFilters,
                    visitor_default_filters: modalVisitorDefaultFilters
                  };
                  await axios.patch(`${API_BASE}/sousthemes/${configSubTheme.id}/`, payload);
                  // update local state
                  setSubThemes(prev => prev.map(x => x.id === configSubTheme.id ? { ...x, ...payload } : x));
                  // also update themes list to keep UI consistent
                  setThemes(prev => prev.map(t => ({ ...t, sous_themes: t.sous_themes?.map(st => st.id === configSubTheme.id ? { ...st, ...payload } : st) })));
                  setConfigModalOpen(false);
                  alert('Configuration visiteur sauvegardée.');
                } catch (err) {
                  console.error('Erreur sauvegarde config visiteur', err);
                  alert('Erreur lors de la sauvegarde');
                }
              }}>Enregistrer</button>

              <button className="px-4 py-2 bg-[#f4e3ed] text-[#7A0A4A] border border-[#d8b6c8] rounded font-bold" onClick={() => {
                // reset modal to original values
                setModalVisitorCols(configSubTheme.visitor_visible_columns || []);
                setModalVisitorFilters(configSubTheme.visitor_filters || configSubTheme.filtres_disponibles || []);
                setModalVisitorDefaultFilters(configSubTheme.visitor_default_filters || {});
              }}>Recharger</button>

              <div className="flex-1" />
              <button className="px-4 py-2 bg-[#B03372] text-white rounded font-bold hover:bg-[#8f245e]" onClick={() => setConfigModalOpen(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default AdministratorsPage;
