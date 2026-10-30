from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.db import transaction as db_transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.models import TherapistProfile, User
from billing.models import Transaction
from billing.services import PaymentError, charge_session, refund_credit
from core.utils import notify

from .models import (
    Creneau,
    DemandeRDV,
    GoogleMeetSession,
    ParticipantDemande,
    Seance,
    SessionParticipant,
    generate_meeting,
)

TYPE_FACTOR = {
    DemandeRDV.TypeSession.INDIVIDUEL: Decimal("1"),
    DemandeRDV.TypeSession.COUPLE: Decimal("1.6"),
    DemandeRDV.TypeSession.FAMILLE: Decimal("2.2"),
}
TYPE_CAPACITY = {
    DemandeRDV.TypeSession.INDIVIDUEL: (1, 1),
    DemandeRDV.TypeSession.COUPLE: (2, 2),
    DemandeRDV.TypeSession.FAMILLE: (2, 5),
}


def _money(value: Decimal) -> Decimal:
    return Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def participants_demande(demande):
    return list(demande.participants.select_related("patient").all())


@db_transaction.atomic
def creer_demande(patient, creneau_id, type_session, message, invited):
    slot = Creneau.objects.select_for_update().select_related("therapeute__user").filter(pk=creneau_id).first()
    if not slot:
        raise ValidationError({"creneau": "Créneau introuvable."})
    if slot.statut != Creneau.Statut.LIBRE:
        raise ValidationError({"creneau": "Ce créneau n'est plus disponible."})
    if slot.date_heure_debut <= timezone.now():
        raise ValidationError({"creneau": "Ce créneau est déjà passé."})
    therapist = slot.therapeute
    if therapist.statut != TherapistProfile.Statut.ACTIVE or not therapist.user.is_active:
        raise ValidationError({"creneau": "Ce thérapeute n'est pas disponible."})

    type_session = type_session or DemandeRDV.TypeSession.INDIVIDUEL
    minimum, maximum = TYPE_CAPACITY[type_session]
    invited = invited or []
    total_participants = 1 + len(invited)
    if not minimum <= total_participants <= maximum:
        raise ValidationError({
            "participants": f"Une séance {type_session.lower()} accueille entre {minimum} et {maximum} participants."
        })

    emails = [patient.email.lower()]
    for item in invited:
        email = (item.get("email") or "").lower().strip()
        if not email or email in emails:
            raise ValidationError({"participants": "Chaque participant doit avoir un email unique."})
        emails.append(email)

    therapist = slot.therapeute
    total = _money(Decimal(therapist.tarif_seance) * TYPE_FACTOR[type_session])
    share = _money(total / total_participants)

    demande = DemandeRDV.objects.create(
        patient=patient,
        creneau=slot,
        type_session=type_session,
        message=message or "",
        prix_total=total,
        prix_par_participant=share,
    )
    ParticipantDemande.objects.create(
        demande=demande,
        patient=patient,
        email=patient.email,
        nom=patient.get_full_name() or patient.email,
        montant=share,
        est_createur=True,
    )
    for item in invited:
        email = (item.get("email") or "").lower().strip()
        linked = User.objects.filter(email=email, role=User.Role.PATIENT).first()
        ParticipantDemande.objects.create(
            demande=demande,
            patient=linked,
            email=email,
            nom=(item.get("nom") or (linked.get_full_name() if linked else "") or email).strip(),
            montant=share,
        )

    slot.statut = Creneau.Statut.EN_ATTENTE
    slot.save(update_fields=["statut"])

    notify(
        therapist.user,
        "Nouvelle demande de rendez-vous",
        f"{patient.get_full_name() or patient.email} souhaite une séance {type_session.lower()} "
        f"le {timezone.localtime(slot.date_heure_debut):%d/%m/%Y à %H:%M}.",
        type_="rappel",
        send_email=True,
    )
    return demande


