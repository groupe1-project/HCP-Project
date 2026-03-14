from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core.views import (
    ThemeViewSet, CategorieViewSet, SousThemeViewSet,
    UserThemeAssignmentViewSet, UserRequestViewSet,
    PublicThemeViewSet, PublicSousThemeViewSet, InfoBannerView, SiteContentView
)
from core.user_views import UserViewSet
from core.auth_views import login, logout, request_reset, reset_password

router = DefaultRouter()
router.register(r'themes', ThemeViewSet)
router.register(r'categories', CategorieViewSet)
router.register(r'sousthemes', SousThemeViewSet)
router.register(r'public-themes', PublicThemeViewSet, basename='public-theme')
router.register(r'public-sousthemes', PublicSousThemeViewSet, basename='public-soustheme')
router.register(r'users', UserViewSet)
router.register(r'user-theme-assignments', UserThemeAssignmentViewSet)
router.register(r'user-requests', UserRequestViewSet)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api/auth/login/', login, name='login'),
    path('api/auth/logout/', logout, name='logout'),
    path('api/auth/request-reset/', request_reset, name='request_reset'),
    path('api/auth/reset-password/', reset_password, name='reset_password'),
    path('api/info-banner/', InfoBannerView.as_view(), name='info-banner'),
    path('api/site-content/', SiteContentView.as_view(), name='site-content'),
]