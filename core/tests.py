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
