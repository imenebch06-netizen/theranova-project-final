from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.generics import ListCreateAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import PatientProfile, TherapistProfile, User
from core.permissions import IsTherapist
from core.utils import log_action
from scheduling.models import Seance

from .models import DossierPatient, NoteClinique, RapportSeance
from .serializers import (
    DossierCreateSerializer,
    DossierSerializer,
    DossierUpdateSerializer,
    NoteSerializer,
    PatientSummarySerializer,
    RapportSerializer,
)


def therapist_profile_or_403(user):
    profile = getattr(user, "therapist_profile", None)
    if not profile:
        raise PermissionDenied("Profil thérapeute requis.")
    return profile


def can_access_patient(therapist, patient_id):
    return (
        DossierPatient.objects.filter(therapeute=therapist, patient_id=patient_id).exists()
        or Seance.objects.filter(therapeute=therapist, patient_id=patient_id).exists()
    )


class DossierListCreateView(ListCreateAPIView):
    permission_classes = [IsTherapist]
    serializer_class = DossierSerializer

    def get_queryset(self):
        profile = self.request.user.therapist_profile
        qs = DossierPatient.objects.select_related("patient", "therapeute__user").prefetch_related("notes")
        qs = qs.filter(therapeute=profile)
        params = self.request.query_params
        if params.get("statut"):
            qs = qs.filter(statut=params["statut"])
        if params.get("search"):
            search = params["search"]
            qs = qs.filter(
                Q(patient__first_name__icontains=search)
                | Q(patient__last_name__icontains=search)
                | Q(patient__email__icontains=search)
            )
        return qs

    def create(self, request, *args, **kwargs):
        serializer = DossierCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        therapist = therapist_profile_or_403(request.user)
        patient = get_object_or_404(User, pk=data["patient_id"], role=User.Role.PATIENT)
        if not can_access_patient(therapist, patient.id):
            raise ValidationError({"patient_id": "Ce patient n'est pas (encore) suivi par votre cabinet."})
        dossier, created = DossierPatient.objects.get_or_create(
            patient=patient,
            therapeute=therapist,
            defaults={
                "motif_consultation": data.get("motif_consultation", ""),
                "plan_therapeutique": data.get("plan_therapeutique", ""),
                "objectifs": data.get("objectifs", []),
            },
        )
        log_action(request, "create", "dossiers", {"dossier": dossier.id})
        return Response(
            DossierSerializer(dossier).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class DossierDetailView(APIView):
    permission_classes = [IsTherapist]

    def _get(self, request, pk):
        therapist = request.user.therapist_profile
        dossier = get_object_or_404(
            DossierPatient.objects.select_related("patient", "therapeute__user"), pk=pk
        )
        if dossier.therapeute_id != therapist.id and not request.user.is_admin:
            raise PermissionDenied("Ce dossier ne vous appartient pas.")
        return dossier

    def get(self, request, pk):
        dossier = self._get(request, pk)
        return Response(DossierSerializer(dossier).data)

    def patch(self, request, pk):
        dossier = self._get(request, pk)
        serializer = DossierUpdateSerializer(dossier, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        log_action(request, "update", "dossiers", {"dossier": dossier.id})
        return Response(DossierSerializer(dossier).data)


class DossierArchiveView(APIView):
    permission_classes = [IsTherapist]

    def post(self, request, pk):
        return self._change(request, pk, DossierPatient.Statut.ARCHIVE)

    def delete(self, request, pk):
        return self._change(request, pk, DossierPatient.Statut.ACTIF)

    def _change(self, request, pk, statut):
        therapist = request.user.therapist_profile
        dossier = get_object_or_404(DossierPatient, pk=pk, therapeute=therapist)
        dossier.statut = statut
        dossier.date_archivage = timezone.now() if statut == DossierPatient.Statut.ARCHIVE else None
        dossier.save(update_fields=["statut", "date_archivage"])
        log_action(request, "update", "dossiers", {"dossier": dossier.id, "statut": statut})
        return Response(DossierSerializer(dossier).data)


class NotesView(APIView):
    permission_classes = [IsTherapist]

    def get(self, request, pk):
        dossier = self._dossier(request, pk)
        notes = dossier.notes.select_related("seance")
        return Response(NoteSerializer(notes, many=True).data)

    def post(self, request, pk):
        dossier = self._dossier(request, pk)
        serializer = NoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        seance = serializer.validated_data.get("seance")
        if seance and (seance.therapeute_id != dossier.therapeute_id or seance.patient_id != dossier.patient_id):
            raise ValidationError({"seance": "Cette séance ne correspond pas à ce dossier."})
        note = serializer.save(dossier=dossier, therapeute=dossier.therapeute)
        log_action(request, "create", "notes_cliniques", {"note": note.id})
        return Response(NoteSerializer(note).data, status=status.HTTP_201_CREATED)

    def _dossier(self, request, pk):
        dossier = get_object_or_404(DossierPatient, pk=pk)
        if dossier.therapeute.user_id != request.user.id:
            raise PermissionDenied("Ce dossier ne vous appartient pas.")
        return dossier


class NoteDetailView(APIView):
    permission_classes = [IsTherapist]

    def _get(self, request, pk):
        note = get_object_or_404(NoteClinique, pk=pk)
        if note.dossier.therapeute.user_id != request.user.id:
            raise PermissionDenied("Cette note ne vous appartient pas.")
        return note

    def patch(self, request, pk):
        note = self._get(request, pk)
        serializer = NoteSerializer(note, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(NoteSerializer(note).data)

    def delete(self, request, pk):
        note = self._get(request, pk)
        note.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PatientOverviewView(APIView):
    """360° view used by the therapist workspace."""

    permission_classes = [IsTherapist]

    def get(self, request, pk):
        therapist = request.user.therapist_profile
        patient = get_object_or_404(User, pk=pk, role=User.Role.PATIENT)
        if not can_access_patient(therapist, patient.id):
            raise PermissionDenied("Ce patient ne fait pas partie de votre suivi.")

        profile, _ = PatientProfile.objects.get_or_create(user=patient)
        dossier = DossierPatient.objects.filter(patient=patient, therapeute=therapist).first()
        seances = Seance.objects.filter(therapeute=therapist, patient=patient).select_related("demande").order_by("-date_debut")
        notes = NoteClinique.objects.filter(dossier=dossier).select_related("seance") if dossier else NoteClinique.objects.none()

        from wellbeing.models import HumeurEntry
        from wellbeing.serializers import HumeurSerializer

        moods = HumeurEntry.objects.filter(patient=patient).order_by("-date_saisie")[:30]

        return Response({
            "patient": PatientSummarySerializer(profile).data,
            "dossier": DossierSerializer(dossier).data if dossier else None,
            "seances": [
                {
                    "id": s.id,
                    "date_debut": s.date_debut,
                    "statut": s.statut,
                    "type_session": s.type_session,
                    "prix_final": float(s.prix_final),
                }
                for s in seances
            ],
            "notes": NoteSerializer(notes, many=True).data,
            "humeurs": HumeurSerializer(moods, many=True).data,
            "statistiques": {
                "seances_terminees": seances.filter(statut=Seance.Statut.TERMINEE).count(),
                "seances_prevues": seances.filter(statut=Seance.Statut.PREVUE).count(),
                "humeur_moyenne": round(sum(m.score for m in moods) / len(moods), 1) if moods else None,
            },
        })


class RapportView(APIView):
    permission_classes = [IsTherapist]

    def get(self, request, seance_id):
        therapist = request.user.therapist_profile
        seance = get_object_or_404(Seance, pk=seance_id, therapeute=therapist)
        rapport = getattr(seance, "rapport", None)
        if not rapport:
            return Response({"detail": "Aucun rapport pour cette séance."}, status=404)
        return Response(RapportSerializer(rapport).data)

    def post(self, request, seance_id):
        therapist = request.user.therapist_profile
        seance = get_object_or_404(Seance, pk=seance_id, therapeute=therapist)
        rapport, _ = RapportSeance.objects.update_or_create(
            seance=seance,
            defaults={
                "therapeute": therapist,
                "objectifs_seance": request.data.get("objectifs_seance", ""),
                "observations": request.data.get("observations", ""),
                "evolution": request.data.get("evolution", "stable"),
                "exercices": request.data.get("exercices", ""),
            },
        )
        dossier, _ = DossierPatient.objects.get_or_create(
            patient=seance.patient, therapeute=therapist
        )
        if request.data.get("observations"):
            NoteClinique.objects.create(
                dossier=dossier,
                seance=seance,
                therapeute=therapist,
                type=NoteClinique.Type.SEANCE,
                contenu=request.data["observations"],
            )
        log_action(request, "create", "rapports", {"seance": seance.id})
        return Response(RapportSerializer(rapport).data, status=status.HTTP_201_CREATED)
