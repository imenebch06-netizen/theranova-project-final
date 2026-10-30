from rest_framework import serializers

from accounts.models import PatientProfile, User
from scheduling.models import Seance

from .models import DossierPatient, NoteClinique, RapportSeance


class PatientSummarySerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    avatar = serializers.URLField(source="user.avatar", read_only=True)
    age = serializers.IntegerField(read_only=True)

    class Meta:
        model = PatientProfile
        fields = ["id", "user_id", "full_name", "email", "avatar", "age", "sexe", "ville",
                  "is_student", "university", "occupation", "solde", "date_naissance"]


class NoteSerializer(serializers.ModelSerializer):
    seance_date = serializers.DateTimeField(source="seance.date_debut", read_only=True)
    type_display = serializers.CharField(source="get_type_display", read_only=True)

    class Meta:
        model = NoteClinique
        fields = ["id", "dossier", "seance", "seance_date", "type", "type_display",
                  "contenu", "prive", "date_creation", "date_modification"]
        read_only_fields = ["id", "dossier", "date_creation", "date_modification"]


class DossierSerializer(serializers.ModelSerializer):
    patient = PatientSummarySerializer(read_only=True)
    therapeute_nom = serializers.CharField(source="therapeute.nom_complet", read_only=True)
    statut_display = serializers.CharField(source="get_statut_display", read_only=True)
    seances_count = serializers.SerializerMethodField()
    derniere_note = serializers.SerializerMethodField()
    humeur_moyenne = serializers.SerializerMethodField()
    prochaine_seance = serializers.SerializerMethodField()
    progression = serializers.IntegerField(read_only=True)
    objectifs_atteints = serializers.IntegerField(read_only=True)

    class Meta:
        model = DossierPatient
        fields = ["id", "patient", "therapeute", "therapeute_nom", "statut", "statut_display",
                  "motif_consultation", "plan_therapeutique", "objectifs", "progression",
                  "objectifs_atteints", "date_ouverture", "date_archivage", "seances_count",
                  "derniere_note", "humeur_moyenne", "prochaine_seance", "date_creation",
                  "date_modification"]
        read_only_fields = ["id", "therapeute", "date_ouverture", "date_archivage",
                            "date_creation", "date_modification"]

    def get_seances_count(self, obj):
        return Seance.objects.filter(
            therapeute=obj.therapeute, patient=obj.patient, statut=Seance.Statut.TERMINEE
        ).count()

    def get_derniere_note(self, obj):
        note = obj.notes.first()
        if not note:
            return None
        return {"id": note.id, "date": note.date_creation, "extrait": note.contenu[:120]}

    def get_humeur_moyenne(self, obj):
        from django.db.models import Avg

        from wellbeing.models import HumeurEntry

        value = HumeurEntry.objects.filter(patient=obj.patient).aggregate(avg=Avg("score"))["avg"]
        return round(value, 1) if value else None

    def get_prochaine_seance(self, obj):
        from django.utils import timezone

        seance = (
            Seance.objects.filter(
                therapeute=obj.therapeute,
                patient=obj.patient,
                date_debut__gte=timezone.now(),
                statut=Seance.Statut.PREVUE,
            )
            .order_by("date_debut")
            .first()
        )
        return seance.date_debut if seance else None


class DossierCreateSerializer(serializers.Serializer):
    patient_id = serializers.IntegerField()
    motif_consultation = serializers.CharField(required=False, allow_blank=True)
    plan_therapeutique = serializers.CharField(required=False, allow_blank=True)
    objectifs = serializers.ListField(child=serializers.DictField(), required=False, default=list)


class DossierUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DossierPatient
        fields = ["motif_consultation", "plan_therapeutique", "objectifs", "statut"]

    def validate_objectifs(self, value):
        cleaned = []
        for item in value:
            if not isinstance(item, dict) or not item.get("titre"):
                raise serializers.ValidationError("Chaque objectif doit contenir un titre.")
            cleaned.append({
                "titre": item["titre"],
                "statut": item.get("statut", "en_cours"),
                "echeance": item.get("echeance"),
            })
        return cleaned


class RapportSerializer(serializers.ModelSerializer):
    class Meta:
        model = RapportSeance
        fields = ["id", "seance", "objectifs_seance", "observations", "evolution",
                  "exercices", "date_creation"]
        read_only_fields = ["id", "date_creation"]
