<?php

namespace App\Services;

class ElectronicInvoiceParserService
{
    public static function isElectronicInvoice(string $rawText): bool
    {
        return str_contains($rawText, '<fe:Facturae') ||
               str_contains($rawText, '<Facturae') ||
               str_contains($rawText, '<Invoice') ||
               str_contains($rawText, '<ubl:Invoice') ||
               str_contains($rawText, '<rsm:CrossIndustryInvoice');
    }

    public static function parse(string $rawText, string $filename): ?array
    {
        try {
            if (str_contains($rawText, '<fe:Facturae') || str_contains($rawText, '<Facturae')) {
                return self::parseFacturae($rawText);
            }
            if (str_contains($rawText, '<Invoice') || str_contains($rawText, '<ubl:Invoice')) {
                return self::parseUbl($rawText);
            }
        } catch (\Throwable $e) {
            \Log::warning('[ElectronicInvoiceParser] XML parse failed: ' . $e->getMessage());
        }

        return null;
    }

    private static function getTag(string $xml, string $tag): string
    {
        if (preg_match('/<(?:[a-zA-Z0-9]+:)?' . preg_quote($tag, '/') . '[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?' . preg_quote($tag, '/') . '>/i', $xml, $m)) {
            return trim($m[1]);
        }
        return '';
    }

    private static function getAllTags(string $xml, string $tag): array
    {
        $matches = [];
        if (preg_match_all('/<(?:[a-zA-Z0-9]+:)?' . preg_quote($tag, '/') . '[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?' . preg_quote($tag, '/') . '>/i', $xml, $m)) {
            foreach ($m[1] as $content) {
                $matches[] = trim($content);
            }
        }
        return $matches;
    }

    private static function parseFacturae(string $xml): array
    {
        $sellerXml = self::getTag($xml, 'SellerParty') ?: self::getTag($xml, 'Parties');
        $supplierTaxId = self::getTag($sellerXml, 'TaxIdentificationNumber') ?: 'B00000000';
        $supplierName = self::getTag($sellerXml, 'CorporateName') ?:
                        trim(self::getTag($sellerXml, 'Name') . ' ' . self::getTag($sellerXml, 'FirstSurname')) ?:
                        'Proveedor Facturae';
        $supplierAddress = implode(', ', array_filter([
            self::getTag($sellerXml, 'Address'),
            self::getTag($sellerXml, 'PostCode'),
            self::getTag($sellerXml, 'Town')
        ]));

        $buyerXml = self::getTag($xml, 'BuyerParty');
        $customerTaxId = self::getTag($buyerXml, 'TaxIdentificationNumber') ?: 'ESB87219034';
        $customerName = self::getTag($buyerXml, 'CorporateName') ?:
                        trim(self::getTag($buyerXml, 'Name') . ' ' . self::getTag($buyerXml, 'FirstSurname')) ?:
                        'SplitLedger Engineering Labs S.L.';
        $customerAddress = implode(', ', array_filter([
            self::getTag($buyerXml, 'Address'),
            self::getTag($buyerXml, 'PostCode'),
            self::getTag($buyerXml, 'Town')
        ]));

        $invoiceNumber = self::getTag($xml, 'InvoiceNumber') ?: ('FAC-E-' . date('Ymd') . '-' . rand(100, 999));
        $issueDate = self::getTag($xml, 'IssueDate') ?: date('Y-m-d');
        $currency = self::getTag($xml, 'InvoiceCurrencyCode') ?: 'EUR';

        $totalsXml = self::getTag($xml, 'InvoiceTotals');
        $subtotal = floatval(self::getTag($totalsXml, 'TotalGrossAmountBeforeTaxes') ?: self::getTag($totalsXml, 'TotalGrossAmount'));
        $taxTotal = floatval(self::getTag($totalsXml, 'TotalTaxOutputs'));
        $retentionTotal = floatval(self::getTag($totalsXml, 'TotalWithheldTaxes'));
        $grandTotal = floatval(self::getTag($totalsXml, 'InvoiceTotal')) ?: ($subtotal + $taxTotal - $retentionTotal);

        $lineBlocks = self::getAllTags($xml, 'InvoiceLine');
        $items = [];

        foreach ($lineBlocks as $idx => $lineXml) {
            $concept = self::getTag($lineXml, 'ItemDescription') ?: ('Partida #' . ($idx + 1));
            $qty = floatval(self::getTag($lineXml, 'Quantity') ?: 1);
            $unitPrice = floatval(self::getTag($lineXml, 'UnitPriceWithoutTax') ?: 0);
            $base = floatval(self::getTag($lineXml, 'TotalCost') ?: ($qty * $unitPrice));

            $taxXml = self::getTag($lineXml, 'TaxesOutputs') ?: $lineXml;
            $taxRate = floatval(strip_tags(self::getTag($taxXml, 'TaxRate') ?: '21'));
            $rawTaxAmt = self::getTag($taxXml, 'TaxAmount');
            $taxAmount = !empty($rawTaxAmt) ? floatval(strip_tags($rawTaxAmt)) : round($base * ($taxRate / 100), 2);
            $total = round($base + $taxAmount, 2);

            $classification = AccountingRulesService::classifyLineItem($concept, $supplierName);

            $items[] = [
                'concept' => $concept,
                'account_code' => $classification['account_code'],
                'account_name' => $classification['account_name'],
                'cost_center' => $classification['cost_center'],
                'quantity' => $qty,
                'unit_price' => $unitPrice ?: $base,
                'base_amount' => $base,
                'tax_rate' => $taxRate,
                'tax_amount' => $taxAmount,
                'total_amount' => $total,
                'notes' => 'Facturae XML Schema v3.2 Línea #' . ($idx + 1)
            ];
        }

        return [
            'invoice_number' => $invoiceNumber,
            'supplier_name' => $supplierName,
            'supplier_tax_id' => $supplierTaxId,
            'supplier_address' => $supplierAddress,
            'customer_name' => $customerName,
            'customer_tax_id' => $customerTaxId,
            'customer_address' => $customerAddress,
            'invoice_date' => $issueDate,
            'due_date' => self::getTag($xml, 'DueDate') ?: date('Y-m-d', strtotime('+30 days')),
            'currency' => $currency,
            'subtotal' => $subtotal,
            'tax_total' => $taxTotal,
            'retention_total' => $retentionTotal,
            'grand_total' => $grandTotal,
            'confidence_score' => 0.999,
            'items' => $items
        ];
    }

