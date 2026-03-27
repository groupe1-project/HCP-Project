import logging
import uuid
import base64
import json
import re
import os
import unicodedata
import pandas as pd
import string
import random
from collections import defaultdict
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

ARABIC_CHAR_RE = re.compile(r'[\u0600-\u06FF]')

SEMANTIC_LABELS = {
    'year': {'fr': 'Annee', 'ar': 'السنة'},
    'value': {'fr': 'Valeur', 'ar': 'القيمة'},
    'province': {'fr': 'Province', 'ar': 'الإقليم'},
    'region': {'fr': 'Region', 'ar': 'الجهة'},
    'milieu': {'fr': 'Milieu', 'ar': 'الوسط'},
    'sexe': {'fr': 'Sexe', 'ar': 'الجنس'},
    'etat_matrimonial': {'fr': 'Etat_Matrimonial', 'ar': 'الحالة_الاجتماعية'},
    'dimension': {'fr': 'Dimension', 'ar': 'البعد'},
}

SEMANTIC_VOCAB_RAW = {
    'year': {
        'annee', 'année', 'annees', 'années', 'year', 'years', 'periode', 'période', 'period', 'date',
        'annee 2020', 'année 2020', 'سنة', 'السنة', 'سنوات', 'السنوات', 'الفترة', 'التاريخ'
    },
    'value': {
        'valeur', 'value', 'values', 'montant', 'effectif', 'nombre', 'taux', 'ratio', 'pourcentage',
        'measure', 'mesure', 'count', 'amount', 'القيمة', 'قيمة', 'النسبة', 'نسبة', 'المؤشر', 'العدد'
    },
    'province': {
        'province', 'prefecture', 'préfecture', 'provinces', 'prefectures', 'territoire', 'territoires',
        'azilal', 'beni mellal', 'fquih ben salah', 'khenifra', 'khouribga',
        'إقليم', 'الإقليم', 'الأقاليم', 'العمالة', 'العمالات',
        'ازيلال', 'أزيلال', 'بني ملال', 'الفقيه بن صالح', 'خنيفرة', 'خريبكة'
    },
    'region': {
        'region', 'région', 'regions', 'régions', 'territoire regional', 'territoire régional',
        'beni mellal khenifra', 'casablanca settat', 'rabat sale kenitra', 'fes meknes',
        'جهة', 'الجهة', 'الجهات', 'بني ملال خنيفرة', 'الدار البيضاء سطات', 'الرباط سلا القنيطرة'
    },
    'milieu': {
        'milieu', 'zone', 'zones', 'rural', 'urbaine', 'urbain', 'rurale', 'rurales', 'urbaines',
        'وسط', 'الوسط', 'مجال', 'المجال', 'قروي', 'حضري'
    },
    'sexe': {
        'sexe', 'sex', 'genre', 'gender', 'masculin', 'feminin', 'féminin', 'homme', 'femme',
        'masculine', 'feminine',
        'ذكر', 'أنثى', 'انثى', 'مذكر', 'مؤنث', 'مؤنثة', 'ذكور', 'إناث', 'اناث',
        'الجنس', 'النوع', 'النوع الاجتماعي'
    },
    'etat_matrimonial': {
        'etat matrimonial', 'état matrimonial', 'statut matrimonial', 'situation matrimoniale',
        'celibataire', 'célibataire', 'celibataires', 'célibataires', 'marie', 'marié', 'maries', 'mariés',
        'divorce', 'divorcé', 'divorces', 'divorcés', 'veuf', 'veuve', 'veuves', 'veufs',
        'الحالة الاجتماعية', 'الحاله الاجتماعيه', 'أعزب', 'عزاب', 'العزاب', 'متزوج', 'متزوجون', 'متزوجين',
        'مطلق', 'مطلقون', 'مطلقين', 'أرمل', 'ارمل', 'أرامل', 'ارامل'
    },
    'dimension': {
        'dimension', 'dim', 'axis', 'axe', 'category', 'categorie', 'catégorie', 'modalite', 'modalité', 'modalities',
        'البعد', 'الابعاد', 'الفئة', 'الفئات', 'التصنيف', 'المستوى'
    },
}

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
        'sexe': ['sexe', 'sex', 'genre', 'gender', 'مذكر', 'مؤنث', 'ذكر', 'أنثى', 'انثى'],
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


def _is_truthy(value):
    if isinstance(value, bool):
        return value
    return str(value or '').strip().lower() in ('1', 'true', 'yes', 'oui', 'on')


def _clean_text(value):
    return str(value or '').strip()


def _parse_subtheme_ids(raw_ids):
    if raw_ids is None:
        return []
    parsed = raw_ids
    if isinstance(raw_ids, str):
        text = raw_ids.strip()
        if not text:
            return []
        try:
            parsed = json.loads(text)
        except Exception:
            parsed = [part.strip() for part in text.split(',') if part.strip()]
    if not isinstance(parsed, list):
        return []

    ids = []
    for value in parsed:
        try:
            ids.append(int(value))
        except Exception:
            continue
    return ids


def _build_non_empty_metadata(sub_theme, language):
    fr_fields = {
        'definition': _clean_text(sub_theme.definition_text),
        'unite': _clean_text(sub_theme.unite_text),
        'indication': _clean_text(sub_theme.indication_text),
        'source': _clean_text(sub_theme.source_text),
        'periodicite': _clean_text(sub_theme.periodicite_text),
        'couverture': _clean_text(sub_theme.couverture_text),
    }
    ar_fields = {
        'definition': _clean_text(sub_theme.definition_text_ar),
        'unite': _clean_text(sub_theme.unite_text_ar),
        'indication': _clean_text(sub_theme.indication_text_ar),
        'source': _clean_text(sub_theme.source_text_ar),
        'periodicite': _clean_text(sub_theme.periodicite_text_ar),
        'couverture': _clean_text(sub_theme.couverture_text_ar),
    }
    en_fields = {
        'definition': _clean_text(getattr(sub_theme, 'definition_text_en', '')),
        'unite': _clean_text(getattr(sub_theme, 'unite_text_en', '')),
        'indication': _clean_text(getattr(sub_theme, 'indication_text_en', '')),
        'source': _clean_text(getattr(sub_theme, 'source_text_en', '')),
        'periodicite': _clean_text(getattr(sub_theme, 'periodicite_text_en', '')),
        'couverture': _clean_text(getattr(sub_theme, 'couverture_text_en', '')),
    }

    fr_non_empty = {k: v for k, v in fr_fields.items() if v}
    ar_non_empty = {k: v for k, v in ar_fields.items() if v}
    en_non_empty = {k: v for k, v in en_fields.items() if v}

    if language == 'ar':
        return {'ar': ar_non_empty}
    if language == 'en':
        return {'en': en_non_empty}
    if language == 'both':
        return {'fr': fr_non_empty, 'ar': ar_non_empty}
    if language == 'all':
        return {'fr': fr_non_empty, 'ar': ar_non_empty, 'en': en_non_empty}
    return {'fr': fr_non_empty}


def _to_vertical_table(headers, rows, max_source_rows=8):
    source_rows = rows[:max_source_rows]
    vertical_headers = ['Champ'] + [f'Ligne {idx + 1}' for idx in range(len(source_rows))]
    vertical_rows = []
    for col_idx, header in enumerate(headers):
        row_values = [header]
        for source in source_rows:
            row_values.append(source[col_idx] if col_idx < len(source) else '')
        vertical_rows.append(row_values)
    return {
        'headers': vertical_headers,
        'rows': vertical_rows,
    }


def _build_monolingual_table(sub_theme, max_rows=60):
    rows = list(sub_theme.data_json or [])
    headers = list(sub_theme.columns_order or [])
    if not headers and rows:
        first = rows[0] if isinstance(rows[0], dict) else {}
        headers = list(first.keys())

    normalized_rows = []
    for row in rows[:max_rows]:
        if not isinstance(row, dict):
            continue
        normalized_rows.append([row.get(h, '') for h in headers])

    return {
        'headers': headers,
        'rows': normalized_rows,
        'rows_total': len(rows),
        'truncated': len(rows) > max_rows,
    }


def _build_bilingual_table(sub_theme, language, max_rows=60):
    i18n_payload = sub_theme.data_json_i18n or {}
    canonical_columns = list(i18n_payload.get('canonical_columns') or [])
    rows_payload = list(i18n_payload.get('rows') or [])
    column_labels = i18n_payload.get('column_labels') or {}
    value_labels = i18n_payload.get('value_labels') or {}
    value_column = i18n_payload.get('value_column')

    if not canonical_columns or not rows_payload:
        mono = _build_monolingual_table(sub_theme, max_rows=max_rows)
        return {
            'languages': {
                'fr': {
                    'horizontal': {'headers': mono['headers'], 'rows': mono['rows']},
                    'vertical': _to_vertical_table(mono['headers'], mono['rows']),
                }
            },
            'rows_total': mono['rows_total'],
            'truncated': mono['truncated'],
        }

    if language == 'both':
        requested_langs = ['fr', 'ar']
    elif language == 'all':
        requested_langs = ['fr', 'ar', 'en']
    else:
        requested_langs = [language]
    tables = {}

    for lang in requested_langs:
        headers = []
        for code in canonical_columns:
            labels = column_labels.get(code) or {}
            headers.append(labels.get(lang) or labels.get('fr') or code)

        localized_rows = []
        for row in rows_payload[:max_rows]:
            row_values = []
            for code in canonical_columns:
                raw_value = row.get(code, '')
                if code == value_column:
                    row_values.append(raw_value)
                    continue
                vocab = (value_labels.get(code) or {})
                mapped = vocab.get(str(raw_value)) or vocab.get(raw_value) or {}
                if isinstance(mapped, dict):
                    row_values.append(mapped.get(lang) or mapped.get('fr') or raw_value)
                else:
                    row_values.append(raw_value)
            localized_rows.append(row_values)

        tables[lang] = {
            'horizontal': {
                'headers': headers,
                'rows': localized_rows,
            },
            'vertical': _to_vertical_table(headers, localized_rows),
        }

    return {
        'languages': tables,
        'rows_total': len(rows_payload),
        'truncated': len(rows_payload) > max_rows,
    }


