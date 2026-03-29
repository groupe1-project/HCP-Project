import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
import sys

try:
    django.setup()
except Exception as e:
    print('Django setup error:', e)
    sys.exit(1)

from core.models import CustomUser

admins = CustomUser.objects.filter(role='ADMIN')
print('Users with role=ADMIN:')
for u in admins:
    print(f'id={u.id} username={u.username} email={u.email} is_superuser={u.is_superuser} is_active={u.is_active}')

supers = CustomUser.objects.filter(is_superuser=True)
print('\nUsers with is_superuser=True:')
for u in supers:
    print(f'id={u.id} username={u.username} email={u.email} role={u.role} is_active={u.is_active}')

all_users = CustomUser.objects.all()
print('\nAll users (summary):')
for u in all_users:
    print(f'id={u.id} username={u.username} email={u.email} role={u.role} is_superuser={u.is_superuser} is_active={u.is_active}')
