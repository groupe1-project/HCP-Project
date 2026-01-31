import React, { useState } from 'react';
import axios from 'axios';

function LoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await axios.post('http://127.0.0.1:8000/api/auth/login/', {
        email,
        password,
      });

      if (res.data.token) {
        // Sauvegarde le token et les infos utilisateur
        localStorage.setItem('auth_token', res.data.token);
        localStorage.setItem('user_id', res.data.user_id);
        localStorage.setItem('username', res.data.username);
        localStorage.setItem('user_email', res.data.email);
        localStorage.setItem('user_role', res.data.role);

        // Configure axios pour les appels futurs
        axios.defaults.headers.common['Authorization'] = `Token ${res.data.token}`;

        onLoginSuccess();
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Erreur de connexion';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-[#1a5d85] to-[#4a77b4] justify-center items-center p-4">
      <div className="bg-white border-4 border-black p-8 rounded-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-md">
        <div className="flex justify-center mb-6">
          <img src="src/photos.png" alt="Logo HCP" className="w-20" />
        </div>
        
        <h1 className="text-2xl font-bold text-center text-[#1a5d85] mb-2">
          Espace Administrateur
        </h1>
        <p className="text-center text-gray-600 text-sm mb-6">
          Base de Données - Région Béni Mellal-Khénifra
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block font-bold text-[#1a5d85] mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-full p-3 border-2 border-black rounded-lg outline-none focus:bg-blue-50"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block font-bold text-[#1a5d85] mb-2">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full p-3 border-2 border-black rounded-lg outline-none focus:bg-blue-50"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="bg-red-100 border-2 border-red-500 text-red-800 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1a5d85] text-white font-bold py-3 rounded-lg border-2 border-black shadow-md hover:bg-[#0f3d5a] transition-colors disabled:opacity-50"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500 mt-6">
          Interface réservée aux administrateurs
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
