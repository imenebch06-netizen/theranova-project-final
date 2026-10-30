from django.conf import settings
from django.db import models


class TimeStampedModel(models.Model):
    """Abstract base model adding creation / update timestamps."""

    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class AuditLog(models.Model):
    """Traceability of sensitive actions (report: Logs_Systeme)."""

    ACTION_CHOICES = [
        ("login", "Connexion"),
        ("register", "Inscription"),
        ("create", "Création"),
        ("update", "Modification"),
        ("delete", "Suppression"),
        ("payment", "Paiement"),
        ("booking", "Réservation"),
        ("moderation", "Modération"),
        ("security", "Sécurité"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    action = models.CharField(max_length=32, choices=ACTION_CHOICES)
    table_affectee = models.CharField(max_length=100, blank=True)
    details = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    date_action = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_action"]
        verbose_name = "Journal système"
        verbose_name_plural = "Journaux système"

    def __str__(self):
        return f"{self.action} — {self.user_id} — {self.date_action:%Y-%m-%d %H:%M}"


class SystemParameter(models.Model):
    """Runtime configuration (report: Parametres_Systeme)."""

    cle = models.CharField(max_length=255, unique=True)
    valeur = models.TextField(blank=True)
    type = models.CharField(max_length=50, default="string")
    description = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Paramètre système"
        verbose_name_plural = "Paramètres système"
        ordering = ["cle"]

    def __str__(self):
        return self.cle
