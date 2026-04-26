import logging
import uuid
import base64
import json
import re
import os
import time
import importlib
import unicodedata
import urllib.error
import urllib.request
from contextvars import ContextVar
import pandas as pd
import string
import secrets
from collections import Counter, defaultdict
from django.utils import timezone
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.db import connection, transaction
from django.conf import settings
from django.http import StreamingHttpResponse
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
AI_PROVIDER_LAST = ContextVar('AI_PROVIDER_LAST', default='none')
AI_PROVIDER_ATTEMPTED = ContextVar('AI_PROVIDER_ATTEMPTED', default=False)


def _public_error_message(default_message='Une erreur est survenue. Veuillez réessayer.'):
    return default_message

ARABIC_CHAR_RE = re.compile(r'[\u0600-\u06FF]')
ARABIC_DIGITS_TRANSLATION = str.maketrans('٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789')

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


class HealthCheckView(APIView):
    """Operational health endpoint for probes and basic diagnostics."""

    permission_classes = [AllowAny]

    def _db_ready(self):
        try:
            with connection.cursor() as cursor:
                cursor.execute('SELECT 1')
                cursor.fetchone()
            return True, None
        except Exception as exc:
            return False, str(exc)

    def get(self, request):
        db_ok, db_error = self._db_ready()
        expose_internal = _read_bool_env('HEALTH_EXPOSE_INTERNAL_STATUS', bool(getattr(settings, 'DEBUG', False)))
        checks = {
            'db': {'ok': db_ok, 'error': db_error if expose_internal else None},
        }
        if expose_internal:
            checks['secret_key_configured'] = bool(getattr(settings, 'SECRET_KEY', '').strip()) and settings.SECRET_KEY != 'unsafe-dev-key-change-me'
            checks['allowed_hosts_configured'] = bool(getattr(settings, 'ALLOWED_HOSTS', []))
            checks['debug'] = bool(getattr(settings, 'DEBUG', False))

        ready = bool(db_ok)
        payload = {
            'status': 'ok' if ready else 'degraded',
            'ready': ready,
            'service': 'hcp-backend',
            'timestamp': timezone.now().isoformat(),
            'checks': checks,
        }
        return Response(payload, status=status.HTTP_200_OK if ready else status.HTTP_503_SERVICE_UNAVAILABLE)

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


def _normalize_province_value(value):
    """Normalize province labels for robust order matching."""
    text = _normalize_name(value)
    if not text:
        return ''
    text = re.sub(r'\s*[-–—]\s*', '-', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def _find_semantic_column(columns, semantic_key):
    for col in (columns or []):
        if _semantic_key_from_label(col) == semantic_key:
            return str(col)
    return None


def _extract_ordered_unique_values(values, normalizer=None):
    seen = set()
    ordered = []
    for raw in (values or []):
        txt = _cell_to_text(raw)
        if not txt:
            continue
        key = normalizer(txt) if normalizer else txt
        if not key or key in seen:
            continue
        seen.add(key)
        ordered.append(txt)
    return ordered


def _extract_province_order_from_df(df):
    if df is None or df.empty:
        return []

    province_col = _find_semantic_column([str(c) for c in df.columns], 'province')
    if not province_col:
        return []

    return _extract_ordered_unique_values(df[province_col].tolist(), normalizer=_normalize_province_value)


def _apply_province_order_to_rows(rows, province_order, province_col_name=None):
    rows = list(rows or [])
    if not rows:
        return rows

    if not province_col_name:
        first_row = rows[0] if isinstance(rows[0], dict) else {}
        province_col_name = _find_semantic_column(list(first_row.keys()), 'province')
    if not province_col_name:
        return rows

    ordered = _extract_ordered_unique_values(province_order or [], normalizer=_normalize_province_value)
    if not ordered:
        return rows

    rank = {
        _normalize_province_value(name): idx
        for idx, name in enumerate(ordered)
        if _normalize_province_value(name)
    }
    default_rank = len(rank) + 1

    indexed = list(enumerate(rows))
    indexed.sort(
        key=lambda pair: (
            rank.get(_normalize_province_value((pair[1] or {}).get(province_col_name, '')), default_rank),
            pair[0],
        )
    )
    return [row for _, row in indexed]


def _apply_province_order_to_dataframe(df, province_order=None):
    if df is None or df.empty:
        return df

    columns = [str(c) for c in df.columns]
    province_col = _find_semantic_column(columns, 'province')
    if not province_col:
        return df

    effective_order = list(province_order or [])
    if not effective_order:
        effective_order = _extract_province_order_from_df(df)

    rows = df.to_dict(orient='records')
    ordered_rows = _apply_province_order_to_rows(rows, effective_order, province_col_name=province_col)
    if ordered_rows == rows:
        return df

    return pd.DataFrame(ordered_rows, columns=columns)


def _read_int_env(name, default_value, min_value=None, max_value=None):
    raw = os.getenv(name, '').strip()
    try:
        value = int(raw) if raw else int(default_value)
    except Exception:
        value = int(default_value)
    if min_value is not None:
        value = max(min_value, value)
    if max_value is not None:
        value = min(max_value, value)
    return value


def _read_float_env(name, default_value, min_value=None, max_value=None):
    raw = os.getenv(name, '').strip()
    try:
        value = float(raw) if raw else float(default_value)
    except Exception:
        value = float(default_value)
    if min_value is not None:
        value = max(min_value, value)
    if max_value is not None:
        value = min(max_value, value)
    return value


def _read_bool_env(name, default_value=False):
    raw = os.getenv(name)
    if raw is None:
        return bool(default_value)
    return str(raw).strip().lower() in ('1', 'true', 'yes', 'oui', 'on')


def _mark_ai_provider(provider):
    AI_PROVIDER_ATTEMPTED.set(True)
    AI_PROVIDER_LAST.set(str(provider or 'none').strip().lower() or 'none')


def _reset_ai_provider_marker():
    AI_PROVIDER_ATTEMPTED.set(False)
    AI_PROVIDER_LAST.set('none')


def _build_ai_provider_warning(use_ai=False):
    if not use_ai:
        return 'Moteur IA: non sollicite (pipeline local).'

    provider = AI_PROVIDER_LAST.get()
    attempted = bool(AI_PROVIDER_ATTEMPTED.get())
    if provider == 'gemini':
        return 'Moteur IA: reponse Gemini utilisee.'
    if provider == 'ollama':
        return 'Moteur IA: reponse Ollama utilisee.'
    if not attempted:
        return 'Moteur IA: non sollicite pour ce flux (pipeline local optimise).'
    return 'Moteur IA: aucune reponse LLM exploitable (pipeline local applique).'


def _append_ai_provider_warning(warnings, use_ai=False):
    msg = _build_ai_provider_warning(use_ai=use_ai)
    if isinstance(warnings, list) and msg not in warnings:
        warnings.append(msg)
    return warnings


def _is_effectively_empty_cell(value):
    try:
        if pd.isna(value):
            return True
    except Exception:
        pass
    text = str(value or '').strip()
    if not text:
        return True
    return text.lower() in {'nan', 'none', 'null', 'n/a', 'na', '-', '--'}


def _build_import_ai_confidence(source_df, mapped_rows, expected_columns, mapping_mode='ai'):
    source_count = int(len(source_df.index)) if source_df is not None else 0
    mapped_rows = list(mapped_rows or [])
    mapped_count = len(mapped_rows)
    columns = [str(c) for c in (expected_columns or [])]

    row_alignment = 1.0 if source_count <= 0 else min(1.0, mapped_count / float(max(1, source_count)))

    total_cells = max(1, mapped_count * max(1, len(columns)))
    empty_cells = 0
    non_empty_columns = 0
    for col in columns:
        col_has_data = False
        for row in mapped_rows:
            value = row.get(col, '') if isinstance(row, dict) else ''
            if _is_effectively_empty_cell(value):
                empty_cells += 1
            else:
                col_has_data = True
        if col_has_data:
            non_empty_columns += 1

    non_empty_ratio = 1.0 - (empty_cells / float(total_cells))
    column_coverage = 1.0 if not columns else (non_empty_columns / float(len(columns)))

    score = (0.45 * row_alignment) + (0.35 * non_empty_ratio) + (0.20 * column_coverage)
    if mapping_mode in ('direct', 'schema_free'):
        score = min(1.0, score + 0.04)
    score = max(0.0, min(1.0, score))

    return {
        'score': round(score, 4),
        'mapping_mode': mapping_mode,
        'row_alignment': round(row_alignment, 4),
        'non_empty_ratio': round(non_empty_ratio, 4),
        'column_coverage': round(column_coverage, 4),
        'source_rows': source_count,
        'mapped_rows': mapped_count,
        'target_columns': len(columns),
    }


def _evaluate_import_ai_gate(confidence_report):
    threshold = _read_float_env('IMPORT_AI_CONFIDENCE_THRESHOLD', 0.62, min_value=0.0, max_value=1.0)
    block_on_low = _read_bool_env('IMPORT_AI_BLOCK_ON_LOW_CONFIDENCE', True)
    score = float((confidence_report or {}).get('score', 1.0))
    low_confidence = score < threshold
    return {
        'threshold': round(threshold, 4),
        'block_on_low_confidence': bool(block_on_low),
        'low_confidence': bool(low_confidence),
    }


def _ollama_generate_text(prompt, purpose='generic'):
    AI_PROVIDER_ATTEMPTED.set(True)
    if not _read_bool_env('OLLAMA_ENABLED', False):
        raise RuntimeError('Ollama desactive (OLLAMA_ENABLED=false)')

    ollama_base_url = os.getenv('OLLAMA_BASE_URL', 'http://127.0.0.1:11434').strip() or 'http://127.0.0.1:11434'
    default_model = os.getenv('OLLAMA_MODEL', 'qwen2.5:7b-instruct').strip() or 'qwen2.5:7b-instruct'
    if purpose == 'admin_assistant_rewrite':
        ollama_model = os.getenv('ASSISTANT_OLLAMA_MODEL', default_model).strip() or default_model
        ollama_timeout = _read_int_env('ASSISTANT_OLLAMA_TIMEOUT_SECONDS', 70, min_value=3, max_value=180)
        max_tokens = _read_int_env('ASSISTANT_OLLAMA_MAX_TOKENS', 220, min_value=80, max_value=800)
    else:
        ollama_model = default_model
        ollama_timeout = _read_int_env('OLLAMA_TIMEOUT_SECONDS', 45, min_value=5, max_value=300)
        max_tokens = _read_int_env('OLLAMA_MAX_TOKENS', 900, min_value=120, max_value=4000)

    payload = {
        'model': ollama_model,
        'prompt': str(prompt or ''),
        'stream': False,
        'options': {
            'temperature': 0.1,
            'num_predict': max_tokens,
        },
    }
    body = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        url=f"{ollama_base_url.rstrip('/')}/api/generate",
        data=body,
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=ollama_timeout) as response:
        raw = response.read().decode('utf-8', errors='replace')
    parsed = json.loads(raw)
    text = _clean_text(parsed.get('response', ''))
    if not text:
        raise RuntimeError('Reponse Ollama vide')
    _mark_ai_provider('ollama')
    logger.info('IA utilisee: Ollama (%s) pour %s', ollama_model, purpose)
    return text


