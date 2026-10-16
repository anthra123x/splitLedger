<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'name' => 'SplitLedger API',
        'status' => 'operational',
        'version' => '2.4.0',
        'backend' => 'Laravel 12 (PHP 8.5)'
    ]);
});

Route::get('/health', function () {
    return response()->json([
        'status' => 'healthy',
        'timestamp' => now()->toIso8601String(),
        'service' => 'SplitLedger Engine',
        'backend' => 'Laravel 12 (PHP 8.5)',
        'database' => 'Neon PostgreSQL (Cloud Serverless)',
        'ai_model' => env('OPENROUTER_DEFAULT_MODEL', 'openrouter/free')
    ]);
});
