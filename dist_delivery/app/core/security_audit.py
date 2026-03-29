import json
import logging
from datetime import datetime, timezone

security_logger = logging.getLogger('security')


def _client_ip(request):
    xff = (request.META.get('HTTP_X_FORWARDED_FOR') or '').strip()
    if xff:
        return xff.split(',')[0].strip()
    return (request.META.get('REMOTE_ADDR') or '').strip()


def audit_security_event(event, request=None, **details):
    payload = {
        'event': event,
        'timestamp': datetime.now(timezone.utc).isoformat(),
    }

    if request is not None:
        payload['method'] = getattr(request, 'method', '')
        payload['path'] = getattr(request, 'path', '')
        payload['client_ip'] = _client_ip(request)
        payload['user_agent'] = (request.META.get('HTTP_USER_AGENT') or '')[:180]
        user = getattr(request, 'user', None)
        if getattr(user, 'is_authenticated', False):
            payload['actor_id'] = getattr(user, 'id', None)
            payload['actor_role'] = getattr(user, 'role', None)

    for key, value in details.items():
        if value is not None:
            payload[key] = value

    security_logger.info(json.dumps(payload, ensure_ascii=False, default=str))
