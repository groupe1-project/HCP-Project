import React from 'react';
import App from './App';

export default function VisiteurPage() {
  // Le composant visiteur réutilise l'`App` en mode visiteur.
  // `App` détecte automatiquement `window.location.pathname` mais
  // on force le mode visiteur via la prop `forceVisitor` pour plus de clarté.
  return <App forceVisitor={true} />;
}
