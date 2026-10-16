<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\InvoiceItem;
use Illuminate\Http\JsonResponse;

class MetricsController extends Controller
{
    public function summary(): JsonResponse
    {
        $totalInvoices = Invoice::count();
        $reconciledVolume = floatval(Invoice::sum('grand_total'));
        $totalItems = InvoiceItem::count();
        $avgConfidence = floatval(Invoice::avg('confidence_score') ?: 0.988);

        return response()->json([
            'status' => 'success',
            'data' => [
                'total_invoices' => $totalInvoices,
                'reconciled_volume' => round($reconciledVolume, 2),
                'total_items' => $totalItems,
                'avg_confidence' => number_format($avgConfidence * 100, 1, '.', '')
            ]
        ]);
    }
}
