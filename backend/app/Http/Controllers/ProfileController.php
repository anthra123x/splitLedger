<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class ProfileController extends Controller
{
    public function show(): JsonResponse
    {
        $user = User::first() ?: new User([
            'name' => 'Auditor Principal',
            'email' => 'auditor@splitledger.io'
        ]);

        $totalInvoices = Invoice::count();
        $totalItems = InvoiceItem::count();
        $totalVolume = round(floatval(Invoice::sum('grand_total')), 2);
        $balancedCount = Invoice::whereIn('status', ['analyzed', 'reconciled'])->count();
        $parityRate = $totalInvoices > 0 ? round(($balancedCount / $totalInvoices) * 100, 1) : 100.0;

        return response()->json([
            'status' => 'success',
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name ?: 'Auditor Principal',
                    'email' => $user->email ?: 'auditor@splitledger.io',
                    'role' => 'Auditor Senior PGC & Conciliador Forense',
                    'organization' => 'SplitLedger Enterprise S.L.',
                    'tax_id' => 'ES-B87654321',
                    'environment' => 'Neon PostgreSQL Serverless (AWS eu-central-1)',
                    'engine_version' => 'SplitLLM 2.4 - High Precision Reasoning Core',
                    'created_at' => $user->created_at ? $user->created_at->toIso8601String() : now()->toIso8601String(),
                ],
                'stats' => [
                    'invoices_audited' => $totalInvoices,
                    'accounting_items' => $totalItems,
                    'total_volume_eur' => $totalVolume,
                    'parity_balance_rate' => $parityRate,
                    'last_audit_at' => Invoice::latest('created_at')->value('created_at') ?: now()->toIso8601String(),
                ],
                'preferences' => [
                    'currency' => 'EUR (€)',
                    'accounting_standard' => 'Plan General Contable Español (PGC 2008)',
                    'auto_reconciliation' => true,
                    'double_entry_tolerance' => '±0.05 €',
                    'export_format' => 'ZIP (CSV + JSON + Documentos Fuente)',
                    'storage_encryption' => 'AES-256'
                ]
            ]
        ]);
    }
}
