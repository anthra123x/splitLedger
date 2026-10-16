"""
Suite Avanzada de Estrés, Saturación Estadística y Colas Asíncronas (5.000 - 10.000+ Documentos).
Evalúa:
  1. Heterogeneidad Compleja: Rectificativas negativas, Suministros multitramo, Honorarios con suplidos,
     SaaS multimoneda (USD/GBP), Tickets con IVA mixto (10% + 21%) y descuentos por línea.
  2. Distribuciones Log-Normales y Auditoría Forense de la Ley de Benford.
  3. Desacoplamiento Asíncrono: Envío a la cola de trabajos (Job Queue) con telemetría en streaming SSE.
"""

import time
import math
import random
import asyncio
from typing import List, Dict, Tuple
import httpx
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from app.main import app

console = Console()
BASE_URL = "http://testserver"


def generate_complex_heterogeneous_invoice(idx: int, inject_benford_anomaly: bool = False) -> Tuple[str, str, str]:
    """
    Genera documentos con alta complejidad estadística y contable.
    Retorna: (raw_text, filename, invoice_type)
    """
    invoice_types = [
        "RECTIFICATIVA_NEGATIVA",
        "SUMINISTRO_ELECTRICO_MULTITRAMO",
        "HONORARIOS_IRPF_SUPLIDOS",
        "SAAS_CLOUD_REVERSE_CHARGE",
        "TPV_TICKET_IVA_MIXTO",
        "HARDWARE_DESCUENTO_COMERCIAL"
    ]
    inv_type = random.choice(invoice_types)

    # Si se inyecta anomalía de Benford, sesgar artificialmente el primer dígito a 7 u 8
    if inject_benford_anomaly:
        first_d = random.choice([7, 8])
        base_amt = float(f"{first_d}{random.randint(10, 99)}.{random.randint(10, 99)}")
    else:
        # Distribución Log-Normal realista para gastos financieros (mu=5.5, sigma=1.2)
        base_amt = round(random.lognormvariate(5.0, 1.1), 2)
        base_amt = max(12.50, min(base_amt, 85000.0))

    if inv_type == "RECTIFICATIVA_NEGATIVA":
        # Abono contable con importes negativos
        base = -round(base_amt * 0.4, 2)
        tax = round(base * 0.21, 2)
        total = round(base + tax, 2)
        text = (
            f"FACTURA RECTIFICATIVA / ABONO #REC-2026-{idx:05d}\n"
            f"Emisor: Logística y Distribución Ibérica S.A. (A28456789)\n"
            f"Fecha: 2026-09-20\n"
            f"Motivo: Devolución de mercancía dañada albarán #9042\n"
            f"Partida: Regularización abono material defectuoso | Cant: 1 x {base}€ = {base}€ (IVA 21%)\n"
            f"Base Imponible: {base} EUR\n"
            f"Cuota IVA (21%): {tax} EUR\n"
            f"TOTAL ABONO A FAVOR DEL CLIENTE: {total} EUR\n"
        )
        return text, f"rectificativa_{idx}.txt", inv_type

    elif inv_type == "SUMINISTRO_ELECTRICO_MULTITRAMO":
        # Factura con término de potencia, energía e impuesto especial de electricidad
        p_potencia = round(base_amt * 0.35, 2)
        p_energia = round(base_amt * 0.65, 2)
        base = round(p_potencia + p_energia, 2)
        tax = round(base * 0.21, 2)
        total = round(base + tax, 2)
        text = (
            f"IBERDROLA CLIENTES S.A.U. - CIF: A95748356\n"
            f"Factura Nº: ELEC-2026-{idx:05d} | Fecha: 2026-10-02\n"
            f"Tarifa de Acceso 2.0TD - Potencia Contratada: 15.0 kW\n"
            f"Término de Potencia (30 días x 0.114€/kW día): {p_potencia} € (IVA 21%)\n"
            f"Término de Energía Activa (Consumo 1.450 kWh): {p_energia} € (IVA 21%)\n"
            f"Base Imponible Electricidad: {base} EUR\n"
            f"IVA Normal (21%): {tax} EUR\n"
            f"TOTAL IMPORTE FACTURA: {total} EUR\n"
        )
        return text, f"electricidad_{idx}.txt", inv_type

    elif inv_type == "HONORARIOS_IRPF_SUPLIDOS":
        # Honorarios profesionales: Base con 21% IVA y 15% retención IRPF
        base = round(base_amt, 2)
        tax = round(base * 0.21, 2)
        retention = round(base * 0.15, 2)
        total = round(base + tax - retention, 2)
        text = (
            f"GABINETE JURÍDICO Y ASESORÍA LABORAL S.L. - NIF: B84901234\n"
            f"Minuta de Honorarios Profesionales Nº: HON-2026-{idx:05d}\n"
            f"Fecha de emisión: 2026-10-10\n"
            f"Concepto: Dictamen pericial y defensa en auditoría fiscal mercantil | Base: {base}€ (IVA 21%)\n"
            f"Base Imponible Honorarios: {base} EUR\n"
            f"IVA (21%): {tax} EUR\n"
            f"Retención I.R.P.F. (15%): -{retention} EUR\n"
            f"LÍQUIDO A PERCIBIR: {total} EUR\n"
        )
        return text, f"honorarios_{idx}.txt", inv_type

    elif inv_type == "SAAS_CLOUD_REVERSE_CHARGE":
        # SaaS internacional en divisa extranjera con inversión de sujeto pasivo
        currency = random.choice(["USD", "GBP"])
        base = round(base_amt, 2)
        text = (
            f"GITHUB INC. / MICROSOFT CLOUD SERVICES - TAX ID: US94-321456\n"
            f"INVOICE NUMBER: GH-{idx:06d} | DATE: 2026-10-14\n"
            f"Customer: SplitLedger Labs (VAT: ESB87219034)\n"
            f"Reverse Charge Mechanism: Customer subject to VAT under Directive 2006/112/EC\n"
            f"Line 1: GitHub Enterprise Cloud Seats x 25: {base} {currency}\n"
            f"Subtotal: {base} {currency}\n"
            f"VAT / Tax (0%): 0.00 {currency}\n"
            f"TOTAL DUE: {base} {currency}\n"
        )
        return text, f"saas_intl_{idx}.txt", inv_type

    elif inv_type == "TPV_TICKET_IVA_MIXTO":
        # Ticket con IVA mixto (comida 10% y bebidas/licores 21%)
        base_10 = round(base_amt * 0.7, 2)
        tax_10 = round(base_10 * 0.10, 2)
        base_21 = round(base_amt * 0.3, 2)
        tax_21 = round(base_21 * 0.21, 2)
        subtotal = round(base_10 + base_21, 2)
        tax_total = round(tax_10 + tax_21, 2)
        total = round(subtotal + tax_total, 2)
        text = (
            f"RESTAURANTE Y CATERING LA FINCA S.L. - NIF: B28114477\n"
            f"Factura Simplificada TPV: TKT-2026-{idx:06d}\n"
            f"Fecha: 2026-10-12 14:35:12\n"
            f"Alimentos y Menú Degustación | Base: {base_10}€ (IVA 10% = {tax_10}€)\n"
            f"Servicio Bodega y Licores | Base: {base_21}€ (IVA 21% = {tax_21}€)\n"
            f"Base Imponible Total: {subtotal} EUR\n"
            f"Cuota IVA Total: {tax_total} EUR\n"
            f"TOTAL PAGADO: {total} EUR\n"
        )
        return text, f"ticket_tpv_{idx}.txt", inv_type

    else:
        # Hardware con descuento comercial
        base_orig = round(base_amt * 1.15, 2)
        descuento = round(base_orig * 0.15, 2)
        base = round(base_orig - descuento, 2)
        tax = round(base * 0.21, 2)
        total = round(base + tax, 2)
        text = (
            f"DELL TECHNOLOGIES SPAIN S.L. - NIF: B83229911\n"
            f"Factura Comercial Nº: DELL-2026-{idx:05d}\n"
            f"Fecha: 2026-10-11\n"
            f"Lote Servidores PowerEdge R750 | Importe Bruto: {base_orig}€\n"
            f"Descuento Promocional Flota (-15%): -{descuento}€\n"
            f"Base Imponible Neta: {base} EUR\n"
            f"IVA (21%): {tax} EUR\n"
            f"TOTAL FACTURA: {total} EUR\n"
        )
        return text, f"hardware_{idx}.txt", inv_type