@db_transaction.atomic
def accepter_demande(demande, therapist):
    demande = DemandeRDV.objects.select_for_update().select_related("creneau").get(pk=demande.pk)
    if demande.creneau.therapeute_id != therapist.id:
        raise PermissionDenied("Cette demande ne vous appartient pas.")
    if demande.statut != DemandeRDV.Statut.EN_ATTENTE:
        raise ValidationError({"detail": "Cette demande a déjà été traitée."})

    demande.statut = DemandeRDV.Statut.ACCEPTEE
    demande.date_reponse = timezone.now()
    demande.save(update_fields=["statut", "date_reponse"])

    for participant in demande.participants.select_related("patient"):
        if participant.patient:
            notify(
                participant.patient,
                "Rendez-vous accepté",
                f"Votre séance avec Dr {therapist.user.get_full_name()} est acceptée. "
                f"Merci de régler votre part de {participant.montant} DA pour confirmer.",
                type_="confirmation",
                send_email=True,
            )
    return demande


@db_transaction.atomic
def refuser_demande(demande, therapist, motif=""):
    demande = DemandeRDV.objects.select_for_update().select_related("creneau").get(pk=demande.pk)
    if demande.creneau.therapeute_id != therapist.id:
        raise PermissionDenied("Cette demande ne vous appartient pas.")
    if demande.statut != DemandeRDV.Statut.EN_ATTENTE:
        raise ValidationError({"detail": "Cette demande a déjà été traitée."})

    demande.statut = DemandeRDV.Statut.REFUSEE
    demande.motif_refus = motif or "Indisponibilité du praticien"
    demande.date_reponse = timezone.now()
    demande.save(update_fields=["statut", "motif_refus", "date_reponse"])

    slot = demande.creneau
    slot.statut = Creneau.Statut.LIBRE
    slot.save(update_fields=["statut"])

    notify(
        demande.patient,
        "Demande de rendez-vous refusée",
        f"Dr {therapist.user.get_full_name()} ne peut pas honorer votre demande. "
        "Vous pouvez choisir un autre créneau ou un autre thérapeute.",
        type_="message",
        send_email=True,
    )
    return demande


@db_transaction.atomic
def annuler_demande(demande, user, motif=""):
    demande = DemandeRDV.objects.select_for_update().select_related("creneau__therapeute").get(pk=demande.pk)
    is_patient = demande.patient_id == user.id
    is_therapist = demande.creneau.therapeute.user_id == user.id
    if not (is_patient or is_therapist or user.role == User.Role.ADMIN):
        raise PermissionDenied("Vous ne pouvez pas annuler cette demande.")
    if demande.statut in (DemandeRDV.Statut.ANNULEE, DemandeRDV.Statut.REFUSEE, DemandeRDV.Statut.EXPIREE):
        raise ValidationError({"detail": "Cette demande est déjà annulée."})
    if demande.statut == DemandeRDV.Statut.CONFIRMEE and is_patient:
        if demande.creneau.date_heure_debut - timezone.now() < timezone.timedelta(hours=24):
            raise ValidationError({"detail": "Une annulation est possible au plus tard 24 h avant la séance."})

    # refund credits for every participant who paid with credits
    for participant in demande.participants.filter(statut=ParticipantDemande.Statut.PAYE):
        transaction = Transaction.objects.filter(
            statut=Transaction.Statut.OK,
            type=Transaction.Type.SEANCE,
            methode=Transaction.Methode.CREDIT,
            metadata__participant=participant.id,
        ).first()
        if transaction and participant.patient:
            refund_credit(participant.patient, {"participant": participant.id, "demande": demande.id})
            transaction.statut = Transaction.Statut.REMBOURSEE
            transaction.save(update_fields=["statut"])

    if demande.statut == DemandeRDV.Statut.CONFIRMEE or hasattr(demande, "seance"):
        try:
            seance = demande.seance
            seance.statut = Seance.Statut.ANNULEE
            seance.save(update_fields=["statut"])
        except Seance.DoesNotExist:
            pass

    slot = demande.creneau
    if slot.date_heure_debut > timezone.now():
        slot.statut = Creneau.Statut.LIBRE
        slot.save(update_fields=["statut"])

    demande.statut = DemandeRDV.Statut.ANNULEE
    demande.motif_refus = motif
    demande.save(update_fields=["statut", "motif_refus"])

    notify(
        demande.creneau.therapeute.user,
        "Rendez-vous annulé",
        f"La séance du {timezone.localtime(slot.date_heure_debut):%d/%m à %H:%M} a été annulée.",
        type_="message",
        send_email=True,
    )
    notify(
        demande.patient,
        "Annulation enregistrée",
        f"Votre séance du {timezone.localtime(slot.date_heure_debut):%d/%m à %H:%M} a bien été annulée.",
        type_="message",
    )
    return demande


