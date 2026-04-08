from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework.authtoken.models import Token
from unittest.mock import patch
import pandas as pd

from .models import CustomUser
from .models import Theme, SousTheme


class HealthEndpointTests(TestCase):
	def setUp(self):
		self.client = APIClient()

	def test_health_endpoint_returns_json_and_ready_flag(self):
		response = self.client.get('/health/', secure=True)
		self.assertEqual(response.status_code, 200)

		payload = response.json()
		self.assertIn('status', payload)
		self.assertIn('ready', payload)
		self.assertIn('checks', payload)
		self.assertIn('db', payload['checks'])
		self.assertTrue(payload['checks']['db']['ok'])


class AuthFlowTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.password = 'Passw0rd!Strong'
		self.user = CustomUser.objects.create_user(
			username='admin_test',
			email='admin_test@example.com',
			password=self.password,
			role='ADMIN',
		)

	def test_login_me_logout_flow(self):
		login_response = self.client.post(
			'/api/auth/login/',
			{'email': self.user.email, 'password': self.password},
			format='json',
			secure=True,
		)
		self.assertEqual(login_response.status_code, 200)

		token = login_response.json().get('token')
		self.assertTrue(token)

		me_client = APIClient()
		me_client.credentials(HTTP_AUTHORIZATION=f'Token {token}')
		me_response = me_client.get('/api/auth/me/', secure=True)
		self.assertEqual(me_response.status_code, 200)
		self.assertEqual(me_response.json().get('email'), self.user.email)

		logout_client = APIClient()
		logout_client.credentials(HTTP_AUTHORIZATION=f'Token {token}')
		logout_response = logout_client.post('/api/auth/logout/', {}, format='json', secure=True)
		self.assertEqual(logout_response.status_code, 200)

		self.assertFalse(Token.objects.filter(key=token).exists())

	def test_login_works_with_stale_cookie_without_csrf_header(self):
		# Simulate stale cookie from previous session; login endpoint should still be accessible.
		self.client.cookies['auth_token'] = 'stale-token-value'

		login_response = self.client.post(
			'/api/auth/login/',
			{'email': self.user.email, 'password': self.password},
			format='json',
			secure=True,
		)

		self.assertEqual(login_response.status_code, 200)
		self.assertTrue(login_response.json().get('token'))


class AdminAssistantFallbackTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.user = CustomUser.objects.create_user(
			username='admin_assistant',
			email='assistant_admin@example.com',
			password='Passw0rd!Strong',
			role='ADMIN',
		)
		token = Token.objects.create(user=self.user)
		self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

	def test_admin_assistant_falls_back_when_ai_is_unavailable(self):
		response = self.client.post(
			'/api/admin-assistant/chat/',
			{
				'message': 'Combien de themes sont actifs ?',
				'use_ai': True,
			},
			format='json',
			secure=True,
		)
		self.assertEqual(response.status_code, 200)

		payload = response.json()
		self.assertEqual(payload.get('mode'), 'fallback')
		self.assertIn('reply', payload)
		self.assertTrue(str(payload.get('reply', '')).strip())


class ImportWorkflowTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.user = CustomUser.objects.create_user(
			username='admin_import',
			email='admin_import@example.com',
			password='Passw0rd!Strong',
			role='ADMIN',
		)
		token = Token.objects.create(user=self.user)
		self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

		self.theme = Theme.objects.create(titre='Theme test', is_visible=True)
		self.sous_theme = SousTheme.objects.create(
			nom='Sous theme test',
			theme=self.theme,
			columns_order=['Annee', 'Valeur'],
			data_json=[{'Annee': '2024', 'Valeur': 10}],
			is_visible=True,
		)

	def _dummy_excel_upload(self, name='test.xlsx'):
		return SimpleUploadedFile(
			name,
			b'dummy-content',
			content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		)

	@patch('core.views._normalize_import_dataframe')
	def test_append_rejects_incompatible_columns_without_ai(self, mock_normalize):
		incoming_df = pd.DataFrame([{'Periode': '2024', 'Montant': 10}])
		mock_normalize.return_value = (incoming_df, ['mock normalize'])

		response = self.client.post(
			f'/api/sousthemes/{self.sous_theme.id}/append/',
			{
				'file': self._dummy_excel_upload('append.xlsx'),
				'use_ai': 'false',
			},
			format='multipart',
			secure=True,
		)

		self.assertEqual(response.status_code, 400)
		payload = response.json()
		self.assertIn('Colonnes incompatibles', payload.get('error', ''))
		self.assertEqual(payload.get('expected_columns'), ['Annee', 'Valeur'])
		self.assertEqual(payload.get('incoming_columns'), ['Periode', 'Montant'])

	@patch('core.views._fallback_map_rows')
	@patch('core.views._run_gemini_mapping')
	@patch('core.views._normalize_import_dataframe')
	def test_import_smart_uses_fallback_when_ai_mapping_fails(self, mock_normalize, mock_ai_map, mock_fallback):
		incoming_df = pd.DataFrame([{'Periode': '2025', 'Montant': 42}])
		mock_normalize.return_value = (incoming_df, ['mock normalize'])
		mock_ai_map.side_effect = RuntimeError('AI unavailable for test')
		mock_fallback.return_value = [{'Annee': '2025', 'Valeur': 42}]

		response = self.client.post(
			f'/api/sousthemes/{self.sous_theme.id}/import-smart/',
			{
				'file': self._dummy_excel_upload('import-smart.xlsx'),
				'free_schema': 'false',
			},
			format='multipart',
			secure=True,
		)

		self.assertEqual(response.status_code, 200)
		payload = response.json()
		self.assertEqual(payload.get('columns_order'), ['Annee', 'Valeur'])
		self.assertTrue(any('fallback heuristique' in msg for msg in payload.get('warnings', [])))
		self.assertEqual(payload.get('data'), [{'Annee': '2025', 'Valeur': 42}])


class ThemePermissionsTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.admin = CustomUser.objects.create_user(
			username='admin_perm',
			email='admin_perm@example.com',
			password='Passw0rd!Strong',
			role='ADMIN',
		)
		self.saisisseur = CustomUser.objects.create_user(
			username='saisisseur_perm',
			email='saisisseur_perm@example.com',
			password='Passw0rd!Strong',
			role='SAISISSEUR',
		)
		self.theme = Theme.objects.create(titre='Theme permissions', is_visible=True)

	def test_themes_endpoint_requires_authentication(self):
		response = self.client.get('/api/themes/', secure=True)
		self.assertEqual(response.status_code, 401)

	def test_saisisseur_cannot_create_theme(self):
		token = Token.objects.create(user=self.saisisseur)
		self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

		response = self.client.post(
			'/api/themes/enregistrer_complet/',
			{'titre': 'Nouveau theme interdit'},
			format='json',
			secure=True,
		)

		self.assertEqual(response.status_code, 403)

	def test_saisisseur_cannot_modify_theme(self):
		token = Token.objects.create(user=self.saisisseur)
		self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

		response = self.client.patch(
			f'/api/themes/{self.theme.id}/',
			{'is_visible': False},
			format='json',
			secure=True,
		)

		self.assertEqual(response.status_code, 403)


class PublicThemeVisibilityTests(TestCase):
	def setUp(self):
		self.client = APIClient()

		self.visible_theme = Theme.objects.create(
			titre='Theme public visible',
			is_visible=True,
			archived=False,
		)
		Theme.objects.create(
			titre='Theme non public',
			is_visible=False,
			archived=False,
		)
		Theme.objects.create(
			titre='Theme archive',
			is_visible=True,
			archived=True,
		)

		SousTheme.objects.create(
			nom='Sous-theme visible',
			theme=self.visible_theme,
			is_visible=True,
			archived=False,
		)
		SousTheme.objects.create(
			nom='Sous-theme cache',
			theme=self.visible_theme,
			is_visible=False,
			archived=False,
		)

	def test_public_themes_returns_only_visible_non_archived(self):
		response = self.client.get('/api/public-themes/', secure=True)
		self.assertEqual(response.status_code, 200)

		payload = response.json()
		titles = [item.get('titre') for item in payload]
		self.assertIn('Theme public visible', titles)
		self.assertNotIn('Theme non public', titles)
		self.assertNotIn('Theme archive', titles)

		visible_theme_payload = next((item for item in payload if item.get('titre') == 'Theme public visible'), None)
		self.assertIsNotNone(visible_theme_payload)
		subthemes = visible_theme_payload.get('sous_themes', [])
		sub_names = [st.get('nom') for st in subthemes]
		self.assertIn('Sous-theme visible', sub_names)
		self.assertNotIn('Sous-theme cache', sub_names)


class UserDeletionSafetyTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.admin = CustomUser.objects.create_user(
			username='admin_delete_actor',
			email='admin_delete_actor@example.com',
			password='Passw0rd!Strong',
			role='ADMIN',
		)
		self.target_user = CustomUser.objects.create_user(
			username='target_saisisseur',
			email='target_saisisseur@example.com',
			password='Passw0rd!Strong',
			role='SAISISSEUR',
		)
		self.target_admin = CustomUser.objects.create_user(
			username='target_admin',
			email='target_admin@example.com',
			password='Passw0rd!Strong',
			role='ADMIN',
		)

		token = Token.objects.create(user=self.admin)
		self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

	def test_delete_user_hard_deletes_non_admin(self):
		response = self.client.delete(f'/api/users/{self.target_user.id}/', secure=True)
		self.assertEqual(response.status_code, 204)
		self.assertFalse(CustomUser.objects.filter(id=self.target_user.id).exists())

	def test_delete_admin_is_blocked(self):
		response = self.client.delete(f'/api/users/{self.target_admin.id}/', secure=True)
		self.assertEqual(response.status_code, 400)

		self.target_admin.refresh_from_db()
		self.assertTrue(self.target_admin.is_active)