def _gemini_generate_text(prompt, purpose='generic'):
    """Centralized AI call with Gemini first, then optional Ollama fallback."""
    AI_PROVIDER_ATTEMPTED.set(True)
    if not _read_bool_env('AI_FEATURES_ENABLED', True):
        raise RuntimeError('Fonctionnalites IA desactivees (AI_FEATURES_ENABLED=false)')
    max_prompt_chars = _read_int_env('GEMINI_MAX_PROMPT_CHARS', 120000, min_value=2000, max_value=300000)
    prompt_text = str(prompt or '')
    if len(prompt_text) > max_prompt_chars:
        raise RuntimeError(f'Prompt IA trop volumineux ({len(prompt_text)} > {max_prompt_chars})')

    gemini_error = None
    if _read_bool_env('GEMINI_ENABLED', True):
        api_key = os.getenv('GEMINI_API_KEY', '').strip()
        model_name = os.getenv('GEMINI_MODEL', 'gemini-1.5-flash').strip() or 'gemini-1.5-flash'

        if api_key:
            if purpose == 'admin_assistant_rewrite':
                timeout_seconds = _read_int_env('ASSISTANT_GEMINI_TIMEOUT_SECONDS', 10, min_value=4, max_value=120)
                max_retries = _read_int_env('ASSISTANT_GEMINI_MAX_RETRIES', 0, min_value=0, max_value=3)
                retry_backoff_seconds = _read_float_env('ASSISTANT_GEMINI_RETRY_BACKOFF_SECONDS', 0.2, min_value=0.0, max_value=5.0)
            else:
                timeout_seconds = _read_int_env('GEMINI_TIMEOUT_SECONDS', 20, min_value=5, max_value=180)
                max_retries = _read_int_env('GEMINI_MAX_RETRIES', 2, min_value=0, max_value=5)
                retry_backoff_seconds = _read_float_env('GEMINI_RETRY_BACKOFF_SECONDS', 0.75, min_value=0.0, max_value=10.0)

            try:
                genai = importlib.import_module('google.generativeai')
                genai.configure(api_key=api_key)
                model = genai.GenerativeModel(model_name)

                last_error = None
                for attempt in range(max_retries + 1):
                    try:
                        try:
                            response = model.generate_content(prompt_text, request_options={'timeout': timeout_seconds})
                        except TypeError:
                            # Backward compatibility with SDK variants lacking request_options.
                            response = model.generate_content(prompt_text)

                        text = _clean_text(getattr(response, 'text', '') or '')
                        if not text:
                            raise RuntimeError('Reponse IA vide')
                        _mark_ai_provider('gemini')
                        return text
                    except Exception as exc:
                        last_error = exc
                        if attempt < max_retries:
                            logger.warning(
                                'Echec appel Gemini (%s), tentative %s/%s: %s',
                                purpose,
                                attempt + 1,
                                max_retries + 1,
                                exc,
                            )
                            wait_seconds = retry_backoff_seconds * (attempt + 1)
                            if wait_seconds > 0:
                                time.sleep(wait_seconds)
                            continue
                        break

                gemini_error = RuntimeError(f'Echec appel Gemini ({purpose})')
                if last_error:
                    gemini_error.__cause__ = last_error
            except Exception as exc:
                gemini_error = exc
        else:
            gemini_error = RuntimeError('GEMINI_API_KEY manquante')
    else:
        gemini_error = RuntimeError('Gemini desactive (GEMINI_ENABLED=false)')

    ollama_error = None
    if _read_bool_env('OLLAMA_ENABLED', False):
        try:
            return _ollama_generate_text(prompt_text, purpose=purpose)
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError, RuntimeError) as exc:
            ollama_error = exc
            logger.warning('Echec fallback Ollama (%s): %s', purpose, exc)

    if gemini_error and ollama_error:
        raise RuntimeError(f'Echec IA Gemini + Ollama ({purpose})') from ollama_error
    if gemini_error:
        raise RuntimeError(f'Echec appel Gemini ({purpose})') from gemini_error
    if ollama_error:
        raise RuntimeError(f'Echec appel Ollama ({purpose})') from ollama_error
    raise RuntimeError(f'Aucun moteur IA disponible ({purpose})')


def _build_mapping_heuristic_hints(df):
    """Build lightweight semantic hints from source dataframe for AI mapping prompts."""
    province_tokens = {
        'azilal', 'beni mellal', 'beni_mellal', 'khenifra', 'khouribga', 'fquih ben salah', 'fquih_ben_salah',
        'azilal', 'khouribga', 'khenifra'
    }
    hints = []
    for col in [str(c) for c in df.columns]:
        values = [_cell_to_text(v) for v in df[col].tolist() if _cell_to_text(v)]
        sample = values[:80]
        if not sample:
            continue

        numeric_count = sum(1 for v in sample if _parse_number(v) is not None)
        numeric_ratio = numeric_count / float(max(1, len(sample)))
        year_like = sum(1 for v in sample if re.fullmatch(r'(19|20)\d{2}', str(v).strip()))
        year_ratio = year_like / float(max(1, len(sample)))

        lowered = [str(v).strip().lower().replace('-', ' ').replace('_', ' ') for v in sample]
        province_hits = sum(1 for v in lowered if v in province_tokens)
        province_ratio = province_hits / float(max(1, len(lowered)))

        semantic = None
        if year_ratio >= 0.7:
            semantic = 'year'
        elif numeric_ratio >= 0.8:
            semantic = 'value'
        elif province_ratio >= 0.2:
            semantic = 'province'

        if semantic:
            hints.append({
                'column': col,
                'semantic_hint': semantic,
                'year_ratio': round(year_ratio, 3),
                'numeric_ratio': round(numeric_ratio, 3),
                'province_ratio': round(province_ratio, 3),
                'sample_values': sample[:8],
            })

    return hints


def _run_gemini_mapping(df, expected_columns):
    """Ask the configured LLM stack to map heterogeneous columns to expected schema."""
    # Optional HF login compatibility for workflows that depend on HF auth.
    hf_token = os.getenv('HF_TOKEN', '').strip()
    if hf_token:
        try:
            hf_login = getattr(importlib.import_module('huggingface_hub'), 'login')
            hf_login(token=hf_token, add_to_git_credential=False)
        except Exception:
            # Non-bloquant pour le flux Gemini
            pass

    sample_records = df.head(40).to_dict(orient='records')
    semantic_hints = _build_mapping_heuristic_hints(df)
    prompt = (
        'Tu es un assistant de normalisation de tableaux statistiques. '\
        'Transforme les lignes source vers le schema cible. '\
        'Reponds STRICTEMENT en JSON valide, sans texte additionnel.\n\n'
        f'Colonnes cibles (ordre obligatoire): {expected_columns}\n'
        f'Colonnes source: {[str(c) for c in df.columns]}\n'
        f'Indices heuristiques (prioritaires): {json.dumps(semantic_hints, ensure_ascii=False)}\n'
        f'Lignes source echantillon: {json.dumps(sample_records, ensure_ascii=False)}\n\n'
        'Format de sortie attendu:\n'
        '{"rows": [ {"COL1": "...", "COL2": "..."} ] }\n'
        'Regles:\n'
        '- Chaque objet de rows contient toutes les colonnes cibles.\n'
        '- Si une valeur est absente, mettre chaine vide.\n'
        '- Respecter les indices heuristiques, surtout year/value/province quand ils sont presents.\n'
        '- Conserver le sens statistique le plus probable.\n'
        '- Ne pas inventer de colonnes hors schema cible.'
    )

    response_text = _gemini_generate_text(prompt, purpose='column_mapping')
    parsed = _extract_json_object(response_text)
    if not parsed or not isinstance(parsed, dict) or not isinstance(parsed.get('rows'), list):
        raise RuntimeError('Reponse IA non exploitable')

    sanitized = []
    for item in parsed['rows']:
        item = item if isinstance(item, dict) else {}
        sanitized.append({col: item.get(col, '') for col in expected_columns})

    province_order = _extract_province_order_from_df(df)
    return _apply_province_order_to_rows(sanitized, province_order)


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
    text = _cell_to_text(value)
    if not text:
        return None

    # Normalize Arabic/Persian digits and common locale separators.
    text = text.translate(ARABIC_DIGITS_TRANSLATION)
    text = (
        text
        .replace('\u00A0', ' ')   # NBSP
        .replace('\u202F', ' ')   # NNBSP
        .replace('\u2009', ' ')   # thin space
        .replace('\u066C', '')    # Arabic thousands separator
        .replace('\u066B', '.')   # Arabic decimal separator
    )
    text = text.replace(' ', '').replace(',', '.')
    if not text:
        return None
    try:
        return float(text)
    except Exception:
        return None


