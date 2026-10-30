from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    ChangePasswordView,
    GoogleAuthView,
    LoginView,
    MeView,
    RegisterPatientView,
    RegisterTherapistView,
    logout_view,
)

urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    path("refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("logout/", logout_view, name="logout"),
    path("register/patient/", RegisterPatientView.as_view(), name="register-patient"),
    path("register/therapist/", RegisterTherapistView.as_view(), name="register-therapist"),
    path("google/", GoogleAuthView.as_view(), name="google-auth"),
    path("me/", MeView.as_view(), name="me"),
    path("password/", ChangePasswordView.as_view(), name="change-password"),
]
