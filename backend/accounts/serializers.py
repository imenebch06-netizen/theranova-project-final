from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from .models import (
    PatientProfile,
    Specialite,
    SousSpecialite,
    TherapistProfile,
)

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    role_display = serializers.CharField(source="get_role_display", read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name", "full_name", "role",
            "role_display", "phone", "language", "avatar", "is_staff",
            "is_active", "date_joined", "last_login",
        ]
        read_only_fields = ["id", "email", "role", "is_staff", "is_active", "date_joined", "last_login"]


class SpecialiteSerializer(serializers.ModelSerializer):
    sous_specialites = serializers.SerializerMethodField()
    nombre_therapeutes = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Specialite
        fields = ["id", "code", "nom", "nom_en", "description", "icone", "sous_specialites", "nombre_therapeutes"]

    def get_sous_specialites(self, obj):
        return [{"id": s.id, "nom": s.nom, "nom_en": s.nom_en} for s in obj.sous_specialites.all()]


class PatientProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    age = serializers.IntegerField(read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = PatientProfile
        fields = [
            "id", "user", "email", "date_naissance", "sexe", "ville", "is_student",
            "university", "occupation", "emergency_contact", "solde", "preferences", "age",
        ]
        read_only_fields = ["id", "solde"]


class TherapistCardSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    nom_complet = serializers.CharField(read_only=True)
    specialites = serializers.SerializerMethodField()
    prochain_creneau = serializers.SerializerMethodField()
    seances_realisees = serializers.SerializerMethodField()
    statut_display = serializers.CharField(source="get_statut_display", read_only=True)

    class Meta:
        model = TherapistProfile
        fields = [
            "id", "user", "nom_complet", "statut", "statut_display", "disponibilite_active",
            "note_globale", "nombre_avis", "bio", "approche", "annees_experience",
            "langues", "types_sessions", "tarif_seance", "ville", "cabinet",
            "specialites", "prochain_creneau", "verifie", "seances_realisees", "motif_suspension",
            "duree_seance", "pause_entre_seances",
        ]

    def get_specialites(self, obj):
        return [
            {"id": s.id, "nom": s.nom, "nom_en": s.nom_en}
            for s in obj.specialites.all()
        ]

    def get_prochain_creneau(self, obj):
        from django.utils import timezone
        from scheduling.models import Creneau

        slot = (
            Creneau.objects.filter(
                therapeute=obj,
                statut=Creneau.Statut.LIBRE,
                date_heure_debut__gte=timezone.now(),
            )
            .order_by("date_heure_debut")
            .first()
        )
        return slot.date_heure_debut if slot else None

    def get_seances_realisees(self, obj):
        return obj.seances.filter(statut="terminee").count()


class TherapistDetailSerializer(TherapistCardSerializer):
    diplomes = serializers.CharField()
    numero_licence = serializers.CharField()
    date_validation = serializers.DateTimeField(read_only=True)

    class Meta(TherapistCardSerializer.Meta):
        fields = TherapistCardSerializer.Meta.fields + [
            "diplomes", "numero_licence", "date_validation",
        ]


class RegisterPatientSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    date_naissance = serializers.DateField(required=False, allow_null=True)
    sexe = serializers.ChoiceField(choices=["F", "M", "N"], required=False, default="N")
    ville = serializers.CharField(max_length=100, required=False, allow_blank=True)
    is_student = serializers.BooleanField(required=False, default=True)
    university = serializers.CharField(max_length=150, required=False, allow_blank=True)
    language = serializers.ChoiceField(choices=["fr", "en", "ar"], required=False, default="fr")
    accept_terms = serializers.BooleanField(write_only=True, required=False, default=True)

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Un compte existe déjà avec cet email.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        password = validated_data.pop("password")
        validated_data.pop("accept_terms", None)
        language = validated_data.pop("language", "fr")
        phone = validated_data.pop("phone", "")
        profile_data = {
            key: validated_data.pop(key)
            for key in ["date_naissance", "sexe", "ville", "is_student", "university"]
            if key in validated_data
        }
        user = User.objects.create_user(
            **validated_data, password=password, role=User.Role.PATIENT,
            phone=phone, language=language,
        )
        PatientProfile.objects.create(user=user, **profile_data)
        return user


class RegisterTherapistSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    language = serializers.ChoiceField(choices=["fr", "en", "ar"], required=False, default="fr")
    bio = serializers.CharField(required=False, allow_blank=True)
    approche = serializers.CharField(max_length=200, required=False, allow_blank=True)
    annees_experience = serializers.IntegerField(required=False, min_value=0, default=0)
    diplomes = serializers.CharField(required=False, allow_blank=True)
    langues = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    types_sessions = serializers.ListField(
        child=serializers.ChoiceField(choices=["Individuel", "Couple", "Famille"]),
        required=False, default=list,
    )
    tarif_seance = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=2500)
    ville = serializers.CharField(max_length=100, required=False, allow_blank=True)
    cabinet = serializers.CharField(max_length=200, required=False, allow_blank=True)
    numero_licence = serializers.CharField(max_length=100, required=False, allow_blank=True)
    specialite_ids = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)
    accept_terms = serializers.BooleanField(write_only=True, required=False, default=True)

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Un compte existe déjà avec cet email.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        password = validated_data.pop("password")
        validated_data.pop("accept_terms", None)
        specialite_ids = validated_data.pop("specialite_ids", [])
        profile_fields = [
            "bio", "approche", "annees_experience", "diplomes", "langues",
            "types_sessions", "tarif_seance", "ville", "cabinet", "numero_licence",
        ]
        profile_data = {key: validated_data.pop(key) for key in profile_fields if key in validated_data}
        user = User.objects.create_user(
            **validated_data, password=password, role=User.Role.THERAPIST,
            is_active=True,
        )
        profile = TherapistProfile.objects.create(
            user=user,
            statut=TherapistProfile.Statut.PENDING,
            disponibilite_active=False,
            **profile_data,
        )
        for specialite_id in specialite_ids:
            if Specialite.objects.filter(id=specialite_id).exists():
                profile.specialites.add(specialite_id)
        return user


class PatientUpdateSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150, required=False)
    last_name = serializers.CharField(max_length=150, required=False)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    language = serializers.ChoiceField(choices=["fr", "en", "ar"], required=False)
    avatar = serializers.URLField(required=False, allow_blank=True)
    date_naissance = serializers.DateField(required=False, allow_null=True)
    sexe = serializers.ChoiceField(choices=["F", "M", "N"], required=False)
    ville = serializers.CharField(max_length=100, required=False, allow_blank=True)
    is_student = serializers.BooleanField(required=False)
    university = serializers.CharField(max_length=150, required=False, allow_blank=True)
    occupation = serializers.CharField(max_length=150, required=False, allow_blank=True)
    emergency_contact = serializers.CharField(max_length=150, required=False, allow_blank=True)
    preferences = serializers.JSONField(required=False)

    def update(self, instance, validated_data):
        user_fields = ["first_name", "last_name", "phone", "language", "avatar"]
        for field in user_fields:
            if field in validated_data:
                setattr(instance.user, field, validated_data.pop(field))
        instance.user.save()
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance


class TherapistUpdateSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150, required=False)
    last_name = serializers.CharField(max_length=150, required=False)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    language = serializers.ChoiceField(choices=["fr", "en", "ar"], required=False)
    avatar = serializers.URLField(required=False, allow_blank=True)
    bio = serializers.CharField(required=False, allow_blank=True)
    approche = serializers.CharField(max_length=200, required=False, allow_blank=True)
    annees_experience = serializers.IntegerField(required=False, min_value=0)
    diplomes = serializers.CharField(required=False, allow_blank=True)
    langues = serializers.ListField(child=serializers.CharField(), required=False)
    types_sessions = serializers.ListField(child=serializers.CharField(), required=False)
    tarif_seance = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    duree_seance = serializers.IntegerField(required=False, min_value=30, max_value=120)
    pause_entre_seances = serializers.IntegerField(required=False, min_value=0, max_value=60)
    ville = serializers.CharField(max_length=100, required=False, allow_blank=True)
    cabinet = serializers.CharField(max_length=200, required=False, allow_blank=True)
    numero_licence = serializers.CharField(max_length=100, required=False, allow_blank=True)
    disponibilite_active = serializers.BooleanField(required=False)
    specialite_ids = serializers.ListField(child=serializers.IntegerField(), required=False)

    def update(self, instance, validated_data):
        user_fields = ["first_name", "last_name", "phone", "language", "avatar"]
        for field in user_fields:
            if field in validated_data:
                setattr(instance.user, field, validated_data.pop(field))
        instance.user.save()
        specialite_ids = validated_data.pop("specialite_ids", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if specialite_ids is not None:
            instance.specialites.set(Specialite.objects.filter(id__in=specialite_ids))
        return instance


class AdminUserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    patient = serializers.SerializerMethodField()
    therapist = serializers.SerializerMethodField()
    seances = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name", "full_name", "role", "phone",
            "language", "is_active", "date_joined", "last_login", "patient", "therapist",
            "seances",
        ]

    def get_patient(self, obj):
        profile = getattr(obj, "patient_profile", None)
        if not profile:
            return None
        return {
            "id": profile.id,
            "solde": profile.solde,
            "ville": profile.ville,
            "is_student": profile.is_student,
            "age": profile.age,
        }

    def get_therapist(self, obj):
        profile = getattr(obj, "therapist_profile", None)
        if not profile:
            return None
        return {
            "id": profile.id,
            "statut": profile.statut,
            "note_globale": float(profile.note_globale),
            "nombre_avis": profile.nombre_avis,
            "specialites": [s.nom for s in profile.specialites.all()],
            "tarif_seance": float(profile.tarif_seance),
        }

    def get_seances(self, obj):
        therapist_sessions = (
            obj.therapist_profile.seances.count() if hasattr(obj, "therapist_profile") else 0
        )
        return obj.patient_sessions.count() + therapist_sessions
