"""Country profiles: phone format, currency, tax and timezone defaults.

Adding a market = adding one entry here (and translations on the frontend).
VAT rates are defaults the merchant can override; sources in docs/audit/RESEARCH.md.
"""
import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Country:
    code: str
    calling_code: str
    currency: str
    timezone: str
    locale: str
    tax_label: str
    vat_rates: tuple[float, ...]  # standard first; empty = no national VAT (e.g. US sales tax)
    national_digits: int  # digits of a national number without trunk "0"


COUNTRIES: dict[str, Country] = {c.code: c for c in (
    Country("MA", "212", "MAD", "Africa/Casablanca", "fr-MA", "TVA", (20, 14, 10, 7), 9),
    Country("DZ", "213", "DZD", "Africa/Algiers", "fr-DZ", "TVA", (19, 9), 9),
    Country("TN", "216", "TND", "Africa/Tunis", "fr-TN", "TVA", (19, 13, 7), 8),
    Country("SN", "221", "XOF", "Africa/Dakar", "fr-SN", "TVA", (18, 10), 9),
    Country("CI", "225", "XOF", "Africa/Abidjan", "fr-CI", "TVA", (18, 9), 10),
    Country("FR", "33", "EUR", "Europe/Paris", "fr-FR", "TVA", (20, 10, 5.5, 2.1), 9),
    Country("BE", "32", "EUR", "Europe/Brussels", "fr-BE", "TVA", (21, 12, 6), 9),
    Country("ES", "34", "EUR", "Europe/Madrid", "es-ES", "IVA", (21, 10, 4), 9),
    Country("DE", "49", "EUR", "Europe/Berlin", "de-DE", "MwSt", (19, 7), 11),
    Country("IT", "39", "EUR", "Europe/Rome", "it-IT", "IVA", (22, 10, 5, 4), 10),
    Country("NL", "31", "EUR", "Europe/Amsterdam", "nl-NL", "BTW", (21, 9), 9),
    Country("GB", "44", "GBP", "Europe/London", "en-GB", "VAT", (20, 5, 0), 10),
    Country("US", "1", "USD", "America/New_York", "en-US", "Sales tax", (), 10),
    Country("CA", "1", "CAD", "America/Toronto", "en-CA", "GST/HST", (5,), 10),
)}


def get_country(code: str | None) -> Country:
    return COUNTRIES.get((code or "MA").upper(), COUNTRIES["MA"])


def normalize_phone(phone: str, country: str | None = "MA") -> str:
    """Return E.164 digits without '+' (the format WhatsApp Cloud API uses).

    0612345678 / +212 6-12-34-56-78 / 00212612345678 → 212612345678 (country MA)
    06 12 34 56 78 (FR) → 33612345678 ; (415) 555-0100 (US) → 14155550100
    """
    raw = (phone or "").strip()
    digits = re.sub(r"\D", "", raw)
    if raw.startswith("+"):
        return digits
    if digits.startswith("00"):
        return digits[2:]
    c = get_country(country)
    if c.calling_code == "1":  # NANP has no trunk 0
        return "1" + digits if len(digits) == 10 else digits
    if digits.startswith("0") and len(digits) == c.national_digits + 1:
        return c.calling_code + digits[1:]
    if len(digits) == c.national_digits and not digits.startswith(c.calling_code):
        # Moroccan users often drop the 0 (612345678); keep MA's historical rule for mobiles only
        if c.code != "MA" or digits[0] in "567":
            return c.calling_code + digits
    return digits
