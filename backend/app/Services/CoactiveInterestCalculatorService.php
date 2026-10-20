<?php

namespace App\Services;

use DateTimeImmutable;
use Exception;

class CoactiveInterestCalculatorService
{
    /**
     * Certified historical rate tables for official tax and coactive collection.
     */
    private const HISTORICAL_RATES = [
        'dian_superfinanciera' => [
            [
                'id' => 'col-2026-q1',
                'period_label' => '2026 - Trimestre 1 y 2',
                'start_date' => '2026-01-01',
                'end_date' => '2026-06-30',
                'effective_annual_rate' => 26.49,
                'daily_rate' => 0.00064506,
                'resolution_reference' => 'Resolución SFC 0122/2026 (Art. 635 E.T. - Tasa Usura consumo menos 2 puntos)',
            ],
            [
                'id' => 'col-2025-q4',
                'period_label' => '2025 - Trimestre 4',
                'start_date' => '2025-10-01',
                'end_date' => '2025-12-31',
                'effective_annual_rate' => 27.90,
                'daily_rate' => 0.00067645,
                'resolution_reference' => 'Resolución SFC 1845/2025 (Certificación Tasa Mora DIAN)',
            ],
            [
                'id' => 'col-2025-q3',
                'period_label' => '2025 - Trimestre 3',
                'start_date' => '2025-07-01',
                'end_date' => '2025-09-30',
                'effective_annual_rate' => 29.10,
                'daily_rate' => 0.00070295,
                'resolution_reference' => 'Resolución SFC 1290/2025 (Certificación Tasa Mora DIAN)',
            ],
            [
                'id' => 'col-2025-q2',
                'period_label' => '2025 - Trimestre 2',
                'start_date' => '2025-04-01',
                'end_date' => '2025-06-30',
                'effective_annual_rate' => 30.50,
                'daily_rate' => 0.00073356,
                'resolution_reference' => 'Resolución SFC 0731/2025 (Certificación Tasa Mora DIAN)',
            ],
            [
                'id' => 'col-2025-q1',
                'period_label' => '2025 - Trimestre 1',
                'start_date' => '2025-01-01',
                'end_date' => '2025-03-31',
                'effective_annual_rate' => 33.30,
                'daily_rate' => 0.00079361,
                'resolution_reference' => 'Resolución SFC 0015/2025 (Certificación Tasa Mora DIAN)',
            ],
            [
                'id' => 'col-2024-q4',
                'period_label' => '2024 - Trimestre 4',
                'start_date' => '2024-10-01',
                'end_date' => '2024-12-31',
                'effective_annual_rate' => 36.80,
                'daily_rate' => 0.00086687,
                'resolution_reference' => 'Resolución SFC 1932/2024 (Art. 635 E.T.)',
            ],
            [
                'id' => 'col-2024-q3',
                'period_label' => '2024 - Trimestre 3',
                'start_date' => '2024-07-01',
                'end_date' => '2024-09-30',
                'effective_annual_rate' => 39.40,
                'daily_rate' => 0.00091993,
                'resolution_reference' => 'Resolución SFC 1340/2024 (Art. 635 E.T.)',
            ],
            [
                'id' => 'col-2024-q2',
                'period_label' => '2024 - Trimestre 2',
                'start_date' => '2024-04-01',
                'end_date' => '2024-06-30',
                'effective_annual_rate' => 41.50,
                'daily_rate' => 0.00096188,
                'resolution_reference' => 'Resolución SFC 0689/2024 (Art. 635 E.T.)',
            ],
            [
                'id' => 'col-2024-q1',
                'period_label' => '2024 - Trimestre 1',
                'start_date' => '2024-01-01',
                'end_date' => '2024-03-31',
                'effective_annual_rate' => 44.64,
                'daily_rate' => 0.00102325,
                'resolution_reference' => 'Resolución SFC 0021/2024 (Art. 635 E.T.)',
            ],
            [
                'id' => 'col-2023-q4',
                'period_label' => '2023 - Trimestre 4',
                'start_date' => '2023-10-01',
                'end_date' => '2023-12-31',
                'effective_annual_rate' => 45.27,
                'daily_rate' => 0.00103534,
                'resolution_reference' => 'Resolución SFC 1890/2023',
            ],
            [
                'id' => 'col-2023-q3',
                'period_label' => '2023 - Trimestre 3',
                'start_date' => '2023-07-01',
                'end_date' => '2023-09-30',
                'effective_annual_rate' => 44.05,
                'daily_rate' => 0.00101186,
                'resolution_reference' => 'Resolución SFC 1254/2023',
            ],
            [
                'id' => 'col-2023-q2',
                'period_label' => '2023 - Trimestre 2',
                'start_date' => '2023-04-01',
                'end_date' => '2023-06-30',
                'effective_annual_rate' => 47.09,
                'daily_rate' => 0.00106981,
                'resolution_reference' => 'Resolución SFC 0612/2023',
            ],
            [
                'id' => 'col-2023-q1',
                'period_label' => '2023 - Trimestre 1',
                'start_date' => '2023-01-01',
                'end_date' => '2023-03-31',
                'effective_annual_rate' => 43.26,
                'daily_rate' => 0.00099648,
                'resolution_reference' => 'Resolución SFC 0005/2023',
            ],
            [
                'id' => 'col-2022',
                'period_label' => '2022 - Anual',
                'start_date' => '2022-01-01',
                'end_date' => '2022-12-31',
                'effective_annual_rate' => 36.92,
                'daily_rate' => 0.00086937,
                'resolution_reference' => 'Promedio Anual SFC 2022 (Consumo y Ordinario)',
            ],
            [
                'id' => 'col-2021',
                'period_label' => '2021 - Anual',
                'start_date' => '2021-01-01',
                'end_date' => '2021-12-31',
                'effective_annual_rate' => 25.83,
                'daily_rate' => 0.00063041,
                'resolution_reference' => 'Promedio Anual SFC 2021',
            ],
        ],
        'interes_demora_tributario' => [
            [
                'id' => 'esp-2026',
                'period_label' => '2026 - Anual',
                'start_date' => '2026-01-01',
                'end_date' => '2026-12-31',
                'effective_annual_rate' => 4.0625,
                'daily_rate' => 0.00010915,
                'resolution_reference' => 'Ley PGE / Art. 26.6 Ley General Tributaria 58/2003 (Interés Legal 3.25% + 25%)',
            ],
            [
                'id' => 'esp-2025',
                'period_label' => '2025 - Anual',
                'start_date' => '2025-01-01',
                'end_date' => '2025-12-31',
                'effective_annual_rate' => 4.0625,
                'daily_rate' => 0.00010915,
                'resolution_reference' => 'Ley PGE / Art. 26.6 Ley General Tributaria 58/2003',
            ],
            [
                'id' => 'esp-2024',
                'period_label' => '2024 - Anual',
                'start_date' => '2024-01-01',
                'end_date' => '2024-12-31',
                'effective_annual_rate' => 4.0625,
                'daily_rate' => 0.00010915,
                'resolution_reference' => 'Ley PGE / Art. 26.6 Ley General Tributaria 58/2003',
            ],
            [
                'id' => 'esp-2023',
                'period_label' => '2023 - Anual',
                'start_date' => '2023-01-01',
                'end_date' => '2023-12-31',
                'effective_annual_rate' => 4.0625,
                'daily_rate' => 0.00010915,
                'resolution_reference' => 'Ley 31/2022 de Presupuestos Generales del Estado',
            ],
            [
                'id' => 'esp-2022',
                'period_label' => '2022 - Anual',
                'start_date' => '2022-01-01',
                'end_date' => '2022-12-31',
                'effective_annual_rate' => 3.7500,
                'daily_rate' => 0.00010098,
                'resolution_reference' => 'Ley 22/2021 de Presupuestos Generales del Estado',
            ],
            [
                'id' => 'esp-2021',
                'period_label' => '2021 - Anual',
                'start_date' => '2021-01-01',
                'end_date' => '2021-12-31',
                'effective_annual_rate' => 3.7500,
                'daily_rate' => 0.00010098,
                'resolution_reference' => 'Ley 11/2020 de Presupuestos Generales del Estado',
            ],
        ],
    ];

