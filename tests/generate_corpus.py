#!/usr/bin/env python3
import os
import json
import zipfile
import random
from typing import List, Dict, Any

OUTPUT_DIR = os.path.abspath("tests/high_volume_corpus")
os.makedirs(OUTPUT_DIR, exist_ok=True)

SUPPLIERS = [
    {"name": "Amazon Web Services EMEA SARL", "tax_id": "LU26375245", "type": "cloud", "account": "628000", "currency": "EUR"},
    {"name": "Google Cloud Ireland Limited", "tax_id": "IE6388047V", "type": "cloud", "account": "628000", "currency": "EUR"},
    {"name": "Microsoft Ireland Operations Ltd", "tax_id": "IE8256796U", "type": "cloud", "account": "628000", "currency": "EUR"},
    {"name": "Telefónica de España S.A.U.", "tax_id": "A28015865", "type": "telecom", "account": "629000", "currency": "EUR"},
    {"name": "Vodafone España S.A.U.", "tax_id": "A80907397", "type": "telecom", "account": "629000", "currency": "EUR"},
    {"name": "SEUR GeoPost S.L.", "tax_id": "B82910341", "type": "logistics", "account": "624000", "currency": "EUR"},
    {"name": "DHL Express Spain S.L.U.", "tax_id": "B28043685", "type": "logistics", "account": "624000", "currency": "EUR"},
    {"name": "Elena Gómez Martínez", "tax_id": "48920134K", "type": "freelance_legal", "account": "623000", "currency": "EUR", "retention": 15.0},
    {"name": "Carlos Ruiz Ingeniero Colegiado", "tax_id": "52091482X", "type": "freelance_tech", "account": "623000", "currency": "EUR", "retention": 15.0},
    {"name": "Hardware & Servers Distribución S.L.", "tax_id": "B85019284", "type": "hardware", "account": "600000", "currency": "EUR"},
    {"name": "Iberdrola Clientes S.A.U.", "tax_id": "A95748375", "type": "utility", "account": "628001", "currency": "EUR"},
    {"name": "Restaurante Asador Donostia S.L.", "tax_id": "B84920194", "type": "restaurant", "account": "629004", "currency": "EUR", "vat_rate": 10.0},
    {"name": "Mantenimiento Técnico Industrial S.L.", "tax_id": "B81928374", "type": "maintenance", "account": "622000", "currency": "EUR"},
    {"name": "Mapfre Empresas Seguros S.A.", "tax_id": "A28141935", "type": "insurance", "account": "625000", "currency": "EUR", "vat_rate": 0.0},
    {"name": "Google LLC (US Mountain View)", "tax_id": "US94275684", "type": "cloud", "account": "628000", "currency": "USD"},
    {"name": "Cloudflare Inc. San Francisco", "tax_id": "US27019284", "type": "cloud", "account": "628000", "currency": "USD"},
]

