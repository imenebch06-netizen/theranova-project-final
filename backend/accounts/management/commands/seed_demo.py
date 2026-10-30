"""Seed TheraNova with a coherent, demo-ready dataset.

Usage:
    python manage.py seed_demo            # only if not already seeded
    python manage.py seed_demo --force    # flush all data and reseed

Demo accounts (password between parentheses):
    admin@theranova.dz      (Admin123!)
    patient@theranova.dz    (Patient123!)
    therapist@theranova.dz  (Therapist123!)
    karim@theranova.dz      (Patient123!)
"""
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import (
    PatientProfile,
    Specialite,
    SousSpecialite,
    TherapistProfile,
    User,
)
from billing.models import Abonnement, Pack, Transaction
from clinical.models import DossierPatient, NoteClinique, RapportSeance
from core.models import SystemParameter
from feedback.models import Avis, Reclamation, Report
from matching.models import (
    Categorie,
    Question,
    QuestionnaireSession,
    ReponseProposee,
    ReponsePatient,
    SousCategorie,
)
from matching.services import build_summary, compute_specialty_scores, recommend_therapists
from messaging.models import Conversation, Message, Notification
from scheduling.models import (
    Creneau,
    DemandeRDV,
    GoogleMeetSession,
    ParticipantDemande,
    Seance,
    SessionParticipant,
)
from wellbeing.models import HumeurEntry
from wellbeing.services import generate_message

SEED_VERSION = "1.0"

SPECIALTIES = [
    ("anxiete", "Anxiété & Gestion du stress", "Anxiety & Stress", "heart-pulse"),
    ("depression", "Dépression & Épuisement", "Depression & Burnout", "cloud-rain"),
    ("couple", "Thérapie de couple", "Couples Therapy", "heart-handshake"),
    ("famille", "Thérapie familiale", "Family Therapy", "users"),
    ("trauma", "Traumatismes & PTSD", "Trauma & PTSD", "shield"),
    ("addiction", "Addictions", "Addictions", "activity"),
    ("orientation", "Orientation & Carrière", "Career & Guidance", "compass"),
    ("confiance", "Confiance & Estime de soi", "Self-esteem", "sparkles"),
]

QUESTIONS = [
    # (category, subcategory, question, [(label, score, weights)], category_index)
    ("État émotionnel", "Anxiété", "Ces dernières semaines, à quelle fréquence vous sentez-vous submergé(e) par l'anxiété ?", [
        ("Jamais", 0, {}),
        ("Rarement", 1, {"anxiete": 1}),
        ("Parfois", 2, {"anxiete": 2}),
        ("Souvent", 3, {"anxiete": 3, "depression": 1}),
        ("Quasiment tous les jours", 4, {"anxiete": 4, "depression": 1}),
    ]),
    ("État émotionnel", "Humeur", "Comment décririez-vous votre humeur générale ?", [
        ("Très bonne", 0, {}),
        ("Plutôt bonne", 1, {"confiance": 1}),
        ("Variable", 2, {"anxiete": 1, "depression": 1}),
        ("Plutôt basse", 3, {"depression": 2, "confiance": 1}),
        ("Très basse", 4, {"depression": 3}),
    ]),
    ("État émotionnel", "Sommeil", "Avez-vous des difficultés à trouver le sommeil ou à vous concentrer ?", [
        ("Jamais", 0, {}),
        ("Parfois", 1, {"anxiete": 1}),
        ("Souvent", 2, {"anxiete": 2, "depression": 1}),
        ("Presque chaque nuit", 3, {"anxiete": 2, "depression": 2}),
        ("Chaque nuit, avec épuisement", 4, {"depression": 3, "anxiete": 1}),
    ]),
    ("État émotionnel", "Motivation", "Avez-vous perdu l'intérêt pour des activités que vous aimiez auparavant ?", [
        ("Pas du tout", 0, {}),
        ("Légèrement", 1, {"depression": 1}),
        ("Nettement", 2, {"depression": 2}),
        ("Complètement", 3, {"depression": 3}),
    ]),
    ("État émotionnel", "Estime de soi", "Comment évaluez-vous la confiance que vous avez en vous ?", [
        ("Solide", 0, {}),
        ("Variable", 1, {"confiance": 1}),
        ("Faible", 2, {"confiance": 2, "depression": 1}),
        ("Très faible", 3, {"confiance": 3, "depression": 1}),
    ]),
    ("Relations & environnement", "Couple", "Vivez-vous des tensions ou des conflits récurrents dans votre couple ?", [
        ("Pas concerné(e)", 0, {}),
        ("Quelques tensions", 1, {"couple": 1}),
        ("Conflits fréquents", 2, {"couple": 2}),
        ("Crise ou rupture", 3, {"couple": 3, "depression": 1}),
        ("Violence conjugale", 4, {"couple": 3, "trauma": 1}),
    ]),
    ("Relations & environnement", "Famille", "Les relations familiales sont-elles une source de souffrance actuellement ?", [
        ("Pas concerné(e)", 0, {}),
        ("Tensions ponctuelles", 1, {"famille": 1}),
        ("Conflits récurrents", 2, {"famille": 2}),
        ("Souffrance importante", 3, {"famille": 3}),
        ("Violence ou rupture familiale", 4, {"famille": 3, "trauma": 2}),
    ]),
    ("Relations & environnement", "Soutien social", "Votre entourage vous apporte-t-il un soutien suffisant ?", [
        ("Oui, solide", 0, {}),
        ("Présent mais limité", 1, {}),
        ("Faible", 2, {"depression": 1, "confiance": 1}),
        ("Absent", 3, {"depression": 2, "confiance": 1}),
    ]),
    ("Événements & comportements", "Trauma", "Avez-vous vécu un événement difficile ou traumatisant qui vous pèse encore ?", [
        ("Non", 0, {}),
        ("Un événement ancien", 1, {"trauma": 1}),
        ("Encore douloureux", 2, {"trauma": 2, "anxiete": 1}),
        ("Cauchemars ou flashbacks", 3, {"trauma": 3, "anxiete": 1}),
        ("Événement récent et envahissant", 4, {"trauma": 4, "anxiete": 2, "depression": 1}),
    ]),
    ("Événements & comportements", "Addictions", "Consommez-vous une substance ou un comportement de façon problématique ?", [
        ("Non", 0, {}),
        ("Occasionnellement", 1, {"addiction": 1}),
        ("Difficulté à arrêter", 2, {"addiction": 2}),
        ("Dépendance installée", 3, {"addiction": 3}),
        ("Retentissement important sur ma vie", 4, {"addiction": 4, "depression": 1}),
    ]),
    ("Avenir & quotidien", "Stress académique", "Comment vivez-vous la pression de vos études ou de votre travail ?", [
        ("Sereinement", 0, {}),
        ("Pression modérée", 1, {"anxiete": 1, "orientation": 1}),
        ("Stress important", 2, {"anxiete": 2}),
        ("Épuisement", 3, {"depression": 2, "anxiete": 2}),
        ("Burnout", 4, {"depression": 3, "anxiete": 2}),
    ]),
    ("Avenir & quotidien", "Orientation", "Vos choix d'orientation ou de carrière sont-ils une source de difficulté ?", [
        ("Tout est clair", 0, {}),
        ("Quelques doutes", 1, {"orientation": 1}),
        ("Je me sens perdu(e)", 2, {"orientation": 2, "anxiete": 1}),
        ("Blocage dans mes décisions", 3, {"orientation": 3, "anxiete": 1}),
        ("Réorientation subie", 4, {"orientation": 3, "confiance": 1, "depression": 1}),
    ]),
]

