from django.urls import path

from .views import AdminDashboardView, PatientDashboardView, TherapistDashboardView

urlpatterns = [
    path("admin/", AdminDashboardView.as_view(), name="admin-dashboard"),
    path("therapist/", TherapistDashboardView.as_view(), name="therapist-dashboard"),
    path("patient/", PatientDashboardView.as_view(), name="patient-dashboard"),
]
