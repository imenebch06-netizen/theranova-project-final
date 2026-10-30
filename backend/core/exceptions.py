import logging

from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def api_exception_handler(exc, context):
    """Return a consistent `{detail, errors}` payload for every API error."""
    response = exception_handler(exc, context)
    if response is None:
        logger.exception("Unhandled API error", exc_info=exc)
        return response

    detail = response.data
    if isinstance(detail, dict) and "detail" in detail:
        message = detail["detail"]
    elif isinstance(detail, (list, tuple)):
        message = " ".join(str(item) for item in detail)
    else:
        message = "Certains champs sont invalides."

    response.data = {"detail": str(message), "errors": response.data}
    return response
