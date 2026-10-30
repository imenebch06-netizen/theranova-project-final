import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class Pack(models.Model):
    nom_pack = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    prix = models.DecimalField(max_digits=10, decimal_places=2)
    nb_sessions = models.PositiveIntegerField()
    duree_jours = models.PositiveIntegerField(default=60, help_text="Validité de l'abonnement")
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)
    ordre = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["ordre", "nb_sessions"]
        verbose_name = "Pack"
        verbose_name_plural = "Packs"

    def __str__(self):
        return f"{self.nom_pack} ({self.nb_sessions} séances)"

    @property
    def prix_unitaire(self):
        return round(self.prix / self.nb_sessions, 2) if self.nb_sessions else 0


class Abonnement(models.Model):
    class Statut(models.TextChoices):
        ACTIF = "actif", "Actif"
        INACTIF = "inactif", "Inactif"
        EXPIRE = "expire", "Expiré"

    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="abonnements"
    )
    pack = models.ForeignKey(Pack, on_delete=models.PROTECT, related_name="abonnements")
    solde_restants = models.PositiveIntegerField(default=0)
    statut = models.CharField(max_length=20, choices=Statut.choices, default=Statut.ACTIF)
    date_debut = models.DateField(default=timezone.localdate)
    date_fin = models.DateField()
    prix_paye = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_creation"]
        verbose_name = "Abonnement"
        verbose_name_plural = "Abonnements"

    def __str__(self):
        return f"{self.patient} — {self.pack.nom_pack} ({self.solde_restants} restantes)"

    def consommer(self, quantite=1):
        if self.solde_restants < quantite:
            return False
        self.solde_restants -= quantite
        if self.solde_restants == 0:
            self.statut = self.Statut.INACTIF
        self.save(update_fields=["solde_restants", "statut"])
        return True

    @property
    def actif(self):
        return self.statut == self.Statut.ACTIF and self.date_fin >= timezone.localdate()


class Transaction(models.Model):
    class Type(models.TextChoices):
        PACK = "Pack", "Pack"
        SEANCE = "Seance", "Séance"
        ABONNEMENT = "Abonnement", "Abonnement"
        REMBOURSEMENT = "Remboursement", "Remboursement"

    class Statut(models.TextChoices):
        OK = "OK", "Réussie"
        ECHEC = "ECHEC", "Échouée"
        REMBOURSEE = "REMBOURSEE", "Remboursée"

    class Methode(models.TextChoices):
        CARTE = "carte", "Carte Edahabia"
        BARIDIMOB = "baridimob", "BaridiMob"
        CIB = "cib", "CIB"
        CREDIT = "credit", "Crédit TheraNova"
        SIMULE = "simule", "Paiement simulé"

    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="transactions"
    )
    montant = models.DecimalField(max_digits=10, decimal_places=2)
    type = models.CharField(max_length=20, choices=Type.choices)
    statut = models.CharField(max_length=20, choices=Statut.choices, default=Statut.OK)
    methode = models.CharField(max_length=20, choices=Methode.choices, default=Methode.SIMULE)
    reference = models.CharField(max_length=40, unique=True, blank=True)
    idempotency_key = models.CharField(max_length=80, unique=True, null=True, blank=True)
    pack = models.ForeignKey(Pack, on_delete=models.SET_NULL, null=True, blank=True)
    abonnement = models.ForeignKey(Abonnement, on_delete=models.SET_NULL, null=True, blank=True)
    seance = models.ForeignKey(
        "scheduling.Seance", on_delete=models.SET_NULL, null=True, blank=True, related_name="transactions"
    )
    metadata = models.JSONField(default=dict, blank=True)
    date_transaction = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_transaction"]
        indexes = [models.Index(fields=["patient", "statut", "date_transaction"])]
        verbose_name = "Transaction"
        verbose_name_plural = "Transactions"

    def __str__(self):
        return f"{self.reference} — {self.montant} DA — {self.get_statut_display()}"

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = f"TN-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    @property
    def facture_numero(self):
        return f"FAC-{self.date_transaction:%Y%m}-{self.id:05d}"
