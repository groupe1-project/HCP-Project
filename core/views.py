import logging
import uuid
import pandas as pd
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Theme, Categorie, SousTheme, Indicateur, Donnee, CustomUser
from .serializers import ThemeSerializer, CategorieSerializer, SousThemeSerializer

logger = logging.getLogger(__name__)

class CategorieViewSet(viewsets.ModelViewSet):
    queryset = Categorie.objects.all().order_by('id')
    serializer_class = CategorieSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['post'], url_path='toggle-visibility')
    def toggle_visibility(self, request, pk=None):
        """Toggle la visibilité d'une catégorie et cascade aux sous-thèmes."""
        categorie = self.get_object()
        new_visibility = request.data.get('is_visible', not categorie.is_visible)
        categorie.is_visible = new_visibility
        categorie.save()
        # Cascade to all sous-thèmes in this category
        categorie.sous_themes.all().update(is_visible=new_visibility)
        return Response({'id': categorie.id, 'is_visible': categorie.is_visible}, status=status.HTTP_200_OK)

class SousThemeViewSet(viewsets.ModelViewSet):
    queryset = SousTheme.objects.all().order_by('id')
    serializer_class = SousThemeSerializer
    permission_classes = [IsAuthenticated]

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

    @action(detail=True, methods=['post'], url_path='import')
    def import_table(self, request, pk=None):
        """Importe un fichier Excel et remplace les données du sous-thème."""
        st = self.get_object()
        excel_file = request.FILES.get('file')
        if not excel_file:
            return Response({'error': 'Aucun fichier fourni'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            df = pd.read_excel(excel_file)
            df = df.fillna("")
            st.data_json = df.to_dict(orient='records')
            st.save()
            return Response({'message': 'Import réussi', 'data': st.data_json}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception('Erreur import excel')
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ThemeViewSet(viewsets.ModelViewSet):
    queryset = Theme.objects.all().order_by('id')
    serializer_class = ThemeSerializer
    permission_classes = [IsAuthenticated]

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

            # 1.5. Si des catégories sont spécifiées, les créer
            use_categories = request.data.get('use_categories') == 'true'
            categories_created = []
            if use_categories:
                cat_index = 0
                while f'categories[{cat_index}][nom]' in request.data:
                    cat_nom = request.data.get(f'categories[{cat_index}][nom]')
                    cat_ordre = request.data.get(f'categories[{cat_index}][ordre]', cat_index)
                    if cat_nom and cat_nom.strip():
                        cat_obj = Categorie.objects.create(
                            nom=cat_nom,
                            theme=nouveau_theme,
                            ordre=int(cat_ordre)
                        )
                        categories_created.append(cat_obj)
                    cat_index += 1

            # 2. Boucle pour traiter chaque ligne de sous-thème envoyée par le formulaire
            index = 0
            while f'lignes[{index}][sousTheme]' in request.data:
                nom_st = request.data.get(f'lignes[{index}][sousTheme]')
                libelle_ind = request.data.get(f'lignes[{index}][indicateur]')
                unite = request.data.get(f'lignes[{index}][unite]')
                definition = request.data.get(f'lignes[{index}][definition]', '')
                source = request.data.get(f'lignes[{index}][source]', '')
                periodicite = request.data.get(f'lignes[{index}][periodicite]', '')
                
                # Déterminer la catégorie si elle est spécifiée
                categorie_obj = None
                if use_categories and f'lignes[{index}][categorieIndex]' in request.data:
                    cat_idx = int(request.data.get(f'lignes[{index}][categorieIndex]'))
                    if cat_idx < len(categories_created):
                        categorie_obj = categories_created[cat_idx]
                
                # Création du Sous-Thème avec les métadonnées pré-remplies
                st_obj = SousTheme.objects.create(
                    nom=nom_st, 
                    theme=nouveau_theme,
                    categorie=categorie_obj,
                    indication_text=libelle_ind or '',
                    unite_text=unite or '',
                    definition_text=definition or '',
                    source_text=source or '',
                    periodicite_text=periodicite or ''
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

    @action(detail=True, methods=['post'], url_path='archive')
    def archive(self, request, pk=None):
        """Marque un thème comme archivé et archive tous ses sous-thèmes."""
        try:
            theme = self.get_object()
            theme.archived = True
            theme.save()
            # Archive tous les sous-thèmes de ce thème
            theme.sous_themes.all().update(archived=True)
            return Response({'message': 'Thème et ses sous-thèmes archivés'}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='unarchive')
    def unarchive(self, request, pk=None):
        """Retire la marque d'archivage d'un thème et désarchive tous ses sous-thèmes."""
        try:
            theme = self.get_object()
            theme.archived = False
            theme.save()
            # Désarchive tous les sous-thèmes de ce thème
            theme.sous_themes.all().update(archived=False)
            return Response({'message': 'Thème et ses sous-thèmes désarchivés'}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='sous_themes')
    def add_sous_theme(self, request, pk=None):
        """Ajoute un sous-thème au thème courant."""
        try:
            theme = self.get_object()
            nom = request.data.get('nom') or request.data.get('name')
            if not nom:
                return Response({'error': 'Le nom du sous-thème est requis'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Récupérer l'ID de la catégorie si fourni
            categorie_id = request.data.get('categorie')
            categorie_obj = None
            if categorie_id:
                try:
                    categorie_obj = Categorie.objects.get(id=categorie_id, theme=theme)
                except Categorie.DoesNotExist:
                    return Response({'error': 'Catégorie non trouvée'}, status=status.HTTP_400_BAD_REQUEST)
            
            st = SousTheme.objects.create(nom=nom, theme=theme, categorie=categorie_obj)
            serializer = SousThemeSerializer(st)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.exception('Erreur ajout sous-theme')
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='toggle_visibility')
    def toggle_visibility(self, request, pk=None):
        """Bascule le statut de publication (is_visible) du thème."""
        try:
            theme = self.get_object()
            # si l'appel fournit la valeur, l'utiliser, sinon inverser
            val = request.data.get('is_visible')
            if val is None:
                theme.is_visible = not theme.is_visible
            else:
                theme.is_visible = bool(val)
            theme.save()
            return Response({'id': theme.id, 'is_visible': theme.is_visible}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception('Erreur toggle visibility')
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)