from datetime import datetime, time, timedelta

from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.generics import ListAPIView, ListCreateAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import TherapistProfile, User
from core.permissions import IsPatient, IsTherapist
from core.utils import log_action

from .models import Creneau, DemandeRDV, ParticipantDemande, Seance, SessionParticipant
from .serializers import (
    BulkSlotSerializer,
    CreneauSerializer,
    CreateDemandeSerializer,
    DemandeSerializer,
    PaySerializer,
    SeanceSerializer,
    SlotSerializer,
)
from .services import (
    accepter_demande,
    annuler_demande,
    creer_demande,
    payer_participation,
    refuser_demande,
    refuser_participation,
    rejoindre_seance,
    terminer_seance,
)


def is_involved(demande, user):
    return (
        demande.patient_id == user.id
        or demande.creneau.therapeute.user_id == user.id
        or user.role == User.Role.ADMIN
    )


class CreneauListView(ListAPIView):
    """Slots visible to the authenticated user (own agenda or bookable slots)."""

    permission_classes = [IsAuthenticated]
    serializer_class = CreneauSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Creneau.objects.select_related("therapeute__user")
        params = self.request.query_params
        if user.role == User.Role.THERAPIST:
            qs = qs.filter(therapeute__user=user)
        elif user.role == User.Role.ADMIN:
            if params.get("therapeute"):
                qs = qs.filter(therapeute_id=params["therapeute"])
        else:
            qs = qs.filter(statut=Creneau.Statut.LIBRE, date_heure_debut__gte=timezone.now())
            if params.get("therapeute"):
                qs = qs.filter(therapeute_id=params["therapeute"])
        if params.get("statut"):
            qs = qs.filter(statut=params["statut"])
        if params.get("date_from"):
            qs = qs.filter(date_heure_debut__date__gte=params["date_from"])
        if params.get("date_to"):
            qs = qs.filter(date_heure_debut__date__lte=params["date_to"])
        return qs.order_by("date_heure_debut")


class AvailabilityView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, therapist_id):
        therapist = get_object_or_404(
            TherapistProfile,
            pk=therapist_id,
            statut=TherapistProfile.Statut.ACTIVE,
            user__is_active=True,
        )
        days = min(int(request.query_params.get("days", 14)), 60)
        now = timezone.now()
        slots = Creneau.objects.filter(
            therapeute=therapist,
            statut=Creneau.Statut.LIBRE,
            date_heure_debut__gte=now,
            date_heure_debut__lte=now + timedelta(days=days),
        ).order_by("date_heure_debut")
        return Response({
            "therapist": {
                "id": therapist.id,
                "nom_complet": therapist.nom_complet,
                "avatar": therapist.user.avatar,
                "tarif_seance": float(therapist.tarif_seance),
                "types_sessions": therapist.types_sessions,
                "note_globale": float(therapist.note_globale),
            },
            "slots": CreneauSerializer(slots, many=True).data,
        })


class TherapistSlotCreateView(APIView):
    permission_classes = [IsTherapist]

    def post(self, request):
        therapist = getattr(request.user, "therapist_profile", None)
        if not therapist:
            return Response({"detail": "Profil thérapeute introuvable."}, status=404)
        if therapist.statut != TherapistProfile.Statut.ACTIVE:
            raise ValidationError({"detail": "Votre compte doit être validé pour gérer votre agenda."})
        serializer = SlotSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        start = serializer.validated_data["date_heure_debut"]
        end = serializer.validated_data["date_heure_fin"]
        if (end - start).total_seconds() > 4 * 3600:
            raise ValidationError({"detail": "Un créneau ne peut pas dépasser 4 heures."})
        overlap = Creneau.objects.filter(
            therapeute=therapist, date_heure_debut__lt=end, date_heure_fin__gt=start
        ).exists()
        if overlap:
            raise ValidationError({"detail": "Ce créneau chevauche une disponibilité existante."})
        slot = Creneau.objects.create(
            therapeute=therapist, date_heure_debut=start, date_heure_fin=end
        )
        log_action(request, "create", "creneaux", {"creneau": slot.id})
        return Response(CreneauSerializer(slot).data, status=status.HTTP_201_CREATED)