# English translations keyed by the canonical French wording.
CATEGORY_EN = {
    "État émotionnel": "Emotional state",
    "Relations & environnement": "Relationships & environment",
    "Événements & comportements": "Events & behaviours",
    "Avenir & quotidien": "Future & daily life",
}

SUBCATEGORY_EN = {
    "Anxiété": "Anxiety",
    "Humeur": "Mood",
    "Sommeil": "Sleep",
    "Motivation": "Motivation",
    "Estime de soi": "Self-esteem",
    "Couple": "Couples",
    "Famille": "Family",
    "Soutien social": "Social support",
    "Trauma": "Trauma",
    "Addictions": "Addictions",
    "Stress académique": "Academic stress",
    "Orientation": "Career guidance",
}

QUESTION_TRANSLATIONS = {
    "Ces dernières semaines, à quelle fréquence vous sentez-vous submergé(e) par l'anxiété ?": (
        "Over the past few weeks, how often have you felt overwhelmed by anxiety?",
        {
            "Jamais": "Never",
            "Rarement": "Rarely",
            "Parfois": "Sometimes",
            "Souvent": "Often",
            "Quasiment tous les jours": "Almost every day",
        },
    ),
    "Comment décririez-vous votre humeur générale ?": (
        "How would you describe your general mood?",
        {
            "Très bonne": "Very good",
            "Plutôt bonne": "Fairly good",
            "Variable": "Variable",
            "Plutôt basse": "Fairly low",
            "Très basse": "Very low",
        },
    ),
    "Avez-vous des difficultés à trouver le sommeil ou à vous concentrer ?": (
        "Do you have difficulty falling asleep or concentrating?",
        {
            "Jamais": "Never",
            "Parfois": "Sometimes",
            "Souvent": "Often",
            "Presque chaque nuit": "Almost every night",
            "Chaque nuit, avec épuisement": "Every night, with exhaustion",
        },
    ),
    "Avez-vous perdu l'intérêt pour des activités que vous aimiez auparavant ?": (
        "Have you lost interest in activities you used to enjoy?",
        {
            "Pas du tout": "Not at all",
            "Légèrement": "Slightly",
            "Nettement": "Markedly",
            "Complètement": "Completely",
        },
    ),
    "Comment évaluez-vous la confiance que vous avez en vous ?": (
        "How would you rate your self-confidence?",
        {
            "Solide": "Solid",
            "Variable": "Variable",
            "Faible": "Low",
            "Très faible": "Very low",
        },
    ),
    "Vivez-vous des tensions ou des conflits récurrents dans votre couple ?": (
        "Are you experiencing recurring tension or conflict in your relationship?",
        {
            "Pas concerné(e)": "Not applicable",
            "Quelques tensions": "Some tension",
            "Conflits fréquents": "Frequent conflicts",
            "Crise ou rupture": "Crisis or breakup",
            "Violence conjugale": "Domestic violence",
        },
    ),
    "Les relations familiales sont-elles une source de souffrance actuellement ?": (
        "Are family relationships currently a source of distress?",
        {
            "Pas concerné(e)": "Not applicable",
            "Tensions ponctuelles": "Occasional tension",
            "Conflits récurrents": "Recurring conflicts",
            "Souffrance importante": "Significant distress",
            "Violence ou rupture familiale": "Violence or family breakdown",
        },
    ),
    "Votre entourage vous apporte-t-il un soutien suffisant ?": (
        "Does your circle provide you with sufficient support?",
        {
            "Oui, solide": "Yes, strong",
            "Présent mais limité": "Present but limited",
            "Faible": "Weak",
            "Absent": "Absent",
        },
    ),
    "Avez-vous vécu un événement difficile ou traumatisant qui vous pèse encore ?": (
        "Have you experienced a difficult or traumatic event that still weighs on you?",
        {
            "Non": "No",
            "Un événement ancien": "A past event",
            "Encore douloureux": "Still painful",
            "Cauchemars ou flashbacks": "Nightmares or flashbacks",
            "Événement récent et envahissant": "Recent, overwhelming event",
        },
    ),
    "Consommez-vous une substance ou un comportement de façon problématique ?": (
        "Do you use a substance or engage in a behaviour in a problematic way?",
        {
            "Non": "No",
            "Occasionnellement": "Occasionally",
            "Difficulté à arrêter": "Difficulty stopping",
            "Dépendance installée": "Established dependence",
            "Retentissement important sur ma vie": "Major impact on my life",
        },
    ),
    "Comment vivez-vous la pression de vos études ou de votre travail ?": (
        "How do you experience the pressure of your studies or work?",
        {
            "Sereinement": "Calmly",
            "Pression modérée": "Moderate pressure",
            "Stress important": "Significant stress",
            "Épuisement": "Exhaustion",
            "Burnout": "Burnout",
        },
    ),
    "Vos choix d'orientation ou de carrière sont-ils une source de difficulté ?": (
        "Are your study or career choices a source of difficulty?",
        {
            "Tout est clair": "Everything is clear",
            "Quelques doutes": "Some doubts",
            "Je me sens perdu(e)": "I feel lost",
            "Blocage dans mes décisions": "Stuck in my decisions",
            "Réorientation subie": "Forced career change",
        },
    ),
}

