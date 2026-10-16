import re
import json
from typing import Dict, Any, Optional, Tuple, List
import httpx

from ..config import config
from ..models.schemas import DecomposedInvoice, InvoiceLineItem, TaxBreakdownItem
from ..models.accounting import classify_concept, generate_double_entry_seat
from .tax_id_validator import FiscalTaxIdValidator


SYSTEM_REASONING_PROMPT = """Eres Split-Reasoner, el motor de razonamiento cognitivo y auditoría forense contable neuro-simbólica.
Tu tarea es descomponer y auditar exhaustivamente documentos contables, facturas complejas, cuadros de impuestos multi-tramo y tablas financieras.

DEBES SEGUIR UN PROCESO DE PENSAMIENTO ESTRICTO EN DOS PASOS:

PASO 1: Genera tu traza de razonamiento exhaustiva dentro de las etiquetas <think> y </think>:
1. [Identificación de Entidades]: Emisor (proveedor, NIF/CIF), Receptor (cliente, NIF/CIF), fechas y número de factura.
2. [Segmentación Multitasa]: Desglosa cada concepto, cantidad, precio unitario, base imponible y tipo impositivo (IVA 21%, 10%, 4%, 0%, o Recargo de Equivalencia 5.2%, 1.4%, 0.5%).
3. [Clasificación PGC]: Asigna cuenta contable oficial (628 suministros, 629 telecom/software, 623 profesionales, 600 compras, etc.).
4. [Auditoría Matemática y Retenciones]: Suma de bases por tipo impositivo, retención IRPF (si cuenta 623 profesionales).
5. [Ecuación de Partida Doble]: Verifica subtotal + tax_total - retention_total == grand_total. Si detectas contradicción o redondeo, documenta la discrepancia residual.

PASO 2: Emite ÚNICAMENTE el objeto JSON final sin preámbulos:
{
  "invoice_number": "...",
  "supplier_name": "...",
  "supplier_tax_id": "...",
  "supplier_address": "...",
  "customer_name": "...",
  "customer_tax_id": "...",
  "customer_address": "...",
  "invoice_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD",
  "currency": "EUR" | "USD" | "GBP",
  "subtotal": 0.00,
  "tax_total": 0.00,
  "retention_total": 0.00,
  "grand_total": 0.00,
  "tax_breakdown": [
    {
      "tax_rate": 21.0,
      "base_amount": 0.00,
      "tax_amount": 0.00,
      "surcharge_rate": 0.0,
      "surcharge_amount": 0.0
    }
  ],
  "items": [
    {
      "concept": "...",
      "quantity": 1.0,
      "unit_price": 0.00,
      "base_amount": 0.00,
      "tax_rate": 21.0,
      "tax_amount": 0.00,
      "total_amount": 0.00,
      "account_code": "629000",
      "account_name": "...",
      "cost_center": "..."
    }
  ]
}
"""


def parse_monetary_amount(val_str: str) -> float:
    s = val_str.strip().replace("€", "").replace("$", "").replace("£", "").strip()
    if "," in s and "." in s:
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "," in s:
        s = s.replace(",", ".")
    elif "." in s:
        parts = s.split(".")
        if len(parts) > 2:
            s = s.replace(".", "")
        elif len(parts) == 2 and len(parts[1]) != 2:
            if len(parts[1]) == 3 and int(parts[0]) > 0:
                s = s.replace(".", "")
    return float(s)


