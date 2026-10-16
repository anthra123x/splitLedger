<?php

namespace App\Services;

use ZipArchive;
use SimpleXMLElement;

class OpenXmlSpreadsheetParserService
{
    /**
     * Parsea un fichero de hoja de cálculo (.xlsx, .xlsm o .xls) y devuelve
     * su representación tabular estructurada optimizada para el motor de auditoría contable.
     *
     * @param string $filePath Ruta absoluta al archivo en disco
     * @return string|null Contenido estructurado o null si no pudo procesarse
     */
    public static function parse(string $filePath): ?string
    {
        if (!file_exists($filePath) || !is_readable($filePath)) {
            return null;
        }

        // 1. Intentar extracción nativa OpenXML (ZIP con XML interno: .xlsx, .xlsm)
        $openXmlResult = self::parseOpenXmlWorkbook($filePath);
        if (!empty($openXmlResult)) {
            return $openXmlResult;
        }

        // 2. Fallback para ficheros .xls que en realidad son XML SpreadsheetML 2003
        $spreadsheetMlResult = self::parseSpreadsheetMl($filePath);
        if (!empty($spreadsheetMlResult)) {
            return $spreadsheetMlResult;
        }

        // 3. Fallback para ficheros .xls que son tablas HTML con extensión cambiada
        $htmlResult = self::parseHtmlSpreadsheet($filePath);
        if (!empty($htmlResult)) {
            return $htmlResult;
        }

        // 4. Fallback de extracción de cadenas imprimibles de flujo binario BIFF8
        $binaryResult = self::extractBinaryBiffStrings($filePath);
        if (!empty($binaryResult)) {
            return $binaryResult;
        }

        return null;
    }

