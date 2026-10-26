"""
URL configuration for config project.
"""
import os
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.db import connection
from django.http import JsonResponse, FileResponse, Http404


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


def serve_media_file(request, path):
    """
    Production-ready media serving and self-healing engine.
    Serves physical media files across cloud container lifecycles (Render),
    automatically self-healing registration and customs documents from base64 or certified dynamic generation.
    """
    clean_path = path.strip('/')
    full_path = os.path.normpath(os.path.join(str(settings.MEDIA_ROOT), clean_path))

    # Path traversal protection
    media_root_norm = os.path.normpath(str(settings.MEDIA_ROOT))
    if not full_path.startswith(media_root_norm):
        raise Http404("Invalid media file path.")

    is_download = request.GET.get('download') in ['1', 'true', True]
    disp = 'attachment' if is_download else 'inline'

    # 1. If physical file exists on disk, serve it immediately
    if os.path.exists(full_path) and os.path.getsize(full_path) > 0:
        filename = os.path.basename(full_path)
        content_type = 'application/pdf' if filename.lower().endswith('.pdf') else (
            'image/png' if filename.lower().endswith('.png') else (
                'image/jpeg' if filename.lower().endswith(('.jpg', '.jpeg')) else 'application/octet-stream'
            )
        )
        response = FileResponse(open(full_path, 'rb'), content_type=content_type)
        response['Content-Disposition'] = f'{disp}; filename="{filename}"'
        response['Access-Control-Allow-Origin'] = '*'
        return response

    # 2. Self-healing for registration supporting documents
    if clean_path.startswith('registration_docs/') or 'licenses/' in clean_path or 'ids/' in clean_path:
        try:
            from authentication.registration_document_generator import resolve_registration_file_from_media_path
            resolved = resolve_registration_file_from_media_path(clean_path)
            if resolved:
                f_path, content_type, filename = resolved
                response = FileResponse(open(f_path, 'rb'), content_type=content_type)
                response['Content-Disposition'] = f'{disp}; filename="{filename}"'
                response['Access-Control-Allow-Origin'] = '*'
                return response
        except Exception:
            pass

    # 3. Self-healing for customs documents
    if clean_path.startswith('customs_docs/') or 'declarations/' in clean_path:
        try:
            from authentication.models import CustomsDocument, PreArrivalCustomsDeclaration
            from authentication.customs_document_generator import ensure_document_physical_file
            bname = os.path.basename(clean_path)
            doc = (
                CustomsDocument.objects.filter(document_file=clean_path).first()
                or CustomsDocument.objects.filter(document_file__endswith=bname).first()
            )
            if doc:
                f_path, content_type = ensure_document_physical_file(doc)
                filename = doc.document_name or os.path.basename(f_path)
                response = FileResponse(open(f_path, 'rb'), content_type=content_type)
                response['Content-Disposition'] = f'{disp}; filename="{filename}"'
                response['Access-Control-Allow-Origin'] = '*'
                return response

            decl = (
                PreArrivalCustomsDeclaration.objects.filter(declaration_document=clean_path).first()
                or PreArrivalCustomsDeclaration.objects.filter(declaration_document__endswith=bname).first()
            )
            if decl:
                f_path, content_type = ensure_document_physical_file(decl)
                filename = decl.declaration_document_name or os.path.basename(f_path)
                response = FileResponse(open(f_path, 'rb'), content_type=content_type)
                response['Content-Disposition'] = f'{disp}; filename="{filename}"'
                response['Access-Control-Allow-Origin'] = '*'
                return response
        except Exception:
            pass

    raise Http404("The requested resource was not found on this server.")


urlpatterns = [
    path('', api_root, name='api_root'),
    path('health/', health_check, name='health_root'),
    path('api/health/', health_check, name='health_check'),
    path('api/health', health_check, name='health_check_noslash'),
    path('admin/', admin.site.urls),
    path('api/auth/', include('authentication.urls')),
    path('api/', include('authentication.urls')),
    re_path(r'^media/(?P<path>.*)$', serve_media_file, name='media_serve'),
]
