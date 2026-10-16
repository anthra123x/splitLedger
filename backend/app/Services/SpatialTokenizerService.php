<?php

namespace App\Services;

class SpatialTokenizerService
{
    public static function tokenize(string $rawText): array
    {
        $lines = explode("\n", $rawText);
        $tokens = [];
        $yCursor = 20;

        foreach ($lines as $lineIdx => $line) {
            $trimmed = trim($line);
            if (empty($trimmed)) {
                $yCursor += 15;
                continue;
            }

            $words = preg_split('/\s+/', $trimmed);
            $xCursor = 40;

            foreach ($words as $word) {
                $tokenType = self::classifyTokenType($word);
                $width = max(30, strlen($word) * 8);

                $tokens[] = [
                    'text' => $word,
                    'type' => $tokenType,
                    'line' => $lineIdx + 1,
                    'bbox' => [
                        'x' => $xCursor,
                        'y' => $yCursor,
                        'w' => $width,
                        'h' => 16,
                        'confidence' => 0.98
                    ]
                ];

                $xCursor += $width + 8;
            }

            $yCursor += 22;
        }

        return $tokens;
    }

    private static function classifyTokenType(string $token): string
    {
        if (preg_match('/^[A-Z]{1,2}[0-9]{7,8}[A-Z0-9]?$/i', $token)) {
            return 'NIF_VAT';
        }
        if (preg_match('/^\d{1,4}[-\/\.]\d{1,2}[-\/\.]\d{1,4}$/', $token)) {
            return 'DATE';
        }
        if (preg_match('/^-?\d+([.,]\d{2})?\s*(€|\$|EUR|USD)?$/i', $token)) {
            return 'MONETARY_OR_NUM';
        }
        if (preg_match('/^\d+([.,]\d+)?%$/', $token)) {
            return 'PERCENTAGE';
        }
        return 'ALPHA_CONCEPT';
    }
}