    /**
     * Parsea un libro OpenXML (.xlsx) mediante ZipArchive y SimpleXML nativos.
     */
    private static function parseOpenXmlWorkbook(string $filePath): ?string
    {
        $zip = new ZipArchive();
        if ($zip->open($filePath) !== true) {
            return null;
        }

        try {
            // 1. Cargar tabla de cadenas compartidas (Shared Strings)
            $sharedStrings = [];
            $ssContent = $zip->getFromName('xl/sharedStrings.xml');
            if ($ssContent !== false) {
                $ssXml = @simplexml_load_string($ssContent);
                if ($ssXml && isset($ssXml->si)) {
                    foreach ($ssXml->si as $si) {
                        if (isset($si->t)) {
                            $sharedStrings[] = (string)$si->t;
                        } elseif (isset($si->r)) {
                            $text = '';
                            foreach ($si->r as $r) {
                                $text .= (string)$r->t;
                            }
                            $sharedStrings[] = $text;
                        } else {
                            $sharedStrings[] = '';
                        }
                    }
                }
            }

            // 2. Extraer metadatos y nombres legibles de hojas desde xl/workbook.xml
            $sheetNames = [];
            $wbContent = $zip->getFromName('xl/workbook.xml');
            if ($wbContent !== false) {
                $wbXml = @simplexml_load_string($wbContent);
                if ($wbXml && isset($wbXml->sheets->sheet)) {
                    $sIdx = 1;
                    foreach ($wbXml->sheets->sheet as $s) {
                        $sheetNames["xl/worksheets/sheet{$sIdx}.xml"] = (string)$s['name'];
                        $sIdx++;
                    }
                }
            }

            // 3. Localizar hojas de cálculo en el archivo ZIP
            $sheetFiles = [];
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $name = $zip->getNameIndex($i);
                if (preg_match('/^xl\/worksheets\/sheet\d+\.xml$/i', $name)) {
                    $sheetFiles[] = $name;
                }
            }
            sort($sheetFiles);

            if (empty($sheetFiles)) {
                return null;
            }

            // 4. Pre-analizar y clasificar la relevancia contable de cada hoja
            $sheetsData = [];
            foreach ($sheetFiles as $sheetFile) {
                $content = $zip->getFromName($sheetFile);
                if ($content === false) continue;
                $sXml = @simplexml_load_string($content);
                if (!$sXml || !isset($sXml->sheetData)) continue;

                $sheetTitle = $sheetNames[$sheetFile] ?? basename($sheetFile, '.xml');
                $score = 0;

                // Penalizar o premiar por título de pestaña
                $titleLower = strtolower($sheetTitle);
                if (preg_match('/(factura|invoice|fra|cobro|cuenta|asiento|liquidaci[oó]n)/i', $titleLower)) {
                    $score += 15;
                }
                if (preg_match('/(instruccion|readme|leeme|notas?|config|par[aá]metro|borrador|draft|plantilla)/i', $titleLower)) {
                    $score -= 20;
                }

                $sheetRows = [];
                $numericCount = 0;
                $accountingKeywords = 0;

                foreach ($sXml->sheetData->row as $r) {
                    $rowNum = (int)$r['r'];
                    $cells = [];
                    foreach ($r->c as $c) {
                        $ref = (string)$c['r'];
                        $colIdx = self::cellRefToColIndex($ref);
                        $type = (string)$c['t'];
                        $val = (string)$c->v;

                        if ($type === 's') {
                            $val = $sharedStrings[(int)$val] ?? '';
                            $lowerVal = strtolower($val);
                            if (preg_match('/(concepto|base|iva|total|subtotal|precio|cantidad|nif|cif|factura)/i', $lowerVal)) {
                                $accountingKeywords++;
                            }
                        } elseif ($type === 'inlineStr' && isset($c->is->t)) {
                            $val = (string)$c->is->t;
                        } elseif ($type === 'b') {
                            $val = ($val === '1') ? 'TRUE' : 'FALSE';
                        } else {
                            if (is_numeric($val) && floatval($val) > 0) {
                                $numericCount++;
                            }
                        }

                        $cells[$colIdx] = trim($val);
                    }
                    if (!empty($cells)) {
                        $sheetRows[$rowNum] = $cells;
                    }
                }

                $score += ($accountingKeywords * 3) + min(30, $numericCount);

                $sheetsData[] = [
                    'file' => $sheetFile,
                    'title' => $sheetTitle,
                    'score' => $score,
                    'rows' => $sheetRows
                ];
            }

            // Ordenar hojas por relevancia contable descendente
            usort($sheetsData, fn($a, $b) => $b['score'] <=> $a['score']);

            // Si la hoja principal tiene alta relevancia, descartar pestañas de ruido con score <= 0
            $bestScore = $sheetsData[0]['score'] ?? 0;
            if ($bestScore >= 10) {
                $sheetsData = array_filter($sheetsData, fn($s) => $s['score'] > 0);
            }

            $allLines = ["DOCUMENTO CONTABLE (HOJA DE CÁLCULO EXCEL):"];
            $isMultiSheet = count($sheetsData) > 1;

            foreach ($sheetsData as $sheet) {
                $rows = $sheet['rows'];
                if (empty($rows)) continue;

                if ($isMultiSheet) {
                    $allLines[] = "\n--- SECCIÓN HOJA: " . strtoupper($sheet['title']) . " ---";
                }

                if (empty($rows)) continue;

                // Detectar fila de cabecera de detalle de factura
                $headerRowNum = null;
                $conceptCol = -1;
                $qtyCol = -1;
                $priceCol = -1;
                $baseCol = -1;
                $vatCol = -1;
                $totalCol = -1;

                foreach ($rows as $rowNum => $cells) {
                    $rowStr = strtolower(implode(' ', $cells));
                    if (str_contains($rowStr, 'concepto') || str_contains($rowStr, 'descripcion') || str_contains($rowStr, 'artículo') || str_contains($rowStr, 'producto')) {
                        $headerRowNum = $rowNum;
                        foreach ($cells as $colIdx => $val) {
                            $v = strtolower($val);
                            if (str_contains($v, 'concepto') || str_contains($v, 'descrip') || str_contains($v, 'art') || str_contains($v, 'prod')) {
                                $conceptCol = $colIdx;
                            } elseif (str_contains($v, 'cant') || str_contains($v, 'uds') || str_contains($v, 'unidades')) {
                                $qtyCol = $colIdx;
                            } elseif (str_contains($v, 'prec') || str_contains($v, 'unit') || str_contains($v, 'tarifa')) {
                                $priceCol = $colIdx;
                            } elseif (str_contains($v, 'base') || str_contains($v, 'subtotal')) {
                                $baseCol = $colIdx;
                            } elseif (str_contains($v, 'iva') || str_contains($v, 'tax') || str_contains($v, 'tipo')) {
                                $vatCol = $colIdx;
                            } elseif (str_contains($v, 'total') || str_contains($v, 'importe')) {
                                $totalCol = $colIdx;
                            }
                        }
                        break;
                    }
                }

                foreach ($rows as $rowNum => $cells) {
                    // Cabecera de partidas
                    if ($headerRowNum !== null && $rowNum === $headerRowNum) {
                        $allLines[] = implode(' | ', array_filter($cells, fn($x) => $x !== ''));
                        continue;
                    }

                    // Partidas o totales posteriores a la cabecera
                    if ($headerRowNum !== null && $rowNum > $headerRowNum) {
                        $concept = $cells[$conceptCol] ?? '';
                        $qty = $cells[$qtyCol] ?? '';
                        $price = $cells[$priceCol] ?? '';
                        $base = $cells[$baseCol] ?? '';
                        $vat = $cells[$vatCol] ?? '';
                        $total = $cells[$totalCol] ?? '';

                        if (!empty($concept)) {
                            $parts = [$concept];
                            if (!empty($qty) && !empty($price)) {
                                $parts[] = "{$qty} x {$price}";
                            } elseif (!empty($qty)) {
                                $parts[] = "Cant: {$qty}";
                            }
                            if (!empty($base)) $parts[] = "Base: {$base}";
                            if (!empty($vat)) $parts[] = "IVA: {$vat}";
                            if (!empty($total)) $parts[] = "Total: {$total}";
                            $allLines[] = implode(' | ', $parts);
                            continue;
                        } else {
                            // Línea de totales / pie de factura
                            $summaryParts = [];
                            if (!empty($base)) $summaryParts[] = "Base Imponible: {$base}";
                            if (!empty($vat)) $summaryParts[] = "Cuota IVA: {$vat}";
                            if (!empty($total)) $summaryParts[] = "Total Factura: {$total}";
                            if (!empty($summaryParts)) {
                                $allLines[] = implode(' | ', $summaryParts);
                                continue;
                            }
                        }
                    }

                    // Metadatos generales (Nº factura, Proveedor, NIF, Fechas)
                    $formattedItems = [];
                    $lastLabel = '';
                    foreach ($cells as $colIdx => $val) {
                        if ($val === '') continue;
                        if (preg_match('/^(n[ºo]\s*(?:de\s*)?factura|proveedor|emisor|nif|cif|nie|cliente|receptor|fecha|vencimiento|direcci[oó]n|iban|total|subtotal)$/i', $val)) {
                            $lastLabel = $val;
                        } elseif (!empty($lastLabel)) {
                            $formattedItems[] = "{$lastLabel}: {$val}";
                            $lastLabel = '';
                        } else {
                            $formattedItems[] = $val;
                        }
                    }

                    if (!empty($formattedItems)) {
                        $allLines[] = implode(' | ', $formattedItems);
                    }
                }
            }

            return count($allLines) > 1 ? implode("\n", $allLines) : null;
        } finally {
            $zip->close();
        }
    }

    /**
     * Parsea ficheros XML SpreadsheetML 2003 (muy comunes en exportaciones ERP guardadas como .xls).
     */
    private static function parseSpreadsheetMl(string $filePath): ?string
    {
        $content = file_get_contents($filePath, false, null, 0, 500000);
        if (!str_contains($content, 'urn:schemas-microsoft-com:office:spreadsheet')) {
            return null;
        }

        $xml = @simplexml_load_string($content);
        if (!$xml) return null;

        $xml->registerXPathNamespace('ss', 'urn:schemas-microsoft-com:office:spreadsheet');
        $rows = $xml->xpath('//ss:Row');
        if (empty($rows)) return null;

        $lines = ["DOCUMENTO CONTABLE (XML SPREADSHEET):"];
        foreach ($rows as $r) {
            $cells = [];
            foreach ($r->Cell as $c) {
                $data = (string)$c->Data;
                if (trim($data) !== '') {
                    $cells[] = trim($data);
                }
            }
            if (!empty($cells)) {
                $lines[] = implode(' | ', $cells);
            }
        }

        return count($lines) > 1 ? implode("\n", $lines) : null;
    }

    /**
     * Parsea tablas HTML guardadas con extensión .xls.
     */
    private static function parseHtmlSpreadsheet(string $filePath): ?string
    {
        $headerBytes = file_get_contents($filePath, false, null, 0, 1024);
        if (!str_contains(strtolower($headerBytes), '<table') && !str_contains(strtolower($headerBytes), '<html')) {
            return null;
        }

        $content = file_get_contents($filePath);
        if (preg_match_all('/<tr[^>]*>(.*?)<\/tr>/is', $content, $trMatches)) {
            $lines = ["DOCUMENTO CONTABLE (TABLA HTML):"];
            foreach ($trMatches[1] as $tr) {
                if (preg_match_all('/<(?:td|th)[^>]*>(.*?)<\/(?:td|th)>/is', $tr, $tdMatches)) {
                    $cells = array_map(fn($c) => trim(strip_tags(html_entity_decode($c, ENT_QUOTES | ENT_HTML5, 'UTF-8'))), $tdMatches[1]);
                    $cells = array_filter($cells, fn($c) => $c !== '');
                    if (!empty($cells)) {
                        $lines[] = implode(' | ', $cells);
                    }
                }
            }
            return count($lines) > 1 ? implode("\n", $lines) : null;
        }

        return null;
    }

    /**
     * Extracción de cadenas legibles de un flujo binario BIFF8 (.xls nativo legado).
     */
    private static function extractBinaryBiffStrings(string $filePath): ?string
    {
        $handle = @fopen($filePath, 'rb');
        if (!$handle) return null;

        $data = fread($handle, 1024 * 1024); // Leer hasta 1MB
        fclose($handle);

        // Extraer cadenas UTF-16LE legibles
        $strings = [];
        if (preg_match_all('/(?:[\x20-\x7E]\x00){4,}/', $data, $utf16Matches)) {
            foreach ($utf16Matches[0] as $match) {
                $decoded = mb_convert_encoding($match, 'UTF-8', 'UTF-16LE');
                $trimmed = trim($decoded);
                if (strlen($trimmed) >= 3 && !preg_match('/^(?:root entry|workbook|summaryinformation|documentsummaryinformation)$/i', $trimmed)) {
                    $strings[] = $trimmed;
                }
            }
        }

        // Extraer cadenas ASCII legibles
        if (preg_match_all('/[\x20-\x7E]{5,}/', $data, $asciiMatches)) {
            foreach ($asciiMatches[0] as $match) {
                $trimmed = trim($match);
                if (strlen($trimmed) >= 4 && !in_array($trimmed, $strings) && !preg_match('/^(?:microsoft|excel|calc|worksheet)/i', $trimmed)) {
                    $strings[] = $trimmed;
                }
            }
        }

        if (count($strings) >= 3) {
            return "DOCUMENTO CONTABLE (EXTRACCIÓN BINARIA XLS):\n" . implode("\n", $strings);
        }

        return null;
    }

    /**
     * Convierte una referencia de celda tipo "A1", "C9" o "AA12" en un índice de columna base 0.
     */
    private static function cellRefToColIndex(string $cellRef): int
    {
        if (!preg_match('/^([A-Z]+)\d+$/i', $cellRef, $m)) {
            return 0;
        }

        $letters = strtoupper($m[1]);
        $index = 0;
        $len = strlen($letters);
        for ($i = 0; $i < $len; $i++) {
            $index = $index * 26 + (ord($letters[$i]) - ord('A') + 1);
        }

        return $index - 1;
    }
}
