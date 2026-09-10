<?php

namespace App\Http\Controllers;

use App\Models\Tenancy;
use App\Models\TenantProfile;
use App\Models\Agreement;
use App\Models\AgreementSignature;
use App\Services\KtpOcrService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class OnboardingController extends Controller
{
    /**
     * Display the onboarding wizard.
     */
    public function show()
    {
        $user = Auth::user();
        
        // Ensure user is a TENANT
        if ($user->role !== 'TENANT') {
            return redirect('/dashboard');
        }

        $tenancy = Tenancy::with('property')->where('user_id', $user->id)->first();

        if (!$tenancy) {
            // If completely no tenancy exists (not invited properly)
            abort(403, 'Belum ada undangan sewa untuk akun Anda. Silakan hubungi Admin.');
        }

        // Already active: show approval confirmation if approved via this workflow,
        // otherwise go straight to the dashboard (existing behaviour).
        if (in_array($tenancy->status, ['ACTIVE', 'NOT_CONTINUE', 'SUSPENDED'])) {
            if ($tenancy->status === 'ACTIVE' && $tenancy->approval_status === 'APPROVED') {
                $agreement = Agreement::where('tenancy_id', $tenancy->id)->first();
                return Inertia::render('Tenant/Onboarding/ApprovedApproval', [
                    'tenancy' => $tenancy,
                    'agreement' => $agreement
                ]);
            }
            return redirect('/tenant/dashboard');
        }

        // Not in an onboarding-able status → redirect to whatever applies
        if (!in_array($tenancy->status, ['INVITED', 'ONBOARDING_IN_PROGRESS', 'AGREEMENT_PENDING', 'AGREEMENT_SUBMITTED', 'PENDING_ADMIN_APPROVAL'])) {
            return redirect('/tenant/dashboard');
        }

        $profile = TenantProfile::where('user_id', $user->id)->first();
        
        // Rejected / waiting for approval → show status page (pending or needs-revision)
        if (in_array($tenancy->status, ['AGREEMENT_SUBMITTED', 'PENDING_ADMIN_APPROVAL'])) {
            $agreement = Agreement::where('tenancy_id', $tenancy->id)->first();
            return Inertia::render('Tenant/Onboarding/WaitingApproval', [
                'tenancy' => $tenancy,
                'agreement' => $agreement
            ]);
        }

        return Inertia::render('Tenant/Onboarding/Wizard', [
            'tenancy' => $tenancy,
            'profile' => $profile ?? (object)[]
        ]);
    }

    /**
     * Returns the latest profile from the database to hydrate the wizard.
     */
    public function getProfile()
    {
        $user = Auth::user();
        if ($user->role !== 'TENANT') {
            return response()->json(['ok' => false, 'message' => 'Unauthorized.'], 403);
        }

        $profile = TenantProfile::where('user_id', $user->id)->first();
        
        return response()->json([
            'ok' => true,
            'profile' => $profile ? $profile->only([
                'ktp_1_photo', 'ktp_1_name', 'ktp_1_nik', 'ktp_1_birth_place', 'ktp_1_birth_date', 'ktp_1_job', 'ktp_1_address',
                'ktp_2_photo', 'ktp_2_name', 'ktp_2_nik', 'ktp_2_birth_place', 'ktp_2_birth_date', 'ktp_2_job', 'ktp_2_address',
            ]) : (object)[],
        ]);
    }

    /**
     * Allow a rejected tenant to go back to the wizard and fix their data.
     */
    public function revise()
    {
        $user = Auth::user();
        $tenancy = Tenancy::where('user_id', $user->id)
            ->where('status', 'PENDING_ADMIN_APPROVAL')
            ->where('approval_status', 'REJECTED')
            ->firstOrFail();

        $tenancy->update([
            'status' => 'ONBOARDING_IN_PROGRESS',
            'approval_status' => 'PENDING',
            'rejection_reason' => null,
        ]);

        return redirect()->route('tenant.onboarding');
    }

    /**
     * Handle KTP upload and personal info submission.
     */
    public function storeInfo(Request $request)
    {
        $user = Auth::user();
        $tenancy = Tenancy::where('user_id', $user->id)->firstOrFail();

        $validated = $request->validate([
            'whatsapp' => 'required|string',
            'ktp_1_name' => 'required|string',
            'ktp_1_nik' => 'required|string',
            'ktp_1_birth_place' => 'required|string',
            'ktp_1_birth_date' => 'required|date',
            'ktp_1_job' => 'required|string',
            'ktp_1_address' => 'required|string',
            'ktp_1_photo' => 'nullable',

            'has_second_occupant' => 'required|boolean',

            'ktp_2_name' => 'nullable|required_if:has_second_occupant,true|string',
            'ktp_2_nik' => 'nullable|required_if:has_second_occupant,true|string',
            'ktp_2_birth_place' => 'nullable|required_if:has_second_occupant,true|string',
            'ktp_2_birth_date' => 'nullable|required_if:has_second_occupant,true|date',
            'ktp_2_job' => 'nullable|required_if:has_second_occupant,true|string',
            'ktp_2_address' => 'nullable|required_if:has_second_occupant,true|string',
            'ktp_2_photo' => 'nullable',
        ]);

        $profileData = $validated;

        // Photo paths must NEVER be derived from the validated payload: storeInfo is
        // not the upload commit point, and a missing file field must not wipe a path.
        unset($profileData['ktp_1_photo'], $profileData['ktp_2_photo'], $profileData['has_second_occupant']);

        $profile = TenantProfile::where('user_id', $user->id)->first()
            ?? new TenantProfile(['user_id' => $user->id]);

        $replacedPaths = [];
        $newPaths = [];

        // Secure file upload to PRIVATE storage (disk 'local' root is already app/private).
        if ($request->hasFile('ktp_1_photo')) {
            $path = $this->storeKtpFile($request->file('ktp_1_photo'));
            $replacedPaths[] = $profile->ktp_1_photo;
            $newPaths[] = $path;
            $profileData['ktp_1_photo'] = $path;
        }

        if ($request->boolean('has_second_occupant') && $request->hasFile('ktp_2_photo')) {
            $path = $this->storeKtpFile($request->file('ktp_2_photo'));
            $replacedPaths[] = $profile->ktp_2_photo;
            $newPaths[] = $path;
            $profileData['ktp_2_photo'] = $path;
        }

        // If no second occupant, clear out occupant 2 data (including its photo path).
        if (!$request->boolean('has_second_occupant')) {
            $profileData['ktp_2_name'] = null;
            $profileData['ktp_2_nik'] = null;
            $profileData['ktp_2_birth_place'] = null;
            $profileData['ktp_2_birth_date'] = null;
            $profileData['ktp_2_job'] = null;
            $profileData['ktp_2_address'] = null;
            $profileData['ktp_2_photo'] = null;
        }

        $profile->fill($profileData);
        $saved = $profile->save();

        if (! $saved) {
            foreach ($newPaths as $path) {
                Storage::disk('local')->delete($path);
            }
            abort(500, 'Gagal menyimpan data profil. Silakan coba lagi.');
        }

        foreach (array_filter($replacedPaths) as $old) {
            Storage::disk('local')->delete($old);
        }

        // Update Tenancy Status
        $tenancy->update(['status' => 'AGREEMENT_PENDING']);

        return redirect()->back()->with('success', 'Information saved successfully.');
    }

    /**
     * Upload KTP photos (occupant 1 and/or 2) to PRIVATE storage, atomically.
     *
     * Persist order: file -> disk; path -> tenant_profiles -> commit. The response
     * only reports success AFTER the database row persists. If the database write
     * fails, the freshly stored files are removed so no orphan is left behind.
     */
    public function uploadKtp(Request $request)
    {
        $user = Auth::user();

        if ($user->role !== 'TENANT') {
            return response()->json(['ok' => false, 'message' => 'Unauthorized.'], 403);
        }

        $request->validate([
            'ktp_1_photo' => 'nullable|image',
            'ktp_2_photo' => 'nullable|image',
        ]);

        if (!$request->hasFile('ktp_1_photo') && !$request->hasFile('ktp_2_photo')) {
            return response()->json(['ok' => false, 'message' => 'No KTP photo file was received. Silakan coba lagi.'], 422);
        }

        $profile = TenantProfile::where('user_id', $user->id)->first()
            ?? new TenantProfile(['user_id' => $user->id]);

        $newPaths = [];
        $replacedPaths = [];

        if ($request->hasFile('ktp_1_photo')) {
            $path = $this->storeKtpFile($request->file('ktp_1_photo'));
            $newPaths['ktp_1_photo'] = $path;
            $replacedPaths[] = $profile->ktp_1_photo;
            $profile->ktp_1_photo = $path;
        }

        if ($request->hasFile('ktp_2_photo')) {
            $path = $this->storeKtpFile($request->file('ktp_2_photo'));
            $newPaths['ktp_2_photo'] = $path;
            $replacedPaths[] = $profile->ktp_2_photo;
            $profile->ktp_2_photo = $path;
        }

        try {
            $saved = $profile->save();
        } catch (\Throwable $e) {
            $saved = false;
            Log::error('KTP upload: database persist threw. ' . $e->getMessage());
        }

        if (! $saved) {
            foreach (array_values($newPaths) as $path) {
                Storage::disk('local')->delete($path);
            }
            Log::error('KTP upload: database persist failed, removed uploaded file(s).');

            return response()->json(['ok' => false, 'message' => 'Gagal menyimpan data. Silakan coba lagi.'], 500);
        }

        // Only now is it safe to remove replaced photos.
        foreach (array_filter($replacedPaths) as $old) {
            Storage::disk('local')->delete($old);
        }

        // Run OCR on uploaded photos (best-effort, may never break persistence).
        // Resolved from the container so tests can swap the engine.
        $ocrService = app(KtpOcrService::class);
        $ocrResults = [];

        if (isset($newPaths['ktp_1_photo'])) {
            $absolutePath = Storage::disk('local')->path($newPaths['ktp_1_photo']);
            Log::info('KTP upload received for occupant 1', ['path' => $newPaths['ktp_1_photo'], 'absolute' => $absolutePath, 'exists' => file_exists($absolutePath)]);
            if (file_exists($absolutePath)) {
                try {
                    Log::info('KTP OCR started for occupant 1');
                    $ocr = $ocrService->extract($absolutePath);
                    Log::info('KTP OCR parsed result for occupant 1', ['data' => $ocr]);
                    $ocrResults['ktp_1'] = $ocr;
                } catch (\Exception $e) {
                    Log::error('KTP OCR failed for occupant 1: ' . $e->getMessage());
                    $ocrResults['ktp_1'] = ['error' => 'OCR processing failed'];
                }

                // GANTI KTP: Jangan me-merge data KTP lama dengan KTP baru.
                // Kosongkan semua field identitas lama (untuk penghuni ini) terlebih dahulu.
                foreach (['name', 'nik', 'birth_place', 'birth_date', 'job', 'address'] as $field) {
                    $profile->{'ktp_1_' . $field} = null;
                }

                // Masukkan HANYA data dari OCR KTP terbaru
                if (isset($ocr) && !isset($ocr['error'])) {
                    foreach (['name', 'nik', 'birth_place', 'birth_date', 'job', 'address'] as $field) {
                        if (isset($ocr[$field]) && $ocr[$field] !== '') {
                            $profile->{'ktp_1_' . $field} = $ocr[$field];
                        }
                    }
                }
                $profile->save();
                Log::info('KTP photo replaced for occupant 1; identity fully reset to new OCR result');
            }
        }

        if (isset($newPaths['ktp_2_photo'])) {
            $absolutePath = Storage::disk('local')->path($newPaths['ktp_2_photo']);
            Log::info('KTP upload received for occupant 2', ['path' => $newPaths['ktp_2_photo'], 'absolute' => $absolutePath, 'exists' => file_exists($absolutePath)]);
            if (file_exists($absolutePath)) {
                try {
                    Log::info('KTP OCR started for occupant 2');
                    $ocr = $ocrService->extract($absolutePath);
                    Log::info('KTP OCR parsed result for occupant 2', ['data' => $ocr]);
                    $ocrResults['ktp_2'] = $ocr;
                } catch (\Exception $e) {
                    Log::error('KTP OCR failed for occupant 2: ' . $e->getMessage());
                    $ocrResults['ktp_2'] = ['error' => 'OCR processing failed'];
                }

                // GANTI KTP: Jangan me-merge data KTP lama dengan KTP baru.
                foreach (['name', 'nik', 'birth_place', 'birth_date', 'job', 'address'] as $field) {
                    $profile->{'ktp_2_' . $field} = null;
                }

                if (isset($ocr) && !isset($ocr['error'])) {
                    foreach (['name', 'nik', 'birth_place', 'birth_date', 'job', 'address'] as $field) {
                        if (isset($ocr[$field]) && $ocr[$field] !== '') {
                            $profile->{'ktp_2_' . $field} = $ocr[$field];
                        }
                    }
                }
                $profile->save();
                Log::info('KTP photo replaced for occupant 2; identity fully reset to new OCR result');
            }
        }

        // Source of truth terbaru untuk frontend: kembalikan snapshot profil yang
        // barusan disimpan supaya Wizard selalu sinkron dengan database.
        $profile->refresh();

        Log::info('KTP OCR response returned to frontend', ['ocr' => $ocrResults]);
        return response()->json(array_merge(['ok' => true], $newPaths, [
            'profile' => $profile->only([
                'ktp_1_photo', 'ktp_1_name', 'ktp_1_nik', 'ktp_1_birth_place', 'ktp_1_birth_date', 'ktp_1_job', 'ktp_1_address',
                'ktp_2_photo', 'ktp_2_name', 'ktp_2_nik', 'ktp_2_birth_place', 'ktp_2_birth_date', 'ktp_2_job', 'ktp_2_address',
            ]),
            'ocr' => $ocrResults,
        ]));
    }

    /**
     * Persist an uploaded KTP file on the 'local' disk.
     *
     * Disk root is already storage/app/private (config/filesystems.php), so the
     * relative folder passed here is the FOLDER INSIDE that root. Storing 'ktp'
     * yields storage/app/private/ktp/<hash> — never private/private/ktp.
     */
    private function storeKtpFile($file): string
    {
        return $file->store('ktp', 'local');
    }

    /**
     * Serve the uploaded KTP photo to its owner (private storage).
     */
    public function getKtpPhoto(string $kind)
    {
        $user = Auth::user();
        $profile = TenantProfile::where('user_id', $user->id)->first();

        $path = $kind === 'ktp_2' ? ($profile->ktp_2_photo ?? null) : ($profile->ktp_1_photo ?? null);

        if (!$path || !Storage::disk('local')->exists($path)) {
            abort(404);
        }

        return Storage::disk('local')->response($path);
    }

    /**
     * Submit Agreement and Signatures
     */
    public function submitAgreement(Request $request)
    {
        $user = Auth::user();
        $tenancy = Tenancy::where('user_id', $user->id)->firstOrFail();

        $validated = $request->validate([
            'document_html' => 'required|string',
            'signature_1' => 'required|string', // Base64 data image
            'paraf_1' => 'required|string',
            'signature_2' => 'nullable|string',
            'paraf_2' => 'nullable|string',
            'move_in_date' => 'required|date',
        ]);

        $agreement = Agreement::updateOrCreate(
            ['tenancy_id' => $tenancy->id],
            [
                'document_html' => $validated['document_html'],
                'status' => 'SIGNED',
                'signed_at' => now(),
            ]
        );

        // Save Occupant 1 Signature
        AgreementSignature::updateOrCreate(
            ['agreement_id' => $agreement->id, 'occupant_type' => 'OCCUPANT_1'],
            [
                'signature_image' => $validated['signature_1'], // Store base64 or decode and save as file
                'paraf_image' => $validated['paraf_1']
            ]
        );

        // Save Occupant 2 Signature if provided
        if (!empty($validated['signature_2']) && !empty($validated['paraf_2'])) {
            AgreementSignature::updateOrCreate(
                ['agreement_id' => $agreement->id, 'occupant_type' => 'OCCUPANT_2'],
                [
                    'signature_image' => $validated['signature_2'],
                    'paraf_image' => $validated['paraf_2']
                ]
            );
        }

        $tenancy->update([
            'status' => 'PENDING_ADMIN_APPROVAL',
            'move_in_date' => $validated['move_in_date'],
        ]);

        return redirect()->route('tenant.onboarding')->with('success', 'Agreement submitted successfully.');
    }
}
