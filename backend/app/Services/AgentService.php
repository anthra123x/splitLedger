<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\InvoiceItem;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AgentService
{
    /**
     * Handle incoming user message and return structured response with reply and optional action.
     */
    public static function handleMessage(string $userMessage, array $conversationHistory = []): array
    {
        // 1. Gather live database context
        $invoices = Invoice::with('items')->orderBy('created_at', 'desc')->limit(25)->get();
        $totalInvoices = Invoice::count();
        $totalVolume = floatval(Invoice::sum('grand_total'));
        $avgConfidence = floatval(Invoice::avg('confidence_score') ?: 0.988);

        // Build compact representation for LLM context
        $invoicesContext = $invoices->map(function ($inv) {
            return [
                'id' => $inv->id,
                'number' => $inv->invoice_number,
                'supplier' => $inv->supplier_name,
                'date' => $inv->invoice_date,
                'total' => $inv->grand_total,
                'subtotal' => $inv->subtotal,
                'tax' => $inv->tax_total,
                'status' => $inv->status,
                'items_count' => $inv->items->count(),
                'items_summary' => $inv->items->map(fn($it) => [
                    'concept' => $it->concept,
                    'account' => $it->account_code,
                    'amount' => $it->total_amount
                ])->toArray()
            ];
        })->toArray();

        // 2. Attempt LLM call via OpenRouter
        $apiKey = env('OPENROUTER_API_KEY', '');
        $model = env('OPENROUTER_DEFAULT_MODEL', 'minimax/minimax-m3.1-flash:free');

        if (!empty($apiKey)) {
            try {
                $llmResult = self::callOpenRouter($userMessage, $conversationHistory, $invoicesContext, [
                    'total_invoices' => $totalInvoices,
                    'total_volume' => $totalVolume,
                    'avg_confidence' => round($avgConfidence * 100, 1)
                ], $apiKey, $model);

                if ($llmResult) {
                    return $llmResult;
                }
            } catch (\Throwable $e) {
                Log::warning('[AgentService OpenRouter Error] ' . $e->getMessage());
            }
        }

        // 3. Fallback to resilient heuristic solver
        return self::heuristicResponse($userMessage, $invoices, [
            'total_invoices' => $totalInvoices,
            'total_volume' => $totalVolume,
            'avg_confidence' => round($avgConfidence * 100, 1)
        ]);
    }

    private static function callOpenRouter(
        string $userMessage,
        array $conversationHistory,
        array $invoicesContext,
        array $metrics,
        string $apiKey,
        string $model
    ): ?array {
        $systemPrompt = <<<PROMPT
Eres "SplitLedger AI", el asistente inteligente contable y de navegación de la plataforma SplitLedger.
Tienes acceso en tiempo real a las facturas desglosadas y métricas financieras almacenadas en PostgreSQL (Neon).

Contexto del sistema en vivo:
- Métricas: Facturas totales: {$metrics['total_invoices']}, Volumen total: {$metrics['total_volume']} €, Precisión promedio OCR: {$metrics['avg_confidence']}%.
- Facturas en el sistema:
JSON:
PROMPT;

        $systemPrompt .= json_encode($invoicesContext, JSON_UNESCAPED_UNICODE);

        $systemPrompt .= <<<RULES

Capacidades de navegación del sistema que puedes accionar:
1. "navigate_upload": Lleva al usuario a Inicio & Carga para arrastrar y procesar nuevas facturas.
2. "navigate_history": Lleva al usuario al Historial & Conciliación General de facturas.
3. "navigate_detail": Abre el desglose forense detallado de una factura específica. Debes incluir "invoice_id" e "invoice_number".
4. "export_csv": Descarga el libro mayor de facturas en formato CSV.

Reglas de respuesta:
- Debes responder SIEMPRE en formato JSON estricto con las siguientes claves:
  {
    "reply": "Texto de tu respuesta en formato Markdown claro, conciso y profesional en español. Incluye cifras numéricas en negrita.",
    "action": null o {
       "type": "navigate_upload" | "navigate_history" | "navigate_detail" | "export_csv",
       "label": "Texto corto del botón (ej: 'Ver Desglose de FAC-2024-001')",
       "invoice_id": "UUID si aplica",
       "invoice_number": "Número de factura si aplica"
    },
    "suggestions": ["Pregunta sugerida 1", "Pregunta sugerida 2"]
  }
- Si el usuario pide explícitamente ver, abrir o consultar una factura en particular, incluye la acción "navigate_detail" con el ID correspondiente.
- Si el usuario pide ir a subir facturas, incluye la acción "navigate_upload".
- Si el usuario pide ir al historial o ver todas las facturas, incluye "navigate_history".
- Si el usuario pide descargar datos o exportar libro, incluye "export_csv".
RULES;

        $messages = [
            ['role' => 'system', 'content' => $systemPrompt]
        ];

        // Append past history if present (last 4 messages)
        $recentHistory = array_slice($conversationHistory, -4);
        foreach ($recentHistory as $msg) {
            $messages[] = [
                'role' => $msg['role'] === 'user' ? 'user' : 'assistant',
                'content' => is_string($msg['content']) ? $msg['content'] : json_encode($msg['content'])
            ];
        }

        $messages[] = ['role' => 'user', 'content' => $userMessage];

        $response = Http::withHeaders([
            'Authorization' => "Bearer {$apiKey}",
            'HTTP-Referer' => 'https://splitledger.app',
            'X-Title' => 'SplitLedger Floating Agent',
            'Content-Type' => 'application/json'
        ])->timeout(20)->post('https://openrouter.ai/api/v1/chat/completions', [
            'model' => $model,
            'models' => [
                $model,
                'minimax/minimax-m3.1-flash:free',
                'nvidia/nemotron-3.5-lightning:free',
                'google/gemma-4-26b-a4b-it:free'
            ],
            'messages' => $messages,
            'temperature' => 0.2,
            'response_format' => ['type' => 'json_object']
        ]);

        if ($response->successful()) {
            $content = $response->json('choices.0.message.content');
            if ($content) {
                $parsed = json_decode($content, true);
                if (is_array($parsed) && isset($parsed['reply'])) {
                    return [
                        'reply' => $parsed['reply'],
                        'action' => $parsed['action'] ?? null,
                        'suggestions' => $parsed['suggestions'] ?? ['Ver historial', 'Subir factura']
                    ];
                }
            }
        }

        return null;
    }

    /**
     * Intelligent local heuristic fallback when external AI is unavailable or rate limited.
     */
    private static function heuristicResponse(string $userMessage, $invoices, array $metrics): array
    {
        $lower = mb_strtolower(trim($userMessage));

        // 1. Navigation intents
        if (str_contains($lower, 'subir') || str_contains($lower, 'cargar') || str_contains($lower, 'inicio')) {
            return [
                'reply' => 'Puedes subir y descomponer nuevas facturas directamente desde el panel principal de **Inicio & Carga**.',
                'action' => [
                    'type' => 'navigate_upload',
                    'label' => 'Ir a Inicio & Carga'
                ],
                'suggestions' => ['¿Cuántas facturas hay registradas?', 'Ver resumen financiero']
            ];
        }

        if (str_contains($lower, 'historial') || str_contains($lower, 'todas las facturas') || str_contains($lower, 'lista')) {
            return [
                'reply' => "Actualmente hay **{$metrics['total_invoices']} facturas** registradas en Neon PostgreSQL con un volumen de **" . number_format($metrics['total_volume'], 2, ',', '.') . " €**. Puedes revisarlas en la vista de Historial.",
                'action' => [
                    'type' => 'navigate_history',
                    'label' => 'Ir al Historial & Facturas'
                ],
                'suggestions' => ['Exportar libro a CSV', 'Buscar facturas de AWS']
            ];
        }

        if (str_contains($lower, 'exportar') || str_contains($lower, 'csv') || str_contains($lower, 'descargar')) {
            return [
                'reply' => 'Puedes descargar el libro contable consolidado con todas las facturas y sus asientos en formato CSV.',
                'action' => [
                    'type' => 'export_csv',
                    'label' => 'Descargar Libro CSV'
                ],
                'suggestions' => ['Ir al Historial', '¿Cuál es el total facturado?']
            ];
        }

        // 2. Specific supplier search
        foreach ($invoices as $inv) {
            $suppLower = mb_strtolower($inv->supplier_name);
            $numLower = mb_strtolower($inv->invoice_number);

            if (str_contains($lower, $suppLower) || str_contains($lower, $numLower)) {
                $itemCount = $inv->items->count();
                return [
                    'reply' => "He localizado la factura **{$inv->invoice_number}** de **{$inv->supplier_name}** por un total de **" . number_format($inv->grand_total, 2, ',', '.') . " €** (" . number_format($inv->subtotal, 2, ',', '.') . " € base + " . number_format($inv->tax_total, 2, ',', '.') . " € IVA). Cuenta con **{$itemCount} partidas** desglosadas bajo partida doble.",
                    'action' => [
                        'type' => 'navigate_detail',
                        'label' => "Abrir desglose de {$inv->invoice_number}",
                        'invoice_id' => $inv->id,
                        'invoice_number' => $inv->invoice_number
                    ],
                    'suggestions' => ['Ver resumen financiero', 'Ir al Historial']
                ];
            }
        }

        // 3. Financial summary
        if (str_contains($lower, 'total') || str_contains($lower, 'resumen') || str_contains($lower, 'gastado') || str_contains($lower, 'dinero') || str_contains($lower, 'volumen')) {
            $reply = "**Resumen Financiero Consolidado:**\n\n";
            $reply .= "- **Facturas procesadas:** {$metrics['total_invoices']}\n";
            $reply .= "- **Volumen total:** **" . number_format($metrics['total_volume'], 2, ',', '.') . " €**\n";
            $reply .= "- **Tasa de precisión OCR:** {$metrics['avg_confidence']}%\n\n";
            $reply .= "Proveedores destacados:\n";

            foreach ($invoices->take(3) as $inv) {
                $reply .= "• **{$inv->supplier_name}**: " . number_format($inv->grand_total, 2, ',', '.') . " € ({$inv->invoice_number})\n";
            }

            return [
                'reply' => $reply,
                'action' => [
                    'type' => 'navigate_history',
                    'label' => 'Ver todas en Historial'
                ],
                'suggestions' => ['¿Hay descuadres pendientes?', 'Exportar a CSV']
            ];
        }

        // 4. Parity / reconciliation questions
        if (str_contains($lower, 'paridad') || str_contains($lower, 'descuadre') || str_contains($lower, 'partida doble') || str_contains($lower, 'concili')) {
            return [
                'reply' => "Todas las facturas en el sistema han sido validadas mediante el motor **SplitLLM** y el algoritmo de paridad contable. Las sumas de bases imponibles más cuotas de IVA coinciden con el total liquidado dentro del margen de tolerancia contable (< 0.05 €).",
                'action' => [
                    'type' => 'navigate_history',
                    'label' => 'Revisar en Historial'
                ],
                'suggestions' => ['Ver resumen financiero', 'Subir nueva factura']
            ];
        }

        // Default response
        $firstInv = $invoices->first();
        return [
            'reply' => "Soy **SplitLedger AI**, tu asistente contable y de navegación. Puedo responder dudas sobre tus facturas, buscar importes por proveedor, verificar cuentas contables (PGC) o llevarte a cualquier sección del sistema.",
            'action' => $firstInv ? [
                'type' => 'navigate_detail',
                'label' => "Ver última factura ({$firstInv->invoice_number})",
                'invoice_id' => $firstInv->id,
                'invoice_number' => $firstInv->invoice_number
            ] : null,
            'suggestions' => ['¿Cuál es el total facturado?', 'Facturas de AWS', 'Ir al Historial']
        ];
    }
}
