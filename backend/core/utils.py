from django.utils import timezone

from .models import AuditLog


def client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def log_action(request, action, table="", details=None):
    """Best-effort audit trail — never breaks the business flow."""
    try:
        user = request.user if getattr(request, "user", None) and request.user.is_authenticated else None
        AuditLog.objects.create(
            user=user,
            action=action,
            table_affectee=table,
            details=details or {},
            ip_address=client_ip(request),
        )
    except Exception:  # pragma: no cover - audit must never raise
        pass


def notify(user, titre, message, type_="message", canal="push", send_email=False):
    """Create an in-app notification and optionally queue an email."""
    from messaging.models import Notification

    notification = Notification.objects.create(
        user=user,
        titre=titre,
        message=message,
        type=type_,
        canal=canal,
        statut="envoyee",
    )
    if send_email:
        from django.core.mail import send_mail

        try:
            send_mail(titre, message, None, [user.email], fail_silently=True)
        except Exception:  # pragma: no cover
            pass
    return notification


def now():
    return timezone.now()
