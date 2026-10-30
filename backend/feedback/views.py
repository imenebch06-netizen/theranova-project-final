from django.db.models import Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import TherapistProfile, User
from core.permissions import IsAdmin, IsPatient
from core.utils import log_action, notify
from scheduling.models import Seance

from .models import Avis, Reclamation, Report
from .serializers import (
    AvisCreateSerializer,
    AvisSerializer,
    ReclamationCreateSerializer,
    ReclamationResponseSerializer,
    ReclamationSerializer,
    ReportResponseSerializer,
    ReportSerializer,
)


class PublicReviewListView(ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = AvisSerializer

    def get_queryset(self):
        qs = Avis.objects.filter(visible=True).select_related("patient", "therapeute")
        therapist_user = self.request.query_params.get("therapeute")
        if therapist_user:
            qs = qs.filter(therapeute_id=therapist_user)
        return qs


class TherapistReviewSummaryView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        therapist = get_object_or_404(TherapistProfile, pk=pk)
        reviews = Avis.objects.filter(therapeute=therapist.user, visible=True)
        distribution = {
            note: reviews.filter(note=note).count() for note in range(5, 0, -1)
        }
        return Response({
            "therapeute": {"id": therapist.id, "nom": therapist.nom_complet},
            "note_globale": float(therapist.note_globale),
            "nombre_avis": therapist.nombre_avis,
            "distribution": [{"note": key, "count": value} for key, value in distribution.items()],
            "avis": AvisSerializer(reviews.select_related("patient")[:8], many=True).data,
        })


class MyReviewsView(ListAPIView):
    permission_classes = [IsPatient]
    serializer_class = AvisSerializer

    def get_queryset(self):
        return Avis.objects.filter(patient=self.request.user).select_related("therapeute")


class ReviewCreateView(APIView):
    permission_classes = [IsPatient]

    def post(self, request):
        serializer = AvisCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        therapist_user = get_object_or_404(
            User, pk=data["therapeute_id"], role=User.Role.THERAPIST
        )
        seance = None
        if data.get("seance_id"):
            seance = get_object_or_404(
                Seance, pk=data["seance_id"], patient=request.user, therapeute__user=therapist_user
            )
        has_completed = Seance.objects.filter(
            patient=request.user, therapeute__user=therapist_user, statut=Seance.Statut.TERMINEE
        ).exists()
        existing = Avis.objects.filter(patient=request.user, therapeute=therapist_user).first()
        if not has_completed and not existing:
            raise ValidationError({
                "detail": "Vous pourrez laisser un avis après votre première séance terminée avec ce praticien."
            })

        review, created = Avis.objects.update_or_create(
            patient=request.user,
            therapeute=therapist_user,
            defaults={
                "note": data["note"],
                "commentaire": data.get("commentaire", ""),
                "seance": seance or (existing.seance if existing else None),
            },
        )
        log_action(request, "create" if created else "update", "avis", {"avis": review.id})
        return Response(
            AvisSerializer(review).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request, pk):
        review = get_object_or_404(Avis, pk=pk, patient=request.user)
        therapist = review.therapeute
        review.delete()
        profile = getattr(therapist, "therapist_profile", None)
        if profile:
            profile.recalculer_note()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ReclamationListCreateView(ListAPIView):
    serializer_class = ReclamationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Reclamation.objects.select_related("patient", "therapeute", "traite_par")
        if user.role == User.Role.PATIENT:
            qs = qs.filter(patient=user)
        elif user.role == User.Role.THERAPIST:
            qs = qs.filter(therapeute=user.therapist_profile)
        params = self.request.query_params
        if params.get("statut"):
            qs = qs.filter(statut=params["statut"])
        if params.get("priorite"):
            qs = qs.filter(priorite=params["priorite"])
        if params.get("categorie"):
            qs = qs.filter(categorie__icontains=params["categorie"])
        return qs

    def post(self, request):
        if request.user.role != User.Role.PATIENT:
            raise PermissionDenied("Seuls les patients peuvent soumettre une réclamation.")
        serializer = ReclamationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reclamation = serializer.save(patient=request.user)
        log_action(request, "create", "reclamations", {"reclamation": reclamation.id})
        return Response(
            ReclamationSerializer(reclamation).data,
            status=status.HTTP_201_CREATED,
        )


class ReclamationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        reclamation = get_object_or_404(
            Reclamation.objects.select_related("patient", "therapeute", "traite_par"), pk=pk
        )
        user = request.user
        allowed = (
            user.role == User.Role.ADMIN
            or reclamation.patient_id == user.id
            or (user.role == User.Role.THERAPIST and reclamation.therapeute
                and reclamation.therapeute.user_id == user.id)
        )
        if not allowed:
            raise PermissionDenied("Cette réclamation ne vous concerne pas.")
        return Response(ReclamationSerializer(reclamation).data)


class ReclamationRespondView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        reclamation = get_object_or_404(Reclamation, pk=pk)
        serializer = ReclamationResponseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        reclamation.reponse = data["reponse"]
        reclamation.statut = data["statut"]
        if data.get("priorite"):
            reclamation.priorite = data["priorite"]
        reclamation.traite_par = request.user
        if data["statut"] in (Reclamation.Statut.RESOLUE, Reclamation.Statut.REJETEE):
            reclamation.date_resolution = timezone.now()
        reclamation.save()
        notify(
            reclamation.patient,
            "Réponse à votre réclamation",
            f"Votre réclamation « {reclamation.categorie} » a été traitée : {data['reponse']}",
            type_="message",
            send_email=True,
        )
        log_action(request, "moderation", "reclamations", {"reclamation": reclamation.id})
        return Response(ReclamationSerializer(reclamation).data)


class ReportListCreateView(ListAPIView):
    serializer_class = ReportSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Report.objects.select_related("auteur")
        if user.role != User.Role.ADMIN:
            qs = qs.filter(auteur=user)
        params = self.request.query_params
        if params.get("statut"):
            qs = qs.filter(statut=params["statut"])
        if params.get("type"):
            qs = qs.filter(type=params["type"])
        return qs

    def post(self, request):
        serializer = ReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = serializer.save(auteur=request.user)
        admins = User.objects.filter(role=User.Role.ADMIN, is_active=True)
        for admin in admins:
            notify(
                admin,
                f"Nouveau signalement — {report.get_priorite_display()}",
                f"{report.get_type_display()} : {report.sujet}",
                type_="message",
            )
        log_action(request, "create", "reports", {"report": report.id})
        return Response(ReportSerializer(report).data, status=status.HTTP_201_CREATED)


class ReportRespondView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        report = get_object_or_404(Report, pk=pk)
        serializer = ReportResponseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report.statut = serializer.validated_data["statut"]
        report.reponse = serializer.validated_data.get("reponse", report.reponse)
        report.save(update_fields=["statut", "reponse", "date_modification"])
        notify(
            report.auteur,
            "Suivi de votre signalement",
            f"Votre signalement « {report.sujet} » est maintenant : {report.get_statut_display()}.",
            type_="message",
        )
        return Response(ReportSerializer(report).data)