ITEMS_BY_TYPE = {
    "cloud": [
        ("Amazon Elastic Compute Cloud (EC2) c6g.2xlarge", 185.00),
        ("Amazon S3 Standard Storage (12.4 TB/mes)", 285.20),
        ("Google Cloud BigQuery Compute Engine On-Demand", 145.50),
        ("Google Cloud Kubernetes Engine (GKE Cluster)", 95.00),
        ("Microsoft Azure Virtual Network Gateway & ExpressRoute", 210.00),
        ("Neon Serverless PostgreSQL Compute Units & Storage", 68.00),
        ("Vercel Pro Enterprise Team Subscription", 40.00)
    ],
    "telecom": [
        ("Fibra Óptica Simétrica Corporativa 1Gbps / 1Gbps", 115.00),
        ("Línea Móvil Ejecutiva Voz Ilimitada + 50GB Datos 5G", 35.00),
        ("Troncal SIP Comunicaciones IP Centralita 30 Canales", 85.00),
        ("Servicio Backup 4G LTE Continuidad Negocio", 25.00)
    ],
    "logistics": [
        ("Transporte Paletizado Carga Pesada Nacional", 240.00),
        ("Servicio Courier Express 24h Documentación", 42.50),
        ("Seguro de Mercancía en Tránsito Terrestre", 38.00),
        ("Gestión Aduanera y Tasa de Manipulación Portuaria", 65.00)
    ],
    "freelance_legal": [
        ("Honorarios Asesoría Jurídica Mercantil Contratos", 450.00),
        ("Revisión Compliance RGPD y Cláusulas Laborales", 300.00)
    ],
    "freelance_tech": [
        ("Consultoría Arquitectura Software y Refactorización", 600.00),
        ("Auditoría de Seguridad Forense y Endurecimiento OWASP", 550.00)
    ],
    "hardware": [
        ("Servidor Rack Dell PowerEdge R650 32GB RAM", 1450.00),
        ("Switch Gestionable Cisco Catalyst 24 Puertos PoE+", 420.00),
        ("Disco SSD NVMe Enterprise 3.84TB U.2", 295.00),
        ("Monitor Profesional 27 Pulgadas 4K IPS Dell", 310.00)
    ],
    "utility": [
        ("Término de Potencia Contratada (P1 + P2)", 85.40),
        ("Consumo Energía Activa Punta y Valle (kWh)", 312.60),
        ("Alquiler de Equipos de Medida y Control Contador", 4.20)
    ],
    "restaurant": [
        ("Menú Ejecutivo Degustación Empresa (4 Comensales)", 160.00),
        ("Servicio de Restauración y Bebidas Reunión Comercial", 75.00)
    ],
    "maintenance": [
        ("Mantenimiento Preventivo Sistemas de Climatización", 195.00),
        ("Sustitución de Filtros HEPA y Recarga de Gas Refrigerante", 145.00)
    ],
    "insurance": [
        ("Póliza de Responsabilidad Civil Profesional Tecnológica", 620.00),
        ("Cobertura de Ciberriesgos y Pérdida de Datos", 410.00)
    ]
}

def generate_invoice_data(seq_id: int) -> Dict[str, Any]:
    supp = SUPPLIERS[seq_id % len(SUPPLIERS)]
    inv_num = f"FAC-2026-{1000 + seq_id}"
    inv_date = f"2026-10-{(seq_id % 28) + 1:02d}"
    due_date = f"2026-11-{(seq_id % 28) + 1:02d}"
    
    currency = supp.get("currency", "EUR")
    default_vat = supp.get("vat_rate", 21.0)
    retention_rate = supp.get("retention", 0.0)
    
    available_items = ITEMS_BY_TYPE.get(supp["type"], [("Servicio General", 100.00)])
    num_items = random.randint(1, min(4, len(available_items)))
    chosen_items = random.sample(available_items, num_items)
    
    items = []
    subtotal = 0.0
    for idx, (concept, unit_price) in enumerate(chosen_items):
        qty = random.randint(1, 3)
        base = round(qty * unit_price, 2)
        subtotal = round(subtotal + base, 2)
        items.append({
            "concept": concept,
            "quantity": qty,
            "unit_price": unit_price,
            "base_amount": base,
            "tax_rate": default_vat
        })
        
    tax_total = round(subtotal * (default_vat / 100.0), 2)
    retention_total = round(subtotal * (retention_rate / 100.0), 2) if retention_rate > 0 else 0.0
    grand_total = round(subtotal + tax_total - retention_total, 2)
    
    return {
        "invoice_number": inv_num,
        "date": inv_date,
        "due_date": due_date,
        "supplier_name": supp["name"],
        "supplier_tax_id": supp["tax_id"],
        "customer_name": "SplitLedger Labs S.L.",
        "customer_tax_id": "ESB87219034",
        "currency": currency,
        "items": items,
        "subtotal": subtotal,
        "tax_rate": default_vat,
        "tax_total": tax_total,
        "retention_rate": retention_rate,
        "retention_total": retention_total,
        "grand_total": grand_total
    }