THERAPISTS = [
    {
        "email": "therapist@theranova.dz", "first": "Nabil", "last": "Cherif",
        "codes": ["anxiete", "depression", "confiance"], "types": ["Individuel"],
        "years": 12, "price": 2800, "ville": "Béjaïa", "langues": ["Français", "English", "العربية"],
        "approche": "Thérapie cognitive et comportementale (TCC)",
        "bio": "Psychologue clinicien diplômé de l'Université de Béjaïa, je propose une psychothérapie structurée et chaleureuse. Mon approche TCC aide à transformer les pensées anxieuses en ressources concrètes, séance après séance.",
        "diplomes": "Master en Psychologie Clinique — Université de Béjaïa\nFormation TCC — Institut Algérien de Psychothérapie",
        "cabinet": "Cabinet TheraNova — Centre-ville, Béjaïa",
    },
    {
        "email": "imene.bouchareb@theranova.dz", "first": "Samira", "last": "Lemdani",
        "codes": ["couple", "famille", "confiance"], "types": ["Individuel", "Couple", "Famille"],
        "years": 9, "price": 3000, "ville": "Alger", "langues": ["Français", "العربية"],
        "approche": "Thérapie systémique et communication non violente",
        "bio": "Spécialiste des dynamiques relationnelles, j'accompagne les couples et les familles vers une communication apaisée. Mon cadre bienveillant permet à chacun de retrouver sa place.",
        "diplomes": "Master en Psychologie Clinique — Université d'Alger 2\nCertification en thérapie systémique",
        "cabinet": "Cabinet TheraNova — Hydra, Alger",
    },
    {
        "email": "yasmine.khaled@theranova.dz", "first": "Farid", "last": "Oubelaid",
        "codes": ["trauma", "anxiete"], "types": ["Individuel"],
        "years": 7, "price": 3200, "ville": "Béjaïa", "langues": ["Français", "English"],
        "approche": "EMDR et thérapie centrée sur le trauma",
        "bio": "Formé à l'EMDR, j'accompagne les personnes ayant vécu des événements difficiles. Mon travail vise à apaiser les souvenirs envahissants et à restaurer un sentiment de sécurité.",
        "diplomes": "Master en Psychologie Clinique — Université de Tizi Ouzou\nFormation EMDR Europe",
        "cabinet": "Cabinet TheraNova — Béjaïa",
    },
    {
        "email": "rayane.taraft@theranova.dz", "first": "Wassila", "last": "Ziani",
        "codes": ["orientation", "confiance", "anxiete"], "types": ["Individuel"],
        "years": 5, "price": 2500, "ville": "Béjaïa", "langues": ["Français", "English", "العربية"],
        "approche": "Approche humaniste et coaching de carrière",
        "bio": "J'accompagne les étudiants et jeunes professionnels dans leurs choix d'orientation. Ensemble, nous transformons le doute en plan d'action réaliste et aligné avec vos valeurs.",
        "diplomes": "Master en Psychologie du Travail — Université de Béjaïa\nCertification en orientation professionnelle",
        "cabinet": "Cabinet TheraNova — Campus ESTIN, Béjaïa",
    },
    {
        "email": "dalia.serrir@theranova.dz", "first": "Mourad", "last": "Belkhir",
        "codes": ["depression", "addiction"], "types": ["Individuel"],
        "years": 10, "price": 2700, "ville": "Oran", "langues": ["Français", "العربية"],
        "approche": "Thérapie motivationnelle et prévention de la rechute",
        "bio": "Je reçois depuis dix ans des personnes traversant des épisodes dépressifs ou des addictions. Mon approche combine écoute active, objectifs concrets et soutien à la motivation.",
        "diplomes": "Master en Psychologie Clinique — Université d'Oran 2\nFormation en entretien motivationnel",
        "cabinet": "Cabinet TheraNova — Oran",
    },
    {
        "email": "angela.tienderebeogo@theranova.dz", "first": "Hana", "last": "Ferhat",
        "codes": ["famille", "couple", "trauma"], "types": ["Individuel", "Couple", "Famille"],
        "years": 8, "price": 2600, "ville": "Béjaïa", "langues": ["Français", "English"],
        "approche": "Thérapie familiale et approche narrative",
        "bio": "J'aide les familles à retrouver un dialogue apaisé, en particulier lors des transitions de vie. Mon approche narrative redonne à chacun le pouvoir de réécrire son histoire.",
        "diplomes": "Master en Psychologie Clinique — Université de Béjaïa\nFormation en thérapie narrative",
        "cabinet": "Cabinet TheraNova — Akbou, Béjaïa",
    },
]

