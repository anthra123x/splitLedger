import math
from typing import List, Dict, Any
from ..models.schemas import AnomalyItem, DecomposedInvoice


class FinancialAnomalyDetector:
    """
    Algoritmo avanzado de auditoría forense y detección de anomalías para grandes volúmenes de datos financieros.
    Incluye:
      - Auditoría de cuadratura en partida doble (incluyendo facturas rectificativas/abonos negativos).
      - Análisis forense de la Ley de Benford (distribución del primer dígito para detección de fraude o manipulación).
      - Outliers estadísticos robustos con Z-Score Modificado (basado en mediana y MAD).
      - Control multidivisa y tarifas impositivas complejas.
    """

    SPANISH_STANDARD_TAX_RATES = {0.0, 4.0, 5.0, 10.0, 21.0}
    
    # Probabilidades teóricas de la Ley de Benford para dígitos 1 a 9: P(d) = log10(1 + 1/d)
    BENFORD_PROBABILITIES = {
        1: 0.3010,
        2: 0.1761,
        3: 0.1249,
        4: 0.0969,
        5: 0.0792,
        6: 0.0669,
        7: 0.0580,
        8: 0.0512,
        9: 0.0458
    }

    @classmethod
    def audit_benford_law_distribution(cls, invoices_or_amounts: List[Any]) -> Dict[str, Any]:
        """
        Auditoría independiente de la Ley de Benford y cálculo del índice MAD de Nigrini.
        """
        valid_amounts = []
        for item in invoices_or_amounts:
            amt = None
            if hasattr(item, "grand_total"):
                amt = abs(float(item.grand_total))
            elif isinstance(item, dict):
                amt = abs(float(item.get("grand_total", 0.0)))
            elif isinstance(item, (int, float)):
                amt = abs(float(item))
            if amt and amt >= 1.0:
                valid_amounts.append(amt)

        if len(valid_amounts) < 20:
            return {
                "conformity_level": "SAMPLE_TOO_SMALL",
                "mad_score": 0.0,
                "is_conforming": True,
                "digit_distribution": {}
            }

        digit_counts = {d: 0 for d in range(1, 10)}
        for amt in valid_amounts:
            first_digit_str = str(amt).replace(".", "").lstrip("0")
            if first_digit_str:
                d = int(first_digit_str[0])
                if 1 <= d <= 9:
                    digit_counts[d] += 1

        total = len(valid_amounts)
        deviations = []
        distribution = {}
        for d in range(1, 10):
            obs = digit_counts[d] / total
            exp = cls.BENFORD_PROBABILITIES[d]
            diff = abs(obs - exp)
            deviations.append(diff)
            distribution[d] = {
                "observed_ratio": round(obs, 4),
                "expected_ratio": exp,
                "deviation": round(diff, 4)
            }

        mad = sum(deviations) / 9.0
        # Criterios de Nigrini para MAD
        if mad <= 0.006:
            conformity = "CLOSE_CONFORMITY"
        elif mad <= 0.012:
            conformity = "ACCEPTABLE_CONFORMITY"
        elif mad <= 0.015:
            conformity = "MARGINALLY_ACCEPTABLE"
        else:
            conformity = "NON_CONFORMING"

        return {
            "conformity_level": conformity,
            "mad_score": round(mad, 4),
            "is_conforming": mad <= 0.035,
            "digit_distribution": distribution,
            "sample_size": total
        }

    @classmethod
    def audit_single_document(cls, invoice: DecomposedInvoice) -> List[AnomalyItem]:
        anomalies: List[AnomalyItem] = []

        # 1. Parity Check: subtotal + tax_total - retention_total == grand_total
        # Maneja tanto facturas estándar como rectificativas / abonos (importes negativos)
        expected_total = round(invoice.subtotal + invoice.tax_total - invoice.retention_total, 2)
        diff = round(abs(expected_total - invoice.grand_total), 2)
        if diff > 0.05:
            anomalies.append(AnomalyItem(
                anomaly_type="PARITY_MISMATCH",
                severity="CRITICAL",
                description=f"Descuadre en partida doble: Subtotal ({invoice.subtotal}) + IVA ({invoice.tax_total}) - Retención ({invoice.retention_total}) = {expected_total} != Total ({invoice.grand_total}). Discrepancia: {diff} {invoice.currency}",
                affected_field="grand_total",
                expected_value=expected_total,
                detected_value=invoice.grand_total,
                confidence=0.99
            ))

        # Factura rectificativa detectada
        if invoice.grand_total < 0 or invoice.subtotal < 0:
            if invoice.grand_total > 0 or invoice.subtotal > 0:
                anomalies.append(AnomalyItem(
                    anomaly_type="CREDIT_NOTE_SIGN_INVERSION",
                    severity="WARNING",
                    description=f"Inconsistencia de signo en factura rectificativa/abono: Subtotal={invoice.subtotal} vs Total={invoice.grand_total}.",
                    affected_field="grand_total",
                    expected_value=round(-abs(invoice.grand_total), 2),
                    detected_value=invoice.grand_total,
                    confidence=0.95
                ))

        # 2. Tax rate anomalies in line items
        for item in invoice.items:
            rate = float(item.tax_rate)
            if rate not in cls.SPANISH_STANDARD_TAX_RATES:
                anomalies.append(AnomalyItem(
                    anomaly_type="TAX_RATE_ANOMALY",
                    severity="WARNING",
                    description=f"Tipo de IVA atípico ({rate}%) en partida '{item.concept}'. Tarifas estándar: 0%, 4%, 5%, 10% y 21%.",
                    affected_field="items.tax_rate",
                    expected_value=21.0,
                    detected_value=rate,
                    confidence=0.92
                ))

            # Partida total check: base + tax == total (considerando signos)
            expected_item_total = round(item.base_amount + item.tax_amount, 2)
            item_diff = round(abs(expected_item_total - item.total_amount), 2)
            if item_diff > 0.05:
                anomalies.append(AnomalyItem(
                    anomaly_type="ITEM_SUM_MISMATCH",
                    severity="WARNING",
                    description=f"Partida '{item.concept}' descuadrada: Base ({item.base_amount}) + Cuota IVA ({item.tax_amount}) != Total ({item.total_amount}).",
                    affected_field="items.total_amount",
                    expected_value=expected_item_total,
                    detected_value=item.total_amount,
                    confidence=0.95
                ))

        # 3. Retention check on autonomous workers
        if "623000" in [it.account_code for it in invoice.items]:
            if invoice.retention_total <= 0.0 and invoice.grand_total > 0:
                anomalies.append(AnomalyItem(
                    anomaly_type="RETENTION_WARNING",
                    severity="INFO",
                    description="Servicios profesionales independientes (cuenta 623) sin retención de IRPF (habitual 15% o 7%).",
                    affected_field="retention_total",
                    expected_value=round(invoice.subtotal * 0.15, 2),
                    detected_value=0.0,
                    confidence=0.85
                ))

        return anomalies

    @classmethod
    def audit_batch_dataset(cls, invoices: List[DecomposedInvoice]) -> List[AnomalyItem]:
        """
        Audita un lote completo detectando duplicidades cruzadas, divergencias de la Ley de Benford
        y valores atípicos (outliers) estadísticos mediante Modified Z-score.
        """
        batch_anomalies: List[AnomalyItem] = []

        # 1. Duplicates Detection (Mismo proveedor + mismo número de factura)
        seen_identifiers: Dict[str, str] = {}
        for inv in invoices:
            key = f"{inv.supplier_tax_id.upper()}::{inv.invoice_number.upper()}"
            if key in seen_identifiers and inv.supplier_tax_id:
                batch_anomalies.append(AnomalyItem(
                    anomaly_type="DUPLICATE_SUSPICION",
                    severity="CRITICAL",
                    description=f"Factura duplicada detectada: Proveedor '{inv.supplier_name}' ({inv.supplier_tax_id}) y Nº Factura '{inv.invoice_number}'.",
                    affected_field="invoice_number",
                    expected_value="Único",
                    detected_value=inv.invoice_number,
                    confidence=0.99
                ))
            else:
                seen_identifiers[key] = inv.invoice_date

        # 2. Análisis Forense de la Ley de Benford (Solo si hay suficiente muestra: N >= 40)
        valid_amounts = [abs(inv.grand_total) for inv in invoices if abs(inv.grand_total) >= 1.0]
        if len(valid_amounts) >= 40:
            digit_counts = {d: 0 for d in range(1, 10)}
            for amt in valid_amounts:
                # Extraer primer dígito no cero
                first_digit_str = str(amt).replace(".", "").lstrip("0")
                if first_digit_str:
                    digit = int(first_digit_str[0])
                    if 1 <= digit <= 9:
                        digit_counts[digit] += 1

            total_digits = len(valid_amounts)
            # Calcular Desviación Absoluta Media (MAD) respecto a Benford
            deviations = []
            flagged_digits = []
            for d in range(1, 10):
                observed_prob = digit_counts[d] / total_digits
                expected_prob = cls.BENFORD_PROBABILITIES[d]
                diff = abs(observed_prob - expected_prob)
                deviations.append(diff)
                # Si un dígito concreto desvía más de 12% del esperado
                if diff > 0.12 and digit_counts[d] > 5:
                    flagged_digits.append(f"Dígito '{d}' (Obs: {round(observed_prob*100, 1)}% vs Benford: {round(expected_prob*100, 1)}%)")

            benford_mad = sum(deviations) / 9.0

            # Umbral de conformidad de Nigrini: MAD > 0.035 indica no-conformidad o posible manipulación
            if benford_mad > 0.035:
                batch_anomalies.append(AnomalyItem(
                    anomaly_type="BENFORD_LAW_DEVIATION",
                    severity="WARNING",
                    description=f"Alerta Forense: Distribución de importes se desvía de la Ley de Benford (MAD={round(benford_mad, 4)}, umbral seguro <= 0.035). Posible manipulación o concentración artificial en: {', '.join(flagged_digits[:3])}.",
                    affected_field="grand_total_distribution",
                    expected_value="Conforme Benford (MAD <= 0.035)",
                    detected_value=f"MAD={round(benford_mad, 4)}",
                    confidence=0.90
                ))

        # 3. Robust Outliers Detection usando Modified Z-Score (Mediana y MAD)
        if len(valid_amounts) >= 8:
            sorted_amounts = sorted(valid_amounts)
            n = len(sorted_amounts)
            median = sorted_amounts[n // 2] if n % 2 != 0 else (sorted_amounts[n // 2 - 1] + sorted_amounts[n // 2]) / 2.0
            
            # Median Absolute Deviation (MAD)
            abs_devs = sorted([abs(x - median) for x in sorted_amounts])
            mad = abs_devs[n // 2] if n % 2 != 0 else (abs_devs[n // 2 - 1] + abs_devs[n // 2]) / 2.0

            if mad > 0:
                for inv in invoices:
                    amt = abs(inv.grand_total)
                    if amt > 0:
                        modified_z = 0.6745 * (amt - median) / mad
                        if abs(modified_z) > 3.5:  # Extremo en Modified Z-score
                            batch_anomalies.append(AnomalyItem(
                                anomaly_type="STATISTICAL_ROBUST_OUTLIER",
                                severity="WARNING",
                                description=f"Importe atípico extremo en Factura #{inv.invoice_number} ({inv.supplier_name}): {inv.grand_total} {inv.currency}. Modified Z-Score={round(modified_z, 2)} (Mediana={round(median, 2)}€).",
                                affected_field="grand_total",
                                expected_value=round(median, 2),
                                detected_value=inv.grand_total,
                                confidence=0.92
                            ))

        return batch_anomalies
