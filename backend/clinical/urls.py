from django.urls import path

from .views import (
    DossierArchiveView,
    DossierDetailView,
    DossierListCreateView,
    NoteDetailView,
    NotesView,
    PatientOverviewView,
    RapportView,
)

urlpatterns = [
    path("dossiers/", DossierListCreateView.as_view(), name="dossiers"),
    path("dossiers/<int:pk>/", DossierDetailView.as_view(), name="dossier-detail"),
    path("dossiers/<int:pk>/archive/", DossierArchiveView.as_view(), name="dossier-archive"),
    path("dossiers/<int:pk>/notes/", NotesView.as_view(), name="dossier-notes"),
    path("notes/<int:pk>/", NoteDetailView.as_view(), name="note-detail"),
    path("patients/<int:pk>/", PatientOverviewView.as_view(), name="patient-overview"),
    path("sessions/<int:seance_id>/report/", RapportView.as_view(), name="session-report"),
]