PACKS = [
    ("Séance individuelle", "Une séance de 50 à 60 minutes pour faire le point ou démarrer un suivi.", Decimal("2500"), 1, 30, False, 1),
    ("Pack 5 séances", "Cinq séances individuelles, à répartir sur 1 à 2 mois selon vos besoins.", Decimal("9000"), 5, 60, True, 2),
    ("Pack 10 séances", "Dix séances pour un suivi complet et continu sur 2 à 3 mois.", Decimal("16500"), 10, 90, False, 3),
]

COMPLAINTS = [
    {
        "patient": "karim@theranova.dz", "categorie": "Problème technique",
        "message": "Le lien de visioconférence ne s'ouvrait pas 10 minutes avant ma séance. J'ai dû appeler le cabinet.",
        "priorite": "haute", "statut": "en_attente", "reponse": "",
    },
    {
        "patient": "lina@theranova.dz", "categorie": "Paiement",
        "message": "J'ai été débitée deux fois pour le pack 5 séances. Merci de vérifier ma situation.",
        "priorite": "haute", "statut": "en_cours",
        "reponse": "Nous avons identifié un doublon et lancé le remboursement sous 48 h.",
    },
    {
        "patient": "sofiane@theranova.dz", "categorie": "Qualité de service",
        "message": "Je souhaiterais changer de thérapeute pour une approche plus directive.",
        "priorite": "normale", "statut": "resolue",
        "reponse": "Votre demande a été prise en compte : un nouveau rendez-vous vous a été proposé.",
    },
]