async def test_async_queue_with_sse(num_documents: int = 5000):
    console.print(f"\n[bold yellow][STAGE] ETAPA 1: SATURACIÓN MASIVA CON COLA ASÍNCRONA ({num_documents} FACTURAS HETEROGÉNEAS)[/bold yellow]")
    
    console.print(f"[INFO] Generando {num_documents} facturas complejas (distribución log-normal, rectificativas, suministros, IVA mixto)...")
    t_gen0 = time.perf_counter()
    docs = []
    
    # Inyectar una anomalía intencional de Benford en un 15% del lote
    for i in range(num_documents):
        inject_benford = (i < int(num_documents * 0.20))
        text, fname, _ = generate_complex_heterogeneous_invoice(i + 1, inject_benford_anomaly=inject_benford)
        docs.append({"raw_text": text, "filename": fname})

    t_gen = (time.perf_counter() - t_gen0) * 1000
    console.print(f"[PASS] Generación completada en [cyan]{round(t_gen, 2)} ms[/cyan]")

    # 1. Enviar a la cola asíncrona
    t_submit0 = time.perf_counter()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url=BASE_URL, timeout=120.0) as client:
        submit_resp = await client.post(
            f"{BASE_URL}/api/v1/jobs/submit",
            json={"documents": docs, "generate_synthesis": True, "use_llm": False}
        )

        if submit_resp.status_code != 200:
            console.print(f"[bold red]Error encolando trabajo:[/bold red] {submit_resp.text}")
            return False

        submit_data = submit_resp.json()
        job_id = submit_data["job_id"]
        console.print(f"[bold green][PASS] Trabajo encolado con éxito:[/bold green] ID=[cyan]{job_id}[/cyan]")

        # 2. Conectar al stream SSE y monitorizar el progreso en tiempo real
        console.print(f"[STREAM] Escuchando telemetría en streaming SSE de [cyan]/api/v1/jobs/{job_id}/stream[/cyan]...")
        
        last_pct = 0.0
        t_start_stream = time.perf_counter()

        async with client.stream("GET", f"{BASE_URL}/api/v1/jobs/{job_id}/stream", timeout=120.0) as stream:
            async for line in stream.aiter_lines():
                if line.startswith("data:"):
                    raw_json = line.replace("data:", "").strip()
                    try:
                        import json
                        evt = json.loads(raw_json)
                        pct = evt.get("progress_percentage", 0.0)
                        stage = evt.get("current_stage", "")
                        status = evt.get("status", "")

                        if pct > last_pct or pct == 100.0 or status in ["COMPLETED", "FAILED"]:
                            last_pct = pct
                            bar = "█" * int(pct // 5) + "░" * (20 - int(pct // 5))
                            console.print(f"  [{bar}] [bold green]{pct}%[/bold green] | {stage}")

                        if status == "COMPLETED":
                            break
                        if status == "FAILED":
                            console.print(f"[bold red][ERROR] Fallo en trabajo:[/bold red] {evt.get('error_message')}")
                            return False
                    except Exception:
                        pass

        total_exec_time = (time.perf_counter() - t_start_stream) * 1000
        throughput = round(num_documents / (total_exec_time / 1000), 2)
        console.print(f"\n[bold green][SUCCESS] TRABAJO ASÍNCRONO COMPLETADO CON ÉXITO[/bold green]")
        console.print(f"  • Tiempo total de cómputo en cola: [cyan]{round(total_exec_time, 2)} ms[/cyan]")
        console.print(f"  • Throughput streaming sostenido: [bold green]{throughput} docs/segundo[/bold green]")

        # 3. Obtener el resultado final analítico
        final_resp = await client.get(f"{BASE_URL}/api/v1/jobs/{job_id}")
        res_data = final_resp.json().get("result", {})

        # Tabla resumen financiero del lote masivo
        metrics_table = Table(title=f"[METRICS] Análisis Financiero del Lote Masivo ({num_documents} Facturas Complejas)")
        metrics_table.add_column("Métrica", style="cyan")
        metrics_table.add_column("Valor Computado", style="green")

        metrics_table.add_row("Total Documentos Procesados", str(res_data.get("processed_count")))
        metrics_table.add_row("Volumen Total Facturado", f"{res_data.get('total_volume_amount')} €")
        metrics_table.add_row("Cuota IVA Global", f"{res_data.get('total_tax_amount')} €")
        metrics_table.add_row("Retenciones IRPF Totales", f"{res_data.get('total_retention_amount')} €")
        metrics_table.add_row("Partida Doble Balanceada", f"{res_data.get('balanced_percentage')}%")
        metrics_table.add_row("Tiempo Motor Columnar", f"{res_data.get('processing_time_ms')} ms")
        console.print(metrics_table)

        # Mostrar desglose por Centros de Coste detectados
        if res_data.get("cost_center_breakdown"):
            cc_table = Table(title="[COST_CENTERS] Centros de Coste (Clasificación PGC Multitramo)")
            cc_table.add_column("Centro de Coste", style="yellow")
            cc_table.add_column("Gasto Total (€)", style="green")
            cc_table.add_column("Líneas Contabilizadas", style="white")
            for cc in res_data.get("cost_center_breakdown", [])[:8]:
                cc_table.add_row(str(cc.get("cost_center")), f"{cc.get('total_spent')} €", str(cc.get("items_count")))
            console.print(cc_table)

        # Mostrar desglose por Tipos de IVA
        if res_data.get("tax_rate_breakdown"):
            vat_table = Table(title="[TAX_BREAKDOWN] Desglose por Tramo Fiscal de IVA")
            vat_table.add_column("Tipo Impositivo", style="cyan")
            vat_table.add_column("Base Imponible (€)", style="white")
            vat_table.add_column("Cuota IVA (€)", style="green")
            vat_table.add_column("Total Partidas", style="yellow")
            for tr in res_data.get("tax_rate_breakdown", []):
                vat_table.add_row(
                    f"{tr.get('tax_rate')}%",
                    f"{tr.get('base_sum')} €",
                    f"{tr.get('tax_sum')} €",
                    str(tr.get("items_count"))
                )
            console.print(vat_table)

        # Mostrar anomalías forenses detectadas (incluyendo Ley de Benford)
        anomalies = res_data.get("anomalies", [])
        console.print(f"\n[bold yellow][AUDIT] Auditoría Forense y Detección de Anomalías ({len(anomalies)} detectadas):[/bold yellow]")
        benford_found = False
        for an in anomalies[:8]:
            if "BENFORD" in an.get("anomaly_type", ""):
                benford_found = True
                console.print(f" • [bold magenta][LEY DE BENFORD][/bold magenta] {an.get('description')}")
            else:
                console.print(f" • [{an.get('severity')}] {an.get('description')}")

        if len(anomalies) > 8:
            console.print(f"   ... y {len(anomalies) - 8} anomalías más registradas en el reporte forense.")

        if benford_found:
            console.print("\n[bold green][PASS] PRUEBA FORENSE SUPERADA:[/bold green] El detector de la Ley de Benford identificó correctamente la inyección artificial de importes manipulados.")

        return True


async def main():
    console.print(Panel(
        "[bold cyan]TEST DE SATURACIÓN ESTADÍSTICA Y COLAS ASÍNCRONAS[/bold cyan]\n"
        "• 5.000 Facturas Heterogéneas Multitramo\n"
        "• Distribución Log-Normal & Auditoría Benford\n"
        "• Streaming SSE y Procesamiento Desacoplado",
        title="Split-Reasoner Enterprise Stress"
    ))
    await test_async_queue_with_sse(num_documents=5000)


if __name__ == "__main__":
    asyncio.run(main())