def _extract_year_from_df(df):
    period_pattern = re.compile(r'((?:19|20)\d{2})\s*[-/]\s*((?:19|20)\d{2})')
    year_pattern = re.compile(r'(?:19|20)\d{2}')
    for _, row in df.head(8).iterrows():
        for val in row.tolist():
            txt = _cell_to_text(val)
            period_match = period_pattern.search(txt)
            if period_match:
                return f"{period_match.group(1)}-{period_match.group(2)}"
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
    is_period_value = bool(re.fullmatch(r'(19|20)\d{2}-(19|20)\d{2}', str(year_value or '').strip()))
    time_col_name = 'Periode' if is_period_value else 'Annee'

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

    def _is_year_period_label(label):
        token = _cell_to_text(label)
        if not token:
            return False
        token = re.sub(r'\s+', '', token)
        # Excel can provide numeric headers as float strings (e.g. "2016.0").
        token = re.sub(r'\.(0+)$', '', token)
        # Accept common year-period headers such as 2016, 2016-2017, 2016/2017.
        return bool(re.fullmatch(r'(19|20)\d{2}([\-/](19|20)\d{2})?', token))

    def _normalize_year_period_label(label):
        token = _cell_to_text(label)
        if not token:
            return ''
        token = re.sub(r'\s+', '', token)
        token = re.sub(r'\.(0+)$', '', token)
        # Normalize separators for consistency (2016/2017 -> 2016-2017).
        token = token.replace('/', '-')
        return token if _is_year_period_label(token) else _cell_to_text(label)

    def _is_header_like_id_token(value):
        norm = _normalize_name(value)
        return norm in {
            'milieu', 'niveau', 'niveau_etude', 'annee', 'année', 'year', 'periode', 'période',
            'period', 'valeur', 'value', 'sexe', 'sex', 'province', 'region', 'région', 'dimension'
        }

    # Detect first data row: enough numeric values across metric columns.
    row_start = None
    for ridx in range(len(work)):
        metric_texts = [_cell_to_text(work.iat[ridx, c]) for c in metric_cols]
        nums = [_parse_number(v) for v in metric_texts]
        numeric_count = sum(1 for n in nums if n is not None)
        if numeric_count < max(2, int(len(metric_cols) * 0.5)):
            continue

        # Skip header rows where metric cells are years (e.g. 2016, 2017, 2018, 2019).
        year_like_metric_count = sum(1 for txt in metric_texts if _is_year_period_label(txt))
        if year_like_metric_count >= max(2, int(len(metric_cols) * 0.6)):
            continue

        id_values = [_cell_to_text(work.iat[ridx, c]) for c in id_cols]
        id_non_empty = [v for v in id_values if v]
        if not id_non_empty:
            continue

        # Skip structural/header rows like "Milieu" that are not actual modalities.
        if all(_is_header_like_id_token(v) for v in id_non_empty):
            continue

        row_start = ridx
        break

    # Conservative fallback for uncommon structures.
    if row_start is None:
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

    metric_labels = [metric_names.get(c, '') for c in metric_cols]
    year_period_metric_count = sum(1 for lbl in metric_labels if _is_year_period_label(lbl))

    # Detect top-level metric dimension label (e.g. "Milieu" over Total/Rural/Urbain).
    metric_dimension_name = 'Niveau_Etude'
    metrics_are_period_axis = bool(metric_cols) and year_period_metric_count >= max(1, int(len(metric_cols) * 0.7))
    if metrics_are_period_axis:
        # Period headers should map directly to Annee, not to a synthetic metric dimension.
        metric_dimension_name = time_col_name
        year_value = ''
    else:
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
    # First ID column: prefer explicit header label (e.g. "Groupes d'ages").
    id_name_1 = 'Dimension'
    first_id_col = id_cols[0]
    first_id_header = ''
    for ridx in [header_row, header_row - 1, header_row - 2, header_row - 3]:
        if ridx < 0:
            continue
        candidate = _cell_to_text(work.iat[ridx, first_id_col])
        if candidate:
            first_id_header = candidate
            break

    header_used_for_id1 = False
    if first_id_header:
        header_semantic = _semantic_key_from_label(first_id_header)
        year_like_header = bool(re.search(r'(19|20)\d{2}', first_id_header)) or header_semantic == 'year'
        if not year_like_header:
            if header_semantic:
                id_name_1 = _semantic_label_for_key(header_semantic, 'fr')
            else:
                id_name_1 = re.sub(r'\s+', '_', first_id_header.strip())
            header_used_for_id1 = True

    if not header_used_for_id1:
        first_col_values = [
            _cell_to_text(v).strip()
            for v in work.iloc[row_start:, first_id_col].tolist()
            if _cell_to_text(v).strip()
        ]
        inferred_key, inferred_score = _infer_dimension_key_from_modalities(first_col_values)
        if inferred_key and inferred_score >= 2:
            id_name_1 = _semantic_label_for_key(inferred_key, 'fr')

    id_name_1 = re.sub(r'\s+', '_', str(id_name_1 or '').strip()).strip('_') or 'Dimension'
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
            id_name_2 = time_col_name
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

            metric_label = metric_names.get(c, f'Mesure_{c}')
            if metric_dimension_name == time_col_name:
                rec = {
                    id_name_1: current_ids.get(id_cols[0], ''),
                    time_col_name: _normalize_year_period_label(metric_label),
                    'Valeur': n,
                }
            else:
                rec = {
                    id_name_1: current_ids.get(id_cols[0], ''),
                    time_col_name: current_ids.get(second_id_col, '') if (second_id_col is not None and id_name_2 == time_col_name) else year_value,
                    metric_dimension_name: metric_label,
                    'Valeur': n,
                }
            if second_id_col is not None and id_name_2 != time_col_name:
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
        year_like_values = _is_year_like_values(sample_values)
        is_year = year_like_values
        semantic_key = None

        if is_value:
            semantic_key = 'value'
        elif is_year:
            semantic_key = 'year'
        elif header_key == 'year' and modality_key and modality_score >= 2:
            # Header can contain a global year label (e.g. "Annee 2020") while
            # column values are actually provinces/modalities.
            semantic_key = modality_key
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

    # Keep original identifier names when semantics are uncertain.
    # Forcing a default like "province" causes wrong renames (e.g. age groups).

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
    if _read_bool_env('IMPORT_AI_HEADER_RENAME_ENABLED', False):
        work = _refine_ai_headers(work, lang=lang)
    return work


def _fallback_header_rename(df):
    """Conservative deterministic rename for ambiguous dimension headers."""
    if df is None or df.empty:
        return df

    work = df.copy()
    value_col = _pick_value_column(work)
    renamed = []
    for col in [str(c or '').strip() for c in work.columns]:
        target = col
        norm = _normalize_column_name(col)
        if norm in ('niveauetude', 'dimension', 'dimensiondim') and col != value_col:
            values = [_cell_to_text(v) for v in work[col].tolist() if _cell_to_text(v)]
            distinct = len(set(values))
            if distinct >= 2:
                target = 'Indicateur'
        renamed.append(target)

    work.columns = _make_unique_columns([re.sub(r'\s+', '_', str(c or '').strip()) or 'col' for c in renamed])
    return work


def _refine_ai_headers(df, lang='fr'):
    """Ask the AI to suggest better header names after flattening, with strict safeguards."""
    if df is None or df.empty:
        return df

    work = df.copy().fillna('')
    columns = [str(c or '').strip() for c in work.columns]
    if len(columns) < 2:
        return work

    profiles = _build_ai_column_profiles(work)
    compact_profiles = []
    for p in profiles:
        compact_profiles.append({
            'name': p.get('name'),
            'semantic_key': p.get('semantic_key'),
            'is_value': bool(p.get('is_value')),
            'is_year': bool(p.get('is_year')),
            'sample_values': list(p.get('sample_values') or [])[:5],
        })

    sample_rows = work.head(12).to_dict(orient='records')
    min_conf = _read_float_env('IMPORT_AI_HEADER_RENAME_MIN_CONFIDENCE', 0.6, min_value=0.0, max_value=1.0)

    # Fast mode by default: keep deterministic rename unless explicitly enabling LLM header rename.
    if not _read_bool_env('IMPORT_AI_HEADER_RENAME_USE_LLM', False):
        return _fallback_header_rename(work)

    prompt = (
        'Tu renommes des colonnes d\'un tableau statistique deja aplati. '
        'Objectif: proposer des noms metier clairs, stables et concis. '
        'Reponds STRICTEMENT en JSON valide sans texte additionnel.\n\n'
        f'Langue cible: {lang}\n'
        f'Colonnes actuelles (ordre obligatoire): {json.dumps(columns, ensure_ascii=False)}\n'
        f'Profils de colonnes: {json.dumps(compact_profiles, ensure_ascii=False)}\n'
        f'Echantillon de lignes: {json.dumps(sample_rows, ensure_ascii=False)}\n\n'
        'Contraintes strictes:\n'
        '- Garder exactement le meme nombre de colonnes.\n'
        '- Ne jamais supprimer une colonne.\n'
        '- Ne jamais echanger l\'ordre logique des colonnes.\n'
        '- Preferer: Province/Region, Campagne ou Annee, Indicateur/Dimension, Valeur.\n'
        '- Si incertain, garder le nom original.\n\n'
        'Format de sortie exact:\n'
        '{"rename_map": {"AncienNom": "NouveauNom"}, "confidence": {"AncienNom": 0.0}}\n'
        '- confidence entre 0 et 1 pour chaque colonne modifiee.'
    )

    try:
        engine = (os.getenv('IMPORT_AI_HEADER_RENAME_ENGINE', 'auto').strip().lower() or 'auto')
        if engine == 'ollama':
            try:
                response_text = _ollama_generate_text(prompt, purpose='column_header_rename')
            except Exception:
                if _read_bool_env('IMPORT_AI_HEADER_RENAME_ALLOW_GEMINI_FALLBACK', True):
                    response_text = _gemini_generate_text(prompt, purpose='column_header_rename')
                else:
                    raise
        elif engine == 'gemini':
            response_text = _gemini_generate_text(prompt, purpose='column_header_rename')
        else:
            # auto: keep current chain (Gemini first, Ollama fallback)
            response_text = _gemini_generate_text(prompt, purpose='column_header_rename')
        parsed = _extract_json_object(response_text)
        if not isinstance(parsed, dict):
            return _fallback_header_rename(work)

        rename_map = parsed.get('rename_map') if isinstance(parsed.get('rename_map'), dict) else {}
        conf_map = parsed.get('confidence') if isinstance(parsed.get('confidence'), dict) else {}

        applied = []
        for old in columns:
            candidate = rename_map.get(old, old)
            candidate = re.sub(r'\s+', '_', str(candidate or '').strip()).strip('_') or old

            try:
                conf = float(conf_map.get(old, 1.0 if candidate == old else 0.0))
            except Exception:
                conf = 0.0

            # Never rename value columns with low confidence.
            profile = next((p for p in profiles if str(p.get('name')) == old), None)
            is_value = bool(profile.get('is_value')) if profile else False
            if candidate != old and conf < min_conf:
                candidate = old
            if is_value and _normalize_column_name(candidate) not in ('valeur', 'value') and conf < 0.9:
                candidate = old
            applied.append(candidate)

        work.columns = _make_unique_columns(applied)
        return work
    except Exception:
        return _fallback_header_rename(work)


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

    # Common sheet pattern: one id column header contains a global year label
    # (e.g. "Annee 2020") while cells contain provinces/modalities.
    year_col_name = _semantic_label_for_key('year', lang)
    global_year_value = ''
    for id_col in id_cols:
        id_values = [_cell_to_text(v) for v in work[id_col].tolist() if _cell_to_text(v)]
        if not id_values:
            continue

        id_col_label = str(id_col or '')
        normalized_header = _normalize_semantic_token(id_col_label)
        label_without_year = re.sub(r'(19|20)\d{2}(?:\s*[-/]\s*(19|20)\d{2})?', ' ', id_col_label)
        has_year_token = bool(re.search(r'(19|20)\d{2}(?:\s*[-/]\s*(19|20)\d{2})?', id_col_label))
        has_year_keyword = bool(re.search(r'(annee|annees|année|années|year|years|periode|période|period|سنة|السنة|سنوات|الفترة|التاريخ)', normalized_header))
        header_semantic = _semantic_key_from_label(id_col)
        header_semantic_without_year = _semantic_key_from_label(label_without_year)
        looks_like_year_header = (
            header_semantic == 'year'
            or header_semantic_without_year == 'year'
            or (has_year_token and has_year_keyword)
        )

        # Only treat as global-year header when values are clearly not years.
        if not looks_like_year_header or _is_year_like_values(id_values):
            continue

        match = re.search(r'(19|20)\d{2}(?:\s*[-/]\s*(19|20)\d{2})?', id_col_label)
        if not match:
            continue

        global_year_value = re.sub(r'\s+', '', match.group(0)).replace('/', '-')
        break

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
        candidate_prefix_norm = max(prefix_counts.items(), key=lambda kv: kv[1])[0]
        if prefix_counts[candidate_prefix_norm] >= 2:
            selected_prefix_norm = candidate_prefix_norm
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
            if global_year_value and year_col_name not in rec:
                rec[year_col_name] = global_year_value
            rec[dim_name] = modality
            rec[_semantic_label_for_key('value', lang)] = int(num) if float(num).is_integer() else num
            records.append(rec)

    if not records:
        return None

    long_df = pd.DataFrame(records)
    ordered_cols = list(id_cols)
    if global_year_value and year_col_name in long_df.columns and year_col_name not in ordered_cols:
        insert_at = 1 if ordered_cols else 0
        ordered_cols.insert(insert_at, year_col_name)
    ordered_cols.extend([dim_name, _semantic_label_for_key('value', lang)])
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
    df = _apply_province_order_to_dataframe(df)
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

    explicit = {
        'valeur', 'value', 'values', 'montant', 'effectif', 'nombre', 'taux', 'ratio', 'measure',
        'القيمة', 'قيمة', 'القيم', 'المؤشر', 'النسبة', 'العدد'
    }
    for c in cols:
        norm = _normalize_column_name(c)
        sem = _semantic_key_from_label(c)
        if norm in explicit or sem == 'value':
            return c

    def _is_year_like_series(series):
        values = [_cell_to_text(v) for v in series.tolist() if _cell_to_text(v)]
        if len(values) < 2:
            return False
        year_like_count = sum(1 for v in values if re.fullmatch(r'(19|20)\d{2}', str(v).strip()))
        return (year_like_count / float(len(values))) >= 0.8

    best_col = None
    best_ratio = -1.0
    for c in cols:
        if _semantic_key_from_label(c) == 'year' or _is_year_like_series(df[c]):
            # Never treat year columns as value columns, even if numeric.
            continue
        values = [_cell_to_text(v) for v in df[c].tolist() if _cell_to_text(v)]
        if not values:
            continue
        numeric_count = sum(1 for v in values if _parse_number(v) is not None)
        ratio = numeric_count / float(len(values))
        if ratio > best_ratio:
            best_ratio = ratio
            best_col = c

    return best_col