def create_facturae_xml(data: Dict[str, Any], filepath: str):
    import html
    items_xml = ""
    for it in data["items"]:
        c_esc = html.escape(str(it['concept']))
        items_xml += f"""
        <InvoiceLine>
          <ItemDescription>{c_esc}</ItemDescription>
          <Quantity>{it['quantity']}</Quantity>
          <UnitPriceWithoutTax>{it['unit_price']:.2f}</UnitPriceWithoutTax>
          <TotalCost>{it['base_amount']:.2f}</TotalCost>
          <TaxesOutputs>
            <Tax>
              <TaxTypeCode>01</TaxTypeCode>
              <TaxRate>{it['tax_rate']:.2f}</TaxRate>
              <TaxableBase><TotalAmount>{it['base_amount']:.2f}</TotalAmount></TaxableBase>
              <TaxAmount><TotalAmount>{(it['base_amount'] * it['tax_rate'] / 100.0):.2f}</TotalAmount></TaxAmount>
            </Tax>
          </TaxesOutputs>
        </InvoiceLine>"""

    retention_xml = ""
    if data["retention_total"] > 0:
        retention_xml = f"""
        <TaxesWithheld>
          <Tax>
            <TaxTypeCode>04</TaxTypeCode>
            <TaxRate>{data['retention_rate']:.2f}</TaxRate>
            <TaxableBase><TotalAmount>{data['subtotal']:.2f}</TotalAmount></TaxableBase>
            <TaxAmount><TotalAmount>{data['retention_total']:.2f}</TotalAmount></TaxAmount>
          </Tax>
        </TaxesWithheld>"""

    supp_esc = html.escape(str(data['supplier_name']))
    cust_esc = html.escape(str(data['customer_name']))

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<fe:Facturae xmlns:fe="http://www.facturae.es/Facturae/2014/v3.2.1/Facturae">
  <FileHeader>
    <SchemaVersion>3.2.1</SchemaVersion>
    <Modality>I</Modality>
    <InvoiceIssuerType>EM</InvoiceIssuerType>
  </FileHeader>
  <Parties>
    <SellerParty>
      <TaxIdentification>
        <PersonTypeCode>J</PersonTypeCode>
        <ResidenceTypeCode>R</ResidenceTypeCode>
        <TaxIdentificationNumber>{data['supplier_tax_id']}</TaxIdentificationNumber>
      </TaxIdentification>
      <LegalEntity>
        <CorporateName>{supp_esc}</CorporateName>
      </LegalEntity>
    </SellerParty>
    <BuyerParty>
      <TaxIdentification>
        <PersonTypeCode>J</PersonTypeCode>
        <ResidenceTypeCode>R</ResidenceTypeCode>
        <TaxIdentificationNumber>{data['customer_tax_id']}</TaxIdentificationNumber>
      </TaxIdentification>
      <LegalEntity>
        <CorporateName>{cust_esc}</CorporateName>
      </LegalEntity>
    </BuyerParty>
  </Parties>
  <Invoices>
    <Invoice>
      <InvoiceHeader>
        <InvoiceNumber>{data['invoice_number']}</InvoiceNumber>
        <InvoiceDocumentType>FC</InvoiceDocumentType>
        <InvoiceClass>OO</InvoiceClass>
      </InvoiceHeader>
      <InvoiceIssueData>
        <IssueDate>{data['date']}</IssueDate>
        <InvoiceCurrencyCode>{data['currency']}</InvoiceCurrencyCode>
      </InvoiceIssueData>
      <TaxesOutputs>
        <Tax>
          <TaxTypeCode>01</TaxTypeCode>
          <TaxRate>{data['tax_rate']:.2f}</TaxRate>
          <TaxableBase><TotalAmount>{data['subtotal']:.2f}</TotalAmount></TaxableBase>
          <TaxAmount><TotalAmount>{data['tax_total']:.2f}</TotalAmount></TaxAmount>
        </Tax>
      </TaxesOutputs>
      {retention_xml}
      <InvoiceTotals>
        <TotalGrossAmount>{data['subtotal']:.2f}</TotalGrossAmount>
        <TotalGrossAmountBeforeTaxes>{data['subtotal']:.2f}</TotalGrossAmountBeforeTaxes>
        <TotalTaxOutputs>{data['tax_total']:.2f}</TotalTaxOutputs>
        <TotalTaxesWithheld>{data['retention_total']:.2f}</TotalTaxesWithheld>
        <InvoiceTotal>{data['grand_total']:.2f}</InvoiceTotal>
      </InvoiceTotals>
      <Items>{items_xml}
      </Items>
    </Invoice>
  </Invoices>
