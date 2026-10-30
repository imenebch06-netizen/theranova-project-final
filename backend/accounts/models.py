from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("L'adresse email est obligatoire.")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", "admin")
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Un superutilisateur doit avoir is_staff=True.")
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    """Single identity table with a role discriminator (RBAC)."""

    class Role(models.TextChoices):
        PATIENT = "patient", "Patient"
        THERAPIST = "therapist", "Thérapeute"
        ADMIN = "admin", "Administrateur"

    username = None
    email = models.EmailField("email", unique=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.PATIENT)
    phone = models.CharField(max_length=30, blank=True)
    language = models.CharField(max_length=5, default="fr", choices=[("fr", "Français"), ("en", "English"), ("ar", "العربية")])
    avatar = models.URLField(max_length=500, blank=True)
    last_seen = models.DateTimeField(null=True, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]
    EMAIL_FIELD = "email"

    objects = UserManager()

    class Meta:
        ordering = ["-date_joined"]
        verbose_name = "Utilisateur"
        verbose_name_plural = "Utilisateurs"

    def __str__(self):
        return f"{self.get_full_name() or self.email} ({self.get_role_display()})"

    @property
    def full_name(self):
        return self.get_full_name() or self.email

    @property
    def is_patient(self):
        return self.role == self.Role.PATIENT

    @property
    def is_therapist(self):
        return self.role == self.Role.THERAPIST

    @property
    def is_admin(self):
        return self.role == self.Role.ADMIN or self.is_staff


class Specialite(models.Model):
    code = models.SlugField(max_length=60, unique=True)
    nom = models.CharField(max_length=120, unique=True)
    nom_en = models.CharField(max_length=120, blank=True)
    description = models.TextField(blank=True)
    icone = models.CharField(max_length=50, blank=True)

    class Meta:
        ordering = ["nom"]
        verbose_name = "Spécialité"
        verbose_name_plural = "Spécialités"

    def __str__(self):
        return self.nom


class SousSpecialite(models.Model):
    specialite = models.ForeignKey(Specialite, on_delete=models.CASCADE, related_name="sous_specialites")
    nom = models.CharField(max_length=120)
    nom_en = models.CharField(max_length=120, blank=True)

    class Meta:
        unique_together = ("specialite", "nom")
        ordering = ["specialite__nom", "nom"]
        verbose_name = "Sous-spécialité"
        verbose_name_plural = "Sous-spécialités"

    def __str__(self):
        return f"{self.specialite.nom} › {self.nom}"


class PatientProfile(models.Model):
    SEXE_CHOICES = [("F", "Femme"), ("M", "Homme"), ("N", "Non précisé")]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="patient_profile")
    date_naissance = models.DateField(null=True, blank=True)
    sexe = models.CharField(max_length=1, choices=SEXE_CHOICES, default="N")
    ville = models.CharField(max_length=100, blank=True)
    is_student = models.BooleanField(default=True)
    university = models.CharField(max_length=150, blank=True)
    occupation = models.CharField(max_length=150, blank=True)
    emergency_contact = models.CharField(max_length=150, blank=True)
    solde = models.PositiveIntegerField(default=0)
    preferences = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = "Profil patient"
        verbose_name_plural = "Profils patients"

    def __str__(self):
        return self.user.full_name

    @property
    def age(self):
        from django.utils import timezone

        if not self.date_naissance:
            return None
        today = timezone.localdate()
        return today.year - self.date_naissance.year - (
            (today.month, today.day) < (self.date_naissance.month, self.date_naissance.day)
        )


class TherapistProfile(models.Model):
    class Statut(models.TextChoices):
        PENDING = "en_attente", "En attente"
        ACTIVE = "actif", "Actif"
        SUSPENDED = "suspendu", "Suspendu"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="therapist_profile")
    statut = models.CharField(max_length=20, choices=Statut.choices, default=Statut.PENDING)
    disponibilite_active = models.BooleanField(default=True)
    note_globale = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    nombre_avis = models.PositiveIntegerField(default=0)
    bio = models.TextField(blank=True)
    approche = models.CharField(max_length=200, blank=True)
    annees_experience = models.PositiveIntegerField(default=0)
    diplomes = models.TextField(blank=True)
    langues = models.JSONField(default=list, blank=True)
    types_sessions = models.JSONField(default=list, blank=True)
    tarif_seance = models.DecimalField(max_digits=10, decimal_places=2, default=2500)
    duree_seance = models.PositiveSmallIntegerField(default=60)
    pause_entre_seances = models.PositiveSmallIntegerField(default=10)
    ville = models.CharField(max_length=100, blank=True)
    cabinet = models.CharField(max_length=200, blank=True)
    numero_licence = models.CharField(max_length=100, blank=True)
    specialites = models.ManyToManyField(
        Specialite, through="TherapeuteSpecialite", related_name="therapeutes", blank=True
    )
    verifie = models.BooleanField(default=False)
    date_validation = models.DateTimeField(null=True, blank=True)
    motif_suspension = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-note_globale", "user__last_name"]
        verbose_name = "Profil thérapeute"
        verbose_name_plural = "Profils thérapeutes"

    def __str__(self):
        return f"Dr {self.user.full_name}"

    @property
    def nom_complet(self):
        return f"Dr {self.user.get_full_name()}"

    def recalculer_note(self):
        from django.db.models import Avg

        result = self.user.received_reviews.aggregate(avg=Avg("note"), total=models.Count("id"))
        self.note_globale = round(result["avg"] or 0, 2)
        self.nombre_avis = result["total"] or 0
        self.save(update_fields=["note_globale", "nombre_avis"])


class TherapeuteSpecialite(models.Model):
    therapeute = models.ForeignKey(TherapistProfile, on_delete=models.CASCADE)
    specialite = models.ForeignKey(Specialite, on_delete=models.CASCADE)

    class Meta:
        unique_together = ("therapeute", "specialite")
        verbose_name = "Spécialité du thérapeute"
        verbose_name_plural = "Spécialités des thérapeutes"

    def __str__(self):
        return f"{self.therapeute} — {self.specialite}"
