import pyotp


def generate_totp_secret() -> str:
    return pyotp.random_base32()


def get_totp_uri(secret: str, email: str, issuer: str = "R2RA") -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=issuer)


def verify_totp(secret: str, code: str) -> bool:
    # valid_window=1 allows one period of clock skew (±30 s)
    return pyotp.TOTP(secret).verify(code, valid_window=1)
