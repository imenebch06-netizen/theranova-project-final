from django.urls import path

from .views import (
    LatestRecommendationView,
    QuestionnaireHistoryView,
    QuestionnaireView,
    RecommendationDetailView,
    SubmitQuestionnaireView,
)

urlpatterns = [
    path("questionnaire/", QuestionnaireView.as_view(), name="questionnaire"),
    path("questionnaire/submit/", SubmitQuestionnaireView.as_view(), name="questionnaire-submit"),
    path("recommendations/latest/", LatestRecommendationView.as_view(), name="recommendation-latest"),
    path("recommendations/<int:pk>/", RecommendationDetailView.as_view(), name="recommendation-detail"),
    path("history/", QuestionnaireHistoryView.as_view(), name="questionnaire-history"),
]
