import os
import json
import random
from pathlib import Path
from typing import List, Dict, Any
from ..core.reasoner import SYSTEM_REASONING_PROMPT
from ..models.schemas import TrainingDatasetEntry
from ..models.accounting import PGC_ACCOUNT_CATALOG


class DatasetGenerator:
    """
    Generador de datasets de entrenamiento para fine-tuning del modelo de razonamiento y descomposición.
    Produce ejemplos en formato ChatML con traza de pensamiento explícita (<think>...</think>).
    """

    SAMPLE_SUPPLIERS = [
        {"name": "Amazon Web Services EMEA SARL", "tax_id": "LU26375245", "type": "SaaS / Cloud", "account": "629000", "tax_rate": 0.0},
        {"name": "Telefónica de España S.A.U.", "tax_id": "A28015865", "type": "Telecom", "account": "629000", "tax_rate": 21.0},
        {"name": "Iberdrola Clientes S.A.U.", "tax_id": "A95748356", "type": "Electricidad", "account": "628000", "tax_rate": 21.0},
        {"name": "Asesoría Jurídica y Fiscal Gómez S.L.", "tax_id": "B84112233", "type": "Servicios Profesionales", "account": "623000", "tax_rate": 21.0, "retention": 15.0},
        {"name": "Distribuciones Alimentarias y Logística S.A.", "tax_id": "A28994455", "type": "Alimentación / Multitasa", "account": "600000", "tax_rate": 10.0, "multi_tax": True},
        {"name": "Dell Technologies Global B.V.", "tax_id": "NL80332211", "type": "Equipos / Hardware USD", "account": "600000", "tax_rate": 21.0, "currency": "USD"},
        {"name": "Consultoría Estratégica & Auditoría Forensic S.L.", "tax_id": "B88334411", "type": "Auditoría / IRPF", "account": "623000", "tax_rate": 21.0, "retention": 15.0},
        {"name": "Comercio Mayorista con Recargo S.L.", "tax_id": "B81234567", "type": "Minorista Recargo Equivalencia", "account": "600000", "tax_rate": 21.0, "surcharge": 5.2}
    ]

    @classmethod
    def generate_synthetic_sample(cls, sample_id: int) -> TrainingDatasetEntry:
        supplier = random.choice(cls.SAMPLE_SUPPLIERS)
        inv_number = f"FAC-{2026}-{random.randint(1000, 9999)}"
        inv_date = f"2026-{random.randint(1, 10):02d}-{random.randint(1, 28):02d}"
        currency = supplier.get("currency", "EUR")

        # Determinar arquetipo
        is_multi_tax = supplier.get("multi_tax", False)
        is_contradictory = (sample_id % 7 == 0)  # Cada 7 muestras se inyecta contradicción matemática

        items = []
        subtotal = 0.0
        num_items = random.randint(2, 4)

        tax_rates_pool = [4.0, 10.0, 21.0] if is_multi_tax else [supplier["tax_rate"]]

        for i in range(num_items):
            qty = random.randint(1, 6)
            unit_price = round(random.uniform(30.0, 650.0), 2)
            base = round(qty * unit_price, 2)
            subtotal += base
            tax_rate = random.choice(tax_rates_pool)
            tax_amount = round(base * (tax_rate / 100.0), 2)
            total = round(base + tax_amount, 2)

            acc_info = PGC_ACCOUNT_CATALOG.get(supplier["account"], {"name": "Otros servicios", "cost_center": "GENERAL"})

            items.append({
                "concept": f"Partida {supplier['type']} #{i+1} ref-{random.randint(100, 999)}",
                "quantity": float(qty),
                "unit_price": unit_price,
                "base_amount": base,
                "tax_rate": tax_rate,
                "tax_amount": tax_amount,
                "total_amount": total,
                "account_code": supplier["account"],
                "account_name": acc_info["name"],
                "cost_center": acc_info["cost_center"]
            })

        subtotal = round(subtotal, 2)

        # Consolidación multitasa
        tax_map = {}
        for it in items:
            r = it["tax_rate"]
            if r not in tax_map:
                tax_map[r] = {"base": 0.0, "tax": 0.0}
            tax_map[r]["base"] += it["base_amount"]
            tax_map[r]["tax"] += it["tax_amount"]

        surcharge_rate = supplier.get("surcharge", 0.0)
        tax_breakdown = []
        tax_total = 0.0
        for r, vals in sorted(tax_map.items()):
            b_amt = round(vals["base"], 2)
            t_amt = round(vals["tax"], 2)
            s_amt = round(b_amt * (surcharge_rate / 100.0), 2) if surcharge_rate > 0 else 0.0
            tax_breakdown.append({
                "tax_rate": r,
                "base_amount": b_amt,
                "tax_amount": t_amt,
                "surcharge_rate": surcharge_rate,
                "surcharge_amount": s_amt
            })
            tax_total += round(t_amt + s_amt, 2)

        retention_rate = supplier.get("retention", 0.0)
        retention_total = round(subtotal * (retention_rate / 100.0), 2) if retention_rate > 0 else 0.0

        expected_grand_total = round(subtotal + tax_total - retention_total, 2)
        if is_contradictory:
            # Inyección de inconsistencia deliberada para forzar razonamiento Rouché-Frobenius
            declared_grand_total = round(expected_grand_total + random.choice([25.0, -18.5, 42.10]), 2)
        else:
            declared_grand_total = expected_grand_total

        # Generación del texto crudo simulado
        raw_text = (
            f"====================================================\n"
            f"PROVEEDOR: {supplier['name']}\n"
            f"NIF/CIF: {supplier['tax_id']} | PAÍS: {'NL' if 'NL' in supplier['tax_id'] else ('LU' if 'LU' in supplier['tax_id'] else 'ES')}\n"
            f"FACTURA: {inv_number} | FECHA: {inv_date}\n"
            f"CLIENTE: SplitLedger Enterprise Labs S.L. (ESB87219034)\n"
            f"DIVISA: {currency}\n"
            f"====================================================\n"
        )
        for it in items:
            raw_text += f"{it['concept']} | Cant: {it['quantity']} x {it['unit_price']} {currency} = {it['base_amount']} {currency} (IVA {it['tax_rate']}%)\n"

        raw_text += "----------------------------------------------------\n"
        for tb in tax_breakdown:
            raw_text += f"Desglose IVA {tb['tax_rate']}%: Base={tb['base_amount']} {currency} -> Cuota={tb['tax_amount']} {currency}\n"
            if tb["surcharge_amount"] > 0:
                raw_text += f"Recargo Equivalencia ({tb['surcharge_rate']}%): {tb['surcharge_amount']} {currency}\n"

        raw_text += (
            f"Base Imponible Total: {subtotal} {currency}\n"
            f"Total Impuestos: {round(tax_total, 2)} {currency}\n"
        )
        if retention_total > 0:
            raw_text += f"Retención IRPF ({retention_rate}%): -{retention_total} {currency}\n"
        raw_text += f"TOTAL FACTURA: {declared_grand_total} {currency}\n"

        # Traza de razonamiento CoT
        thinking_parts = [
            f"1. [Identificación de Entidades]: Emisor '{supplier['name']}' ({supplier['tax_id']}), Cliente 'SplitLedger Enterprise Labs S.L.' (ESB87219034). Factura {inv_number} fechada {inv_date} en divisa {currency}.",
            f"2. [Segmentación Multitasa]: {len(items)} líneas auditadas con {len(tax_breakdown)} tramos impositivos ({', '.join(str(tb['tax_rate']) + '%' for tb in tax_breakdown)}). Cuenta PGC asignada: {supplier['account']} ({PGC_ACCOUNT_CATALOG[supplier['account']]['name']}).",
            f"3. [Auditoría Fiscal y Retenciones]: Base imponible consolidada={subtotal} {currency}, Cuota fiscal={round(tax_total, 2)} {currency}. Retención IRPF={retention_total} {currency}."
        ]
        if is_contradictory:
            diff = round(declared_grand_total - expected_grand_total, 2)
            thinking_parts.append(
                f"4. [Auditoría Forense - Rouché-Frobenius]: ALERTA DE INCONSISTENCIA MATEMÁTICA. "
                f"Total calculado ({expected_grand_total} {currency}) difiere del declarado ({declared_grand_total} {currency}) por {diff} {currency}. "
                f"El sistema lineal no posee solución exacta en R. Se activa proyección ortogonal vía pseudoinversa de Moore-Penrose (mínimos cuadrados L2)."
            )
        else:
            thinking_parts.append(
                f"4. [Ecuación de Paridad Contable]: Base ({subtotal}) + Impuestos ({round(tax_total, 2)}) - Retención ({retention_total}) = {expected_grand_total} {currency}. "
                f"Partida doble perfectamente balanceada."
            )

        thinking_trace = "\n".join(thinking_parts)

        final_output = {
            "invoice_number": inv_number,
            "supplier_name": supplier["name"],
            "supplier_tax_id": supplier["tax_id"],
            "supplier_address": "Sede Operativa del Proveedor",
            "customer_name": "SplitLedger Enterprise Labs S.L.",
            "customer_tax_id": "ESB87219034",
            "customer_address": "Calle Velázquez 45, Madrid",
            "invoice_date": inv_date,
            "due_date": inv_date,
            "currency": currency,
            "subtotal": subtotal,
            "tax_total": round(tax_total, 2),
            "retention_total": retention_total,
            "grand_total": declared_grand_total,
            "tax_breakdown": tax_breakdown,
            "items": items
        }

        return TrainingDatasetEntry(
            id=f"SYNTH-{sample_id:05d}",
            system_prompt=SYSTEM_REASONING_PROMPT,
            user_prompt=f"Descompone y audita el siguiente documento contable:\n\n{raw_text}",
            thinking_trace=thinking_trace,
            final_output=final_output,
            domain_tags=["accounting", "spanish_pgc", "multi_tax" if is_multi_tax else "single_tax", "inconsistent" if is_contradictory else "balanced"]
        )

    @classmethod
    def export_dataset(
        cls,
        count: int = 100,
        output_file: str = "ai_engine/data/training_dataset.jsonl"
    ) -> str:
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        entries = [cls.generate_synthetic_sample(i + 1) for i in range(count)]

        with open(output_file, "w", encoding="utf-8") as f:
            for entry in entries:
                # Formato ChatML con <think>...</think>
                chatml_format = {
                    "id": entry.id,
                    "conversations": [
                        {"role": "system", "content": entry.system_prompt},
                        {"role": "user", "content": entry.user_prompt},
                        {
                            "role": "assistant",
                            "content": f"<think>\n{entry.thinking_trace}\n</think>\n{json.dumps(entry.final_output, ensure_ascii=False)}"
                        }
                    ]
                }
                f.write(json.dumps(chatml_format, ensure_ascii=False) + "\n")

        return os.path.abspath(output_file)