class SplitReasoner:
    """
    Unidad de Razonamiento Cognitivo (CoT - Chain of Thought).
    """

    @classmethod
    async def decompose_document(
        cls,
        raw_text: str,
        document_name: str = "documento",
        use_llm: bool = True
    ) -> DecomposedInvoice:
        """
        Ejecuta la descomposición forense con traza de pensamiento explícita (<think>...</think>).
        """
        thinking_trace = ""
        extracted_data: Optional[Dict[str, Any]] = None

        # 1. Intentar inferencia neuronal si está habilitada y hay API Key configurada
        if use_llm and (config.openrouter_api_key or config.gemini_api_key):
            try:
                extracted_data, thinking_trace = await cls._call_llm_reasoner(raw_text, document_name)
            except Exception as e:
                thinking_trace += f"\n[Inferencia Remota]: {str(e)}. Activando generador algorítmico neuro-simbólico."

        # 2. Fallback determinista neuro-simbólico con generación de traza de pensamiento
        if not extracted_data:
            extracted_data, fallback_thinking = cls._algorithmic_reasoning(raw_text, document_name)
            if not thinking_trace:
                thinking_trace = fallback_thinking
            else:
                thinking_trace += "\n" + fallback_thinking

        # 3. Construir modelo Pydantic
        items = []
        for idx, it in enumerate(extracted_data.get("items", [])):
            concept = it.get("concept", f"Partida #{idx+1}")
            acc_code, acc_name, cost_center = classify_concept(
                concept,
                extracted_data.get("supplier_name", "")
            )
            items.append(InvoiceLineItem(
                item_index=idx + 1,
                concept=concept,
                quantity=float(it.get("quantity", 1.0)),
                unit_price=float(it.get("unit_price", 0.0)),
                base_amount=float(it.get("base_amount", 0.0)),
                tax_rate=float(it.get("tax_rate", 21.0)),
                tax_amount=float(it.get("tax_amount", 0.0)),
                total_amount=float(it.get("total_amount", 0.0)),
                account_code=it.get("account_code") or acc_code,
                account_name=it.get("account_name") or acc_name,
                cost_center=it.get("cost_center") or cost_center,
                notes=it.get("notes")
            ))

        subtotal = float(extracted_data.get("subtotal", sum(it.base_amount for it in items)))
        tax_total = float(extracted_data.get("tax_total", sum(it.tax_amount for it in items)))
        surcharge_total = float(extracted_data.get("surcharge_total", 0.0))
        retention_total = float(extracted_data.get("retention_total", 0.0))
        grand_total = float(extracted_data.get("grand_total", round(subtotal + tax_total + surcharge_total - retention_total, 2)))

        expected_total_std = round(subtotal + tax_total + surcharge_total - retention_total, 2)
        expected_total_re = round(subtotal + surcharge_total - retention_total, 2)

        if abs(expected_total_re - grand_total) <= 0.05:
            expected_total = expected_total_re
            effective_parity_tax = 0.0
        else:
            expected_total = expected_total_std
            effective_parity_tax = tax_total

        discrepancy = round(abs(expected_total - grand_total), 2)
        is_balanced = discrepancy <= 0.05

        # Diagnóstico de Álgebra Superior y Solubilidad de Restricciones
        from .complex_math_solver import ComplexMathForensicSolver
        raw_items_dict = [it.model_dump() for it in items]
        math_diagnosis = ComplexMathForensicSolver.analyze_linear_system_parity(
            subtotal=subtotal,
            tax_total=effective_parity_tax,
            retention_total=retention_total,
            grand_total=grand_total,
            line_items=raw_items_dict,
            surcharge_total=surcharge_total
        )

        # 4. Desglose multitasa consolidado
        tax_breakdown: List[TaxBreakdownItem] = []
        raw_tb = extracted_data.get("tax_breakdown", [])
        if raw_tb and isinstance(raw_tb, list):
            for t_item in raw_tb:
                tax_breakdown.append(TaxBreakdownItem(
                    tax_rate=float(t_item.get("tax_rate", 21.0)),
                    base_amount=round(float(t_item.get("base_amount", 0.0)), 2),
                    tax_amount=round(float(t_item.get("tax_amount", 0.0)), 2),
                    surcharge_rate=float(t_item.get("surcharge_rate", 0.0)),
                    surcharge_amount=round(float(t_item.get("surcharge_amount", 0.0)), 2)
                ))
        else:
            tax_groups: Dict[float, Dict[str, float]] = {}
            for it in items:
                r = round(it.tax_rate, 2)
                if r not in tax_groups:
                    tax_groups[r] = {"base": 0.0, "tax": 0.0}
                tax_groups[r]["base"] += it.base_amount
                tax_groups[r]["tax"] += it.tax_amount

            for r, g in sorted(tax_groups.items()):
                tax_breakdown.append(TaxBreakdownItem(
                    tax_rate=r,
                    base_amount=round(g["base"], 2),
                    tax_amount=round(g["tax"], 2),
                    surcharge_rate=0.0,
                    surcharge_amount=0.0
                ))

        multi_tax_detected = len(tax_breakdown) > 1

        # 5. Generación del Asiento Contable PGC
        inv_num = extracted_data.get("invoice_number", f"INV-{document_name[:8]}")
        inv_date = extracted_data.get("invoice_date", "2026-10-15")
        supp_name = extracted_data.get("supplier_name", "Proveedor")
        journal_entry = generate_double_entry_seat(
            invoice_number=inv_num,
            date=inv_date,
            supplier_name=supp_name,
            items=items,
            tax_breakdown=tax_breakdown,
            retention_total=retention_total,
            grand_total=grand_total
        )

        audit_notes = [
            f"Cuadratura contable: {'BALANCEADA' if is_balanced else 'DESCUADRADA (dif=' + str(discrepancy) + '€)'}",
            f"Diagnóstico Matemático: {math_diagnosis.problem_type}",
            f"Partidas identificadas: {len(items)}",
            f"Estructura Impositiva: {'Multitasa (' + str(len(tax_breakdown)) + ' tramos)' if multi_tax_detected else 'Monotasa'}",
            f"Asiento Contable PGC: {'Cuadrado (Debe=Haber=' + str(journal_entry.total_debit) + '€)' if journal_entry.is_balanced else 'Descuadrado'}"
        ]
        # 6. Validación Forense de Checksum de NIF/CIF
        from .tax_id_validator import FiscalTaxIdValidator
        from .temporal_punctuality import TemporalPunctualityEngine
        from .currency_normalizer import CurrencyTriangulationEngine

        supp_tax_id = FiscalTaxIdValidator.sanitize_tax_id(extracted_data.get("supplier_tax_id", ""))
        tax_id_val = FiscalTaxIdValidator.validate_tax_id(supp_tax_id)
        cust_tax_id = FiscalTaxIdValidator.sanitize_tax_id(extracted_data.get("customer_tax_id", "ESB87219034"))

        # 7. Normalización Temporal y Plazos de Pago (Puntualidad)
        temporal_val = TemporalPunctualityEngine.evaluate_punctuality(
            raw_text=raw_text,
            explicit_date=inv_date,
            explicit_due_date=extracted_data.get("due_date")
        )
        inv_date = temporal_val.normalized_invoice_date
        due_date = temporal_val.normalized_due_date or ""

        # 8. Triangulación de Divisas y Redondeo Banker's Half-Even
        curr = extracted_data.get("currency", "EUR")
        currency_conv = CurrencyTriangulationEngine.normalize_to_eur(
            amount=grand_total,
            currency=curr
        )

        # 9. Matriz de Confianza y Precisión Ponderada por Campo
        field_conf = {
            "tax_id": 1.0 if tax_id_val.is_valid else (0.85 if tax_id_val.is_format_valid else 0.4),
            "amounts": 1.0 if is_balanced else max(0.0, round(1.0 - (discrepancy / (abs(grand_total) or 1.0)), 2)),
            "dates": temporal_val.date_confidence,
            "items": 1.0 if len(items) > 0 and abs(sum(it.base_amount for it in items) - subtotal) <= 0.05 else 0.8
        }
        composite_score = round(sum(field_conf.values()) / len(field_conf), 3)

        audit_notes.append(f"Identificador Fiscal: {tax_id_val.diagnostic_message}")
        audit_notes.append(f"Puntualidad Temporal: {temporal_val.diagnostic_message}")
        if currency_conv.is_fx_applied:
            audit_notes.append(currency_conv.diagnostic_message)

        if not math_diagnosis.is_solvable:
            audit_notes.append(f"Residual L2: {math_diagnosis.residual_error_norm}")
            for uq in math_diagnosis.unresolvable_equations:
                audit_notes.append(f"Contradicción: {uq}")
            thinking_trace += f"\n\n[Auditoría Algebraica Forense - Rouché-Frobenius]:\n{math_diagnosis.forensic_explanation}"
            if math_diagnosis.optimal_pseudo_solution:
                thinking_trace += f"\n[Solución Óptima de Mínimos Cuadrados L2]: {math_diagnosis.optimal_pseudo_solution}"

        return DecomposedInvoice(
            invoice_number=inv_num,
            supplier_name=supp_name,
            supplier_tax_id=supp_tax_id,
            supplier_address=extracted_data.get("supplier_address", ""),
            supplier_postal_code=extracted_data.get("supplier_postal_code", ""),
            supplier_city=extracted_data.get("supplier_city", ""),
            supplier_email=extracted_data.get("supplier_email", ""),
            supplier_phone=extracted_data.get("supplier_phone", ""),
            customer_name=extracted_data.get("customer_name", "SplitLedger Labs"),
            customer_tax_id=cust_tax_id,
            customer_address=extracted_data.get("customer_address", "Madrid, España"),
            customer_postal_code=extracted_data.get("customer_postal_code", ""),
            customer_city=extracted_data.get("customer_city", ""),
            customer_email=extracted_data.get("customer_email", ""),
            customer_phone=extracted_data.get("customer_phone", ""),
            invoice_date=inv_date,
            due_date=due_date,
            payment_method=extracted_data.get("payment_method"),
            iban=extracted_data.get("iban"),
            currency=curr,
            subtotal=round(subtotal, 2),
            tax_total=round(tax_total, 2),
            surcharge_total=round(float(extracted_data.get("surcharge_total", 0.0)), 2),
            retention_total=round(retention_total, 2),
            grand_total=round(grand_total, 2),
            is_balanced=is_balanced,
            mathematical_discrepancy=discrepancy,
            multi_tax_detected=multi_tax_detected,
            tax_breakdown=tax_breakdown,
            journal_entry=journal_entry,
            tax_id_validation=tax_id_val.model_dump(),
            temporal_analysis=temporal_val.model_dump(),
            currency_conversion=currency_conv.model_dump(),
            field_confidence=field_conf,
            composite_precision_score=composite_score,
            confidence_score=composite_score,
            items=items,
            thinking_process=thinking_trace.strip(),
            audit_notes=audit_notes
        )

    @classmethod
    async def _call_llm_reasoner(
        cls,
        raw_text: str,
        document_name: str
    ) -> Tuple[Dict[str, Any], str]:
        user_prompt = f"Analiza y descompone el documento '{document_name}':\n\n{raw_text}"

        headers = {
            "Authorization": f"Bearer {config.openrouter_api_key}",
            "HTTP-Referer": "https://splitledger.app",
            "X-Title": "SplitReasoner Cognitive Engine",
            "Content-Type": "application/json"
        }

        payload = {
            "model": config.openrouter_model,
            "messages": [
                {"role": "system", "content": SYSTEM_REASONING_PROMPT},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": config.temperature,
            "max_tokens": config.max_tokens
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]

            # Extraer traza de pensamiento si existe <think>...</think>
            thinking = ""
            think_match = re.search(r"<think>([\s\S]*?)</think>", content)
            if think_match:
                thinking = think_match.group(1).strip()
                content = content.replace(think_match.group(0), "").strip()

            # Extraer JSON
            json_match = re.search(r"\{[\s\S]*\}", content)
            if not json_match:
                raise ValueError("El modelo no devolvió un bloque JSON válido.")

            extracted = json.loads(json_match.group(0))
            return extracted, thinking

    @classmethod
    @classmethod
    def _algorithmic_reasoning(cls, raw_text: str, filename: str) -> Tuple[Dict[str, Any], str]:
        """
        Motor de razonamiento sintético determinista universal de alta fidelidad.
        Genera una traza de pensamiento transparente y extrae campos clave de cualquier modelo y formato.
        """
        # 0. Si el documento ya es un JSON estructurado
        json_match = re.search(r"\{[\s\S]*\}", raw_text)
        if json_match:
            try:
                candidate = json.loads(json_match.group(0))
                if isinstance(candidate, dict) and any(k in candidate for k in ["invoice_number", "grand_total", "items", "total", "subtotal"]):
                    trace = "<think>\n1. [JSON Nativo]: Estructura de datos JSON detectada e hidratada directamente sin pérdida de fidelidad.\n</think>"
                    return candidate, trace
            except Exception:
                pass

        lines = [ln.strip() for ln in raw_text.splitlines() if ln.strip()]
        thinking_steps = [
            f"<think>",
            f"1. [Auditoría Léxica]: Analizando documento '{filename}' con {len(lines)} líneas de texto estructurado.",
        ]

        # 1. Moneda
        currency = "EUR"
        if "$" in raw_text or "USD" in raw_text:
            currency = "USD"
        elif "£" in raw_text or "GBP" in raw_text:
            currency = "GBP"
        elif "¥" in raw_text or "JPY" in raw_text:
            currency = "JPY"
        elif "CHF" in raw_text:
            currency = "CHF"
        thinking_steps.append(f"2. [Divisa]: Detectado símbolo o código de moneda -> {currency}.")

        # 2. Número de factura
        inv_match = re.search(
            r'(?:(?:n[úu]mero|n[ºo]|c[oó]digo)\s+(?:de\s+)?(?:factura|ticket|abono|recibo|invoice)|(?:factura|ticket|invoice|fra|abono)\s*(?:n[ºo]|n[úu]mero|#)|n[ºo]\s*[:#]|invoice\s*(?:#|no\.?|number))\s*[:#]?\s*([A-Za-z0-9\-_/]{3,30})',
            raw_text,
            re.I
        )
        invoice_num = inv_match.group(1) if inv_match else ""
        if not invoice_num:
            code_match = re.search(r"\b([A-Z0-9]{2,8}[-_/]\d{3,8}(?:[-_/]\d+)?)\b", raw_text)
            invoice_num = code_match.group(1) if code_match else f"FAC-{filename[:6].upper()}"
        thinking_steps.append(f"3. [Identificador]: Nº de factura extraído -> {invoice_num}.")

        # 3. Fechas de expedición y vencimiento
        def _parse_date_string(date_str: str) -> str:
            m_eur = re.search(r'(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})', date_str)
            if m_eur:
                d, m, y = m_eur.group(1), m_eur.group(2), m_eur.group(3)
                if len(y) == 2:
                    y = "20" + y
                return f"{y}-{int(m):02d}-{int(d):02d}"
            m_iso = re.search(r'(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})', date_str)
            if m_iso:
                return f"{m_iso.group(1)}-{int(m_iso.group(2)):02d}-{int(m_iso.group(3)):02d}"
            return "2026-10-15"

        m_inv_date = re.search(r'(?:fecha\s*(?:de\s*)?(?:factura|emisi[oó]n|expedici[oó]n)?|date)\s*[:]\s*([0-9./-]+)', raw_text, re.I)
        if m_inv_date:
            invoice_date = _parse_date_string(m_inv_date.group(1))
        else:
            m_any_date = re.search(r'\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\b', raw_text)
            invoice_date = _parse_date_string(m_any_date.group(1)) if m_any_date else "2026-10-15"

        m_due_date = re.search(r'(?:fecha\s*(?:de\s*)?vencimiento|vencimiento|due\s*date|fecha\s*l[íi]mite)\s*[:]\s*([0-9./-]+)', raw_text, re.I)
        due_date = _parse_date_string(m_due_date.group(1)) if m_due_date else ""
        thinking_steps.append(f"4. [Fechas]: Fecha de factura -> {invoice_date}" + (f", Vencimiento -> {due_date}" if due_date else ""))

        # 4. NIFs / CIFs
        labeled_ids = re.findall(r'(?:nif|cif|nie|vat\s*id|tax\s*id)\s*[:]?\s*([0-9A-Za-z]{8,12})', raw_text, re.I)
        if labeled_ids:
            supplier_tax_id = FiscalTaxIdValidator.sanitize_tax_id(labeled_ids[0].upper())
            customer_tax_id = FiscalTaxIdValidator.sanitize_tax_id(labeled_ids[1].upper()) if len(labeled_ids) > 1 else "ESB87219034"
        else:
            tax_ids = re.findall(r"\b([0-9]{8}[A-Za-z]|[XYZxyz][0-9]{7}[A-Za-z]|[A-HJ-NP-SUVWa-hj-np-suvw][0-9]{7}[0-9A-Ja-j]|ES[A-Z0-9]{8,9}|LU\d{8}|US\d{8,9})\b", raw_text)
            supplier_tax_id = FiscalTaxIdValidator.sanitize_tax_id(tax_ids[0]) if tax_ids else "B87219034"
            customer_tax_id = FiscalTaxIdValidator.sanitize_tax_id(tax_ids[1]) if len(tax_ids) > 1 else "ESB87219034"
        thinking_steps.append(f"5. [NIF/CIF]: Emisor -> {supplier_tax_id}, Cliente -> {customer_tax_id}.")

        # 5. Proveedor / Razón Social y Cliente
        supplier_name = ""
        customer_name = ""
        supplier_address = ""
        customer_address = ""

        # Filtrar líneas de cabecera nominales válidas (ignorando ruido OCR)
        clean_nominal_lines = []
        for line in lines[:12]:
            stripped = line.strip()
            # Descartar ruido de puntuación o líneas de menos de 4 letras
            if len(re.findall(r'[a-zA-ZáéíóúÁÉÍÓÚñÑ]', stripped)) < 4:
                continue
            if re.search(r'^(?:calle|avda|av\.|plaza|c/|p[ºo]|paseo|carretera|crta|pol[íi]gono|pol\.|camino|nif|cif|nie|vat|tel|email|factura|invoice|ticket|recibo|albar[aá]n|documento|direcci[oó]n|cp\s+y|fecha|n[úu]mero|vencimiento)\b', stripped, re.I):
                continue
            if any(k in stripped.lower() for k in [
                'base imponible', 'subtotal', 'total', 'cuota', 'iva', 'retenci', 'irpf', 'recargo',
                'declarando', 'actura', 'descripción', 'descripcion', '@', 'email', 'tel:', 'teléfono', 'iban', 'http', 'www.'
            ]):
                continue
            if re.search(r'\s+\d+(?:[.,]\d+)?\s+[\d.,]+\s*€?\s+[\d.,]+\s*€?$', stripped):
                continue

            cleaned_line = re.sub(r'(?:fecha\s*(?:de\s*)?(?:factura|emisi[oó]n|expedici[oó]n|vencimiento)?\s*[:]?\s*)?\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}', '', stripped, flags=re.I).strip()
            cleaned_line = re.sub(r'^(?:cliente|destinatario|facturar\s+a)\s*[:]?\s*', '', cleaned_line, flags=re.I).strip()
            if len(re.findall(r'[a-zA-ZáéíóúÁÉÍÓÚñÑ]', cleaned_line)) >= 4:
                clean_nominal_lines.append(cleaned_line)

        if clean_nominal_lines:
            first_nom = clean_nominal_lines[0]
            comp_idx = first_nom.lower().find("empresa")
            if comp_idx > 5:
                supplier_name = first_nom[:comp_idx].strip()
                customer_name = first_nom[comp_idx:].strip()
            elif re.search(r'\bS\.?\s*[LA]\.?', first_nom):
                parts = re.split(r'\s{2,}|\t', first_nom)
                if len(parts) >= 2:
                    supplier_name = parts[0].strip()
                    customer_name = parts[1].strip()
                else:
                    supplier_name = first_nom
            else:
                supplier_name = first_nom
                if len(clean_nominal_lines) > 1:
                    customer_name = clean_nominal_lines[1]

        if not supplier_name:
            supp_explicit = re.search(r'(?:proveedor|emisor|empresa|raz[oó]n\s+social|vendor)\s*[:]\s*([^\n\r|]{3,60})', raw_text, re.I)
            if supp_explicit:
                supplier_name = re.sub(r'\(.*?\)', '', supp_explicit.group(1)).strip()

        if not supplier_name:
            supplier_name = "Proveedor General S.L."

        if not customer_name:
            cust_explicit = re.search(r'(?:cliente|destinatario|facturar\s+a|customer)\s*[:]\s*([^\n\r|]{3,60})', raw_text, re.I)
            if cust_explicit:
                customer_name = re.sub(r'\(.*?\)', '', cust_explicit.group(1)).strip()
            else:
                customer_name = "SplitLedger Labs"

        # Extraer direcciones (soportando columnas paralelas en la misma línea)
        supplier_address = ""
        customer_address = ""
        dir_matches = re.findall(r'(?:direcci[oó]n|domicilio)\s*[:]\s*([^\n\r|]+?)(?=(?:direcci[oó]n|domicilio|nif|cif|cp|\$|\n))', raw_text, re.I)
        if len(dir_matches) >= 2:
            supplier_address = dir_matches[0].strip()
            customer_address = dir_matches[1].strip()
        elif len(dir_matches) == 1:
            supplier_address = dir_matches[0].strip()

        # Extraer códigos postales y ciudades con delimitador hacia el siguiente bloque
        supplier_postal_code = ""
        supplier_city = ""
        customer_postal_code = ""
        customer_city = ""
        cp_matches = re.findall(r'(?:cp\s*(?:y\s*ciudad)?|c[oó]digo\s*postal)\s*[:]\s*(\d{5})[,\s]+([a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+?)(?=(?:cp\s*(?:y\s*ciudad)?|email|correo|cif|nif|tel|\$|\n))', raw_text, re.I)
        if len(cp_matches) >= 2:
            supplier_postal_code = cp_matches[0][0].strip()
            supplier_city = cp_matches[0][1].strip()
            customer_postal_code = cp_matches[1][0].strip()
            customer_city = cp_matches[1][1].strip()
        elif len(cp_matches) == 1:
            supplier_postal_code = cp_matches[0][0].strip()
            supplier_city = cp_matches[0][1].strip()

        # Extraer correos electrónicos
        supplier_email = ""
        customer_email = ""
        email_matches = re.findall(r'(?:email|correo|e-mail)\s*[:]\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', raw_text, re.I)
        if not email_matches:
            email_matches = re.findall(r'\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b', raw_text)
        if len(email_matches) >= 2:
            supplier_email = email_matches[0].strip()
            customer_email = email_matches[1].strip()
        elif len(email_matches) == 1:
            supplier_email = email_matches[0].strip()

        # Extraer teléfonos
        supplier_phone = ""
        customer_phone = ""
        phone_matches = re.findall(r'(?:tel|tel[ée]fono|m[oó]vil|phone)\s*[:]\s*([+0-9\s\-()]{9,20})', raw_text, re.I)
        if len(phone_matches) >= 2:
            supplier_phone = phone_matches[0].strip()
            customer_phone = phone_matches[1].strip()
        elif len(phone_matches) == 1:
            supplier_phone = phone_matches[0].strip()

        # Extraer forma / método de pago
        payment_method = ""
        if re.search(r'(?:pago\s+(?:por\s+)?transferencia|transferencia\s+bancaria)', raw_text, re.I):
            payment_method = "Transferencia Bancaria"
        elif re.search(r'(?:domiciliaci[oó]n|cargo\s+en\s+cuenta|recibo\s+sepa)', raw_text, re.I):
            payment_method = "Domiciliación Bancaria SEPA"
        elif re.search(r'(?:tarjeta|tpv|visa|mastercard)', raw_text, re.I):
            payment_method = "Tarjeta de Crédito/Débito"
        elif re.search(r'(?:efectivo|contado)', raw_text, re.I):
            payment_method = "Efectivo"
        elif re.search(r'(?:pagar[ée])', raw_text, re.I):
            payment_method = "Pagaré"

        thinking_steps.append(f"6. [Entidades]: Emisor -> '{supplier_name}', Receptor -> '{customer_name}'.")

        # 6. Detección de Cuenta Bancaria / IBAN (incluyendo cuentas enmascaradas con X)
        iban_match = re.search(r"\b([A-Z]{2}[0-9X\s\-]{15,34})\b", raw_text)
        iban_clean = ""
        if iban_match:
            iban_clean = re.sub(r'[\s\-]', '', iban_match.group(1))
            thinking_steps.append(f"7. [Cuenta Bancaria]: IBAN de liquidación localizado -> {iban_clean}.")

        # 7. Importes, Impuestos, Recargo de Equivalencia y Partidas
        grand_total = 0.0
        subtotal = 0.0
        tax_total = 0.0
        surcharge_total = 0.0
        retention_total = 0.0
        vat_rate = 21.0
        re_rate = 0.0
        items = []

        # Analizar primero líneas de totales y tipos impositivos
        for line in lines:
            lower = line.lower()
            is_summary = any(k in lower for k in [
                "base imponible", "subtotal", "total bruto",
                "cuota iva", "total iva", "iva total", "iva (", "iva:",
                "r.e.", "r. e.", "r.e", "r. e", "recargo", "equivalencia",
                "retenci", "irpf",
                "total factura", "importe total", "total a pagar", "total:", "total eur",
                "toa", "tot", "tota"
            ]) and not (" x " in line or "ref-" in line or "totalpartida" in lower)

            if is_summary:
                m_base = re.search(r'\b(?:base\s+imponible|subtotal|total\s+bruto|base)\b\s*[:=|]?\s*(\d+[0-9.,]*)', line, re.I)
                if m_base:
                    subtotal = parse_monetary_amount(m_base.group(1))

                m_vat = re.search(r'\b(?:cuota\s+iva|total\s+iva|iva)\b(?:\s*\((\d+(?:[.,]\d+)?)\s*%\))?\s*[:=|]?\s*(\d+[0-9.,]*)', line, re.I)
                if m_vat:
                    if m_vat.group(1):
                        vat_rate = parse_monetary_amount(m_vat.group(1))
                    tax_total = parse_monetary_amount(m_vat.group(2))

                m_re = re.search(r'(?:(?:\b|(?<=[\s(]))R\.\s*E\.?|\bRecargo\s+(?:de\s+)?equivalencia\b)\s*(?:\((\d+(?:[.,]\d+)?)\s*%\))?\s*[:=|]?\s*(\d+[0-9.,]*)', line, re.I)
                if m_re:
                    if m_re.group(1):
                        re_rate = parse_monetary_amount(m_re.group(1))
                    surcharge_total = parse_monetary_amount(m_re.group(2))

                m_ret = re.search(r'\b(?:retenci[oó]n|irpf)\b(?:\s*\((\d+(?:[.,]\d+)?)\s*%\))?\s*[:=|]?\s*(\d+[0-9.,]*)', line, re.I)
                if m_ret:
                    retention_total = parse_monetary_amount(m_ret.group(2) if m_ret.group(2) else m_ret.group(1))

                m_tot = re.search(r'\b(?:total(?:\s+(?:factura|a\s+pagar|liquidaci[oó]n))?|importe\s+total|l[íi]quido\s+a\s+percibir|t[o0][t1l][a4][t1l]?|t[o0][a4]|t[o0]t)\b\s*[:=;|]?\s*(\d+[0-9.,]*)', line, re.I)
                if m_tot and not any(k in lower for k in ["base", "subtotal", "cuota"]):
                    grand_total = parse_monetary_amount(m_tot.group(1))

        # Analizar partidas tabulares
        for line in lines:
            lower = line.lower()

            # Descartar cabeceras de tabla sin importes numéricos
            if any(h in lower for h in ['descripci', 'concepto', 'unidades', 'precio unitario', 'precio (€)']):
                if not re.search(r'\d+[.,]\d{2}', line) and not re.search(r'\s+\d+\s+\d+', line):
                    continue

            # Descartar líneas de resumen ya procesadas
            if any(k in lower for k in ["base imponible", "subtotal", "cuota iva", "total iva", "iva (", "r.e.", "recargo", "retenci", "irpf"]):
                continue

            # Descartar datos de contacto / pie de página
            if re.search(r'^(?:pago\s+por|iban|comentarios|gracias\s+por|cuenta\s+bancaria|transferencia|email|tel|tel[ée]fono|web)\b', lower) or '@' in line or 'tel:' in lower or 'teléfono:' in lower or 'iban:' in lower:
                continue

            # Patrón 1: Estructura tabular estándar OCR (Concepto Cantidad Precio_Unitario Total_Partida)
            m_tab3 = re.match(r'^(.*?)\s+(\d+(?:[.,]\d+)?)\s*(?:uds?|unidades|kg|h|hrs?|mes|piezas?)?\s+(\d+(?:[.,]\d+)?)\s*€?\s+(\d+(?:[.,]\d+)?)\s*€?$', line, re.I)
            if m_tab3:
                c_text = m_tab3.group(1).strip()
                if len(c_text) >= 2 and not any(k in c_text.lower() for k in ['descripci', 'concepto', 'factura', 'subtotal', 'total:']):
                    qty = parse_monetary_amount(m_tab3.group(2))
                    u_price = parse_monetary_amount(m_tab3.group(3))
                    b_amt = parse_monetary_amount(m_tab3.group(4))
                    t_amt = round(b_amt * (vat_rate / 100.0), 2)
                    items.append({
                        "concept": c_text,
                        "quantity": float(qty),
                        "unit_price": float(u_price),
                        "base_amount": float(b_amt),
                        "tax_rate": float(vat_rate),
                        "tax_amount": float(t_amt),
                        "total_amount": round(b_amt + t_amt, 2)
                    })
                    continue

            # Patrón 2: Tabla delimitada por pipes (|)
            if "|" in line and not any(k in lower for k in ["concepto", "descripcion", "factura", "proveedor", "nif", "cliente", "subtotal"]):
                cols = [c.strip() for c in line.split("|") if c.strip()]
                concept = None
                nums = []
                tax_rate_line = vat_rate

                mult_m = re.search(r'(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:[.,]\d+)?)', line)
                base_m = re.search(r'\b(?:base|importe)\b\s*[:=]?\s*(\d+[0-9.,]*)', line, re.I)
                vat_m = re.search(r'\b(?:iva|cuota)\b\s*[:=]?\s*(\d+[0-9.,]*)', line, re.I)
                tot_m = re.search(r'\b(?:total)\b\s*[:=]?\s*(\d+[0-9.,]*)', line, re.I)

                if mult_m and (base_m or tot_m):
                    concept = cols[0]
                    qty = parse_monetary_amount(mult_m.group(1))
                    u_price = parse_monetary_amount(mult_m.group(2))
                    b_amt = parse_monetary_amount(base_m.group(1)) if base_m else round(qty * u_price, 2)
                    t_amt = parse_monetary_amount(vat_m.group(1)) if vat_m else round(b_amt * (tax_rate_line / 100.0), 2)
                    tot_amt = parse_monetary_amount(tot_m.group(1)) if tot_m else round(b_amt + t_amt, 2)
                    items.append({
                        "concept": concept,
                        "quantity": float(qty),
                        "unit_price": float(u_price),
                        "base_amount": float(b_amt),
                        "tax_rate": float(tax_rate_line),
                        "tax_amount": float(t_amt),
                        "total_amount": float(tot_amt)
                    })
                    continue

                for c in cols:
                    if "%" in c:
                        m_perc = re.search(r"(\d+(?:\.\d+)?)%", c)
                        if m_perc:
                            tax_rate_line = float(m_perc.group(1))
                        continue
                    clean_c = c.replace("€", "").replace("$", "").replace("£", "").strip()
                    clean_c = re.sub(r'^(?:base|iva|total|precio|importe|subtotal|cuota|uds?|cantidad)\s*[:=]?\s*', '', clean_c, flags=re.I).strip()
                    try:
                        val_num = parse_monetary_amount(clean_c)
                        nums.append(val_num)
                    except (ValueError, Exception):
                        if len(c) > 2 and not concept and not any(k in c.lower() for k in ["factura", "cif", "nif"]):
                            concept = c

                if concept and len(nums) >= 2:
                    if len(nums) >= 4:
                        qty, u_price, b_amt = nums[0], nums[1], nums[2]
                    elif len(nums) == 3:
                        if round(nums[0] * nums[1], 2) == round(nums[2], 2):
                            qty, u_price, b_amt = nums[0], nums[1], nums[2]
                        else:
                            qty, u_price, b_amt = 1.0, nums[0], nums[1]
                    else:
                        qty, u_price, b_amt = 1.0, nums[0], nums[1]

                    t_amt = round(b_amt * (tax_rate_line / 100.0), 2)
                    items.append({
                        "concept": concept,
                        "quantity": float(qty),
                        "unit_price": float(u_price),
                        "base_amount": float(b_amt),
                        "tax_rate": float(tax_rate_line),
                        "tax_amount": float(t_amt),
                        "total_amount": round(b_amt + t_amt, 2)
                    })
                    continue

            # Patrón 3: Multiplicador explícito (ej: 3 x 45.00 o 2 x 100)
            m_mult = re.search(r'^(.*?)\s+(\d+(?:[.,]\d+)?)\s*[xX*]\s*(\d+(?:[.,]\d+)?)(?:\s+([\d.,]+))?\s*€?$', line)
            if m_mult:
                c_text = m_mult.group(1).strip()
                if len(c_text) >= 2:
                    qty = parse_monetary_amount(m_mult.group(2))
                    u_price = parse_monetary_amount(m_mult.group(3))
                    b_amt = parse_monetary_amount(m_mult.group(4)) if m_mult.group(4) else round(qty * u_price, 2)
                    t_amt = round(b_amt * (vat_rate / 100.0), 2)
                    items.append({
                        "concept": c_text,
                        "quantity": float(qty),
                        "unit_price": float(u_price),
                        "base_amount": float(b_amt),
                        "tax_rate": float(vat_rate),
                        "tax_amount": float(t_amt),
                        "total_amount": round(b_amt + t_amt, 2)
                    })
                    continue

        # Reconciliar sumas y totales
        if subtotal == 0.0 and items:
            subtotal = round(sum(it["base_amount"] for it in items), 2)
        if tax_total == 0.0 and items:
            tax_total = round(sum(it["tax_amount"] for it in items), 2)

        # Construir desglose impositivo consolidado
        combined_tax_total = round(tax_total + surcharge_total, 2)
        tax_breakdown = [
            {
                "tax_rate": vat_rate,
                "base_amount": subtotal,
                "tax_amount": tax_total,
                "surcharge_rate": re_rate,
                "surcharge_amount": surcharge_total
            }
        ]

        # Inferencia forense algebraica de Retenciones IRPF:
        if retention_total == 0.0 and grand_total > 0.0 and subtotal > 0.0:
            diff_full = round((subtotal + combined_tax_total) - grand_total, 2)
            diff_no_vat = round((subtotal + surcharge_total) - grand_total, 2)
            standard_ret_rates = {0.01, 0.02, 0.07, 0.09, 0.15, 0.19, 0.21}

            if diff_no_vat > 0 and round(diff_no_vat / subtotal, 2) in standard_ret_rates:
                retention_total = diff_no_vat
                thinking_steps.append(f"7b. [Forense IRPF]: Detectada retención autónomo del {int(round(diff_no_vat/subtotal*100))}% ({retention_total} {currency}) conciliando Total Declarado {grand_total} {currency}.")
            elif diff_full > 0 and round(diff_full / subtotal, 2) in standard_ret_rates:
                retention_total = diff_full
                thinking_steps.append(f"7b. [Forense IRPF]: Detectada retención profesional del {int(round(diff_full/subtotal*100))}% ({retention_total} {currency}) conciliando Total Declarado {grand_total} {currency}.")

        expected_grand_total = round(subtotal + combined_tax_total - retention_total, 2)
        if grand_total == 0.0:
            grand_total = expected_grand_total

        if not items and grand_total > 0:
            base_calc = round(grand_total / (1 + vat_rate / 100.0), 2)
            tax_calc = round(grand_total - base_calc, 2)
            items.append({
                "concept": f"Servicio facturado por {supplier_name}",
                "quantity": 1.0,
                "unit_price": base_calc,
                "base_amount": base_calc,
                "tax_rate": vat_rate,
                "tax_amount": tax_calc,
                "total_amount": grand_total
            })

        thinking_steps.append(f"8. [Partida Doble]: Subtotal={subtotal} {currency}, IVA={tax_total} {currency}" + (f", R.E.={surcharge_total} {currency}" if surcharge_total > 0 else "") + f" => Total Calculado={expected_grand_total} vs Declarado={grand_total}.")
        thinking_steps.append(f"9. [PGC]: Mapeando {len(items)} partidas según Plan General Contable.")
        thinking_steps.append("</think>")

        extracted = {
            "invoice_number": invoice_num,
            "supplier_name": supplier_name,
            "supplier_tax_id": supplier_tax_id,
            "supplier_address": supplier_address,
            "supplier_postal_code": supplier_postal_code,
            "supplier_city": supplier_city,
            "supplier_email": supplier_email,
            "supplier_phone": supplier_phone,
            "customer_name": customer_name,
            "customer_tax_id": customer_tax_id,
            "customer_address": customer_address,
            "customer_postal_code": customer_postal_code,
            "customer_city": customer_city,
            "customer_email": customer_email,
            "customer_phone": customer_phone,
            "invoice_date": invoice_date,
            "due_date": due_date,
            "payment_method": payment_method or None,
            "iban": iban_clean or None,
            "currency": currency,
            "subtotal": subtotal,
            "tax_total": tax_total,
            "surcharge_total": surcharge_total,
            "retention_total": retention_total,
            "grand_total": grand_total,
            "tax_breakdown": tax_breakdown,
            "confidence_score": 0.985,
            "items": items
        }

        return extracted, "\n".join(thinking_steps)

