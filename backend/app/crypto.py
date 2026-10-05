import base64
from cryptography.fernet import Fernet
from app.config import settings

_fernet_instance = None


def get_fernet() -> Fernet:
    global _fernet_instance
    if _fernet_instance is None:
        try:
            key = settings.FERNET_KEY.encode()
            _fernet_instance = Fernet(key)
        except Exception:
            # Fallback to generating a deterministic key from the string
            padded = settings.FERNET_KEY.ljust(32)[:32].encode()
            url_safe = base64.urlsafe_b64encode(padded)
            _fernet_instance = Fernet(url_safe)
    return _fernet_instance


def encrypt_field(plain: str) -> str:
    if not plain:
        return ""
    f = get_fernet()
    return f.encrypt(plain.encode("utf-8")).decode("utf-8")


def decrypt_field(cipher_text: str) -> str:
    if not cipher_text:
        return ""
    try:
        f = get_fernet()
        return f.decrypt(cipher_text.encode("utf-8")).decode("utf-8")
    except Exception:
        # If decryption fails (e.g. legacy plain text), return as-is
        return cipher_text


def mask_value(val: str, visible: int = 4) -> str:
    if not val:
        return ""
    if len(val) <= visible:
        return "•" * len(val)
    return "•" * min(len(val) - visible, 8) + val[-visible:]
