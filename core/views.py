import logging
import uuid
import base64
import json
import re
import os
import pandas as pd
import string
import random
from django.utils import timezone
from django.core.mail import send_mail
from django.template.loader import render_to_string
from rest_framework.views import APIView
from rest_framework import viewsets, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.db.models import Q
from .models import Theme, Categorie, SousTheme, Indicateur, Donnee, CustomUser, UserThemeAssignment, UserRequest, InfoBanner, SiteContent
from .serializers import (
    ThemeSerializer, CategorieSerializer, SousThemeSerializer,
    UserThemeAssignmentSerializer, UserRequestSerializer, UserSerializer,
    InfoBannerSerializer, SiteContentSerializer
)

logger = logging.getLogger(__name__)

# Temporary hardcoded credentials for quick testing (to be removed later).
HARDCODED_HF_TOKEN = "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"
HARDCODED_GEMINI_API_KEY = "AlzaSyDInJemgjQXBqjnhAslFvTKYvkv0P6gEdY"


def _normalize_column_name(value):
    return re.sub(r'[^a-z0-9]+', '', str(value or '').strip().lower())


def _extract_json_object(raw_text):
    """Extract first JSON object from model output (supports fenced blocks)."""
    text = str(raw_text or '').strip()
    if not text:
        return None

    # Try direct parse first
    try:
        return json.loads(text)
    except Exception:
        pass

    # Strip markdown fences
    if '```' in text:
        cleaned = re.sub(r'^```(?:json)?\s*|\s*```$', '', text, flags=re.IGNORECASE | re.MULTILINE).strip()
        try:
            return json.loads(cleaned)
        except Exception:
            pass

    # Extract probable JSON object span
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1 and end > start:
        candidate = text[start:end + 1]
        try:
            return json.loads(candidate)
        except Exception:
            return None
    return None


def _fallback_map_rows(df, expected_columns):
    """Deterministic fallback mapping if AI is unavailable."""
    source_cols = [str(c) for c in df.columns]
    norm_source = {_normalize_column_name(c): c for c in source_cols}

    # Basic aliases for common stat table columns
    alias_map = {
        'annee': ['annee', 'année', 'year', 'periode', 'période', 'period'],
        'valeur': ['valeur', 'value', 'montant', 'effectif', 'nombre', 'taux'],
        'region': ['region', 'région'],
        'province': ['province', 'prefecture', 'préfecture'],
        'milieu': ['milieu', 'zone'],
        'sexe': ['sexe', 'sex', 'genre'],
    }

    normalized_alias = {}
    for key, aliases in alias_map.items():
        normalized_alias[key] = [_normalize_column_name(a) for a in aliases]

    mapped_rows = []
    for _, row in df.iterrows():
        out = {}
        for expected in expected_columns:
            expected_norm = _normalize_column_name(expected)
            chosen_col = norm_source.get(expected_norm)

            # Try alias match if no direct match
            if not chosen_col:
                for aliases in normalized_alias.values():
                    if expected_norm in aliases:
                        for alias_norm in aliases:
                            if alias_norm in norm_source:
                                chosen_col = norm_source[alias_norm]
                                break
                    if chosen_col:
                        break

            out[expected] = '' if not chosen_col else row.get(chosen_col, '')
        mapped_rows.append(out)

    return mapped_rows


def _run_gemini_mapping(df, expected_columns):
    """Ask Gemini to map heterogeneous table columns to expected schema."""
    api_key = os.getenv('GEMINI_API_KEY', '').strip() or HARDCODED_GEMINI_API_KEY
    model_name = os.getenv('GEMINI_MODEL', 'gemini-1.5-flash').strip() or 'gemini-1.5-flash'
    if not api_key:
        raise RuntimeError('GEMINI_API_KEY manquante')

    # Optional HF login compatibility for workflows that depend on HF auth.
    hf_token = os.getenv('HF_TOKEN', '').strip() or HARDCODED_HF_TOKEN
    if hf_token:
        try:
            from huggingface_hub import login as hf_login
            hf_login(token=hf_token, add_to_git_credential=False)
        except Exception:
            # Non-bloquant pour le flux Gemini
            pass

    try:
        import google.generativeai as genai
    except Exception as exc:
        raise RuntimeError('Le package google-generativeai n\'est pas installe') from exc

    sample_records = df.head(40).to_dict(orient='records')
    prompt = (
        'Tu es un assistant de normalisation de tableaux statistiques. '\
        'Transforme les lignes source vers le schema cible. '\
        'Reponds STRICTEMENT en JSON valide, sans texte additionnel.\n\n'
        f'Colonnes cibles (ordre obligatoire): {expected_columns}\n'
        f'Colonnes source: {[str(c) for c in df.columns]}\n'
        f'Lignes source echantillon: {json.dumps(sample_records, ensure_ascii=False)}\n\n'
        'Format de sortie attendu:\n'
        '{"rows": [ {"COL1": "...", "COL2": "..."} ] }\n'
        'Regles:\n'
        '- Chaque objet de rows contient toutes les colonnes cibles.\n'
        '- Si une valeur est absente, mettre chaine vide.\n'
        '- Conserver le sens statistique le plus probable.\n'
        '- Ne pas inventer de colonnes hors schema cible.'
    )

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(model_name)
    response = model.generate_content(prompt)
    parsed = _extract_json_object(getattr(response, 'text', '') or '')
    if not parsed or not isinstance(parsed, dict) or not isinstance(parsed.get('rows'), list):
        raise RuntimeError('Reponse IA non exploitable')

    sanitized = []
    for item in parsed['rows']:
        item = item if isinstance(item, dict) else {}
        sanitized.append({col: item.get(col, '') for col in expected_columns})
    return sanitized


def _cell_to_text(value):
    if value is None:
        return ''
    if isinstance(value, float) and pd.isna(value):
        return ''
    return str(value).strip()


def _parse_number(value):
    text = _cell_to_text(value).replace(' ', '').replace(',', '.')
    if not text:
        return None
    try:
        return float(text)
    except Exception:
        return None


def _extract_year_from_df(df):
    year_pattern = re.compile(r'(19|20)\d{2}')
    for _, row in df.head(8).iterrows():
        for val in row.tolist():
            txt = _cell_to_text(val)
            match = year_pattern.search(txt)
            if match:
                return match.group(0)
    return ''