def _select_best_matching_value_column(df_target, ref_numbers, preferred_col=None):
    """Pick target value column that best matches reference numeric distribution."""
    cols = [str(c) for c in df_target.columns]
    if not cols:
        return preferred_col

    ref_list = [round(float(v), 9) for v in (ref_numbers or []) if v is not None]
    if not ref_list:
        return preferred_col or _pick_value_column(df_target)
    ref_counter = Counter(ref_list)
    ref_len = len(ref_list)

    candidates = []
    if preferred_col in cols:
        candidates.append(preferred_col)
    for c in cols:
        if c not in candidates:
            candidates.append(c)

    best_col = preferred_col if preferred_col in cols else None
    best_score = -1.0

    for col in candidates:
        parsed = [_parse_number(v) for v in df_target[col].tolist()]
        nums = [round(float(v), 9) for v in parsed if v is not None]
        if not nums:
            continue

        target_counter = Counter(nums)
        overlap = sum((ref_counter & target_counter).values())
        denom = float(max(ref_len, len(nums)))
        score = overlap / denom if denom > 0 else 0.0

        # Small semantic preference when scores are tied.
        if _semantic_key_from_label(col) == 'value':
            score += 1e-6

        if score > best_score:
            best_score = score
            best_col = col

    return best_col or preferred_col or _pick_value_column(df_target)


def _promote_embedded_year_header_column(df_source, lang='fr'):
    """Recover explicit year column when year is embedded in an identifier header (e.g. 'Annee 2014', 'سنة 2014')."""
    if df_source is None or df_source.empty:
        return df_source, False

    work = df_source.copy()
    cols = [str(c) for c in work.columns]
    year_col_name = _semantic_label_for_key('year', lang)
    if year_col_name in cols:
        return work, False

    for idx, col in enumerate(cols):
        label = str(col or '')
        normalized_header = _normalize_semantic_token(label)
        has_year_token = bool(re.search(r'(19|20)\d{2}(?:\s*[-/]\s*(19|20)\d{2})?', label))
        has_year_keyword = bool(re.search(r'(annee|annees|année|années|year|years|periode|période|period|سنة|السنة|سنوات|الفترة|التاريخ)', normalized_header))
        looks_like_year_header = _semantic_key_from_label(label) == 'year' or (has_year_token and has_year_keyword)
        if not looks_like_year_header:
            continue

        values = [_cell_to_text(v) for v in work[col].tolist() if _cell_to_text(v)]
        if not values or _is_year_like_values(values):
            continue

        match = re.search(r'(19|20)\d{2}(?:\s*[-/]\s*(19|20)\d{2})?', label)
        if not match:
            continue
        year_value = re.sub(r'\s+', '', match.group(0)).replace('/', '-')

        insert_at = min(idx + 1, len(cols))
        work.insert(insert_at, year_col_name, year_value)
        return work, True

    return work, False


def _build_semantic_column_alignment(reference_columns, source_columns, reference_value_idx=None, source_value_idx=None):
    """Align source columns to reference columns using value/label semantics before positional fallback."""
    ref_cols = [str(c) for c in (reference_columns or [])]
    src_cols = [str(c) for c in (source_columns or [])]
    mapping = [-1 for _ in ref_cols]
    used_src = set()

    def _is_valid_src(idx):
        return isinstance(idx, int) and 0 <= idx < len(src_cols)

    # 1) Pin value columns first when available.
    if (
        isinstance(reference_value_idx, int)
        and 0 <= reference_value_idx < len(ref_cols)
        and _is_valid_src(source_value_idx)
    ):
        mapping[reference_value_idx] = source_value_idx
        used_src.add(source_value_idx)

    # 2) Exact normalized header match.
    src_by_norm = defaultdict(list)
    for sidx, scol in enumerate(src_cols):
        src_by_norm[_normalize_column_name(scol)].append(sidx)

    for ridx, rcol in enumerate(ref_cols):
        if mapping[ridx] != -1:
            continue
        key = _normalize_column_name(rcol)
        for candidate in src_by_norm.get(key, []):
            if candidate in used_src:
                continue
            mapping[ridx] = candidate
            used_src.add(candidate)
            break

    # 3) Semantic key match when unique enough.
    src_by_semantic = defaultdict(list)
    for sidx, scol in enumerate(src_cols):
        sem = _semantic_key_from_label(scol)
        if sem:
            src_by_semantic[sem].append(sidx)

    for ridx, rcol in enumerate(ref_cols):
        if mapping[ridx] != -1:
            continue
        sem = _semantic_key_from_label(rcol)
        if not sem:
            continue
        candidates = [sidx for sidx in src_by_semantic.get(sem, []) if sidx not in used_src]
        if not candidates:
            continue

        # Prefer a candidate with same normalized header when possible.
        ref_norm = _normalize_column_name(rcol)
        chosen = None
        for candidate in candidates:
            if _normalize_column_name(src_cols[candidate]) == ref_norm:
                chosen = candidate
                break
        if chosen is None:
            chosen = candidates[0]

        mapping[ridx] = chosen
        used_src.add(chosen)

    # 4) Stable positional fallback then first remaining free source column.
    for ridx in range(len(ref_cols)):
        if mapping[ridx] != -1:
            continue
        if ridx < len(src_cols) and ridx not in used_src:
            mapping[ridx] = ridx
            used_src.add(ridx)
            continue
        for sidx in range(len(src_cols)):
            if sidx in used_src:
                continue
            mapping[ridx] = sidx
            used_src.add(sidx)
            break

    return mapping