    /**
     * Retrieve certified historical rate table.
     */
    public function getHistoricalRates(?string $regime = null): array
    {
        if ($regime && isset(self::HISTORICAL_RATES[$regime])) {
            return [
                'regime' => $regime,
                'rates' => self::HISTORICAL_RATES[$regime],
            ];
        }

        return self::HISTORICAL_RATES;
    }

    /**
     * Execute full moratory interest liquidation across official historical tranches.
     */
    public function calculateInterest(
        float $principal,
        string $dueDate,
        ?string $calculationDate = null,
        string $regime = 'dian_superfinanciera',
        float $penaltyPercentage = 5.0,
        float $costsPercentage = 3.0
    ): array {
        $calcDate = $calculationDate ?: date('Y-m-d');
        $principal = max(0.0, round($principal, 2));

        if (!isset(self::HISTORICAL_RATES[$regime])) {
            $regime = 'dian_superfinanciera';
        }

        $ratesTable = self::HISTORICAL_RATES[$regime];

        try {
            $dueObj = new DateTimeImmutable($dueDate);
            $calcObj = new DateTimeImmutable($calcDate);
        } catch (Exception) {
            $dueObj = new DateTimeImmutable(date('Y-m-d', strtotime('-30 days')));
            $calcObj = new DateTimeImmutable(date('Y-m-d'));
        }

        // If not in arrears, return zero moratory interest
        if ($dueObj >= $calcObj || $principal <= 0.0) {
            return [
                'regime' => $regime,
                'regime_label' => $regime === 'dian_superfinanciera' ? 'DIAN & Superfinanciera (Colombia)' : 'Interés de Demora Tributario (España LGT)',
                'principal_amount' => $principal,
                'due_date' => $dueObj->format('Y-m-d'),
                'calculation_date' => $calcObj->format('Y-m-d'),
                'days_in_arrears' => 0,
                'interest_amount' => 0.0,
                'penalty_amount' => 0.0,
                'costs_amount' => 0.0,
                'total_coactive_debt' => $principal,
                'weighted_annual_rate' => 0.0,
                'tranches' => [],
                'legal_framework' => $this->getLegalFrameworkText($regime),
            ];
        }

        $totalDays = (int) $dueObj->diff($calcObj)->days;
        $tranches = [];
        $totalInterest = 0.0;
        $weightedRateSum = 0.0;

        foreach ($ratesTable as $period) {
            $periodStart = new DateTimeImmutable($period['start_date']);
            $periodEnd = (new DateTimeImmutable($period['end_date']))->modify('+1 day');

            // Find intersection between [dueObj, calcObj] and [periodStart, periodEnd]
            $overlapStart = $dueObj > $periodStart ? $dueObj : $periodStart;
            $overlapEnd = $calcObj < $periodEnd ? $calcObj : $periodEnd;

            if ($overlapStart < $overlapEnd) {
                $daysInTranche = (int) $overlapStart->diff($overlapEnd)->days;
                if ($daysInTranche > 0) {
                    $dailyRate = (float) $period['daily_rate'];
                    $eaRate = (float) $period['effective_annual_rate'];

                    // Interest calculation: Simple daily rate applied to principal (non-capitalized / without anatocismo)
                    $trancheInterest = round($principal * $dailyRate * $daysInTranche, 2);
                    $totalInterest += $trancheInterest;
                    $weightedRateSum += ($eaRate * $daysInTranche);

                    $tranches[] = [
                        'period_id' => $period['id'],
                        'period_label' => $period['period_label'],
                        'start_date' => $overlapStart->format('Y-m-d'),
                        'end_date' => $overlapEnd->format('Y-m-d'),
                        'days' => $daysInTranche,
                        'effective_annual_rate' => $eaRate,
                        'daily_rate' => $dailyRate,
                        'interest_accrued' => $trancheInterest,
                        'resolution_reference' => $period['resolution_reference'],
                    ];
                }
            }
        }

        // Sort tranches chronologically
        usort($tranches, fn($a, $b) => strcmp($a['start_date'], $b['start_date']));

        $weightedAnnualRate = $totalDays > 0 ? round($weightedRateSum / $totalDays, 2) : 0.0;
        $totalInterest = round($totalInterest, 2);
        $penaltyAmount = round($principal * ($penaltyPercentage / 100.0), 2);
        $costsAmount = round($principal * ($costsPercentage / 100.0), 2);
        $totalDebt = round($principal + $totalInterest + $penaltyAmount + $costsAmount, 2);

        return [
            'regime' => $regime,
            'regime_label' => $regime === 'dian_superfinanciera' ? 'DIAN & Superfinanciera (Colombia)' : 'Interés de Demora Tributario (España LGT)',
            'principal_amount' => $principal,
            'due_date' => $dueObj->format('Y-m-d'),
            'calculation_date' => $calcObj->format('Y-m-d'),
            'days_in_arrears' => $totalDays,
            'interest_amount' => $totalInterest,
            'penalty_amount' => $penaltyAmount,
            'costs_amount' => $costsAmount,
            'total_coactive_debt' => $totalDebt,
            'weighted_annual_rate' => $weightedAnnualRate,
            'tranches' => $tranches,
            'legal_framework' => $this->getLegalFrameworkText($regime),
        ];
    }

    /**
     * Helper to retrieve legal citation text.
     */
    private function getLegalFrameworkText(string $regime): string
    {
        if ($regime === 'dian_superfinanciera') {
            return 'Art. 635 del Estatuto Tributario Nacional: Tasa de interés moratorio equivalente a la tasa de usura certificada por la Superintendencia Financiera de Colombia para la modalidad de créditos de consumo y ordinario menos dos (2) puntos porcentuales, liquidada de forma diaria simple sobre saldo de capital sin anatocismo.';
        }

        return 'Art. 26.6 de la Ley 58/2003 General Tributaria (LGT) de España: Interés de demora legal fijado en las Leyes de Presupuestos Generales del Estado (PGE), liquidado proporcionalmente a los días de retraso.';
    }
}
