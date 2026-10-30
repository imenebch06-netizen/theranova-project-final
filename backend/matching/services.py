"""TheraNova recommendation engine.

A transparent, explainable content-based matching model:
  * each questionnaire answer carries weights per specialty,
  * free-text answers are analysed with a bilingual emotional lexicon (NLP),
  * therapists are ranked with a weighted score (specialty affinity, rating,
    experience, real availability, language and budget).

The module is deliberately dependency-free so it runs offline; the scoring
contract is stable and can later be replaced by sentence-transformers
embeddings without touching the API.
"""
from __future__ import annotations

import re
import unicodedata
from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone

from accounts.models import Specialite, TherapistProfile
from scheduling.models import Creneau

# ---------------------------------------------------------------------------
# Bilingual emotional lexicon
# ---------------------------------------------------------------------------
LEXICON = {
    "anxiete": [
        "anxieux", "anxieuse", "anxiete", "angoisse", "angoisse", "stress", "stresse",
        "stressée", "panique", "peur", "inquiet", "inquiete", "nerveux", "nerveuse",
        "anxious", "anxiety", "panic", "worried", "overwhelmed", "tension",
    ],
    "depression": [
        "triste", "tristesse", "deprime", "deprimee", "depression", "vide", "fatigue",
        "epuise", "epuisee", "pleure", "pleurs", "desespoir", "inutile", "seul", "seule",
        "solitude", "sad", "depressed", "empty", "exhausted", "hopeless", "lonely", "cry",
    ],
    "couple": [
        "couple", "conjoint", "conjointe", "mari", "femme", "partenaire", "rupture",
        "divorce", "relation amoureuse", "dispute", "infidelite", "communication",
        "partner", "marriage", "breakup", "relationship",
    ],
    "famille": [
        "famille", "familial", "parents", "pere", "mere", "fratrie", "frere", "soeur",
        "enfant", "enfants", "foyer", "family", "parents", "child", "siblings",
    ],
    "trauma": [
        "trauma", "traumatisme", "agression", "viol", "accident", "deuil", "guerre",
        "violence", "abus", "cauchemar", "flashback", "ptsd", "abuse", "grief", "nightmare",
    ],
    "addiction": [
        "addiction", "dependance", "alcool", "drogue", "tabac", "cannabis", "jeu",
        "ecran", "reseau social", "addicted", "alcohol", "drug", "gambling", "smoking",
    ],
    "orientation": [
        "orientation", "carriere", "travail", "etudes", "etudiant", "examens", "avenir",
        "choix", "professionnel", "universite", "stage", "emploi", "career", "study",
        "future", "job", "exam",
    ],
    "confiance": [
        "confiance", "estime", "valeur", "honte", "culpabilite", "comparaison", "imposteur",
        "self-esteem", "confidence", "shame", "guilt", "worthless",
    ],
}

POSITIVE_WORDS = [
    "bien", "mieux", "heureux", "heureuse", "joie", "calme", "espoir", "serein",
    "sereine", "positif", "positive", "reconnaissant", "motivation", "happy", "calm",
    "hopeful", "grateful", "good", "great",
]

RISK_PATTERNS = [
    r"suicid", r"me tuer", r"tu(er)? moi", r"mourir", r"plus envie de vivre",
    r"en finir", r"automutil", r"me faire du mal", r"kill myself", r"end my life",
    r"self[- ]harm", r"want to die", r"no reason to live",
]

RISK_MESSAGE = (
    "Votre message contient des éléments qui nous préoccupent. Vous n'êtes pas seul(e) : "
    "parlez-en sans attendre à un proche ou à un professionnel. En cas d'urgence, contactez "
    "la Protection civile (14) ou le SAMU (115). TheraNova reste à vos côtés."
)

RISK_MESSAGE_EN = (
    "Your message contains elements that concern us. You are not alone: talk to someone you "
    "trust or a professional without delay. In an emergency, contact Civil Protection (14) or "
    "SAMU (115). TheraNova is by your side."
)

SPECIALTY_FALLBACK = "anxiete"


def normalize(text: str) -> str:
    text = (text or "").lower()
    text = unicodedata.normalize("NFD", text)
    return "".join(char for char in text if unicodedata.category(char) != "Mn")


def detect_risk(text: str) -> bool:
    normalized = normalize(text)
    return any(re.search(pattern, normalized) for pattern in RISK_PATTERNS)


