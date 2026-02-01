from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core.views import ThemeViewSet, SousThemeViewSet
from core.user_views import UserViewSet
from core.auth_views import login, logout, request_reset, reset_password

router = DefaultRouter()
router.register(r'themes', ThemeViewSet)
router.register(r'sousthemes', SousThemeViewSet)
router.register(r'users', UserViewSet)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api/auth/login/', login, name='login'),
    path('api/auth/logout/', logout, name='logout'),
    path('api/auth/request-reset/', request_reset, name='request_reset'),
    path('api/auth/reset-password/', reset_password, name='reset_password'),
]