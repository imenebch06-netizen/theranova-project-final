from django.utils import timezone
from rest_framework import serializers

from accounts.models import User

from .models import Creneau, DemandeRDV, ParticipantDemande, Seance, SessionParticipant


class PersonLiteSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "full_name", "first_name", "last_name", "email", "avatar"]


class CreneauSerializer(serializers.ModelSerializer):
    therapeute_id = serializers.IntegerField(source="therapeute.id", read_only=True)
    therapeute_nom = serializers.CharField(source="therapeute.nom_complet", read_only=True)
    duree_minutes = serializers.IntegerField(read_only=True)
    est_passe = serializers.BooleanField(read_only=True)
    tarif = serializers.DecimalField(source="therapeute.tarif_seance", max_digits=10,
                                     decimal_places=2, read_only=True)

    class Meta:
        model = Creneau
        fields = ["id", "therapeute_id", "therapeute_nom", "date_heure_debut",
                  "date_heure_fin", "statut", "duree_minutes", "est_passe", "tarif"]


class ParticipantSerializer(serializers.ModelSerializer):
    statut_display = serializers.CharField(source="get_statut_display", read_only=True)
    patient_id = serializers.IntegerField(source="patient.id", read_only=True, allow_null=True)

    class Meta:
        model = ParticipantDemande
        fields = ["id", "patient_id", "email", "nom", "statut", "statut_display",
                  "montant", "est_createur", "date_paiement"]


class DemandeSerializer(serializers.ModelSerializer):
    patient = PersonLiteSerializer(read_only=True)
    therapeute = serializers.SerializerMethodField()
    creneau = CreneauSerializer(read_only=True)
    participants = ParticipantSerializer(many=True, read_only=True)
    statut_display = serializers.CharField(source="get_statut_display", read_only=True)
    seance_id = serializers.SerializerMethodField()
    seance_statut = serializers.SerializerMethodField()
    ma_part = serializers.SerializerMethodField()
    peut_payer = serializers.SerializerMethodField()
    reste_a_payer = serializers.SerializerMethodField()

    class Meta:
        model = DemandeRDV
        fields = ["id", "patient", "therapeute", "creneau", "type_session", "statut",
                  "statut_display", "message", "prix_total", "prix_par_participant",
                  "participants", "seance_id", "seance_statut", "ma_part", "peut_payer",
                  "reste_a_payer", "motif_refus", "date_creation", "date_reponse"]

    def get_therapeute(self, obj):
        from accounts.models import TherapistProfile

        therapist = obj.creneau.therapeute
        return {
            "id": therapist.id,
            "nom_complet": therapist.nom_complet,
            "avatar": therapist.user.avatar,
            "email": therapist.user.email,
            "tarif_seance": float(therapist.tarif_seance),
            "ville": therapist.ville,
        }

    def get_seance_id(self, obj):
        seance = getattr(obj, "seance", None)
        return seance.id if seance else None

    def get_seance_statut(self, obj):
        seance = getattr(obj, "seance", None)
        return seance.statut if seance else None

    def get_ma_part(self, obj):
        request = self.context.get("request")
        if not request:
            return None
        participant = obj.participants.filter(patient=request.user).first()
        if not participant:
            return None
        return {
            "id": participant.id,
            "statut": participant.statut,
            "montant": float(participant.montant),
            "est_createur": participant.est_createur,
        }

    def get_peut_payer(self, obj):
        request = self.context.get("request")
        if not request or obj.statut != DemandeRDV.Statut.ACCEPTEE:
            return False
        return obj.participants.filter(
            patient=request.user, statut=ParticipantDemande.Statut.INVITE
        ).exists()

    def get_reste_a_payer(self, obj):
        return float(
            sum(p.montant for p in obj.participants.all()
                if p.statut == ParticipantDemande.Statut.INVITE)
        )


