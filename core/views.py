import logging
import uuid
import pandas as pd
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Theme, SousTheme, Indicateur, Donnee, CustomUser
from .serializers import ThemeSerializer, SousThemeSerializer

logger = logging.getLogger(__name__)

class SousThemeViewSet(viewsets.ModelViewSet):
    queryset = SousTheme.objects.all().order_by('id')
    serializer_class = SousThemeSerializer

    @action(detail=True, methods=['get', 'post'], url_path='charts')
    def charts(self, request, pk=None):
        """
        GET: retourne la liste des charts configurés pour ce sous-thème.
        POST: ajoute un nouveau chart à la configuration et le sauvegarde.
        """
        st = self.get_object()
        if request.method == 'GET':
            return Response(st.charts_config or [], status=status.HTTP_200_OK)

        data = request.data
        new_chart = {
            'id': str(uuid.uuid4()),
            'type': data.get('type', 'Histogramme'),
            'x': data.get('x', ''),
            'y': data.get('y', ''),
            'mesure': data.get('mesure', ''),
        }
        config = st.charts_config or []
        config.append(new_chart)
        st.charts_config = config
        st.save()
        return Response(new_chart, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['put', 'delete'], url_path='charts/(?P<chart_id>[^/.]+)')
    def charts_detail(self, request, pk=None, chart_id=None):
        st = self.get_object()
        config = st.charts_config or []
        for i, ch in enumerate(config):
            if ch.get('id') == chart_id:
                if request.method == 'DELETE':
                    config.pop(i)
                    st.charts_config = config
                    st.save()
                    return Response({'message': 'Supprimé'}, status=status.HTTP_200_OK)
                else:
                    data = request.data
                    ch['type'] = data.get('type', ch.get('type'))
                    ch['x'] = data.get('x', ch.get('x'))
                    ch['y'] = data.get('y', ch.get('y'))
                    ch['mesure'] = data.get('mesure', ch.get('mesure'))
                    config[i] = ch
                    st.charts_config = config
                    st.save()
                    return Response(ch, status=status.HTTP_200_OK)
        return Response({'error': 'Chart non trouvé'}, status=status.HTTP_404_NOT_FOUND)


class ThemeViewSet(viewsets.ModelViewSet):
    queryset = Theme.objects.all().order_by('id')
    serializer_class = ThemeSerializer

    @action(detail=False, methods=['post'])
    def enregistrer_complet(self, request):
        try:
            # 1. Récupération et création du Thème
            titre = request.data.get('titre')
            # Acceptation tolérante du statut (insensible à la casse et aux espaces)
            statut_raw = request.data.get('statut', '')
            statut_clean = str(statut_raw).strip().lower()
            is_visible = True if (statut_clean == 'public' or 'public' in statut_clean) else False
            
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

            serializer = ThemeSerializer(nouveau_theme)
            return Response({
                "message": "Succès : Thème et fichiers Excel importés avec leurs structures originales !",
                "theme": serializer.data
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({
                "error": f"Erreur lors de l'importation : {str(e)}"
            }, status=status.HTTP_400_BAD_REQUEST)