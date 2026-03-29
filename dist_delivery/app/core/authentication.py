from django.conf import settings
from django.utils import timezone
import secrets
from rest_framework import exceptions
from rest_framework.authentication import TokenAuthentication


class CookieOrHeaderTokenAuthentication(TokenAuthentication):
    """Authenticate using Authorization header first, then HttpOnly auth cookie."""

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is not None:
            return result

        cookie_name = getattr(settings, 'AUTH_TOKEN_COOKIE_NAME', 'auth_token')
        key = request.COOKIES.get(cookie_name)
        if not key:
            return None

        require_csrf = bool(getattr(settings, 'AUTH_COOKIE_REQUIRE_CSRF', True))
        if require_csrf and request.method not in ('GET', 'HEAD', 'OPTIONS', 'TRACE'):
            csrf_cookie_name = getattr(settings, 'CSRF_COOKIE_NAME', 'csrftoken')
            csrf_cookie = request.COOKIES.get(csrf_cookie_name)
            csrf_header = request.META.get('HTTP_X_CSRFTOKEN') or request.META.get('HTTP_X_CSRF_TOKEN')
            if not csrf_cookie or not csrf_header or not secrets.compare_digest(str(csrf_cookie), str(csrf_header)):
                raise exceptions.AuthenticationFailed('CSRF validation failed for cookie authentication')

        return self.authenticate_credentials(key)

    def authenticate_credentials(self, key):
        user, token = super().authenticate_credentials(key)

        ttl_seconds = int(getattr(settings, 'AUTH_TOKEN_TTL_SECONDS', 0) or 0)
        if ttl_seconds > 0:
            token_age = (timezone.now() - token.created).total_seconds()
            if token_age > ttl_seconds:
                token.delete()
                raise exceptions.AuthenticationFailed('Token expired')

        return (user, token)