def analyze_text(text: str) -> dict:
    """Lightweight sentiment analysis + specialty keyword detection."""
    normalized = normalize(text)
    risk = detect_risk(text)
    keyword_hits = {}
    for code, words in LEXICON.items():
        hits = [word for word in words if normalize(word) in normalized]
        if hits:
            keyword_hits[code] = sorted(set(hits))
    positive = sum(1 for word in POSITIVE_WORDS if normalize(word) in normalized)
    negative = sum(len(hits) for hits in keyword_hits.values())

    if risk:
        sentiment = "critique"
    elif negative > positive + 1:
        sentiment = "negatif"
    elif positive > negative:
        sentiment = "positif"
    else:
        sentiment = "neutre"

    return {
        "sentiment": sentiment,
        "risque": risk,
        "mots_cles": keyword_hits,
        "score_positif": positive,
        "score_negatif": negative,
    }


def compute_specialty_scores(options, text_analysis) -> dict:
    """Normalised 0-100 affinity per specialty from selected answer options."""
    raw = {}
    maximum = {}
    for option in options:
        for code, weight in (option.poids or {}).items():
            weight = int(weight)
            maximum[code] = maximum.get(code, 0) + max(weight, 0)
            raw[code] = raw.get(code, 0) + weight

    # maximum must be computed from the whole questionnaire, not only the selection
    from matching.models import ReponseProposee

    best = {}
    for option in ReponseProposee.objects.all().only("question_id", "poids"):
        for code, weight in (option.poids or {}).items():
            key = (code, option.question_id)
            best[key] = max(best.get(key, 0), int(weight))
    maximum = {}
    for (code, _question), weight in best.items():
        maximum[code] = maximum.get(code, 0) + weight

    scores = {}
    for code, max_value in maximum.items():
        if max_value <= 0:
            continue
        scores[code] = round(min(100, raw.get(code, 0) / max_value * 100))

    # free-text boost (max +30) — the NLP layer
    for code, hits in text_analysis["mots_cles"].items():
        scores[code] = min(100, scores.get(code, 0) + min(30, 8 * len(hits)))

    if not scores or max(scores.values()) == 0:
        scores[SPECIALTY_FALLBACK] = 25
    return dict(sorted(scores.items(), key=lambda item: item[1], reverse=True))


def _language_matches(preference: str, langues: list) -> bool:
    mapping = {"fr": ["français", "francais", "french"], "en": ["english", "anglais"],
               "ar": ["arabe", "arabic", "العربية"]}
    if not preference:
        return True
    wanted = mapping.get(preference, [preference.lower()])
    return any(any(word in (langue or "").lower() for word in wanted) for langue in langues or [])


