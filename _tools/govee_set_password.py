"""Set the password for sko.bg/govee.

Encrypts the Govee API key with a password and writes it into govee/index.html
as the VAULT constant. The page decrypts it in the browser when the password is
entered. Neither the password nor the plain key is written to the repo.

The API key is read from ~/.tegrity/govee_lights.json (the Govee Lights tool's
config) or asked for if it isn't there.

Usage:  python _tools/govee_set_password.py        then commit + push.

_tools/ starts with "_" so GitHub Pages (Jekyll) does not publish it.
"""
import base64
import getpass
import hashlib
import json
import os
import re
import sys
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ITERATIONS = 600_000  # stored in VAULT.iter, the page reads it from there
PAGE = Path(__file__).resolve().parent.parent / "govee" / "index.html"
CONFIG = Path.home() / ".tegrity" / "govee_lights.json"


def api_key():
    try:
        key = json.loads(CONFIG.read_text(encoding="utf-8")).get("api_key", "")
    except (OSError, ValueError):
        key = ""
    if key:
        print(f"Using API key from {CONFIG}")
        return key
    return getpass.getpass("Govee API key: ").strip()


def main():
    key = api_key()
    if not key:
        sys.exit("No API key.")
    pw = getpass.getpass("New password: ")
    if len(pw) < 8:
        sys.exit("Use at least 8 characters — the encrypted key is public.")
    if getpass.getpass("Repeat password: ") != pw:
        sys.exit("Passwords differ.")

    salt, iv = os.urandom(16), os.urandom(12)
    aes = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, ITERATIONS, dklen=32)
    ct = AESGCM(aes).encrypt(iv, key.encode(), None)
    b64 = lambda b: base64.b64encode(b).decode()
    vault = json.dumps({"iter": ITERATIONS, "salt": b64(salt), "iv": b64(iv), "ct": b64(ct)})

    html = PAGE.read_text(encoding="utf-8")
    html, n = re.subn(r"^const VAULT = .*;$", f"const VAULT = {vault};", html, count=1, flags=re.M)
    if n != 1:
        sys.exit(f"VAULT line not found in {PAGE}")
    PAGE.write_text(html, encoding="utf-8", newline="\n")
    print(f"Password set in {PAGE}. Commit and push to publish.")


if __name__ == "__main__":
    main()
