from typing import Dict, Tuple

# Catálogo del Plan General Contable (PGC) común en gastos empresariales
PGC_ACCOUNT_CATALOG = {
    "628000": {"name": "Suministros (Electricidad, Agua, Gas)", "cost_center": "FACILITIES"},
    "629000": {"name": "Otros servicios (Telefonía, Internet, Software)", "cost_center": "IT_OPS"},
    "623000": {"name": "Servicios de profesionales independientes", "cost_center": "LEGAL_CONSULTING"},
    "627000": {"name": "Publicidad, propaganda y relaciones públicas", "cost_center": "MARKETING"},
    "625000": {"name": "Primas de seguros", "cost_center": "ADMINISTRATION"},
    "626000": {"name": "Servicios bancarios y similares", "cost_center": "FINANCE"},
    "622000": {"name": "Reparaciones y conservación", "cost_center": "MAINTENANCE"},
    "624000": {"name": "Transportes y envíos", "cost_center": "LOGISTICS"},
    "600000": {"name": "Compras de mercaderías / Hardware", "cost_center": "PURCHASES"},
    "653000": {"name": "Pérdidas de créditos incobrables", "cost_center": "FINANCE"}
}

KEYWORD_RULES = [
    (["aws", "amazon web", "cloud", "google cloud", "azure", "github", "hosting", "servidor", "dominio", "software", "licencia", "saas", "slack", "notion"], "629000", "IT_OPS"),
    (["fibra", "móvil", "telefónica", "vodafone", "orange", "movistar", "datos", "línea", "adsl", "internet"], "629000", "TELECOM"),
    (["luz", "electricidad", "gas", "agua", "endesa", "iberdrola", "naturgy", "potencia", "kwh"], "628000", "FACILITIES"),
    (["honorarios", "asesoría", "abogado", "consultoría", "auditoría", "autónomo", "gestoría", "servicios jurídicos", "desarrollo software a medida"], "623000", "PROFESSIONAL_SERVICES"),
    (["restaurante", "comida", "cena", "almuerzo", "café", "menú", "dietas", "hostelería", "tpv"], "629000", "TRAVEL_EXPENSES"),
    (["portátil", "servidor físico", "ordenador", "pantalla", "teclado", "disco", "memoria", "hardware", "switch", "router", "producto", "mercadería", "mercaderia", "artículo", "articulo", "material"], "600000", "HARDWARE"),
    (["seguro", "póliza", "responsabilidad civil", "prima"], "625000", "ADMINISTRATION"),
    (["transporte", "paletizado", "flete", "envío", "mensajería", "logística", "portes", "courier", "dhl", "fedex", "ups", "seur"], "624000", "LOGISTICS"),
    (["reparación", "mantenimiento", "conservación", "revisión", "avería", "soporte técnico"], "622000", "MAINTENANCE"),
    (["comisión bancaria", "banco", "tarjeta", "pasarela", "redsys", "tpv"], "626000", "FINANCE")
]


def classify_concept(concept: str, supplier_name: str = "") -> Tuple[str, str, str]:
    """
    Clasifica un concepto de gasto en el PGC español con su centro de coste.
    Retorna: (account_code, account_name, cost_center)
    """
    text = f"{concept} {supplier_name}".lower()

    for keywords, code, center in KEYWORD_RULES:
        if any(kw in text for kw in keywords):
            account_info = PGC_ACCOUNT_CATALOG.get(code, {"name": "Otros servicios", "cost_center": center})
            return code, account_info["name"], center

    # Default fallback
    return "629000", PGC_ACCOUNT_CATALOG["629000"]["name"], "GENERAL"


