import React, { useState } from 'react';
import axios from 'axios';
import logoSmall from './Image2.png';
import logoMain from './Image3.png';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
const AUTH_SESSION_KEYS = [
  'auth_token',
  'user_id',
  'username',
  'first_name',
  'user_email',
  'user_role',
  'auth_token_admin',
  'user_id_admin',
  'username_admin',
  'first_name_admin',
  'user_email_admin',
  'user_role_admin',
  'auth_token_saisisseur',
  'user_id_saisisseur',
  'username_saisisseur',
  'first_name_saisisseur',
  'user_email_saisisseur',
  'user_role_saisisseur',
  'auth_context',
];

const setAuthItem = (key, value) => {
  try { sessionStorage.setItem(key, String(value ?? '')); } catch { /* ignore storage errors */ }
  // Clean old shared auth data so a different tab/window does not inherit it.
  if (AUTH_SESSION_KEYS.includes(key)) {
    try { localStorage.removeItem(key); } catch { /* ignore storage errors */ }
  }
};

function LoginPage({ onLoginSuccess, loginMode = 'admin' }) {
  const isSaisisseurMode = loginMode === 'saisisseur';
  const modeTitle = isSaisisseurMode ? 'Espace Saisisseur' : 'Espace Administrateur';
  const modeHint = isSaisisseurMode
    ? 'Connectez-vous pour gérer vos saisies et vos brouillons en cours.'
    : '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPasswordForm, setShowNewPasswordForm] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/auth/login/`, {
        email,
        password,
      });

      if (res.data.token) {
        // Sauvegarde le token et les infos utilisateur (isolées par onglet)
        if (loginMode === 'saisisseur') {
          setAuthItem('auth_token_saisisseur', res.data.token);
          setAuthItem('user_id_saisisseur', res.data.user_id);
          setAuthItem('username_saisisseur', res.data.username);
          setAuthItem('first_name_saisisseur', res.data.first_name || '');
          setAuthItem('user_email_saisisseur', res.data.email);
          setAuthItem('user_role_saisisseur', res.data.role);
        } else if (loginMode === 'admin') {
          setAuthItem('auth_token_admin', res.data.token);
          setAuthItem('user_id_admin', res.data.user_id);
          setAuthItem('username_admin', res.data.username);
          setAuthItem('first_name_admin', res.data.first_name || '');
          setAuthItem('user_email_admin', res.data.email);
          setAuthItem('user_role_admin', res.data.role);
        } else {
          setAuthItem('auth_token', res.data.token);
          setAuthItem('user_id', res.data.user_id);
          setAuthItem('username', res.data.username);
          setAuthItem('first_name', res.data.first_name || '');
          setAuthItem('user_email', res.data.email);
          setAuthItem('user_role', res.data.role);
        }

        // Configure axios pour les appels futurs avec le token courant
        axios.defaults.headers.common['Authorization'] = `Token ${res.data.token}`;

        // Remember which auth context we used
        setAuthItem('auth_context', loginMode);

        // If this is a saisisseur login flow, redirect to the saisisseur path
        if (loginMode === 'saisisseur' && res.data.role === 'SAISISSEUR') {
          try {
            // persist active menu for saisisseur
            localStorage.setItem('activeMenu', 'Saisisseur');
          } catch { /* ignore storage errors */ }
          window.location.href = '/saisisseur/dashboard';
          return;
        }

          // If this is an admin login flow, keep the user on /admin and persist menu
          if (loginMode === 'admin' && res.data.role === 'ADMIN') {
            try { localStorage.setItem('activeMenu', 'Admin'); } catch { /* ignore storage errors */ }
            window.location.href = '/admin/dashboard';
            return;
          }

          onLoginSuccess();
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.response?.data?.detail || err.response?.data?.message || 'Erreur de connexion';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setResetMessage('');
    setLoading(true);

    try {
      await axios.post(`${API_BASE}/auth/request-reset/`, {
        email: resetEmail,
      });
      setResetMessage('Si cet email existe, un code de réinitialisation a été envoyé. Vérifiez votre boite mail.');
      setResetToken('');
      setShowNewPasswordForm(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la demande de réinitialisation');
    } finally {
      setLoading(false);
    }
  };

  const handleSetNewPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    if (newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await axios.post(`${API_BASE}/auth/reset-password/`, {
        email: resetEmail,
        token: resetToken,
        new_password: newPassword,
      });
      setResetMessage('Mot de passe réinitialisé avec succès !');
      setTimeout(() => {
        setShowResetPassword(false);
        setShowNewPasswordForm(false);
        setResetEmail('');
        setResetToken('');
        setNewPassword('');
        setConfirmPassword('');
        setResetMessage('');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la réinitialisation');
    } finally {
      setLoading(false);
    }
  };

  if (showResetPassword) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white p-4">

        <div className="relative w-full max-w-md rounded-3xl border border-[#dfd1bc] bg-[#fdf8ef] p-8 shadow-[0_24px_60px_rgba(68,51,35,0.16)] backdrop-blur-sm">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl border border-[#e2d4bf] bg-[#fdf8ef] p-2">
                <img src={logoMain} alt="Logo HCP" className="h-full w-full object-contain" />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowResetPassword(false)}
              className="rounded-lg border border-[#d8c8b1] bg-white px-3 py-1.5 text-xs font-semibold text-[#645443] hover:bg-[#f9f3e9]"
            >
              Retour
            </button>
          </div>

          <h1 className="text-2xl font-extrabold text-[#4f3f2f] mb-2">
            {showNewPasswordForm ? 'Nouveau mot de passe' : 'Mot de passe oublié'}
          </h1>
          <p className="text-sm text-[#766652] mb-6">
            {showNewPasswordForm ? 'Entrez le code et votre nouveau mot de passe' : 'Entrez votre email pour réinitialiser'}
          </p>

          {!showNewPasswordForm ? (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.1em] text-[#7a6854]">Email</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full rounded-xl border border-[#d9c9b1] bg-white px-4 py-3 text-sm text-[#4f3f2f] outline-none transition focus:border-[#a78962] focus:ring-2 focus:ring-[#f0e4d2]"
                  required
                  disabled={loading}
                />
              </div>

              {resetMessage && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {resetMessage}
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl border border-[#8c1f60] bg-[#7A0A4A] py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5E0738] disabled:opacity-50"
              >
                {loading ? 'Envoi...' : 'Demander la réinitialisation'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSetNewPassword} className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.1em] text-[#7a6854]">Code de réinitialisation</label>
                <input
                  type="text"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="Entrez le code reçu"
                  className="w-full rounded-xl border border-[#d9c9b1] bg-white px-4 py-3 text-sm text-[#4f3f2f] outline-none transition focus:border-[#a78962] focus:ring-2 focus:ring-[#f0e4d2]"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.1em] text-[#7a6854]">Nouveau mot de passe</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-[#d9c9b1] bg-white px-4 py-3 text-sm text-[#4f3f2f] outline-none transition focus:border-[#a78962] focus:ring-2 focus:ring-[#f0e4d2]"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.1em] text-[#7a6854]">Confirmer le mot de passe</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-[#d9c9b1] bg-white px-4 py-3 text-sm text-[#4f3f2f] outline-none transition focus:border-[#a78962] focus:ring-2 focus:ring-[#f0e4d2]"
                  required
                  disabled={loading}
                />
              </div>

              {resetMessage && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {resetMessage}
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl border border-[#8c1f60] bg-[#7A0A4A] py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5E0738] disabled:opacity-50"
              >
                {loading ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowResetPassword(false);
                  setShowNewPasswordForm(false);
                  setResetEmail('');
                  setResetToken('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="w-full rounded-xl border border-[#d8c8b1] bg-white py-3 text-sm font-semibold text-[#645443] transition hover:bg-[#f9f3e9]"
              >
                Retour à la connexion
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white p-4">

      <div className="relative w-full max-w-5xl overflow-hidden rounded-3xl border border-[#dfd1bc] bg-[#fdf8ef] shadow-[0_28px_70px_rgba(68,51,35,0.18)] backdrop-blur-sm">
        <div className="grid md:grid-cols-[1.1fr_1fr]">
          <section className="relative overflow-hidden bg-gradient-to-br from-[#efe2cd] via-[#e3d0b0] to-[#d4b88d] p-8 text-[#4f3f2f] md:p-10">
            <div className="absolute -right-10 top-8 h-36 w-36 rounded-full border border-[#9e845f]/35" />
            <div className="absolute -left-14 bottom-6 h-40 w-40 rounded-full border border-[#9e845f]/25" />

            <div className="relative z-10">
              <div className="mb-8 flex justify-center">
                <img src={logoMain} alt="Logo HCP" className="h-36 w-auto object-contain md:h-44" />
              </div>

              <h1 className="text-center text-2xl font-extrabold leading-tight md:text-3xl">{modeTitle}</h1>
              {modeHint && <p className="mt-3 max-w-md text-sm text-[#6f5b3d] md:text-base">{modeHint}</p>}

              <div className="mt-8 rounded-2xl border border-[#e3d6c2] bg-[#fdf8ef] p-4 text-sm text-[#6a5539]">
                Base de Donnees Regionale - Beni Mellal-Khenifra
              </div>
            </div>
          </section>

          <section className="p-8 md:p-10">
            <div className="mb-6 flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl border border-[#e2d4bf] bg-[#fdf8ef] p-2">
                <img src={logoMain} alt="Logo HCP" className="h-full w-full object-contain" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-[#4f3f2f]">Connexion</h2>
                <p className="text-xs text-[#7b6a56]">Identification requise</p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.1em] text-[#7a6854]">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full rounded-xl border border-[#d9c9b1] bg-white px-4 py-3 text-sm text-[#4f3f2f] outline-none transition focus:border-[#a78962] focus:ring-2 focus:ring-[#f0e4d2]"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.1em] text-[#7a6854]">Mot de passe</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-[#d9c9b1] bg-white px-4 py-3 text-sm text-[#4f3f2f] outline-none transition focus:border-[#a78962] focus:ring-2 focus:ring-[#f0e4d2]"
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl border border-[#8c1f60] bg-[#7A0A4A] py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5E0738] disabled:opacity-50"
              >
                {loading ? 'Connexion...' : 'Se connecter'}
              </button>

              <button
                type="button"
                onClick={() => setShowResetPassword(true)}
                className="w-full rounded-xl border border-[#d8c8b1] bg-white py-2.5 text-sm font-semibold text-[#645443] transition hover:bg-[#f9f3e9]"
              >
                Mot de passe oublié ?
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-[#7d6d58]">
              {isSaisisseurMode ? 'Interface de connexion pour les saisisseurs' : 'Interface reservee aux administrateurs'}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
