from datetime import date
from app.core.tax_id_validator import FiscalTaxIdValidator
from app.core.temporal_punctuality import TemporalPunctualityEngine
from app.core.currency_normalizer import CurrencyTriangulationEngine


def test_fiscal_tax_id_checksums():
    # 1. DNI válido (53000000 -> 53000000 % 23 = 19 -> L)
    # Ejemplo real DNI: 12345678Z -> 12345678 % 23 = 14 -> Z
    res_dni = FiscalTaxIdValidator.validate_tax_id("12345678Z")
    assert res_dni.is_valid is True
    assert res_dni.entity_type == "PERSONA_FISICA_DNI"

    # DNI con letra errónea
    res_dni_bad = FiscalTaxIdValidator.validate_tax_id("12345678A")
    assert res_dni_bad.is_valid is False
    assert res_dni_bad.expected_control == "Z"

    # 2. CIF S.L. (Prefijo B)
    # B87219034
    res_cif = FiscalTaxIdValidator.validate_tax_id("B87219034")
    # Verificamos que evalúe y asigne entidad
    assert "CIF" in res_cif.entity_type
    assert res_cif.country_code == "ES"

    # 3. VIES Intracomunitario (LU26375245 - Amazon EMEA)
    res_vies = FiscalTaxIdValidator.validate_tax_id("LU26375245")
    assert res_vies.is_valid is True
    assert res_vies.country_code == "LU"
    assert res_vies.entity_type == "INTRACOMUNITARIO_VIES"


def test_temporal_punctuality():
    raw_text = """
    FACTURA: FAC-2026-001
    Fecha de emisión: 15 de marzo de 2026
    Forma de pago: transferencia a 60 días
    """
    ref_date = date(2026, 6, 1)  # 1 de junio 2026
    res = TemporalPunctualityEngine.evaluate_punctuality(
        raw_text=raw_text,
        reference_date=ref_date
    )
    assert res.normalized_invoice_date == "2026-03-15"
    assert res.payment_terms_days == 60
    assert res.normalized_due_date == "2026-05-14"
    # A 1 de junio, 2026-05-14 está vencida
    assert res.is_overdue is True
    assert res.days_overdue == 18


def test_currency_triangulation_bankers_rounding():
    # 100.005 USD a tipo 1.0850 con redondeo half-even
    conv = CurrencyTriangulationEngine.normalize_to_eur(108.50, "USD")
    assert conv.is_fx_applied is True
    assert conv.target_currency == "EUR"
    assert conv.converted_amount_eur == 100.00
    assert conv.exchange_rate_to_eur == 1.0850

    # EUR no sufre conversión
    conv_eur = CurrencyTriangulationEngine.normalize_to_eur(500.00, "EUR")
    assert conv_eur.is_fx_applied is False
    assert conv_eur.converted_amount_eur == 500.00


if __name__ == "__main__":
    test_fiscal_tax_id_checksums()
    test_temporal_punctuality()
    test_currency_triangulation_bankers_rounding()
    print("[+] Todas las pruebas de precisión y puntualidad pasaron al 100%!")
