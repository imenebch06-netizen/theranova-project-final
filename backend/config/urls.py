from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/auth/", include("accounts.auth_urls")),
    path("api/v1/accounts/", include("accounts.urls")),
    path("api/v1/matching/", include("matching.urls")),
    path("api/v1/scheduling/", include("scheduling.urls")),
    path("api/v1/clinical/", include("clinical.urls")),
    path("api/v1/billing/", include("billing.urls")),
    path("api/v1/wellbeing/", include("wellbeing.urls")),
    path("api/v1/feedback/", include("feedback.urls")),
    path("api/v1/messaging/", include("messaging.urls")),
    path("api/v1/dashboard/", include("dashboard.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
