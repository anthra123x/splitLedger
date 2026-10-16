"""
Suite de Evaluación Forense para Problemas Matemáticos Complejos,
Sistemas Incompatibles sin Solución, Singularidades Matriciales y Paradojas Circulares.
"""

import sys
from pathlib import Path
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

# Asegurar path de importación
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.complex_math_solver import ComplexMathForensicSolver
from app.core.reasoner import SplitReasoner
from app.core.job_manager import AsyncJobManager
import asyncio

console = Console()


def test_overconstrained_unsolvable_system():
    console.print("\n[bold yellow][TEST] PRUEBA 1: SISTEMA SOBREDETERMINADO INCOMPATIBLE (CONTRADICCIÓN IRRESOLUBLE)[/bold yellow]")
    
    # Restricciones numéricas imposibles de cumplir simultáneamente:
    # Partidas: 2 items de 500€ = 1000€
    # Declarado: Subtotal=800€, IVA=350€, Retención=100€, Total=1400€
    # (1) Sum(items) = 1000 != 800
    # (2) IVA 21% de 1000 = 210 != 350
    # (3) 800 + 350 - 100 = 1050 != 1400
    line_items = [
        {"base_amount": 500.0, "tax_amount": 105.0, "tax_rate": 21.0},
        {"base_amount": 500.0, "tax_amount": 105.0, "tax_rate": 21.0}
    ]
    diag = ComplexMathForensicSolver.analyze_linear_system_parity(
        subtotal=800.0,
        tax_total=350.0,
        retention_total=100.0,
        grand_total=1400.0,
        line_items=line_items
    )

    console.print(f" • Soluble exactamente: [bold red]{diag.is_solvable}[/bold red]")
    console.print(f" • Clasificación: [bold magenta]{diag.problem_type}[/bold magenta]")
    console.print(f" • Norma Residual L2: [cyan]{diag.residual_error_norm}[/cyan]")
    console.print(f" • Diagnóstico Forense: {diag.forensic_explanation}")
    console.print(f" • Solución Óptima de Mínimos Cuadrados (L2 Projection): [green]{diag.optimal_pseudo_solution}[/green]")
    for eq in diag.unresolvable_equations:
        console.print(f"   [FAIL] {eq}")
    
    assert not diag.is_solvable
    assert diag.problem_type == "INCOMPATIBLE_CONTRADICTORIO"
    assert diag.residual_error_norm > 0


def test_singular_matrix_indeterminacy():
    console.print("\n[bold yellow][TEST] PRUEBA 2: MATRIZ SINGULAR EN DESAGREGACIÓN DE BUNDLES (INFINITAS SOLUCIONES)[/bold yellow]")
    
    # Paquetes opacos con dependencia lineal exacta (det = 0):
    # Lote 1: 2 Licencias A + 4 Licencias B = 600€
    # Lote 2: 4 Licencias A + 8 Licencias B = 1200€
    # Matriz: [[2, 4], [4, 8]] -> Det = 2*8 - 4*4 = 0
    matrix_A = [
        [2.0, 4.0],
        [4.0, 8.0]
    ]
    vector_b = [600.0, 1200.0]

    diag = ComplexMathForensicSolver.solve_singular_bundle_matrix(matrix_A, vector_b)
    console.print(f" • Soluble de forma unívoca: [bold red]{diag.is_solvable}[/bold red]")
    console.print(f" • Clasificación: [bold magenta]{diag.problem_type}[/bold magenta]")
    console.print(f" • Grados de libertad paramétrica: [cyan]{diag.degrees_of_freedom}[/cyan]")
    console.print(f" • Diagnóstico: {diag.forensic_explanation}")

    assert not diag.is_solvable
    assert diag.problem_type == "INDETERMINADO_SINGULAR"
    assert diag.degrees_of_freedom > 0


