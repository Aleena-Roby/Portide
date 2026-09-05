"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.db import connection
from django.http import JsonResponse

def api_root(request):
    return JsonResponse({
        "status": "online",
        "name": "PortIDE Maritime Port Operations Intelligence Platform API",
        "frontend_url": "http://localhost:3000",
        "admin_url": "http://localhost:8000/admin/",
        "endpoints": {
            "auth": "http://localhost:8000/api/auth/",
            "api": "http://localhost:8000/api/",
            "health": "http://localhost:8000/api/health/"
        }
    })

def health_check(request):
    db_status = "connected"
    try:
        connection.ensure_connection()
    except Exception:
        db_status = "unavailable"
    
    return JsonResponse({
        "status": "ok",
        "database": db_status
    })


urlpatterns = [
    path('', api_root, name='api_root'),
    path('health/', health_check, name='health_root'),
    path('api/health/', health_check, name='health_check'),
    path('api/health', health_check, name='health_check_noslash'),
    path('admin/', admin.site.urls),
    path('api/auth/', include('authentication.urls')),
    path('api/', include('authentication.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)


