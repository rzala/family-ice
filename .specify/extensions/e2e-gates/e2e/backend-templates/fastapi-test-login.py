# fastapi-test-login.py
#
# Test-only login endpoint for FastAPI / Flask backend.
# Mints a JWT without requiring magic link / email verification.
#
# USAGE:
# 1. Copy into your FastAPI app.
# 2. Include the router: app.include_router(test_router)
# 3. Run with APP_ENV=test to enable the endpoint.
# 4. NEVER expose in production.
#
# Dependencies: pip install pyjwt

import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import jwt

test_router = APIRouter(prefix="/api/test")


class LoginRequest(BaseModel):
    email: str = "test@example.com"


@test_router.post("/login")
async def test_login(body: LoginRequest):
    if os.getenv("APP_ENV") != "test":
        raise HTTPException(status_code=404, detail="Not found")

    secret = os.getenv("JWT_SECRET", "test-secret-do-not-use-in-prod")

    payload = {
        "sub": body.email,
        "email": body.email,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }

    token = jwt.encode(payload, secret, algorithm="HS256")
    return {"token": token, "email": body.email}
