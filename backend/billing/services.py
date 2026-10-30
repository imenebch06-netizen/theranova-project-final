"""Payment orchestration.

A real deployment plugs BaridiMob / Edahabia / CIB here. The simulated
provider keeps the same contract: idempotent charge, explicit status,
and atomic balance updates.
"""
from decimal import Decimal

from django.db import transaction as db_transaction
from django.utils import timezone

from accounts.models import PatientProfile
from core.utils import notify

from .models import Abonnement, Pack, Transaction


class PaymentError(Exception):
    pass


def _existing(key):
    if not key:
        return None
    return Transaction.objects.filter(idempotency_key=key).first()


@db_transaction.atomic
def purchase_pack(user, pack: Pack, methode: str = "simule", idempotency_key: str | None = None):
    existing = _existing(idempotency_key)
    if existing:
        return existing, False

    if not pack.is_active:
        raise PaymentError("Ce pack n'est plus disponible.")
    if methode == "echec":
        return Transaction.objects.create(
            patient=user, montant=pack.prix, type=Transaction.Type.PACK,
            statut=Transaction.Statut.ECHEC, methode=Transaction.Methode.SIMULE,
            pack=pack, idempotency_key=idempotency_key,
        ), False

    profile, _ = PatientProfile.objects.select_for_update().get_or_create(user=user)
    today = timezone.localdate()
    abonnement = Abonnement.objects.create(
        patient=user,
        pack=pack,
        solde_restants=pack.nb_sessions,
        statut=Abonnement.Statut.ACTIF,
        date_debut=today,
        date_fin=today + timezone.timedelta(days=pack.duree_jours),
        prix_paye=pack.prix,
    )
    profile.solde = profile.solde + pack.nb_sessions
    profile.save(update_fields=["solde"])

    transaction = Transaction.objects.create(
        patient=user,
        montant=pack.prix,
        type=Transaction.Type.PACK,
        statut=Transaction.Statut.OK,
        methode=methode if methode in Transaction.Methode.values else Transaction.Methode.SIMULE,
        pack=pack,
        abonnement=abonnement,
        idempotency_key=idempotency_key,
        metadata={"nb_sessions": pack.nb_sessions, "solde_apres": profile.solde},
    )
    notify(
        user,
        "Paiement confirmé",
        f"Votre pack « {pack.nom_pack} » est actif : {pack.nb_sessions} séances disponibles "
        f"jusqu'au {abonnement.date_fin:%d/%m/%Y}.",
        type_="confirmation",
        send_email=True,
    )
    return transaction, True


@db_transaction.atomic
def charge_session(user, demande, participant, methode: str = "simule", idempotency_key=None):
    existing = _existing(idempotency_key)
    if existing:
        return existing, False

    if participant.statut == participant.Statut.PAYE:
        raise PaymentError("Cette part a déjà été réglée.")
    if methode == "echec":
        return Transaction.objects.create(
            patient=user,
            montant=participant.montant,
            type=Transaction.Type.SEANCE,
            statut=Transaction.Statut.ECHEC,
            methode=Transaction.Methode.SIMULE,
            idempotency_key=idempotency_key,
            metadata={"demande": demande.id, "participant": participant.id},
        ), False

    profile, _ = PatientProfile.objects.select_for_update().get_or_create(user=user)
    montant = Decimal(participant.montant)
    if methode == Transaction.Methode.CREDIT:
        if profile.solde < 1:
            raise PaymentError("Votre solde de séances est insuffisant.")
        profile.solde -= 1
        profile.save(update_fields=["solde"])
        # consume from the oldest active subscription
        abonnement = (
            Abonnement.objects.select_for_update()
            .filter(patient=user, statut=Abonnement.Statut.ACTIF, solde_restants__gt=0)
            .order_by("date_fin")
            .first()
        )
        if abonnement:
            abonnement.consommer(1)
        montant = Decimal("0")
    else:
        abonnement = None

    transaction = Transaction.objects.create(
        patient=user,
        montant=montant,
        type=Transaction.Type.SEANCE,
        statut=Transaction.Statut.OK,
        methode=methode if methode in Transaction.Methode.values else Transaction.Methode.SIMULE,
        abonnement=abonnement,
        idempotency_key=idempotency_key,
        metadata={
            "demande": demande.id,
            "participant": participant.id,
            "participant_email": participant.email,
            "solde_apres": profile.solde,
        },
    )
    return transaction, True


@db_transaction.atomic
def refund_credit(user, montant_metadata):
    """Give back a session credit when a paid-by-credit booking is cancelled."""
    profile, _ = PatientProfile.objects.select_for_update().get_or_create(user=user)
    profile.solde += 1
    profile.save(update_fields=["solde"])
    abonnement = (
        Abonnement.objects.select_for_update()
        .filter(patient=user, pack__isnull=False)
        .order_by("-date_creation")
        .first()
    )
    if abonnement:
        abonnement.solde_restants += 1
        if abonnement.solde_restants > 0:
            abonnement.statut = Abonnement.Statut.ACTIF
        abonnement.save(update_fields=["solde_restants", "statut"])
    Transaction.objects.create(
        patient=user,
        montant=0,
        type=Transaction.Type.REMBOURSEMENT,
        statut=Transaction.Statut.OK,
        methode=Transaction.Methode.CREDIT,
        metadata=montant_metadata,
    )
    notify(user, "Séance recréditée", "Votre séance annulée a été recréditée sur votre compte.",
           type_="confirmation")