def test_circular_rebate_paradox():
    console.print("\n[bold yellow][TEST] PRUEBA 3: PARADOJA DE DESCUENTO CIRCULAR SIN PUNTO FIJO[/bold yellow]")
    
    # T = Subtotal - Rebate
    # Rebate = -1.0 * T + 50 (autovalor 1.0 -> T = Subtotal + T - 50 => 0 = Subtotal - 50, imposible si Subtotal=100)
    diag = ComplexMathForensicSolver.evaluate_circular_rebate_paradox(
        subtotal=100.0,
        rebate_ratio=-1.0,
        fixed_offset=50.0
    )

    console.print(f" • Admite punto fijo: [bold red]{diag.is_solvable}[/bold red]")
    console.print(f" • Clasificación: [bold magenta]{diag.problem_type}[/bold magenta]")
    console.print(f" • Residual: [cyan]{diag.residual_error_norm}[/cyan]")
    console.print(f" • Diagnóstico: {diag.forensic_explanation}")

    assert not diag.is_solvable
    assert diag.problem_type == "PARADOJA_CIRCULAR_NO_LINEAL"


async def test_reasoner_with_contradictory_invoice():
    console.print("\n[bold yellow][TEST] PRUEBA 4: MOTOR DE RAZONAMIENTO ANTE TEXTO FORENSE CONTRADICTORIO[/bold yellow]")
    
    contradictory_text = (
        "FACTURA INCOMPATIBLE #CONTRADICCIÓN-01\n"
        "Emisor: Cloud Services S.L. (B87112233)\n"
        "Partida 1: Almacenamiento S3 | Base: 1000.00 EUR (IVA 21% = 210.00 EUR)\n"
        "Partida 2: Computación EC2 | Base: 500.00 EUR (IVA 21% = 105.00 EUR)\n"
        "Base Imponible Declarada: 900.00 EUR\n"
        "Cuota IVA Declarada: 450.00 EUR\n"
        "TOTAL FACTURA DECLARADO: 2200.00 EUR\n"
    )

    decomposed = await SplitReasoner.decompose_document(contradictory_text, "incompatible.txt", use_llm=False)
    
    console.print(f" • Cuadratura contable: [bold red]{decomposed.is_balanced}[/bold red]")
    console.print(f" • Discrepancia matemática: [red]{decomposed.mathematical_discrepancy} EUR[/red]")
    console.print(" • Trazas de Auditoría Forense:")
    for note in decomposed.audit_notes:
        console.print(f"   [yellow]•[/yellow] {note}")

    assert not decomposed.is_balanced
    assert any("INCOMPATIBLE" in n for n in decomposed.audit_notes)


def test_sqlite_persistence():
    console.print("\n[bold yellow][TEST] PRUEBA 5: PERSISTENCIA TRANSACCIONAL EN SQLITE (RECUPERACIÓN TRAS REINICIO)[/bold yellow]")
    
    jm = AsyncJobManager(db_path="ai_engine/data/test_jobs.sqlite")
    job_id = jm.submit_job([("Factura 1", "f1.txt"), ("Factura 2", "f2.txt")], use_llm=False)
    
    # Simular reinicio creando una nueva instancia limpia que lee de disco
    new_jm = AsyncJobManager(db_path="ai_engine/data/test_jobs.sqlite")
    recovered_job = new_jm.get_job(job_id)
    
    assert recovered_job is not None
    assert recovered_job.job_id == job_id
    console.print(f"[PASS] Trabajo [cyan]{job_id}[/cyan] recuperado exitosamente del disco SQLite con estado: [bold green]{recovered_job.status}[/bold green]")


def main():
    console.print(Panel(
        "[bold cyan]EVALUACIÓN MATEMÁTICA FORENSE Y RESOLUCIÓN DE PROBLEMAS SIN SOLUCIÓN[/bold cyan]\n"
        "• Sistemas Sobredeterminados e Incompatibles (Rouché-Frobenius)\n"
        "• Matrices Singulares y Bundles Indeterminados\n"
        "• Paradojas de Punto Fijo en Descuentos Circulares\n"
        "• Persistencia de Trabajos en SQLite",
        title="Split-Reasoner Math Engine"
    ))

    test_overconstrained_unsolvable_system()
    test_singular_matrix_indeterminacy()
    test_circular_rebate_paradox()
    asyncio.run(test_reasoner_with_contradictory_invoice())
    test_sqlite_persistence()

    console.print("\n[bold green][SUCCESS] TODAS LAS PRUEBAS MATEMÁTICAS Y DE PERSISTENCIA FUERON SUPERADAS CON ÉXITO.[/bold green]\n")


if __name__ == "__main__":
    main()