class Command(BaseCommand):
    help = "Create TheraNova demo data (accounts, questionnaire, bookings, payments, moods...)."

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true", help="Flush existing data before seeding.")

    @transaction.atomic
    def handle(self, *args, **options):
        marker = SystemParameter.objects.filter(cle="seed_version").first()
        if marker and not options["force"]:
            self.stdout.write(self.style.WARNING(
                "Demo data already present. Use --force to reset and reseed."
            ))
            return

        if options["force"] or marker:
            call_command("flush", "--noinput", verbosity=0)
            self.stdout.write("Database flushed.")

        now = timezone.now()
        today = timezone.localdate()

        # ------------------------------------------------------------------
        # Specialties
        # ------------------------------------------------------------------
        specialties = {}
        for code, nom, nom_en, icon in SPECIALTIES:
            specialite, _ = Specialite.objects.update_or_create(
                code=code, defaults={"nom": nom, "nom_en": nom_en, "icone": icon}
            )
            specialties[code] = specialite

        SousSpecialite.objects.bulk_create([
            SousSpecialite(specialite=specialties["anxiete"], nom="Troubles paniques", nom_en="Panic disorders"),
            SousSpecialite(specialite=specialties["depression"], nom="Burnout étudiant", nom_en="Student burnout"),
            SousSpecialite(specialite=specialties["couple"], nom="Communication", nom_en="Communication"),
            SousSpecialite(specialite=specialties["trauma"], nom="Deuil", nom_en="Grief"),
        ], ignore_conflicts=True)

        # ------------------------------------------------------------------
        # Users
        # ------------------------------------------------------------------
        admin = User.objects.create_user(
            email="admin@theranova.dz", password="Admin123!", first_name="Karima",
            last_name="Soltani", role=User.Role.ADMIN, is_staff=True, is_superuser=True,
            phone="+213 550 00 00 01", language="fr", avatar="",
        )

        therapist_profiles = {}
        for index, data in enumerate(THERAPISTS):
            password = "Therapist123!" if data["email"] == "therapist@theranova.dz" else "Demo12345!"
            user = User.objects.create_user(
                email=data["email"], password=password,
                first_name=data["first"], last_name=data["last"],
                role=User.Role.THERAPIST, phone=f"+213 550 10 00 {index:02d}",
                language="fr",
                avatar=f"https://api.dicebear.com/9.x/notionists/svg?seed={data['first']}{data['last']}&backgroundColor=ccd5b5",
            )
            profile = TherapistProfile.objects.create(
                user=user,
                statut=TherapistProfile.Statut.ACTIVE,
                disponibilite_active=True,
                bio=data["bio"],
                approche=data["approche"],
                annees_experience=data["years"],
                diplomes=data["diplomes"],
                langues=data["langues"],
                types_sessions=data["types"],
                tarif_seance=Decimal(data["price"]),
                ville=data["ville"],
                cabinet=data["cabinet"],
                numero_licence=f"PSY-{1000 + index}",
                verifie=True,
                date_validation=now - timedelta(days=90 - index * 5),
            )
            profile.specialites.set([specialties[code] for code in data["codes"]])
            therapist_profiles[data["email"]] = profile

        patients_data = [
            ("patient@theranova.dz", "Salma", "Boudiaf", "F", today - timedelta(days=365 * 23 + 120),
             "Étudiante en 2e année — ESTIN", True, "Béjaïa", 2,
             "https://api.dicebear.com/9.x/notionists/svg?seed=SalmaBoudiaf&backgroundColor=ccd5b5"),
            ("karim@theranova.dz", "Anis", "Gherbi", "M", today - timedelta(days=365 * 26 + 45),
             "Ingénieur logiciel", False, "Alger", 0,
             "https://api.dicebear.com/9.x/notionists/svg?seed=AnisGherbi&backgroundColor=ccd5b5"),
            ("lina@theranova.dz", "Rania", "Touati", "F", today - timedelta(days=365 * 21 + 200),
             "Étudiante en médecine", True, "Tizi Ouzou", 3,
             "https://api.dicebear.com/9.x/notionists/svg?seed=RaniaTouati&backgroundColor=ccd5b5"),
            ("sofiane@theranova.dz", "Yacine", "Boumediene", "M", today - timedelta(days=365 * 29 + 12),
             "Chargé de projet", False, "Béjaïa", 0,
             "https://api.dicebear.com/9.x/notionists/svg?seed=YacineBoumediene&backgroundColor=ccd5b5"),
        ]
        patients = {}
        for email, first, last, sexe, birth, occupation, student, ville, solde, avatar in patients_data:
            user = User.objects.create_user(
                email=email, password="Patient123!", first_name=first, last_name=last,
                role=User.Role.PATIENT, phone="+213 550 20 00 00", language="fr", avatar=avatar,
            )
            patients[email] = PatientProfile.objects.create(
                user=user, date_naissance=birth, sexe=sexe, ville=ville,
                is_student=student, university="ESTIN Béjaïa" if student else "",
                occupation=occupation, solde=solde,
            )

        # ------------------------------------------------------------------
        # Questionnaire
        # ------------------------------------------------------------------
        categories = {}
        for name, icon, order in [
            ("État émotionnel", "heart-pulse", 1),
            ("Relations & environnement", "users", 2),
            ("Événements & comportements", "shield", 3),
            ("Avenir & quotidien", "compass", 4),
        ]:
            categories[name], _ = Categorie.objects.update_or_create(
                nom=name,
                defaults={"nom_en": CATEGORY_EN[name], "icone": icon, "ordre": order},
            )

        questions = []
        for index, (category_name, sub_name, text, options) in enumerate(QUESTIONS, start=1):
            sub, _ = SousCategorie.objects.update_or_create(
                categorie=categories[category_name],
                nom=sub_name,
                defaults={"nom_en": SUBCATEGORY_EN[sub_name]},
            )
            text_en, option_labels_en = QUESTION_TRANSLATIONS[text]
            question, _ = Question.objects.update_or_create(
                ordre=index,
                defaults={"sous_categorie": sub, "texte": text, "texte_en": text_en, "actif": True},
            )
            for order, (label, score, weights) in enumerate(options):
                ReponseProposee.objects.update_or_create(
                    question=question, texte=label,
                    defaults={
                        "texte_en": option_labels_en[label],
                        "score": score,
                        "poids": weights,
                        "ordre": order,
                    },
                )
            questions.append(question)

        # ------------------------------------------------------------------
        # Packs & subscriptions
        # ------------------------------------------------------------------
        packs = {}
        for name, description, price, sessions, duration, featured, order in PACKS:
            pack, _ = Pack.objects.update_or_create(
                nom_pack=name,
                defaults={"description": description, "prix": price, "nb_sessions": sessions,
                          "duree_jours": duration, "is_featured": featured, "ordre": order},
            )
            packs[sessions] = pack

        def add_subscription(patient_email, pack_sessions, remaining, months_ago=0):
            pack = packs[pack_sessions]
            start = today - timedelta(days=30 * months_ago)
            return Abonnement.objects.create(
                patient=patients[patient_email].user, pack=pack,
                solde_restants=remaining, statut=Abonnement.Statut.ACTIF,
                date_debut=start, date_fin=today + timedelta(days=pack.duree_jours),
                prix_paye=pack.prix,
            )

        abonnement_yasmine = add_subscription("patient@theranova.dz", 5, 2)
        add_subscription("lina@theranova.dz", 10, 9, months_ago=1)

        # ------------------------------------------------------------------
        # Agenda: realistic slots over the next 3 weeks
        # ------------------------------------------------------------------
        therapist_list = list(therapist_profiles.values())
        day_sets = [
            [6, 0, 1, 2, 3],  # Sunday → Thursday
            [6, 1, 2, 3, 4],
            [0, 1, 2, 3, 4],
            [6, 0, 2, 3],
            [6, 0, 1, 3, 4],
            [6, 0, 1, 2, 3, 4],
        ]
        hours = [9, 10, 11, 13, 14, 15, 16]
        for t_index, profile in enumerate(therapist_list):
            for offset in range(0, 21):
                day = today + timedelta(days=offset)
                if day.weekday() not in day_sets[t_index]:
                    continue
                for h_index, hour in enumerate(hours):
                    if (offset + h_index + t_index) % 5 == 0:
                        continue  # organic gaps
                    start = timezone.make_aware(datetime.combine(day, time(hour, 0)))
                    if start <= now:
                        continue
                    Creneau.objects.get_or_create(
                        therapeute=profile, date_heure_debut=start,
                        defaults={"date_heure_fin": start + timedelta(minutes=60)},
                    )

        # ------------------------------------------------------------------
        # Sessions, requests and transactions
        # ------------------------------------------------------------------
        meet_code = "tno-vana-demo"

        def make_session(patient_email, therapist_email, start, status, price,
                         demande=None, type_session="Individuel"):
            patient = patients[patient_email].user
            therapist = therapist_profiles[therapist_email]
            end = start + timedelta(minutes=50)
            seance = Seance.objects.create(
                demande=demande, patient=patient, therapeute=therapist,
                lien_googlemeet=f"https://meet.google.com/{meet_code}",
                meet_id=meet_code, fournisseur="demo", statut=status,
                date_debut=start, date_fin=end, type_session=type_session,
                prix_final=Decimal(price),
                date_debut_reelle=start if status != Seance.Statut.PREVUE else None,
                date_fin_reelle=end if status == Seance.Statut.TERMINEE else None,
            )
            GoogleMeetSession.objects.create(
                seance=seance, meet_link=seance.lien_googlemeet, meet_id=meet_code,
                statut=GoogleMeetSession.Statut.TERMINE if status == Seance.Statut.TERMINEE else GoogleMeetSession.Statut.CREE,
            )
            SessionParticipant.objects.create(
                seance=seance, patient=patient, email=patient.email,
                nom=patient.full_name, statut=SessionParticipant.Statut.PAYE,
            )
            Transaction.objects.create(
                patient=patient, montant=Decimal(price), type=Transaction.Type.SEANCE,
                statut=Transaction.Statut.OK, methode=Transaction.Methode.CARTE, seance=seance,
                metadata={"seed": True},
            )
            return seance

        belghoul = "therapist@theranova.dz"
        khaled = "yasmine.khaled@theranova.dz"
        taraft = "rayane.taraft@theranova.dz"
        bouchareb = "imene.bouchareb@theranova.dz"
        serrir = "dalia.serrir@theranova.dz"
        angela = "angela.tienderebeogo@theranova.dz"

        # upcoming session in ~8 minutes → lets the demo test the teleconsultation gate
        upcoming = make_session("patient@theranova.dz", belghoul, now + timedelta(minutes=8),
                                Seance.Statut.PREVUE, "2500")
        make_session("patient@theranova.dz", belghoul, now - timedelta(days=7, hours=2),
                     Seance.Statut.TERMINEE, "2500")
        make_session("patient@theranova.dz", belghoul, now - timedelta(days=21, hours=2),
                     Seance.Statut.TERMINEE, "2500")
        make_session("patient@theranova.dz", belghoul, now - timedelta(days=35, hours=2),
                     Seance.Statut.TERMINEE, "2500")

        for patient_email, therapist_email, days_ago, price in [
            ("karim@theranova.dz", belghoul, 3, "2800"),
            ("karim@theranova.dz", belghoul, 18, "2800"),
            ("lina@theranova.dz", khaled, 5, "3200"),
            ("lina@theranova.dz", khaled, 25, "3200"),
            ("lina@theranova.dz", khaled, 45, "3200"),
            ("sofiane@theranova.dz", taraft, 9, "2500"),
            ("sofiane@theranova.dz", bouchareb, 40, "3000"),
            ("karim@theranova.dz", serrir, 60, "2700"),
            ("lina@theranova.dz", angela, 80, "2600"),
        ]:
            make_session(patient_email, therapist_email, now - timedelta(days=days_ago, hours=2),
                         Seance.Statut.TERMINEE, price)

        # Revenue from packs
        Transaction.objects.create(
            patient=patients["patient@theranova.dz"].user, montant=Decimal("9000"),
            type=Transaction.Type.PACK, statut=Transaction.Statut.OK,
            methode=Transaction.Methode.CARTE,
            pack=packs[5], abonnement=abonnement_yasmine, metadata={"seed": True},
        )
        Transaction.objects.create(
            patient=patients["lina@theranova.dz"].user, montant=Decimal("16500"),
            type=Transaction.Type.PACK, statut=Transaction.Statut.OK,
            methode=Transaction.Methode.BARIDIMOB, pack=packs[10], metadata={"seed": True},
        )

        # Pending request (therapist inbox) for tomorrow with a free slot
        slot = (
            Creneau.objects.filter(
                therapeute=therapist_profiles[belghoul], statut=Creneau.Statut.LIBRE,
                date_heure_debut__gte=now + timedelta(hours=6),
            ).order_by("date_heure_debut").first()
        )
        if slot:
            slot.statut = Creneau.Statut.EN_ATTENTE
            slot.save(update_fields=["statut"])
            demande = DemandeRDV.objects.create(
                patient=patients["karim@theranova.dz"].user, creneau=slot,
                type_session="Individuel", statut=DemandeRDV.Statut.EN_ATTENTE,
                message="Je souhaite reprendre un suivi régulier pour gérer mon stress au travail.",
                prix_total=Decimal("2800"), prix_par_participant=Decimal("2800"),
            )
            ParticipantDemande.objects.create(
                demande=demande, patient=demande.patient, email=demande.patient.email,
                nom=demande.patient.full_name, montant=Decimal("2800"), est_createur=True,
            )
            Notification.objects.create(
                user=therapist_profiles[belghoul].user, titre="Nouvelle demande de rendez-vous",
                message="Anis Gherbi souhaite une séance individuelle.",
                type=Notification.Type.RAPPEL,
            )

        # Couple request waiting for payment
        slot2 = (
            Creneau.objects.filter(
                therapeute=therapist_profiles[bouchareb], statut=Creneau.Statut.LIBRE,
                date_heure_debut__gte=now + timedelta(days=2),
            ).order_by("date_heure_debut").first()
        )
        if slot2:
            slot2.statut = Creneau.Statut.EN_ATTENTE
            slot2.save(update_fields=["statut"])
            couple = DemandeRDV.objects.create(
                patient=patients["lina@theranova.dz"].user, creneau=slot2,
                type_session="Couple", statut=DemandeRDV.Statut.ACCEPTEE,
                message="Nous traversons une période de communication difficile.",
                prix_total=Decimal("4800"), prix_par_participant=Decimal("2400"),
                date_reponse=now,
            )
            ParticipantDemande.objects.create(
                demande=couple, patient=couple.patient, email=couple.patient.email,
                nom=couple.patient.full_name, montant=Decimal("2400"), est_createur=True,
            )
            ParticipantDemande.objects.create(
                demande=couple, patient=patients["sofiane@theranova.dz"].user,
                email="sofiane@theranova.dz", nom="Yacine Boumediene", montant=Decimal("2400"),
            )

        # ------------------------------------------------------------------
        # Clinical files, notes and reports
        # ------------------------------------------------------------------
        dossier_yasmine, _ = DossierPatient.objects.get_or_create(
            patient=patients["patient@theranova.dz"].user,
            therapeute=therapist_profiles[belghoul],
            defaults={
                "motif_consultation": "Anxiété liée aux études et à la pression familiale",
                "plan_therapeutique": "TCC en 10 séances : identification des pensées automatiques, "
                                      "exposition progressive, hygiène de vie et gestion du sommeil.",
                "objectifs": [
                    {"titre": "Réduire les crises d'angoisse", "statut": "en_cours", "echeance": None},
                    {"titre": "Améliorer la qualité du sommeil", "statut": "atteint", "echeance": None},
                    {"titre": "Renforcer la confiance en soi", "statut": "en_cours", "echeance": None},
                ],
            },
        )
        NoteClinique.objects.create(
            dossier=dossier_yasmine, therapeute=therapist_profiles[belghoul],
            type=NoteClinique.Type.SEANCE,
            contenu="Séance 4 : la patiente identifie trois situations déclencheuses (examen, comparaison sociale, "
                    "conflit familial). Exercice de restructuration cognitive réalisé avec succès. Bonne adhésion.",
        )
        NoteClinique.objects.create(
            dossier=dossier_yasmine, therapeute=therapist_profiles[belghoul],
            type=NoteClinique.Type.SUIVI,
            contenu="Entre les séances : sommeil plus régulier, 7 h en moyenne. À poursuivre : journal des pensées.",
        )

        for patient_email, therapist_email, motif in [
            ("karim@theranova.dz", belghoul, "Stress professionnel et épuisement"),
            ("lina@theranova.dz", khaled, "Trauma suite à un accident de la route"),
            ("sofiane@theranova.dz", taraft, "Réorientation professionnelle"),
        ]:
            DossierPatient.objects.get_or_create(
                patient=patients[patient_email].user,
                therapeute=therapist_profiles[therapist_email],
                defaults={"motif_consultation": motif,
                          "plan_therapeutique": "Suivi hebdomadaire, objectifs définis avec le patient."},
            )

        RapportSeance.objects.create(
            seance=Seance.objects.filter(
                patient=patients["patient@theranova.dz"].user, statut=Seance.Statut.TERMINEE
            ).order_by("-date_debut").first(),
            therapeute=therapist_profiles[belghoul],
            objectifs_seance="Identifier les pensées automatiques liées aux examens.",
            observations="Bonne participation. La patiente a réalisé l'exercice de restructuration avec aisance.",
            evolution="amelioration",
            exercices="Tenir un journal des pensées pendant 7 jours.",
        )

        # ------------------------------------------------------------------
        # Mood entries
        # ------------------------------------------------------------------
        moods = [6, 5, 7, 6, 8, 7, 5, 4, 6, 7, 8, 7, 6, 5, 6, 8, 7, 9, 8, 7, 6, 5, 6, 7, 8, 8, 7, 6, 7, 8]
        notes = {
            4: "Journée difficile, beaucoup de pression avant les partiels.",
            5: "Fatigue et doutes, mais j'ai réussi à sortir marcher.",
            8: "Bonne journée, séance avec Dr Cherif et discussion apaisante.",
            9: "Je me sens enfin légère, les exercices de respiration m'aident beaucoup.",
        }
        emotions = {9: "joyeux", 8: "calme", 7: "calme", 6: "neutre", 5: "anxieux", 4: "triste"}
        for index, score in enumerate(moods):
            day = today - timedelta(days=len(moods) - index - 1)
            note = notes.get(score, "")
            emotion = emotions.get(score, "neutre")
            generated = generate_message(score, note, emotion, "Salma")
            HumeurEntry.objects.update_or_create(
                patient=patients["patient@theranova.dz"].user, date_saisie=day,
                defaults={"score": score, "emotion": emotion, "note": note,
                          "message_ia": generated["message"], "alerte": False},
            )

        for patient_email, base in [("karim@theranova.dz", 5), ("lina@theranova.dz", 6), ("sofiane@theranova.dz", 7)]:
            for index in range(10):
                day = today - timedelta(days=9 - index)
                score = max(1, min(10, base + (index % 3) - 1))
                generated = generate_message(score, "", "neutre", patient_email.split("@")[0])
                HumeurEntry.objects.update_or_create(
                    patient=patients[patient_email].user, date_saisie=day,
                    defaults={"score": score, "emotion": "neutre", "message_ia": generated["message"]},
                )

        # ------------------------------------------------------------------
        # Questionnaire run + recommendations
        # ------------------------------------------------------------------
        option_map = {}
        for question in questions:
            option_map[question.ordre] = list(question.reponses.order_by("ordre"))
        answers = {
            str(q.id): option_map[q.ordre][min(3, len(option_map[q.ordre]) - 1)].id for q in questions
        }
        # make the answers coherent with an anxiety / self-esteem profile
        answers[str(questions[1].id)] = option_map[2][2].id
        answers[str(questions[2].id)] = option_map[3][2].id
        answers[str(questions[3].id)] = option_map[4][1].id
        answers[str(questions[4].id)] = option_map[5][2].id
        answers[str(questions[5].id)] = option_map[6][0].id
        answers[str(questions[6].id)] = option_map[7][1].id
        answers[str(questions[7].id)] = option_map[8][2].id
        answers[str(questions[8].id)] = option_map[9][1].id
        answers[str(questions[9].id)] = option_map[10][0].id
        answers[str(questions[10].id)] = option_map[11][2].id
        answers[str(questions[11].id)] = option_map[12][1].id

        selected = [ReponseProposee.objects.get(pk=option_id) for option_id in answers.values()]
        text_analysis = {"sentiment": "negatif", "risque": False, "mots_cles": {"anxiete": ["anxiete"]},
                         "score_positif": 0, "score_negatif": 2}
        scores = compute_specialty_scores(selected, text_analysis)
        ranked = recommend_therapists(scores, type_session="Individuel", langue="fr", limit=3)
        qsession = QuestionnaireSession.objects.create(
            patient=patients["patient@theranova.dz"].user,
            reponses={"answers": answers, "sentiment": text_analysis},
            scores_specialites=scores,
            texte_libre="Je ressens beaucoup de pression concernant mes études et j'ai du mal à dormir.",
            type_session="Individuel",
            sentiment="negatif",
            niveau_risque="modere",
            resume=build_summary(scores, "negatif", False, [r["therapist"].nom_complet for r in ranked]),
            resume_en=build_summary(
                scores, "negatif", False, [r["therapist"].nom_complet for r in ranked], lang="en"
            ),
            recommandations=[
                {
                    "therapist_id": item["therapist"].id,
                    "score": item["score"],
                    "affinite": item["affinite"],
                    "raisons": item["raisons"],
                    "raisons_en": item.get("raisons_en", []),
                    "prochain_creneau": item["prochain_creneau"].isoformat()
                    if item["prochain_creneau"] else None,
                }
                for item in ranked
            ],
        )
        for question in questions:
            ReponsePatient.objects.create(
                session=qsession, patient=qsession.patient, question=question,
                reponse=ReponseProposee.objects.get(pk=answers[str(question.id)]),
            )

        # ------------------------------------------------------------------
        # Reviews
        # ------------------------------------------------------------------
        reviews = [
            ("patient@theranova.dz", belghoul, 5, "Un thérapeute à l'écoute, très structuré. Les exercices concrets m'ont aidée dès les premières séances."),
            ("karim@theranova.dz", belghoul, 4, "Très professionnel, les séances m'ont aidé à mieux gérer la pression au travail."),
            ("lina@theranova.dz", khaled, 5, "Le travail sur le trauma a changé mon quotidien. Un cadre extrêmement rassurant."),
            ("sofiane@theranova.dz", taraft, 4, "Un vrai accompagnement pour clarifier mon projet professionnel."),
            ("karim@theranova.dz", serrir, 5, "Écoute sans jugement et objectifs clairs. Je recommande."),
            ("lina@theranova.dz", angela, 5, "Un accompagnement familial précieux, nous avons retrouvé le dialogue."),
            ("sofiane@theranova.dz", bouchareb, 4, "Bonne écoute, des outils de communication très utiles."),
        ]
        for patient_email, therapist_email, note, comment in reviews:
            Avis.objects.update_or_create(
                patient=patients[patient_email].user,
                therapeute=therapist_profiles[therapist_email].user,
                defaults={"note": note, "commentaire": comment, "visible": True},
            )

        # ------------------------------------------------------------------
        # Complaints & reports
        # ------------------------------------------------------------------
        for item in COMPLAINTS:
            patient = patients[item["patient"]].user
            Reclamation.objects.create(
                patient=patient, categorie=item["categorie"], message=item["message"],
                priorite=item["priorite"], statut=item["statut"], reponse=item["reponse"],
                traite_par=admin if item["statut"] != "en_attente" else None,
                date_resolution=now - timedelta(days=1) if item["statut"] == "resolue" else None,
            )
        Report.objects.create(
            auteur=patients["karim@theranova.dz"].user, type=Report.Type.BUG,
            sujet="Le lien Meet ne s'ouvre pas sur mobile",
            message="Sur Android, le bouton Rejoindre reste grisé même 5 minutes avant la séance.",
            priorite=Report.Priorite.NIVEAU_2, statut=Report.Statut.EN_COURS,
        )
        Report.objects.create(
            auteur=patients["lina@theranova.dz"].user, type=Report.Type.SUGGESTION,
            sujet="Ajouter un rappel SMS",
            message="Ce serait utile de recevoir un SMS 1 heure avant la séance.",
            priorite=Report.Priorite.NIVEAU_1,
        )

        # ------------------------------------------------------------------
        # Messaging & notifications
        # ------------------------------------------------------------------
        conversation, _ = Conversation.objects.get_or_create(
            patient=patients["patient@theranova.dz"].user, therapeute=therapist_profiles[belghoul].user
        )
        if not conversation.messages.exists():
            Message.objects.create(
                conversation=conversation, sender=therapist_profiles[belghoul].user,
                contenu="Bonjour Salma, comment s'est passée votre semaine ? Avez-vous pu tenir le journal des pensées ?",
                lu=True,
            )
            Message.objects.create(
                conversation=conversation, sender=patients["patient@theranova.dz"].user,
                contenu="Bonjour Docteur, la semaine a été chargée mais j'ai réussi à noter trois situations. "
                        "Le sommeil est un peu meilleur.",
                lu=True,
            )
            Message.objects.create(
                conversation=conversation, sender=therapist_profiles[belghoul].user,
                contenu="C'est un très bon progrès. Nous reviendrons sur ces situations lors de notre prochaine séance.",
            )

        conversation2, _ = Conversation.objects.get_or_create(
            patient=patients["karim@theranova.dz"].user, therapeute=therapist_profiles[belghoul].user
        )
        Message.objects.create(
            conversation=conversation2, sender=patients["karim@theranova.dz"].user,
            contenu="Bonjour Docteur, je souhaite reprendre un suivi. Pouvez-vous me proposer un créneau cette semaine ?",
        )

        Notification.objects.create(
            user=patients["patient@theranova.dz"].user, titre="Bienvenue sur TheraNova",
            message="Votre espace personnel est prêt. Commencez par le questionnaire pour rencontrer le thérapeute le plus adapté.",
            type=Notification.Type.CONFIRMATION,
        )
        Notification.objects.create(
            user=patients["patient@theranova.dz"].user, titre="Séance aujourd'hui",
            message="Votre téléconsultation avec Dr Cherif commence dans quelques minutes. Le lien sera accessible 15 minutes avant.",
            type=Notification.Type.RAPPEL,
        )
        Notification.objects.create(
            user=admin, titre="3 réclamations en attente",
            message="Deux réclamations prioritaires nécessitent votre attention.",
            type=Notification.Type.ALERTE,
        )

        SystemParameter.objects.update_or_create(
            cle="seed_version", defaults={"valeur": SEED_VERSION, "type": "string",
                                           "description": "Version des données de démonstration"}
        )
        SystemParameter.objects.update_or_create(
            cle="objectif_revenus", defaults={"valeur": "1250000", "type": "int",
                                               "description": "Objectif de revenus mensuel (DA)"}
        )

        self.stdout.write(self.style.SUCCESS("TheraNova demo data ready."))
        self.stdout.write("  admin@theranova.dz / Admin123!")
        self.stdout.write("  patient@theranova.dz / Patient123!")
        self.stdout.write("  therapist@theranova.dz / Therapist123!")
        self.stdout.write("  karim@theranova.dz / Patient123!")
        self.stdout.write(f"  Sessions: {Seance.objects.count()} | Slots: {Creneau.objects.count()} | "
                          f"Transactions: {Transaction.objects.count()}")
