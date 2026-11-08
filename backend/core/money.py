"""Money helpers: amounts are Decimal with 2 places, rounded half-up (cash-register convention)."""
from decimal import ROUND_HALF_UP, Decimal

CENT = Decimal("0.01")


def to_money(value) -> Decimal:
    """Convert int/float/str/Decimal to a 2-decimal Decimal without binary-float artefacts."""
    if value is None:
        return Decimal("0.00")
    if not isinstance(value, Decimal):
        value = Decimal(str(value))
    return value.quantize(CENT, rounding=ROUND_HALF_UP)