def _normalize_cross_table_to_flat(df_raw):
    """
    Convert a merged-header cross table into a flat long table.
    Output columns target: Province, Annee, Sexe, <dimension_metrique>, Valeur
    """
    work = df_raw.copy()
    # pandas >= 3 removed DataFrame.applymap; map per-column for compatibility.
    work = work.apply(lambda col: col.map(_cell_to_text))
    year_value = _extract_year_from_df(work)

    # Find candidate metric columns: columns where many numeric values exist.
    numeric_ratio_by_col = {}
    for col in work.columns:
        values = work[col].tolist()
        nums = [_parse_number(v) for v in values]
        numeric_count = sum(1 for n in nums if n is not None)
        total = max(1, len(values))
        numeric_ratio_by_col[col] = numeric_count / total

    metric_cols = [c for c, ratio in numeric_ratio_by_col.items() if ratio >= 0.28]
    if len(metric_cols) < 2:
        return None

    first_metric = min(metric_cols)
    id_cols = [c for c in work.columns if c < first_metric]
    if len(id_cols) == 0:
        return None

    # Detect first data row: enough numeric values across metric columns.
    row_start = None
    for ridx in range(len(work)):
        nums = [_parse_number(work.iat[ridx, c]) for c in metric_cols]
        numeric_count = sum(1 for n in nums if n is not None)
        if numeric_count >= max(2, int(len(metric_cols) * 0.5)):
            row_start = ridx
            break
    if row_start is None:
        return None

    # Metric names are usually in row right before first numeric block.
    header_row = max(0, row_start - 1)
    metric_names = {}
    for c in metric_cols:
        label = _cell_to_text(work.iat[header_row, c])
        if not label and header_row > 0:
            label = _cell_to_text(work.iat[header_row - 1, c])
        if not label:
            label = f'Mesure_{c}'
        metric_names[c] = label

    # Detect top-level metric dimension label (e.g. "Milieu" over Total/Rural/Urbain).
    metric_dimension_name = 'Niveau_Etude'
    for ridx in [header_row - 1, header_row - 2, header_row - 3]:
        if ridx < 0:
            continue
        vals = [_cell_to_text(work.iat[ridx, c]) for c in metric_cols]
        non_empty = [v for v in vals if v]
        if len(non_empty) == 1:
            candidate = non_empty[0]
            c_norm = _normalize_name(candidate)
            is_year_like = bool(re.search(r'(19|20)\d{2}', candidate))
            if c_norm not in ('total', 'totale', 'année', 'annee') and not is_year_like:
                metric_dimension_name = candidate.strip().replace(' ', '_')
                break

    # Heuristic names for id columns
    id_name_1 = 'Province'
    id_name_2 = 'Sexe'
    if len(id_cols) >= 2:
        # If second id column is not gender-like, use generic Dimension
        second_col_values = [_cell_to_text(v).lower() for v in work.iloc[row_start:, id_cols[1]].tolist()]
        has_gender_like = any(v in ('masculin', 'feminin', 'féminin', 'total') for v in second_col_values)
        if not has_gender_like:
            id_name_2 = 'Dimension'

    last_id_values = {c: '' for c in id_cols}
    records = []
    for ridx in range(row_start, len(work)):
        # forward-fill merged cell values
        current_ids = {}
        for c in id_cols:
            raw = _cell_to_text(work.iat[ridx, c])
            if raw:
                last_id_values[c] = raw
            current_ids[c] = last_id_values[c]

        # skip empty structural rows
        if all(not _cell_to_text(v) for v in current_ids.values()):
            continue

        for c in metric_cols:
            n = _parse_number(work.iat[ridx, c])
            if n is None:
                continue

            rec = {
                id_name_1: current_ids.get(id_cols[0], ''),
                'Annee': year_value,
                id_name_2: current_ids.get(id_cols[1], '') if len(id_cols) > 1 else '',
                metric_dimension_name: metric_names.get(c, f'Mesure_{c}'),
                'Valeur': n,
            }
            records.append(rec)

    if not records:
        return None
    return pd.DataFrame(records)


def _is_bad_header_shape(columns):
    # `columns` can be a pandas.Index; never use it in boolean context.
    if columns is None:
        cols = []
    else:
        cols = [str(c) for c in list(columns)]
    unnamed = [c for c in cols if c.lower().startswith('unnamed')]
    return len(unnamed) >= 1


def _normalize_name(value):
    return ' '.join(str(value or '').strip().split()).lower()


def _schema_overlap_ratio(cols_a, cols_b):
    """Return overlap ratio between two column lists using normalized names."""
    a = {_normalize_column_name(c) for c in (cols_a or []) if str(c or '').strip()}
    b = {_normalize_column_name(c) for c in (cols_b or []) if str(c or '').strip()}
    if not a or not b:
        return 0.0
    return len(a.intersection(b)) / float(max(1, len(a)))


class InfoBannerView(APIView):
    """Message global INFOS: lecture publique, écriture réservée aux admins."""

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get(self, request):
        banner, _ = InfoBanner.objects.get_or_create(id=1, defaults={'message': ''})
        serializer = InfoBannerSerializer(banner)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request):
        if getattr(request.user, 'role', None) != 'ADMIN':
            return Response({'error': 'Accès refusé : seulement les administrateurs peuvent modifier cette info.'}, status=status.HTTP_403_FORBIDDEN)

        message = str(request.data.get('message', '')).strip()
        if not message:
            return Response({'error': 'Le message info ne peut pas être vide.'}, status=status.HTTP_400_BAD_REQUEST)

        banner, _ = InfoBanner.objects.get_or_create(id=1, defaults={'message': message, 'updated_by': request.user})
        banner.message = message
        banner.updated_by = request.user
        banner.save()
        return Response(InfoBannerSerializer(banner).data, status=status.HTTP_200_OK)


