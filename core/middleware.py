import uuid
import contextvars
from django.conf import settings


_request_id_var = contextvars.ContextVar('request_id', default='-')


def get_current_request_id():
    return _request_id_var.get()


class RequestIdLogFilter:
    def filter(self, record):
        record.request_id = get_current_request_id()
        return True


class RequestContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        incoming = str(request.META.get('HTTP_X_REQUEST_ID', '')).strip()
        request_id = incoming or str(uuid.uuid4())

        token = _request_id_var.set(request_id)
        request.request_id = request_id
        try:
            response = self.get_response(request)
        finally:
            _request_id_var.reset(token)

        response['X-Request-ID'] = request_id
        return response


class SecurityHeadersMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Apply CSP in report-only mode by default to avoid breaking current UI.
        if getattr(settings, 'CSP_ENABLED', True):
            csp_header_name = 'Content-Security-Policy-Report-Only' if getattr(settings, 'CSP_REPORT_ONLY', True) else 'Content-Security-Policy'
            csp_value = getattr(settings, 'CSP_HEADER_VALUE', '').strip()
            if csp_value:
                response[csp_header_name] = csp_value

        permissions_policy = getattr(settings, 'PERMISSIONS_POLICY', '').strip()
        if permissions_policy:
            response['Permissions-Policy'] = permissions_policy

        response.setdefault('Cross-Origin-Opener-Policy', 'same-origin')

        return response
