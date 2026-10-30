from django.urls import path

from .views import InsightsView, MoodListCreateView, MoodPatientView, MoodStatsView, MoodTodayView, MoodUpsertView

urlpatterns = [
    path("mood/", MoodListCreateView.as_view(), name="mood-list"),
    path("mood/today/", MoodTodayView.as_view(), name="mood-today"),
    path("mood/save/", MoodUpsertView.as_view(), name="mood-save"),
    path("mood/stats/", MoodStatsView.as_view(), name="mood-stats"),
    path("mood/patient/<int:patient_id>/", MoodPatientView.as_view(), name="mood-patient"),
    path("insights/", InsightsView.as_view(), name="insights"),
]