class SiteContentView(APIView):
    """Contenu éditorial du menu: Contact, À propos, Liens utiles."""

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    def _defaults(self):
        return {
            'about_title': 'À propos de la plateforme',
            'about_text': (
                'La plateforme régionale HCP facilite l\'accès aux statistiques territoriales, '
                'la visualisation des indicateurs et la diffusion d\'informations fiables pour '
                'l\'aide à la décision publique.'
            ),
            'contact_title': 'Contact',
            'contact_email': 'contact@hcp.ma',
            'contact_phone': '+212 5 23 00 00 00',
            'contact_address': 'Direction Régionale HCP\nBéni Mellal - Khénifra',
            'contact_hours': 'Lundi - Vendredi, 08:30 - 16:30',
            'useful_links': [
                {'label': 'Haut-Commissariat au Plan', 'url': 'https://www.hcp.ma'},
                {'label': 'Portail du Gouvernement', 'url': 'https://www.maroc.ma'},
                {'label': 'Open Data Maroc', 'url': 'https://www.data.gov.ma'},
            ],
        }

    def get(self, request):
        content, _ = SiteContent.objects.get_or_create(id=1, defaults=self._defaults())
        return Response(SiteContentSerializer(content).data, status=status.HTTP_200_OK)

    def put(self, request):
        if getattr(request.user, 'role', None) != 'ADMIN':
            return Response({'error': 'Accès refusé : seulement les administrateurs peuvent modifier ce contenu.'}, status=status.HTTP_403_FORBIDDEN)

        content, _ = SiteContent.objects.get_or_create(id=1, defaults=self._defaults())

        serializer = SiteContentSerializer(content, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

class CategorieViewSet(viewsets.ModelViewSet):
    queryset = Categorie.objects.all().order_by('id')
    serializer_class = CategorieSerializer
    permission_classes = [IsAuthenticated]

    def _require_admin(self, request):
        if getattr(request.user, 'role', None) != 'ADMIN':
            raise PermissionDenied('Seuls les administrateurs peuvent modifier les catégories.')

    def create(self, request, *args, **kwargs):
        self._require_admin(request)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        self._require_admin(request)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        self._require_admin(request)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        self._require_admin(request)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='toggle-visibility')
    def toggle_visibility(self, request, pk=None):
        """Toggle la visibilité d'une catégorie et cascade aux sous-thèmes."""
        self._require_admin(request)
        categorie = self.get_object()
        new_visibility = request.data.get('is_visible', not categorie.is_visible)
        categorie.is_visible = new_visibility
        categorie.save()
        # Cascade to all sous-thèmes in this category
        categorie.sous_themes.all().update(is_visible=new_visibility)
        return Response({'id': categorie.id, 'is_visible': categorie.is_visible}, status=status.HTTP_200_OK)

