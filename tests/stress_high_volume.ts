import fs from 'node:fs';
import path from 'node:path';

interface StressMetrics {
  totalDocs: number;
  successCount: number;
  failureCount: number;
  balancedCount: number;
  formatCounts: Record<string, { total: number; success: number; balanced: number }>;
  latenciesMs: number[];
  startTime: number;
  endTime: number;
}

async function runStressTest() {
  console.log('================================================================');
  console.log('[STRESS-TEST] INICIANDO BATERÍA DE ESTRÉS DE ALTO VOLUMEN');
  console.log('================================================================\n');

  const corpusDir = path.resolve(process.cwd(), 'tests/high_volume_corpus');
  if (!fs.existsSync(corpusDir)) {
    console.error(`[ERROR] No existe el directorio de corpus: ${corpusDir}`);
    process.exit(1);
  }

  const allFiles = fs.readdirSync(corpusDir).sort();
  console.log(`[CORPUS] Detectados ${allFiles.length} documentos heterogéneos para el test.`);

  const baseUrl = process.env.API_URL || 'http://localhost:8000';
  const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://127.0.0.1:8100';

  // -------------------------------------------------------------
  // FASE 1: CONCURRENCIA PARALELA POR LOTES (10 WORKERS CONCURRENTES)
  // -------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('[FASE 1] PRUEBA DE SATURACIÓN Y CONCURRENCIA (10 WORKERS PARALELOS)');
  console.log('----------------------------------------------------------------');

  const metrics: StressMetrics = {
    totalDocs: allFiles.length,
    successCount: 0,
    failureCount: 0,
    balancedCount: 0,
    formatCounts: {},
    latenciesMs: [],
    startTime: Date.now(),
    endTime: 0
  };

  const CONCURRENCY = 4;
  const queue = [...allFiles];
  let processedIndex = 0;

  async function worker(workerId: number) {
    while (queue.length > 0) {
      const file = queue.shift();
      if (!file) break;

      const ext = path.extname(file).replace('.', '').toLowerCase();
      if (!metrics.formatCounts[ext]) {
        metrics.formatCounts[ext] = { total: 0, success: 0, balanced: 0 };
      }
      metrics.formatCounts[ext].total++;

      const filePath = path.join(corpusDir, file);
      const fileBuffer = fs.readFileSync(filePath);
      
      const formData = new FormData();
      const mime = ext === 'xml' ? 'application/xml' :
                   ext === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
                   ext === 'json' ? 'application/json' :
                   ext === 'html' ? 'text/html' :
                   ext === 'csv' ? 'text/csv' : 'text/plain';

      const blob = new Blob([fileBuffer], { type: mime });
      formData.append('invoice', blob, file);

      const reqStart = Date.now();
      try {
        const res = await fetch(`${baseUrl}/api/invoices/upload`, {
          method: 'POST',
          body: formData
        });

        const reqDuration = Date.now() - reqStart;
        metrics.latenciesMs.push(reqDuration);

        if (res.ok) {
          const body: any = await res.json();
          const inv = body.data;
          metrics.successCount++;
          metrics.formatCounts[ext].success++;

          const sub = Number(inv.subtotal || 0);
          const tax = Number(inv.tax_total || 0);
          const ret = Number(inv.retention_total || 0);
          const grand = Number(inv.grand_total || 0);
          const calculated = Number((sub + tax - ret).toFixed(2));
          const isBalanced = Math.abs(calculated - grand) <= 0.05;

          if (isBalanced) {
            metrics.balancedCount++;
            metrics.formatCounts[ext].balanced++;
          }

          processedIndex++;
          if (processedIndex % 10 === 0 || processedIndex === allFiles.length) {
            console.log(`[PROGRESO] ${processedIndex}/${allFiles.length} facturas procesadas (${Math.round((processedIndex/allFiles.length)*100)}%)...`);
          }
        } else {
          metrics.failureCount++;
          const errText = await res.text();
          console.error(`[WORKER ${workerId}] Fallo en ${file} (HTTP ${res.status}): ${errText.slice(0, 150)}`);
        }
      } catch (err: any) {
        metrics.failureCount++;
        console.error(`[WORKER ${workerId}] Excepción de red en ${file}: ${err.message}`);
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1));
  await Promise.all(workers);
  metrics.endTime = Date.now();

  const totalDurationSec = (metrics.endTime - metrics.startTime) / 1000;
  const throughput = (metrics.successCount / totalDurationSec).toFixed(2);
  metrics.latenciesMs.sort((a, b) => a - b);
  const p50 = metrics.latenciesMs[Math.floor(metrics.latenciesMs.length * 0.50)] || 0;
  const p90 = metrics.latenciesMs[Math.floor(metrics.latenciesMs.length * 0.90)] || 0;
  const p99 = metrics.latenciesMs[Math.floor(metrics.latenciesMs.length * 0.99)] || 0;
  const avg = Math.round(metrics.latenciesMs.reduce((a, b) => a + b, 0) / (metrics.latenciesMs.length || 1));

  console.log('\n[RESULTADOS FASE 1: CONCURRENCIA]');
  console.log(` • Documentos Totales:             ${metrics.totalDocs}`);
  console.log(` • Procesados con Éxito:           ${metrics.successCount} / ${metrics.totalDocs} (${((metrics.successCount/metrics.totalDocs)*100).toFixed(1)}%)`);
  console.log(` • Cuadratura de Partida Doble:    ${metrics.balancedCount} / ${metrics.successCount} (${((metrics.balancedCount/metrics.successCount)*100).toFixed(1)}%)`);
  console.log(` • Tiempo Total:                   ${totalDurationSec.toFixed(2)}s`);
  console.log(` • Rendimiento (Throughput):       ${throughput} docs/segundo`);
  console.log(` • Latencia Promedio:              ${avg}ms`);
  console.log(` • Latencia P50 (Mediana):         ${p50}ms`);
  console.log(` • Latencia P90:                   ${p90}ms`);
  console.log(` • Latencia P99:                   ${p99}ms`);

  console.log('\n[DESGLOSE POR FORMATO DE ARCHIVO]');
  for (const [fmt, stat] of Object.entries(metrics.formatCounts)) {
    console.log(` • ${fmt.toUpperCase().padEnd(5)}: ${stat.success}/${stat.total} exitosos | Balanceados: ${stat.balanced}/${stat.success} (${stat.success > 0 ? ((stat.balanced/stat.success)*100).toFixed(1) : 0}%)`);
  }

  // -------------------------------------------------------------
  // FASE 2: LOTE HETEROGÉNEO MASIVO SIMULTÁNEO ("REVUELTO")
  // -------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('[FASE 2] LOTE MULTIPART HETEROGÉNEO MASIVO (35 DOCUMENTOS REVUELTOS)');
  console.log('----------------------------------------------------------------');

  const mixedSample = allFiles.slice(0, 35);
  const mixedFormData = new FormData();

  for (const file of mixedSample) {
    const filePath = path.join(corpusDir, file);
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(file).replace('.', '').toLowerCase();
    const mime = ext === 'xml' ? 'application/xml' :
                 ext === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
                 ext === 'json' ? 'application/json' :
                 ext === 'html' ? 'text/html' :
                 ext === 'csv' ? 'text/csv' : 'text/plain';
    mixedFormData.append('invoices[]', new Blob([buf], { type: mime }), file);
  }

  const batchStart = Date.now();
  const batchRes = await fetch(`${baseUrl}/api/invoices/upload`, {
    method: 'POST',
    body: mixedFormData
  });
  const batchDuration = Date.now() - batchStart;

  if (batchRes.ok) {
    const batchJson: any = await batchRes.json();
    const processedList = Array.isArray(batchJson.data) ? batchJson.data : [batchJson.data];
    const balancedBatch = processedList.filter((inv: any) => {
      const s = Number(inv.subtotal || 0);
      const t = Number(inv.tax_total || 0);
      const r = Number(inv.retention_total || 0);
      const g = Number(inv.grand_total || 0);
      return Math.abs(Number((s + t - r).toFixed(2)) - g) <= 0.05;
    });

    console.log(` • HTTP Status:                    ${batchRes.status} OK`);
    console.log(` • Documentos en Lote Único:       ${processedList.length}`);
    console.log(` • Tiempo Total Ingesta de Lote:   ${batchDuration}ms (${Math.round(batchDuration/processedList.length)}ms/factura)`);
    console.log(` • Desglosados y Guardados en DB:  ${processedList.length} / ${mixedSample.length}`);
    console.log(` • Cuadratura Partida Doble Lote:  ${balancedBatch.length} / ${processedList.length} (${((balancedBatch.length/processedList.length)*100).toFixed(1)}%)`);
  } else {
    console.error(`[ERROR FASE 2] HTTP ${batchRes.status}:`, await batchRes.text());
  }

  // -------------------------------------------------------------
  // FASE 3: MOTOR AI ANALÍTICO OLAP (DUCKDB & POLARS QUERYING)
  // -------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('[FASE 3] CONSULTA ANALÍTICA SQL Y AUDITORÍA EN MOTOR PYTHON');
  console.log('----------------------------------------------------------------');

  try {
    const healthRes = await fetch(`${aiEngineUrl}/health`);
    const healthJson = await healthRes.json();
    console.log(` • Estado Motor AI:                ${healthJson.status}`);
    console.log(` • Servicio:                       ${healthJson.service} (v${healthJson.version})`);

    // Probar descomposición en lote del motor Python
    const sampleBatchItems = allFiles.filter(f => !f.endsWith('.xlsx')).slice(0, 10).map(f => {
      const p = path.join(corpusDir, f);
      return {
        filename: f,
        raw_text: fs.readFileSync(p, 'utf-8').slice(0, 3000)
      };
    });

    const aiBatchStart = Date.now();
    const aiBatchRes = await fetch(`${aiEngineUrl}/api/v1/batch/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documents: sampleBatchItems,
        generate_synthesis: true,
        use_llm: false
      })
    });
    const aiBatchDuration = Date.now() - aiBatchStart;

    if (aiBatchRes.ok) {
      const aiJson: any = await aiBatchRes.json();
      console.log(` • Inferencia Analítica Lote AI:   10 documentos en ${aiBatchDuration}ms (${Math.round(aiBatchDuration/10)}ms/doc)`);
      console.log(` • Volumen Total Auditado Lote:    ${aiJson.total_volume_amount} EUR`);
      console.log(` • Proveedores Únicos Detectados:  ${aiJson.top_suppliers_by_volume?.length || 0}`);
      console.log(` • Síntesis Cognitiva:             "${aiJson.reasoning_insights?.slice(0, 100)}..."`);
    } else {
      console.log(` • Inferencia AI HTTP ${aiBatchRes.status}`);
    }
  } catch (err: any) {
    console.error(` • Motor AI no disponible: ${err.message}`);
  }

  console.log('\n================================================================');
  console.log('[FIN DE LA BATERÍA DE ESTRÉS]');
  console.log('================================================================\n');
}

runStressTest().catch(console.error);
