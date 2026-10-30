from rest_framework import serializers

from .models import Avis, Reclamation, Report


class AvisSerializer(serializers.ModelSerializer):
    patient_nom = serializers.CharField(source="patient.full_name", read_only=True)
    patient_avatar = serializers.URLField(source="patient.avatar", read_only=True)
    therapeute_id = serializers.IntegerField(source="therapeute.id", read_only=True)
    therapeute_nom = serializers.SerializerMethodField()

    class Meta:
        model = Avis
        fields = ["id", "patient", "patient_nom", "patient_avatar", "therapeute",
                  "therapeute_id", "therapeute_nom", "seance", "note", "commentaire",
                  "visible", "date_creation", "date_modification"]
        read_only_fields = ["id", "patient", "therapeute", "date_creation", "date_modification"]

    def get_therapeute_nom(self, obj):
        profile = getattr(obj.therapeute, "therapist_profile", None)
        return profile.nom_complet if profile else obj.therapeute.full_name


class AvisCreateSerializer(serializers.Serializer):
    therapeute_id = serializers.IntegerField()
    note = serializers.IntegerField(min_value=1, max_value=5)
    commentaire = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    seance_id = serializers.IntegerField(required=False, allow_null=True)


class ReclamationSerializer(serializers.ModelSerializer):
    patient_nom = serializers.CharField(source="patient.full_name", read_only=True)
    patient_email = serializers.EmailField(source="patient.email", read_only=True)
    statut_display = serializers.CharField(source="get_statut_display", read_only=True)
    priorite_display = serializers.CharField(source="get_priorite_display", read_only=True)
    therapeute_nom = serializers.SerializerMethodField()
    traite_par_nom = serializers.CharField(source="traite_par.full_name", read_only=True)

    class Meta:
        model = Reclamation
        fields = ["id", "patient", "patient_nom", "patient_email", "therapeute",
                  "therapeute_nom", "categorie", "message", "reponse", "statut",
                  "statut_display", "priorite", "priorite_display", "traite_par",
                  "traite_par_nom", "date_creation", "date_modification", "date_resolution"]
        read_only_fields = ["id", "patient", "reponse", "statut", "traite_par",
                            "date_creation", "date_modification", "date_resolution"]

    def get_therapeute_nom(self, obj):
        return obj.therapeute.nom_complet if obj.therapeute else None


class ReclamationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reclamation
        fields = ["categorie", "message", "priorite", "therapeute"]

    def validate_categorie(self, value):
        if not value.strip():
            raise serializers.ValidationError("La catégorie est obligatoire.")
        return value.strip()


class ReclamationResponseSerializer(serializers.Serializer):
    reponse = serializers.CharField()
    statut = serializers.ChoiceField(choices=["en_cours", "resolue", "rejetee"])
    priorite = serializers.ChoiceField(choices=["basse", "normale", "haute"], required=False)


class ReportSerializer(serializers.ModelSerializer):
    auteur_nom = serializers.CharField(source="auteur.full_name", read_only=True)
    type_display = serializers.CharField(source="get_type_display", read_only=True)
    priorite_display = serializers.CharField(source="get_priorite_display", read_only=True)
    statut_display = serializers.CharField(source="get_statut_display", read_only=True)

    class Meta:
        model = Report
        fields = ["id", "auteur", "auteur_nom", "type", "type_display", "sujet", "message",
                  "priorite", "priorite_display", "statut", "statut_display", "reponse",
                  "date_creation", "date_modification"]
        read_only_fields = ["id", "auteur", "statut", "reponse", "date_creation", "date_modification"]


class ReportResponseSerializer(serializers.Serializer):
    reponse = serializers.CharField(required=False, allow_blank=True)
    statut = serializers.ChoiceField(choices=["nouveau", "en_cours", "resolu"])
