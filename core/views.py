import pandas as pd
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Theme, SousTheme, Indicateur, Donnee, CustomUser
from .serializers import ThemeSerializer

class ThemeViewSet(viewsets.ModelViewSet):
    queryset = Theme.objects.all().order_by('id')
    serializer_class = ThemeSerializer

    @action(detail=False, methods=['post'])
    def enregistrer_complet(self, request):
        try:
            # 1. Récupération et création du Thème
            titre = request.data.get('titre')
            statut = request.data.get('statut')
            is_visible = True if statut == 'Public' else False
            
            nouveau_theme = Theme.objects.create(
                titre=titre, 
                is_visible=is_visible
            )

            # 2. Boucle pour traiter chaque ligne de sous-thème envoyée par le formulaire
            index = 0
            while f'lignes[{index}][sousTheme]' in request.data:
                nom_st = request.data.get(f'lignes[{index}][sousTheme]')
                libelle_ind = request.data.get(f'lignes[{index}][indicateur]')
                unite = request.data.get(f'lignes[{index}][unite]')
                
                # Création du Sous-Thème
                st_obj = SousTheme.objects.create(
                    nom=nom_st, 
                    theme=nouveau_theme
                )

                # Gestion du fichier Excel spécifique à ce sous-thème
                excel_file = request.FILES.get(f'lignes[{index}][file]')
                
                if excel_file:
                    # Lecture de l'Excel avec Pandas
                    df = pd.read_excel(excel_file)
                    
                    # Nettoyage des données (remplace les NaN/vides par du texte vide pour le JSON)
                    df = df.fillna("")
                    
                    # --- LA MODIFICATION MAJEURE ---
                    # On transforme tout le tableau Excel en liste de dictionnaires
                    # Cela permet de garder TOUTES les colonnes du fichier original
                    st_obj.data_json = df.to_dict(orient='records')
                    st_obj.save()

                    # On crée aussi l'indicateur lié pour garder votre structure initiale
                    ind_obj = Indicateur.objects.create(
                        libelle=libelle_ind,
                        unite=unite,
                        soustheme=st_obj
                    )
                    
                    # Optionnel : Si vous voulez quand même remplir la table 'Donnee' 
                    # pour des calculs statistiques futurs (si colonnes 'Annee' et 'Valeur' existent)
                    if 'Valeur' in df.columns:
                        for _, row in df.iterrows():
                            try:
                                Donnee.objects.create(
                                    indicateur=ind_obj,
                                    valeur=row['Valeur'],
                                    saisisseur=CustomUser.objects.filter(is_staff=True).first()
                                )
                            except:
                                pass # Ignore les lignes où la valeur n'est pas numérique

                index += 1

            return Response({
                "message": "Succès : Thème et fichiers Excel importés avec leurs structures originales !",
                "theme_id": nouveau_theme.id
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({
                "error": f"Erreur lors de l'importation : {str(e)}"
            }, status=status.HTTP_400_BAD_REQUEST)