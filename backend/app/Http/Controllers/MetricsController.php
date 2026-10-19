<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\InvoiceItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class MetricsController extends Controller
{
    public function summary(): JsonResponse
    {
        $data = Cache::remember('metrics_summary_v2', 30, function () {
            $stats = Invoice::selectRaw('
                COUNT(*) as total_invoices,
                COALESCE(SUM(grand_total), 0) as reconciled_volume,
                COALESCE(AVG(confidence_score), 0.988) as avg_confidence
            ')->first();

            $totalItems = InvoiceItem::count();
            $avgConf = floatval($stats->avg_confidence ?? 0.988);

            return [
                'total_invoices' => intval($stats->total_invoices ?? 0),
                'reconciled_volume' => round(floatval($stats->reconciled_volume ?? 0), 2),
                'total_items' => intval($totalItems),
                'avg_confidence' => number_format($avgConf * 100, 1, '.', '')
            ];
        });

        return response()->json([
            'status' => 'success',
            'data' => $data
        ]);
    }
}
