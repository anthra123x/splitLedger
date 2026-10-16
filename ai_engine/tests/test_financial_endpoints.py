from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"


def test_decompose_multi_tax_and_journal_entry():
    raw_text = """
    PROVEEDOR: Hostelería y Distribuciones del Sur S.L.
    NIF: B91234567
    FACTURA: FAC-2026-9901
    FECHA: 2026-10-15
    CLIENTE: SplitLedger Labs S.L. (ESB87219034)
    ----------------------------------------------------
    Menú ejecutivo restaurante | 2 x 45.00€ = 90.00€ (IVA 10%)
    Servicio asesoramiento técnico | 1 x 200.00€ = 200.00€ (IVA 21%)
    ----------------------------------------------------
    Subtotal: 290.00€
    IVA 10%: 9.00€
    IVA 21%: 42.00€
    Retención IRPF (15% sobre 200€): 30.00€
    TOTAL: 311.00€
    """
    response = client.post("/api/v1/decompose", json={
        "raw_text": raw_text,
        "document_name": "factura_multitasa.txt",
        "use_llm": False
    })
    assert response.status_code == 200
    data = response.json()
    assert data["invoice_number"] == "FAC-2026-9901"
    assert data["subtotal"] > 0
    assert data["grand_total"] > 0
    assert "tax_breakdown" in data
    assert "journal_entry" in data
    if data["journal_entry"]:
        je = data["journal_entry"]
        assert je["is_balanced"] is True
        assert abs(je["total_debit"] - je["total_credit"]) <= 0.05
        # Comprobar que existen cuentas en el Debe y en el Haber
        assert len(je["lines"]) >= 3


def test_bank_reconciliation_endpoint():
    bank_records = [
        {"date": "2026-10-12", "concept": "TRF PAGO PROV FAC-001", "amount": -121.00},
        {"date": "2026-10-13", "concept": "TRF PAGO PROV FAC-002", "amount": -500.00},
        {"date": "2026-10-14", "concept": "COMISION BANCARIA", "amount": -15.50}
    ]
    invoices = [
        {"invoice_number": "FAC-001", "grand_total": 121.00, "supplier_name": "Proveedor A"},
        {"invoice_number": "FAC-002", "grand_total": 500.00, "supplier_name": "Proveedor B"}
    ]
    response = client.post("/api/v1/finance/reconcile-bank", json={
        "bank_records": bank_records,
        "invoices": invoices,
        "tolerance_cents": 0.05
    })
    assert response.status_code == 200
    result = response.json()
    assert result["total_bank_movements"] == 3
    assert result["matched_count"] == 2
    assert len(result["unreconciled_movements"]) == 1
    assert result["reconciled_percentage"] == 66.7
    assert result["total_reconciled_volume"] == 621.00


def test_prorata_amortization_endpoint():
    response = client.post("/api/v1/finance/prorata-amortization", json={
        "taxable_turnover": 75000.0,
        "exempt_turnover": 25000.0,
        "asset_base": 12000.0,
        "asset_useful_life_years": 4,
        "amortization_method": "LINEAR"
    })
    assert response.status_code == 200
    res = response.json()
    # (75000 / 100000) * 100 = 75%
    assert res["vat_prorata_percentage"] == 75
    assert res["is_prorata_applicable"] is True
    assert res["deductible_vat_factor"] == 0.75
    assert len(res["amortization_schedule"]) == 4
    assert res["annual_amortization_quota"] == 3000.0
    # Al final del año 4, el valor contable neto debe ser 0.0€
    assert res["amortization_schedule"][-1]["net_book_value"] == 0.0


def test_fraud_audit_smurfing_endpoint():
    invoices = [
        {"invoice_number": "SM-01", "grand_total": 980.00, "supplier_name": "Servicios Alpha S.L."},
        {"invoice_number": "SM-02", "grand_total": 950.00, "supplier_name": "Servicios Alpha S.L."},
        {"invoice_number": "SM-03", "grand_total": 990.00, "supplier_name": "Servicios Alpha S.L."},
        {"invoice_number": "REG-01", "grand_total": 5000.00, "supplier_name": "Equipos Beta S.A."}
    ]
    response = client.post("/api/v1/finance/fraud-audit", json={
        "invoices": invoices,
        "smurfing_threshold": 1000.0,
        "cluster_window_days": 5
    })
    assert response.status_code == 200
    audit = response.json()
    assert audit["risk_level"] in ["HIGH", "CRITICAL"]
    assert audit["composite_score"] >= 45.0
    assert len(audit["smurfing_signals"]) >= 1
    assert "ALERTA CRÍTICA" in audit["detailed_findings"][0]


if __name__ == "__main__":
    test_health()
    test_decompose_multi_tax_and_journal_entry()
    test_bank_reconciliation_endpoint()
    test_prorata_amortization_endpoint()
    test_fraud_audit_smurfing_endpoint()
    print("[+] Todos los tests de endpoints financieros pasaron con éxito al 100%!")
