from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsPatient(BasePermission):
    message = "Réservé aux patients."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "patient")


class IsTherapist(BasePermission):
    message = "Réservé aux thérapeutes."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "therapist")


class IsAdmin(BasePermission):
    message = "Réservé aux administrateurs."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.role == "admin" or request.user.is_staff)
        )


class IsOwnerOrAdmin(BasePermission):
    """Object level permission based on an `owner_field` attribute."""

    owner_field = "user"

    def has_object_permission(self, request, view, obj):
        if request.user.is_staff or request.user.role == "admin":
            return True
        owner = getattr(obj, self.owner_field, None)
        return owner == request.user


class ReadOnlyOrAdmin(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user.is_authenticated and (request.user.role == "admin" or request.user.is_staff))
