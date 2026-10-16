import os
import sys
import json
import asyncio
from pathlib import Path
from typing import Optional
import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.json import JSON

from app.core.engine import SplitReasonerEngine
from app.training.dataset_generator import DatasetGenerator
from app.core.tax_id_validator import FiscalTaxIdValidator

app = typer.Typer(
    name="analista",
    help="Analista de Datos CLI - Motor Neuro-Simbólico de Razonamiento y Auditoría Forense"
)
console = Console()
engine = SplitReasonerEngine()


@app.command()
def analyze(
    file_path: str = typer.Argument(..., help="Ruta al archivo de texto (.txt) o factura"),
    use_llm: bool = typer.Option(False, "--use-llm", help="Activar llamada al LLM remoto"),
    as_json: bool = typer.Option(False, "--json", help="Imprimir salida completa en formato JSON")
):
    """
    Analiza y descompone un documento contable individual con traza de pensamiento CoT y asiento PGC.
    """
    path = Path(file_path).resolve()
    if not path.exists():
        console.print(f"[red]Error:[/red] El archivo {path} no existe.")
        raise typer.Exit(1)

    raw_text = path.read_text(encoding="utf-8", errors="ignore")

    async def run():
        return await engine.process_document(raw_text, filename=path.name, use_llm=use_llm)

    result = asyncio.run(run())

    if as_json:
        print(result.model_dump_json(indent=2))
        return

    console.print(Panel(
        f"[bold cyan]Factura:[/bold cyan] {result.invoice_number} | [bold cyan]Fecha:[/bold cyan] {result.invoice_date}\n"
        f"[bold cyan]Proveedor:[/bold cyan] {result.supplier_name} ({result.supplier_tax_id})\n"
        f"[bold green]Total:[/bold green] {result.grand_total} {result.currency} | [bold]Base:[/bold] {result.subtotal} {result.currency} | [bold]IVA:[/bold] {result.tax_total} {result.currency}\n"
        f"[bold]Partida Doble:[/bold] {'[green]BALANCEADA[/green]' if result.is_balanced else '[red]DESCUADRADA[/red]'}",
        title="Resultado del Análisis"
    ))

    # Tabla de partidas
    table = Table(title="Partidas Descompuestas")
    table.add_column("#", style="dim", width=4)
    table.add_column("Concepto", style="white")
    table.add_column("Cant.", justify="right")
    table.add_column("Precio", justify="right")
    table.add_column("Base", justify="right")
    table.add_column("IVA", justify="right")
    table.add_column("Cuenta PGC", style="yellow")

    for it in result.items:
        table.add_row(
            str(it.item_index),
            it.concept[:35],
            str(it.quantity),
            f"{it.unit_price}€",
            f"{it.base_amount}€",
            f"{it.tax_rate}%",
            f"{it.account_code} ({it.account_name[:15]})"
        )
    console.print(table)

    # Asiento contable si existe
    if result.journal_entry:
        je = result.journal_entry
        je_table = Table(title=f"Asiento Contable PGC ({'Cuadrado' if je.is_balanced else 'Descuadrado'})")
        je_table.add_column("Cuenta", style="yellow")
        je_table.add_column("Nombre de Subcuenta", style="white")
        je_table.add_column("Debe (€)", style="green", justify="right")
        je_table.add_column("Haber (€)", style="red", justify="right")
        for line in je.lines:
            je_table.add_row(line.account_code, line.account_name[:35], f"{line.debit:.2f}" if line.debit > 0 else "-", f"{line.credit:.2f}" if line.credit > 0 else "-")
        console.print(je_table)


@app.command()
def batch(
    directory: str = typer.Argument(..., help="Directorio con documentos a analizar en lote"),
    use_llm: bool = typer.Option(False, "--use-llm", help="Activar llamada a LLM remoto"),
    output: Optional[str] = typer.Option(None, "--output", "-o", help="Guardar resultado consolidado en archivo JSON")
):
    """
    Procesa un lote masivo de documentos utilizando DuckDB y Polars.
    """
    path = Path(directory).resolve()
    if not path.exists():
        console.print(f"[red]Error:[/red] El directorio {path} no existe.")
        raise typer.Exit(1)

    files = sorted([f for f in path.iterdir() if f.is_file()])
    if not files:
        console.print(f"[yellow]Aviso:[/yellow] No se encontraron archivos en {path}.")
        return

    console.print(Panel(f"Procesando {len(files)} documentos en lote...", title="Analista de Datos"))

    documents = []
    for f in files:
        text = f.read_text(encoding="utf-8", errors="ignore")
        documents.append((text, f.name))

    async def run():
        return await engine.process_high_volume_batch(documents, use_llm=use_llm)

    result = asyncio.run(run())

    # Mostrar tabla resumen
    table = Table(title="Resumen Forense de Lote (DuckDB + Polars)")
    table.add_column("Métrica", style="cyan")
    table.add_column("Valor Computado", style="green")

    table.add_row("Documentos Procesados", str(result.processed_count))
    table.add_row("Volumen Total", f"{result.total_volume_amount:,.2f} €")
    table.add_row("Cuota IVA Total", f"{result.total_tax_amount:,.2f} €")
    table.add_row("Retenciones IRPF", f"{result.total_retention_amount:,.2f} €")
    table.add_row("Paridad Balanceada", f"{result.balanced_percentage} %")
    table.add_row("Tiempo Motor Columnar", f"{result.processing_time_ms:.2f} ms")
    console.print(table)

    if output:
        out_p = Path(output).resolve()
        out_p.write_text(result.model_dump_json(indent=2), encoding="utf-8")
        console.print(f"[bold green][OK] Reporte guardado en:[/bold green] {out_p}")


@app.command()
def validate_tax_id(tax_id: str = typer.Argument(..., help="DNI, NIE, CIF o VIES a validar")):
    """
    Valida matemáticamente el dígito de control de un identificador fiscal español o europeo.
    """
    res = FiscalTaxIdValidator.validate_tax_id(tax_id)
    if res.is_valid:
        console.print(f"[bold green][VALIDO][/bold green] {res.diagnostic_message} (Entidad: {res.entity_type})")
    else:
        console.print(f"[bold red][INVALIDO][/bold red] {res.diagnostic_message}")


@app.command()
def serve(
    host: str = typer.Option("127.0.0.1", "--host", "-h", help="Host de escucha"),
    port: int = typer.Option(8100, "--port", "-p", help="Puerto HTTP"),
    reload: bool = typer.Option(False, "--reload", help="Recargar automáticamente en cambios")
):
    """
    Inicia el servidor de API REST con FastAPI y endpoints OpenAPI.
    """
    import uvicorn
    console.print(f"[bold green]Iniciando Analista de Datos API en http://{host}:{port}[/bold green]")
    console.print(f"Documentación Swagger UI disponible en: [cyan]http://{host}:{port}/docs[/cyan]")
    uvicorn.run("app.main:app", host=host, port=port, reload=reload)


@app.command()
def generate_dataset(
    count: int = typer.Option(50, "--count", "-c", help="Número de muestras a generar"),
    output: str = typer.Option("data/training_dataset.jsonl", "--output", "-o", help="Ruta de salida JSONL")
):
    """
    Genera dataset sintético en formato ChatML con trazas de pensamiento <think> para fine-tuning.
    """
    console.print(f"Generando {count} muestras de entrenamiento...")
    file_path = DatasetGenerator.export_dataset(count=count, output_file=output)
    console.print(f"[bold green][OK] Dataset generado con éxito:[/bold green] {file_path}")


if __name__ == "__main__":
    app()