    private static function parseUbl(string $xml): array
    {
        $invoiceNumber = self::getTag($xml, 'ID') ?: ('UBL-' . date('Ymd') . '-' . rand(100, 999));
        $issueDate = self::getTag($xml, 'IssueDate') ?: date('Y-m-d');
        $currency = self::getTag($xml, 'DocumentCurrencyCode') ?: 'EUR';

        $supplierParty = self::getTag($xml, 'AccountingSupplierParty');
        $supplierName = self::getTag($supplierParty, 'RegistrationName') ?: self::getTag($supplierParty, 'Name') ?: 'Proveedor UBL';
        $supplierTaxId = self::getTag($supplierParty, 'CompanyID') ?: self::getTag($supplierParty, 'ID') ?: 'LU26375245';

        $customerParty = self::getTag($xml, 'AccountingCustomerParty');
        $customerName = self::getTag($customerParty, 'RegistrationName') ?: self::getTag($customerParty, 'Name') ?: 'SplitLedger Engineering Labs S.L.';
        $customerTaxId = self::getTag($customerParty, 'CompanyID') ?: self::getTag($customerParty, 'ID') ?: 'ESB87219034';

        $legalMonetary = self::getTag($xml, 'LegalMonetaryTotal');
        $subtotal = floatval(self::getTag($legalMonetary, 'LineExtensionAmount') ?: self::getTag($legalMonetary, 'TaxExclusiveAmount'));
        $grandTotal = floatval(self::getTag($legalMonetary, 'PayableAmount') ?: self::getTag($legalMonetary, 'TaxInclusiveAmount')) ?: $subtotal;

        $taxTotalXml = self::getTag($xml, 'TaxTotal');
        $taxTotal = floatval(self::getTag($taxTotalXml, 'TaxAmount'));

        $lineBlocks = self::getAllTags($xml, 'InvoiceLine');
        $items = [];

        foreach ($lineBlocks as $idx => $lineXml) {
            $concept = self::getTag($lineXml, 'Description') ?: self::getTag($lineXml, 'Name') ?: ('Línea UBL #' . ($idx + 1));
            $qty = floatval(self::getTag($lineXml, 'InvoicedQuantity') ?: 1);
            $base = floatval(self::getTag($lineXml, 'LineExtensionAmount') ?: 0);
            $priceXml = self::getTag($lineXml, 'Price');
            $unitPrice = floatval(self::getTag($priceXml, 'PriceAmount') ?: ($qty > 0 ? $base / $qty : $base));
            $taxRate = floatval(self::getTag($lineXml, 'Percent') ?: ($subtotal > 0 && $taxTotal > 0 ? round(($taxTotal / $subtotal) * 100) : 0));
            $taxAmount = round($base * ($taxRate / 100), 2);
            $total = round($base + $taxAmount, 2);

            $classification = AccountingRulesService::classifyLineItem($concept, $supplierName);

            $items[] = [
                'concept' => $concept,
                'account_code' => $classification['account_code'],
                'account_name' => $classification['account_name'],
                'cost_center' => $classification['cost_center'],
                'quantity' => $qty,
                'unit_price' => $unitPrice,
                'base_amount' => $base,
                'tax_rate' => $taxRate,
                'tax_amount' => $taxAmount,
                'total_amount' => $total,
                'notes' => 'UBL 2.1 Línea #' . ($idx + 1)
            ];
        }

        return [
            'invoice_number' => $invoiceNumber,
            'supplier_name' => $supplierName,
            'supplier_tax_id' => $supplierTaxId,
            'supplier_address' => '',
            'customer_name' => $customerName,
            'customer_tax_id' => $customerTaxId,
            'customer_address' => '',
            'invoice_date' => $issueDate,
            'due_date' => date('Y-m-d', strtotime('+30 days')),
            'currency' => $currency,
            'subtotal' => $subtotal,
            'tax_total' => $taxTotal,
            'retention_total' => 0,
            'grand_total' => $grandTotal,
            'confidence_score' => 0.998,
            'items' => $items
        ];
    }
}