def _build_report_table_payload(sub_theme, language='fr', table_view='horizontal', max_rows=60):
    if language not in ('fr', 'ar', 'en', 'both', 'all'):
        language = 'fr'
    if table_view not in ('horizontal', 'vertical'):
        table_view = 'horizontal'

    if sub_theme.data_is_bilingual:
        table_data = _build_bilingual_table(sub_theme, language=language, max_rows=max_rows)
    else:
        mono = _build_monolingual_table(sub_theme, max_rows=max_rows)
        table_data = {
            'languages': {
                'fr': {
                    'horizontal': {'headers': mono['headers'], 'rows': mono['rows']},
                    'vertical': _to_vertical_table(mono['headers'], mono['rows']),
                }
            },
            'rows_total': mono['rows_total'],
            'truncated': mono['truncated'],
        }

    return {
        'view': table_view,
        'rows_total': table_data.get('rows_total', 0),
        'truncated': table_data.get('truncated', False),
        'languages': table_data.get('languages', {}),
    }


def _build_numeric_summary(rows, columns):
    summary = []
    for col in columns:
        values = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            number = _parse_number(row.get(col))
            if number is not None:
                values.append(number)
        if not values:
            continue

        summary.append({
            'column': col,
            'count': len(values),
            'min': min(values),
            'max': max(values),
            'avg': round(sum(values) / len(values), 4),
        })
    return summary[:8]


# Les explications générées par IA sont volontairement désactivées pour le rapport admin.


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
    second_id_col = None
    id_name_2 = 'Sexe'
    if len(id_cols) >= 2:
        second_id_col = id_cols[1]
        second_col_values_raw = [_cell_to_text(v).strip() for v in work.iloc[row_start:, second_id_col].tolist()]
        second_col_values = [v for v in second_col_values_raw if v]
        second_col_values_norm = [_normalize_name(v) for v in second_col_values]
        unique_non_empty = set(second_col_values_norm)

        has_gender_like = any(v in ('masculin', 'feminin', 'féminin', 'total') for v in second_col_values_norm)
        year_like_count = sum(1 for v in second_col_values if re.fullmatch(r'(19|20)\d{2}', v))
        has_year_like = bool(second_col_values) and year_like_count >= max(1, int(len(second_col_values) * 0.6))
        has_informative_values = len(second_col_values) >= 2 and len(unique_non_empty) >= 2

        if has_gender_like:
            id_name_2 = 'Sexe'
        elif has_year_like and not year_value:
            # If year is embedded by row values and not already extracted from header,
            # reuse this column directly as year.
            id_name_2 = 'Annee'
        elif has_informative_values:
            id_name_2 = 'Dimension'
        else:
            # Avoid creating an empty/useless extra column.
            second_id_col = None

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
                'Annee': current_ids.get(second_id_col, '') if (second_id_col is not None and id_name_2 == 'Annee') else year_value,
                metric_dimension_name: metric_names.get(c, f'Mesure_{c}'),
                'Valeur': n,
            }
            if second_id_col is not None and id_name_2 != 'Annee':
                rec[id_name_2] = current_ids.get(second_id_col, '')
            records.append(rec)

    if not records:
        return None
    return pd.DataFrame(records)


def _make_unique_columns(columns):
    seen = {}
    result = []
    for raw in columns:
        base = str(raw or '').strip() or 'col'
        if base not in seen:
            seen[base] = 1
            result.append(base)
            continue
        seen[base] += 1
        result.append(f'{base}_{seen[base]}')
    return result


def _normalize_merged_headers_to_wide(df_raw):
    """
    Normalize Excel tables with merged/multi-row headers into a usable wide table.
    This keeps each data row intact while rebuilding clean column names.
    """
    work = df_raw.copy()
    work = work.apply(lambda col: col.map(_cell_to_text))

    # Drop fully empty rows/columns early.
    row_non_empty_mask = work.apply(lambda r: any(_cell_to_text(v) for v in r.tolist()), axis=1)
    work = work.loc[row_non_empty_mask, :]
    if work.empty:
        return None

    col_non_empty_mask = [
        any(_cell_to_text(v) for v in work.iloc[:, c].tolist())
        for c in range(work.shape[1])
    ]
    keep_col_idx = [i for i, keep in enumerate(col_non_empty_mask) if keep]
    if not keep_col_idx:
        return None
    work = work.iloc[:, keep_col_idx]

    # Detect first data row: enough numeric cells on the same row.
    data_start = None
    for ridx in range(len(work)):
        row_vals = work.iloc[ridx].tolist()
        non_empty = [_cell_to_text(v) for v in row_vals if _cell_to_text(v)]
        if not non_empty:
            continue
        numeric_count = sum(1 for v in row_vals if _parse_number(v) is not None)
        if numeric_count >= max(1, int(len(non_empty) * 0.4)):
            data_start = ridx
            break

    if data_start is None or data_start <= 0:
        return None

    header_block = work.iloc[:data_start].copy()
    data_block = work.iloc[data_start:].copy().reset_index(drop=True)
    if header_block.empty or data_block.empty:
        return None

    # Simulate merged-cell fill in both directions to recover header labels.
    header_block = header_block.replace('', pd.NA).ffill(axis=1).ffill(axis=0).fillna('')

    raw_columns = []
    generic_parents = {
        'niveau', 'niveau etude', 'niveau_etude', 'milieu', 'zone',
        'type', 'categorie', 'catégorie', 'groupe', 'group'
    }

    for cidx in range(header_block.shape[1]):
        tokens = []
        for ridx in range(header_block.shape[0]):
            token = _cell_to_text(header_block.iat[ridx, cidx])
            if token and (not tokens or _normalize_name(tokens[-1]) != _normalize_name(token)):
                tokens.append(token)

        if not tokens:
            tokens = [f'col_{cidx + 1}']

        if len(tokens) >= 2:
            parent = tokens[-2]
            child = tokens[-1]
            parent_norm = _normalize_name(parent)
            if parent_norm in generic_parents and _normalize_name(child) != parent_norm:
                col_name = f'{parent}_{child}'
            elif _normalize_name(parent) == _normalize_name(child):
                col_name = child
            else:
                col_name = f'{parent}_{child}'
        else:
            col_name = tokens[-1]

        col_name = re.sub(r'\s+', '_', str(col_name).strip()).strip('_') or f'col_{cidx + 1}'
        raw_columns.append(col_name)

    clean_columns = _make_unique_columns(raw_columns)
    data_block.columns = clean_columns

    # Remove columns that still contain no data after normalization.
    keep_cols = [
        col for col in data_block.columns
        if any(_cell_to_text(v) for v in data_block[col].tolist())
    ]
    data_block = data_block[keep_cols] if keep_cols else data_block

    # Keep only non-empty rows.
    data_block = data_block[
        data_block.apply(lambda r: any(_cell_to_text(v) for v in r.tolist()), axis=1)
    ]

    if data_block.empty or data_block.shape[1] < 2:
        return None

    return data_block.reset_index(drop=True)


def _normalize_semantic_token(value):
    text = ' '.join(str(value or '').strip().split()).lower()
    if not text:
        return ''

    text = unicodedata.normalize('NFKC', text)
    text = re.sub(r'[\u0640\u200f\u200e]', '', text)

    latin_chunks = []
    arabic_chunks = []
    for chunk in re.split(r'\s+', text):
        if not chunk:
            continue
        if ARABIC_CHAR_RE.search(chunk):
            cleaned = re.sub(r'[^\u0600-\u06FF0-9]+', ' ', chunk)
            cleaned = re.sub(r'\s+', ' ', cleaned).strip()
            if cleaned:
                arabic_chunks.append(cleaned)
        else:
            cleaned = unicodedata.normalize('NFKD', chunk).encode('ascii', 'ignore').decode('ascii')
            cleaned = re.sub(r'[^a-z0-9]+', ' ', cleaned)
            cleaned = re.sub(r'\s+', ' ', cleaned).strip()
            if cleaned:
                latin_chunks.append(cleaned)

    return ' '.join([*latin_chunks, *arabic_chunks]).strip()


SEMANTIC_VOCAB = {
    key: {_normalize_semantic_token(token) for token in values if _normalize_semantic_token(token)}
    for key, values in SEMANTIC_VOCAB_RAW.items()
}


def _semantic_label_for_key(key, lang='fr'):
    labels = SEMANTIC_LABELS.get(key) or SEMANTIC_LABELS['dimension']
    return labels.get(lang) or labels.get('fr') or key


def _contains_arabic(value):
    return bool(ARABIC_CHAR_RE.search(str(value or '')))


def _detect_dataframe_language(df):
    arabic_score = 0
    latin_score = 0
    sample_texts = [str(c or '') for c in getattr(df, 'columns', [])]
    try:
        for col in getattr(df, 'columns', [])[:8]:
            sample_texts.extend([_cell_to_text(v) for v in df[col].tolist()[:20]])
    except Exception:
        pass

    for text in sample_texts:
        arabic_score += len(ARABIC_CHAR_RE.findall(str(text or '')))
        latin_score += len(re.findall(r'[A-Za-z]', str(text or '')))
    return 'ar' if arabic_score > latin_score else 'fr'


def _is_year_like_values(values):
    cleaned = [_cell_to_text(v) for v in (values or []) if _cell_to_text(v)]
    if len(cleaned) < 2:
        return False
    year_like_count = sum(1 for v in cleaned if re.fullmatch(r'(19|20)\d{2}', v))
    return (year_like_count / float(len(cleaned))) >= 0.8


def _semantic_key_from_label(label):
    tokens = {
        _normalize_semantic_token(part)
        for part in re.split(r'[_\-:/]+', str(label or '').strip())
        if _normalize_semantic_token(part)
    }
    if not tokens:
        return None

    best_key = None
    best_score = 0
    for key, vocab in SEMANTIC_VOCAB.items():
        overlap = len(tokens.intersection(vocab))
        if overlap > best_score:
            best_key = key
            best_score = overlap
    if best_score <= 0:
        return None
    return best_key


