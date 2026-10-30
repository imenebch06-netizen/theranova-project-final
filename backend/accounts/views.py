import json
import urllib.parse
import urllib.request

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from core.permissions import IsAdmin, IsPatient, IsTherapist
from core.utils import log_action, notify

from .models import PatientProfile, Specialite, TherapistProfile
from .serializers import (
    AdminUserSerializer,
    PatientProfileSerializer,
    PatientUpdateSerializer,
    RegisterPatientSerializer,
    RegisterTherapistSerializer,
    SpecialiteSerializer,
    TherapistCardSerializer,
    TherapistDetailSerializer,
    TherapistUpdateSerializer,
    UserSerializer,
)

User = get_user_model()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def me_payload(user):
    data = {"user": UserSerializer(user).data}
    if user.role == User.Role.PATIENT:
        profile, _ = PatientProfile.objects.get_or_create(user=user)
        data["patient"] = PatientProfileSerializer(profile).data
        data["therapist"] = None
    elif user.role == User.Role.THERAPIST:
        profile = getattr(user, "therapist_profile", None)
        data["patient"] = None
        data["therapist"] = TherapistDetailSerializer(profile).data if profile else None
    else:
        data["patient"] = None
        data["therapist"] = None
    return data


def tokens_for(user):
    refresh = RefreshToken.for_user(user)
    return {"refresh": str(refresh), "access": str(refresh.access_token)}


class TheranovaTokenSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        if not self.user.is_active:
            raise serializers.ValidationError("Ce compte a été désactivé.")
        self.user.last_login = timezone.now()
        self.user.save(update_fields=["last_login"])
        data["user"] = me_payload(self.user)
        return data



class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]
    serializer_class = TheranovaTokenSerializer


class RegisterPatientView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterPatientSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        notify(
            user,
            "Bienvenue sur TheraNova",
            "Votre espace personnel est prêt. Commencez par le questionnaire de recommandation "
            "pour rencontrer le thérapeute le plus adapté à vos besoins.",
            type_="confirmation",
        )
        log_action(request, "register", "patients", {"email": user.email})
        return Response(
            {"user": me_payload(user), **tokens_for(user)},
            status=status.HTTP_201_CREATED,
        )


class RegisterTherapistView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterTherapistSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        notify(
            user,
            "Dossier en cours de vérification",
            "Merci pour votre inscription. Notre équipe vérifie vos informations professionnelles. "
            "Vous recevrez une notification dès la validation de votre compte.",
            type_="confirmation",
        )
        log_action(request, "register", "therapeutes", {"email": user.email})
        return Response(
            {"user": me_payload(user), **tokens_for(user)},
            status=status.HTTP_201_CREATED,
        )