class SeanceSerializer(serializers.ModelSerializer):
    patient = PersonLiteSerializer(read_only=True)
    therapeute = serializers.SerializerMethodField()
    participants = serializers.SerializerMethodField()
    statut_display = serializers.CharField(source="get_statut_display", read_only=True)
    can_join = serializers.SerializerMethodField()
    accessible = serializers.BooleanField(source="accessible_maintenant", read_only=True)
    lien_googlemeet = serializers.SerializerMethodField()
    a_note = serializers.SerializerMethodField()

    class Meta:
        model = Seance
        fields = ["id", "demande_id", "patient", "therapeute", "statut", "statut_display",
                  "date_debut", "date_fin", "date_debut_reelle", "date_fin_reelle",
                  "type_session", "prix_final", "fournisseur", "can_join", "accessible",
                  "lien_googlemeet", "participants", "a_note", "notes", "date_creation"]

    def get_therapeute(self, obj):
        return {
            "id": obj.therapeute.id,
            "nom_complet": obj.therapeute.nom_complet,
            "avatar": obj.therapeute.user.avatar,
            "email": obj.therapeute.user.email,
            "ville": obj.therapeute.ville,
        }

    def get_participants(self, obj):
        return [
            {
                "id": participant.id,
                "patient_id": participant.patient_id,
                "email": participant.email,
                "nom": participant.nom,
                "statut": participant.statut,
                "a_rejoint": participant.a_rejoint,
            }
            for participant in obj.participants.all()
        ]

    def _is_involved(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        user = request.user
        return (
            obj.patient_id == user.id
            or obj.therapeute.user_id == user.id
            or user.role == User.Role.ADMIN
            or obj.participants.filter(patient=user, statut=SessionParticipant.Statut.PAYE).exists()
        )

    def get_can_join(self, obj):
        if not self._is_involved(obj):
            return False
        if obj.statut not in (Seance.Statut.PREVUE, Seance.Statut.EN_COURS):
            return False
        request = self.context.get("request")
        if request and request.user.role == User.Role.PATIENT:
            if not obj.participants.filter(
                patient=request.user, statut=SessionParticipant.Statut.PAYE
            ).exists() and obj.patient_id != request.user.id:
                return False
        return obj.accessible_maintenant

    def get_lien_googlemeet(self, obj):
        if not self._is_involved(obj):
            return None
        if obj.statut in (Seance.Statut.ANNULEE,):
            return None
        request = self.context.get("request")
        if request and request.user.role == User.Role.PATIENT and not obj.accessible_maintenant:
            return None
        return obj.lien_googlemeet

    def get_a_note(self, obj):
        return obj.clinical_notes.exists()


class CreateDemandeSerializer(serializers.Serializer):
    creneau = serializers.IntegerField()
    type_session = serializers.ChoiceField(choices=["Individuel", "Couple", "Famille"],
                                           default="Individuel")
    message = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    participants = serializers.ListField(
        child=serializers.DictField(), required=False, default=list
    )


class SlotSerializer(serializers.Serializer):
    date_heure_debut = serializers.DateTimeField()
    date_heure_fin = serializers.DateTimeField()

    def validate(self, attrs):
        if attrs["date_heure_fin"] <= attrs["date_heure_debut"]:
            raise serializers.ValidationError("La fin du créneau doit être après son début.")
        if attrs["date_heure_debut"] <= timezone.now():
            raise serializers.ValidationError("Le créneau doit être dans le futur.")
        return attrs


class BulkSlotSerializer(serializers.Serializer):
    date_debut = serializers.DateField()
    date_fin = serializers.DateField()
    heure_debut = serializers.RegexField(r"^\d{2}:\d{2}$", default="09:00")
    duree = serializers.IntegerField(min_value=30, max_value=120, default=60)
    pause = serializers.IntegerField(min_value=0, max_value=60, default=10)
    jours = serializers.ListField(
        child=serializers.IntegerField(min_value=0, max_value=6), default=list
    )

    def validate(self, attrs):
        if attrs["date_fin"] < attrs["date_debut"]:
            raise serializers.ValidationError("La date de fin doit suivre la date de début.")
        if (attrs["date_fin"] - attrs["date_debut"]).days > 120:
            raise serializers.ValidationError("Maximum 120 jours par génération.")
        return attrs


class PaySerializer(serializers.Serializer):
    participant_id = serializers.IntegerField(required=False, allow_null=True)
    methode = serializers.ChoiceField(
        choices=["carte", "baridimob", "cib", "credit", "simule"], default="simule"
    )
