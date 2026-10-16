from decimal import Decimal, ROUND_HALF_EVEN
from typing import Dict, Any, Optional
from pydantic import BaseModel


class CurrencyConversionResult(BaseModel):
    original_currency: str
    target_currency: str = "EUR"
    original_amount: float
    exchange_rate_to_eur: float
    converted_amount_eur: float
    is_fx_applied: bool
    diagnostic_message: str


class CurrencyTriangulationEngine:
    """
    Motor de Triangulación y Normalización de Divisas Extranjeras.
    Aplica redondeo bancario exacto (Banker's Rounding: ROUND_HALF_EVEN) para eliminar deriva decimal.
    """

    # Tipos de cambio de referencia BCE (Banco Central Europeo)
    OFFICIAL_ECB_FIXING_RATES = {
        "EUR": Decimal("1.0"),
        "USD": Decimal("1.0850"),  # 1 EUR = 1.0850 USD
        "GBP": Decimal("0.8550"),  # 1 EUR = 0.8550 GBP
        "CHF": Decimal("0.9650"),  # 1 EUR = 0.9650 CHF
        "JPY": Decimal("162.50"),  # 1 EUR = 162.50 JPY
        "CAD": Decimal("1.4720")   # 1 EUR = 1.4720 CAD
    }

    @classmethod
    def normalize_to_eur(
        cls,
        amount: float,
        currency: str,
        custom_rate: Optional[float] = None
    ) -> CurrencyConversionResult:
        curr = currency.strip().upper() if currency else "EUR"
        dec_amount = Decimal(str(amount))

        if curr == "EUR" or curr not in cls.OFFICIAL_ECB_FIXING_RATES:
            val = float(dec_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN))
            return CurrencyConversionResult(
                original_currency=curr,
                target_currency="EUR",
                original_amount=val,
                exchange_rate_to_eur=1.0,
                converted_amount_eur=val,
                is_fx_applied=False,
                diagnostic_message="Moneda base EUR o sin conversión requerida."
            )

        fx_rate = Decimal(str(custom_rate)) if custom_rate else cls.OFFICIAL_ECB_FIXING_RATES[curr]
        # Converted EUR = original / rate
        converted_dec = (dec_amount / fx_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN)
        converted_val = float(converted_dec)

        msg = f"Conversión FX: {amount} {curr} a tipo BCE {fx_rate} -> {converted_val} EUR (Redondeo Banker's Half-Even)."

        return CurrencyConversionResult(
            original_currency=curr,
            target_currency="EUR",
            original_amount=float(dec_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN)),
            exchange_rate_to_eur=float(fx_rate),
            converted_amount_eur=converted_val,
            is_fx_applied=True,
            diagnostic_message=msg
        )
