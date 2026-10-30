from django.conf import settings
from django.db import models


class DossierPatient(models.Model):
    class Statut(models.TextChoices):
        ACTIF = "actif", "Actif"
        ARCHIVE = "archive", "Archivé"

    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="dossiers_patient"
    )
    therapeute = models.ForeignKey(
        "accounts.TherapistProfile", on_delete=models.CASCADE, related_name="dossiers"
    )
    statut = models.CharField(max_length=20, choices=Statut.choices, default=Statut.ACTIF)
    motif_consultation = models.CharField(max_length=255, blank=True)
    plan_therapeutique = models.TextField(blank=True)
    objectifs = models.JSONField(default=list, blank=True)
    date_ouverture = models.DateField(auto_now_add=True)
    date_archivage = models.DateTimeField(null=True, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("patient", "therapeute")
        ordering = ["-date_modification"]
        verbose_name = "Dossier patient"
        verbose_name_plural = "Dossiers patients"

    def __str__(self):
        return f"Dossier {self.patient} — {self.therapeute}"

    @property
    def objectifs_atteints(self):
        return sum(1 for item in self.objectifs or [] if item.get("statut") == "atteint")

    @property
    def progression(self):
        if not self.objectifs:
            return 0
        return round(self.objectifs_atteints / len(self.objectifs) * 100)


class NoteClinique(models.Model):
    class Type(models.TextChoices):
        SEANCE = "seance", "Compte-rendu de séance"
        SUIVI = "suivi", "Note de suivi"
        URGENCE = "urgence", "Observation urgente"

    dossier = models.ForeignKey(DossierPatient, on_delete=models.CASCADE, related_name="notes")
    seance = models.ForeignKey(
        "scheduling.Seance", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="clinical_notes",
    )
    therapeute = models.ForeignKey(
        "accounts.TherapistProfile", on_delete=models.CASCADE, related_name="notes_cliniques"
    )
    type = models.CharField(max_length=20, choices=Type.choices, default=Type.SEANCE)
    contenu = models.TextField()
    prive = models.BooleanField(default=True, help_text="Visible uniquement par le praticien")
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date_creation"]
        verbose_name = "Note clinique"
        verbose_name_plural = "Notes cliniques"

    def __str__(self):
        return f"Note #{self.id} — {self.dossier.patient}"


class RapportSeance(models.Model):
    """Structured session report filled by the therapist after a session."""

    seance = models.OneToOneField(
        "scheduling.Seance", on_delete=models.CASCADE, related_name="rapport"
    )
    therapeute = models.ForeignKey(
        "accounts.TherapistProfile", on_delete=models.CASCADE, related_name="rapports"
    )
    objectifs_seance = models.TextField(blank=True)
    observations = models.TextField(blank=True)
    evolution = models.CharField(
        max_length=20,
        choices=[("amelioration", "Amélioration"), ("stable", "Stable"), ("degradation", "Dégradation")],
        default="stable",
    )
    exercices = models.TextField(blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_creation"]
        verbose_name = "Rapport de séance"
        verbose_name_plural = "Rapports de séance"

    def __str__(self):
        return f"Rapport séance #{self.seance_id}"
