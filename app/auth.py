from fastapi import Depends, HTTPException, Request, status

from app.config import settings


async def require_dashboard_token(request: Request) -> None:
    """
    Simple bearer-token gate for the dashboard/API.

    If DASHBOARD_TOKEN is not set, auth is effectively disabled.
    """
    expected = settings.dashboard_token
    if not expected:
        return

    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization token.",
        )

    token = auth_header.removeprefix("Bearer ").strip()
    if token != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization token.",
        )

