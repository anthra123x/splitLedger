<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Services\CoactiveInterestCalculatorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CoactiveDebtController extends Controller
{
    public function __construct(
        protected CoactiveInterestCalculatorService $calculatorService
    ) {}

    /**
     * Retrieve official historical interest rate tables.
     */
    public function getRates(Request $request): JsonResponse
    {
        $regime = $request->query('regime');
        $rates = $this->calculatorService->getHistoricalRates($regime);

        return response()->json([
            'status' => 'success',
            'data' => $rates,
        ]);
    }

    /**
     * Calculate moratory interest on-demand.
     */
    public function calculate(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'principal' => 'required|numeric|min:0',
            'due_date' => 'required|date',
            'calculation_date' => 'nullable|date',
            'regime' => 'nullable|string|in:dian_superfinanciera,interes_demora_tributario',
            'penalty_percentage' => 'nullable|numeric|min:0|max:100',
            'costs_percentage' => 'nullable|numeric|min:0|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'errors' => $validator->errors(),
            ], 422);
        }

        $validated = $validator->validated();

        $result = $this->calculatorService->calculateInterest(
            principal: (float) $validated['principal'],
            dueDate: (string) $validated['due_date'],
            calculationDate: $validated['calculation_date'] ?? null,
            regime: $validated['regime'] ?? 'dian_superfinanciera',
            penaltyPercentage: isset($validated['penalty_percentage']) ? (float) $validated['penalty_percentage'] : 5.0,
            costsPercentage: isset($validated['costs_percentage']) ? (float) $validated['costs_percentage'] : 3.0
        );

        return response()->json([
            'status' => 'success',
            'data' => $result,
        ]);
    }

    /**
     * Recalculate and persist official interest for a specific invoice in the Neon DB.
     */
    public function recalculateForInvoice(Request $request, string $id): JsonResponse
    {
        $invoice = Invoice::find($id);
        if (!$invoice) {
            return response()->json([
                'status' => 'error',
                'message' => 'Factura no encontrada',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'calculation_date' => 'nullable|date',
            'regime' => 'nullable|string|in:dian_superfinanciera,interes_demora_tributario',
            'penalty_percentage' => 'nullable|numeric|min:0|max:100',
            'costs_percentage' => 'nullable|numeric|min:0|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'errors' => $validator->errors(),
            ], 422);
        }

        $validated = $validator->validated();

        $meta = $invoice->extra_metadata ?? [];
        $coactive = $meta['coactive'] ?? [];

        $subtotal = (float) ($invoice->subtotal ?? 0);
        $grandTotal = (float) ($invoice->grand_total ?? 0);

        $principal = (float) ($coactive['principal_amount'] ?? ($subtotal > 0 ? $subtotal : round($grandTotal * 0.70, 2)));
        $dueDate = $invoice->due_date ?: ($invoice->invoice_date ?: date('Y-m-d', strtotime('-60 days')));

        $liquidation = $this->calculatorService->calculateInterest(
            principal: $principal,
            dueDate: $dueDate,
            calculationDate: $validated['calculation_date'] ?? null,
            regime: $validated['regime'] ?? ($coactive['regime'] ?? 'dian_superfinanciera'),
            penaltyPercentage: isset($validated['penalty_percentage']) ? (float) $validated['penalty_percentage'] : 5.0,
            costsPercentage: isset($validated['costs_percentage']) ? (float) $validated['costs_percentage'] : 3.0
        );

        // Update coactive metadata
        $coactive['principal_amount'] = $liquidation['principal_amount'];
        $coactive['interest_amount'] = $liquidation['interest_amount'];
        $coactive['penalty_amount'] = $liquidation['penalty_amount'];
        $coactive['costs_amount'] = $liquidation['costs_amount'];
        $coactive['regime'] = $liquidation['regime'];
        $coactive['days_in_arrears'] = $liquidation['days_in_arrears'];
        $coactive['weighted_annual_rate'] = $liquidation['weighted_annual_rate'];
        $coactive['liquidation_date'] = $liquidation['calculation_date'];
        $coactive['last_action_date'] = date('Y-m-d');
        $coactive['tranches'] = $liquidation['tranches'];
        $coactive['legal_framework'] = $liquidation['legal_framework'];

        $meta['coactive'] = $coactive;
        $invoice->extra_metadata = $meta;

        // Optionally update grand_total if debt total is synchronized
        $invoice->save();

        return response()->json([
            'status' => 'success',
            'message' => 'Intereses de mora liquidados y actualizados con éxito',
            'data' => [
                'invoice_id' => $invoice->id,
                'liquidation' => $liquidation,
                'coactive' => $coactive,
            ],
        ]);
    }
}