def _infer_dimension_key_from_modalities(modalities):
    normalized_modalities = {
        _normalize_semantic_token(re.sub(r'[_\-:/]+', ' ', str(col or '').strip()))
        for col in (modalities or [])
        if str(col or '').strip()
    }
    normalized_modalities = {m for m in normalized_modalities if m}
    if len(normalized_modalities) < 2:
        return None, 0

    best_key = None
    best_score = 0
    for candidate_key in ('milieu', 'sexe', 'etat_matrimonial', 'province', 'region'):
        vocab = SEMANTIC_VOCAB.get(candidate_key, set())
        overlap = len(normalized_modalities.intersection(vocab))
        if overlap > best_score:
            best_key = candidate_key
            best_score = overlap

    if best_score >= 2:
        return best_key, best_score
    return None, 0


def _infer_dimension_name_from_modalities(modalities, lang='fr'):
    key, score = _infer_dimension_key_from_modalities(modalities)
    if key and score >= 2:
        return _semantic_label_for_key(key, lang)
    return _semantic_label_for_key('dimension', lang)


def _build_ai_column_profiles(df):
    if df is None or df.empty:
        return []

    work = df.copy()
    work.columns = [str(c or '').strip() for c in work.columns]
    value_col = _pick_value_column(work)
    profiles = []

    for idx, col in enumerate(work.columns):
        values = [_cell_to_text(v) for v in work[col].tolist() if _cell_to_text(v)]
        sample_values = values[:200]
        unique_values = list(dict.fromkeys(sample_values))
        header_key = _semantic_key_from_label(col)
        modality_key, modality_score = _infer_dimension_key_from_modalities(unique_values)
        is_value = col == value_col
        is_year = header_key == 'year' or _is_year_like_values(sample_values)
        semantic_key = None

        if is_value:
            semantic_key = 'value'
        elif is_year:
            semantic_key = 'year'
        elif header_key and header_key != 'dimension':
            semantic_key = header_key
        elif modality_key and modality_score >= 2:
            semantic_key = modality_key

        unique_ratio = (len(set(unique_values)) / float(max(1, len(sample_values)))) if sample_values else 0.0
        profiles.append({
            'index': idx,
            'name': col,
            'header_key': header_key,
            'semantic_key': semantic_key,
            'modality_key': modality_key,
            'is_value': is_value,
            'is_year': is_year,
            'unique_ratio': unique_ratio,
            'sample_values': unique_values,
        })

    if not any(p['semantic_key'] == 'province' for p in profiles):
        fallback_candidates = [
            p for p in profiles
            if not p['is_value'] and not p['is_year'] and not p['semantic_key'] and p['unique_ratio'] >= 0.45
        ]
        if fallback_candidates:
            fallback_candidates[0]['semantic_key'] = 'province'

    return profiles


def _stabilize_ai_analytical_table(df):
    if df is None or df.empty:
        return df

    lang = _detect_dataframe_language(df)
    work = df.copy().fillna('')
    profiles = _build_ai_column_profiles(work)
    new_columns = []
    seen = defaultdict(int)

    for profile in profiles:
        target = profile['name']
        semantic_key = profile['semantic_key']
        if semantic_key:
            target = _semantic_label_for_key(semantic_key, lang)
        elif profile['header_key'] == 'dimension' and profile['modality_key']:
            target = _semantic_label_for_key(profile['modality_key'], lang)

        target = re.sub(r'\s+', '_', str(target or '').strip()).strip('_') or f'col_{profile["index"] + 1}'
        seen[target] += 1
        if seen[target] > 1:
            target = f'{target}_{seen[target]}'
        new_columns.append(target)

    work.columns = new_columns
    return work


def _normalize_wide_metrics_to_long(df, lang='fr'):
    """
    Convert a wide table like:
      Annees | Milieu_Total | Milieu_rural | Milieu_urbain
    into a long table like:
      Annees | Milieu | Valeur

    Returns a normalized DataFrame or None if the table does not match the pattern.
    """
    if df is None or df.empty:
        return None

    work = df.copy()
    work.columns = [str(c or '').strip() for c in work.columns]
    if not work.columns.tolist() or len(work.columns) < 3:
        return None

    # Do not re-normalize if already in long format.
    existing_norm = {_normalize_column_name(c) for c in work.columns}
    if 'valeur' in existing_norm:
        return None

    def _is_year_like_series(series):
        values = [_cell_to_text(v) for v in series.tolist() if _cell_to_text(v)]
        # Support short tables (e.g. only 2 years) while avoiding false positives.
        if len(values) < 2:
            return False
        year_like_count = sum(1 for v in values if re.fullmatch(r'(19|20)\d{2}', v))
        return (year_like_count / float(len(values))) >= 0.8

    # Candidate numeric/measure columns.
    measure_cols = []
    for col in work.columns:
        values = work[col].tolist()
        non_empty = [_cell_to_text(v) for v in values if _cell_to_text(v)]
        if len(non_empty) < 2:
            continue
        numeric_count = sum(1 for v in non_empty if _parse_number(v) is not None)
        ratio = numeric_count / float(max(1, len(non_empty)))
        if ratio >= 0.75 and not _is_year_like_series(work[col]):
            measure_cols.append(col)

    if len(measure_cols) < 2:
        return None

    id_cols = [c for c in work.columns if c not in measure_cols]
    # If no identifier column remains, do not unpivot (prevents malformed output).
    if not id_cols:
        return None

    # Infer dimension name from common prefixes in measured columns.
    prefix_counts = {}
    split_map = {}
    for c in measure_cols:
        parts = re.split(r'[_\-:/]+', c, maxsplit=1)
        if len(parts) == 2 and parts[0].strip() and parts[1].strip():
            pref = parts[0].strip()
            suffix = parts[1].strip()
            split_map[c] = (pref, suffix)
            pref_norm = _normalize_name(pref)
            prefix_counts[pref_norm] = prefix_counts.get(pref_norm, 0) + 1

    dim_name = _semantic_label_for_key('dimension', lang)
    selected_prefix_norm = None
    if prefix_counts:
        selected_prefix_norm = max(prefix_counts.items(), key=lambda kv: kv[1])[0]
        if prefix_counts[selected_prefix_norm] >= 2:
            # Keep original-case prefix from first matching column.
            for c in measure_cols:
                pref_suf = split_map.get(c)
                if pref_suf and _normalize_name(pref_suf[0]) == selected_prefix_norm:
                    dim_name = pref_suf[0]
                    break

    # If no explicit prefix was found, infer a semantic dimension name.
    if dim_name == _semantic_label_for_key('dimension', lang):
        dim_name = _infer_dimension_name_from_modalities(measure_cols, lang=lang)

    dim_name = re.sub(r'\s+', '_', str(dim_name).strip()) or 'Dimension'
    if dim_name in id_cols:
        dim_name = f'{dim_name}_dim'

    records = []
    for _, row in work.iterrows():
        base = {col: row.get(col, '') for col in id_cols}
        for mcol in measure_cols:
            raw_val = row.get(mcol, '')
            num = _parse_number(raw_val)
            if num is None:
                continue

            if selected_prefix_norm and mcol in split_map and _normalize_name(split_map[mcol][0]) == selected_prefix_norm:
                modality = split_map[mcol][1]
            else:
                modality = mcol

            rec = dict(base)
            rec[dim_name] = modality
            rec[_semantic_label_for_key('value', lang)] = int(num) if float(num).is_integer() else num
            records.append(rec)

    if not records:
        return None

    long_df = pd.DataFrame(records)
    ordered_cols = [*id_cols, dim_name, _semantic_label_for_key('value', lang)]
    ordered_cols = [c for c in ordered_cols if c in long_df.columns]
    long_df = long_df[ordered_cols]
    return long_df


def _normalize_import_dataframe(excel_file, use_ai=True):
    """Read one Excel file and normalize it to an analytical table."""
    warnings = []
    df = pd.read_excel(excel_file)
    excel_file.seek(0)
    df_raw = pd.read_excel(excel_file, header=None)

    normalized_df = None
    if _is_bad_header_shape(df.columns):
        normalized_df = _normalize_cross_table_to_flat(df_raw)
        if normalized_df is not None:
            df = normalized_df
            warnings.append('Normalisation croisee->plate appliquee')
        else:
            normalized_df = _normalize_merged_headers_to_wide(df_raw)
            if normalized_df is not None:
                df = normalized_df
                warnings.append('Normalisation entetes fusionnes appliquee')

    if use_ai:
        lang = _detect_dataframe_language(df)
        long_df = _normalize_wide_metrics_to_long(df, lang=lang)
        if long_df is not None:
            df = long_df
            warnings.append('Normalisation large->long appliquee (dimension + Valeur)')
        df = _stabilize_ai_analytical_table(df)
        warnings.append('Stabilisation semantique IA appliquee')

    df = df.fillna('')
    df.columns = [str(c or '').strip() for c in df.columns]
    return df, warnings


def _safe_code_from_label(label, fallback_prefix='code'):
    token = _normalize_semantic_token(label)
    token = re.sub(r'[^a-z0-9]+', '_', token).strip('_')
    return token or fallback_prefix


def _pick_value_column(df):
    """Select the metric/value column, preferring explicit names then numeric density."""
    cols = [str(c) for c in df.columns]
    if not cols:
        return None

    explicit = {'valeur', 'value', 'montant', 'effectif', 'nombre', 'taux'}
    for c in cols:
        if _normalize_column_name(c) in explicit:
            return c

    best_col = None
    best_ratio = -1.0
    for c in cols:
        values = [_cell_to_text(v) for v in df[c].tolist() if _cell_to_text(v)]
        if not values:
            continue
        numeric_count = sum(1 for v in values if _parse_number(v) is not None)
        ratio = numeric_count / float(len(values))
        if ratio > best_ratio:
            best_ratio = ratio
            best_col = c

    return best_col


