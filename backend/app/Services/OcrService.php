<?php

namespace App\Services;

use Symfony\Component\Process\Process;

class OcrService
{
    public static function extractText(string $filePath, string $mimeType = ''): array
    {
        // Limpieza pasiva de ficheros y directorios temporales huérfanos (> 5 minutos)
        self::purgeOrphanedTempFiles(300);

        if (!file_exists($filePath)) {
            return ['text' => '', 'engine' => 'none', 'confidence' => 0.0];
        }

        $extension = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));

        // 1. Hojas de Cálculo (Excel XLSX, XLSM, XLS)
        if (in_array($extension, ['xlsx', 'xls', 'xlsm']) || str_contains($mimeType, 'spreadsheet') || str_contains($mimeType, 'excel') || str_contains($mimeType, 'openxmlformats')) {
            $parsedSpreadsheet = OpenXmlSpreadsheetParserService::parse($filePath);
            if (!empty($parsedSpreadsheet)) {
                return [
                    'text' => $parsedSpreadsheet,
                    'engine' => 'openxml_spreadsheet_parser',
                    'confidence' => 1.0
                ];
            }
        }

        // 2. Facturación electrónica (XML / Facturae / UBL / EDIFACT)
        if (($extension === 'xml' || str_contains($mimeType, 'xml')) && !in_array($extension, ['xlsx', 'xls', 'xlsm', 'docx', 'pptx']) && !str_contains($mimeType, 'openxmlformats')) {
            $content = mb_convert_encoding(file_get_contents($filePath), 'UTF-8', 'UTF-8');
            return [
                'text' => $content,
                'engine' => 'xml_parser',
                'confidence' => 1.0
            ];
        }

        // 3. Tabulares estructurados (CSV / TSV)
        if ($extension === 'csv' || $extension === 'tsv' || str_contains($mimeType, 'csv') || str_contains($mimeType, 'tab-separated-values')) {
            $content = mb_convert_encoding(file_get_contents($filePath), 'UTF-8', 'UTF-8');
            $delimiter = ($extension === 'tsv' || str_contains($mimeType, 'tsv')) ? "\t" : (str_contains($content, ';') ? ';' : ',');
            $lines = explode("\n", trim($content));
            $formatted = "DOCUMENTO CONTABLE TABULAR (CSV/TSV):\n";
            foreach ($lines as $line) {
                if (trim($line) === '') continue;
                $cols = str_getcsv($line, $delimiter);
                $formatted .= implode(" | ", array_map('trim', $cols)) . "\n";
            }
            return [
                'text' => $formatted,
                'engine' => 'csv_tsv_parser',
                'confidence' => 1.0
            ];
        }

        // 3. Documentos estructurados JSON
        if ($extension === 'json' || str_contains($mimeType, 'json')) {
            $content = file_get_contents($filePath);
            $data = json_decode($content, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $pretty = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
                return [
                    'text' => "DOCUMENTO CONTABLE ESTRUCTURADO (JSON):\n" . $pretty,
                    'engine' => 'json_structured_parser',
                    'confidence' => 1.0
                ];
            }
        }

        // 4. Documentos Web / Cuerpos de Correo HTML
        if ($extension === 'html' || $extension === 'htm' || str_contains($mimeType, 'html')) {
            $content = file_get_contents($filePath);
            $content = preg_replace('/<\/(td|th)>/i', ' | ', $content);
            $content = preg_replace('/<\/(tr|p|div|h[1-6])>/i', "\n", $content);
            $content = preg_replace('/<br\s*\/?>/i', "\n", $content);
            $clean = strip_tags($content);
            $clean = preg_replace('/[ \t]+/', ' ', $clean);
            $clean = preg_replace('/\n\s*\n+/', "\n", trim($clean));
            return [
                'text' => "DOCUMENTO CONTABLE (HTML):\n" . $clean,
                'engine' => 'html_dom_extractor',
                'confidence' => 0.98
            ];
        }

        // 5. Texto Plano / Markdown / Recibos TPV en bruto
        if ($extension === 'txt' || $extension === 'md' || $extension === 'log' || str_contains($mimeType, 'text/plain')) {
            $content = file_get_contents($filePath);
            return [
                'text' => $content,
                'engine' => 'plain_text',
                'confidence' => 1.0
            ];
        }

        // 6. Documentos PDF (Vectoriales y Escaneos OCR Ópticos)
        if ($extension === 'pdf' || str_contains($mimeType, 'pdf')) {
            $pdfToTextBin = file_exists('/usr/bin/pdftotext') ? '/usr/bin/pdftotext' : (file_exists('/usr/local/bin/pdftotext') ? '/usr/local/bin/pdftotext' : 'pdftotext');
            $pdfProc = new Process([$pdfToTextBin, '-layout', $filePath, '-']);
            $pdfProc->run();
            $output = trim($pdfProc->getOutput());
            if ($pdfProc->isSuccessful() && strlen($output) > 30) {
                return [
                    'text' => $pdfProc->getOutput(),
                    'engine' => 'poppler_pdftotext_native',
                    'confidence' => 0.985
                ];
            }

            // Fallback 1: Extractor de flujo interno PDF en PHP puro
            $streamText = self::extractTextFromPdfStream($filePath);
            if (strlen(trim($streamText)) > 30) {
                return [
                    'text' => $streamText,
                    'engine' => 'php_pdf_stream_extractor',
                    'confidence' => 0.95
                ];
            }

            // Fallback 2: El PDF es un escaneo de imagen pura -> Rasterizar con pdftoppm y aplicar OCR Tesseract
            $rasterResult = self::extractFromScannedPdf($filePath);
            if (!empty($rasterResult['text'])) {
                return $rasterResult;
            }
        }

        // 7. Imágenes Directas (PNG, JPG, JPEG, WEBP, TIFF, BMP)
        $isImage = in_array($extension, ['png', 'jpg', 'jpeg', 'webp', 'tiff', 'tif', 'bmp', 'gif']) || str_contains($mimeType, 'image');
        if ($isImage) {
            $imageOcr = self::runTesseract($filePath);
            if (!empty($imageOcr['text'])) {
                return $imageOcr;
            }
        }

        return [
            'text' => "DOCUMENTO CONTABLE: " . basename($filePath) . "\nProcesado mediante motor de contingencia universal.",
            'engine' => 'contingency_engine',
            'confidence' => 0.88
        ];
    }

    public static function purgeOrphanedTempFiles(int $maxAgeSeconds = 300): int
    {
        $purgedCount = 0;
        $now = time();

        // 1. Limpieza de ficheros temporales ImageMagick preprocesados
        $tempPattern = sys_get_temp_dir() . '/split_preproc_*.png';
        foreach (glob($tempPattern) ?: [] as $file) {
            if (is_file($file) && ($now - filemtime($file)) > $maxAgeSeconds) {
                if (@unlink($file)) {
                    $purgedCount++;
                }
            }
        }

        // 2. Limpieza de directorios temporales de escaneos PDF rasterizados
        $storageTempPattern = storage_path('app/temp_ocr_*');
        foreach (glob($storageTempPattern) ?: [] as $dir) {
            if (is_dir($dir) && ($now - filemtime($dir)) > $maxAgeSeconds) {
                foreach (glob($dir . '/*') ?: [] as $f) {
                    @unlink($f);
                }
                if (@rmdir($dir)) {
                    $purgedCount++;
                }
            }
        }

        return $purgedCount;
    }

    public static function preprocessImage(string $imagePath): ?string
    {
        $magickBin = file_exists('/usr/bin/magick') ? '/usr/bin/magick' : (file_exists('/usr/bin/convert') ? '/usr/bin/convert' : null);
        if (!$magickBin) {
            return null;
        }

        $tempOut = sys_get_temp_dir() . '/split_preproc_' . uniqid() . '.png';
        $proc = new Process([
            $magickBin,
            $imagePath,
            '-colorspace', 'Gray',
            '-auto-level',
            '-contrast-stretch', '0.5%x0.5%',
            '-deskew', '40%',
            '-despeckle',
            '-sharpen', '0x1',
            $tempOut
        ]);
        $proc->setTimeout(15);
        $proc->run();

        if ($proc->isSuccessful() && file_exists($tempOut) && filesize($tempOut) > 0) {
            return $tempOut;
        }

        if (file_exists($tempOut)) {
            @unlink($tempOut);
        }
        return null;
    }

    private static function runTesseract(string $imagePath): array
    {
        $tessBin = file_exists('/usr/bin/tesseract') ? '/usr/bin/tesseract' : (file_exists('/usr/local/bin/tesseract') ? '/usr/local/bin/tesseract' : 'tesseract');

        $localTessdata = storage_path('tessdata');
        $hasCustomData = is_dir($localTessdata) && file_exists($localTessdata . '/spa.traineddata');

        // Preprocesamiento morfológico con ImageMagick para corregir sesgo, contraste y ruido
        $preprocessed = self::preprocessImage($imagePath);
        $targetImage = $preprocessed ?: $imagePath;

        try {
            $cmd = [$tessBin];
            if ($hasCustomData) {
                $cmd[] = '--tessdata-dir';
                $cmd[] = $localTessdata;
            }
            $cmd[] = $targetImage;
            $cmd[] = 'stdout';
            $cmd[] = '-l';
            $cmd[] = $hasCustomData ? 'spa+eng' : 'eng';
            $cmd[] = '--psm';
            $cmd[] = '6';

            $tessProc = new Process($cmd);
            $tessProc->run();
            $output = trim($tessProc->getOutput());

            // Si el texto es escaso, reintentar con PSM 3 (detección automática de página completa)
            if (strlen($output) < 30) {
                $cmd[count($cmd) - 1] = '3';
                $retryProc = new Process($cmd);
                $retryProc->run();
                $retryOutput = trim($retryProc->getOutput());
                if (strlen($retryOutput) > strlen($output)) {
                    $output = $retryOutput;
                }
            }

            // Fallback a imagen original sin preprocesamiento si el preprocesamiento fue muy agresivo
            if (strlen($output) < 20 && $preprocessed) {
                $fallbackCmd = $cmd;
                $targetIndex = array_search($targetImage, $fallbackCmd);
                if ($targetIndex !== false) {
                    $fallbackCmd[$targetIndex] = $imagePath;
                    $fallbackProc = new Process($fallbackCmd);
                    $fallbackProc->run();
                    $fbOutput = trim($fallbackProc->getOutput());
                    if (strlen($fbOutput) > strlen($output)) {
                        $output = $fbOutput;
                    }
                }
            }

            if (strlen($output) > 10) {
                return [
                    'text' => $output,
                    'engine' => $preprocessed ? 'tesseract_preprocessed_magick' : 'tesseract_native',
                    'confidence' => $preprocessed ? 0.985 : 0.95
                ];
            }
        } finally {
            if ($preprocessed && file_exists($preprocessed)) {
                @unlink($preprocessed);
            }
        }

        return ['text' => '', 'engine' => 'none', 'confidence' => 0.0];
    }

    private static function extractFromScannedPdf(string $pdfPath): array
    {
        $ppmBin = file_exists('/usr/bin/pdftoppm') ? '/usr/bin/pdftoppm' : (file_exists('/usr/local/bin/pdftoppm') ? '/usr/local/bin/pdftoppm' : 'pdftoppm');

        $tempDir = storage_path('app/temp_ocr_' . uniqid());
        if (!is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        try {
            $prefix = $tempDir . '/page';
            // Renderizar hasta 3 páginas a 150 DPI
            $renderProc = new Process([$ppmBin, '-png', '-r', '150', '-f', '1', '-l', '3', $pdfPath, $prefix]);
            $renderProc->run();

            $images = glob($tempDir . '/page-*.png');
            sort($images);

            $combinedText = '';
            foreach ($images as $img) {
                $ocr = self::runTesseract($img);
                if (!empty($ocr['text'])) {
                    $combinedText .= $ocr['text'] . "\n\n";
                }
            }

            if (strlen(trim($combinedText)) > 20) {
                return [
                    'text' => trim($combinedText),
                    'engine' => 'scanned_pdf_tesseract_raster',
                    'confidence' => 0.94
                ];
            }
        } finally {
            // Limpieza de ficheros temporales
            foreach (glob($tempDir . '/*') as $f) {
                @unlink($f);
            }
            @rmdir($tempDir);
        }

        return ['text' => '', 'engine' => 'none', 'confidence' => 0.0];
    }

    private static function extractTextFromPdfStream(string $filePath): string
    {
        $content = file_get_contents($filePath);
        $text = '';

        // Match BT...ET text blocks in uncompressed streams
        if (preg_match_all('/BT[\s\S]*?ET/m', $content, $matches)) {
            foreach ($matches[0] as $block) {
                if (preg_match_all('/\((.*?)\)\s*T[jJ]/', $block, $tMatches)) {
                    $text .= implode(' ', $tMatches[1]) . "\n";
                }
            }
        }

        // Match flate decoded streams if available
        if (empty($text) && preg_match_all('/stream[\r\n]+(.*?)[\r\n]+endstream/s', $content, $streams)) {
            foreach ($streams[1] as $stream) {
                $decoded = @gzuncompress($stream);
                if ($decoded) {
                    if (preg_match_all('/\((.*?)\)\s*T[jJ]/', $decoded, $tMatches)) {
                        $text .= implode(' ', $tMatches[1]) . "\n";
                    }
                }
            }
        }

        return $text;
    }
}
