<?php

namespace App\Http\Controllers;

use App\Services\GoogleIntegrationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GoogleIntegrationController extends Controller
{
    /**
     * Get integration status for Google Cloud and Google Workspace tools.
     */
    public function status(): JsonResponse
    {
        $status = GoogleIntegrationService::getStatus();
        return response()->json([
            'status' => 'success',
            'data' => $status
        ]);
    }

    /**
     * Connect Google account and configure services.
     */
    public function connect(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => 'nullable|email',
            'name' => 'nullable|string',
            'services' => 'nullable|array'
        ]);

        $status = GoogleIntegrationService::connect($data);
        return response()->json([
            'status' => 'success',
            'message' => 'Cuenta de Google Workspace vinculada correctamente.',
            'data' => $status
        ]);
    }

    /**
     * Disconnect Google account.
     */
    public function disconnect(): JsonResponse
    {
        $status = GoogleIntegrationService::disconnect();
        return response()->json([
            'status' => 'success',
            'message' => 'Cuenta de Google desvinculada y permisos revocados.',
            'data' => $status
        ]);
    }

    /**
     * Synchronize invoices with Google Drive.
     */
    public function syncDrive(Request $request): JsonResponse
    {
        $invoiceIds = $request->input('invoice_ids', []);
        $result = GoogleIntegrationService::syncDrive($invoiceIds);
        return response()->json($result);
    }

    /**
     * Synchronize journal entries and line items with Google Sheets.
     */
    public function syncSheets(): JsonResponse
    {
        $result = GoogleIntegrationService::syncSheets();
        return response()->json($result);
    }

    /**
     * Scan Gmail for invoices.
     */
    public function fetchGmail(): JsonResponse
    {
        $result = GoogleIntegrationService::fetchGmail();
        return response()->json($result);
    }
}
