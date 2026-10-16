<?php

namespace App\Http\Controllers;

use App\Services\AgentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AgentController extends Controller
{
    /**
     * Handle chat messages for the AI floating agent.
     */
    public function chat(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'message' => 'required|string|max:1500',
            'history' => 'nullable|array|max:20'
        ]);

        $userMessage = $validated['message'];
        $history = $validated['history'] ?? [];

        $response = AgentService::handleMessage($userMessage, $history);

        return response()->json([
            'status' => 'success',
            'data' => $response
        ]);
    }
}
