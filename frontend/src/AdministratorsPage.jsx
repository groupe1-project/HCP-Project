import React, { useState, useEffect } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from 'docx';
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

function DraggableChip({ id, children, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between gap-2 px-2 py-1 rounded border border-[#d8b6c8] bg-white"
    >
      <button type="button" className="text-left flex-1 cursor-grab" {...attributes} {...listeners} title="Glisser pour réordonner">
        {children}
      </button>
      <button type="button" onClick={onRemove} className="text-red-600 hover:text-red-800 font-bold">✕</button>
    </div>
  );
}

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
  const [modalVisitorHierarchy, setModalVisitorHierarchy] = useState([]);
  const [modalVisitorDefaultFilters, setModalVisitorDefaultFilters] = useState({});
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState(null);
  const [previewTablePage, setPreviewTablePage] = useState(1);
  const [previewPageSize, setPreviewPageSize] = useState(-1);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportTheme, setReportTheme] = useState(null);
  const [reportOptions, setReportOptions] = useState({
    selectedSubThemeIds: [],
    language: 'fr',
    includeCharts: true,
    tableView: 'horizontal',
  });
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportContext, setReportContext] = useState(null);
  const [reportPreviewLanguage, setReportPreviewLanguage] = useState('fr');
  const [showAdminAssistant, setShowAdminAssistant] = useState(false);
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState([
    {
      role: 'assistant',
      text: "Bonjour, je suis l'assistant admin. Je peux vous aider pour les stats, archives, métadonnées et rapports.",
      mode: 'fallback',
      timestamp: new Date().toISOString(),
    },
  ]);
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
          setModalVisitorHierarchy(Array.isArray(found.visitor_pivot_columns) ? found.visitor_pivot_columns : []);
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
            Espace Saisisseur
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

  const openReportModalForTheme = (theme) => {
    const allSubThemeIds = (theme?.sous_themes || []).map((st) => st.id);
    setReportTheme(theme);
    setReportOptions({
      selectedSubThemeIds: allSubThemeIds,
      language: 'fr',
      includeCharts: true,
      tableView: 'horizontal',
    });
    setReportContext(null);
    setReportPreviewLanguage('fr');
    setReportModalOpen(true);
  };

  const closeReportModal = () => {
    setReportModalOpen(false);
    setReportTheme(null);
    setReportContext(null);
  };

  const toggleReportSubTheme = (subThemeId) => {
    setReportOptions((prev) => {
      const exists = prev.selectedSubThemeIds.includes(subThemeId);
      return {
        ...prev,
        selectedSubThemeIds: exists
          ? prev.selectedSubThemeIds.filter((id) => id !== subThemeId)
          : [...prev.selectedSubThemeIds, subThemeId],
      };
    });
  };

  const generateReportContext = async () => {
    if (!reportTheme) return;
    if (!reportOptions.selectedSubThemeIds.length) {
      alert('Sélectionnez au moins un sous-thème pour générer le rapport.');
      return;
    }

    try {
      setIsGeneratingReport(true);
      const payload = {
        sous_theme_ids: reportOptions.selectedSubThemeIds,
        language: reportOptions.language,
        include_charts: reportOptions.includeCharts,
        table_view: reportOptions.tableView,
      };
      const response = await axios.post(
        `${API_BASE}/themes/${reportTheme.id}/generate-report-context/`,
        payload,
        getAdminAuthConfig()
      );
      setReportContext(response.data);
    } catch (error) {
      console.error('Erreur génération rapport:', error);
      alert(error.response?.data?.error || 'Erreur lors de la génération du rapport.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const downloadReportContext = () => {
    if (!reportContext || !reportTheme) return;
    const safeName = String(reportTheme.titre || 'rapport').replace(/[^a-zA-Z0-9-_]+/g, '_');
    const blob = new Blob([JSON.stringify(reportContext, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rapport_${safeName}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const getReportFileBase = () => {
    const title = reportContext?.theme?.title_fr || reportTheme?.titre || 'rapport';
    return String(title).replace(/[^a-zA-Z0-9-_]+/g, '_');
  };

  const getSectionMetadataRows = (metadataObj) => {
    if (!metadataObj || typeof metadataObj !== 'object') return [];
    const rows = [];
    Object.entries(metadataObj).forEach(([lang, fields]) => {
      if (!fields || typeof fields !== 'object') return;
      Object.entries(fields).forEach(([key, value]) => {
        if (!String(value ?? '').trim()) return;
        rows.push([`${lang.toUpperCase()} - ${key}`, String(value)]);
      });
    });
    return rows;
  };

  const getSectionTableForLanguage = (section, lang) => {
    const table = section?.table || {};
    const view = table?.view || 'horizontal';
    const langTables = table?.languages || {};
    const fallbackLang = langTables[lang] ? lang : (langTables.fr ? 'fr' : Object.keys(langTables)[0]);
    const current = langTables[fallbackLang] || {};
    const selected = current?.[view] || { headers: [], rows: [] };
    return {
      lang: fallbackLang || lang,
      view,
      headers: Array.isArray(selected?.headers) ? selected.headers : [],
      rows: Array.isArray(selected?.rows) ? selected.rows : [],
    };
  };

  const getChartNames = (section, lang = 'fr') => {
    const charts = Array.isArray(section?.charts) ? section.charts : [];
    return charts
      .map((chart, idx) => {
        const fr = String(chart?.title || '').trim();
        const ar = String(chart?.title_ar || '').trim();
        if (lang === 'ar') return ar || fr || `Graphique ${idx + 1}`;
        return fr || ar || `Graphique ${idx + 1}`;
      })
      .filter(Boolean);
  };

  const toNumericValue = (value) => {
    const n = Number(String(value ?? '').replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  const tableToObjectRows = (table) => {
    const headers = Array.isArray(table?.headers) ? table.headers : [];
    const rows = Array.isArray(table?.rows) ? table.rows : [];
    return rows.map((row) => {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = row?.[idx] ?? '';
      });
      return obj;
    });
  };

  const getChartSourceTable = (section) => {
    const langs = section?.table?.languages || {};
    if (langs?.fr?.horizontal?.headers?.length) return langs.fr.horizontal;
    const firstLang = Object.keys(langs)[0];
    if (firstLang && langs[firstLang]?.horizontal?.headers?.length) return langs[firstLang].horizontal;
    return { headers: [], rows: [] };
  };

  const normalizeChartType = (type) => {
    const t = String(type || '').toLowerCase();
    if (t.includes('pie') || t.includes('secteur') || t.includes('camembert')) return 'pie';
    if (t.includes('line') || t.includes('courbe')) return 'line';
    return 'bar';
  };

  const buildSectionChartModels = (section, lang = 'fr') => {
    const charts = Array.isArray(section?.charts) ? section.charts : [];
    const sourceTable = getChartSourceTable(section);
    const objRows = tableToObjectRows(sourceTable);
    const headers = sourceTable.headers || [];

    return charts.slice(0, 3).map((chart, idx) => {
      const xKey = chart?.x || headers[0] || 'x';
      const yKey = chart?.y || chart?.mesure || headers[1] || headers[0] || 'y';
      const type = normalizeChartType(chart?.type);
      const title = (lang === 'ar' ? chart?.title_ar : chart?.title) || chart?.title || chart?.title_ar || `Graphique ${idx + 1}`;

      if (type === 'pie') {
        const acc = new Map();
        objRows.forEach((row) => {
          const xVal = String(row?.[xKey] ?? '—');
          const yVal = toNumericValue(row?.[yKey]);
          if (yVal === null) return;
          acc.set(xVal, (acc.get(xVal) || 0) + yVal);
        });
        const data = Array.from(acc.entries()).map(([name, value]) => ({ name, value }));
        return { id: chart?.id || `chart-${idx}`, title, type, data: data.slice(0, 12), xKey: 'name', yKey: 'value' };
      }

      const data = objRows
        .map((row) => ({
          x: String(row?.[xKey] ?? ''),
          y: toNumericValue(row?.[yKey]),
        }))
        .filter((row) => row.y !== null)
        .slice(0, 40);

      return { id: chart?.id || `chart-${idx}`, title, type, data, xKey: 'x', yKey: 'y' };
    }).filter((m) => Array.isArray(m.data) && m.data.length > 0);
  };

  const exportReportPDF = () => {
    if (!reportContext) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const title = reportContext?.theme?.title_fr || reportTheme?.titre || 'Rapport';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(`Rapport Administratif - ${title}`, 40, 48);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Langue: ${reportContext?.options?.language || 'fr'} | Vue tableau: ${reportContext?.options?.table_view || 'horizontal'}`, 40, 66);

    let cursorY = 84;
    (reportContext.sections || []).forEach((section, index) => {
      if (cursorY > 700) {
        doc.addPage();
        cursorY = 42;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(`${index + 1}. ${section.sub_theme_name || 'Sous-thème'}`, 40, cursorY);
      cursorY += 14;

      const metadataRows = getSectionMetadataRows(section.metadata);
      if (metadataRows.length) {
        autoTable(doc, {
          head: [['Métadonnée', 'Valeur']],
          body: metadataRows,
          startY: cursorY,
          margin: { left: 40, right: 40 },
          theme: 'grid',
          headStyles: { fillColor: [122, 10, 74] },
          styles: { fontSize: 9, cellPadding: 4 },
        });
        cursorY = doc.lastAutoTable.finalY + 10;
      }

      const langKeys = Object.keys(section?.table?.languages || {});
      langKeys.forEach((langKey) => {
        const table = getSectionTableForLanguage(section, langKey);
        if (!table.headers.length) return;
        if (cursorY > 700) {
          doc.addPage();
          cursorY = 42;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(`Tableau (${table.lang.toUpperCase()} - ${table.view})`, 40, cursorY);
        cursorY += 8;
        autoTable(doc, {
          head: [table.headers.map((h) => String(h))],
          body: (table.rows || []).slice(0, 12).map((r) => (r || []).map((v) => String(v ?? ''))),
          startY: cursorY,
          margin: { left: 40, right: 40 },
          theme: 'striped',
          headStyles: { fillColor: [176, 51, 114] },
          styles: { fontSize: 8.5, cellPadding: 3.5 },
        });
        cursorY = doc.lastAutoTable.finalY + 10;
      });

      if (section?.charts_count) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Graphes inclus: ${section.charts_count}`, 40, cursorY);
        cursorY += 12;
        const chartNames = getChartNames(section, reportContext?.options?.language === 'ar' ? 'ar' : 'fr').slice(0, 5);
        if (chartNames.length) {
          const lines = doc.splitTextToSize(`Titres: ${chartNames.join(' | ')}`, 510);
          doc.text(lines, 40, cursorY);
          cursorY += lines.length * 11 + 4;
        }
      }
    });

    doc.save(`rapport_${getReportFileBase()}.pdf`);
  };

  const exportReportWord = async () => {
    if (!reportContext) return;

    const content = [];
    const title = reportContext?.theme?.title_fr || reportTheme?.titre || 'Rapport';
    content.push(
      new Paragraph({
        text: `Rapport Administratif - ${title}`,
        heading: HeadingLevel.HEADING_1,
      })
    );
    content.push(
      new Paragraph({
        children: [new TextRun({ text: `Langue: ${reportContext?.options?.language || 'fr'} | Vue: ${reportContext?.options?.table_view || 'horizontal'}`, italics: true })],
      })
    );

    (reportContext.sections || []).forEach((section, index) => {
      content.push(
        new Paragraph({
          text: `${index + 1}. ${section.sub_theme_name || 'Sous-thème'}`,
          heading: HeadingLevel.HEADING_2,
        })
      );

      const metadataRows = getSectionMetadataRows(section.metadata);
      if (metadataRows.length) {
        content.push(new Paragraph({ text: 'Métadonnées:', heading: HeadingLevel.HEADING_3 }));
        content.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Clé')] }),
                  new TableCell({ children: [new Paragraph('Valeur')] }),
                ],
              }),
              ...metadataRows.map((row) =>
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph(String(row[0]))] }),
                    new TableCell({ children: [new Paragraph(String(row[1]))] }),
                  ],
                })
              ),
            ],
          })
        );
      }

      const langKeys = Object.keys(section?.table?.languages || {});
      langKeys.forEach((langKey) => {
        const table = getSectionTableForLanguage(section, langKey);
        if (!table.headers.length) return;
        content.push(new Paragraph({ text: `Tableau (${table.lang.toUpperCase()} - ${table.view})`, heading: HeadingLevel.HEADING_3 }));
        content.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: table.headers.map((h) => new TableCell({ children: [new Paragraph(String(h))] })),
              }),
              ...(table.rows || []).slice(0, 12).map((row) =>
                new TableRow({
                  children: (row || []).map((cell) => new TableCell({ children: [new Paragraph(String(cell ?? ''))] })),
                })
              ),
            ],
          })
        );
      });

      if (section?.charts_count) {
        content.push(new Paragraph({ text: `Graphes inclus: ${section.charts_count}` }));
        const chartNames = getChartNames(section, reportContext?.options?.language === 'ar' ? 'ar' : 'fr').slice(0, 8);
        if (chartNames.length) {
          content.push(new Paragraph({ text: `Titres: ${chartNames.join(' | ')}` }));
        }
      }
    });

    const doc = new Document({
      sections: [{ children: content }],
    });
    const blob = await Packer.toBlob(doc);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rapport_${getReportFileBase()}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const sendAssistantMessage = async () => {
    const text = assistantInput.trim();
    if (!text || assistantLoading) return;

    const userMsg = {
      role: 'user',
      text,
      timestamp: new Date().toISOString(),
    };
    setAssistantMessages((prev) => [...prev, userMsg]);
    setAssistantInput('');

    try {
      setAssistantLoading(true);
      const response = await axios.post(
        `${API_BASE}/admin-assistant/chat/`,
        { message: text, use_ai: true },
        getAdminAuthConfig()
      );
      // Si IA répond, afficher la réponse. Sinon, afficher le fallback (secours)
      if (response?.data?.mode === 'ai') {
        setAssistantMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: response?.data?.reply || 'Aucune réponse disponible.',
            mode: 'ai',
            timestamp: new Date().toISOString(),
          },
        ]);
      } else if (response?.data?.mode === 'fallback') {
        setAssistantMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: response?.data?.reply || 'Aucune réponse disponible.',
            mode: 'fallback',
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch (error) {
      console.error('Erreur assistant admin:', error);
      setAssistantMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: "Je n'arrive pas à répondre pour le moment. Réessayez dans quelques instants.",
          mode: 'fallback',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setAssistantLoading(false);
    }
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

  const themeTicketAccents = [
    {
      themeRow: 'bg-[#fffdf8] hover:bg-[#f8f3e7]',
      subThemeRow: 'bg-[#f8f3e7] hover:bg-[#f2e9d2]',
      marker: 'text-[#7A0A4A]',
      countChip: 'bg-[#f8f3e7] text-[#7A0A4A] border-[#CCB47F]'
    },
    {
      themeRow: 'bg-[#fff8f8] hover:bg-[#f9e4e6]',
      subThemeRow: 'bg-[#fbe6ea] hover:bg-[#f4cfd8]',
      marker: 'text-[#B03372]',
      countChip: 'bg-[#f9e3ee] text-[#7A0A4A] border-[#e4bfd0]'
    },
    {
      themeRow: 'bg-[#fffaf2] hover:bg-[#f7e8cf]',
      subThemeRow: 'bg-[#f8ecda] hover:bg-[#f2e9d2]',
      marker: 'text-[#6E001F]',
      countChip: 'bg-[#f8ecda] text-[#6E001F] border-[#d6b58b]'
    },
    {
      themeRow: 'bg-[#f9f3f6] hover:bg-[#f2cadc]',
      subThemeRow: 'bg-[#f9e3ee] hover:bg-[#f2cadc]',
      marker: 'text-[#7A0A4A]',
      countChip: 'bg-[#f2cadc] text-[#7A0A4A] border-[#e4bfd0]'
    }
  ];

  return (
    <div className="min-h-screen bg-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-5 bg-white">
        {/* Header + Navigation */}
        <div className="bg-[#f9f3f6] rounded-2xl shadow-[0_4px_20px_rgba(122,10,74,0.1)] border border-[#e5c9d7] overflow-hidden">
          <div className="bg-gradient-to-r from-[#7A0A4A] to-[#B03372] px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h1 className="text-white font-bold text-xl leading-tight">Espace d'Administration</h1>
                <p className="text-white/70 text-sm mt-0.5">Gestion des utilisateurs, affectations et thèmes</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setShowAdminAssistant((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition border ${showAdminAssistant ? 'bg-white text-[#7A0A4A] border-white' : 'bg-white/10 text-white border-white/20 hover:bg-white/20'}`}
                title="Assistant Admin"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L8 21l4-2 4 2-1.75-4M4 13a8 8 0 1116 0 8 8 0 01-16 0z" />
                </svg>
                Assistant
              </button>
              <button
                onClick={async () => { await fetchSaisisseurs(); setShowNotificationsModal(true); }}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition border ${unreadSubmissionCount > 0 ? 'bg-white/20 text-white border-white/30 hover:bg-white/30' : 'bg-white/10 text-white border-white/20 hover:bg-white/20'}`}
                disabled={loading}
                title="Messages reçus des saisisseurs"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Notifications
                {unreadSubmissionCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-0.5 rounded-full bg-[#f4e3ed] text-[#7A0A4A] text-[10px] font-black flex items-center justify-center border border-white/50">
                    {unreadSubmissionCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white text-[#7A0A4A] rounded-lg text-sm font-semibold hover:bg-[#f4e3ed] transition shadow-sm"
                disabled={loading}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Ajouter
              </button>
            </div>
          </div>
          <div className="flex items-end gap-1 bg-[#f9f3f6] border-b border-[#f0e4ed] px-2 pt-1">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-6 py-3 text-sm transition-all border-b-2 -mb-px rounded-t-lg ${
                activeTab === 'users'
                  ? 'border-[#7A0A4A] text-[#7A0A4A] bg-white shadow-[0_-1px_10px_rgba(122,10,74,0.08)] font-bold py-3.5 scale-[1.02]'
                  : 'border-transparent text-[#9a6f85] hover:text-[#7A0A4A] hover:border-[#d8b6c8] hover:bg-white/70 font-semibold'
              }`}
            >
              Utilisateurs &amp; Affectations
            </button>
            <button
              onClick={() => setActiveTab('themes')}
              className={`px-6 py-3 text-sm transition-all border-b-2 -mb-px rounded-t-lg ${
                activeTab === 'themes'
                  ? 'border-[#B03372] text-[#B03372] bg-white shadow-[0_-1px_10px_rgba(122,10,74,0.08)] font-bold py-3.5 scale-[1.02]'
                  : 'border-transparent text-[#9a6f85] hover:text-[#B03372] hover:border-[#d8b6c8] hover:bg-white/70 font-semibold'
              }`}
            >
              Gestion des Thèmes
            </button>
          </div>
        </div>

        {/* Section Espace Administrateurs */}
        {activeTab === 'users' && (
          <>
            {/* Statistiques rapides */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-[#e5c9d7] p-4 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#f4e3ed] flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#7A0A4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" /></svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-[#9a6f85]">Utilisateurs</p>
                  <p className="text-2xl font-black text-[#7A0A4A] leading-none mt-0.5">{saisisseurs.length}</p>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-[#e5c9d7] p-4 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#f4e3ed] flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#B03372]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-[#9a6f85]">Affectations actives</p>
                  <p className="text-2xl font-black text-[#B03372] leading-none mt-0.5">{assignments.filter(a => a.statut !== 'Complété').length}</p>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-[#e5c9d7] p-4 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#f4e3ed] flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#B03372]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-[#9a6f85]">En attente</p>
                  <p className="text-2xl font-black text-[#B03372] leading-none mt-0.5">{assignments.filter(a => a.statut === 'En attente').length}</p>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-[#e5c9d7] p-4 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#f4e3ed] flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#B03372]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-[#9a6f85]">Terminées</p>
                  <p className="text-2xl font-black text-[#B03372] leading-none mt-0.5">{assignments.filter(a => a.statut === 'Complété').length}</p>
                </div>
              </div>
            </div>

        {/* Formulaire d'assignation */}
        <div className="bg-white border border-[#e5c9d7] rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-[#f9f3f6] border-b border-[#e5c9d7] flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#7A0A4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            <span className="text-sm font-semibold text-[#4d1734]">Assigner un thème à un utilisateur</span>
          </div>
          <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
            className="w-full px-4 py-2.5 bg-[#7A0A4A] text-white rounded-lg font-semibold text-sm hover:bg-[#5E0738] transition disabled:opacity-50"
            disabled={!selectedSaisisseur || !selectedTheme || loading}
          >
            Ajouter à la file d'attente
          </button>

          {/* Afficher la queue d'assignations */}
          {pendingAssignments.length > 0 && (
            <div className="mt-4 p-4 bg-[#f9f3f6] border border-[#e5c9d7] rounded-xl">
              <h4 className="text-sm font-semibold mb-3 text-[#4d1734] flex items-center gap-2"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#7A0A4A] text-white text-xs font-black">{pendingAssignments.length}</span>Assignations en attente</h4>
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
                  className="flex-1 px-4 py-2 bg-[#7A0A4A] text-white rounded-lg font-semibold text-sm hover:bg-[#5E0738] transition disabled:opacity-50"
                  disabled={loading}
                >
                  Valider les assignations
                </button>
                <button
                  onClick={() => {
                    setPendingAssignments([]);
                    setShowAssignmentQueue(false);
                  }}
                  className="flex-1 px-4 py-2 bg-white text-[#7A0A4A] border border-[#d8b6c8] rounded-lg font-semibold text-sm hover:bg-[#f7eaf1] transition"
                  disabled={loading}
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Tableau des Saisisseurs */}
        <div className="bg-white border border-[#e5c9d7] rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 bg-[#f9f3f6] border-b border-[#e5c9d7] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#7A0A4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              <span className="text-sm font-semibold text-[#4d1734]">Utilisateurs</span>
            </div>
            <span className="text-xs text-[#9a6f85] bg-[#f4e3ed] px-2 py-0.5 rounded-full">{saisisseurs.length} membre{saisisseurs.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#f9f3f6] text-[#5a2048] border-b border-[#e5c9d7]">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">Nom</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">Email</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">Rôle</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">Actions</th>
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
                            <div style={{ position: 'fixed', top: menuPosition.top, left: menuPosition.left, zIndex: 9999, maxHeight: '200px' }} className="w-56 bg-[#7A0A4A] text-white rounded-lg shadow-xl border border-[#B03372] overflow-y-auto">
                              <button
                                onClick={() => {
                                  handleResetPasswordUser(saisisseur.id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-[#5E0738] flex items-center gap-2 text-sm"
                              >
                                🔒 Réinitialiser le mot de passe
                              </button>
                              {isArchived ? (
                                <button
                                  onClick={() => {
                                    handleUnarchiveSaisisseur(saisisseur.id);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-[#5E0738] flex items-center gap-2 text-sm border-t border-[#B03372]"
                                >
                                  ↩️ Désarchiver
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    handleArchiveSaisisseur(saisisseur.id);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-[#5E0738] flex items-center gap-2 text-sm border-t border-[#B03372]"
                                >
                                  📦 Archiver
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  handleDeleteSaisisseur(saisisseur.id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-[#5E0738] text-white/90 flex items-center gap-2 text-sm border-t border-[#B03372] rounded-b-lg"
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
        <div className="bg-white border border-[#e5c9d7] rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 bg-[#f9f3f6] border-b border-[#e5c9d7] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#7A0A4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              <span className="text-sm font-semibold text-[#4d1734]">Tâches affectées</span>
            </div>
            <span className="text-xs text-[#9a6f85] bg-[#f4e3ed] px-2 py-0.5 rounded-full">{assignments.length} tâche{assignments.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#f9f3f6] text-[#5a2048] border-b border-[#e5c9d7]">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">Utilisateur</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">Tâche</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide">Priorité</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide">Progression</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Début</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Fin</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide">Statut</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">Actions</th>
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
                      'Haute': 'bg-[#f4e3ed] text-[#7A0A4A] border-[#d8b6c8]',
                      'Normale': 'bg-[#f9f3f6] text-[#B03372] border-[#d8b6c8]',
                      'Basse': 'bg-white text-[#7A0A4A] border-[#d8b6c8]'
                    };
                    const priorityBadge = priorityStyles[assignment.priorite] || priorityStyles['Normale'];
                    
                    // Progress bar color
                    const progression = assignment.progression || 0;
                    const progressColor = progression >= 75 ? 'bg-[#7A0A4A]' : progression >= 40 ? 'bg-[#B03372]' : 'bg-[#d8b6c8]';
                    
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
                            <span className="text-[#7A0A4A] font-medium">
                              ✓ {formatAssignmentDate(assignment.date_completion)}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={
                            assignment.statut === 'Complété'
                              ? 'px-2 py-1 bg-[#f4e3ed] text-[#7A0A4A] rounded text-xs font-medium inline-block'
                              : assignment.statut === 'En attente'
                              ? 'px-2 py-1 bg-[#f9f3f6] text-[#B03372] rounded text-xs font-medium inline-block'
                              : 'px-2 py-1 bg-white border border-[#d8b6c8] text-[#7A0A4A] rounded text-xs font-medium inline-block'
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
                            <div style={{ position: 'fixed', top: menuPosition.top, left: menuPosition.left, zIndex: 9999, maxHeight: '320px' }} className="w-56 bg-[#7A0A4A] text-white rounded-lg shadow-xl border border-[#B03372] overflow-y-auto">
                              <div className="px-4 py-2 text-xs font-bold text-white border-b border-[#B03372]">Changer la priorité</div>
                              <button
                                onClick={() => handleChangePriority(assignment.id, 'Haute')}
                                className="w-full text-left px-4 py-2 hover:bg-[#5E0738] flex items-center gap-2 text-sm"
                              >
                                🔴 Haute
                              </button>
                              <button
                                onClick={() => handleChangePriority(assignment.id, 'Normale')}
                                className="w-full text-left px-4 py-2 hover:bg-[#5E0738] flex items-center gap-2 text-sm"
                              >
                                🔵 Normale
                              </button>
                              <button
                                onClick={() => handleChangePriority(assignment.id, 'Basse')}
                                className="w-full text-left px-4 py-2 hover:bg-[#5E0738] flex items-center gap-2 text-sm border-b border-[#B03372]"
                              >
                                ⚪ Basse
                              </button>
                              <button
                                onClick={() => {
                                  handleValidateSaisisseur(assignment.id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-[#5E0738] flex items-center gap-2 text-sm"
                              >
                                ✅ Approuver la soumission
                              </button>
                              <button
                                onClick={() => {
                                  handleRejectSaisisseur(assignment.id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-[#5E0738] text-white/90 flex items-center gap-2 text-sm"
                              >
                                🛠️ Demander des corrections
                              </button>
                              <button
                                onClick={() => {
                                  handleOpenSubmissionPreview(assignment.id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-[#5E0738] flex items-center gap-2 text-sm border-t border-[#B03372]"
                              >
                                🔍 Aperçu de la soumission
                              </button>
                              {isAssignmentArchived ? (
                                <button
                                  onClick={() => {
                                    handleUnarchiveAssignment(assignment.id);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-[#5E0738] flex items-center gap-2 text-sm border-t border-[#B03372]"
                                >
                                  ↩️ Désarchiver la tâche
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    handleArchiveAssignment(assignment.id);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-[#5E0738] flex items-center gap-2 text-sm border-t border-[#B03372]"
                                >
                                  📦 Archiver la tâche
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  handleDeleteAssignment(assignment.id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-[#5E0738] text-white/90 flex items-center gap-2 text-sm border-t border-[#B03372] rounded-b-lg"
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
          {/* Statistiques thèmes */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total thèmes', value: allThemes.length, color: 'text-[#7A0A4A]', bg: 'bg-[#f4e3ed]' },
              { label: 'Publics actifs', value: allThemes.filter(t => t.is_visible && !t.archived).length, color: 'text-[#B03372]', bg: 'bg-[#f9f3f6]' },
              { label: 'Archivés', value: allThemes.filter(t => t.archived).length, color: 'text-[#B03372]', bg: 'bg-[#f9f3f6]' },
              { label: 'Sous-thèmes', value: allThemes.reduce((sum, t) => sum + (t.sous_themes?.length || 0), 0), color: 'text-[#B03372]', bg: 'bg-[#f9f3f6]' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`rounded-xl border border-[#e5c9d7] p-4 shadow-sm ${bg}`}>
                <p className="text-xs font-medium text-[#9a6f85]">{label}</p>
                <p className={`text-2xl font-black ${color} mt-1`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Tableau des thèmes */}
          <div className="bg-white border border-[#e5c9d7] rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 bg-[#f9f3f6] border-b border-[#e5c9d7] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#7A0A4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                <span className="text-sm font-semibold text-[#4d1734]">Thèmes &amp; Sous-thèmes</span>
              </div>
              <span className="text-xs text-[#9a6f85] bg-[#f4e3ed] px-2 py-0.5 rounded-full">{allThemes.length} thème{allThemes.length !== 1 ? 's' : ''}</span>
            </div>
            <table className="w-full">
              <thead className="bg-[#f9f3f6] text-[#4d1734] border-b border-[#e5c9d7]">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide w-12"></th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">Thème</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide w-28">Visibilité</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide w-28">État</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide w-28">S-thèmes</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide w-36">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {allThemes.map((theme, themeIndex) => {
                  const accent = themeTicketAccents[themeIndex % themeTicketAccents.length];
                  return (
                  <React.Fragment key={theme.id}>
                    {/* Ligne Thème */}
                    <tr className={`${accent.themeRow} transition`}>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => toggleThemeExpansion(theme.id)}
                          className={`${accent.marker} font-bold text-xl`}
                        >
                          {expandedThemes[theme.id] ? '▼' : '▶'}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-[#4d1734]">{theme.titre}</div>
                        <div className="text-xs text-[#9a6f85]">ID: {theme.id}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${
                          theme.is_visible 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {theme.is_visible ? '🌐 Public' : '🔒 Privé'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${
                          theme.archived 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {theme.archived ? '📦 Archivé' : '✓ Actif'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex px-2.5 py-1 rounded-full border text-xs font-semibold ${accent.countChip}`}>
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
                          {/* Bouton rapport supprimé */}
                        </div>
                      </td>
                    </tr>

                    {/* Sous-thèmes (affichés si thème expandé) */}
                    {expandedThemes[theme.id] && theme.sous_themes && theme.sous_themes.length > 0 && (
                      theme.sous_themes.map((subTheme) => (
                        <tr key={subTheme.id} className={`${accent.subThemeRow} transition`}>
                          <td className="px-6 py-3"></td>
                          <td className="px-6 py-3 pl-12">
                            <div className="flex items-center">
                              <span className={`${accent.marker} mr-2`}>└─</span>
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
                            <span className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${
                              subTheme.is_visible 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {subTheme.is_visible ? '🌐 Public' : '🔒 Privé'}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-center">
                            <span className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${
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
                      <tr className={accent.subThemeRow}>
                        <td colSpan="6" className="px-6 py-3 text-center text-gray-500 italic">
                          Aucun sous-thème pour ce thème
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );})}
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

      {/* Modal rapport supprimée */}

      {showAdminAssistant && (
        <div className="fixed bottom-5 right-5 z-50 w-[360px] max-w-[92vw] bg-white border border-[#e5c9d7] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.22)] overflow-hidden">
          <div className="bg-gradient-to-r from-[#7A0A4A] to-[#B03372] px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-white font-bold text-sm">Assistant Admin</div>
              <div className="text-white/75 text-[11px]">Mode secours fiable (IA optionnelle)</div>
            </div>
            <button onClick={() => setShowAdminAssistant(false)} className="text-white/80 hover:text-white text-lg leading-none">×</button>
          </div>

          <div className="h-72 overflow-y-auto p-3 bg-[#fffdf8] space-y-2">
            {assistantMessages.map((msg, idx) => (
              <div key={`assistant-msg-${idx}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-[#7A0A4A] text-white' : 'bg-white border border-[#ead3df] text-[#4d1734]'}`}>
                  <p className="whitespace-pre-line">{msg.text}</p>
                  {msg.role === 'assistant' && (
                    <span className={`mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded-full ${msg.mode === 'ai' ? 'bg-[#e6f7ed] text-[#1a7f4b]' : 'bg-[#fef3c7] text-[#92400e]'}`}>
                      {msg.mode === 'ai' ? 'IA' : 'Secours'}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {assistantLoading && (
              <div className="text-xs text-[#8c4f6a]">Assistant en cours de réponse...</div>
            )}
          </div>

          <div className="border-t border-[#e5c9d7] p-3 bg-white flex gap-2">
            <input
              type="text"
              value={assistantInput}
              onChange={(e) => setAssistantInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  sendAssistantMessage();
                }
              }}
              placeholder="Posez une question admin..."
              className="flex-1 px-3 py-2 border border-[#d8b6c8] rounded-lg text-sm outline-none focus:border-[#B03372]"
            />
            <button
              type="button"
              onClick={sendAssistantMessage}
              disabled={assistantLoading || !assistantInput.trim()}
              className="px-3 py-2 rounded-lg bg-[#7A0A4A] text-white text-sm font-semibold hover:bg-[#5E0738] disabled:opacity-60"
            >
              Envoyer
            </button>
          </div>
        </div>
      )}

      {/* Modal - Ajouter Utilisateur */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#e5c9d7] rounded-2xl w-full max-w-md shadow-[0_20px_60px_rgba(0,0,0,0.25)] overflow-hidden">
            <div className="bg-gradient-to-r from-[#7A0A4A] to-[#B03372] px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Ajouter un utilisateur</h2>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-white/70 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="p-6">
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
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
              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-[#7A0A4A] text-white rounded-lg font-semibold text-sm hover:bg-[#5E0738] transition"
                >
                  Ajouter
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2.5 bg-white text-[#7A0A4A] border border-[#d8b6c8] rounded-lg font-semibold text-sm hover:bg-[#f7eaf1] transition"
                >
                  Annuler
                </button>
              </div>
            </form>
            </div>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-bold mb-2 block">Colonnes visibles (ordre important)</label>
                <DndContext
                  collisionDetection={closestCenter}
                  onDragEnd={({ active, over }) => {
                    if (!over || active.id === over.id) return;
                    setModalVisitorCols((prev) => {
                      const oldIndex = prev.indexOf(active.id);
                      const newIndex = prev.indexOf(over.id);
                      if (oldIndex < 0 || newIndex < 0) return prev;
                      return arrayMove(prev, oldIndex, newIndex);
                    });
                  }}
                >
                  <SortableContext items={modalVisitorCols} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2 max-h-56 overflow-y-auto p-2 bg-[#fcf4f8] rounded border border-[#e5c9d7]">
                      {modalVisitorCols.length === 0 && <div className="text-sm text-gray-500">Aucune colonne sélectionnée</div>}
                      {modalVisitorCols.map(c => (
                        <DraggableChip key={c} id={c} onRemove={() => {
                          setModalVisitorCols(prev => prev.filter(x => x !== c));
                          setModalVisitorHierarchy(prev => prev.filter(x => x !== c));
                          setModalVisitorFilters(prev => prev.filter(x => x !== c));
                        }}>
                          <span className="font-mono text-sm">{c}</span>
                        </DraggableChip>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
                <div className="mt-2 text-xs text-gray-600">Ajouter une colonne:</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {(configSubTheme.columns && configSubTheme.columns.length ? configSubTheme.columns : Object.keys((configSubTheme.data && configSubTheme.data[0]) || {}))
                    .filter(c => !modalVisitorCols.includes(c))
                    .map(c => (
                      <button
                        key={`add-col-${c}`}
                        type="button"
                        className="px-2 py-1 text-xs rounded border border-[#d8b6c8] bg-white hover:bg-[#f8edf3]"
                        onClick={() => setModalVisitorCols(prev => [...prev, c])}
                      >
                        {c}
                      </button>
                    ))}
                </div>
              </div>

              <div>
                <label className="font-bold mb-2 block">Filtres disponibles (ordre important)</label>
                <DndContext
                  collisionDetection={closestCenter}
                  onDragEnd={({ active, over }) => {
                    if (!over || active.id === over.id) return;
                    setModalVisitorFilters((prev) => {
                      const oldIndex = prev.indexOf(active.id);
                      const newIndex = prev.indexOf(over.id);
                      if (oldIndex < 0 || newIndex < 0) return prev;
                      return arrayMove(prev, oldIndex, newIndex);
                    });
                  }}
                >
                  <SortableContext items={modalVisitorFilters} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2 max-h-56 overflow-y-auto p-2 bg-[#fcf4f8] rounded border border-[#e5c9d7]">
                      {modalVisitorFilters.length === 0 && <div className="text-sm text-gray-500">Aucun filtre sélectionné</div>}
                      {modalVisitorFilters.map(c => (
                        <DraggableChip
                          key={c}
                          id={c}
                          onRemove={() => {
                            setModalVisitorFilters(prev => prev.filter(x => x !== c));
                            setModalVisitorDefaultFilters(prev => {
                              const copy = { ...prev };
                              delete copy[c];
                              return copy;
                            });
                          }}
                        >
                          <span className="font-mono text-sm">{c}</span>
                        </DraggableChip>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
                <div className="mt-2 text-xs text-gray-600">Ajouter un filtre:</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {modalVisitorCols
                    .filter(c => !modalVisitorFilters.includes(c))
                    .map(c => (
                      <button
                        key={`add-filter-${c}`}
                        type="button"
                        className="px-2 py-1 text-xs rounded border border-[#d8b6c8] bg-white hover:bg-[#f8edf3]"
                        onClick={() => setModalVisitorFilters(prev => [...prev, c])}
                      >
                        {c}
                      </button>
                    ))}
                </div>
              </div>

              <div>
                <label className="font-bold mb-2 block">Hiérarchie des colonnes (optionnel)</label>
                <DndContext
                  collisionDetection={closestCenter}
                  onDragEnd={({ active, over }) => {
                    if (!over || active.id === over.id) return;
                    setModalVisitorHierarchy((prev) => {
                      const oldIndex = prev.indexOf(active.id);
                      const newIndex = prev.indexOf(over.id);
                      if (oldIndex < 0 || newIndex < 0) return prev;
                      return arrayMove(prev, oldIndex, newIndex);
                    });
                  }}
                >
                  <SortableContext items={modalVisitorHierarchy} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2 max-h-56 overflow-y-auto p-2 bg-[#fcf4f8] rounded border border-[#e5c9d7]">
                      {modalVisitorHierarchy.length === 0 && <div className="text-sm text-gray-500">Aucune hiérarchie</div>}
                      {modalVisitorHierarchy.map(c => (
                        <DraggableChip key={c} id={c} onRemove={() => setModalVisitorHierarchy(prev => prev.filter(x => x !== c))}>
                          <span className="font-mono text-sm">{c}</span>
                        </DraggableChip>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
                <div className="mt-2 text-xs text-gray-600">Ajouter à la hiérarchie:</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {modalVisitorCols
                    .filter(c => !modalVisitorHierarchy.includes(c))
                    .map(c => (
                      <button
                        key={`add-hierarchy-${c}`}
                        type="button"
                        className="px-2 py-1 text-xs rounded border border-[#d8b6c8] bg-white hover:bg-[#f8edf3]"
                        onClick={() => setModalVisitorHierarchy(prev => [...prev, c])}
                      >
                        {c}
                      </button>
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
                    visitor_pivot_columns: modalVisitorHierarchy,
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
                setModalVisitorHierarchy(configSubTheme.visitor_pivot_columns || []);
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