@db_transaction.atomic
def payer_participation(demande, participant, user, methode="simule", idempotency_key=None):
    demande = DemandeRDV.objects.select_for_update().select_related("creneau__therapeute").get(pk=demande.pk)
    if demande.statut not in (DemandeRDV.Statut.ACCEPTEE, DemandeRDV.Statut.CONFIRMEE):
        raise ValidationError({"detail": "Le thérapeute n'a pas encore accepté cette demande."})
    if participant.statut == ParticipantDemande.Statut.PAYE:
        raise ValidationError({"detail": "Cette part est déjà réglée."})
    if participant.statut == ParticipantDemande.Statut.REFUSE:
        raise ValidationError({"detail": "Ce participant a refusé la séance."})

    authorized = (
        participant.patient_id == user.id
        or demande.patient_id == user.id
        or user.role == User.Role.ADMIN
    )
    if not authorized:
        raise PermissionDenied("Vous ne pouvez pas régler cette part.")

    try:
        transaction, created = charge_session(
            user, demande, participant, methode=methode, idempotency_key=idempotency_key
        )
    except PaymentError as exc:
        raise ValidationError({"detail": str(exc)})

    if transaction.statut != Transaction.Statut.OK:
        raise ValidationError({"detail": "Le paiement a échoué. Veuillez réessayer."})

    participant.statut = ParticipantDemande.Statut.PAYE
    participant.date_paiement = timezone.now()
    participant.save(update_fields=["statut", "date_paiement"])

    if not demande.participants.filter(statut=ParticipantDemande.Statut.INVITE).exists():
        finaliser_seance(demande)

    return transaction


@db_transaction.atomic
def refuser_participation(demande, participant, user):
    demande = DemandeRDV.objects.select_for_update().select_related("creneau__therapeute").get(pk=demande.pk)
    if participant.patient_id != user.id and demande.patient_id != user.id:
        raise PermissionDenied("Vous ne pouvez pas refuser cette part.")
    if participant.statut == ParticipantDemande.Statut.PAYE:
        raise ValidationError({"detail": "Cette part est déjà réglée."})
    participant.statut = ParticipantDemande.Statut.REFUSE
    participant.save(update_fields=["statut"])

    demande.statut = DemandeRDV.Statut.ANNULEE
    demande.motif_refus = "Un participant a refusé la séance."
    demande.save(update_fields=["statut", "motif_refus"])
    slot = demande.creneau
    if slot.date_heure_debut > timezone.now():
        slot.statut = Creneau.Statut.LIBRE
        slot.save(update_fields=["statut"])

    notify(
        slot.therapeute.user,
        "Demande annulée",
        "Un participant a refusé la séance : le créneau a été libéré.",
        type_="message",
    )
    return participant


