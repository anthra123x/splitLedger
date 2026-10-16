<?php

use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\MetricsController;
use App\Http\Controllers\AgentController;
use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;

// Health Check
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

// Invoices CRUD & Processing
Route::post('/invoices/upload', [InvoiceController::class, 'upload']);
Route::post('/invoices/upload-stream', [InvoiceController::class, 'uploadStream']);
Route::post('/invoices/batch', [InvoiceController::class, 'upload']);
Route::get('/invoices', [InvoiceController::class, 'index']);
Route::get('/invoices/export', [InvoiceController::class, 'exportCsv']);
Route::get('/invoices/export-zip', [InvoiceController::class, 'exportZip']);
Route::get('/invoices/rules', [InvoiceController::class, 'getRules']);
Route::get('/invoices/{id}', [InvoiceController::class, 'show']);
Route::put('/invoices/{id}', [InvoiceController::class, 'update']);
Route::delete('/invoices/{id}', [InvoiceController::class, 'destroy']);

// Engine Telemetry
Route::get('/engine/status', [InvoiceController::class, 'getEngineStats']);

// Metrics
Route::get('/metrics', [MetricsController::class, 'summary']);

// User Profile
Route::get('/user/profile', [ProfileController::class, 'show']);

// AI Copilot Agent Chat
Route::post('/agent/chat', [AgentController::class, 'chat']);

