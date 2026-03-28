import os
import sys
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

import django  # noqa: E402

django.setup()

from django.conf import settings  # noqa: E402


def check(name, passed, details=''):
    status = 'PASS' if passed else 'FAIL'
    print(f'[{status}] {name}{" - " + details if details else ""}')
    return passed


def main():
    print('=== Security Preflight ===')
    checks = []

    checks.append(check('Debug disabled in production profile', settings.DEBUG is False, f'DEBUG={settings.DEBUG}'))
    checks.append(check('Secret key configured', settings.SECRET_KEY != 'unsafe-dev-key-change-me'))
    checks.append(check('PostgreSQL password configured', bool(settings.DATABASES['default'].get('PASSWORD'))))
    checks.append(check('Allowed hosts configured', bool(settings.ALLOWED_HOSTS), f'hosts={settings.ALLOWED_HOSTS}'))

    checks.append(check('HTTPS redirect enabled when DEBUG=False', settings.DEBUG or getattr(settings, 'SECURE_SSL_REDIRECT', False)))
    checks.append(check('HSTS configured when DEBUG=False', settings.DEBUG or int(getattr(settings, 'SECURE_HSTS_SECONDS', 0)) > 0))

    checks.append(check('Token TTL enabled', int(getattr(settings, 'AUTH_TOKEN_TTL_SECONDS', 0)) > 0, f"TTL={getattr(settings, 'AUTH_TOKEN_TTL_SECONDS', 0)}"))
    checks.append(check('Cookie auth requires CSRF', bool(getattr(settings, 'AUTH_COOKIE_REQUIRE_CSRF', False))))

    checks.append(check('Security logger configured', 'security' in getattr(settings, 'LOGGING', {}).get('loggers', {})))
    checks.append(check('CSP enabled', bool(getattr(settings, 'CSP_ENABLED', False))))

    # Ops readiness: backup/restore tooling should be present on hosts running maintenance jobs.
    checks.append(check('pg_dump available', shutil.which('pg_dump') is not None))
    checks.append(check('pg_restore available', shutil.which('pg_restore') is not None))
    checks.append(check('psql available', shutil.which('psql') is not None))

    failed = [c for c in checks if not c]
    print('--------------------------')
    if failed:
        print(f'Security preflight FAILED ({len(failed)} checks failed).')
        sys.exit(1)

    print('Security preflight PASSED.')
    sys.exit(0)


if __name__ == '__main__':
    main()
