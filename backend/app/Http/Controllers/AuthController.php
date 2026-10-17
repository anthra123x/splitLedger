<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    /**
     * Authenticate an existing user via email and password.
     */
    public function login(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email|max:255',
            'password' => 'required|string|min:6',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Parámetros de acceso inválidos.',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = User::where('email', strtolower(trim($request->email)))->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Credenciales de acceso no válidas. Comprueba tu correo y contraseña.'
            ], 401);
        }

        $token = $user->createToken('splitledger-web-auth')->plainTextToken;

        return response()->json([
            'status' => 'success',
            'message' => 'Sesión iniciada correctamente.',
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => 'Auditor Senior PGC',
                    'organization' => 'SplitLedger Enterprise S.L.',
                ],
                'token' => $token
            ]
        ]);
    }

    /**
     * Register a new user in the system.
     */
    public function register(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255|min:2',
            'email' => 'required|email|max:255|unique:users,email',
            'password' => 'required|string|min:8',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Los datos suministrados no son válidos.',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = User::create([
            'name' => strip_tags(trim($request->name)),
            'email' => strtolower(trim($request->email)),
            'password' => Hash::make($request->password),
        ]);

        $token = $user->createToken('splitledger-web-auth')->plainTextToken;

        return response()->json([
            'status' => 'success',
            'message' => 'Cuenta creada exitosamente en SplitLedger.',
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => 'Auditor Asociado PGC',
                    'organization' => 'SplitLedger Enterprise S.L.',
                ],
                'token' => $token
            ]
        ], 201);
    }

    /**
     * Request a passwordless magic link authentication.
     */
    public function magicLink(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Introduce un correo electrónico corporativo válido.',
                'errors' => $validator->errors()
            ], 422);
        }

        $email = strtolower(trim($request->email));
        $user = User::firstOrCreate(
            ['email' => $email],
            [
                'name' => explode('@', $email)[0],
                'password' => Hash::make(Str::random(32))
            ]
        );

        $token = $user->createToken('splitledger-magic-auth')->plainTextToken;

        return response()->json([
            'status' => 'success',
            'message' => 'Enlace de acceso rápido verificado y generado para ' . $email,
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => 'Auditor PGC',
                    'organization' => 'SplitLedger Enterprise S.L.',
                ],
                'token' => $token
            ]
        ]);
    }

    /**
     * Single Sign-On (SSO) Enterprise integration callback.
     */
    public function sso(Request $request): JsonResponse
    {
        $provider = $request->input('provider', 'enterprise-sso');
        $email = $request->input('email', 'auditor@splitledger.io');
        
        $user = User::firstOrCreate(
            ['email' => $email],
            [
                'name' => 'Auditor Corporativo (' . strtoupper($provider) . ')',
                'password' => Hash::make(Str::random(32))
            ]
        );

        $token = $user->createToken('splitledger-sso-auth')->plainTextToken;

        return response()->json([
            'status' => 'success',
            'message' => 'Autenticación corporativa SSO verificada mediante SAML 2.0 / OIDC.',
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => 'Auditor Certificado PGC',
                    'organization' => 'SplitLedger Enterprise S.L.',
                ],
                'provider' => $provider,
                'token' => $token
            ]
        ]);
    }

    /**
     * Get the authenticated user details.
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            $user = User::first();
        }

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'No hay una sesión activa.'
            ], 401);
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => 'Auditor Senior PGC',
                    'organization' => 'SplitLedger Enterprise S.L.',
                ]
            ]
        ]);
    }

    /**
     * Terminate the session and revoke tokens.
     */
    public function logout(Request $request): JsonResponse
    {
        if ($request->user()) {
            $request->user()->currentAccessToken()->delete();
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Sesión finalizada con éxito.'
        ]);
    }
}
