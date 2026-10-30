from datetime import timedelta

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from clinical.models import DossierPatient
from core.permissions import IsPatient
from core.utils import log_action, notify
from matching.models import AnalyseIA
from scheduling.models import Seance

from .models import HumeurEntry
from .serializers import HumeurCreateSerializer, HumeurSerializer
from .services import compute_stats, generate_message


class MoodListCreateView(ListAPIView):
    permission_classes = [IsPatient]
    serializer_class = HumeurSerializer

    def get_queryset(self):
        days = min(int(self.request.query_params.get("days", 90)), 365)
        since = timezone.localdate() - timedelta(days=days)
        return HumeurEntry.objects.filter(patient=self.request.user, date_saisie__gte=since)


class MoodUpsertView(APIView):
    permission_classes = [IsPatient]

    def post(self, request):
        serializer = HumeurCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        today = timezone.localdate()

        entry, created = HumeurEntry.objects.get_or_create(
            patient=request.user, date_saisie=today
        )
        for field, value in data.items():
            setattr(entry, field, value)

        result = generate_message(
            entry.score, entry.note, entry.emotion, request.user.first_name
        )
        entry.message_ia = result["message"]
        entry.alerte = result["alerte"]
        entry.save()

        AnalyseIA.objects.create(
            type_analyse="humeur",
            entite_id=entry.id,
            utilisateur=request.user,
            donnees_entree={"score": entry.score, "emotion": entry.emotion, "note": entry.note},
            resultats=result,
            recommandations=result["message"],
        )

        if entry.alerte:
            therapists = DossierPatient.objects.filter(patient=request.user).select_related("therapeute__user")
            for dossier in therapists:
                notify(
                    dossier.therapeute.user,
                    "Alerte bien-être",
                    f"Le journal d'humeur de {request.user.full_name} signale une situation préoccupante. "
                    "Merci de prendre contact avec le patient.",
                    type_="message",
                    send_email=True,
                )

        log_action(request, "create" if created else "update", "humeurs", {"humeur": entry.id})
        return Response(
            {**HumeurSerializer(entry).data, "recommandations": result["recommandations"]},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class MoodTodayView(APIView):
    permission_classes = [IsPatient]

    def get(self, request):
        entry = HumeurEntry.objects.filter(
            patient=request.user, date_saisie=timezone.localdate()
        ).first()
        if not entry:
            return Response({"detail": "Aucune entrée aujourd'hui."}, status=404)
        return Response(HumeurSerializer(entry).data)


class MoodStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        days = min(int(request.query_params.get("days", 30)), 365)
        since = timezone.localdate() - timedelta(days=days)
        entries = list(
            HumeurEntry.objects.filter(patient=request.user, date_saisie__gte=since)
        )
        stats = compute_stats(entries, days)
        stats["periode_jours"] = days
        stats["message_global"] = self._message(stats)
        return Response(stats)

    def _message(self, stats):
        if not stats["entrees"]:
            return "Commencez par enregistrer votre humeur aujourd'hui : quelques secondes suffisent."
        if stats["tendance"] == "hausse":
            return "Votre humeur s'améliore sur la période récente. Continuez vos routines de soin."
        if stats["tendance"] == "baisse":
            return "Votre humeur est plus basse récemment. C'est un signal à partager avec votre thérapeute."
        return "Votre humeur est globalement stable. La régularité du suivi fait la différence."


class MoodPatientView(APIView):
    """Therapist view of a followed patient's mood history."""

    permission_classes = [IsAuthenticated]

    def get(self, request, patient_id):
        if request.user.role not in (User.Role.THERAPIST, User.Role.ADMIN):
            raise PermissionDenied("Accès réservé aux praticiens.")
        patient = get_object_or_404(User, pk=patient_id, role=User.Role.PATIENT)
        if request.user.role == User.Role.THERAPIST:
            therapist = request.user.therapist_profile
            allowed = DossierPatient.objects.filter(patient=patient, therapeute=therapist).exists() or Seance.objects.filter(
                patient=patient, therapeute=therapist
            ).exists()
            if not allowed:
                raise PermissionDenied("Ce patient ne fait pas partie de votre suivi.")
        days = min(int(request.query_params.get("days", 90)), 365)
        since = timezone.localdate() - timedelta(days=days)
        entries = list(HumeurEntry.objects.filter(patient=patient, date_saisie__gte=since))
        return Response({
            "patient": {"id": patient.id, "nom": patient.full_name, "avatar": patient.avatar},
            "entrees": HumeurSerializer(entries, many=True).data,
            "statistiques": compute_stats(entries, days),
        })


class InsightsView(APIView):
    """Cross-signal insight: mood + sessions, for the patient dashboard."""

    permission_classes = [IsPatient]

    def get(self, request):
        since = timezone.localdate() - timedelta(days=30)
        entries = list(HumeurEntry.objects.filter(patient=request.user, date_saisie__gte=since))
        stats = compute_stats(entries, 30)
        next_session = (
            Seance.objects.filter(patient=request.user, date_debut__gte=timezone.now())
            .exclude(statut=Seance.Statut.ANNULEE)
            .select_related("therapeute__user")
            .order_by("date_debut")
            .first()
        )
        alerts = [HumeurSerializer(entry).data for entry in entries if entry.alerte]
        return Response({
            "statistiques": stats,
            "prochaine_seance": {
                "id": next_session.id,
                "date_debut": next_session.date_debut,
                "therapeute": next_session.therapeute.nom_complet,
            } if next_session else None,
            "alertes": alerts,
            "conseil": stats.get("message_global") or "Enregistrez votre humeur pour obtenir des tendances.",
        })
