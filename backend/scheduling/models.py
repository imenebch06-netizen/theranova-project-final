import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from accounts.models import TherapistProfile


class Creneau(models.Model):
    class Statut(models.TextChoices):
        LIBRE = "libre", "Libre"
        EN_ATTENTE = "en_attente", "En attente"
        RESERVE = "reserve", "Réservé"
        BLOQUE = "bloque", "Bloqué"

    therapeute = models.ForeignKey(TherapistProfile, on_delete=models.CASCADE, related_name="creneaux")
    date_heure_debut = models.DateTimeField()
    date_heure_fin = models.DateTimeField()
    statut = models.CharField(max_length=20, choices=Statut.choices, default=Statut.LIBRE)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["date_heure_debut"]
        constraints = [
            models.UniqueConstraint(
                fields=["therapeute", "date_heure_debut"], name="unique_slot_start_per_therapist"
            )
        ]
        indexes = [
            models.Index(fields=["therapeute", "statut", "date_heure_debut"]),
        ]
        verbose_name = "Créneau"
        verbose_name_plural = "Créneaux"

    def __str__(self):
        return f"{self.therapeute} — {self.date_heure_debut:%d/%m/%Y %H:%M}"

    @property
    def duree_minutes(self):
        return int((self.date_heure_fin - self.date_heure_debut).total_seconds() // 60)

    @property
    def est_passe(self):
        return self.date_heure_fin < timezone.now()


class DemandeRDV(models.Model):
    class Statut(models.TextChoices):
        EN_ATTENTE = "en_attente", "En attente"
        ACCEPTEE = "acceptee", "Acceptée — paiement requis"
        CONFIRMEE = "confirmee", "Confirmée"
        REFUSEE = "refusee", "Refusée"
        ANNULEE = "annulee", "Annulée"
        EXPIREE = "expiree", "Expirée"

    class TypeSession(models.TextChoices):
        INDIVIDUEL = "Individuel", "Individuel"
        COUPLE = "Couple", "Couple"
        FAMILLE = "Famille", "Famille"

    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="demandes_rdv"
    )
    creneau = models.ForeignKey(Creneau, on_delete=models.PROTECT, related_name="demandes")
    type_session = models.CharField(max_length=20, choices=TypeSession.choices, default=TypeSession.INDIVIDUEL)
    statut = models.CharField(max_length=20, choices=Statut.choices, default=Statut.EN_ATTENTE)
    message = models.TextField(blank=True)
    prix_total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    prix_par_participant = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    motif_refus = models.CharField(max_length=255, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_reponse = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-date_creation"]
        indexes = [models.Index(fields=["patient", "statut"])]
        verbose_name = "Demande de rendez-vous"
        verbose_name_plural = "Demandes de rendez-vous"

    def __str__(self):
        return f"Demande #{self.id} — {self.patient} — {self.creneau}"

    @property
    def therapeute(self):
        return self.creneau.therapeute


class ParticipantDemande(models.Model):
    class Statut(models.TextChoices):
        INVITE = "invite", "Invité"
        PAYE = "PAYE", "Payé"
        REFUSE = "REFUSE", "Refusé"

    demande = models.ForeignKey(DemandeRDV, on_delete=models.CASCADE, related_name="participants")
    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="participations_demande",
    )
    email = models.EmailField()
    nom = models.CharField(max_length=150, blank=True)
    statut = models.CharField(max_length=20, choices=Statut.choices, default=Statut.INVITE)
    montant = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    est_createur = models.BooleanField(default=False)
    date_invitation = models.DateTimeField(auto_now_add=True)
    date_paiement = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-est_createur", "date_invitation"]
        verbose_name = "Participant d'une demande"
        verbose_name_plural = "Participants d'une demande"

    def __str__(self):
        return f"{self.nom or self.email} ({self.get_statut_display()})"


class Seance(models.Model):
    class Statut(models.TextChoices):
        PREVUE = "prevue", "Prévue"
        EN_COURS = "en_cours", "En cours"
        TERMINEE = "terminee", "Terminée"
        ANNULEE = "annulee", "Annulée"

    demande = models.OneToOneField(
        DemandeRDV, on_delete=models.SET_NULL, null=True, blank=True, related_name="seance"
    )
    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="patient_sessions"
    )
    therapeute = models.ForeignKey(
        TherapistProfile, on_delete=models.CASCADE, related_name="seances"
    )
    lien_googlemeet = models.URLField(max_length=500, blank=True)
    meet_id = models.CharField(max_length=255, blank=True)
    fournisseur = models.CharField(max_length=30, default="demo")
    statut = models.CharField(max_length=20, choices=Statut.choices, default=Statut.PREVUE)
    date_debut = models.DateTimeField()
    date_fin = models.DateTimeField()
    date_debut_reelle = models.DateTimeField(null=True, blank=True)
    date_fin_reelle = models.DateTimeField(null=True, blank=True)
    type_session = models.CharField(max_length=20, default="Individuel")
    prix_final = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    pack = models.ForeignKey(
        "billing.Pack", on_delete=models.SET_NULL, null=True, blank=True, related_name="seances"
    )
    notes = models.TextField(blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_debut"]
        indexes = [
            models.Index(fields=["therapeute", "statut"]),
            models.Index(fields=["patient", "statut"]),
        ]
        verbose_name = "Séance"
        verbose_name_plural = "Séances"

    def __str__(self):
        return f"Séance #{self.id} — {self.patient} / {self.therapeute} — {self.date_debut:%d/%m/%Y}"

    @property
    def debut_acces(self):
        return self.date_debut - timezone.timedelta(minutes=15)

    @property
    def fin_acces(self):
        return self.date_fin + timezone.timedelta(minutes=30)

    @property
    def accessible_maintenant(self):
        return self.debut_acces <= timezone.now() <= self.fin_acces


class SessionParticipant(models.Model):
    class Statut(models.TextChoices):
        PAYE = "PAYE", "Payé"
        REFUSE = "REFUSE", "Refusé"
        INVITE = "invite", "Invité"

    seance = models.ForeignKey(Seance, on_delete=models.CASCADE, related_name="participants")
    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="session_participations",
    )
    email = models.EmailField()
    nom = models.CharField(max_length=150, blank=True)
    statut = models.CharField(max_length=20, choices=Statut.choices, default=Statut.PAYE)
    a_rejoint = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["id"]
        verbose_name = "Participant de séance"
        verbose_name_plural = "Participants de séance"

    def __str__(self):
        return f"{self.nom or self.email} — {self.get_statut_display()}"


class GoogleMeetSession(models.Model):
    """Mirror of the external Google Meet session (report: GoogleMeet_Sessions)."""

    class Statut(models.TextChoices):
        CREE = "cree", "Créé"
        EN_COURS = "en_cours", "En cours"
        TERMINE = "termine", "Terminé"

    seance = models.OneToOneField(Seance, on_delete=models.CASCADE, related_name="meet_session")
    meet_link = models.URLField(max_length=500)
    meet_id = models.CharField(max_length=255, blank=True)
    statut = models.CharField(max_length=20, choices=Statut.choices, default=Statut.CREE)
    date_creation = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Meet {self.meet_id}"


def generate_meeting():
    code = uuid.uuid4().hex[:10]
    meet_id = f"theranova-{code}"
    link = f"https://meet.google.com/{code[:3]}-{code[3:7]}-{code[7:10]}"
    return meet_id, link
