"""Empathetic message generation for the daily mood tracker.

Rule-based NLP with a safety-first layer. It is deterministic, private
(nothing leaves the server) and can be swapped for an LLM later.
"""
from __future__ import annotations

from matching.services import RISK_MESSAGE, analyze_text, detect_risk

EMPATHY = {
    "joyeux": "C'est une belle énergie que vous partagez aujourd'hui.",
    "calme": "La sérénité est précieuse : savourez-la.",
    "neutre": "Une journée neutre est aussi une journée légitime.",
    "anxieux": "L'anxiété peut être envahissante, mais elle n'est pas une fatalité.",
    "triste": "La tristesse mérite d'être accueillie, pas jugée.",
    "en_colere": "La colère signale souvent un besoin important à écouter.",
    "fatigue": "La fatigue est un signal : votre corps demande peut-être une pause.",
}

ACTIONS = {
    "joyeux": "Profitez-en pour noter ce qui a nourri ce moment, afin de pouvoir y revenir.",
    "calme": "Une respiration lente de cinq minutes peut prolonger cet état.",
    "neutre": "Essayez une petite action agréable : une marche, un appel, un verre d'eau en pleine conscience.",
    "anxieux": "Essayez la respiration 4-6 : inspirez 4 secondes, expirez 6 secondes, pendant deux minutes.",
    "triste": "Parlez à une personne de confiance ou écrivez trois lignes sur ce qui pèse aujourd'hui.",
    "en_colere": "Nommez ce qui a déclenché cette colère et ce dont vous auriez besoin maintenant.",
    "fatigue": "Accordez-vous une vraie pause, sans écran, avant de reprendre vos activités.",
}

SCORE_TONE = [
    (3, "Ce moment est difficile. Votre présence ici compte déjà."),
    (5, "Les journées plus basses font partie du chemin, et elles se traversent."),
    (7, "Vous êtes sur une pente stable : continuez à prendre soin de vous."),
    (10, "Votre énergie est au beau fixe aujourd'hui."),
]


def generate_message(score: int, note: str, emotion: str, prenom: str = "") -> dict:
    name = f"{prenom} " if prenom else ""
    risk = detect_risk(note) if note else False
    analysis = analyze_text(note) if note else {"sentiment": "neutre", "mots_cles": {}}

    if risk:
        return {
            "message": RISK_MESSAGE,
            "alerte": True,
            "recommandations": [
                "Contactez immédiatement un proche ou un professionnel.",
                "En cas d'urgence : Protection civile (14) ou SAMU (115).",
                "Ne restez pas seul(e) avec cette souffrance.",
            ],
        }

    tone = next(text for threshold, text in SCORE_TONE if score <= threshold)
    parts = [f"{name}{tone}".strip(), EMPATHY.get(emotion, ""), ACTIONS.get(emotion, "")]

    keywords = [word for words in analysis["mots_cles"].values() for word in words]
    if keywords:
        parts.append(
            "J'ai noté les mots « "
            + ", ".join(keywords[:3])
            + " » : les nommer est déjà un pas vers la compréhension de ce que vous vivez."
        )

    if score >= 8:
        parts.append("C'est le bon moment pour consolider vos ressources et vos routines positives.")
    elif score <= 3:
        parts.append(
            "Si cet état dure plus de deux semaines, parlez-en à votre thérapeute ou prenez rendez-vous : "
            "vous n'avez pas à traverser cela seul(e)."
        )

    return {
        "message": " ".join(part for part in parts if part),
        "alerte": False,
        "recommandations": [ACTIONS.get(emotion, "")],
    }


def compute_stats(entries, days: int = 30) -> dict:
    values = [entry.score for entry in entries]
    if not values:
        return {
            "moyenne": None, "meilleur": None, "pire": None, "entrees": 0,
            "serie_actuelle": 0, "tendance": "stable", "variation": 0,
            "distribution": [], "serie": [], "emotions": [],
        }

    moyenne = round(sum(values) / len(values), 1)
    half = max(1, len(values) // 2)
    recent = values[:half]
    older = values[half:]
    variation = round((sum(recent) / len(recent)) - (sum(older) / len(older)), 1) if older else 0
    tendance = "hausse" if variation > 0.5 else ("baisse" if variation < -0.5 else "stable")

    counts = {}
    for entry in entries:
        counts[entry.emotion] = counts.get(entry.emotion, 0) + 1
    emotions = [{"emotion": key, "count": value} for key, value in sorted(counts.items(), key=lambda x: -x[1])]

    distribution = [
        {"label": label, "count": sum(1 for value in values if low <= value <= high)}
        for label, low, high in [("1-3", 1, 3), ("4-6", 4, 6), ("7-8", 7, 8), ("9-10", 9, 10)]
    ]

    # current streak of consecutive days (from today or yesterday backwards)
    from datetime import timedelta

    from django.utils import timezone

    today = timezone.localdate()
    by_date = {entry.date_saisie: entry for entry in entries}
    streak = 0
    cursor = today
    if cursor not in by_date:
        cursor = today - timedelta(days=1)
    while cursor in by_date:
        streak += 1
        cursor -= timedelta(days=1)

    return {
        "moyenne": moyenne,
        "meilleur": max(values),
        "pire": min(values),
        "entrees": len(values),
        "serie_actuelle": streak,
        "tendance": tendance,
        "variation": variation,
        "distribution": distribution,
        "emotions": emotions,
        "serie": [
            {"date": entry.date_saisie, "score": entry.score, "emotion": entry.emotion}
            for entry in sorted(entries, key=lambda e: e.date_saisie)
        ],
    }