</fe:Facturae>"""
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(xml.strip())

def create_xlsx(data: Dict[str, Any], filepath: str):
    shared_strings = [
        "FACTURA MERCANTIL", "Nº Factura", data["invoice_number"],
        "Proveedor", data["supplier_name"], "NIF", data["supplier_tax_id"],
        "Cliente", data["customer_name"], "Fecha", data["date"],
        "Concepto", "Cantidad", "Precio", "Base", "IVA", "Total"
    ]
    for it in data["items"]:
        shared_strings.append(it["concept"])
        
    import html
    sst_entries = "".join([f"<si><t>{html.escape(str(s))}</t></si>" for s in shared_strings])
    sst_xml = f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="{len(shared_strings)}" uniqueCount="{len(shared_strings)}">{sst_entries}</sst>'
    
    rows_xml = f"""
    <row r="1"><c r="A1" t="s"><v>0</v></c></row>
    <row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2" t="s"><v>2</v></c><c r="C2" t="s"><v>9</v></c><c r="D2" t="s"><v>10</v></c></row>
    <row r="3"><c r="A3" t="s"><v>3</v></c><c r="B3" t="s"><v>4</v></c><c r="C3" t="s"><v>5</v></c><c r="D3" t="s"><v>6</v></c></row>
    <row r="4"><c r="A4" t="s"><v>7</v></c><c r="B4" t="s"><v>8</v></c></row>
    <row r="6">
      <c r="A6" t="s"><v>11</v></c><c r="B6" t="s"><v>12</v></c><c r="C6" t="s"><v>13</v></c>
      <c r="D6" t="s"><v>14</v></c><c r="E6" t="s"><v>15</v></c><c r="F6" t="s"><v>16</v></c>
    </row>"""
    
    curr_r = 7
    concept_idx = 17
    for it in data["items"]:
        vat_amount = round(it["base_amount"] * it["tax_rate"] / 100.0, 2)
        total_it = round(it["base_amount"] + vat_amount, 2)
        rows_xml += f"""
    <row r="{curr_r}">
      <c r="A{curr_r}" t="s"><v>{concept_idx}</v></c>
      <c r="B{curr_r}"><v>{it['quantity']}</v></c>
      <c r="C{curr_r}"><v>{it['unit_price']:.2f}</v></c>
      <c r="D{curr_r}"><v>{it['base_amount']:.2f}</v></c>
      <c r="E{curr_r}"><v>{vat_amount:.2f}</v></c>
      <c r="F{curr_r}"><v>{total_it:.2f}</v></c>
    </row>"""
        curr_r += 1
        concept_idx += 1
        
    curr_r += 1
    rows_xml += f"""
    <row r="{curr_r}">
      <c r="D{curr_r}"><v>{data['subtotal']:.2f}</v></c>
      <c r="E{curr_r}"><v>{data['tax_total']:.2f}</v></c>
      <c r="F{curr_r}"><v>{data['grand_total']:.2f}</v></c>
    </row>"""

    sheet_xml = f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>{rows_xml}</sheetData></worksheet>'
    content_types = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>'
    rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
    wb_rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>'
    wb = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Factura" sheetId="1" r:id="rId1"/></sheets></workbook>'

    with zipfile.ZipFile(filepath, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types)
        z.writestr("_rels/.rels", rels)
        z.writestr("xl/_rels/workbook.xml.rels", wb_rels)
        z.writestr("xl/workbook.xml", wb)
        z.writestr("xl/sharedStrings.xml", sst_xml)
        z.writestr("xl/worksheets/sheet1.xml", sheet_xml)

def create_csv_tsv(data: Dict[str, Any], filepath: str, is_tsv: bool = False):
    delim = "\t" if is_tsv else ";"
    lines = [
        f"FACTURA{delim}{data['invoice_number']}{delim}FECHA{delim}{data['date']}",
        f"PROVEEDOR{delim}{data['supplier_name']}{delim}NIF{delim}{data['supplier_tax_id']}",
        f"CLIENTE{delim}{data['customer_name']}{delim}NIF{delim}{data['customer_tax_id']}",
        f"DIVISA{delim}{data['currency']}",
        "",
        f"Concepto{delim}Cantidad{delim}PrecioUnitario{delim}BaseImponible{delim}TipoIVA{delim}TotalPartida"
    ]
    for it in data["items"]:
        vat_val = round(it["base_amount"] * it["tax_rate"] / 100.0, 2)
        tot_val = round(it["base_amount"] + vat_val, 2)
        lines.append(f"{it['concept']}{delim}{it['quantity']}{delim}{it['unit_price']:.2f}{delim}{it['base_amount']:.2f}{delim}{it['tax_rate']:.1f}%{delim}{tot_val:.2f}")

    lines.append("")
    lines.append(f"Subtotal{delim}{data['subtotal']:.2f}")
    lines.append(f"Cuota IVA ({data['tax_rate']:.0f}%){delim}{data['tax_total']:.2f}")
    if data["retention_total"] > 0:
        lines.append(f"Retención IRPF ({data['retention_rate']:.0f}%){delim}{data['retention_total']:.2f}")
    lines.append(f"Total Factura{delim}{data['grand_total']:.2f}")

    with open(filepath, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

def create_json(data: Dict[str, Any], filepath: str):
    payload = {
        "document_type": "invoice",
        "header": {
            "invoice_number": data["invoice_number"],
            "issue_date": data["date"],
            "due_date": data["due_date"],
            "currency": data["currency"]
        },
        "issuer": {
            "company_name": data["supplier_name"],
            "tax_id": data["supplier_tax_id"],
            "country": "ES"
        },
        "recipient": {
            "company_name": data["customer_name"],
            "tax_id": data["customer_tax_id"]
        },
        "line_items": [
            {
                "description": it["concept"],
                "quantity": it["quantity"],
                "unit_price": it["unit_price"],
                "taxable_amount": it["base_amount"],
                "tax_rate_percentage": it["tax_rate"],
                "tax_amount": round(it["base_amount"] * it["tax_rate"] / 100.0, 2),
                "total_amount": round(it["base_amount"] * (1 + it["tax_rate"] / 100.0), 2)
            }
            for it in data["items"]
        ],
        "financial_summary": {
            "subtotal_amount": data["subtotal"],
            "tax_total_amount": data["tax_total"],
            "retention_amount": data["retention_total"],
            "grand_total_amount": data["grand_total"]
        }
    }
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

def create_html(data: Dict[str, Any], filepath: str):
    rows = ""
    for it in data["items"]:
        vat_val = round(it["base_amount"] * it["tax_rate"] / 100.0, 2)
        tot_val = round(it["base_amount"] + vat_val, 2)
        rows += f"""
        <tr>
          <td>{it['concept']}</td>
          <td>{it['quantity']}</td>
          <td>{it['unit_price']:.2f} {data['currency']}</td>
          <td>{it['base_amount']:.2f} {data['currency']}</td>
          <td>{it['tax_rate']:.0f}%</td>
          <td>{tot_val:.2f} {data['currency']}</td>
        </tr>"""

    ret_row = ""
    if data["retention_total"] > 0:
        ret_row = f"<tr><th colspan='5' style='text-align:right'>Retención IRPF ({data['retention_rate']:.0f}%):</th><td>-{data['retention_total']:.2f} {data['currency']}</td></tr>"

    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Factura {data['invoice_number']}</title>
  <style>
    body {{ font-family: sans-serif; margin: 30px; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
    th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
    th {{ background-color: #f2f2f2; }}
    .header-box {{ margin-bottom: 20px; }}
  </style>
</head>
<body>
  <div class="header-box">
    <h1>FACTURA OFICIAL</h1>
    <p><strong>Nº Factura:</strong> {data['invoice_number']} | <strong>Fecha:</strong> {data['date']}</p>
    <p><strong>Emisor:</strong> {data['supplier_name']} (NIF/CIF: {data['supplier_tax_id']})</p>
    <p><strong>Cliente:</strong> {data['customer_name']} (NIF/CIF: {data['customer_tax_id']})</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>Concepto</th>
        <th>Cantidad</th>
        <th>Precio Unitario</th>
        <th>Base Imponible</th>
        <th>IVA</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      {rows}
    </tbody>
    <tfoot>
      <tr>
        <th colspan="5" style="text-align:right">Subtotal Base Imponible:</th>
        <td>{data['subtotal']:.2f} {data['currency']}</td>
      </tr>
      <tr>
        <th colspan="5" style="text-align:right">Cuota IVA ({data['tax_rate']:.0f}%):</th>
        <td>{data['tax_total']:.2f} {data['currency']}</td>
      </tr>
      {ret_row}
      <tr style="font-weight: bold; background: #eee;">
        <th colspan="5" style="text-align:right">Total a Pagar:</th>
        <td>{data['grand_total']:.2f} {data['currency']}</td>
      </tr>
    </tfoot>
  </table>
</body>
</html>"""
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(html)