def _build_bilingual_payload(df_fr, df_ar, df_en=None):
    """
    Build canonical bilingual dataset from two aligned FR/AR analytical tables.
    Returns: payload, validation_report
    """
    cols_fr = [str(c) for c in df_fr.columns]
    cols_ar = [str(c) for c in df_ar.columns]
    cols_en = [str(c) for c in df_en.columns] if df_en is not None else []

    report = {
        'rows_fr': int(len(df_fr)),
        'rows_ar': int(len(df_ar)),
        'rows_en': int(len(df_en)) if df_en is not None else 0,
        'cols_fr': int(len(cols_fr)),
        'cols_ar': int(len(cols_ar)),
        'cols_en': int(len(cols_en)) if cols_en else 0,
        'value_mismatches': 0,
        'matched': False,
        'errors': [],
    }

    if len(df_fr) == 0 or len(df_ar) == 0:
        report['errors'].append('Un des deux fichiers est vide.')
        return None, report

    if len(df_fr) != len(df_ar):
        report['errors'].append('Le nombre de lignes FR/AR est different.')
        return None, report

    if len(cols_fr) != len(cols_ar):
        report['errors'].append('Le nombre de colonnes FR/AR est different.')
        return None, report

    if df_en is not None:
        if len(df_fr) != len(df_en):
            report['errors'].append('Le nombre de lignes FR/EN est different.')
            return None, report
        if len(cols_fr) != len(cols_en):
            report['errors'].append('Le nombre de colonnes FR/EN est different.')
            return None, report

    value_col_fr = _pick_value_column(df_fr)
    if not value_col_fr:
        report['errors'].append('Impossible de detecter la colonne de valeur dans le fichier FR.')
        return None, report

    value_col_idx = cols_fr.index(value_col_fr)
    value_col_ar = cols_ar[value_col_idx]

    mismatches = []
    for ridx in range(len(df_fr)):
        fr_num = _parse_number(df_fr.iloc[ridx, value_col_idx])
        ar_num = _parse_number(df_ar.iloc[ridx, value_col_idx])
        if fr_num is None and ar_num is None:
            continue
        if fr_num is None or ar_num is None:
            mismatches.append({'row': ridx + 1, 'fr': df_fr.iloc[ridx, value_col_idx], 'ar': df_ar.iloc[ridx, value_col_idx]})
            continue
        if abs(float(fr_num) - float(ar_num)) > 1e-9:
            mismatches.append({'row': ridx + 1, 'fr': fr_num, 'ar': ar_num})

    report['value_mismatches'] = len(mismatches)
    if mismatches:
        report['errors'].append('Les valeurs numeriques FR/AR ne correspondent pas.')
        report['mismatch_samples'] = mismatches[:20]
        return None, report

    if df_en is not None:
        mismatches_en = []
        for ridx in range(len(df_fr)):
            fr_num = _parse_number(df_fr.iloc[ridx, value_col_idx])
            en_num = _parse_number(df_en.iloc[ridx, value_col_idx])
            if fr_num is None and en_num is None:
                continue
            if fr_num is None or en_num is None:
                mismatches_en.append({'row': ridx + 1, 'fr': df_fr.iloc[ridx, value_col_idx], 'en': df_en.iloc[ridx, value_col_idx]})
                continue
            if abs(float(fr_num) - float(en_num)) > 1e-9:
                mismatches_en.append({'row': ridx + 1, 'fr': fr_num, 'en': en_num})
        if mismatches_en:
            report['errors'].append('Les valeurs numeriques FR/EN ne correspondent pas.')
            report['mismatch_samples_en'] = mismatches_en[:20]
            return None, report

    canonical_columns = []
    column_labels = {}
    used_cols = set()
    for idx, fr_col in enumerate(cols_fr):
        ar_col = cols_ar[idx]
        en_col = cols_en[idx] if cols_en else fr_col
        base_code = _safe_code_from_label(fr_col, f'col_{idx + 1}')
        code = base_code
        suffix = 2
        while code in used_cols:
            code = f'{base_code}_{suffix}'
            suffix += 1
        used_cols.add(code)
        canonical_columns.append(code)
        column_labels[code] = {'fr': fr_col, 'ar': ar_col, 'en': en_col}

    value_col_code = canonical_columns[value_col_idx]
    value_labels = {}
    rows = []

    for ridx in range(len(df_fr)):
        row_obj = {}
        for cidx, col_code in enumerate(canonical_columns):
            fr_val = df_fr.iloc[ridx, cidx]
            ar_val = df_ar.iloc[ridx, cidx]
            en_val = df_en.iloc[ridx, cidx] if df_en is not None else fr_val

            if cidx == value_col_idx:
                parsed = _parse_number(fr_val)
                row_obj[col_code] = parsed if parsed is not None else fr_val
                continue

            fr_txt = _cell_to_text(fr_val)
            ar_txt = _cell_to_text(ar_val)
            en_txt = _cell_to_text(en_val)
            val_code_base = _safe_code_from_label(fr_txt, 'val')
            existing = value_labels.setdefault(col_code, {})
            val_code = val_code_base
            suffix = 2
            while val_code in existing and existing[val_code].get('fr') != fr_txt:
                val_code = f'{val_code_base}_{suffix}'
                suffix += 1

            existing[val_code] = {
                'fr': fr_txt,
                'ar': ar_txt or fr_txt,
                'en': en_txt or fr_txt,
            }
            row_obj[col_code] = val_code

        rows.append(row_obj)

    report['matched'] = True

    payload = {
        'version': 1,
        'canonical_columns': canonical_columns,
        'value_column': value_col_code,
        'column_labels': column_labels,
        'value_labels': value_labels,
        'rows': rows,
        'source_columns': {
            'fr': cols_fr,
            'ar': cols_ar,
            'en': cols_en,
        },
        'build_info': {
            'row_count': len(rows),
            'value_column_fr': value_col_fr,
            'value_column_ar': value_col_ar,
            'value_column_en': cols_en[value_col_idx] if cols_en else value_col_fr,
        },
    }
    return payload, report


def _persist_monolingual_table(st, df):
    st.data_json = df.to_dict(orient='records')
    st.columns_order = [str(c) for c in df.columns]
    st.data_json_i18n = {}
    st.data_is_bilingual = False


def _persist_bilingual_table(st, df_fr, payload, report):
    st.data_json = df_fr.to_dict(orient='records')
    st.columns_order = [str(c) for c in df_fr.columns]
    st.data_json_i18n = {
        **payload,
        'validation_report': report,
    }
    st.data_is_bilingual = True


def _merge_bilingual_payloads(existing_payload, incoming_payload):
    if not existing_payload:
        return incoming_payload

    existing = json.loads(json.dumps(existing_payload))
    if list(existing.get('canonical_columns') or []) != list(incoming_payload.get('canonical_columns') or []):
        raise ValueError('Le schema bilingue existant est incompatible avec les nouvelles colonnes.')

    for col_code in incoming_payload.get('canonical_columns') or []:
        existing_labels = (existing.get('column_labels') or {}).get(col_code, {})
        incoming_labels = (incoming_payload.get('column_labels') or {}).get(col_code, {})
        if (existing_labels.get('fr') or '') != (incoming_labels.get('fr') or ''):
            raise ValueError('Les labels FR du schema bilingue ne correspondent pas au tableau existant.')

    existing_value_labels = existing.setdefault('value_labels', {})
    for col_code, mapping in (incoming_payload.get('value_labels') or {}).items():
        target = existing_value_labels.setdefault(col_code, {})
        for value_code, labels in (mapping or {}).items():
            target[value_code] = labels

    existing_rows = list(existing.get('rows') or [])
    existing_rows.extend(list(incoming_payload.get('rows') or []))
    existing['rows'] = existing_rows

    build_info = existing.setdefault('build_info', {})
    build_info['row_count'] = len(existing_rows)
    return existing


def _maybe_build_bilingual_payload(df_fr, file_ar, file_en=None, use_ai=True):
    if not file_ar:
        return None, None, [], []

    try:
        file_ar.seek(0)
    except Exception:
        pass

    df_ar, warnings_ar = _normalize_import_dataframe(file_ar, use_ai=use_ai)
    warnings_en = []
    df_en = None
    if file_en:
        try:
            file_en.seek(0)
        except Exception:
            pass
        df_en, warnings_en = _normalize_import_dataframe(file_en, use_ai=use_ai)

    payload, report = _build_bilingual_payload(df_fr, df_ar, df_en=df_en)
    return payload, report, warnings_ar, warnings_en


def _has_english_i18n_payload(sub_theme):
    payload = sub_theme.data_json_i18n or {}
    source_columns = payload.get('source_columns') or {}
    cols_en = source_columns.get('en') or []
    return bool(cols_en)


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


def _resolve_column_reference(ref, profiles):
    ref_text = str(ref or '').strip()
    if not ref_text:
        return ''

    by_normalized = {
        _normalize_column_name(profile['name']): profile['name']
        for profile in (profiles or [])
        if str(profile.get('name') or '').strip()
    }
    direct = by_normalized.get(_normalize_column_name(ref_text))
    if direct:
        return direct

    ref_key = _semantic_key_from_label(ref_text)
    if ref_key:
        matches = [p['name'] for p in (profiles or []) if p.get('semantic_key') == ref_key]
        if len(matches) == 1:
            return matches[0]
        if matches:
            return matches[0]

    if ref_key == 'dimension':
        candidates = [
            p['name'] for p in (profiles or [])
            if not p.get('is_value') and not p.get('is_year') and p.get('semantic_key') not in ('province', 'region')
        ]
        if len(candidates) == 1:
            return candidates[0]

    return ''


def _default_filter_columns_from_profiles(profiles):
    return [p['name'] for p in (profiles or []) if not p.get('is_value')]


def _reconcile_column_list(values, profiles, fallback_default=False):
    resolved = []
    for value in (values or []):
        match = _resolve_column_reference(value, profiles)
        if match and match not in resolved:
            resolved.append(match)
    if not resolved and fallback_default:
        return _default_filter_columns_from_profiles(profiles)
    return resolved


