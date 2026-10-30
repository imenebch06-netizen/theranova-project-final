from django.urls import path

from .views import (
    AvailabilityView,
    BulkSlotCreateView,
    CompleteSeanceView,
    CreneauListView,
    DemandeActionView,
    DemandeDetailView,
    DemandeListCreateView,
    JoinSeanceView,
    ParticipationRefuseView,
    PayerPartView,
    SeanceDetailView,
    SeanceListView,
    SlotActionView,
    TherapistSlotCreateView,
)

urlpatterns = [
    path("slots/", CreneauListView.as_view(), name="slots"),
    path("slots/create/", TherapistSlotCreateView.as_view(), name="slot-create"),
    path("slots/bulk/", BulkSlotCreateView.as_view(), name="slot-bulk"),
    path("slots/<int:pk>/<str:action>/", SlotActionView.as_view(), name="slot-action"),
    path("slots/<int:pk>/", SlotActionView.as_view(), name="slot-delete"),
    path("availability/<int:therapist_id>/", AvailabilityView.as_view(), name="availability"),
    path("requests/", DemandeListCreateView.as_view(), name="requests"),
    path("requests/<int:pk>/", DemandeDetailView.as_view(), name="request-detail"),
    path("requests/<int:pk>/pay/", PayerPartView.as_view(), name="request-pay"),
    path("requests/<int:pk>/refuse-part/", ParticipationRefuseView.as_view(), name="request-refuse-part"),
    path("requests/<int:pk>/<str:action>/", DemandeActionView.as_view(), name="request-action"),
    path("sessions/", SeanceListView.as_view(), name="sessions"),
    path("sessions/<int:pk>/", SeanceDetailView.as_view(), name="session-detail"),
    path("sessions/<int:pk>/join/", JoinSeanceView.as_view(), name="session-join"),
    path("sessions/<int:pk>/complete/", CompleteSeanceView.as_view(), name="session-complete"),
]
