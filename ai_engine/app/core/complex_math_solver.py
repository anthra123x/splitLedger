import math
from typing import Dict, Any, List, Optional, Tuple
from pydantic import BaseModel, Field


class MathAuditDiagnosis(BaseModel):
    is_solvable: bool
    problem_type: str  # 'COMPATIBLE_DETERMINADO', 'INCOMPATIBLE_CONTRADICTORIO', 'INDETERMINADO_SINGULAR', 'PARADOJA_CIRCULAR_NO_LINEAL'
    condition_number: float = 1.0
    degrees_of_freedom: int = 0
    residual_error_norm: float = 0.0
    forensic_explanation: str
    optimal_pseudo_solution: Optional[Dict[str, float]] = None
    unresolvable_equations: List[str] = Field(default_factory=list)


class ComplexMathForensicSolver:
    """
    Motor de resolución algebraica y topológica para problemas matemáticos financieros complejos.
    Detecta problemas sin solución exacta (Sistemas Incompatibles de Rouché-Frobenius),
    singularidades matriciales y paradojas de descuento circular.
    """

    @classmethod
    def analyze_linear_system_parity(
        cls,
        subtotal: float,
        tax_total: float,
        retention_total: float,
        grand_total: float,
        line_items: List[Dict[str, Any]],
        surcharge_total: float = 0.0
    ) -> MathAuditDiagnosis:
        """
        Plantea el sistema matricial de partida doble y verifica solubilidad matemática exacta.
        Restricciones:
          (1) sum(base_i) == subtotal
          (2) sum(base_i * rate_i) == tax_total
          (3) subtotal + tax_total + surcharge_total - retention_total == grand_total
        """
        items_base_sum = round(sum(float(it.get("base_amount", 0.0)) for it in line_items), 2)
        items_tax_sum = round(sum(float(it.get("tax_amount", 0.0)) for it in line_items), 2)
        
        eq1_diff = round(items_base_sum - subtotal, 2)
        eq2_diff = round(items_tax_sum - tax_total, 2)
        eq3_expected = round(subtotal + tax_total + surcharge_total - retention_total, 2)
        eq3_diff = round(eq3_expected - grand_total, 2)

        total_residual = round(math.sqrt(eq1_diff**2 + eq2_diff**2 + eq3_diff**2), 4)

        # Caso 1: Sistema Compatible Determinado (Soluble exactamente)
        if total_residual <= 0.05:
            return MathAuditDiagnosis(
                is_solvable=True,
                problem_type="COMPATIBLE_DETERMINADO",
                condition_number=1.0,
                degrees_of_freedom=0,
                residual_error_norm=total_residual,
                forensic_explanation="El sistema algebraico de partida doble y sumatorio de partidas intersecta exactamente en una solución única sin contradicciones.",
                optimal_pseudo_solution={
                    "subtotal": subtotal,
                    "tax_total": tax_total,
                    "surcharge_total": surcharge_total,
                    "retention_total": retention_total,
                    "grand_total": grand_total
                }
            )

        # Caso 2: Sistema Incompatible Sobredeterminado (SIN SOLUCIÓN EXACTA)
        unresolvable = []
        if abs(eq1_diff) > 0.05:
            unresolvable.append(f"Restricción 1: Suma de bases ({items_base_sum}) != Subtotal declarado ({subtotal}). Residual={eq1_diff}")
        if abs(eq2_diff) > 0.05:
            unresolvable.append(f"Restricción 2: Suma de cuotas de IVA ({items_tax_sum}) != IVA total declarado ({tax_total}). Residual={eq2_diff}")
        if abs(eq3_diff) > 0.05:
            unresolvable.append(f"Restricción 3: Ecuación partida doble {subtotal} + {tax_total} + {surcharge_total} - {retention_total} = {eq3_expected} != Total ({grand_total}). Residual={eq3_diff}")

        # Solución de mínimos cuadrados (Proyección ortogonal al espacio columna)
        pseudo_subtotal = round((items_base_sum + subtotal) / 2.0, 2)
        pseudo_tax = round((items_tax_sum + tax_total) / 2.0, 2)
        pseudo_total = round(pseudo_subtotal + pseudo_tax + surcharge_total - retention_total, 2)

        return MathAuditDiagnosis(
            is_solvable=False,
            problem_type="INCOMPATIBLE_CONTRADICTORIO",
            condition_number=float("inf"),
            degrees_of_freedom=0,
            residual_error_norm=total_residual,
            forensic_explanation=(
                f"SISTEMA MATEMÁTICO SIN SOLUCIÓN (Teorema de Rouché-Frobenius: rango(A) != rango(A|b)). "
                f"Las restricciones numéricas son contradictorias e irreconciliables de forma simultánea. "
                f"Norma del vector residual L2 = {total_residual}."
            ),
            optimal_pseudo_solution={
                "pseudo_subtotal_l2": pseudo_subtotal,
                "pseudo_tax_l2": pseudo_tax,
                "pseudo_grand_total_l2": pseudo_total
            },
            unresolvable_equations=unresolvable
        )

    @classmethod
    def solve_singular_bundle_matrix(
        cls,
        matrix_A: List[List[float]],
        vector_b: List[float]
    ) -> MathAuditDiagnosis:
        """
        Evalúa un sistema lineal Ax = b para desagregación de precios en bundles.
        Detecta matrices singulares (rango deficiente) con infinitas soluciones o sin solución.
        """
        n = len(matrix_A)
        m = len(matrix_A[0]) if n > 0 else 0

        # Cálculo de determinante para matrices cuadradas 2x2 o 3x3
        det = 0.0
        if n == 2 and m == 2:
            det = matrix_A[0][0] * matrix_A[1][1] - matrix_A[0][1] * matrix_A[1][0]
        elif n == 3 and m == 3:
            det = (
                matrix_A[0][0] * (matrix_A[1][1] * matrix_A[2][2] - matrix_A[1][2] * matrix_A[2][1])
                - matrix_A[0][1] * (matrix_A[1][0] * matrix_A[2][2] - matrix_A[1][2] * matrix_A[2][0])
                + matrix_A[0][2] * (matrix_A[1][0] * matrix_A[2][1] - matrix_A[1][1] * matrix_A[2][0])
            )

        if abs(det) < 1e-7:
            # Matriz singular: Columnas linealmente dependientes
            return MathAuditDiagnosis(
                is_solvable=False,
                problem_type="INDETERMINADO_SINGULAR",
                condition_number=float("inf"),
                degrees_of_freedom=max(1, m - 1),
                residual_error_norm=0.0,
                forensic_explanation=(
                    "SISTEMA MATEMÁTICAMENTE INDETERMINADO: Matriz de coeficientes singular (det(A) = 0). "
                    "Las ecuaciones son linealmente dependientes; existe un espacio nulo no trivial (Ker(A) != {0}). "
                    "Es matemáticamente imposible aislar los precios unitarios de forma unívoca (infinitas soluciones paramétricas)."
                ),
                unresolvable_equations=[
                    "Det(A) = 0.0 (Singularidad absoluta)",
                    "Dependencia lineal detectada entre partidas de catálogo empaquetado (Bundle)"
                ]
            )

        return MathAuditDiagnosis(
            is_solvable=True,
            problem_type="COMPATIBLE_DETERMINADO",
            condition_number=round(1.0 / (abs(det) + 1e-5), 2),
            degrees_of_freedom=0,
            residual_error_norm=0.0,
            forensic_explanation="El sistema de ecuaciones es regular y de rango completo.",
            unresolvable_equations=[]
        )

    @classmethod
    def evaluate_circular_rebate_paradox(
        cls,
        subtotal: float,
        rebate_ratio: float,
        fixed_offset: float
    ) -> MathAuditDiagnosis:
        """
        Evalúa paradojas de punto fijo en descuentos circulares no lineales:
        Ecuación: Total = Subtotal - Rebate
        donde Rebate = rebate_ratio * Total + fixed_offset
        => Total = Subtotal - (rebate_ratio * Total + fixed_offset)
        => Total * (1 + rebate_ratio) = Subtotal - fixed_offset
        Si rebate_ratio == -1.0 o si produce contradicciones geométricas.
        """
        denominator = 1.0 + rebate_ratio
        if abs(denominator) < 1e-6:
            return MathAuditDiagnosis(
                is_solvable=False,
                problem_type="PARADOJA_CIRCULAR_NO_LINEAL",
                condition_number=float("inf"),
                degrees_of_freedom=0,
                residual_error_norm=abs(subtotal - fixed_offset),
                forensic_explanation=(
                    "PARADOJA MATEMÁTICA SIN PUNTO FIJO: El operador de descuento circular tiene autovalor lambda = 1.0. "
                    "La ecuación T = T - C produce la contradicción aritmética 0 = C. "
                    "No existe ningún punto fijo en los números reales que resuelva el balance financiero."
                ),
                unresolvable_equations=[
                    "T = Subtotal - (Rebate)",
                    "Rebate = -T + offset  => T = Subtotal + T - offset => 0 = Subtotal - offset (Contradicción)"
                ]
            )

        total_sol = round((subtotal - fixed_offset) / denominator, 2)
        return MathAuditDiagnosis(
            is_solvable=True,
            problem_type="COMPATIBLE_DETERMINADO",
            condition_number=1.0,
            degrees_of_freedom=0,
            residual_error_norm=0.0,
            forensic_explanation="La relación de punto fijo converge a una solución determinista.",
            optimal_pseudo_solution={"total": total_sol, "rebate": round(subtotal - total_sol, 2)}
        )