def create_txt(data: Dict[str, Any], filepath: str):
    lines = [
        f"FACTURA: {data['invoice_number']}",
        f"Fecha de Emisión: {data['date']} | Vencimiento: {data['due_date']}",
        f"Proveedor: {data['supplier_name']} | NIF: {data['supplier_tax_id']}",
        f"Cliente: {data['customer_name']} | CIF: {data['customer_tax_id']}",
        f"Moneda: {data['currency']}",
        "",
        "DESGLOSE DE PARTIDAS:"
    ]
    for it in data["items"]:
        vat_val = round(it["base_amount"] * it["tax_rate"] / 100.0, 2)
        tot_val = round(it["base_amount"] + vat_val, 2)
        lines.append(f"- {it['concept']} | Cantidad: {it['quantity']} x {it['unit_price']:.2f} | Base: {it['base_amount']:.2f} | IVA: {vat_val:.2f} | Total: {tot_val:.2f} {data['currency']}")

    lines.append("")
    lines.append(f"Subtotal (Base Imponible): {data['subtotal']:.2f} {data['currency']}")
    lines.append(f"Cuota IVA ({data['tax_rate']:.0f}%): {data['tax_total']:.2f} {data['currency']}")
    if data["retention_total"] > 0:
        lines.append(f"Retención IRPF ({data['retention_rate']:.0f}%): -{data['retention_total']:.2f} {data['currency']}")
    lines.append(f"Total Factura: {data['grand_total']:.2f} {data['currency']}")

    with open(filepath, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

def main():
    total_docs = 150
    print(f"Generando lote heterogéneo de {total_docs} facturas en {OUTPUT_DIR}...")
    
    formats = ["xml", "xlsx", "csv", "tsv", "json", "html", "txt"]
    counts = {fmt: 0 for fmt in formats}
    
    for i in range(1, total_docs + 1):
        data = generate_invoice_data(i)
        fmt = formats[(i - 1) % len(formats)]
        counts[fmt] += 1
        
        filename = f"inv_{i:03d}_{data['invoice_number']}.{fmt}"
        filepath = os.path.join(OUTPUT_DIR, filename)
        
        if fmt == "xml":
            create_facturae_xml(data, filepath)
        elif fmt == "xlsx":
            create_xlsx(data, filepath)
        elif fmt == "csv":
            create_csv_tsv(data, filepath, is_tsv=False)
        elif fmt == "tsv":
            create_csv_tsv(data, filepath, is_tsv=True)
        elif fmt == "json":
            create_json(data, filepath)
        elif fmt == "html":
            create_html(data, filepath)
        elif fmt == "txt":
            create_txt(data, filepath)
            
    print(f"Generación completada con éxito: {total_docs} documentos.")
    for fmt, c in counts.items():
        print(f" - {fmt.upper()}: {c} documentos")

if __name__ == "__main__":
    main()