class GoogleAuthView(APIView):
    """OAuth2 / OpenID Connect sign-in.

    When GOOGLE_CLIENT_ID is configured the Google ID token is verified against
    Google's tokeninfo endpoint. In DEBUG without configuration, a clearly
    flagged demo mode allows testing the flow locally.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        cred = request.data.get("credential") or request.data.get("id_token")
        if not cred:
            return Response({"detail": "Jeton Google manquant."}, status=400)

        email = first_name = last_name = None
        picture = ""
        if settings.GOOGLE_CLIENT_ID:
            try:
                url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + urllib.parse.quote(cred)
                with urllib.request.urlopen(url, timeout=8) as response:
                    info = json.loads(response.read().decode())
                if info.get("aud") != settings.GOOGLE_CLIENT_ID:
                    return Response({"detail": "Jeton Google invalide (audience)."}, status=401)
                if info.get("email_verified") not in (True, "true"):
                    return Response({"detail": "Email Google non vérifié."}, status=401)
                email = info.get("email")
                first_name = info.get("given_name", "")
                last_name = info.get("family_name", "")
                picture = info.get("picture", "")
            except Exception:
                return Response({"detail": "Impossible de vérifier le jeton Google."}, status=401)
        elif settings.DEBUG:
            # Demo mode: the frontend mock sends an email in the credential field.
            if "@" in cred:
                email = cred.lower()
                first_name = request.data.get("first_name", "Utilisateur")
                last_name = request.data.get("last_name", "Google")
            else:
                return Response({"detail": "Mode démo : fournissez un email."}, status=400)
        else:
            return Response({"detail": "Google OAuth n'est pas configuré."}, status=503)

        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "first_name": first_name or "",
                "last_name": last_name or "",
                "role": User.Role.PATIENT,
                "avatar": picture,
            },
        )
        if created:
            PatientProfile.objects.create(user=user)
            notify(
                user,
                "Bienvenue sur TheraNova",
                "Votre compte a été créé via Google. Votre espace patient est prêt.",
                type_="confirmation",
            )
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])
        log_action(request, "login", "utilisateurs", {"provider": "google"})
        return Response({"user": me_payload(user), **tokens_for(user), "created": created})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(me_payload(request.user))

    def patch(self, request):
        user = request.user
        if user.role == User.Role.PATIENT:
            profile, _ = PatientProfile.objects.get_or_create(user=user)
            serializer = PatientUpdateSerializer(profile, data=request.data, partial=True)
        elif user.role == User.Role.THERAPIST:
            profile = getattr(user, "therapist_profile", None)
            if not profile:
                return Response({"detail": "Profil thérapeute introuvable."}, status=404)
            serializer = TherapistUpdateSerializer(profile, data=request.data, partial=True)
        else:
            serializer = UserSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        log_action(request, "update", "utilisateurs", {"user": user.id})
        return Response(me_payload(user))


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        old = request.data.get("current_password", "")
        new = request.data.get("new_password", "")
        if not user.check_password(old):
            return Response({"detail": "Mot de passe actuel incorrect."}, status=400)
        if len(new) < 8:
            return Response({"detail": "Le nouveau mot de passe doit contenir au moins 8 caractères."}, status=400)
        user.set_password(new)
        user.save()
        log_action(request, "security", "utilisateurs", {"user": user.id})
        return Response({"detail": "Mot de passe mis à jour."})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    try:
        token = RefreshToken(request.data.get("refresh"))
        token.blacklist()
    except Exception:
        pass
    return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Public directory
# ---------------------------------------------------------------------------
class SpecialiteListView(ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = SpecialiteSerializer
    pagination_class = None

    def get_queryset(self):
        from django.db.models import Count

        return Specialite.objects.annotate(
            nombre_therapeutes=Count(
                "therapeutes",
                filter=Q(therapeutes__statut=TherapistProfile.Statut.ACTIVE),
            )
        )


class TherapistListView(ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = TherapistCardSerializer
    search_fields = ["user__first_name", "user__last_name", "bio", "approche", "ville"]
    ordering_fields = ["note_globale", "tarif_seance", "annees_experience", "nombre_avis"]
    ordering = ["-note_globale"]

    def get_queryset(self):
        qs = (
            TherapistProfile.objects.select_related("user")
            .prefetch_related("specialites")
            .filter(statut=TherapistProfile.Statut.ACTIVE, user__is_active=True)
        )
        params = self.request.query_params
        if params.get("specialite"):
            qs = qs.filter(specialites__id=params["specialite"])
        if params.get("type"):
            qs = qs.filter(types_sessions__icontains=params["type"])
        if params.get("langue"):
            qs = qs.filter(langues__icontains=params["langue"])
        if params.get("ville"):
            qs = qs.filter(ville__icontains=params["ville"])
        if params.get("min_price"):
            qs = qs.filter(tarif_seance__gte=params["min_price"])
        if params.get("max_price"):
            qs = qs.filter(tarif_seance__lte=params["max_price"])
        if params.get("disponible") in ("true", "1"):
            qs = qs.filter(disponibilite_active=True)
        return qs.distinct()


class TherapistDetailView(RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = TherapistDetailSerializer
    queryset = TherapistProfile.objects.select_related("user").prefetch_related("specialites")


class TherapistMeView(APIView):
    permission_classes = [IsTherapist]

    def get(self, request):
        profile = getattr(request.user, "therapist_profile", None)
        if not profile:
            return Response({"detail": "Profil introuvable."}, status=404)
        return Response(TherapistDetailSerializer(profile).data)


class TherapistPatientsView(ListAPIView):
    """Patients followed by the authenticated therapist (distinct)."""

    permission_classes = [IsTherapist]
    serializer_class = PatientProfileSerializer

    def get_queryset(self):
        profile = self.request.user.therapist_profile
        from scheduling.models import Seance

        patient_ids = Seance.objects.filter(therapeute=profile).values_list("patient_id", flat=True)
        return PatientProfile.objects.filter(user_id__in=patient_ids).select_related("user").distinct().order_by(
            "user__last_name", "user__first_name"
        )


# ---------------------------------------------------------------------------
# Administration
# ---------------------------------------------------------------------------
class AdminUserListView(ListAPIView):
    permission_classes = [IsAdmin]
    serializer_class = AdminUserSerializer
    search_fields = ["email", "first_name", "last_name", "phone"]

    def get_queryset(self):
        qs = User.objects.select_related("patient_profile", "therapist_profile").all()
        role = self.request.query_params.get("role")
        if role:
            qs = qs.filter(role=role)
        state = self.request.query_params.get("state")
        if state == "active":
            qs = qs.filter(is_active=True)
        elif state == "inactive":
            qs = qs.filter(is_active=False)
        return qs


class AdminUserDetailView(APIView):
    permission_classes = [IsAdmin]

    def delete(self, request, pk):
        user = User.objects.filter(pk=pk).first()
        if not user:
            return Response({"detail": "Utilisateur introuvable."}, status=404)
        if user == request.user:
            return Response({"detail": "Impossible de supprimer votre propre compte."}, status=400)
        if user.role == User.Role.THERAPIST:
            user.delete()
        else:
            user.is_active = False
            user.save(update_fields=["is_active"])
        log_action(request, "delete", "utilisateurs", {"user": pk})
        return Response(status=204)


class AdminTherapistListView(ListAPIView):
    permission_classes = [IsAdmin]
    serializer_class = TherapistCardSerializer
    search_fields = ["user__first_name", "user__last_name", "user__email", "ville"]

    def get_queryset(self):
        qs = TherapistProfile.objects.select_related("user").prefetch_related("specialites")
        statut = self.request.query_params.get("statut")
        if statut:
            qs = qs.filter(statut=statut)
        return qs.order_by("-date_validation", "user__last_name")


class TherapistModerationView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, pk, action):
        profile = TherapistProfile.objects.select_related("user").filter(pk=pk).first()
        if not profile:
            return Response({"detail": "Thérapeute introuvable."}, status=404)

        if action == "validate":
            profile.statut = TherapistProfile.Statut.ACTIVE
            profile.verifie = True
            profile.disponibilite_active = True
            profile.motif_suspension = ""
            profile.date_validation = timezone.now()
            profile.user.is_active = True
            profile.user.save(update_fields=["is_active"])
            message = "Votre compte professionnel a été validé. Vous pouvez désormais gérer votre agenda."
        elif action == "suspend":
            profile.statut = TherapistProfile.Statut.SUSPENDED
            profile.disponibilite_active = False
            profile.motif_suspension = request.data.get("motif", "")
            profile.save()
            message = "Votre compte a été suspendu. Contactez l'administration pour plus d'informations."
        elif action == "reactivate":
            profile.statut = TherapistProfile.Statut.ACTIVE
            profile.disponibilite_active = True
            profile.motif_suspension = ""
            profile.save()
            message = "Votre compte a été réactivé."
        elif action == "delete":
            user = profile.user
            user.delete()
            log_action(request, "moderation", "therapeutes", {"therapist": pk, "action": action})
            return Response(status=204)
        else:
            return Response({"detail": "Action inconnue."}, status=400)

        profile.save()
        notify(profile.user, "Mise à jour de votre compte", message, type_="message", send_email=True)
        log_action(request, "moderation", "therapeutes", {"therapist": pk, "action": action})
        return Response(TherapistCardSerializer(profile).data)


class AdminPatientDeleteView(APIView):
    permission_classes = [IsAdmin]

    def delete(self, request, pk):
        user = User.objects.filter(pk=pk, role=User.Role.PATIENT).first()
        if not user:
            return Response({"detail": "Patient introuvable."}, status=404)
        user.is_active = False
        user.save(update_fields=["is_active"])
        log_action(request, "delete", "patients", {"patient": pk})
        return Response(status=204)