class BulkSlotCreateView(APIView):
    permission_classes = [IsTherapist]

    def post(self, request):
        therapist = getattr(request.user, "therapist_profile", None)
        if not therapist:
            return Response({"detail": "Profil thérapeute introuvable."}, status=404)
        if therapist.statut != TherapistProfile.Statut.ACTIVE:
            raise ValidationError({"detail": "Votre compte doit être validé pour gérer votre agenda."})

        serializer = BulkSlotSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if not data["jours"]:
            raise ValidationError({"jours": "Sélectionnez au moins un jour de la semaine."})

        hour, minute = (int(part) for part in data["heure_debut"].split(":"))
        tz = timezone.get_current_timezone()
        created, skipped = 0, 0
        current = data["date_debut"]
        while current <= data["date_fin"]:
            if current.weekday() in data["jours"]:
                cursor = timezone.make_aware(datetime.combine(current, time(hour, minute)), tz)
                end_of_day = timezone.make_aware(datetime.combine(current, time(19, 0)), tz)
                while cursor + timedelta(minutes=data["duree"]) <= end_of_day:
                    end = cursor + timedelta(minutes=data["duree"])
                    exists = Creneau.objects.filter(
                        therapeute=therapist, date_heure_debut=cursor
                    ).exists()
                    if not exists and cursor > timezone.now():
                        Creneau.objects.create(
                            therapeute=therapist, date_heure_debut=cursor, date_heure_fin=end
                        )
                        created += 1
                    else:
                        skipped += 1
                    cursor = end + timedelta(minutes=data["pause"])
            current += timedelta(days=1)
        log_action(request, "create", "creneaux", {"bulk": created})
        return Response({"created": created, "skipped": skipped})


