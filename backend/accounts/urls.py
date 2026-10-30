from django.urls import path

from .views import (
    AdminTherapistListView,
    AdminUserDetailView,
    AdminUserListView,
    SpecialiteListView,
    TherapistDetailView,
    TherapistListView,
    TherapistMeView,
    TherapistModerationView,
    TherapistPatientsView,
)

urlpatterns = [
    path("specialties/", SpecialiteListView.as_view(), name="specialties"),
    path("therapists/", TherapistListView.as_view(), name="therapists"),
    path("therapists/<int:pk>/", TherapistDetailView.as_view(), name="therapist-detail"),
    path("therapist/me/", TherapistMeView.as_view(), name="therapist-me"),
    path("therapist/patients/", TherapistPatientsView.as_view(), name="therapist-patients"),
    path("admin/users/", AdminUserListView.as_view(), name="admin-users"),
    path("admin/users/<int:pk>/", AdminUserDetailView.as_view(), name="admin-user-detail"),
    path("admin/therapists/", AdminTherapistListView.as_view(), name="admin-therapists"),
    path(
        "admin/therapists/<int:pk>/<str:action>/",
        TherapistModerationView.as_view(),
        name="admin-therapist-moderation",
    ),
]
