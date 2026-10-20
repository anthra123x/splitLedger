<?php

namespace App\Services;

class DoubleEntryParitySolverService
{
    public static function solve(array $header, array $items): array
    {
        $sumBase = 0.0;
        $sumTax = 0.0;
        $sumTotal = 0.0;

        foreach ($items as &$item) {
            $base = floatval($item['base_amount'] ?? 0);
            $taxRate = floatval($item['tax_rate'] ?? 21);
            $taxAmount = isset($item['tax_amount']) ? floatval($item['tax_amount']) : round($base * ($taxRate / 100), 2);
            $total = isset($item['total_amount']) ? floatval($item['total_amount']) : round($base + $taxAmount, 2);

            // If base + tax != total by more than 3 cents, recalculate from tax rate
            if (abs(($base + $taxAmount) - $total) > 0.03) {
                $taxAmount = round($base * ($taxRate / 100), 2);
                $total = round($base + $taxAmount, 2);
            }

            $item['base_amount'] = $base;
            $item['tax_rate'] = $taxRate;
            $item['tax_amount'] = $taxAmount;
            $item['total_amount'] = $total;

            $sumBase += $base;
            $sumTax += $taxAmount;
            $sumTotal += $total;
        }
        unset($item);

        $retentionTotal = floatval($header['retention_total'] ?? 0);
        $surchargeTotal = floatval($header['surcharge_total'] ?? 0);
        $declaredSubtotal = floatval($header['subtotal'] ?? $sumBase);
        $declaredTax = floatval($header['tax_total'] ?? $sumTax);
        $targetGrandTotal = floatval($header['grand_total'] ?? ($declaredSubtotal + $declaredTax + $surchargeTotal - $retentionTotal));

        // Theoretical expected grand total: Subtotal + Tax + Surcharge - Retention
        $expectedGrand = round($declaredSubtotal + $declaredTax + $surchargeTotal - $retentionTotal, 2);
        $delta = round($targetGrandTotal - $expectedGrand, 2);
        $adjusted = false;
        $log = null;

        // Cent-level rounding delta reconciliation (up to 0.08 €)
        if (abs($delta) > 0 && abs($delta) <= 0.08 && count($items) > 0) {
            $maxIdx = 0;
            $maxAmount = -1;
            foreach ($items as $idx => $it) {
                if ($it['total_amount'] > $maxAmount) {
                    $maxAmount = $it['total_amount'];
                    $maxIdx = $idx;
                }
            }

            $items[$maxIdx]['total_amount'] = round($items[$maxIdx]['total_amount'] + $delta, 2);
            $items[$maxIdx]['tax_amount'] = round($items[$maxIdx]['tax_amount'] + $delta, 2);
            $items[$maxIdx]['notes'] = trim(($items[$maxIdx]['notes'] ?? '') . " [Conciliado " . ($delta > 0 ? "+{$delta}" : "{$delta}") . "€]");
            $adjusted = true;
            $log = "Ajuste centesimal de {$delta}€ aplicado a partida #" . ($maxIdx + 1);
            $expectedGrand = $targetGrandTotal;
        }

        $reconciled = (abs($expectedGrand - $targetGrandTotal) <= 0.05);

        return [
            'header' => [
                'subtotal' => round($declaredSubtotal, 2),
                'tax_total' => round($declaredTax + ($adjusted ? $delta : 0), 2),
                'retention_total' => round($retentionTotal, 2),
                'grand_total' => $targetGrandTotal,
                'status' => $reconciled ? 'reconciled' : 'analyzed',
            ],
            'items' => $items,
            'is_balanced' => $reconciled,
            'audit_trail' => $log ?: ($reconciled ? 'Partida doble balanceada: Base + IVA - Retención = Total a Pagar' : 'Discrepancia contable detectada')
        ];
    }
}