class SlotActionView(APIView):
    permission_classes = [IsTherapist]

    def post(self, request, pk, action):
        therapist = request.user.therapist_profile
        slot = get_object_or_404(Creneau, pk=pk, therapeute=therapist)
        if action == "block":
            if slot.statut not in (Creneau.Statut.LIBRE, Creneau.Statut.BLOQUE):
                raise ValidationError({"detail": "Ce créneau est déjà engagé."})
            slot.statut = Creneau.Statut.BLOQUE
        elif action == "unblock":
            if slot.statut != Creneau.Statut.BLOQUE:
                raise ValidationError({"detail": "Ce créneau n'est pas bloqué."})
            slot.statut = Creneau.Statut.LIBRE
        else:
            return Response({"detail": "Action inconnue."}, status=400)
        slot.save(update_fields=["statut"])
        return Response(CreneauSerializer(slot).data)

    def delete(self, request, pk):
        therapist = request.user.therapist_profile
        slot = get_object_or_404(Creneau, pk=pk, therapeute=therapist)
        if slot.statut not in (Creneau.Statut.LIBRE, Creneau.Statut.BLOQUE):
            raise ValidationError({"detail": "Impossible de supprimer un créneau réservé."})
        slot.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DemandeListCreateView(ListCreateAPIView):
    serializer_class = DemandeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = (
            DemandeRDV.objects.select_related(
                "patient", "creneau__therapeute__user"
            ).prefetch_related("participants")
        )
        if user.role == User.Role.PATIENT:
            qs = qs.filter(Q(patient=user) | Q(participants__patient=user)).distinct()
        elif user.role == User.Role.THERAPIST:
            qs = qs.filter(creneau__therapeute__user=user)
        statut = self.request.query_params.get("statut")
        if statut:
            qs = qs.filter(statut=statut)
        return qs.order_by("-date_creation")

    def create(self, request, *args, **kwargs):
        serializer = CreateDemandeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        demande = creer_demande(
            patient=request.user,
            creneau_id=data["creneau"],
            type_session=data["type_session"],
            message=data.get("message", ""),
            invited=data.get("participants", []),
        )
        log_action(request, "booking", "demandes_rdv", {"demande": demande.id})
        return Response(
            DemandeSerializer(demande, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class DemandeDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        demande = get_object_or_404(
            DemandeRDV.objects.select_related("patient", "creneau__therapeute__user")
            .prefetch_related("participants"),
            pk=pk,
        )
        if not is_involved(demande, request.user):
            raise PermissionDenied("Cette demande ne vous concerne pas.")
        return Response(DemandeSerializer(demande, context={"request": request}).data)


class DemandeActionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk, action):
        demande = get_object_or_404(
            DemandeRDV.objects.select_related("creneau__therapeute__user"), pk=pk
        )
        therapist = getattr(request.user, "therapist_profile", None)

        if action == "accept":
            if request.user.role != User.Role.THERAPIST or not therapist:
                raise PermissionDenied("Réservé au thérapeute concerné.")
            demande = accepter_demande(demande, therapist)
        elif action == "refuse":
            if request.user.role != User.Role.THERAPIST or not therapist:
                raise PermissionDenied("Réservé au thérapeute concerné.")
            demande = refuser_demande(demande, therapist, request.data.get("motif", ""))
        elif action == "cancel":
            demande = annuler_demande(demande, request.user, request.data.get("motif", ""))
        else:
            return Response({"detail": "Action inconnue."}, status=400)

        demande.refresh_from_db()
        log_action(request, "update", "demandes_rdv", {"demande": demande.id, "action": action})
        return Response(DemandeSerializer(demande, context={"request": request}).data)


class PayerPartView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        serializer = PaySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        demande = get_object_or_404(
            DemandeRDV.objects.select_related("creneau__therapeute__user"), pk=pk
        )
        if not is_involved(demande, request.user):
            raise PermissionDenied("Cette demande ne vous concerne pas.")

        participant_id = serializer.validated_data.get("participant_id")
        if participant_id:
            participant = get_object_or_404(ParticipantDemande, pk=participant_id, demande=demande)
            if not (
                request.user.role == User.Role.ADMIN
                or demande.patient_id == request.user.id
                or participant.patient_id == request.user.id
            ):
                raise PermissionDenied("Vous ne pouvez pas régler cette part.")
        else:
            participant = demande.participants.filter(patient=request.user).first()
            if not participant:
                raise ValidationError({"detail": "Aucune part à régler pour votre compte."})

        key = request.headers.get("Idempotency-Key") or f"session-{demande.id}-{participant.id}"
        transaction = payer_participation(
            demande,
            participant,
            request.user,
            methode=serializer.validated_data["methode"],
            idempotency_key=key,
        )
        demande.refresh_from_db()
        log_action(request, "payment", "transactions", {"demande": demande.id, "montant": str(transaction.montant)})
        return Response({
            "detail": "Paiement accepté." if transaction.statut == "OK" else "Paiement refusé.",
            "transaction": {
                "id": transaction.id,
                "reference": transaction.reference,
                "montant": float(transaction.montant),
                "statut": transaction.statut,
                "methode": transaction.methode,
                "date": transaction.date_transaction,
            },
            "demande": DemandeSerializer(demande, context={"request": request}).data,
        })


class ParticipationRefuseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        demande = get_object_or_404(DemandeRDV.objects.select_related("creneau__therapeute__user"), pk=pk)
        participant = demande.participants.filter(patient=request.user).first()
        if not participant:
            raise ValidationError({"detail": "Aucune participation à refuser."})
        refuser_participation(demande, participant, request.user)
        demande.refresh_from_db()
        return Response(DemandeSerializer(demande, context={"request": request}).data)


class SeanceListView(ListAPIView):
    serializer_class = SeanceSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = []
    search_fields = ["patient__first_name", "patient__last_name", "therapeute__user__last_name"]

    def get_queryset(self):
        user = self.request.user
        qs = (
            Seance.objects.select_related("patient", "therapeute__user", "demande")
            .prefetch_related("participants", "clinical_notes")
        )
        if user.role == User.Role.PATIENT:
            qs = qs.filter(Q(patient=user) | Q(participants__patient=user)).distinct()
        elif user.role == User.Role.THERAPIST:
            qs = qs.filter(therapeute__user=user)
        params = self.request.query_params
        if params.get("statut"):
            qs = qs.filter(statut=params["statut"])
        if params.get("type_session"):
            qs = qs.filter(type_session=params["type_session"])
        if params.get("date_from"):
            qs = qs.filter(date_debut__date__gte=params["date_from"])
        if params.get("date_to"):
            qs = qs.filter(date_debut__date__lte=params["date_to"])
        if params.get("upcoming") in ("true", "1"):
            qs = qs.filter(date_debut__gte=timezone.now()).exclude(statut=Seance.Statut.ANNULEE)
        return qs.order_by("-date_debut")


class SeanceDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        seance = get_object_or_404(
            Seance.objects.select_related("patient", "therapeute__user")
            .prefetch_related("participants", "clinical_notes"),
            pk=pk,
        )
        user = request.user
        involved = (
            seance.patient_id == user.id
            or seance.therapeute.user_id == user.id
            or user.role == User.Role.ADMIN
            or seance.participants.filter(patient=user).exists()
        )
        if not involved:
            raise PermissionDenied("Cette séance ne vous concerne pas.")
        return Response(SeanceSerializer(seance, context={"request": request}).data)


class JoinSeanceView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        seance = get_object_or_404(
            Seance.objects.select_related("patient", "therapeute__user").prefetch_related("participants"),
            pk=pk,
        )
        seance = rejoindre_seance(seance, request.user)
        log_action(request, "security", "seances", {"seance": seance.id, "action": "join"})
        return Response({
            "lien_googlemeet": seance.lien_googlemeet,
            "fournisseur": seance.fournisseur,
            "statut": seance.statut,
            "seance": SeanceSerializer(seance, context={"request": request}).data,
        })


class CompleteSeanceView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        seance = get_object_or_404(Seance, pk=pk)
        if request.user.role not in (User.Role.THERAPIST, User.Role.ADMIN):
            raise PermissionDenied("Seul le praticien peut clôturer la séance.")
        seance = terminer_seance(seance, request.user, request.data.get("notes", ""))
        log_action(request, "update", "seances", {"seance": seance.id, "action": "complete"})
        return Response(SeanceSerializer(seance, context={"request": request}).data)