class SousThemeViewSet(viewsets.ModelViewSet):
    queryset = SousTheme.objects.all().order_by('id')
    serializer_class = SousThemeSerializer
    permission_classes = [IsAuthenticated]

    def _require_admin(self, request):
        if getattr(request.user, 'role', None) != 'ADMIN':
            raise PermissionDenied('Seuls les administrateurs peuvent modifier la structure des sous-thèmes.')

    def create(self, request, *args, **kwargs):
        self._require_admin(request)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        self._require_admin(request)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        self._require_admin(request)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        self._require_admin(request)
        return super().destroy(request, *args, **kwargs)

    def get_queryset(self):
        """Filtrer les sous-thèmes par thème si le paramètre 'theme' est fourni.
        Si l'utilisateur est un `SAISISSEUR`, limiter aux sous-thèmes/ thèmes qui
        lui sont assignés via `UserThemeAssignment`.
        """
        queryset = super().get_queryset()
        theme_id = self.request.query_params.get('theme', None)
        user = getattr(self.request, 'user', None)

        # Restrict by provided theme query param first
        if theme_id is not None:
            queryset = queryset.filter(theme_id=theme_id)

        # If saisisseur, further restrict to assigned sous-themes or themes
        try:
            if user and getattr(user, 'role', None) == 'SAISISSEUR':
                assignments = UserThemeAssignment.objects.filter(user=user)
                st_ids = set()
                theme_ids = set()
                for a in assignments:
                    if a.sous_theme_id:
                        st_ids.add(a.sous_theme_id)
                    if a.theme_id:
                        theme_ids.add(a.theme_id)
                return queryset.filter(Q(id__in=list(st_ids)) | Q(theme_id__in=list(theme_ids)))
        except Exception:
            # On any error, fall back to the unfiltered queryset
            pass

        return queryset

    @action(detail=True, methods=['get', 'post'], url_path='charts')
    def charts(self, request, pk=None):
        """
        GET: retourne la liste des charts configurés pour ce sous-thème.
        POST: ajoute un nouveau chart à la configuration et le sauvegarde.
        """
        st = self.get_object()
        if request.method == 'GET':
            return Response(st.charts_config or [], status=status.HTTP_200_OK)

        data = request.data
        new_chart = {
            'id': str(uuid.uuid4()),
            'type': data.get('type', 'Histogramme'),
            'x': data.get('x', ''),
            'y': data.get('y', ''),
            'mesure': data.get('mesure', ''),
            'filter_column': data.get('filter_column', ''),
            'filter_value': data.get('filter_value', ''),
            'filter_mode': data.get('filter_mode', 'include'),
            'excluded_rows': data.get('excluded_rows', []),
            'filters': data.get('filters', []),
            # chart-level visitor-visible filters (array of {column, default} or simple column names)
            'visible_filters': data.get('visible_filters', []),
            'title': data.get('title', ''),
            'x_label': data.get('x_label', ''),
            'y_label': data.get('y_label', ''),
            'group_by': data.get('group_by', ''),
        }
        config = st.charts_config or []
        config.append(new_chart)
        st.charts_config = config
        st.save()
        return Response(new_chart, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['put', 'delete'], url_path='charts/(?P<chart_id>[^/.]+)')
    def charts_detail(self, request, pk=None, chart_id=None):
        st = self.get_object()
        config = st.charts_config or []
        for i, ch in enumerate(config):
            if ch.get('id') == chart_id:
                if request.method == 'DELETE':
                    config.pop(i)
                    st.charts_config = config
                    st.save()
                    return Response({'message': 'Supprimé'}, status=status.HTTP_200_OK)
                else:
                    data = request.data
                    ch['type'] = data.get('type', ch.get('type'))
                    ch['x'] = data.get('x', ch.get('x'))
                    ch['y'] = data.get('y', ch.get('y'))
                    ch['mesure'] = data.get('mesure', ch.get('mesure'))
                    ch['filter_column'] = data.get('filter_column', ch.get('filter_column', ''))
                    ch['filter_value'] = data.get('filter_value', ch.get('filter_value', ''))
                    ch['filter_mode'] = data.get('filter_mode', ch.get('filter_mode', 'include'))
                    ch['excluded_rows'] = data.get('excluded_rows', ch.get('excluded_rows', []))
                    ch['filters'] = data.get('filters', ch.get('filters', []))
                    ch['visible_filters'] = data.get('visible_filters', ch.get('visible_filters', []))
                    ch['title'] = data.get('title', ch.get('title', ''))
                    ch['x_label'] = data.get('x_label', ch.get('x_label', ''))
                    ch['y_label'] = data.get('y_label', ch.get('y_label', ''))
                    ch['group_by'] = data.get('group_by', ch.get('group_by', ''))
                    config[i] = ch
                    st.charts_config = config
                    st.save()
                    return Response(ch, status=status.HTTP_200_OK)
        return Response({'error': 'Chart non trouvé'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'], url_path='import')
    def import_table(self, request, pk=None):
        """Importe un fichier Excel et remplace les données du sous-thème."""
        st = self.get_object()
        excel_file = request.FILES.get('file')
        if not excel_file:
            return Response({'error': 'Aucun fichier fourni'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            df = pd.read_excel(excel_file)
            # Préserver l'ordre des colonnes du fichier original
            columns_order = list(df.columns)
            df = df.fillna("")
            st.data_json = df.to_dict(orient='records')
            st.columns_order = columns_order
            st.save()
            return Response({'message': 'Import réussi', 'data': st.data_json}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception('Erreur import excel')
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='import-smart')
    def import_table_smart(self, request, pk=None):
        """Import Excel with AI-assisted column mapping to current sous-theme schema."""
        st = self.get_object()
        excel_file = request.FILES.get('file')
        if not excel_file:
            return Response({'error': 'Aucun fichier fourni'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            warnings = []

            # Read twice: header inference + raw grid for merged-header normalization.
            df = pd.read_excel(excel_file)
            excel_file.seek(0)
            df_raw = pd.read_excel(excel_file, header=None)

            normalized_df = None
            if _is_bad_header_shape(df.columns):
                normalized_df = _normalize_cross_table_to_flat(df_raw)
                if normalized_df is not None:
                    df = normalized_df
                    warnings.append('Normalisation croisee->plate appliquee')

            df = df.fillna('')
            incoming_columns = [str(c) for c in df.columns]
            free_schema = str(request.data.get('free_schema', 'true')).strip().lower() in ('1', 'true', 'yes', 'oui', 'on')

            expected_columns = list(st.columns_order or st.columns or [])

            # If previous schema is already polluted (Unnamed), replace by normalized columns.
            if _is_bad_header_shape(expected_columns) and normalized_df is not None:
                expected_columns = [str(c) for c in normalized_df.columns]
                warnings.append('Schema cible corrige a partir de la table normalisee')

            # Free-schema mode: always prefer incoming headers/data instead of old schema.
            overlap = _schema_overlap_ratio(expected_columns, incoming_columns)
            should_adopt_incoming = bool(free_schema and incoming_columns)

            if should_adopt_incoming:
                mapped_rows = df.to_dict(orient='records')
                expected_columns = incoming_columns
                st.data_json = mapped_rows
                st.columns_order = expected_columns
                st.save()
                warnings.append('Mode schema libre: colonnes du fichier adoptees')
                if overlap > 0:
                    warnings.append(f'Recouvrement schema precedent: {round(overlap * 100)}%')
                return Response(
                    {
                        'message': 'Import intelligent reussi',
                        'data': mapped_rows,
                        'columns_order': expected_columns,
                        'warnings': warnings,
                    },
                    status=status.HTTP_200_OK,
                )

            # If schema is empty, keep classic behavior and adopt incoming columns
            if not expected_columns:
                expected_columns = [str(c) for c in df.columns]
                mapped_rows = df.to_dict(orient='records')
            else:
                try:
                    mapped_rows = _run_gemini_mapping(df, expected_columns)
                    warnings.append('Mapping IA applique')
                except Exception as ai_err:
                    logger.warning('Fallback mapping active: %s', ai_err)
                    mapped_rows = _fallback_map_rows(df, expected_columns)
                    warnings.append('Mapping IA indisponible: fallback heuristique utilise')

                st.data_json = mapped_rows
                st.columns_order = expected_columns
                st.save()
                return Response(
                    {
                        'message': 'Import intelligent reussi',
                        'data': mapped_rows,
                        'columns_order': expected_columns,
                        'warnings': warnings,
                    },
                    status=status.HTTP_200_OK,
                )

            st.data_json = mapped_rows
            st.columns_order = expected_columns
            st.save()
            return Response(
                {
                    'message': 'Import intelligent reussi',
                    'data': mapped_rows,
                    'columns_order': expected_columns,
                    'warnings': ['Schema cible vide: import classique applique'],
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            logger.exception('Erreur import intelligent')
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ThemeViewSet(viewsets.ModelViewSet):
    queryset = Theme.objects.all().order_by('id')
    serializer_class = ThemeSerializer
    permission_classes = [IsAuthenticated]

    def _require_admin(self, request):
        if getattr(request.user, 'role', None) != 'ADMIN':
            raise PermissionDenied('Seuls les administrateurs peuvent modifier les thèmes.')

    def create(self, request, *args, **kwargs):
        self._require_admin(request)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        self._require_admin(request)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        self._require_admin(request)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        self._require_admin(request)
        return super().destroy(request, *args, **kwargs)

    def get_queryset(self):
        """If the user is a `SAISISSEUR`, return only themes assigned to them."""
        qs = super().get_queryset()
        user = getattr(self.request, 'user', None)
        try:
            if user and getattr(user, 'role', None) == 'SAISISSEUR':
                assignments = UserThemeAssignment.objects.filter(user=user)
                theme_ids = set()
                for a in assignments:
                    if a.theme_id:
                        theme_ids.add(a.theme_id)
                    if a.sous_theme_id and a.sous_theme and a.sous_theme.theme_id:
                        theme_ids.add(a.sous_theme.theme_id)
                return qs.filter(id__in=list(theme_ids))
        except Exception:
            pass
        return qs

    @action(detail=False, methods=['post'])
    def enregistrer_complet(self, request):
        # Only ADMIN users may create themes via this endpoint
        if not (getattr(request.user, 'role', None) == 'ADMIN'):
            return Response({'error': 'Accès refusé : seulement les administrateurs peuvent créer des thèmes.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            # 1. Récupération et création du Thème
            titre = ' '.join(str(request.data.get('titre') or '').strip().split())
            if not titre:
                return Response({'error': 'Le titre du thème est requis.'}, status=status.HTTP_400_BAD_REQUEST)

            # Bloquer les doublons de thèmes (insensible à la casse/espaces)
            normalized_titre = _normalize_name(titre)
            for existing_theme in Theme.objects.only('id', 'titre'):
                if _normalize_name(existing_theme.titre) == normalized_titre:
                    return Response({'error': 'Un thème avec ce nom existe déjà.'}, status=status.HTTP_400_BAD_REQUEST)

            theme_image_value = request.data.get('theme_image', '')
            theme_image_file = request.FILES.get('theme_image')

            if theme_image_file:
                raw = theme_image_file.read()
                mime = getattr(theme_image_file, 'content_type', None) or 'image/png'
                b64 = base64.b64encode(raw).decode('utf-8')
                theme_image_value = f"data:{mime};base64,{b64}"

            if theme_image_value in [None, '', 'null', 'undefined']:
                theme_image_value = None

            # Acceptation tolérante du statut (insensible à la casse et aux espaces)
            statut_raw = request.data.get('statut', '')
            statut_clean = str(statut_raw).strip().lower()
            is_visible = True if (statut_clean == 'public' or 'public' in statut_clean) else False
            
            nouveau_theme = Theme.objects.create(
                titre=titre,
                theme_image=theme_image_value,
                is_visible=is_visible
            )

            # 1.5. Si des catégories sont spécifiées, les créer avec le même statut que le thème
            use_categories = request.data.get('use_categories') == 'true'
            categories_created = []
            if use_categories:
                local_category_names = set()
                cat_index = 0
                while f'categories[{cat_index}][nom]' in request.data:
                    cat_nom = ' '.join(str(request.data.get(f'categories[{cat_index}][nom]') or '').strip().split())
                    cat_ordre = request.data.get(f'categories[{cat_index}][ordre]', cat_index)
                    if cat_nom and cat_nom.strip():
                        normalized_cat_nom = _normalize_name(cat_nom)
                        if normalized_cat_nom in local_category_names:
                            return Response({'error': f'Doublon détecté dans les catégories: "{cat_nom}".'}, status=status.HTTP_400_BAD_REQUEST)
                        local_category_names.add(normalized_cat_nom)

                        cat_obj = Categorie.objects.create(
                            nom=cat_nom,
                            theme=nouveau_theme,
                            ordre=int(cat_ordre),
                            is_visible=is_visible
                        )
                        categories_created.append(cat_obj)
                    cat_index += 1

            # 2. Boucle pour traiter chaque ligne de sous-thème envoyée par le formulaire
            # Bloquer aussi les doublons internes au même formulaire
            local_subtheme_names = set()
            index = 0
            while f'lignes[{index}][sousTheme]' in request.data:
                nom_st = ' '.join(str(request.data.get(f'lignes[{index}][sousTheme]') or '').strip().split())
                if not nom_st:
                    return Response({'error': f'Le nom du sous-thème est requis (ligne {index + 1}).'}, status=status.HTTP_400_BAD_REQUEST)

                normalized_nom_st = _normalize_name(nom_st)
                if normalized_nom_st in local_subtheme_names:
                    return Response({'error': f'Doublon détecté dans les sous-thèmes: "{nom_st}".'}, status=status.HTTP_400_BAD_REQUEST)
                local_subtheme_names.add(normalized_nom_st)

                libelle_ind = request.data.get(f'lignes[{index}][indicateur]')
                unite = request.data.get(f'lignes[{index}][unite]')
                definition = request.data.get(f'lignes[{index}][definition]', '')
                source = request.data.get(f'lignes[{index}][source]', '')
                periodicite = request.data.get(f'lignes[{index}][periodicite]', '')
                
                # Déterminer la catégorie si elle est spécifiée
                categorie_obj = None
                if use_categories and f'lignes[{index}][categorieIndex]' in request.data:
                    cat_idx = int(request.data.get(f'lignes[{index}][categorieIndex]'))
                    if cat_idx < len(categories_created):
                        categorie_obj = categories_created[cat_idx]
                
                # Création du Sous-Thème avec les métadonnées pré-remplies et le même statut que le thème
                st_obj = SousTheme.objects.create(
                    nom=nom_st, 
                    theme=nouveau_theme,
                    categorie=categorie_obj,
                    indication_text=libelle_ind or '',
                    unite_text=unite or '',
                    definition_text=definition or '',
                    source_text=source or '',
                    periodicite_text=periodicite or '',
                    is_visible=is_visible
                )

                # Gestion du fichier Excel spécifique à ce sous-thème
                excel_file = request.FILES.get(f'lignes[{index}][file]')
                
                if excel_file:
                    # Lecture de l'Excel avec Pandas
                    df = pd.read_excel(excel_file)
                    
                    # Préserver l'ordre des colonnes du fichier original
                    columns_order = list(df.columns)
                    
                    # Nettoyage des données (remplace les NaN/vides par du texte vide pour le JSON)
                    df = df.fillna("")
                    
                    # --- LA MODIFICATION MAJEURE ---
                    # On transforme tout le tableau Excel en liste de dictionnaires
                    # Cela permet de garder TOUTES les colonnes du fichier original
                    st_obj.data_json = df.to_dict(orient='records')
                    st_obj.columns_order = columns_order
                    st_obj.save()

                    # On crée aussi l'indicateur lié pour garder votre structure initiale
                    ind_obj = Indicateur.objects.create(
                        libelle=libelle_ind,
                        unite=unite,
                        soustheme=st_obj
                    )
                    
                    # Optionnel : Si vous voulez quand même remplir la table 'Donnee' 
                    # pour des calculs statistiques futurs (si colonnes 'Annee' et 'Valeur' existent)
                    if 'Valeur' in df.columns:
                        for _, row in df.iterrows():
                            try:
                                Donnee.objects.create(
                                    indicateur=ind_obj,
                                    valeur=row['Valeur'],
                                    saisisseur=CustomUser.objects.filter(is_staff=True).first()
                                )
                            except:
                                pass # Ignore les lignes où la valeur n'est pas numérique

                index += 1

            serializer = ThemeSerializer(nouveau_theme)
            return Response({
                "message": "Succès : Thème et fichiers Excel importés avec leurs structures originales !",
                "theme": serializer.data
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({
                "error": f"Erreur lors de l'importation : {str(e)}"
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='archive')
    def archive(self, request, pk=None):
        """Marque un thème comme archivé et archive tous ses sous-thèmes."""
        try:
            if not (getattr(request.user, 'role', None) == 'ADMIN'):
                return Response({'error': 'Accès refusé : seulement les administrateurs peuvent archiver un thème.'}, status=status.HTTP_403_FORBIDDEN)
            theme = self.get_object()
            theme.archived = True
            theme.save()
            # Archive tous les sous-thèmes de ce thème
            theme.sous_themes.all().update(archived=True)
            return Response({'message': 'Thème et ses sous-thèmes archivés'}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='unarchive')
    def unarchive(self, request, pk=None):
        """Retire la marque d'archivage d'un thème et désarchive tous ses sous-thèmes."""
        try:
            if not (getattr(request.user, 'role', None) == 'ADMIN'):
                return Response({'error': 'Accès refusé : seulement les administrateurs peuvent désarchiver un thème.'}, status=status.HTTP_403_FORBIDDEN)
            theme = self.get_object()
            theme.archived = False
            theme.save()
            # Désarchive tous les sous-thèmes de ce thème
            theme.sous_themes.all().update(archived=False)
            return Response({'message': 'Thème et ses sous-thèmes désarchivés'}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='sous_themes')
    def add_sous_theme(self, request, pk=None):
        """Ajoute un sous-thème au thème courant."""
        try:
            # Only ADMINs may add a sous-theme at the theme level
            if not (getattr(request.user, 'role', None) == 'ADMIN'):
                return Response({'error': 'Accès refusé : seulement les administrateurs peuvent ajouter un sous-thème depuis l\'interface thème.'}, status=status.HTTP_403_FORBIDDEN)
            theme = self.get_object()
            nom = request.data.get('nom') or request.data.get('name')
            if not nom:
                return Response({'error': 'Le nom du sous-thème est requis'}, status=status.HTTP_400_BAD_REQUEST)
            nom = ' '.join(str(nom).strip().split())

            # Bloquer les doublons de sous-thèmes dans le même thème
            normalized_nom = _normalize_name(nom)
            for st in theme.sous_themes.all().only('id', 'nom'):
                if _normalize_name(st.nom) == normalized_nom:
                    return Response({'error': 'Un sous-thème avec ce nom existe déjà pour ce thème.'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Récupérer l'ID de la catégorie si fourni
            categorie_id = request.data.get('categorie')
            categorie_obj = None
            if categorie_id:
                try:
                    categorie_obj = Categorie.objects.get(id=categorie_id, theme=theme)
                except Categorie.DoesNotExist:
                    return Response({'error': 'Catégorie non trouvée'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Récupérer is_visible depuis la requête, ou hériter du parent
            is_visible = request.data.get('is_visible')
            if is_visible is None:
                # Hériter de la catégorie si elle existe, sinon du thème
                if categorie_obj:
                    is_visible = categorie_obj.is_visible
                else:
                    is_visible = theme.is_visible
            
            st = SousTheme.objects.create(nom=nom, theme=theme, categorie=categorie_obj, is_visible=is_visible)
            serializer = SousThemeSerializer(st)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.exception('Erreur ajout sous-theme')
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='toggle_visibility')
    def toggle_visibility(self, request, pk=None):
        """Bascule le statut de publication (is_visible) du thème et propage aux catégories/sous-thèmes."""
        try:
            self._require_admin(request)
            theme = self.get_object()
            # si l'appel fournit la valeur, l'utiliser, sinon inverser
            val = request.data.get('is_visible')
            if val is None:
                theme.is_visible = not theme.is_visible
            else:
                theme.is_visible = bool(val)
            theme.save()
            
            # Propager aux catégories et sous-thèmes
            theme.categories.all().update(is_visible=theme.is_visible)
            theme.sous_themes.all().update(is_visible=theme.is_visible)
            
            return Response({'id': theme.id, 'is_visible': theme.is_visible}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception('Erreur toggle visibility')
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    def perform_update(self, serializer):
        """Override pour propager les changements de is_visible et archived aux catégories/sous-thèmes."""
        instance = serializer.save()
        
        # Si is_visible a changé, propager aux catégories et sous-thèmes
        if 'is_visible' in serializer.validated_data:
            instance.categories.all().update(is_visible=instance.is_visible)
            instance.sous_themes.all().update(is_visible=instance.is_visible)
        
        # Si archived a changé, propager aux sous-thèmes (catégories n'ont pas archived)
        if 'archived' in serializer.validated_data:
            instance.sous_themes.all().update(archived=instance.archived)


def generate_password(length=8):
    """Génère un mot de passe aléatoire"""
    characters = string.ascii_letters + string.digits + "!@#$%^&*"
    return ''.join(random.choice(characters) for _ in range(length))


class UserThemeAssignmentViewSet(viewsets.ModelViewSet):
    queryset = UserThemeAssignment.objects.all().order_by('-date_assignation')
    serializer_class = UserThemeAssignmentSerializer
    permission_classes = [IsAuthenticated]

    def _is_contributor_role(self, user):
        return getattr(user, 'role', None) == 'SAISISSEUR'

    def get_queryset(self):
        """Admin voit tout, saisisseur voit seulement ses propres assignations."""
        qs = super().get_queryset()
        user = getattr(self.request, 'user', None)
        if user and self._is_contributor_role(user):
            return qs.filter(user=user)
        return qs

    def _load_notes(self, assignment):
        try:
            return json.loads(assignment.notes or '{}') if assignment.notes else {}
        except Exception:
            return {'_raw_notes': assignment.notes or ''}

    def _save_notes(self, assignment, notes_obj):
        assignment.notes = json.dumps(notes_obj, ensure_ascii=False)

    def _append_history(self, notes_obj, actor, action, message=''):
        history = notes_obj.get('workflow_history')
        if not isinstance(history, list):
            history = []
        history.append({
            'at': timezone.now().isoformat(),
            'actor': actor,
            'action': action,
            'message': str(message or '').strip(),
        })
        notes_obj['workflow_history'] = history

    def perform_create(self, serializer):
        # Création d'assignation réservée aux admins
        if getattr(self.request.user, 'role', None) != 'ADMIN':
            raise PermissionDenied('Seuls les administrateurs peuvent créer des assignations.')
        serializer.save()

    def update(self, request, *args, **kwargs):
        assignment = self.get_object()
        user = request.user
        if self._is_contributor_role(user) and assignment.user_id != user.id:
            return Response({'error': 'Accès refusé'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        assignment = self.get_object()
        user = request.user
        if self._is_contributor_role(user):
            if assignment.user_id != user.id:
                return Response({'error': 'Accès refusé'}, status=status.HTTP_403_FORBIDDEN)
            forbidden_fields = {'user', 'theme', 'sous_theme', 'indicateur', 'priorite', 'date_completion'}
            if any(field in request.data for field in forbidden_fields):
                return Response({'error': 'Modification non autorisée pour ce champ.'}, status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs)
    
    @action(detail=True, methods=['patch'])
    def update_statut(self, request, pk=None):
        """Met à jour le statut de l'assignation"""
        try:
            assignment = self.get_object()
            if self._is_contributor_role(request.user) and assignment.user_id != request.user.id:
                return Response({'error': 'Accès refusé'}, status=status.HTTP_403_FORBIDDEN)
            new_statut = request.data.get('statut')
            if new_statut not in ['En cours', 'Complété', 'En attente']:
                return Response({'error': 'Statut invalide'}, status=status.HTTP_400_BAD_REQUEST)
            assignment.statut = new_statut
            assignment.save()
            serializer = self.get_serializer(assignment)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='submit')
    def submit_to_admin(self, request, pk=None):
        """Soumission d'une tâche par le saisisseur vers l'admin."""
        assignment = self.get_object()
        user = request.user
        if not self._is_contributor_role(user) or assignment.user_id != user.id:
            return Response({'error': 'Accès refusé'}, status=status.HTTP_403_FORBIDDEN)

        comment = str(request.data.get('message', '')).strip()
        progression = request.data.get('progression', None)

        notes_obj = self._load_notes(assignment)
        notes_obj['last_submit_comment'] = comment
        self._append_history(notes_obj, actor=user.username, action='submit', message=comment)

        if progression is not None:
            try:
                assignment.progression = max(0, min(100, int(progression)))
            except Exception:
                pass

        assignment.statut = 'En attente'
        assignment.date_completion = None
        self._save_notes(assignment, notes_obj)
        assignment.save()

        return Response(self.get_serializer(assignment).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='review')
    def review_submission(self, request, pk=None):
        """Revue admin: approve ou reject avec commentaire."""
        assignment = self.get_object()
        user = request.user
        if getattr(user, 'role', None) != 'ADMIN':
            return Response({'error': 'Accès refusé'}, status=status.HTTP_403_FORBIDDEN)

        decision = str(request.data.get('decision', '')).strip().lower()
        comment = str(request.data.get('message', '')).strip()
        if decision not in ('approve', 'reject'):
            return Response({'error': 'Décision invalide. Utiliser approve ou reject.'}, status=status.HTTP_400_BAD_REQUEST)

        notes_obj = self._load_notes(assignment)
        notes_obj['admin_last_review'] = {
            'decision': decision,
            'message': comment,
            'at': timezone.now().isoformat(),
            'by': user.username,
        }
        self._append_history(notes_obj, actor=user.username, action=f'admin_{decision}', message=comment)

        if decision == 'approve':
            if assignment.sous_theme_id:
                sous_theme = assignment.sous_theme

                if isinstance(notes_obj.get('tables'), list):
                    sous_theme.data_json = notes_obj.get('tables')

                if isinstance(notes_obj.get('columns_order'), list) and notes_obj.get('columns_order'):
                    sous_theme.columns_order = notes_obj.get('columns_order')

                if isinstance(notes_obj.get('charts'), list):
                    sous_theme.charts_config = notes_obj.get('charts')

                meta = notes_obj.get('meta') if isinstance(notes_obj.get('meta'), dict) else {}
                advanced_config = notes_obj.get('advancedConfig') if isinstance(notes_obj.get('advancedConfig'), dict) else {}

                for field in ['definition_text', 'unite_text', 'indication_text', 'source_text', 'periodicite_text', 'couverture_text']:
                    if field in meta:
                        setattr(sous_theme, field, meta.get(field))

                for field in ['niveau_geo', 'type_unite', 'est_sommable', 'filtres_disponibles']:
                    if field in advanced_config:
                        setattr(sous_theme, field, advanced_config.get(field))

                if 'visitor_defaults' in notes_obj:
                    sous_theme.visitor_default_filters = notes_obj.get('visitor_defaults') or {}

                sous_theme.save()

            assignment.statut = 'Complété'
            assignment.progression = 100
            assignment.date_completion = timezone.now()
        else:
            assignment.statut = 'En cours'
            assignment.date_completion = None

        self._save_notes(assignment, notes_obj)
        assignment.save()
        return Response(self.get_serializer(assignment).data, status=status.HTTP_200_OK)


class UserRequestViewSet(viewsets.ModelViewSet):
    queryset = UserRequest.objects.all().order_by('-date_creation')
    serializer_class = UserRequestSerializer
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['post'])
    def create_user_with_email(self, request):
        """Crée un nouvel utilisateur et envoie son mot de passe par email"""
        try:
            email = request.data.get('email')
            name = request.data.get('name')
            role = request.data.get('role')
            
            if not all([email, name, role]):
                return Response(
                    {'error': 'Email, nom et rôle requis'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Vérifier que le rôle est valide
            valid_roles = [choice[0] for choice in CustomUser.ROLE_CHOICES]
            if role not in valid_roles:
                return Response(
                    {'error': f'Rôle invalide. Rôles acceptés: {valid_roles}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Vérifier que l'email n'existe pas déjà
            if CustomUser.objects.filter(email=email).exists():
                return Response(
                    {'error': 'Email déjà utilisé'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Générer un mot de passe temporaire
            temp_password = generate_password()
            username = email.split('@')[0]  # Utiliser la partie avant @ comme username
            
            # Vérifier que l'username n'existe pas
            counter = 1
            original_username = username
            while CustomUser.objects.filter(username=username).exists():
                username = f"{original_username}{counter}"
                counter += 1
            
            # Créer l'utilisateur
            new_user = CustomUser.objects.create_user(
                username=username,
                email=email,
                password=temp_password,
                role=role,
                first_name=name
            )
            
            # Envoyer l'email avec les identifiants
            subject = "Bienvenue sur la plateforme HCP"
            message = f"""
Bonjour {name},

Votre compte a été créé avec succès sur la plateforme de gestion des données.

Vos identifiants de connexion :
- Email/Identifiant : {email}
- Mot de passe temporaire : {temp_password}
- Rôle : {dict(CustomUser.ROLE_CHOICES).get(role, role)}

Veuillez vous connecter et modifier votre mot de passe à la première connexion.

Cordialement,
L'équipe HCP
            """
            
            try:
                send_mail(
                    subject,
                    message,
                    'noreply@hcp.ma',
                    [email],
                    fail_silently=False,
                )
            except Exception as e:
                logger.warning(f"Impossible d'envoyer l'email: {str(e)}")
            
            serializer = UserSerializer(new_user)
            return Response(
                {
                    'message': 'Utilisateur créé avec succès',
                    'user': serializer.data,
                    'password': temp_password
                },
                status=status.HTTP_201_CREATED
            )
        except Exception as e:
            logger.exception('Erreur création utilisateur')
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            
            serializer = UserSerializer(new_user)
            return Response(
                {
                    'message': 'Utilisateur créé avec succès',
                    'user': serializer.data,
                    'password': temp_password
                },
                status=status.HTTP_201_CREATED
            )
        except Exception as e:
            logger.exception('Erreur création utilisateur')
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def create_request(self, request):
        """Crée une demande d'utilisateur"""
        try:
            email = request.data.get('requester_email')
            name = request.data.get('requester_name')
            role = request.data.get('requested_role')
            demande = request.data.get('demande_texte', '')
            
            if not all([email, name, role]):
                return Response(
                    {'error': 'Email, nom et rôle requis'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            user_request = UserRequest.objects.create(
                requester_email=email,
                requester_name=name,
                requested_role=role,
                demande_texte=demande,
                created_by=request.user,
                statut='Nouveau'
            )
            
            serializer = UserRequestSerializer(user_request)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.exception('Erreur création demande')
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['patch'])
    def update_statut(self, request, pk=None):
        """Met à jour le statut d'une demande"""
        try:
            user_request = self.get_object()
            new_statut = request.data.get('statut')
            
            valid_statuts = ['Nouveau', 'En attente', 'Approuvé', 'Rejeté']
            if new_statut not in valid_statuts:
                return Response(
                    {'error': f'Statut invalide. Valeurs acceptées: {valid_statuts}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            user_request.statut = new_statut
            user_request.save()
            
            # Si approuvé, créer l'utilisateur automatiquement
            if new_statut == 'Approuvé' and not CustomUser.objects.filter(email=user_request.requester_email).exists():
                temp_password = generate_password()
                username = user_request.requester_email.split('@')[0]
                
                counter = 1
                original_username = username
                while CustomUser.objects.filter(username=username).exists():
                    username = f"{original_username}{counter}"
                    counter += 1
                
                new_user = CustomUser.objects.create_user(
                    username=username,
                    email=user_request.requester_email,
                    password=temp_password,
                    role=user_request.requested_role,
                    first_name=user_request.requester_name
                )
                
                # Envoyer l'email d'approbation
                subject = "Votre demande a été approuvée"
                message = f"""
Bonjour {user_request.requester_name},

Votre demande a été approuvée ! Votre compte a été créé sur la plateforme.

Vos identifiants de connexion :
- Email/Identifiant : {user_request.requester_email}
- Mot de passe temporaire : {temp_password}
- Rôle : {dict(CustomUser.ROLE_CHOICES).get(user_request.requested_role, user_request.requested_role)}

Veuillez vous connecter et modifier votre mot de passe à la première connexion.

Cordialement,
L'équipe HCP
                """
                
                try:
                    send_mail(
                        subject,
                        message,
                        'noreply@hcp.ma',
                        [user_request.requester_email],
                        fail_silently=False,
                    )
                except Exception as e:
                    logger.warning(f"Impossible d'envoyer l'email: {str(e)}")
            
            serializer = UserRequestSerializer(user_request)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception('Erreur mise à jour demande')
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def reset_password(self, request, pk=None):
        """Réinitialise le mot de passe d'un utilisateur et envoie un email"""
        try:
            user_request = self.get_object()
            
            # Chercher l'utilisateur associé
            try:
                user = CustomUser.objects.get(email=user_request.requester_email)
            except CustomUser.DoesNotExist:
                return Response(
                    {'error': 'Utilisateur non trouvé'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Générer un nouveau mot de passe
            new_password = generate_password()
            user.set_password(new_password)
            user.save()
            
            # Envoyer l'email
            subject = "Votre mot de passe a été réinitialisé"
            message = f"""
Bonjour {user.first_name},

Votre mot de passe a été réinitialisé.

Votre nouveau mot de passe temporaire : {new_password}

Veuillez vous connecter et modifier ce mot de passe.

Cordialement,
L'équipe HCP
            """
            
            try:
                send_mail(
                    subject,
                    message,
                    'noreply@hcp.ma',
                    [user_request.requester_email],
                    fail_silently=False,
                )
            except Exception as e:
                logger.warning(f"Impossible d'envoyer l'email: {str(e)}")
            
            return Response(
                {'message': 'Mot de passe réinitialisé et email envoyé'},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            logger.exception('Erreur réinitialisation mot de passe')
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class PublicThemeViewSet(viewsets.ReadOnlyModelViewSet):
    """Endpoints publics en lecture seule pour les thèmes visibles.

    On utilise des `Prefetch` pour s'assurer que les catégories et sous-thèmes
    imbriqués exposés sont uniquement ceux marqués `is_visible=True`.
    """
    from django.db.models import Prefetch

    queryset = Theme.objects.filter(is_visible=True, archived=False).prefetch_related(
        Prefetch(
            'categories',
            queryset=Categorie.objects.filter(is_visible=True).prefetch_related(
                Prefetch('sous_themes', queryset=SousTheme.objects.filter(is_visible=True, archived=False))
            )
        ),
        Prefetch('sous_themes', queryset=SousTheme.objects.filter(is_visible=True, archived=False))
    ).order_by('id')
    serializer_class = ThemeSerializer
    permission_classes = [AllowAny]


class PublicSousThemeViewSet(viewsets.ReadOnlyModelViewSet):
    """Endpoints publics en lecture seule pour les sous-thèmes visibles.

    Les sous-thèmes sont retournés seulement s'ils sont `is_visible=True` et
    si leur catégorie est publique (ou n'ont pas de catégorie).
    """
    queryset = SousTheme.objects.filter(
        is_visible=True,
        archived=False
    ).filter(Q(categorie__isnull=True) | Q(categorie__is_visible=True)).order_by('id')
    serializer_class = SousThemeSerializer
    permission_classes = [AllowAny]