def recommend_therapists(scores: dict, *, type_session="Individuel", langue="",
                         budget=None, limit=3) -> list[dict]:
    now = timezone.now()
    horizon = now + timedelta(days=21)

    qs = (
        TherapistProfile.objects.select_related("user")
        .prefetch_related("specialites")
        .filter(statut=TherapistProfile.Statut.ACTIVE, user__is_active=True)
        .annotate(nb_specialites=Count("specialites"))
    )
    if type_session:
        compatible = qs.filter(types_sessions__icontains=type_session)
        if compatible.exists():
            qs = compatible

    candidates = list(qs)
    if not candidates:
        return []

    slots = (
        Creneau.objects.filter(
            therapeute__in=candidates,
            statut=Creneau.Statut.LIBRE,
            date_heure_debut__gte=now,
            date_heure_debut__lte=horizon,
        )
        .order_by("date_heure_debut")
    )
    next_slot = {}
    for slot in slots:
        next_slot.setdefault(slot.therapeute_id, slot.date_heure_debut)

    ranked = []
    for therapist in candidates:
        specialty_codes = [s.code for s in therapist.specialites.all()]
        affinity = max((scores.get(code, 0) for code in specialty_codes), default=0)
        reasons = []
        reasons_en = []

        matching_specialties = sorted(
            ((scores.get(s.code, 0), s) for s in therapist.specialites.all()),
            key=lambda item: (-item[0], item[1].nom),
        )
        if matching_specialties and matching_specialties[0][0] > 0:
            affinity_score, specialty = matching_specialties[0]
            specialty_en = specialty.nom_en or specialty.nom
            reasons.append(
                f"Spécialiste en {specialty.nom.lower()} — {affinity_score}% d'adéquation avec votre profil"
            )
            reasons_en.append(
                f"Specialist in {specialty_en.lower()} — {affinity_score}% match with your profile"
            )
            if len(matching_specialties) > 1 and matching_specialties[1][0] >= 30:
                second = matching_specialties[1][1]
                reasons.append(f"Également formé(e) en {second.nom.lower()}")
                reasons_en.append(f"Also trained in {(second.nom_en or second.nom).lower()}")

        rating = float(therapist.note_globale) / 5 if therapist.note_globale else 0
        if therapist.nombre_avis >= 5:
            reasons.append(f"Note de {therapist.note_globale}/5 sur {therapist.nombre_avis} avis")
            reasons_en.append(
                f"Rated {therapist.note_globale}/5 from {therapist.nombre_avis} reviews"
            )

        experience = min(therapist.annees_experience / 15, 1)
        if therapist.annees_experience >= 5:
            reasons.append(f"{therapist.annees_experience} ans d'expérience clinique")
            reasons_en.append(f"{therapist.annees_experience} years of clinical experience")

        availability = 1.0 if (therapist.disponibilite_active and therapist.id in next_slot) else 0.0
        if therapist.id in next_slot:
            date = timezone.localtime(next_slot[therapist.id])
            reasons.append(f"Disponible dès le {date:%d/%m à %H:%M}")
            reasons_en.append(f"Available from {date:%d/%m at %H:%M}")
        else:
            reasons.append("Aucun créneau ouvert sur les 3 prochaines semaines")
            reasons_en.append("No open slot over the next 3 weeks")

        language = 1.0 if _language_matches(langue, therapist.langues) else 0.0
        if language and langue:
            reasons.append("Consulte dans votre langue préférée")
            reasons_en.append("Consults in your preferred language")

        budget_score = 1.0
        if budget:
            budget_score = 1.0 if float(therapist.tarif_seance) <= float(budget) else 0.15
            if budget_score < 1:
                reasons.append("Tarif au-dessus du budget indiqué")
                reasons_en.append("Fee above the indicated budget")

        total = (
            (affinity / 100) * 0.50
            + rating * 0.18
            + experience * 0.07
            + availability * 0.15
            + language * 0.05
            + budget_score * 0.05
        )
        ranked.append({
            "therapist": therapist,
            "score": round(total * 100),
            "affinite": affinity,
            "raisons": reasons[:4],
            "raisons_en": reasons_en[:4],
            "prochain_creneau": next_slot.get(therapist.id),
        })

    ranked.sort(key=lambda item: (-item["score"], -item["affinite"]))
    return ranked[:limit]


def build_summary(scores: dict, sentiment: str, risk: bool, therapist_names: list[str],
                  lang: str = "fr") -> str:
    from accounts.models import Specialite

    english = lang == "en"
    labels = {
        specialite.code: (
            (specialite.nom_en or specialite.nom) if english else specialite.nom
        )
        for specialite in Specialite.objects.all()
    }
    top = [code for code, value in list(scores.items())[:2] if value >= 15]
    top_labels = [labels.get(code, code) for code in top]

    if risk:
        return RISK_MESSAGE_EN if english else RISK_MESSAGE

    if not top_labels:
        body = (
            "Your answers do not point to a marked therapeutic need, but talking can help "
            "clarify your situation."
            if english
            else "Vos réponses ne font pas apparaître de besoin thérapeutique marqué, mais un échange peut aider à clarifier votre situation."
        )
    elif len(top_labels) == 1:
        body = (
            f"Your answers point to a need centred on: {top_labels[0].lower()}."
            if english
            else f"Vos réponses indiquent un besoin centré sur : {top_labels[0].lower()}."
        )
    else:
        if english:
            body = (
                f"Your answers point to a need centred on: {top_labels[0].lower()}, "
                f"with a related dimension of {top_labels[1].lower()}."
            )
        else:
            body = (
                f"Vos réponses indiquent un besoin centré sur : {top_labels[0].lower()}, "
                f"avec une dimension liée à {top_labels[1].lower()}."
            )

    tone = (
        {
            "negatif": "The tone of your message reflects real emotional distress: you were right to share it.",
            "positif": "Your message also shows positive resources we can build on.",
            "neutre": "Your message shows a clear, willing approach — already a first step.",
            "critique": RISK_MESSAGE_EN,
        }
        if english
        else {
            "negatif": "Le ton de votre message traduit une souffrance émotionnelle réelle : vous avez eu raison de la partager.",
            "positif": "Votre message laisse aussi place à des ressources positives sur lesquelles nous pouvons nous appuyer.",
            "neutre": "Votre message montre une démarche lucide et volontaire, déjà un premier pas.",
            "critique": RISK_MESSAGE,
        }
    ).get(sentiment, "")

    if therapist_names:
        body += (
            f" We recommend {', '.join(therapist_names)} first."
            if english
            else f" Nous vous proposons en priorité {', '.join(therapist_names)}."
        )
    return f"{body} {tone}".strip()
