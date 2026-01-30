from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core.views import ThemeViewSet, SousThemeViewSet

router = DefaultRouter()
router.register(r'themes', ThemeViewSet)
router.register(r'sousthemes', SousThemeViewSet)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
]