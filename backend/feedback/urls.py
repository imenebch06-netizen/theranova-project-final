from django.urls import path

from .views import (
    MyReviewsView,
    PublicReviewListView,
    ReclamationDetailView,
    ReclamationListCreateView,
    ReclamationRespondView,
    ReportListCreateView,
    ReportRespondView,
    ReviewCreateView,
    TherapistReviewSummaryView,
)

urlpatterns = [
    path("reviews/", PublicReviewListView.as_view(), name="reviews"),
    path("reviews/me/", MyReviewsView.as_view(), name="my-reviews"),
    path("reviews/create/", ReviewCreateView.as_view(), name="review-create"),
    path("reviews/<int:pk>/", ReviewCreateView.as_view(), name="review-delete"),
    path("reviews/therapist/<int:pk>/", TherapistReviewSummaryView.as_view(), name="review-summary"),
    path("complaints/", ReclamationListCreateView.as_view(), name="complaints"),
    path("complaints/<int:pk>/", ReclamationDetailView.as_view(), name="complaint-detail"),
    path("complaints/<int:pk>/respond/", ReclamationRespondView.as_view(), name="complaint-respond"),
    path("reports/", ReportListCreateView.as_view(), name="reports"),
    path("reports/<int:pk>/respond/", ReportRespondView.as_view(), name="report-respond"),
]