def _reconcile_default_filters(default_filters, profiles):
    if not isinstance(default_filters, dict):
        return {}
    output = {}
    for key, value in default_filters.items():
        resolved_key = _resolve_column_reference(key, profiles)
        if resolved_key:
            output[resolved_key] = value
    return output


def _reconcile_chart_configs(charts_config, profiles):
    reconciled = []
    for chart in (charts_config or []):
        if not isinstance(chart, dict):
            continue
        updated = dict(chart)
        for field in ('x', 'y', 'group_by', 'filter_column'):
            resolved = _resolve_column_reference(updated.get(field, ''), profiles)
            if resolved:
                updated[field] = resolved

        filters = []
        for item in updated.get('filters', []) or []:
            if not isinstance(item, dict):
                continue
            resolved = _resolve_column_reference(item.get('column', ''), profiles)
            if not resolved:
                continue
            filters.append({**item, 'column': resolved})
        updated['filters'] = filters

        visible_filters = []
        for item in updated.get('visible_filters', []) or []:
            if isinstance(item, str):
                resolved = _resolve_column_reference(item, profiles)
                if resolved:
                    visible_filters.append(resolved)
                continue
            if isinstance(item, dict):
                resolved = _resolve_column_reference(item.get('column', ''), profiles)
                if resolved:
                    visible_filters.append({**item, 'column': resolved})
        updated['visible_filters'] = visible_filters
        reconciled.append(updated)
    return reconciled


def _reconcile_ai_generated_config(st, df):
    profiles = _build_ai_column_profiles(df)
    if not profiles:
        return

    st.filtres_disponibles = _reconcile_column_list(st.filtres_disponibles or [], profiles, fallback_default=True)
    st.visitor_filters = _reconcile_column_list(st.visitor_filters or [], profiles, fallback_default=bool(st.visitor_filters))
    st.visitor_visible_columns = _reconcile_column_list(st.visitor_visible_columns or [], profiles, fallback_default=False)
    st.visitor_pivot_columns = _reconcile_column_list(st.visitor_pivot_columns or [], profiles, fallback_default=False)
    st.visitor_default_filters = _reconcile_default_filters(st.visitor_default_filters or {}, profiles)
    st.charts_config = _reconcile_chart_configs(st.charts_config or [], profiles)


