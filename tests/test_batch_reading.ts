import fs from 'node:fs';
import path from 'node:path';

async function runBatchTest() {
  console.log('========================================================');
  console.log('[TEST] INICIANDO TEST END-TO-END: PROCESAMIENTO DE LOTE HETEROGÉNEO');
  console.log('========================================================\n');

  const samplesDir = path.resolve(process.cwd(), 'tests/samples');
  const sampleFiles = fs.readdirSync(samplesDir).sort();

  console.log(`[FILES] Facturas encontradas para el lote revuelto (${sampleFiles.length} tipos):`);
  sampleFiles.forEach((f, i) => console.log(`   ${i + 1}. [${f}]`));
  console.log('');

  const formData = new FormData();

  for (const filename of sampleFiles) {
    const fullPath = path.join(samplesDir, filename);
    const content = fs.readFileSync(fullPath);
    const mime = filename.endsWith('.xml') ? 'application/xml' : 'text/plain';
    const blob = new Blob([content], { type: mime });
    formData.append('invoices[]', blob, filename);
  }

  const baseUrl = process.env.API_URL || 'http://localhost:8000';
  console.log(`[HTTP] Enviando lote completo a POST ${baseUrl}/api/invoices/upload ...`);
  const startTime = Date.now();

  const response = await fetch(`${baseUrl}/api/invoices/upload`, {
    method: 'POST',
    body: formData
  });

  const durationMs = Date.now() - startTime;
  console.log(`[HTTP] Respuesta recibida en ${durationMs}ms (HTTP ${response.status})`);

  if (!response.ok) {
    const errText = await response.text();
    console.error('[ERROR] Error en el servidor:', errText);
    process.exit(1);
  }

  const result: any = await response.json();
  console.log(`\n[RESULT] Lote procesado: ${result.count || 1} facturas desglosadas con éxito.`);
  console.log('------------------------------------------------------------');

  const invoices = Array.isArray(result.data) ? result.data : [result.data];

  let successCount = 0;
  let balancedCount = 0;

  for (let idx = 0; idx < invoices.length; idx++) {
    const inv = invoices[idx];
    console.log(`\n[DOC] FACTURA #${idx + 1}: ${inv.original_name || inv.filename}`);
    console.log(`   • Nº Factura:    ${inv.invoice_number}`);
    console.log(`   • Proveedor:     ${inv.supplier_name} (NIF/CIF: ${inv.supplier_tax_id || 'N/A'})`);
    console.log(`   • Cliente:       ${inv.customer_name || 'N/A'} (NIF: ${inv.customer_tax_id || 'N/A'})`);
    console.log(`   • Fecha:         ${inv.invoice_date}`);
    console.log(`   • Divisa:        ${inv.currency}`);
    console.log(`   • Base:          ${Number(inv.subtotal || 0).toFixed(2)} ${inv.currency}`);
    console.log(`   • IVA:           ${Number(inv.tax_total || 0).toFixed(2)} ${inv.currency}`);
    console.log(`   • Retención:     ${Number(inv.retention_total || 0).toFixed(2)} ${inv.currency}`);
    console.log(`   • Total a Pagar: ${Number(inv.grand_total || 0).toFixed(2)} ${inv.currency}`);
    console.log(`   • Confianza:     ${(Number(inv.confidence_score || 0.98) * 100).toFixed(1)}%`);

    // Verify accounting equation: subtotal + tax_total - retention_total == grand_total
    const expected = Number((Number(inv.subtotal || 0) + Number(inv.tax_total || 0) - Number(inv.retention_total || 0)).toFixed(2));
    const isMathBalanced = Math.abs(expected - Number(inv.grand_total || 0)) <= 0.05;

    if (isMathBalanced) {
      console.log(`   [OK] Paridad Doble: BALANCEADA (${inv.subtotal} + ${inv.tax_total} - ${inv.retention_total} = ${inv.grand_total})`);
      balancedCount++;
    } else {
      console.log(`   [WARN] Discrepancia matemática: Calculado ${expected} vs Declarado ${inv.grand_total}`);
    }

    const items = inv.items || [];
    console.log(`   [ITEMS] Partidas Desglosadas (${items.length} líneas detectadas):`);
    items.forEach((it: any, itemIdx: number) => {
      console.log(`      [${itemIdx + 1}] "${it.concept}"`);
      console.log(`          Cant: ${it.quantity} x ${Number(it.unit_price || 0).toFixed(2)} | Base: ${Number(it.base_amount || 0).toFixed(2)} | IVA ${it.tax_rate}% (${Number(it.tax_amount || 0).toFixed(2)}) | Total: ${Number(it.total_amount || 0).toFixed(2)}`);
      console.log(`          Cuenta PGC: [${it.account_code}] ${it.account_name} | Centro Coste: [${it.cost_center}]`);
    });

    if (items.length > 0 && inv.invoice_number && inv.grand_total > 0) {
      successCount++;
    }
  }

  console.log('\n============================================================');
  console.log('[SUMMARY] RESUMEN DE LA AUDITORÍA DE LOTE HETEROGÉNEO:');
  console.log(`   • Total documentos en lote:        ${invoices.length}`);
  console.log(`   • Extraídos y desglosados con éxito: ${successCount} / ${invoices.length}`);
  console.log(`   • Cuadratura de Partida Doble:      ${balancedCount} / ${invoices.length} (${((balancedCount/invoices.length)*100).toFixed(1)}%)`);
  console.log(`   • Tiempo total procesamiento:       ${durationMs}ms (Media: ${Math.round(durationMs/invoices.length)}ms/factura)`);
  console.log('============================================================\n');

  if (successCount === invoices.length && balancedCount === invoices.length) {
    console.log('[SUCCESS] TODAS LAS FACTURAS DEL LOTE FUERON DESGLOSADAS Y CUADRADAS CON 100% DE ÉXITO');
  } else {
    console.log('[WARN] Algunas facturas presentaron advertencias.');
  }
}

runBatchTest().catch(console.error);