@db_transaction.atomic
def finaliser_seance(demande):
    """Called once every participant has paid."""
    demande = DemandeRDV.objects.select_for_update().select_related("creneau__therapeute").get(pk=demande.pk)
    if demande.statut == DemandeRDV.Statut.CONFIRMEE:
        try:
            return demande.seance
        except Seance.DoesNotExist:
            pass
    unpaid = demande.participants.exclude(statut=ParticipantDemande.Statut.PAYE)
    if unpaid.exists():
        raise ValidationError({"detail": "Tous les participants n'ont pas réglé leur part."})

    slot = demande.creneau
    meet_id, link = generate_meeting()
    seance = Seance.objects.create(
        demande=demande,
        patient=demande.patient,
        therapeute=slot.therapeute,
        lien_googlemeet=link,
        meet_id=meet_id,
        fournisseur="google_meet" if settings.GOOGLE_MEET_ENABLED else "demo",
        statut=Seance.Statut.PREVUE,
        date_debut=slot.date_heure_debut,
        date_fin=slot.date_heure_fin,
        type_session=demande.type_session,
        prix_final=demande.prix_total,
    )
    GoogleMeetSession.objects.create(seance=seance, meet_link=link, meet_id=meet_id)

    for participant in demande.participants.all():
        SessionParticipant.objects.create(
            seance=seance,
            patient=participant.patient,
            email=participant.email,
            nom=participant.nom,
            statut=SessionParticipant.Statut.PAYE,
        )

    Transaction.objects.filter(
        type=Transaction.Type.SEANCE,
        statut=Transaction.Statut.OK,
        metadata__demande=demande.id,
    ).update(seance=seance)

    slot.statut = Creneau.Statut.RESERVE
    slot.save(update_fields=["statut"])
    demande.statut = DemandeRDV.Statut.CONFIRMEE
    demande.save(update_fields=["statut"])

    notify(
        slot.therapeute.user,
        "Séance confirmée",
        f"La séance du {timezone.localtime(seance.date_debut):%d/%m/%Y à %H:%M} est confirmée et payée.",
        type_="confirmation",
        send_email=True,
    )
    for participant in demande.participants.select_related("patient"):
        if participant.patient:
            notify(
                participant.patient,
                "Votre séance est confirmée",
                f"Rendez-vous le {timezone.localtime(seance.date_debut):%d/%m/%Y à %H:%M} "
                f"avec Dr {slot.therapeute.user.get_full_name()}. Le lien de visioconférence "
                "sera accessible 15 minutes avant la séance.",
                type_="confirmation",
                send_email=True,
            )
    return seance


def rejoindre_seance(seance, user):
    is_patient = seance.patient_id == user.id
    is_therapist = seance.therapeute.user_id == user.id
    is_participant = seance.participants.filter(patient=user, statut=SessionParticipant.Statut.PAYE).exists()
    is_admin = user.role == User.Role.ADMIN
    if not (is_patient or is_therapist or is_participant or is_admin):
        raise PermissionDenied("Vous ne participez pas à cette séance.")
    if seance.statut == Seance.Statut.ANNULEE:
        raise ValidationError({"detail": "Cette séance a été annulée."})
    if seance.statut == Seance.Statut.TERMINEE:
        raise ValidationError({"detail": "Cette séance est terminée."})
    if not is_therapist and not is_admin:
        if not seance.participants.filter(patient=user, statut=SessionParticipant.Statut.PAYE).exists() and not is_patient:
            raise PermissionDenied("Votre paiement n'est pas validé.")
    if not seance.accessible_maintenant:
        local = timezone.localtime(seance.date_debut)
        raise ValidationError({
            "detail": f"Le lien sera disponible 15 minutes avant la séance (prévue le {local:%d/%m à %H:%M})."
        })

    if seance.statut == Seance.Statut.PREVUE:
        seance.statut = Seance.Statut.EN_COURS
        seance.date_debut_reelle = seance.date_debut_reelle or timezone.now()
        seance.save(update_fields=["statut", "date_debut_reelle"])
        try:
            meet = seance.meet_session
            meet.statut = GoogleMeetSession.Statut.EN_COURS
            meet.save(update_fields=["statut"])
        except GoogleMeetSession.DoesNotExist:
            pass
    seance.participants.filter(patient=user).update(a_rejoint=timezone.now())
    return seance


def terminer_seance(seance, user, notes=""):
    if seance.therapeute.user_id != user.id and user.role != User.Role.ADMIN:
        raise PermissionDenied("Seul le thérapeute peut clôturer la séance.")
    if seance.statut == Seance.Statut.TERMINEE:
        return seance
    seance.statut = Seance.Statut.TERMINEE
    seance.date_fin_reelle = timezone.now()
    if notes:
        seance.notes = notes
    seance.save(update_fields=["statut", "date_fin_reelle", "notes"])
    try:
        meet = seance.meet_session
        meet.statut = GoogleMeetSession.Statut.TERMINE
        meet.save(update_fields=["statut"])
    except GoogleMeetSession.DoesNotExist:
        pass
    notify(
        seance.patient,
        "Séance terminée",
        "Merci pour votre séance. N'hésitez pas à noter votre humeur du jour et à laisser un avis.",
        type_="message",
    )
    return seance