class InfoBannerView(APIView):
    """Message global INFOS: lecture publique, écriture réservée aux admins."""

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get(self, request):
        banner, _ = InfoBanner.objects.get_or_create(id=1, defaults={'message': '', 'infos': []})

        # Backward compatibility: if infos is empty but legacy message exists,
        # expose it as a single info item.
        infos = banner.infos if isinstance(banner.infos, list) else []
        if not infos and str(banner.message or '').strip():
            infos = [{'text': str(banner.message).strip(), 'text_ar': '', 'text_en': '', 'url': ''}]
            banner.infos = infos
            banner.save(update_fields=['infos', 'updated_at'])

        normalized_infos = []
        for item in infos:
            text = str((item or {}).get('text', '')).strip()
            text_ar = str((item or {}).get('text_ar', '')).strip()
            text_en = str((item or {}).get('text_en', '')).strip()
            url = str((item or {}).get('url', '')).strip()
            if not text:
                continue
            normalized_infos.append({'text': text, 'text_ar': text_ar, 'text_en': text_en, 'url': url})

        if normalized_infos != infos:
            banner.infos = normalized_infos
            banner.save(update_fields=['infos', 'updated_at'])

        serializer = InfoBannerSerializer(banner)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request):
        if getattr(request.user, 'role', None) != 'ADMIN':
            return Response({'error': 'Accès refusé : seulement les administrateurs peuvent modifier cette info.'}, status=status.HTTP_403_FORBIDDEN)

        raw_infos = request.data.get('infos', None)
        normalized_infos = []

        if isinstance(raw_infos, list):
            for item in raw_infos:
                text = str((item or {}).get('text', '')).strip()
                text_ar = str((item or {}).get('text_ar', '')).strip()
                text_en = str((item or {}).get('text_en', '')).strip()
                url = str((item or {}).get('url', '')).strip()
                if not text:
                    continue
                normalized_infos.append({'text': text, 'text_ar': text_ar, 'text_en': text_en, 'url': url})
        else:
            # Legacy support: payload with single message
            legacy_message = str(request.data.get('message', '')).strip()
            if legacy_message:
                normalized_infos = [{'text': legacy_message, 'text_ar': '', 'text_en': '', 'url': ''}]

        if not normalized_infos:
            return Response({'error': 'Au moins une information valide est requise.'}, status=status.HTTP_400_BAD_REQUEST)

        message = normalized_infos[0]['text']
        banner, _ = InfoBanner.objects.get_or_create(id=1, defaults={'message': message, 'infos': normalized_infos, 'updated_by': request.user})
        banner.message = message
        banner.infos = normalized_infos
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
            'about_title_ar': 'حول المنصة',
            'about_text_ar': (
                'تُيسر المنصة الجهوية للمندوبية السامية للتخطيط الولوج إلى الإحصائيات الترابية، '
                'وعرض المؤشرات، ونشر معلومات موثوقة لدعم اتخاذ القرار العمومي.'
            ),
            'about_title_en': 'About the platform',
            'about_text_en': (
                'The regional HCP platform provides access to territorial statistics, '
                'indicator visualizations, and reliable information to support public decision-making.'
            ),
            'contact_title': 'Contact',
            'contact_title_ar': 'اتصل بنا',
            'contact_title_en': 'Contact',
            'contact_email': 'contact@hcp.ma',
            'contact_phone': '+212 5 23 00 00 00',
            'contact_address': 'Direction Régionale HCP\nBéni Mellal - Khénifra',
            'contact_address_ar': 'المديرية الجهوية للمندوبية السامية للتخطيط\nبني ملال - خنيفرة',
            'contact_address_en': 'HCP Regional Directorate\nBéni Mellal - Khénifra',
            'contact_hours': 'Lundi - Vendredi, 08:30 - 16:30',
            'contact_hours_ar': 'الاثنين - الجمعة، 08:30 - 16:30',
            'contact_hours_en': 'Monday - Friday, 08:30 - 16:30',
            'useful_links': [
                {'label': 'Haut-Commissariat au Plan', 'url': 'https://www.hcp.ma'},
                {'label': 'Portail du Gouvernement', 'url': 'https://www.maroc.ma'},
                {'label': 'Open Data Maroc', 'url': 'https://www.data.gov.ma'},
            ],
            'useful_links_ar': [
                {'label': 'المندوبية السامية للتخطيط', 'url': 'https://www.hcp.ma'},
                {'label': 'البوابة الرسمية للحكومة', 'url': 'https://www.maroc.ma'},
                {'label': 'البيانات المفتوحة - المغرب', 'url': 'https://www.data.gov.ma'},
            ],
            'useful_links_en': [
                {'label': 'High Commission for Planning', 'url': 'https://www.hcp.ma'},
                {'label': 'Government Portal', 'url': 'https://www.maroc.ma'},
                {'label': 'Open Data Morocco', 'url': 'https://www.data.gov.ma'},
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
            'title_ar': data.get('title_ar', ''),
            'title_en': data.get('title_en', ''),
            'x_label': data.get('x_label', ''),
            'y_label': data.get('y_label', ''),
            'group_by': data.get('group_by', ''),
            'mesure_ar': data.get('mesure_ar', ''),
            'mesure_en': data.get('mesure_en', ''),
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
                    ch['title_ar'] = data.get('title_ar', ch.get('title_ar', ''))
                    ch['title_en'] = data.get('title_en', ch.get('title_en', ''))
                    ch['x_label'] = data.get('x_label', ch.get('x_label', ''))
                    ch['y_label'] = data.get('y_label', ch.get('y_label', ''))
                    ch['group_by'] = data.get('group_by', ch.get('group_by', ''))
                    ch['mesure_ar'] = data.get('mesure_ar', ch.get('mesure_ar', ''))
                    ch['mesure_en'] = data.get('mesure_en', ch.get('mesure_en', ''))
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
        arabic_file = request.FILES.get('file_ar')
        english_file = request.FILES.get('file_en')
        if not excel_file:
            return Response({'error': 'Aucun fichier fourni'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            if st.data_is_bilingual and not arabic_file:
                return Response(
                    {'error': 'Ce sous-theme est deja bilingue. Le fichier arabe correspondant est obligatoire pour le remplacer.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if _has_english_i18n_payload(st) and not english_file:
                return Response(
                    {'error': 'Ce sous-theme contient deja une version EN. Le fichier anglais correspondant est obligatoire pour le remplacer.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            df, warnings = _normalize_import_dataframe(excel_file, use_ai=False)
            payload, report, warnings_ar, warnings_en = _maybe_build_bilingual_payload(df, arabic_file, english_file, use_ai=False)

            if arabic_file:
                if payload is None:
                    return Response(
                        {'error': 'Validation i18n echouee.', 'validation_report': report, 'warnings': {'fr': warnings, 'ar': warnings_ar, 'en': warnings_en}},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                _persist_bilingual_table(st, df, payload, report)
            else:
                _persist_monolingual_table(st, df)
            st.save()
            response = {'message': 'Import réussi', 'data': st.data_json, 'warnings': warnings}
            if arabic_file:
                response['validation_report'] = report
                response['warnings'] = {'fr': warnings, 'ar': warnings_ar, 'en': warnings_en}
            return Response(response, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception('Erreur import excel')
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='append')
    def append_table(self, request, pk=None):
        """Ajoute les lignes d'un fichier Excel aux données existantes sans écrasement, avec remappage IA/fallback."""
        st = self.get_object()
        excel_file = request.FILES.get('file')
        arabic_file = request.FILES.get('file_ar')
        english_file = request.FILES.get('file_en')
        if not excel_file:
            return Response({'error': 'Aucun fichier fourni'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            use_ai = str(request.data.get('use_ai', 'false')).strip().lower() in ('1', 'true', 'yes', 'oui', 'on')

            if st.data_is_bilingual and not arabic_file:
                return Response(
                    {'error': 'Ce sous-theme est deja bilingue. Le fichier arabe est obligatoire pour tout ajout.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if _has_english_i18n_payload(st) and not english_file:
                return Response(
                    {'error': 'Ce sous-theme contient deja des donnees EN. Le fichier anglais est obligatoire pour tout ajout.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if (arabic_file or english_file) and not st.data_is_bilingual and list(st.data_json or []):
                return Response(
                    {'error': 'Ajout i18n sur un sous-theme monolingue non supporte. Faites d\'abord un remplacement complet FR/AR(/EN).'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            df, warnings = _normalize_import_dataframe(excel_file, use_ai=use_ai)
            normalized_df = df
            incoming_columns = [str(c) for c in df.columns]

            existing_rows = list(st.data_json or [])
            existing_columns = list(st.columns_order or [])

            if _is_bad_header_shape(existing_columns) and normalized_df is not None:
                existing_columns = [str(c) for c in normalized_df.columns]
                warnings.append('Schema cible corrige a partir de la table normalisee')

            overlap = _schema_overlap_ratio(existing_columns, incoming_columns)

            if not existing_columns:
                mapped_rows = df.to_dict(orient='records')
                final_columns = incoming_columns
                warnings.append('Schema cible vide: colonnes du fichier adoptees')
            elif set(incoming_columns) == set(existing_columns):
                mapped_rows = [
                    {col: row.get(col, '') for col in existing_columns}
                    for row in df.to_dict(orient='records')
                ]
                final_columns = existing_columns
                warnings.append('Colonnes compatibles: ajout direct ordonne')
            else:
                if not use_ai:
                    return Response(
                        {
                            'error': 'Colonnes incompatibles pour ajout classique. Activez Ajouter avec IA ou alignez les colonnes du fichier.',
                            'expected_columns': existing_columns,
                            'incoming_columns': incoming_columns,
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                try:
                    mapped_rows = _run_gemini_mapping(df, existing_columns)
                    final_columns = existing_columns
                    warnings.append('Mapping IA applique pour ajout')
                except Exception as ai_err:
                    logger.warning('Fallback append mapping active: %s', ai_err)
                    mapped_rows = _fallback_map_rows(df, existing_columns)
                    final_columns = existing_columns
                    warnings.append('Mapping IA indisponible: fallback heuristique utilise pour ajout')

                warnings.append(
                    f'Colonnes source differentes. Recouvrement schema: {round(overlap * 100)}%'
                )

            mapped_df = pd.DataFrame(mapped_rows, columns=final_columns)
            merged = existing_rows + mapped_rows

            if arabic_file:
                payload, report, warnings_ar, warnings_en = _maybe_build_bilingual_payload(mapped_df, arabic_file, english_file, use_ai=use_ai)
                if payload is None:
                    return Response(
                        {'error': 'Validation i18n echouee.', 'validation_report': report, 'warnings': {'fr': warnings, 'ar': warnings_ar, 'en': warnings_en}},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                merged_payload = _merge_bilingual_payloads(st.data_json_i18n or {}, payload)
                st.data_json = merged
                st.columns_order = final_columns
                st.data_json_i18n = {
                    **merged_payload,
                    'validation_report': {'matched': True, 'rows_total': len(merged_payload.get('rows') or [])},
                }
                st.data_is_bilingual = True
                warnings = {'fr': warnings, 'ar': warnings_ar, 'en': warnings_en}
            else:
                st.data_json = merged
                st.columns_order = final_columns

            if use_ai:
                _reconcile_ai_generated_config(st, mapped_df)
            st.save()

            return Response(
                {
                    'message': f'{len(mapped_rows)} ligne(s) ajoutee(s). Total : {len(merged)} ligne(s).',
                    'data': st.data_json,
                    'columns_order': list(st.columns_order),
                    'warnings': warnings,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            logger.exception('Erreur append excel')
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='import-smart')
    def import_table_smart(self, request, pk=None):
        """Import Excel with AI-assisted column mapping to current sous-theme schema."""
        st = self.get_object()
        excel_file = request.FILES.get('file')
        arabic_file = request.FILES.get('file_ar')
        english_file = request.FILES.get('file_en')
        if not excel_file:
            return Response({'error': 'Aucun fichier fourni'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if st.data_is_bilingual and not arabic_file:
                return Response(
                    {'error': 'Ce sous-theme est deja bilingue. Le fichier arabe correspondant est obligatoire pour le remplacer.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if _has_english_i18n_payload(st) and not english_file:
                return Response(
                    {'error': 'Ce sous-theme contient deja une version EN. Le fichier anglais correspondant est obligatoire pour le remplacer.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            df, warnings = _normalize_import_dataframe(excel_file, use_ai=True)
            incoming_columns = [str(c) for c in df.columns]
            free_schema = str(request.data.get('free_schema', 'true')).strip().lower() in ('1', 'true', 'yes', 'oui', 'on')

            expected_columns = list(st.columns_order or st.columns or [])
            overlap = _schema_overlap_ratio(expected_columns, incoming_columns)
            should_adopt_incoming = bool(free_schema and incoming_columns)

            if should_adopt_incoming:
                mapped_rows = df.to_dict(orient='records')
                expected_columns = incoming_columns
                mapped_df = df.copy()
                warnings.append('Mode schema libre: colonnes du fichier adoptees')
                if overlap > 0:
                    warnings.append(f'Recouvrement schema precedent: {round(overlap * 100)}%')
            else:
                if not expected_columns:
                    expected_columns = [str(c) for c in df.columns]
                    mapped_rows = df.to_dict(orient='records')
                    mapped_df = df.copy()
                    warnings.append('Schema cible vide: import classique applique')
                else:
                    try:
                        mapped_rows = _run_gemini_mapping(df, expected_columns)
                        warnings.append('Mapping IA applique')
                    except Exception as ai_err:
                        logger.warning('Fallback mapping active: %s', ai_err)
                        mapped_rows = _fallback_map_rows(df, expected_columns)
                        warnings.append('Mapping IA indisponible: fallback heuristique utilise')
                    mapped_df = pd.DataFrame(mapped_rows, columns=expected_columns)

            if arabic_file:
                payload, report, warnings_ar, warnings_en = _maybe_build_bilingual_payload(mapped_df, arabic_file, english_file, use_ai=True)
                if payload is None:
                    return Response(
                        {
                            'error': 'Validation i18n echouee.',
                            'validation_report': report,
                            'warnings': {'fr': warnings, 'ar': warnings_ar, 'en': warnings_en},
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                _persist_bilingual_table(st, mapped_df, payload, report)
            else:
                st.data_json = mapped_rows
                st.columns_order = expected_columns
                st.data_json_i18n = {}
                st.data_is_bilingual = False

            _reconcile_ai_generated_config(st, mapped_df)

            st.save()
            response = {
                'message': 'Import intelligent reussi',
                'data': mapped_rows,
                'columns_order': expected_columns,
                'warnings': warnings,
            }
            if arabic_file:
                response['validation_report'] = report
                response['warnings'] = {'fr': warnings, 'ar': warnings_ar, 'en': warnings_en}
            return Response(response, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception('Erreur import intelligent')
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='import-bilingual')
    def import_table_bilingual(self, request, pk=None):
        """
        Import two aligned files (FR + AR), validate numeric coherence,
        and store a durable bilingual canonical dataset.
        """
        st = self.get_object()
        file_fr = request.FILES.get('file_fr')
        file_ar = request.FILES.get('file_ar')
        file_en = request.FILES.get('file_en')

        if not file_fr or not file_ar:
            return Response(
                {'error': 'Deux fichiers sont obligatoires: file_fr et file_ar.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            use_ai = str(request.data.get('use_ai', 'true')).strip().lower() in ('1', 'true', 'yes', 'oui', 'on')

            df_fr, warnings_fr = _normalize_import_dataframe(file_fr, use_ai=use_ai)
            file_ar.seek(0)
            df_ar, warnings_ar = _normalize_import_dataframe(file_ar, use_ai=use_ai)

            df_en = None
            warnings_en = []
            if file_en:
                file_en.seek(0)
                df_en, warnings_en = _normalize_import_dataframe(file_en, use_ai=use_ai)

            payload, report = _build_bilingual_payload(df_fr, df_ar, df_en=df_en)
            if payload is None:
                return Response(
                    {
                        'error': 'Validation i18n echouee. Corrigez les ecarts FR/AR(/EN) puis reimportez.',
                        'validation_report': report,
                        'warnings': {
                            'fr': warnings_fr,
                            'ar': warnings_ar,
                            'en': warnings_en,
                        },
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Backward compatibility: keep FR table for existing screens.
            st.data_json = df_fr.to_dict(orient='records')
            st.columns_order = [str(c) for c in df_fr.columns]

            # Durable bilingual analytical storage.
            st.data_json_i18n = {
                **payload,
                'validation_report': report,
            }
            st.data_is_bilingual = True
            if use_ai:
                _reconcile_ai_generated_config(st, df_fr)
            st.save()

            return Response(
                {
                    'message': 'Import i18n reussi (FR + AR + EN optionnel) avec validation complete.',
                    'columns_order': st.columns_order,
                    'validation_report': report,
                    'warnings': {
                        'fr': warnings_fr,
                        'ar': warnings_ar,
                        'en': warnings_en,
                    },
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            logger.exception('Erreur import bilingue')
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
            titre_ar = ' '.join(str(request.data.get('titre_ar') or '').strip().split())
            titre_en = ' '.join(str(request.data.get('titre_en') or '').strip().split())
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
                titre_ar=titre_ar or '',
                titre_en=titre_en or '',
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
                    cat_nom_ar = ' '.join(str(request.data.get(f'categories[{cat_index}][nom_ar]') or '').strip().split())
                    cat_nom_en = ' '.join(str(request.data.get(f'categories[{cat_index}][nom_en]') or '').strip().split())
                    cat_ordre = request.data.get(f'categories[{cat_index}][ordre]', cat_index)
                    if cat_nom and cat_nom.strip():
                        normalized_cat_nom = _normalize_name(cat_nom)
                        if normalized_cat_nom in local_category_names:
                            return Response({'error': f'Doublon détecté dans les catégories: "{cat_nom}".'}, status=status.HTTP_400_BAD_REQUEST)
                        local_category_names.add(normalized_cat_nom)

                        cat_obj = Categorie.objects.create(
                            nom=cat_nom,
                            nom_ar=cat_nom_ar or '',
                            nom_en=cat_nom_en or '',
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
                nom_st_ar = ' '.join(str(request.data.get(f'lignes[{index}][sousTheme_ar]') or '').strip().split())
                nom_st_en = ' '.join(str(request.data.get(f'lignes[{index}][sousTheme_en]') or '').strip().split())
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
                    nom_ar=nom_st_ar or '',
                    nom_en=nom_st_en or '',
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
            nom_ar = request.data.get('nom_ar') or ''
            nom_en = request.data.get('nom_en') or ''
            if not nom:
                return Response({'error': 'Le nom du sous-thème est requis'}, status=status.HTTP_400_BAD_REQUEST)
            nom = ' '.join(str(nom).strip().split())
            nom_ar = ' '.join(str(nom_ar).strip().split())
            nom_en = ' '.join(str(nom_en).strip().split())

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
            
            st = SousTheme.objects.create(
                nom=nom,
                nom_ar=nom_ar,
                nom_en=nom_en,
                theme=theme,
                categorie=categorie_obj,
                is_visible=is_visible,
            )
            serializer = SousThemeSerializer(st)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.exception('Erreur ajout sous-theme')
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='generate-report-context')
    def generate_report_context(self, request, pk=None):
        """Build structured report context (sans explications IA) avec vues FR/AR et horizontal/vertical."""
        try:
            self._require_admin(request)
            theme = self.get_object()

            language = str(request.data.get('language', 'fr')).strip().lower()
            if language not in ('fr', 'ar', 'en', 'both', 'all'):
                language = 'fr'
            table_view = str(request.data.get('table_view', 'horizontal')).strip().lower()
            if table_view not in ('horizontal', 'vertical'):
                table_view = 'horizontal'

            include_charts = _is_truthy(request.data.get('include_charts', True))
            requested_ids = _parse_subtheme_ids(request.data.get('sous_theme_ids'))

            subthemes_qs = theme.sous_themes.all().order_by('ordre', 'id')
            if requested_ids:
                subthemes_qs = subthemes_qs.filter(id__in=requested_ids)

            sections = []

            for st in subthemes_qs:
                metadata = _build_non_empty_metadata(st, language)
                table_payload = _build_report_table_payload(st, language=language, table_view=table_view)

                sections.append({
                    'sub_theme_id': st.id,
                    'sub_theme_name': st.nom,
                    'sub_theme_name_ar': st.nom_ar,
                    'sub_theme_name_en': getattr(st, 'nom_en', None),
                    'metadata': metadata,
                    'table': table_payload,
                    'charts': list(st.charts_config or []) if include_charts else [],
                    'charts_count': len(list(st.charts_config or [])) if include_charts else 0,
                })

            return Response(
                {
                    'theme': {
                        'id': theme.id,
                        'title_fr': theme.titre,
                        'title_ar': theme.titre_ar,
                        'title_en': getattr(theme, 'titre_en', None),
                    },
                    'options': {
                        'language': language,
                        'table_view': table_view,
                        'include_charts': include_charts,
                        'sous_theme_ids': requested_ids,
                    },
                    'ai_status': {
                        'requested': False,
                        'used_count': 0,
                        'fallback_count': 0,
                        'mode': 'disabled',
                    },
                    'sections': sections,
                },
                status=status.HTTP_200_OK,
            )
        except PermissionDenied:
            raise
        except Exception as e:
            logger.exception('Erreur génération contexte rapport')
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

    def _is_assignment_archived(self, assignment):
        notes_obj = self._load_notes(assignment)
        return bool(notes_obj.get('assignment_archived', False)) if isinstance(notes_obj, dict) else False

    def create(self, request, *args, **kwargs):
        # Création d'assignation réservée aux admins
        if getattr(request.user, 'role', None) != 'ADMIN':
            return Response({'error': 'Seuls les administrateurs peuvent créer des assignations.'}, status=status.HTTP_403_FORBIDDEN)

        user_id = request.data.get('user')
        theme_id = request.data.get('theme')
        sous_theme_id = request.data.get('sous_theme')
        indicateur_id = request.data.get('indicateur')

        theme_id = None if theme_id in ['', None] else theme_id
        sous_theme_id = None if sous_theme_id in ['', None] else sous_theme_id
        indicateur_id = None if indicateur_id in ['', None] else indicateur_id

        existing = UserThemeAssignment.objects.filter(
            user_id=user_id,
            theme_id=theme_id,
            sous_theme_id=sous_theme_id,
            indicateur_id=indicateur_id,
        ).first()

        # Si une assignation identique existe mais est archivée, on la réactive.
        if existing:
            if self._is_assignment_archived(existing):
                notes_obj = self._load_notes(existing)
                if not isinstance(notes_obj, dict):
                    notes_obj = {}
                notes_obj['assignment_archived'] = False
                self._append_history(
                    notes_obj,
                    actor=request.user.username,
                    action='admin_reassign_after_archive',
                    message='Réaffectation après archivage',
                )
                self._save_notes(existing, notes_obj)

                existing.statut = 'En cours'
                existing.progression = 0
                existing.date_completion = None
                if request.data.get('priorite'):
                    existing.priorite = request.data.get('priorite')
                existing.save()

                return Response(self.get_serializer(existing).data, status=status.HTTP_200_OK)

            return Response({'error': 'Cette assignation existe déjà et est active.'}, status=status.HTTP_400_BAD_REQUEST)

        return super().create(request, *args, **kwargs)

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

    @action(detail=True, methods=['post'], url_path='archive')
    def archive_assignment(self, request, pk=None):
        """Archive une assignation sans désactiver l'utilisateur lié."""
        assignment = self.get_object()
        if getattr(request.user, 'role', None) != 'ADMIN':
            return Response({'error': 'Accès refusé'}, status=status.HTTP_403_FORBIDDEN)

        notes_obj = self._load_notes(assignment)
        notes_obj['assignment_archived'] = True
        self._append_history(notes_obj, actor=request.user.username, action='admin_archive_assignment', message='Assignation archivée')
        self._save_notes(assignment, notes_obj)
        assignment.save()

        return Response(self.get_serializer(assignment).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='unarchive')
    def unarchive_assignment(self, request, pk=None):
        """Désarchive une assignation sans modifier l'utilisateur lié."""
        assignment = self.get_object()
        if getattr(request.user, 'role', None) != 'ADMIN':
            return Response({'error': 'Accès refusé'}, status=status.HTTP_403_FORBIDDEN)

        notes_obj = self._load_notes(assignment)
        notes_obj['assignment_archived'] = False
        self._append_history(notes_obj, actor=request.user.username, action='admin_unarchive_assignment', message='Assignation désarchivée')
        self._save_notes(assignment, notes_obj)
        assignment.save()

        return Response(self.get_serializer(assignment).data, status=status.HTTP_200_OK)
    
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

                for field in [
                    'definition_text', 'unite_text', 'indication_text', 'source_text', 'periodicite_text', 'couverture_text',
                    'definition_text_ar', 'unite_text_ar', 'indication_text_ar', 'source_text_ar', 'periodicite_text_ar', 'couverture_text_ar',
                ]:
                    if field in meta:
                        setattr(sous_theme, field, meta.get(field))

                for field in ['niveau_geo', 'type_unite', 'est_sommable', 'filtres_disponibles']:
                    if field in advanced_config:
                        setattr(sous_theme, field, advanced_config.get(field))

                if 'visitor_defaults' in notes_obj:
                    sous_theme.visitor_default_filters = notes_obj.get('visitor_defaults') or {}

                # Apply visitor config submitted by the saisisseur via the visitor config button
                visitor_config = notes_obj.get('visitor_config')
                if isinstance(visitor_config, dict):
                    for field in ['visitor_visible_columns', 'visitor_filters', 'visitor_pivot_columns', 'visitor_default_view']:
                        if field in visitor_config:
                            setattr(sous_theme, field, visitor_config[field])
                    if 'visitor_default_filters' in visitor_config:
                        sous_theme.visitor_default_filters = visitor_config['visitor_default_filters'] or {}

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

    def get_queryset(self):
        qs = super().get_queryset()
        user = getattr(self.request, 'user', None)
        if getattr(user, 'role', None) == 'ADMIN':
            return qs
        return qs.filter(created_by=user)

    def list(self, request, *args, **kwargs):
        if getattr(request.user, 'role', None) != 'ADMIN':
            return Response({'error': 'Accès refusé'}, status=status.HTTP_403_FORBIDDEN)
        return super().list(request, *args, **kwargs)
    
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
            if getattr(request.user, 'role', None) != 'ADMIN':
                return Response({'error': 'Accès refusé'}, status=status.HTTP_403_FORBIDDEN)
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
            if getattr(request.user, 'role', None) != 'ADMIN':
                return Response({'error': 'Accès refusé'}, status=status.HTTP_403_FORBIDDEN)
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


class AdminAssistantChatView(APIView):
    permission_classes = [IsAuthenticated]

    def _require_admin(self, request):
        if getattr(request.user, 'role', None) != 'ADMIN':
            raise PermissionDenied('Accès refusé : assistant réservé aux administrateurs.')

    def _empty_or_null_query(self, field_name):
        return Q(**{f'{field_name}__isnull': True}) | Q(**{field_name: ''})

    def _build_fallback_answer(self, message, theme_id=None):
        msg = _clean_text(message).lower()
        themes_qs = Theme.objects.all()
        subthemes_qs = SousTheme.objects.all()
        if theme_id:
            themes_qs = themes_qs.filter(id=theme_id)
            subthemes_qs = subthemes_qs.filter(theme_id=theme_id)

        total_themes = themes_qs.count()
        total_subthemes = subthemes_qs.count()
        archived_themes_qs = themes_qs.filter(archived=True)
        archived_themes_count = archived_themes_qs.count()
        public_active = themes_qs.filter(is_visible=True, archived=False).count()

        empty_meta_q = (
            self._empty_or_null_query('definition_text')
            & self._empty_or_null_query('unite_text')
            & self._empty_or_null_query('indication_text')
            & self._empty_or_null_query('source_text')
            & self._empty_or_null_query('periodicite_text')
            & self._empty_or_null_query('couverture_text')
            & self._empty_or_null_query('definition_text_ar')
            & self._empty_or_null_query('unite_text_ar')
            & self._empty_or_null_query('indication_text_ar')
            & self._empty_or_null_query('source_text_ar')
            & self._empty_or_null_query('periodicite_text_ar')
            & self._empty_or_null_query('couverture_text_ar')
        )
        missing_meta_count = subthemes_qs.filter(empty_meta_q).count()

        # Réponses par défaut pour chaque question fréquente
        if any(k in msg for k in ['rapport', 'report', 'rédiger', 'rediger', 'pdf', 'word']):
            return (
                "Pour générer un rapport :\n"
                "1. Ouvrez l'onglet Gestion des Thèmes.\n"
                "2. Cliquez sur le bouton 📝 Rapport sur la ligne du thème.\n"
                "3. Sélectionnez les sous-thèmes, la langue et l'option graphes.\n"
                "4. Cliquez sur Générer le rapport puis téléchargez PDF ou Word.\n"
                "Le mode secours s'active automatiquement si l'IA est indisponible."
            )

        if any(k in msg for k in ['utilisateur', 'saisisseur', 'ajouter utilisateur', 'ajouter saisisseur', 'nouveau utilisateur', 'nouveau saisisseur']):
            return "Pour ajouter un nouveau saisisseur, cliquez sur 'Ajouter' en haut à droite de la page Utilisateurs, remplissez le formulaire puis validez."

        if any(k in msg for k in ['réinitialiser', 'reset', 'mot de passe']):
            return "Pour réinitialiser le mot de passe d'un utilisateur, cliquez sur le bouton '⋮' à droite de l'utilisateur puis choisissez 'Réinitialiser le mot de passe'."

        if any(k in msg for k in ['archiver', 'désarchiver', 'supprimer utilisateur', 'supprimer saisisseur']):
            return "Pour archiver, désarchiver ou supprimer un utilisateur, utilisez le bouton '⋮' à droite de l'utilisateur et choisissez l'action souhaitée."

        if any(k in msg for k in ['assigner', 'affecter', 'tâche', 'tache', 'affectation', 'assignation']):
            return "Pour assigner un thème à un utilisateur, sélectionnez l'utilisateur et le thème dans le formulaire d'assignation puis validez."

        if any(k in msg for k in ['priorité', 'changer priorité', 'changer la priorité']):
            return "Pour changer la priorité d'une tâche, cliquez sur '⋮' à droite de la tâche puis choisissez la nouvelle priorité."

        if any(k in msg for k in ['valider', 'rejeter', 'soumission', 'approuver', 'corrections']):
            return "Pour valider ou rejeter une soumission, cliquez sur '⋮' à droite de la tâche puis choisissez 'Approuver' ou 'Demander des corrections'."

        if any(k in msg for k in ['public', 'privé', 'prive', 'rendre public', 'rendre privé', 'rendre prive']):
            return "Pour rendre un thème public ou privé, cliquez sur le bouton correspondant dans la colonne 'Visibilité' de la liste des thèmes."

        if any(k in msg for k in ['archiver thème', 'restaurer thème', 'archiver un thème', 'restaurer un thème']):
            return "Pour archiver ou restaurer un thème, cliquez sur le bouton correspondant dans la colonne 'État' de la liste des thèmes."

        if any(k in msg for k in ['liste sous-thèmes', 'liste sous theme', 'afficher sous-thèmes', 'afficher sous theme']):
            return "Pour afficher la liste des sous-thèmes d'un thème, cliquez sur la flèche à gauche du nom du thème dans la liste."

        if any(k in msg for k in ['tableau de bord', 'dashboard', 'utiliser interface', 'utilisation interface']):
            return "Le tableau de bord admin affiche les statistiques et accès rapides. Utilisez les onglets et boutons pour naviguer entre les fonctionnalités."

        if any(k in msg for k in ['notification', 'messages reçus', 'boîte de réception', 'boite de reception']):
            return "Les notifications des saisisseurs sont accessibles via le bouton 'Notifications' en haut de la page admin."

        if any(k in msg for k in ['filtrer', 'recherche', 'filtre', 'rechercher']):
            return "Pour filtrer les utilisateurs ou les tâches, utilisez les champs de recherche ou les filtres disponibles en haut des tableaux."

        if any(k in msg for k in ['configuration sous-thème', 'configurer sous-thème', 'config sous-thème', 'config sous theme']):
            return "Pour accéder à la configuration d'un sous-thème, ouvrez la gestion des thèmes, développez le thème puis cliquez sur le sous-thème souhaité."

        if any(k in msg for k in ['archive', 'archivé', 'archiver']):
            names = list(archived_themes_qs.values_list('titre', flat=True)[:10])
            if not names:
                return "Aucun thème archivé trouvé pour le périmètre actuel."
            joined = '\n- '.join(names)
            return f"Thèmes archivés ({archived_themes_count}) :\n- {joined}"

        if any(k in msg for k in ['metadonne', 'métadonné', 'metadata']):
            return (
                f"Sous-thèmes sans métadonnées renseignées: {missing_meta_count}. "
                "Je peux vous aider à prioriser ceux à compléter en premier."
            )

        if any(k in msg for k in ['stat', 'combien', 'nombre', 'theme', 'sous-theme', 'sous thème']):
            return (
                f"Statistiques actuelles:\n"
                f"- Thèmes: {total_themes}\n"
                f"- Sous-thèmes: {total_subthemes}\n"
                f"- Publics actifs: {public_active}\n"
                f"- Archivés: {archived_themes_count}\n"
                f"- Sous-thèmes sans métadonnées: {missing_meta_count}"
            )

        return (
            "Je suis votre assistant admin. Voici quelques questions utiles que vous pouvez poser :\n"
            "\n"
            "Statistiques et données :\n"
            "- Combien d’utilisateurs ou de saisisseurs sont enregistrés ?\n"
            "- Afficher la liste des thèmes ou sous-thèmes actifs.\n"
            "- Voir les tâches en attente ou terminées.\n"
            "- Quel est le taux de progression moyen des saisisseurs ?\n"
            "\n"
            "Gestion des utilisateurs :\n"
            "- Comment ajouter un nouveau saisisseur ?\n"
            "- Comment réinitialiser le mot de passe d’un utilisateur ?\n"
            "- Comment archiver/désarchiver ou supprimer un utilisateur ?\n"
            "\n"
            "Gestion des affectations :\n"
            "- Comment assigner un thème à un utilisateur ?\n"
            "- Voir les tâches assignées à un utilisateur précis.\n"
            "- Changer la priorité d’une tâche.\n"
            "- Valider ou rejeter une soumission.\n"
            "\n"
            "Gestion des thèmes :\n"
            "- Rendre un thème public ou privé.\n"
            "- Archiver ou restaurer un thème.\n"
            "- Afficher la liste des sous-thèmes d’un thème.\n"
            "\n"
            "Utilisation de l’interface :\n"
            "- Comment utiliser le tableau de bord admin ?\n"
            "- Où trouver les notifications des saisisseurs ?\n"
            "- Comment filtrer les utilisateurs ou les tâches ?\n"
            "- Accéder à la configuration d’un sous-thème."
        )

    def _try_ai_rewrite(self, user_message, fallback_text):
        api_key = os.getenv('GEMINI_API_KEY', '').strip() or HARDCODED_GEMINI_API_KEY
        model_name = os.getenv('GEMINI_MODEL', 'gemini-1.5-flash').strip() or 'gemini-1.5-flash'
        if not api_key:
            raise RuntimeError('GEMINI_API_KEY manquante')

        try:
            import google.generativeai as genai
        except Exception as exc:
            raise RuntimeError('google-generativeai indisponible') from exc

        prompt = (
            "Tu es un assistant admin d'une plateforme statistique. "
            "Réécris la réponse de secours de manière claire et concise en français. "
            "N'invente aucun chiffre.\n\n"
            f"Question utilisateur: {user_message}\n"
            f"Réponse de secours: {fallback_text}\n\n"
            "Retourne uniquement la réponse finale."
        )

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name)
        response = model.generate_content(prompt)
        text = _clean_text(getattr(response, 'text', '') or '')
        if not text:
            raise RuntimeError('Réponse IA vide')
        return text

    def post(self, request):
        self._require_admin(request)
        message = _clean_text(request.data.get('message'))
        if not message:
            return Response({'error': 'Le message est obligatoire.'}, status=status.HTTP_400_BAD_REQUEST)

        theme_id = request.data.get('theme_id')
        try:
            theme_id = int(theme_id) if theme_id is not None else None
        except Exception:
            theme_id = None

        use_ai = _is_truthy(request.data.get('use_ai', False))
        fallback_answer = self._build_fallback_answer(message, theme_id=theme_id)

        if not use_ai:
            return Response(
                {
                    'reply': fallback_answer,
                    'mode': 'fallback',
                },
                status=status.HTTP_200_OK,
            )

        try:
            ai_reply = self._try_ai_rewrite(message, fallback_answer)
            return Response(
                {
                    'reply': ai_reply,
                    'mode': 'ai',
                },
                status=status.HTTP_200_OK,
            )
        except Exception as ai_error:
            logger.warning('Admin assistant fallback activé: %s', ai_error)
            return Response(
                {
                    'reply': fallback_answer,
                    'mode': 'fallback',
                    'fallback_reason': str(ai_error),
                },
                status=status.HTTP_200_OK,
            )