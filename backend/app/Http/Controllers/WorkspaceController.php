<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class WorkspaceController extends Controller
{
    /**
     * List all workspaces with aggregated metrics.
     */
    public function index(): JsonResponse
    {
        $workspaces = Workspace::withCount('invoices')
            ->withSum('invoices as total_volume', 'grand_total')
            ->orderBy('created_at', 'desc')
            ->get();

        // Calculate count of unassigned invoices
        $unassignedCount = Invoice::whereNull('workspace_id')->count();
        $unassignedVolume = (float) Invoice::whereNull('workspace_id')->sum('grand_total');

        return response()->json([
            'status' => 'success',
            'data' => [
                'workspaces' => $workspaces,
                'unassigned' => [
                    'count' => $unassignedCount,
                    'total_volume' => $unassignedVolume
                ]
            ]
        ]);
    }

    /**
     * Create a new custom workspace.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100|min:2',
            'description' => 'nullable|string|max:500',
            'color' => 'nullable|string|max:30',
            'icon' => 'nullable|string|max:50',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Parámetros del workspace no válidos.',
                'errors' => $validator->errors()
            ], 422);
        }

        $workspace = Workspace::create([
            'name' => trim(strip_tags($request->input('name'))),
            'slug' => Str::slug($request->input('name')) . '-' . substr((string) Str::uuid(), 0, 6),
            'description' => $request->input('description') ? trim(strip_tags($request->input('description'))) : null,
            'color' => $request->input('color', '#ffffff'),
            'icon' => $request->input('icon', 'folder'),
            'is_archived' => false,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Workspace creado con éxito.',
            'data' => $workspace
        ], 201);
    }

    /**
     * Show a single workspace and its invoices.
     */
    public function show(string $id): JsonResponse
    {
        $workspace = Workspace::with(['invoices' => function ($q) {
            $q->orderBy('created_at', 'desc');
        }])->find($id);

        if (!$workspace) {
            return response()->json([
                'status' => 'error',
                'message' => 'Workspace no encontrado.'
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => $workspace
        ]);
    }

    /**
     * Update an existing workspace.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $workspace = Workspace::find($id);
        if (!$workspace) {
            return response()->json([
                'status' => 'error',
                'message' => 'Workspace no encontrado.'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:100|min:2',
            'description' => 'nullable|string|max:500',
            'color' => 'nullable|string|max:30',
            'icon' => 'nullable|string|max:50',
            'is_archived' => 'nullable|boolean'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Datos no válidos.',
                'errors' => $validator->errors()
            ], 422);
        }

        if ($request->has('name')) {
            $workspace->name = trim(strip_tags($request->input('name')));
        }
        if ($request->has('description')) {
            $workspace->description = $request->input('description') ? trim(strip_tags($request->input('description'))) : null;
        }
        if ($request->has('color')) {
            $workspace->color = $request->input('color');
        }
        if ($request->has('icon')) {
            $workspace->icon = $request->input('icon');
        }
        if ($request->has('is_archived')) {
            $workspace->is_archived = (bool) $request->input('is_archived');
        }

        $workspace->save();

        return response()->json([
            'status' => 'success',
            'message' => 'Workspace actualizado con éxito.',
            'data' => $workspace
        ]);
    }

    /**
     * Delete a workspace (invoices are unassigned, not deleted).
     */
    public function destroy(string $id): JsonResponse
    {
        $workspace = Workspace::find($id);
        if (!$workspace) {
            return response()->json([
                'status' => 'error',
                'message' => 'Workspace no encontrado.'
            ], 404);
        }

        // Unassign all invoices linked to this workspace
        Invoice::where('workspace_id', $id)->update(['workspace_id' => null]);

        $workspace->delete();

        Cache::forget('invoices_index_default_v3');
        Cache::forget('metrics_summary_v2');

        return response()->json([
            'status' => 'success',
            'message' => 'Workspace eliminado. Las facturas han sido devueltas a la bandeja general.'
        ]);
    }

    /**
     * Bulk assign or reassign invoices to a workspace.
     */
    public function assignInvoices(Request $request, string $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'invoice_ids' => 'required|array|min:1',
            'invoice_ids.*' => 'string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Debes proporcionar una lista de IDs de facturas.',
                'errors' => $validator->errors()
            ], 422);
        }

        $ids = $request->input('invoice_ids');
        $targetWorkspaceId = ($id === 'unassign' || $id === 'null') ? null : $id;

        if ($targetWorkspaceId) {
            $exists = Workspace::where('id', $targetWorkspaceId)->exists();
            if (!$exists) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'El workspace de destino no existe.'
                ], 404);
            }
        }

        $affected = Invoice::whereIn('id', $ids)->update(['workspace_id' => $targetWorkspaceId]);

        Cache::forget('invoices_index_default_v3');
        Cache::forget('metrics_summary_v2');

        return response()->json([
            'status' => 'success',
            'message' => "Se han asignado {$affected} facturas al workspace.",
            'data' => [
                'assigned_count' => $affected,
                'workspace_id' => $targetWorkspaceId
            ]
        ]);
    }
}