def _build_bilingual_payload(df_fr, df_ar, df_en=None, source_cols_ar=None, source_cols_en=None):
    """
    Build canonical bilingual dataset from two aligned FR/AR analytical tables.
    Returns: payload, validation_report
    """
    cols_fr = [str(c) for c in df_fr.columns]
    cols_ar_aligned = [str(c) for c in df_ar.columns]
    cols_en_aligned = [str(c) for c in df_en.columns] if df_en is not None else []

    # Keep original uploaded headers for labels when available.
    cols_ar_labels = [str(c) for c in (source_cols_ar or cols_ar_aligned)]
    cols_en_labels = [str(c) for c in (source_cols_en or cols_en_aligned)] if df_en is not None else []

    report = {
        'rows_fr': int(len(df_fr)),
        'rows_ar': int(len(df_ar)),
        'rows_en': int(len(df_en)) if df_en is not None else 0,
        'cols_fr': int(len(cols_fr)),
        'cols_ar': int(len(cols_ar_aligned)),
        'cols_en': int(len(cols_en_aligned)) if cols_en_aligned else 0,
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

    if len(cols_fr) != len(cols_ar_aligned):
        df_ar_recovered, recovered_ar = _promote_embedded_year_header_column(df_ar, lang=_detect_dataframe_language(df_ar))
        if recovered_ar:
            df_ar = df_ar_recovered
            cols_ar_aligned = [str(c) for c in df_ar.columns]
            cols_ar_labels = cols_ar_aligned
            report['cols_ar'] = int(len(cols_ar_aligned))

    if len(cols_fr) != len(cols_ar_aligned):
        report['errors'].append('Le nombre de colonnes FR/AR est different.')
        return None, report

    if df_en is not None:
        if len(df_fr) != len(df_en):
            report['errors'].append('Le nombre de lignes FR/EN est different.')
            return None, report
        if len(cols_fr) != len(cols_en_aligned):
            df_en_recovered, recovered_en = _promote_embedded_year_header_column(df_en, lang='en')
            if recovered_en:
                df_en = df_en_recovered
                cols_en_aligned = [str(c) for c in df_en.columns]
                cols_en_labels = cols_en_aligned
                report['cols_en'] = int(len(cols_en_aligned))
        if len(cols_fr) != len(cols_en_aligned):
            report['errors'].append('Le nombre de colonnes FR/EN est different.')
            return None, report

    value_col_fr = _pick_value_column(df_fr)
    if not value_col_fr:
        report['errors'].append('Impossible de detecter la colonne de valeur dans le fichier FR.')
        return None, report

    value_col_idx = cols_fr.index(value_col_fr)
    value_col_ar = _pick_value_column(df_ar)
    fr_numbers_ref = [
        _parse_number(df_fr.iloc[ridx, value_col_idx])
        for ridx in range(len(df_fr))
    ]
    fallback_ar_col = cols_ar_aligned[value_col_idx] if value_col_idx < len(cols_ar_aligned) else None
    value_col_ar = _select_best_matching_value_column(
        df_ar,
        fr_numbers_ref,
        preferred_col=value_col_ar or fallback_ar_col,
    )
    if not value_col_ar:
        report['errors'].append('Impossible de detecter la colonne de valeur dans le fichier AR.')
        return None, report
    value_col_idx_ar = cols_ar_aligned.index(value_col_ar)

    mismatches = []
    for ridx in range(len(df_fr)):
        fr_num = _parse_number(df_fr.iloc[ridx, value_col_idx])
        ar_num = _parse_number(df_ar.iloc[ridx, value_col_idx_ar])
        if fr_num is None and ar_num is None:
            continue
        if fr_num is None or ar_num is None:
            mismatches.append({'row': ridx + 1, 'fr': df_fr.iloc[ridx, value_col_idx], 'ar': df_ar.iloc[ridx, value_col_idx_ar]})
            continue
        if abs(float(fr_num) - float(ar_num)) > 1e-9:
            mismatches.append({'row': ridx + 1, 'fr': fr_num, 'ar': ar_num})

    report['value_mismatches'] = len(mismatches)
    if mismatches:
        fr_numbers = []
        ar_numbers = []
        for ridx in range(len(df_fr)):
            fr_num = _parse_number(df_fr.iloc[ridx, value_col_idx])
            ar_num = _parse_number(df_ar.iloc[ridx, value_col_idx_ar])
            if fr_num is not None:
                fr_numbers.append(round(float(fr_num), 9))
            if ar_num is not None:
                ar_numbers.append(round(float(ar_num), 9))

        # AI normalization can reorder rows while keeping equivalent numeric content.
        # Accept this case when FR/AR multisets are strictly identical.
        if len(fr_numbers) == len(ar_numbers) and Counter(fr_numbers) == Counter(ar_numbers):
            report['value_mismatch_samples'] = mismatches[:20]
            report['value_alignment_mode'] = 'multiset'
        else:
            report['errors'].append('Les valeurs numeriques FR/AR ne correspondent pas.')
            report['mismatch_samples'] = mismatches[:20]
            return None, report

    if df_en is not None:
        value_col_en = _pick_value_column(df_en)
        fallback_en_col = cols_en_aligned[value_col_idx] if value_col_idx < len(cols_en_aligned) else None
        value_col_en = _select_best_matching_value_column(
            df_en,
            fr_numbers_ref,
            preferred_col=value_col_en or fallback_en_col,
        )
        if not value_col_en:
            report['errors'].append('Impossible de detecter la colonne de valeur dans le fichier EN.')
            return None, report
        value_col_idx_en = cols_en_aligned.index(value_col_en)
        mismatches_en = []
        for ridx in range(len(df_fr)):
            fr_num = _parse_number(df_fr.iloc[ridx, value_col_idx])
            en_num = _parse_number(df_en.iloc[ridx, value_col_idx_en])
            if fr_num is None and en_num is None:
                continue
            if fr_num is None or en_num is None:
                mismatches_en.append({'row': ridx + 1, 'fr': df_fr.iloc[ridx, value_col_idx], 'en': df_en.iloc[ridx, value_col_idx_en]})
                continue
            if abs(float(fr_num) - float(en_num)) > 1e-9:
                mismatches_en.append({'row': ridx + 1, 'fr': fr_num, 'en': en_num})
        if mismatches_en:
            fr_numbers = []
            en_numbers = []
            for ridx in range(len(df_fr)):
                fr_num = _parse_number(df_fr.iloc[ridx, value_col_idx])
                en_num = _parse_number(df_en.iloc[ridx, value_col_idx_en])
                if fr_num is not None:
                    fr_numbers.append(round(float(fr_num), 9))
                if en_num is not None:
                    en_numbers.append(round(float(en_num), 9))

            if len(fr_numbers) == len(en_numbers) and Counter(fr_numbers) == Counter(en_numbers):
                report['value_mismatch_samples_en'] = mismatches_en[:20]
                report['value_alignment_mode_en'] = 'multiset'
            else:
                report['errors'].append('Les valeurs numeriques FR/EN ne correspondent pas.')
                report['mismatch_samples_en'] = mismatches_en[:20]
                return None, report

    col_map_ar = _build_semantic_column_alignment(
        cols_fr,
        cols_ar_aligned,
        reference_value_idx=value_col_idx,
        source_value_idx=value_col_idx_ar,
    )
    col_map_en = []
    if df_en is not None:
        col_map_en = _build_semantic_column_alignment(
            cols_fr,
            cols_en_aligned,
            reference_value_idx=value_col_idx,
            source_value_idx=value_col_idx_en,
        )

    canonical_columns = []
    column_labels = {}
    used_cols = set()
    for idx, fr_col in enumerate(cols_fr):
        ar_idx = col_map_ar[idx] if idx < len(col_map_ar) else idx
        en_idx = col_map_en[idx] if (col_map_en and idx < len(col_map_en)) else idx
        ar_col = cols_ar_labels[ar_idx] if 0 <= ar_idx < len(cols_ar_labels) else fr_col
        en_col = cols_en_labels[en_idx] if cols_en_labels and 0 <= en_idx < len(cols_en_labels) else fr_col
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
    rows_by_language = {
        'fr': [],
        'ar': [],
        'en': [],
    }

    for ridx in range(len(df_fr)):
        row_obj = {}
        row_fr = {}
        row_ar = {}
        row_en = {}
        for cidx, col_code in enumerate(canonical_columns):
            fr_val = df_fr.iloc[ridx, cidx]
            ar_idx = col_map_ar[cidx] if cidx < len(col_map_ar) else cidx
            en_idx = col_map_en[cidx] if (col_map_en and cidx < len(col_map_en)) else cidx
            ar_val = df_ar.iloc[ridx, ar_idx] if 0 <= ar_idx < len(cols_ar_aligned) else ''
            en_val = df_en.iloc[ridx, en_idx] if (df_en is not None and 0 <= en_idx < len(cols_en_aligned)) else ''

            if cidx == value_col_idx:
                parsed = _parse_number(fr_val)
                value_out = parsed if parsed is not None else fr_val
                row_obj[col_code] = value_out
                row_fr[col_code] = value_out
                row_ar[col_code] = value_out
                row_en[col_code] = value_out
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
                'ar': ar_txt,
                'en': en_txt,
            }
            row_obj[col_code] = val_code
            row_fr[col_code] = fr_txt
            row_ar[col_code] = ar_txt
            row_en[col_code] = en_txt

        rows.append(row_obj)
        rows_by_language['fr'].append(row_fr)
        rows_by_language['ar'].append(row_ar)
        rows_by_language['en'].append(row_en)

    if df_en is None:
        rows_by_language.pop('en', None)

    report['matched'] = True

    payload = {
        'version': 1,
        'canonical_columns': canonical_columns,
        'value_column': value_col_code,
        'column_labels': column_labels,
        'value_labels': value_labels,
        'rows': rows,
        'rows_by_language': rows_by_language,
        'source_columns': {
            'fr': cols_fr,
            'ar': cols_ar_labels,
            'en': cols_en_labels,
        },
        'build_info': {
            'row_count': len(rows),
            'value_column_fr': value_col_fr,
            'value_column_ar': value_col_ar,
            'value_column_en': value_col_en if cols_en_aligned else value_col_fr,
            'column_map_ar': col_map_ar,
            'column_map_en': col_map_en,
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


def _align_df_rows_to_columns(df_source, target_columns):
    """Align rows to target columns by column index (used for i18n preview rows)."""
    cols = [str(c) for c in list(df_source.columns)]
    out = []
    for _, row in df_source.iterrows():
        obj = {}
        for idx, target in enumerate(target_columns):
            source_col = cols[idx] if idx < len(cols) else None
            obj[str(target)] = row.get(source_col, '') if source_col is not None else ''
        out.append(obj)
    return out


def _align_df_columns_to_target(df_source, target_columns):
    """Return a DataFrame aligned to target columns by positional index."""
    rows = _align_df_rows_to_columns(df_source, target_columns)
    return pd.DataFrame(rows, columns=[str(c) for c in target_columns])


def _maybe_build_bilingual_payload(df_fr, file_ar, file_en=None, use_ai=True):
    if not file_ar:
        return None, None, [], []

    try:
        file_ar.seek(0)
    except Exception:
        pass

    df_ar, warnings_ar = _normalize_import_dataframe(file_ar, use_ai=use_ai)
    source_cols_ar = [str(c) for c in df_ar.columns]
    warnings_en = []
    df_en = None
    source_cols_en = []
    if file_en:
        try:
            file_en.seek(0)
        except Exception:
            pass
        df_en, warnings_en = _normalize_import_dataframe(file_en, use_ai=use_ai)
        source_cols_en = [str(c) for c in df_en.columns]

    payload, report = _build_bilingual_payload(
        df_fr,
        df_ar,
        df_en=df_en,
        source_cols_ar=source_cols_ar,
        source_cols_en=source_cols_en,
    )
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
            _reset_ai_provider_marker()
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
                mapping_mode = 'schema_free'
                warnings.append('Mode schema libre: colonnes du fichier adoptees')
                if overlap > 0:
                    warnings.append(f'Recouvrement schema precedent: {round(overlap * 100)}%')
            else:
                if not expected_columns:
                    expected_columns = [str(c) for c in df.columns]
                    mapped_rows = df.to_dict(orient='records')
                    mapped_df = df.copy()
                    mapping_mode = 'direct'
                    warnings.append('Schema cible vide: import classique applique')
                else:
                    try:
                        mapped_rows = _run_gemini_mapping(df, expected_columns)
                        mapping_mode = 'ai'
                        warnings.append('Mapping IA applique')
                    except Exception as ai_err:
                        logger.warning('Fallback mapping active: %s', ai_err)
                        mapped_rows = _fallback_map_rows(df, expected_columns)
                        mapping_mode = 'fallback'
                        warnings.append('Mapping IA indisponible: fallback heuristique utilise')
                    mapped_df = pd.DataFrame(mapped_rows, columns=expected_columns)

            ai_confidence = _build_import_ai_confidence(df, mapped_rows, expected_columns, mapping_mode=mapping_mode)
            gate = _evaluate_import_ai_gate(ai_confidence)
            if gate['low_confidence']:
                warnings.append(
                    f"Confiance IA faible ({round(ai_confidence['score'] * 100)}% < {round(gate['threshold'] * 100)}%)."
                )
                if gate['block_on_low_confidence']:
                    return Response(
                        {
                            'error': 'Import bloque: confiance IA insuffisante.',
                            'ai_confidence': ai_confidence,
                            'import_policy': gate,
                            'columns_order': expected_columns,
                            'warnings': warnings,
                            'preview_data': mapped_rows[:200],
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            _append_ai_provider_warning(warnings, use_ai=True)

            if arabic_file:
                payload, report, warnings_ar, warnings_en = _maybe_build_bilingual_payload(mapped_df, arabic_file, english_file, use_ai=True)
                _append_ai_provider_warning(warnings_ar, use_ai=True)
                _append_ai_provider_warning(warnings_en, use_ai=True)
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
                'ai_confidence': ai_confidence,
                'import_policy': gate,
            }
            if arabic_file:
                response['validation_report'] = report
                response['warnings'] = {'fr': warnings, 'ar': warnings_ar, 'en': warnings_en}
            return Response(response, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception('Erreur import intelligent')
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='import-smart-preview')
    def import_table_smart_preview(self, request, pk=None):
        """
        Preview smart import using the same backend IA/fallback logic as admin,
        but without persisting anything. Intended for saisisseur draft workflow.
        """
        st = self.get_object()
        excel_file = request.FILES.get('file')
        arabic_file = request.FILES.get('file_ar')
        english_file = request.FILES.get('file_en')
        if not excel_file:
            return Response({'error': 'Aucun fichier fourni'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            _reset_ai_provider_marker()
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
                mapping_mode = 'schema_free'
                warnings.append('Mode schema libre: colonnes du fichier adoptees')
                if overlap > 0:
                    warnings.append(f'Recouvrement schema precedent: {round(overlap * 100)}%')
            else:
                if not expected_columns:
                    expected_columns = [str(c) for c in df.columns]
                    mapped_rows = df.to_dict(orient='records')
                    mapped_df = df.copy()
                    mapping_mode = 'direct'
                    warnings.append('Schema cible vide: import classique applique')
                else:
                    try:
                        mapped_rows = _run_gemini_mapping(df, expected_columns)
                        mapping_mode = 'ai'
                        warnings.append('Mapping IA applique')
                    except Exception as ai_err:
                        logger.warning('Fallback mapping preview active: %s', ai_err)
                        mapped_rows = _fallback_map_rows(df, expected_columns)
                        mapping_mode = 'fallback'
                        warnings.append('Mapping IA indisponible: fallback heuristique utilise')
                    mapped_df = pd.DataFrame(mapped_rows, columns=expected_columns)

            ai_confidence = _build_import_ai_confidence(df, mapped_rows, expected_columns, mapping_mode=mapping_mode)
            gate = _evaluate_import_ai_gate(ai_confidence)
            if gate['low_confidence']:
                warnings.append(
                    f"Confiance IA faible ({round(ai_confidence['score'] * 100)}% < {round(gate['threshold'] * 100)}%)."
                )

            _append_ai_provider_warning(warnings, use_ai=True)

            response = {
                'message': 'Preview import intelligent reussi',
                'data': mapped_rows,
                'columns_order': expected_columns,
                'warnings': warnings,
                'ai_confidence': ai_confidence,
                'import_policy': gate,
            }

            if arabic_file:
                try:
                    arabic_file.seek(0)
                except Exception:
                    pass
                df_ar, warnings_ar = _normalize_import_dataframe(arabic_file, use_ai=True)

                df_en = None
                warnings_en = []
                if english_file:
                    try:
                        english_file.seek(0)
                    except Exception:
                        pass
                    df_en, warnings_en = _normalize_import_dataframe(english_file, use_ai=True)

                _append_ai_provider_warning(warnings_ar, use_ai=True)
                _append_ai_provider_warning(warnings_en, use_ai=True)

                payload, report = _build_bilingual_payload(mapped_df, df_ar, df_en=df_en)
                if payload is None:
                    return Response(
                        {
                            'error': 'Validation i18n echouee.',
                            'validation_report': report,
                            'warnings': {'fr': warnings, 'ar': warnings_ar, 'en': warnings_en},
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                tables_i18n = {
                    'fr': mapped_rows,
                    'ar': _align_df_rows_to_columns(df_ar, expected_columns),
                }
                if df_en is not None:
                    tables_i18n['en'] = _align_df_rows_to_columns(df_en, expected_columns)

                response['tables_i18n'] = tables_i18n
                response['data_json_i18n_preview'] = {
                    **payload,
                    'validation_report': report,
                }
                response['validation_report'] = report
                response['warnings'] = {'fr': warnings, 'ar': warnings_ar, 'en': warnings_en}

            return Response(response, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception('Erreur preview import intelligent')
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='import-preview')
    def import_table_preview(self, request, pk=None):
        """
        Preview classic import using the same normalization/validation logic as admin
        import, but without persisting. Intended for saisisseur draft workflow.
        """
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

            preview_rows = df.to_dict(orient='records')
            preview_columns = [str(c) for c in list(df.columns)]
            response = {
                'message': 'Preview import classique reussi',
                'data': preview_rows,
                'columns_order': preview_columns,
                'warnings': warnings,
            }

            if arabic_file:
                if payload is None:
                    return Response(
                        {'error': 'Validation i18n echouee.', 'validation_report': report, 'warnings': {'fr': warnings, 'ar': warnings_ar, 'en': warnings_en}},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                try:
                    arabic_file.seek(0)
                except Exception:
                    pass
                df_ar, _ = _normalize_import_dataframe(arabic_file, use_ai=False)

                df_en = None
                if english_file:
                    try:
                        english_file.seek(0)
                    except Exception:
                        pass
                    df_en, _ = _normalize_import_dataframe(english_file, use_ai=False)

                tables_i18n = {
                    'fr': preview_rows,
                    'ar': _align_df_rows_to_columns(df_ar, preview_columns),
                }
                if df_en is not None:
                    tables_i18n['en'] = _align_df_rows_to_columns(df_en, preview_columns)

                response['tables_i18n'] = tables_i18n
                response['data_json_i18n_preview'] = {
                    **payload,
                    'validation_report': report,
                }
                response['validation_report'] = report
                response['warnings'] = {'fr': warnings, 'ar': warnings_ar, 'en': warnings_en}

            return Response(response, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception('Erreur preview import classique')
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='append-smart-preview')
    def append_table_smart_preview(self, request, pk=None):
        """
        Preview smart append using the same backend IA/fallback logic as admin,
        but without persisting anything. Intended for saisisseur draft workflow.
        """
        st = self.get_object()
        excel_file = request.FILES.get('file')
        arabic_file = request.FILES.get('file_ar')
        english_file = request.FILES.get('file_en')
        if not excel_file:
            return Response({'error': 'Aucun fichier fourni'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            _reset_ai_provider_marker()
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

            df, warnings = _normalize_import_dataframe(excel_file, use_ai=True)
            incoming_columns = [str(c) for c in df.columns]

            existing_rows = list(st.data_json or [])
            existing_columns = list(st.columns_order or [])

            if _is_bad_header_shape(existing_columns) and df is not None:
                existing_columns = [str(c) for c in df.columns]
                warnings.append('Schema cible corrige a partir de la table normalisee')

            overlap = _schema_overlap_ratio(existing_columns, incoming_columns)

            if not existing_columns:
                mapped_rows = df.to_dict(orient='records')
                final_columns = incoming_columns
                mapping_mode = 'direct'
                warnings.append('Schema cible vide: colonnes du fichier adoptees')
            elif set(incoming_columns) == set(existing_columns):
                mapped_rows = [
                    {col: row.get(col, '') for col in existing_columns}
                    for row in df.to_dict(orient='records')
                ]
                final_columns = existing_columns
                mapping_mode = 'direct'
                warnings.append('Colonnes compatibles: ajout direct ordonne')
            else:
                try:
                    mapped_rows = _run_gemini_mapping(df, existing_columns)
                    final_columns = existing_columns
                    mapping_mode = 'ai'
                    warnings.append('Mapping IA applique pour ajout')
                except Exception as ai_err:
                    logger.warning('Fallback append mapping preview active: %s', ai_err)
                    mapped_rows = _fallback_map_rows(df, existing_columns)
                    final_columns = existing_columns
                    mapping_mode = 'fallback'
                    warnings.append('Mapping IA indisponible: fallback heuristique utilise pour ajout')

                warnings.append(
                    f'Colonnes source differentes. Recouvrement schema: {round(overlap * 100)}%'
                )

            mapped_df = pd.DataFrame(mapped_rows, columns=final_columns)
            merged = existing_rows + mapped_rows
            ai_confidence = _build_import_ai_confidence(df, mapped_rows, final_columns, mapping_mode=mapping_mode)
            gate = _evaluate_import_ai_gate(ai_confidence)
            if gate['low_confidence']:
                warnings.append(
                    f"Confiance IA faible ({round(ai_confidence['score'] * 100)}% < {round(gate['threshold'] * 100)}%)."
                )

            _append_ai_provider_warning(warnings, use_ai=True)

            response = {
                'message': f'{len(mapped_rows)} ligne(s) pretes a ajouter. Total projete : {len(merged)} ligne(s).',
                'data': merged,
                'columns_order': final_columns,
                'warnings': warnings,
                'append_rows': mapped_rows,
                'ai_confidence': ai_confidence,
                'import_policy': gate,
            }

            if arabic_file:
                try:
                    arabic_file.seek(0)
                except Exception:
                    pass
                df_ar, warnings_ar = _normalize_import_dataframe(arabic_file, use_ai=True)

                df_en = None
                warnings_en = []
                if english_file:
                    try:
                        english_file.seek(0)
                    except Exception:
                        pass
                    df_en, warnings_en = _normalize_import_dataframe(english_file, use_ai=True)

                _append_ai_provider_warning(warnings_ar, use_ai=True)
                _append_ai_provider_warning(warnings_en, use_ai=True)

                payload, report = _build_bilingual_payload(mapped_df, df_ar, df_en=df_en)
                if payload is None:
                    return Response(
                        {
                            'error': 'Validation i18n echouee.',
                            'validation_report': report,
                            'warnings': {'fr': warnings, 'ar': warnings_ar, 'en': warnings_en},
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                append_i18n = {
                    'fr': mapped_rows,
                    'ar': _align_df_rows_to_columns(df_ar, final_columns),
                }
                if df_en is not None:
                    append_i18n['en'] = _align_df_rows_to_columns(df_en, final_columns)

                response['append_rows_i18n'] = append_i18n
                response['validation_report'] = report
                response['warnings'] = {'fr': warnings, 'ar': warnings_ar, 'en': warnings_en}

            return Response(response, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception('Erreur preview append intelligent')
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
            _reset_ai_provider_marker()

            df_fr, warnings_fr = _normalize_import_dataframe(file_fr, use_ai=use_ai)
            file_ar.seek(0)
            df_ar, warnings_ar = _normalize_import_dataframe(file_ar, use_ai=use_ai)

            df_en = None
            warnings_en = []
            if file_en:
                file_en.seek(0)
                df_en, warnings_en = _normalize_import_dataframe(file_en, use_ai=use_ai)

            _append_ai_provider_warning(warnings_fr, use_ai=use_ai)
            _append_ai_provider_warning(warnings_ar, use_ai=use_ai)
            _append_ai_provider_warning(warnings_en, use_ai=use_ai)

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
    """Génère un mot de passe robuste avec complexité minimale."""
    if length < 12:
        length = 12

    lower = string.ascii_lowercase
    upper = string.ascii_uppercase
    digits = string.digits
    specials = '!@#$%^&*()-_=+[]{}'
    all_chars = lower + upper + digits + specials

    required = [
        secrets.choice(lower),
        secrets.choice(upper),
        secrets.choice(digits),
        secrets.choice(specials),
    ]
    remaining = [secrets.choice(all_chars) for _ in range(length - len(required))]
    chars = required + remaining
    secrets.SystemRandom().shuffle(chars)
    return ''.join(chars)


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

                draft_rows = notes_obj.get('tables') if isinstance(notes_obj.get('tables'), list) else None
                draft_columns = notes_obj.get('columns_order') if isinstance(notes_obj.get('columns_order'), list) and notes_obj.get('columns_order') else None
                draft_i18n = notes_obj.get('tables_i18n') if isinstance(notes_obj.get('tables_i18n'), dict) else {}
                draft_i18n_payload = notes_obj.get('data_json_i18n_draft') if isinstance(notes_obj.get('data_json_i18n_draft'), dict) else None

                if draft_rows is not None:
                    df_fr = pd.DataFrame(draft_rows)
                    if draft_columns:
                        df_fr = df_fr.reindex(columns=draft_columns, fill_value='')
                    df_fr = df_fr.fillna('')

                    draft_rows_ar = draft_i18n.get('ar') if isinstance(draft_i18n.get('ar'), list) else None
                    draft_rows_en = draft_i18n.get('en') if isinstance(draft_i18n.get('en'), list) else None

                    # Prefer canonical i18n payload produced during preview/import; it preserves
                    # localized value labels exactly as validated by backend.
                    payload_rows = list(draft_i18n_payload.get('rows') or []) if draft_i18n_payload else []
                    payload_columns = list(draft_i18n_payload.get('canonical_columns') or []) if draft_i18n_payload else []
                    payload_rows_fr = list((draft_i18n_payload.get('rows_by_language') or {}).get('fr') or []) if draft_i18n_payload else []
                    can_use_payload_directly = bool(
                        draft_i18n_payload
                        and payload_rows
                        and payload_columns
                        and len(payload_rows) == len(df_fr)
                        and (not payload_rows_fr or len(payload_rows_fr) == len(df_fr))
                    )

                    if can_use_payload_directly:
                        report = draft_i18n_payload.get('validation_report') if isinstance(draft_i18n_payload.get('validation_report'), dict) else {
                            'matched': True,
                            'rows_total': len(payload_rows),
                            'source': 'draft_payload',
                        }
                        _persist_bilingual_table(sous_theme, df_fr, draft_i18n_payload, report)
                    elif draft_rows_ar:
                        df_ar = pd.DataFrame(draft_rows_ar).reindex(columns=list(df_fr.columns), fill_value='').fillna('')
                        df_en = None
                        if draft_rows_en:
                            df_en = pd.DataFrame(draft_rows_en).reindex(columns=list(df_fr.columns), fill_value='').fillna('')

                        payload, report = _build_bilingual_payload(df_fr, df_ar, df_en=df_en)
                        if payload is not None:
                            _persist_bilingual_table(sous_theme, df_fr, payload, report)
                        else:
                            # If i18n payload is invalid in draft, publish FR table only and clear stale i18n payload.
                            _persist_monolingual_table(sous_theme, df_fr)
                    else:
                        # Draft without AR table: publish FR table and clear stale i18n payload.
                        _persist_monolingual_table(sous_theme, df_fr)
                elif draft_columns:
                    sous_theme.columns_order = draft_columns

                if isinstance(notes_obj.get('charts'), list):
                    sous_theme.charts_config = notes_obj.get('charts')

                meta = notes_obj.get('meta') if isinstance(notes_obj.get('meta'), dict) else {}
                advanced_config = notes_obj.get('advancedConfig') if isinstance(notes_obj.get('advancedConfig'), dict) else {}

                for field in [
                    'definition_text', 'unite_text', 'indication_text', 'source_text', 'periodicite_text', 'couverture_text',
                    'definition_text_ar', 'unite_text_ar', 'indication_text_ar', 'source_text_ar', 'periodicite_text_ar', 'couverture_text_ar',
                    'definition_text_en', 'unite_text_en', 'indication_text_en', 'source_text_en', 'periodicite_text_en', 'couverture_text_en',
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
            if getattr(request.user, 'role', None) != 'ADMIN' and not getattr(request.user, 'is_superuser', False):
                return Response({'error': 'Accès refusé'}, status=status.HTTP_403_FORBIDDEN)

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

            # Si l'email ne part pas, on rollback la création pour éviter un compte sans mot de passe communiqué.
            with transaction.atomic():
                new_user = CustomUser.objects.create_user(
                    username=username,
                    email=email,
                    password=temp_password,
                    role=role,
                    first_name=name
                )

                send_mail(
                    subject,
                    message,
                    getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@hcp.ma'),
                    [email],
                    fail_silently=False,
                )
            
            serializer = UserSerializer(new_user)
            return Response(
                {
                    'message': 'Utilisateur créé avec succès',
                    'user': serializer.data,
                    'email_sent': True
                },
                status=status.HTTP_201_CREATED
            )
        except Exception as e:
            logger.exception('Erreur création utilisateur')
            if 'send' in str(e).lower() or 'smtp' in str(e).lower() or 'email' in str(e).lower():
                return Response(
                    {'error': "Impossible d'envoyer l'email d'identifiants. Vérifiez la configuration email serveur."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            return Response({'error': _public_error_message("Erreur lors de la création utilisateur.")}, status=status.HTTP_400_BAD_REQUEST)
    
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
            return Response({'error': _public_error_message("Erreur lors de la création de la demande.")}, status=status.HTTP_400_BAD_REQUEST)
    
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
                        getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@hcp.ma'),
                        [user_request.requester_email],
                        fail_silently=False,
                    )
                except Exception as e:
                    logger.warning(f"Impossible d'envoyer l'email: {str(e)}")
            
            serializer = UserRequestSerializer(user_request)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception('Erreur mise à jour demande')
            return Response({'error': _public_error_message("Erreur lors de la mise à jour de la demande.")}, status=status.HTTP_400_BAD_REQUEST)
    
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
            old_password_hash = user.password
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
                    getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@hcp.ma'),
                    [user_request.requester_email],
                    fail_silently=False,
                )
            except Exception as e:
                user.password = old_password_hash
                user.save(update_fields=['password'])
                return Response(
                    {'error': "Réinitialisation annulée: impossible d'envoyer l'email."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            
            return Response(
                {'message': 'Mot de passe réinitialisé et email envoyé'},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            logger.exception('Erreur réinitialisation mot de passe')
            return Response({'error': _public_error_message("Erreur lors de la réinitialisation du mot de passe.")}, status=status.HTTP_400_BAD_REQUEST)


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

    def _is_application_related_question(self, message):
        msg = _clean_text(message).lower()
        app_keywords = [
            'theme', 'thème', 'sous-theme', 'sous-thème', 'categorie', 'catégorie',
            'utilisateur', 'saisisseur', 'admin', 'assignation', 'affectation',
            'import', 'tableau', 'graphe', 'metadonne', 'métadonné', 'rapport',
            'archive', 'publie', 'publi', 'visiteur', 'configuration', 'tache', 'tâche'
        ]
        return any(k in msg for k in app_keywords)

    def _assistant_prefers_gemini_for_question(self, message):
        if not _read_bool_env('ASSISTANT_GENERAL_USE_GEMINI', True):
            return False
        return not self._is_application_related_question(message)

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

        if not self._is_application_related_question(message):
            return (
                "Le mode secours est orienté application HCP, mais je peux quand même vous aider sur des questions générales. "
                "Reformulez votre question en une phrase courte pour obtenir une réponse plus directe."
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

    def _build_context_answer(self, message, theme_id=None):
        """High-precision answers from live DB for common admin questions."""
        msg = _clean_text(message).lower()
        msg_norm = re.sub(r'\s+', ' ', msg)
        themes_qs = Theme.objects.all().order_by('titre')
        subthemes_qs = SousTheme.objects.all().order_by('nom')
        categories_qs = Categorie.objects.all().order_by('nom')
        users_qs = CustomUser.objects.all().order_by('username')
        if theme_id:
            themes_qs = themes_qs.filter(id=theme_id)
            subthemes_qs = subthemes_qs.filter(theme_id=theme_id)
            categories_qs = categories_qs.filter(theme_id=theme_id)

        ask_theme_names = any(k in msg for k in [
            'nom des themes', 'noms des themes', 'liste des themes', 'themes qui existe', 'themes existants',
            'nom des thèmes', 'noms des thèmes', 'liste des thèmes', 'thèmes qui existent', 'thèmes existants'
        ])
        ask_subtheme_names = any(k in msg for k in [
            'nom des sous themes', 'noms des sous themes', 'liste des sous themes',
            'nom des sous-thèmes', 'noms des sous-thèmes', 'liste des sous-thèmes'
        ])
        ask_category_names = any(k in msg for k in [
            'nom des categories', 'noms des categories', 'liste des categories',
            'nom des catégories', 'noms des catégories', 'liste des catégories'
        ])
        ask_user_counts = any(k in msg for k in [
            'combien d\'utilisateurs', 'nombre d\'utilisateurs', 'combien de saisisseurs', 'nombre de saisisseurs'
        ]) or bool(re.search(r'\b(combien|nombre)\b.*\butilisateur(s)?\b', msg_norm))
        ask_user_list = any(k in msg for k in [
            'liste des utilisateurs', 'noms des utilisateurs', 'qui sont les utilisateurs',
            'liste des saisisseurs', 'liste des admins', 'liste des administrateurs',
            'liste des utilisateur', 'donner moi la liste des utilisateur', 'donne moi la liste des utilisateur'
        ]) or bool(re.search(r'\bliste\b.*\butilisateur(s)?\b', msg_norm)) or bool(re.search(r'\bnom(s)?\b.*\butilisateur(s)?\b', msg_norm))
        ask_subthemes_for_theme = any(k in msg for k in [
            'sous-themes du theme', 'sous themes du theme', 'sous-thèmes du thème', 'sous thèmes du thème',
            'sous-themes de theme', 'sous thèmes de thème'
        ])

        if ask_theme_names:
            names = list(themes_qs.values_list('titre', flat=True))
            if not names:
                return "Aucun thème n'est enregistré actuellement."
            return "Voici les thèmes enregistrés :\n- " + "\n- ".join(names)

        if ask_subtheme_names:
            names = list(subthemes_qs.values_list('nom', flat=True)[:120])
            if not names:
                return "Aucun sous-thème n'est enregistré actuellement."
            return "Voici les sous-thèmes enregistrés :\n- " + "\n- ".join(names)

        if ask_subthemes_for_theme:
            hint = None
            patterns = [
                r"sous[- ]?th[eè]mes? (?:du|de la|de l'|de) th[eè]me\s+([^\n\?\.;]+)",
                r"th[eè]me\s+([^\n\?\.;]+)",
            ]
            for pattern in patterns:
                match = re.search(pattern, msg)
                if match and _clean_text(match.group(1)):
                    hint = _clean_text(match.group(1))
                    break

            if hint:
                theme = Theme.objects.filter(titre__icontains=hint).order_by('titre').first()
                if theme:
                    names = list(SousTheme.objects.filter(theme=theme).order_by('nom').values_list('nom', flat=True)[:150])
                    if not names:
                        return f"Le thème '{theme.titre}' n'a pas encore de sous-thème."
                    return f"Sous-thèmes du thème '{theme.titre}' :\n- " + "\n- ".join(names)
                return f"Aucun thème correspondant à '{hint}' n'a été trouvé."

        if ask_user_counts:
            total_users = CustomUser.objects.filter(is_active=True).count()
            total_saisisseurs = CustomUser.objects.filter(role='SAISISSEUR', is_active=True).count()
            total_admins = CustomUser.objects.filter(role='ADMIN', is_active=True).count()
            return (
                "Statistiques utilisateurs actuelles :\n"
                f"- Utilisateurs actifs: {total_users}\n"
                f"- Admins actifs: {total_admins}\n"
                f"- Saisisseurs actifs: {total_saisisseurs}"
            )

        if ask_category_names:
            entries = list(categories_qs.select_related('theme').values_list('nom', 'theme__titre')[:200])
            if not entries:
                return "Aucune catégorie n'est enregistrée actuellement."
            grouped = defaultdict(list)
            for category_name, theme_title in entries:
                grouped[theme_title or 'Sans thème'].append(category_name)
            lines = ["Voici les catégories par thème :"]
            for theme_title in sorted(grouped.keys()):
                lines.append(f"- {theme_title}: {', '.join(grouped[theme_title])}")
            return "\n".join(lines)

        if ask_user_list:
            rows = list(users_qs.values('username', 'first_name', 'email', 'role', 'is_active')[:200])
            if not rows:
                return "Aucun utilisateur n'est enregistré actuellement."
            lines = ["Voici les utilisateurs enregistrés :"]
            for user in rows:
                display_name = _clean_text(user.get('first_name')) or _clean_text(user.get('username')) or 'Utilisateur'
                status_label = 'actif' if user.get('is_active') else 'archive'
                lines.append(f"- {display_name} ({user.get('role')}, {status_label}) - {user.get('email')}")
            return "\n".join(lines)

        return None

    def _iter_text_chunks(self, text):
        value = str(text or '')
        if not value:
            return
        granularity = os.getenv('ASSISTANT_STREAM_GRANULARITY', 'word').strip().lower()
        if granularity == 'char':
            for ch in value:
                yield ch
            return
        # Default: word-by-word chunks while preserving spaces/new lines.
        for part in re.findall(r'\S+\s*|\s+', value):
            if part:
                yield part

    def _build_ai_prompt(self, user_message, fallback_text, is_app_related=True):
        total_users = CustomUser.objects.filter(is_active=True).count()
        total_saisisseurs = CustomUser.objects.filter(role='SAISISSEUR', is_active=True).count()
        total_themes = Theme.objects.count()
        total_subthemes = SousTheme.objects.count()
        pending_assignments = UserThemeAssignment.objects.filter(statut='En attente').count()
        in_progress_assignments = UserThemeAssignment.objects.filter(statut='En cours').count()
        completed_assignments = UserThemeAssignment.objects.filter(statut='Complété').count()
        theme_names = list(Theme.objects.order_by('titre').values_list('titre', flat=True)[:10])
        subtheme_names = list(SousTheme.objects.order_by('nom').values_list('nom', flat=True)[:10])

        if not is_app_related:
            return (
                "Tu es un assistant utile et concis. "
                "Reponds en francais clair en 4 a 8 lignes maximum, sans blabla. "
                "Si la demande est generale, donne une reponse directe et structuree.\n\n"
                f"Question utilisateur: {user_message}\n"
                "Retourne uniquement la reponse finale, sans JSON, sans markdown."
            )

        context_snapshot = (
            f"Contexte actuel de l'application:\n"
            f"- Utilisateurs actifs: {total_users}\n"
            f"- Saisisseurs actifs: {total_saisisseurs}\n"
            f"- Themes: {total_themes}\n"
            f"- Sous-themes: {total_subthemes}\n"
            f"- Taches en attente: {pending_assignments}\n"
            f"- Taches en cours: {in_progress_assignments}\n"
            f"- Taches completees: {completed_assignments}\n"
            f"- Themes connus (echantillon): {', '.join(theme_names) if theme_names else 'Aucun'}\n"
            f"- Sous-themes connus (echantillon): {', '.join(subtheme_names) if subtheme_names else 'Aucun'}\n"
        )

        return (
            "Tu es l'assistant intelligent Admin de la plateforme HCP. "
            "Tu reponds a la fois aux questions sur l'application HCP ET aux questions generales. "
            "Si la question est liee a HCP, privilegie une reponse actionnable (bouton/menu/action). "
            "Si la question est generale, reponds clairement et naturellement sans forcer le contexte HCP. "
            "N'invente aucun chiffre pour les parties HCP: utilise uniquement le contexte fourni.\n\n"
            f"{context_snapshot}\n"
            f"Question utilisateur: {user_message}\n"
            f"Réponse de secours (si utile): {_clean_text(fallback_text)[:280]}\n\n"
            "Format attendu: phrases courtes, listes numerotees quand pertinent, retours a la ligne lisibles. "
            "Si la question porte sur les noms exacts des themes/sous-themes/utilisateurs, utilise strictement les noms du contexte sans en inventer. "
            "Retourne uniquement la reponse finale, sans JSON, sans markdown."
        )

    def _stream_ollama_reply(self, prompt):
        default_model = os.getenv('OLLAMA_MODEL', 'qwen2.5:7b-instruct').strip() or 'qwen2.5:7b-instruct'
        ollama_model = os.getenv('ASSISTANT_OLLAMA_MODEL', default_model).strip() or default_model
        ollama_timeout = _read_int_env('ASSISTANT_OLLAMA_TIMEOUT_SECONDS', 14, min_value=3, max_value=120)
        max_tokens = _read_int_env('ASSISTANT_OLLAMA_MAX_TOKENS', 220, min_value=80, max_value=1200)
        ollama_base_url = os.getenv('OLLAMA_BASE_URL', 'http://127.0.0.1:11434').strip() or 'http://127.0.0.1:11434'

        payload = {
            'model': ollama_model,
            'prompt': str(prompt or ''),
            'stream': True,
            'options': {
                'temperature': 0.1,
                'num_predict': max_tokens,
            },
        }
        body = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            url=f"{ollama_base_url.rstrip('/')}/api/generate",
            data=body,
            headers={'Content-Type': 'application/json'},
            method='POST',
        )

        with urllib.request.urlopen(req, timeout=ollama_timeout) as response:
            for raw_line in response:
                line = raw_line.decode('utf-8', errors='replace').strip()
                if not line:
                    continue
                chunk = json.loads(line)
                text_piece = str(chunk.get('response', ''))
                if text_piece != '':
                    yield text_piece
                if chunk.get('done'):
                    break

    def _try_ai_rewrite(self, user_message, fallback_text):
        is_app_related = self._is_application_related_question(user_message)
        prompt = self._build_ai_prompt(user_message, fallback_text, is_app_related=is_app_related)
        prefer_gemini = self._assistant_prefers_gemini_for_question(user_message)
        allow_gemini_fallback = _read_bool_env('ASSISTANT_ALLOW_GEMINI_FALLBACK', False)
        use_ollama = _read_bool_env('ASSISTANT_PREFER_OLLAMA', True) and _read_bool_env('OLLAMA_ENABLED', False)

        if prefer_gemini:
            try:
                return _gemini_generate_text(prompt, purpose='admin_assistant_rewrite')
            except Exception as gemini_error:
                logger.warning('Assistant admin: echec Gemini (general): %s', gemini_error)
                if use_ollama:
                    return _ollama_generate_text(prompt, purpose='admin_assistant_rewrite')
                raise

        if use_ollama:
            try:
                return _ollama_generate_text(prompt, purpose='admin_assistant_rewrite')
            except Exception as ollama_error:
                logger.warning('Assistant admin: echec Ollama: %s', ollama_error)
                if not allow_gemini_fallback:
                    raise

        return _gemini_generate_text(prompt, purpose='admin_assistant_rewrite')

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
        stream = _is_truthy(request.data.get('stream', False))
        fallback_answer = self._build_fallback_answer(message, theme_id=theme_id)
        context_answer = self._build_context_answer(message, theme_id=theme_id)

        if context_answer:
            if stream:
                def _ctx_stream():
                    for chunk in self._iter_text_chunks(context_answer):
                        yield (json.dumps({'type': 'delta', 'text': chunk, 'mode': 'ai'}, ensure_ascii=False) + '\n').encode('utf-8')
                    yield (json.dumps({'type': 'done', 'mode': 'ai', 'provider': 'context'}, ensure_ascii=False) + '\n').encode('utf-8')

                response = StreamingHttpResponse(_ctx_stream(), content_type='application/x-ndjson; charset=utf-8')
                response['Cache-Control'] = 'no-cache'
                response['X-Accel-Buffering'] = 'no'
                return response

            return Response(
                {
                    'reply': context_answer,
                    'mode': 'ai',
                    'provider': 'context',
                },
                status=status.HTTP_200_OK,
            )

        if not use_ai:
            return Response(
                {
                    'reply': fallback_answer,
                    'mode': 'fallback',
                },
                status=status.HTTP_200_OK,
            )

        if stream:
            def _encode_event(payload):
                return (json.dumps(payload, ensure_ascii=False) + '\n').encode('utf-8')

            def _event_stream():
                is_app_related = self._is_application_related_question(message)
                prompt = self._build_ai_prompt(message, fallback_answer, is_app_related=is_app_related)
                sent_any = False
                allow_gemini_fallback = _read_bool_env('ASSISTANT_ALLOW_GEMINI_FALLBACK', False)
                use_ollama = _read_bool_env('ASSISTANT_PREFER_OLLAMA', True) and _read_bool_env('OLLAMA_ENABLED', False)
                prefer_gemini = self._assistant_prefers_gemini_for_question(message)

                providers = []
                if prefer_gemini:
                    providers = ['gemini'] + (['ollama'] if use_ollama else [])
                else:
                    providers = (['ollama'] if use_ollama else []) + (['gemini'] if allow_gemini_fallback or not use_ollama else [])

                for provider in providers:
                    if provider == 'ollama':
                        try:
                            for piece in self._stream_ollama_reply(prompt):
                                sent_any = True
                                for chunk in self._iter_text_chunks(piece):
                                    yield _encode_event({'type': 'delta', 'text': chunk, 'mode': 'ai'})
                            yield _encode_event({'type': 'done', 'mode': 'ai', 'provider': 'ollama'})
                            return
                        except Exception as ollama_error:
                            logger.warning('Assistant admin streaming: echec Ollama: %s', ollama_error)
                            continue

                    if provider == 'gemini':
                        try:
                            ai_reply = _gemini_generate_text(prompt, purpose='admin_assistant_rewrite')
                            for chunk in self._iter_text_chunks(ai_reply):
                                yield _encode_event({'type': 'delta', 'text': chunk, 'mode': 'ai'})
                            yield _encode_event({'type': 'done', 'mode': 'ai', 'provider': 'gemini'})
                            return
                        except Exception as gemini_error:
                            logger.warning('Assistant admin streaming: echec Gemini: %s', gemini_error)
                            continue

                reply = fallback_answer if not sent_any else ''
                if reply:
                    yield _encode_event({'type': 'delta', 'text': reply, 'mode': 'fallback'})
                yield _encode_event({'type': 'done', 'mode': 'fallback', 'provider': 'fallback'})

            response = StreamingHttpResponse(_event_stream(), content_type='application/x-ndjson; charset=utf-8')
            response['Cache-Control'] = 'no-cache'
            response['X-Accel-Buffering'] = 'no'
            return response

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