def generate_double_entry_seat(
    invoice_number: str,
    date: str,
    supplier_name: str,
    items: list,
    tax_breakdown: list,
    retention_total: float,
    grand_total: float
):
    """
    Genera el Asiento Contable de Partida Doble según el Plan General Contable (PGC).
    Debe: Cuentas de Gasto (6xx) + IVA Soportado (472xxx)
    Haber: Retención IRPF (475100) + Proveedor/Acreedor (400000 / 410000)
    """
    from .schemas import JournalEntryLine, DoubleEntrySeat
    supplier_name = str(supplier_name or "Proveedor")
    invoice_number = str(invoice_number or "INV-000")
    lines = []
    total_debit = 0.0
    total_credit = 0.0

    # 1. Agrupar bases imponibles por cuenta contable (Debe)
    account_sums = {}
    for it in items:
        acc = getattr(it, "account_code", "629000") if hasattr(it, "account_code") else it.get("account_code", "629000")
        name = getattr(it, "account_name", "Gasto") if hasattr(it, "account_name") else it.get("account_name", "Gasto")
        base = getattr(it, "base_amount", 0.0) if hasattr(it, "base_amount") else float(it.get("base_amount", 0.0))
        if acc not in account_sums:
            account_sums[acc] = {"name": name, "amount": 0.0}
        account_sums[acc]["amount"] += base

    for acc_code, data in account_sums.items():
        amt = round(data["amount"], 2)
        if amt > 0:
            lines.append(JournalEntryLine(
                account_code=acc_code,
                account_name=data["name"],
                debit=amt,
                credit=0.0
            ))
            total_debit += amt

    # 2. Desglose de IVA Soportado (Debe)
    total_tax_breakdown_iva = sum(getattr(tb, "tax_amount", 0.0) if hasattr(tb, "tax_amount") else float(tb.get("tax_amount", 0.0)) for tb in tax_breakdown)
    total_tax_breakdown_surcharge = sum(getattr(tb, "surcharge_amount", 0.0) if hasattr(tb, "surcharge_amount") else float(tb.get("surcharge_amount", 0.0)) for tb in tax_breakdown)
    expected_re_total = round(total_debit + total_tax_breakdown_surcharge - retention_total, 2)
    is_pure_re_regime = abs(expected_re_total - grand_total) <= 0.05 and total_tax_breakdown_iva > 0

    for tb in tax_breakdown:
        rate = getattr(tb, "tax_rate", 21.0) if hasattr(tb, "tax_rate") else float(tb.get("tax_rate", 21.0))
        tax_amt = getattr(tb, "tax_amount", 0.0) if hasattr(tb, "tax_amount") else float(tb.get("tax_amount", 0.0))
        surcharge = getattr(tb, "surcharge_amount", 0.0) if hasattr(tb, "surcharge_amount") else float(tb.get("surcharge_amount", 0.0))

        if is_pure_re_regime:
            total_tax_line = round(surcharge, 2)
            re_rate_val = getattr(tb, 'surcharge_rate', 5.2) if hasattr(tb, 'surcharge_rate') else float(tb.get('surcharge_rate', 5.2))
            acc_name = f"H.P. Recargo de Equivalencia al {re_rate_val}%"
        else:
            total_tax_line = round(tax_amt + surcharge, 2)
            acc_name = f"H.P. IVA Soportado al {rate}%"

        if total_tax_line > 0:
            rate_int = int(round(rate))
            subaccount = f"4720{rate_int:02d}"
            lines.append(JournalEntryLine(
                account_code=subaccount,
                account_name=acc_name,
                debit=total_tax_line,
                credit=0.0
            ))
            total_debit += total_tax_line

    # 3. Retención IRPF si existe (Haber)
    if retention_total > 0.0:
        ret_val = round(retention_total, 2)
        lines.append(JournalEntryLine(
            account_code="475100",
            account_name="H.P. Acreedora por retenciones practicadas (IRPF)",
            debit=0.0,
            credit=ret_val
        ))
        total_credit += ret_val

    # 4. Proveedor / Acreedor (Haber)
    prov_val = round(grand_total, 2)
    # Si es profesional independiente (623) suele ser 410 (Acreedores), si mercadería (600) 400 (Proveedores)
    prov_account = "410000" if any("623" in acc for acc in account_sums.keys()) else "400000"
    lines.append(JournalEntryLine(
        account_code=prov_account,
        account_name=f"Acreedores/Proveedores: {supplier_name[:35]}",
        debit=0.0,
        credit=prov_val
    ))
    total_credit += prov_val

    total_debit = round(total_debit, 2)
    total_credit = round(total_credit, 2)
    is_balanced = abs(total_debit - total_credit) <= 0.05

    return DoubleEntrySeat(
        seat_number=1,
        date=date,
        concept=f"Factura {invoice_number} - {supplier_name[:30]}",
        lines=lines,
        total_debit=total_debit,
        total_credit=total_credit,
        is_balanced=is_balanced
    )
