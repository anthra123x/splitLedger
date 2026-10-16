import os
import sys
import zipfile
import tempfile
import json
import io
import urllib.request
import urllib.error

API_BASE = "http://localhost:8000/api"
CORPUS_DIR = "/home/omicron/Documentos/descomponerfacturas/tests/high_volume_corpus"

def test_export_zip_all():
    print("[TEST] 1. Probando exportacion masiva de dossier contable en ZIP (/api/invoices/export-zip)...")
    url = f"{API_BASE}/invoices/export-zip"
    
    req = urllib.request.Request(url, headers={"Accept": "application/zip"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        status_code = resp.getcode()
        content_type = resp.headers.get("Content-Type")
        disposition = resp.headers.get("Content-Disposition", "")
        zip_bytes = resp.read()

    print(f"  - Codigo HTTP: {status_code}")
    print(f"  - Content-Type: {content_type}")
    print(f"  - Content-Disposition: {disposition}")
    print(f"  - Tamano del ZIP recibido: {len(zip_bytes):,} bytes")

    if status_code != 200 or "application/zip" not in content_type:
        print("[ERROR] Respuesta invalida al solicitar export-zip")
        sys.exit(1)

    # Inspect zip contents
    with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as zf:
        namelist = zf.namelist()
        print(f"  - Archivos dentro del ZIP: {len(namelist)}")
        
        has_csv = "00_Libro_Diario_Consolidado.csv" in namelist
        has_readme = "00_INFORME_CONCILIACION.txt" in namelist
        json_entries = [n for n in namelist if n.startswith("desgloses_contables/") and n.endswith(".json")]
        doc_entries = [n for n in namelist if n.startswith("documentos_fuente/")]

        print(f"  - Contiene CSV consolidado: {has_csv}")
        print(f"  - Contiene informe auditoria: {has_readme}")
        print(f"  - Ficheros JSON de desglose contable: {len(json_entries)}")
        print(f"  - Documentos fuente archivados: {len(doc_entries)}")

        if not (has_csv and has_readme and len(json_entries) > 0):
            print("[ERROR] Estructura del paquete ZIP incompleta")
            sys.exit(1)

        # Inspect CSV BOM
        csv_data = zf.read("00_Libro_Diario_Consolidado.csv")
        if csv_data.startswith(b"\xef\xbb\xbf"):
            print("  - Verificacion UTF-8 BOM en CSV: Correcto")

        # Read first lines of README
        readme_text = zf.read("00_INFORME_CONCILIACION.txt").decode("utf-8")
        first_line = readme_text.splitlines()[1] if len(readme_text.splitlines()) > 1 else ""
        print(f"  - Encabezado informe: {first_line}")

    print("[SUCCESS] Prueba de exportacion masiva ZIP superada con exito.\n")

def test_export_zip_selected_ids():
    print("[TEST] 2. Probando exportacion de IDs especificos en ZIP (/api/invoices/export-zip?ids=...)...")
    # First get 3 invoice IDs from the database
    with urllib.request.urlopen(f"{API_BASE}/invoices?limit=3") as resp:
        invoices_data = json.loads(resp.read().decode("utf-8"))
        items = invoices_data["data"]["invoices"]
        ids = [it["id"] for it in items]

    print(f"  - IDs seleccionados: {ids}")
    url = f"{API_BASE}/invoices/export-zip?ids={','.join(ids)}"

    with urllib.request.urlopen(url, timeout=30) as resp:
        zip_bytes = resp.read()

    with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as zf:
        json_entries = [n for n in zf.namelist() if n.startswith("desgloses_contables/") and n.endswith(".json")]
        print(f"  - Facturas incluidas en el ZIP filtrado: {len(json_entries)} (Esperadas: {len(ids)})")
        if len(json_entries) != len(ids):
            print(f"[ERROR] Discrepancia en cantidad de facturas filtradas: {len(json_entries)} vs {len(ids)}")
            sys.exit(1)

    print("[SUCCESS] Prueba de exportacion filtrada por IDs superada con exito.\n")

def test_upload_streaming_sse():
    print("[TEST] 3. Probando carga asincrona por streaming SSE (/api/invoices/upload-stream)...")
    # Create a small ZIP with 5 heterogeneous invoices
    temp_dir = tempfile.mkdtemp()
    zip_path = os.path.join(temp_dir, "lote_streaming_test.zip")
    corpus_files = sorted(os.listdir(CORPUS_DIR))[:5]

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for fname in corpus_files:
            fpath = os.path.join(CORPUS_DIR, fname)
            zf.write(fpath, arcname=fname)

    boundary = "----WebKitFormBoundaryStreamTest" + os.urandom(8).hex()
    with open(zip_path, "rb") as f:
        file_bytes = f.read()

    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="invoice"; filename="lote_streaming_test.zip"\r\n'
        f"Content-Type: application/zip\r\n\r\n"
    ).encode("utf-8") + file_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")

    req = urllib.request.Request(
        f"{API_BASE}/invoices/upload-stream",
        data=body,
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Accept": "text/event-stream"
        },
        method="POST"
    )

    received_events = []
    processed_invoices = []

    with urllib.request.urlopen(req, timeout=60) as resp:
        status_code = resp.getcode()
        content_type = resp.headers.get("Content-Type")
        print(f"  - Codigo HTTP: {status_code}")
        print(f"  - Content-Type: {content_type}")

        buffer = ""
        while True:
            chunk = resp.read(256)
            if not chunk:
                break
            buffer += chunk.decode("utf-8", errors="replace")
            while "\n\n" in buffer:
                part, buffer = buffer.split("\n\n", 1)
                for line in part.splitlines():
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        try:
                            payload = json.loads(data_str)
                            evt = payload.get("event")
                            received_events.append(evt)
                            if evt == "init":
                                print(f"  -> Evento SSE [init]: Total {payload.get('total')} archivos")
                            elif evt == "progress":
                                print(f"  -> Evento SSE [progress]: Archivo {payload.get('index')}/{payload.get('total')}: {payload.get('currentFile')}")
                            elif evt == "item_processed":
                                inv = payload.get("invoice", {})
                                processed_invoices.append(inv)
                                print(f"  -> Evento SSE [item_processed]: {inv.get('invoice_number')} | {inv.get('supplier_name')} | Total: {inv.get('grand_total')} EUR")
                            elif evt == "complete":
                                print(f"  -> Evento SSE [complete]: {payload.get('processedCount')} facturas procesadas con importe acumulado: {payload.get('totalAmount'):,.2f} EUR")
                        except Exception as e:
                            pass

    print(f"  - Secuencia de eventos SSE capturados: {set(received_events)}")
    print(f"  - Total facturas recibidas y validadas via SSE: {len(processed_invoices)}")

    os.remove(zip_path)
    os.rmdir(temp_dir)

    if len(processed_invoices) != 5:
        print(f"[ERROR] Se esperaban 5 facturas en streaming, se recibieron: {len(processed_invoices)}")
        sys.exit(1)

    print("[SUCCESS] Prueba de streaming SSE superada con exito.\n")

if __name__ == "__main__":
    test_export_zip_all()
    test_export_zip_selected_ids()
    test_upload_streaming_sse()
    print("TODAS LAS PRUEBAS DE DEUDAS Y PENDIENTES HAN SIDO EJECUTADAS Y SUPERADAS CON EXITO.")
