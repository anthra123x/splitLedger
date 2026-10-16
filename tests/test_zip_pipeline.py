import os
import sys
import zipfile
import tempfile
import json
import urllib.request
import urllib.error

API_URL = "http://localhost:8000/api/invoices/upload"
CORPUS_DIR = "/home/omicron/Documentos/descomponerfacturas/tests/high_volume_corpus"

def create_test_zip(zip_path: str, num_files: int = 20):
    corpus_files = sorted(os.listdir(CORPUS_DIR))[:num_files]
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for i, fname in enumerate(corpus_files):
            fpath = os.path.join(CORPUS_DIR, fname)
            if i % 3 == 0:
                arcname = f"lote_2026/enero/{fname}"
            elif i % 3 == 1:
                arcname = f"departamento_contable/{fname}"
            else:
                arcname = fname
            zf.write(fpath, arcname=arcname)
        
        # Add defensive test files that should be ignored safely
        zf.writestr("__MACOSX/._dummy_invoice.xml", b"\x00\x05\x16\x07\x00")
        zf.writestr(".DS_Store", b"dummy ds store binary content")
        zf.writestr("lote_2026/manual_usuario.exe", b"MZDummyBinary")
        zf.writestr("empty_draft.pdf", b"")

    print(f"[TEST] ZIP creado en: {zip_path} con {len(corpus_files)} facturas y 4 archivos de prueba defensiva.")
    return len(corpus_files)

def post_multipart(url: str, file_path: str, field_name: str = "invoice"):
    boundary = "----WebKitFormBoundary" + os.urandom(16).hex()
    filename = os.path.basename(file_path)
    
    with open(file_path, "rb") as f:
        file_bytes = f.read()

    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="{field_name}"; filename="{filename}"\r\n'
        f"Content-Type: application/zip\r\n\r\n"
    ).encode("utf-8") + file_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")

    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Accept": "application/json"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            status_code = resp.getcode()
            response_body = resp.read().decode("utf-8")
            return status_code, json.loads(response_body)
    except urllib.error.HTTPError as e:
        status_code = e.code
        err_body = e.read().decode("utf-8")
        try:
            return status_code, json.loads(err_body)
        except Exception:
            return status_code, {"error": err_body}

def test_zip_upload():
    print("[TEST] Iniciando prueba de ingestion de archivo ZIP masivo...")
    temp_dir = tempfile.mkdtemp()
    zip_path = os.path.join(temp_dir, "lote_facturas_empresa.zip")
    
    expected_count = create_test_zip(zip_path, num_files=20)
    status_code, payload = post_multipart(API_URL, zip_path, "invoice")

    print(f"[TEST] Codigo HTTP respuesta: {status_code}")
    if status_code != 201:
        print(f"[ERROR] Respuesta inesperada: {payload}")
        sys.exit(1)

    print(f"[TEST] Mensaje de respuesta: {payload.get('message')}")
    print(f"[TEST] Facturas procesadas en lote: {payload.get('count')}")
    
    invoices = payload.get("data", [])
    if not isinstance(invoices, list):
        print(f"[ERROR] 'data' deberia ser lista, se obtuvo: {type(invoices)}")
        sys.exit(1)

    if len(invoices) != expected_count:
        print(f"[ERROR] Se esperaban {expected_count} facturas, se obtuvieron {len(invoices)}")
        sys.exit(1)

    # Validate each invoice
    balanced_count = 0
    total_items = 0
    total_amount = 0.0

    for inv in invoices:
        grand_total = float(inv.get("grand_total") or 0.0)
        items = inv.get("items", [])
        total_items += len(items)
        total_amount += grand_total

        # Check double-entry parity
        subtotal = float(inv.get("subtotal") or 0.0)
        tax = float(inv.get("tax_total") or 0.0)
        if abs((subtotal + tax) - grand_total) < 0.05:
            balanced_count += 1

    print(f"[TEST] Resumen del lote ZIP:")
    print(f"  - Total facturas extraidas y persistidas: {len(invoices)}/{expected_count}")
    print(f"  - Total partidas contables creadas: {total_items}")
    print(f"  - Importe total procesado: {total_amount:,.2f} EUR")
    print(f"  - Facturas con paridad contable equilibrada: {balanced_count}/{len(invoices)} ({balanced_count/len(invoices)*100:.1f}%)")

    os.remove(zip_path)
    os.rmdir(temp_dir)
    print("[TEST] Archivo temporal limpiado exitosamente.")
    return True

def test_empty_zip():
    print("\n[TEST] Probando archivo ZIP vacio o sin facturas validas (defensa 422)...")
    temp_dir = tempfile.mkdtemp()
    zip_path = os.path.join(temp_dir, "empty.zip")
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("notes.doc", b"just notes")
        zf.writestr(".DS_Store", b"hidden")

    status_code, payload = post_multipart(API_URL, zip_path, "invoice")

    print(f"[TEST] Codigo HTTP respuesta: {status_code}")
    if status_code == 422:
        print(f"[TEST] Correcto: HTTP 422 recibido ante ZIP sin facturas soportadas. Mensaje: {payload.get('message')}")
    else:
        print(f"[WARN] Codigo HTTP obtenido: {status_code}, respuesta: {payload}")

    os.remove(zip_path)
    os.rmdir(temp_dir)

if __name__ == "__main__":
    test_zip_upload()
    test_empty_zip()
