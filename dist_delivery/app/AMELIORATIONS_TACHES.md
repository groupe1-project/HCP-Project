# Améliorations de la Table des Tâches Affectées

## 1. Modifications Backend (Django)

### A. Modifier `core/models.py`

Dans la classe `UserThemeAssignment` (ligne ~100), ajouter après `date_modification` :

```python
date_completion = models.DateTimeField(null=True, blank=True, help_text="Date de complétion de la tâche")
notes = models.TextField(null=True, blank=True, help_text="Notes ou commentaires sur la tâche")
progression = models.IntegerField(default=0, help_text="Pourcentage de progression (0-100)")
priorite = models.CharField(max_length=20, default='Normale', choices=[
    ('Basse', 'Basse'),
    ('Normale', 'Normale'),
    ('Haute', 'Haute'),
])
```

### B. Modifier `core/serializers.py`

Dans `UserThemeAssignmentSerializer`, ligne ~92, remplacer la liste des fields par :

```python
fields = [
    'id', 'user', 'user_name', 'user_email', 'user_role', 'user_is_active',
    'theme', 'theme_titre', 'sous_theme', 'sous_theme_nom',
    'indicateur', 'indicateur_libelle', 'statut',
    'date_assignation', 'date_modification', 'date_completion',
    'notes', 'progression', 'priorite'
]
```

### C. Créer la migration

```bash
cd C:\Users\pc\Desktop\PROJET_DATA
python manage.py makemigrations
python manage.py migrate
```

## 2. Modifications Frontend (React)

### A. Nouvelles colonnes dans la table

Remplacer les colonnes actuelles (ligne ~731) par :

```jsx
<thead className="bg-[#4a77b4] text-white border-b-2 border-black">
  <tr>
    <th className="px-6 py-3 text-left text-sm font-bold">Utilisateur</th>
    <th className="px-6 py-3 text-left text-sm font-bold">Tâche</th>
    <th className="px-6 py-3 text-left text-sm font-bold">Priorité</th>
    <th className="px-6 py-3 text-left text-sm font-bold">Progression</th>
    <th className="px-6 py-3 text-left text-sm font-bold">Date début</th>
    <th className="px-6 py-3 text-left text-sm font-bold">Date fin</th>
    <th className="px-6 py-3 text-left text-sm font-bold">Statut</th>
    <th className="px-6 py-3 text-left text-sm font-bold">Actions</th>
  </tr>
</thead>
```

### B. Afficher les nouvelles données

Dans le tbody, remplacer le mapping des assignments pour inclure :

```jsx
<td className="px-6 py-3">
  <span className={`px-2 py-1 rounded text-xs font-bold ${
    assignment.priorite === 'Haute' ? 'bg-red-100 text-red-800' :
    assignment.priorite === 'Basse' ? 'bg-gray-100 text-gray-600' :
    'bg-blue-100 text-blue-800'
  }`}>
    {assignment.priorite || 'Normale'}
  </span>
</td>

<td className="px-6 py-3">
  <div className="flex items-center gap-2">
    <div className="flex-1 bg-gray-200 rounded-full h-2">
      <div 
        className="bg-green-500 h-2 rounded-full transition-all" 
        style={{ width: `${assignment.progression || 0}%` }}
      ></div>
    </div>
    <span className="text-xs font-bold">{assignment.progression || 0}%</span>
  </div>
</td>

<td className="px-6 py-3 text-gray-700">{formatAssignmentDate(assignment.date_assignation)}</td>
<td className="px-6 py-3 text-gray-700">{formatAssignmentDate(assignment.date_completion)}</td>
```

### C. Ajouter des actions supplémentaires

Dans le menu d'actions (kebab), ajouter :

```jsx
<button
  onClick={() => {
    // Ouvrir modal pour modifier progression/notes
    setOpenMenuId(null);
  }}
  className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 text-sm border-t"
>
  📝 Modifier progression
</button>

<button
  onClick={() => {
    // Marquer comme terminé
    setOpenMenuId(null);
  }}
  className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 text-sm border-t"
>
  ✅ Marquer terminé
</button>
```

## 3. Fonctionnalités futures à implémenter

### A. Modal de modification de progression
- Champ pourcentage (0-100)
- Zone de texte pour notes
- Bouton "Mettre à jour"

### B. Marquage automatique de complétion
- Quand progression = 100%, mettre statut = "Complété"
- Remplir automatiquement date_completion

### C. Filtres et recherche
- Filtrer par priorité
- Filtrer par statut
- Filtrer par utilisateur
- Recherche par tâche

### D. Statistiques
- Nombre de tâches en cours
- Tâches complétées ce mois
- Taux de complétion moyen
- Tâches en retard

### E. Notifications
- Alertes pour tâches haute priorité
- Rappels pour tâches non commencées
- Email quand tâche complétée

## 4. Ordre d'implémentation recommandé

1. ✅ Ajouter les champs au modèle
2. ✅ Créer la migration
3. ✅ Exposer les champs dans le serializer
4. ✅ Afficher les colonnes dans le tableau
5. 🔄 Créer modal de modification
6. 🔄 Fonctions de mise à jour
7. 🔄 Filtres et recherche
8. 🔄 Statistiques dashboard
9. 🔄 Système de notifications
