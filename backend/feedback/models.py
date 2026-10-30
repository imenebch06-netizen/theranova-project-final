from django.conf import settings
from django.db import models
from django.utils import timezone


class Avis(models.Model):
    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="given_reviews"
    )
    therapeute = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="received_reviews"
    )
    seance = models.ForeignKey(
        "scheduling.Seance", on_delete=models.SET_NULL, null=True, blank=True, related_name="review"
    )
    note = models.PositiveSmallIntegerField()
    commentaire = models.TextField(blank=True)
    visible = models.BooleanField(default=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date_creation"]
        unique_together = ("patient", "therapeute")
        verbose_name = "Avis"
        verbose_name_plural = "Avis"

    def __str__(self):
        return f"{self.patient} → {self.therapeute} : {self.note}/5"

    def save(self, *args, **kwargs):
        if not 1 <= self.note <= 5:
            raise ValueError("La note doit être comprise entre 1 et 5.")
        super().save(*args, **kwargs)
        profile = getattr(self.therapeute, "therapist_profile", None)
        if profile:
            profile.recalculer_note()


class Reclamation(models.Model):
    class Statut(models.TextChoices):
        EN_ATTENTE = "en_attente", "En attente"
        EN_COURS = "en_cours", "En cours"
        RESOLUE = "resolue", "Résolue"
        REJETEE = "rejetee", "Rejetée"

    class Priorite(models.TextChoices):
        BASSE = "basse", "Basse"
        NORMALE = "normale", "Normale"
        HAUTE = "haute", "Haute"

    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reclamations"
    )
    therapeute = models.ForeignKey(
        "accounts.TherapistProfile", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="reclamations",
    )
    categorie = models.CharField(max_length=120)
    message = models.TextField()
    reponse = models.TextField(blank=True)
    statut = models.CharField(max_length=20, choices=Statut.choices, default=Statut.EN_ATTENTE)
    priorite = models.CharField(max_length=20, choices=Priorite.choices, default=Priorite.NORMALE)
    traite_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="reclamations_traitees",
    )
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)
    date_resolution = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-date_creation"]
        indexes = [models.Index(fields=["statut", "priorite"])]
        verbose_name = "Réclamation"
        verbose_name_plural = "Réclamations"

    def __str__(self):
        return f"Réclamation #{self.id} — {self.patient} — {self.get_statut_display()}"


class Report(models.Model):
    class Type(models.TextChoices):
        BUG = "bug", "Bug technique"
        SUGGESTION = "suggestion", "Suggestion"
        CLINIQUE = "clinique", "Incident clinique"
        PAIEMENT = "paiement", "Problème de paiement"

    class Priorite(models.TextChoices):
        NIVEAU_1 = "niveau_1", "Niveau 1 — Standard"
        NIVEAU_2 = "niveau_2", "Niveau 2 — Important"
        NIVEAU_3 = "niveau_3", "Niveau 3 — Critique"

    class Statut(models.TextChoices):
        NOUVEAU = "nouveau", "Nouveau"
        EN_COURS = "en_cours", "En cours"
        RESOLU = "resolu", "Résolu"

    auteur = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reports"
    )
    type = models.CharField(max_length=20, choices=Type.choices, default=Type.BUG)
    sujet = models.CharField(max_length=200)
    message = models.TextField()
    priorite = models.CharField(max_length=20, choices=Priorite.choices, default=Priorite.NIVEAU_1)
    statut = models.CharField(max_length=20, choices=Statut.choices, default=Statut.NOUVEAU)
    reponse = models.TextField(blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date_creation"]
        verbose_name = "Signalement"
        verbose_name_plural = "Signalements"

    def __str__(self):
        return f"{self.get_type_display()} — {self.sujet}"
