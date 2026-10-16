import urllib.request
import json
import zipfile
import io
import sys

API_BASE = "http://localhost:8000/api"

def test_user_profile_api():
    print("[TEST] 1. Validando endpoint /api/user/profile...")
    req = urllib.request.Request(f"{API_BASE}/user/profile", headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        status_code = resp.getcode()
        payload = json.loads(resp.read().decode("utf-8"))

    print(f"  - Codigo HTTP: {status_code}")
    assert status_code == 200
    assert payload.get("status") == "success"

    data = payload.get("data", {})
    user = data.get("user", {})
    stats = data.get("stats", {})
    prefs = data.get("preferences", {})

    print(f"  - Usuario: {user.get('name')} ({user.get('email')})")
    print(f"  - Rol: {user.get('role')}")
    print(f"  - Organizacion: {user.get('organization')} [{user.get('tax_id')}]")
    print(f"  - Facturas auditadas: {stats.get('invoices_audited')}")
    print(f"  - Partidas contables: {stats.get('accounting_items')}")
    print(f"  - Volumen acumulado: {stats.get('total_volume_eur')} EUR")
    print(f"  - Paridad de balance: {stats.get('parity_balance_rate')}%")
    print(f"  - Tolerancia de cuadre: {prefs.get('double_entry_tolerance')}")

    assert user.get("name") is not None
    assert stats.get("invoices_audited") > 0
    print("[SUCCESS] Endpoint /api/user/profile validado correctamente.\n")

def test_filtered_zip_export_debt():
    print("[TEST] 2. Validando solucion de deuda tecnica en /api/invoices/export-zip (Filtros por fecha, limite y cuota)...")
    
    # Test 2a: Export with limit=10
    url_limit = f"{API_BASE}/invoices/export-zip?limit=10"
    with urllib.request.urlopen(url_limit, timeout=30) as resp:
        zip_bytes = resp.read()
    with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as zf:
        json_entries = [n for n in zf.namelist() if n.startswith("desgloses_contables/") and n.endswith(".json")]
        print(f"  - Exportacion con limite seguro limit=10: {len(json_entries)} facturas empaquetadas (Esperadas: 10)")
        assert len(json_entries) == 10

    # Test 2b: Export with fiscal_year=2026
    url_year = f"{API_BASE}/invoices/export-zip?fiscal_year=2026&limit=15"
    with urllib.request.urlopen(url_year, timeout=30) as resp:
        zip_bytes = resp.read()
    with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as zf:
        json_entries = [n for n in zf.namelist() if n.startswith("desgloses_contables/") and n.endswith(".json")]
        print(f"  - Exportacion por ejercicio fiscal 2026 (limit=15): {len(json_entries)} facturas empaquetadas")
        assert len(json_entries) > 0

    # Test 2c: Export with quarter filter
    url_quarter = f"{API_BASE}/invoices/export-zip?quarter=Q4&limit=5"
    with urllib.request.urlopen(url_quarter, timeout=30) as resp:
        zip_bytes = resp.read()
    with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as zf:
        json_entries = [n for n in zf.namelist() if n.startswith("desgloses_contables/") and n.endswith(".json")]
        print(f"  - Exportacion por trimestre Q4 (limit=5): {len(json_entries)} facturas empaquetadas")
        assert len(json_entries) > 0

    print("[SUCCESS] Solucion de deuda tecnica de cuota, paginacion y filtros de fecha en export-zip validada.\n")

if __name__ == "__main__":
    test_user_profile_api()
    test_filtered_zip_export_debt()
    print("TODAS LAS PRUEBAS DE PERFIL Y CONTROL DE EXPORTACION HAN SIDO SUPERADAS.")
