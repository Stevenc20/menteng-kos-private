<?php

namespace App\Http\Controllers;

use App\Models\Agreement;
use App\Models\AgreementSignature;
use App\Models\Property;
use App\Models\Tenancy;
use App\Models\TenantProfile;
use App\Services\AgreementStatementService;
use App\Services\KtpOcrService;
use App\Services\ProrataBillingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class OnboardingController extends Controller
{
    /**
     * Resolve the tenancy this request operates on.
     *
     * When the route carries a {tenancy} parameter (admin-driven onboarding) the
     * explicitly targeted tenancy is used. Otherwise (tenant self-onboarding) the
     * tenancy of the currently authenticated TENANT is used (existing behaviour).
     *
     * When $require is false the tenancy may be null (tenant with no tenancy yet),
     * which several KTP/profile helpers legitimately tolerate.
     */
    protected function contextTenancy(Request $request, bool $require = true): ?Tenancy
    {
        if ($request->route() && $request->route()->hasParameter('tenancy')) {
            $tenancy = Tenancy::with(['user', 'property'])->findOrFail((int) $request->route('tenancy'));
            abort_unless($tenancy->user && $tenancy->user->role === 'TENANT', 403, 'Target bukan tenant.');

            return $tenancy;
        }

        $user = $request->user();
        abort_unless($user && $user->role === 'TENANT', 403, 'Unauthorized.');

        $tenancy = Tenancy::with('property')->where('user_id', $user->id)->first();

        if ($require && ! $tenancy) {
            abort(404, 'Belum ada tenancy.');
        }

        return $tenancy;
    }

    /**
     * Display the onboarding wizard.
     */
    public function show(Request $request)
    {
        $isAdminContext = $request->route() && $request->route()->hasParameter('tenancy');

        $user = Auth::user();

        // Ensure user is a TENANT (tenant-facing route only)
        if (! $isAdminContext && $user->role !== 'TENANT') {
            return redirect('/dashboard');
        }

        $tenancy = $isAdminContext
            ? Tenancy::with('property')->findOrFail((int) $request->route('tenancy'))
            : Tenancy::with('property')->where('user_id', $user->id)->first();

        if (! $tenancy) {
            // If completely no tenancy exists (not invited properly)
            abort(403, 'Belum ada undangan sewa untuk akun Anda. Silakan hubungi Admin.');
        }

        $profile = TenantProfile::where('user_id', $tenancy->user_id)->first();

        // Admin-driven onboarding: always render the wizard so the admin can fill/continue.
        if ($isAdminContext) {
            $agreement = Agreement::where('tenancy_id', $tenancy->id)->first();

            return Inertia::render('Admin/TenantOnboarding', [
                'tenancy' => $tenancy,
                'profile' => $profile ?? (object) [],
                'agreement' => $agreement ? [
                    'has_uploaded_document' => (bool) $agreement->uploaded_document_path,
                    'uploaded_document_type' => $agreement->uploaded_document_type,
                    'has_digital_document' => (bool) $agreement->document_html,
                    'document_html' => $agreement->document_html,
                    'meteran_start' => $agreement->meteran_start,
                    'notes' => $agreement->notes,
                    'status' => $agreement->status,
                    'version' => $agreement->version ?? 1,
                ] : null,
            ]);
        }

        // Already active: show approval confirmation if approved via this workflow,
        // otherwise go straight to the dashboard (existing behaviour).
        if (in_array($tenancy->status, ['ACTIVE', 'NOT_CONTINUE', 'SUSPENDED'])) {
            if ($tenancy->status === 'ACTIVE' && $tenancy->approval_status === 'APPROVED') {
                $agreement = Agreement::where('tenancy_id', $tenancy->id)->first();

                return Inertia::render('Tenant/Onboarding/ApprovedApproval', [
                    'tenancy' => $tenancy,
                    'agreement' => $agreement,
                ]);
            }

            return redirect('/tenant/dashboard');
        }

        // Rejected / waiting for approval → show status page (pending or needs-revision)
        if (in_array($tenancy->status, ['AGREEMENT_SUBMITTED', 'PENDING_ADMIN_APPROVAL'])) {
            $agreement = Agreement::where('tenancy_id', $tenancy->id)->first();

            return Inertia::render('Tenant/Onboarding/WaitingApproval', [
                'tenancy' => $tenancy,
                'agreement' => $agreement,
            ]);
        }

        // If admin has already prepared & saved the statement (status DRAFT) for the tenant
        // to read, initial (paraf), and sign digitally, render the read-only statement signing page.
        $agreement = Agreement::where('tenancy_id', $tenancy->id)->first();
        if ($agreement && $agreement->status === 'DRAFT' && filled($agreement->document_html)) {
            $signatures = AgreementSignature::where('agreement_id', $agreement->id)->get();

            return Inertia::render('Tenant/Onboarding/SignStatement', [
                'tenancy' => $tenancy,
                'profile' => $profile ?? (object) [],
                'agreement' => $agreement,
                'signatures' => $signatures,
            ]);
        }

        // Onboarding data is now filled by the admin. Tenants (invited, in progress,
        // or agreement pending) are never pushed into the wizard — go straight to the
        // dashboard. Legacy tenants mid-onboarding are not forced to complete it.
        return redirect('/tenant/dashboard');
    }

    /**
     * Returns the latest profile from the database to hydrate the wizard.
     */
    public function getProfile(Request $request)
    {
        $tenancy = $this->contextTenancy($request, false);
        $userId = $tenancy?->user_id ?? $request->user()->id;

        $profile = TenantProfile::where('user_id', $userId)->first();

        return response()->json([
            'ok' => true,
            'profile' => $profile ? $profile->only([
                'ktp_1_photo', 'ktp_1_name', 'ktp_1_nik', 'ktp_1_birth_place', 'ktp_1_birth_date', 'ktp_1_job', 'ktp_1_address',
                'ktp_2_photo', 'ktp_2_name', 'ktp_2_nik', 'ktp_2_birth_place', 'ktp_2_birth_date', 'ktp_2_job', 'ktp_2_address',
            ]) : (object) [],
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
        $tenancy = $this->contextTenancy($request);
        $isAdminContext = $request->route() && $request->route()->hasParameter('tenancy');

        // When admin has already prepared the tenant's onboarding & statement, the tenant
        // cannot re-enter or modify identity/KTP data (admin fixes any errors).
        if (! $isAdminContext) {
            $existingAgreement = Agreement::where('tenancy_id', $tenancy->id)->first();
            if ($existingAgreement && filled($existingAgreement->document_html)) {
                abort(403, 'Data identitas dikelola oleh Admin. Silakan hubungi Admin jika ada perbaikan data.');
            }
        }

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

        $profile = TenantProfile::where('user_id', $tenancy->user_id)->first()
            ?? new TenantProfile(['user_id' => $tenancy->user_id]);

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
        if (! $request->boolean('has_second_occupant')) {
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
        $tenancy = $this->contextTenancy($request, false);
        $userId = $tenancy?->user_id ?? $request->user()->id;

        $request->validate([
            'ktp_1_photo' => 'nullable|image',
            'ktp_2_photo' => 'nullable|image',
        ]);

        if (! $request->hasFile('ktp_1_photo') && ! $request->hasFile('ktp_2_photo')) {
            return response()->json(['ok' => false, 'message' => 'No KTP photo file was received. Silakan coba lagi.'], 422);
        }

        $profile = TenantProfile::where('user_id', $userId)->first()
            ?? new TenantProfile(['user_id' => $userId]);

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
            Log::error('KTP upload: database persist threw. '.$e->getMessage());
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
                    Log::error('KTP OCR failed for occupant 1: '.$e->getMessage());
                    $ocrResults['ktp_1'] = ['error' => 'OCR processing failed'];
                }

                // GANTI KTP: Jangan me-merge data KTP lama dengan KTP baru.
                // Kosongkan semua field identitas lama (untuk penghuni ini) terlebih dahulu.
                foreach (['name', 'nik', 'birth_place', 'birth_date', 'job', 'address'] as $field) {
                    $profile->{'ktp_1_'.$field} = null;
                }

                // Masukkan HANYA data dari OCR KTP terbaru
                if (isset($ocr) && ! isset($ocr['error'])) {
                    foreach (['name', 'nik', 'birth_place', 'birth_date', 'job', 'address'] as $field) {
                        if (isset($ocr[$field]) && $ocr[$field] !== '') {
                            $profile->{'ktp_1_'.$field} = $ocr[$field];
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
                    Log::error('KTP OCR failed for occupant 2: '.$e->getMessage());
                    $ocrResults['ktp_2'] = ['error' => 'OCR processing failed'];
                }

                // GANTI KTP: Jangan me-merge data KTP lama dengan KTP baru.
                foreach (['name', 'nik', 'birth_place', 'birth_date', 'job', 'address'] as $field) {
                    $profile->{'ktp_2_'.$field} = null;
                }

                if (isset($ocr) && ! isset($ocr['error'])) {
                    foreach (['name', 'nik', 'birth_place', 'birth_date', 'job', 'address'] as $field) {
                        if (isset($ocr[$field]) && $ocr[$field] !== '') {
                            $profile->{'ktp_2_'.$field} = $ocr[$field];
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
    public function getKtpPhoto(Request $request, string $kind)
    {
        $tenancy = $this->contextTenancy($request, false);
        $userId = $tenancy?->user_id ?? $request->user()->id;
        $profile = TenantProfile::where('user_id', $userId)->first();

        $path = $kind === 'ktp_2' ? ($profile->ktp_2_photo ?? null) : ($profile->ktp_1_photo ?? null);

        if (! $path || ! Storage::disk('local')->exists($path)) {
            abort(404);
        }

        return Storage::disk('local')->response($path);
    }

    /**
     * Submit Agreement and Signatures (or save prepared statement draft by Admin)
     */
    public function submitAgreement(Request $request)
    {
        $tenancy = $this->contextTenancy($request);
        $isAdminContext = $request->route() && $request->route()->hasParameter('tenancy');
        $saveOnly = $isAdminContext && ($request->boolean('save_only') || empty($request->input('signature_1')));

        // Enforce that a tenant cannot modify identity, KTP, room, rent price, move-in date,
        // due date, facilities, or statement content when admin has already prepared a DRAFT statement.
        $existingAgreement = Agreement::where('tenancy_id', $tenancy->id)->first();
        $isPreparedByAdmin = ! $isAdminContext && $existingAgreement && $existingAgreement->status === 'DRAFT' && filled($existingAgreement->document_html);

        $validated = $request->validate([
            'document_html' => 'required|string',
            'signature_1' => $saveOnly ? 'nullable|string' : 'required|string',
            'paraf_1' => $saveOnly ? 'nullable|string' : 'required|string',
            'signature_2' => 'nullable|string',
            'paraf_2' => 'nullable|string',
            'move_in_date' => $isPreparedByAdmin ? 'nullable|date' : 'required|date',
            'agreed_price' => 'nullable|numeric|min:0',
            'due_date_day' => 'nullable|integer|min:1|max:31',
            'water_allowance' => 'nullable|integer|min:0|max:10',
            'meteran_air' => 'nullable|string',
            'notes' => 'nullable|string',
            'usaha' => 'nullable|string|max:255',
            'denda_per_day' => 'nullable|numeric|min:0',
            'facilities' => 'nullable|array',
            'facilities.*' => 'nullable|string',
            'initial_paid_until' => 'nullable|date',
            'initial_payment_status' => 'nullable|string|in:UNPAID,PAID,PENDING_PAYMENT',
            'prorata_basis_mode' => 'nullable|string|in:ACTUAL,30_DAYS',
            'prorata_end_date' => 'nullable|date',
            'prorata_status' => 'nullable|string|in:UNPAID,PENDING_PAYMENT,PAID,NOT_APPLICABLE',
        ]);

        // Admin-only Save (Simpan Data Awal & Surat Pernyataan untuk Ditandatangani Tenant)
        if ($saveOnly) {
            DB::transaction(function () use ($tenancy, $validated) {
                $previousTerms = AgreementStatementService::snapshotTerms($tenancy);

                $cleanFacilities = isset($validated['facilities']) && is_array($validated['facilities'])
                    ? array_values(array_filter(array_map(fn ($f) => trim((string) $f), $validated['facilities']), fn ($f) => $f !== ''))
                    : $tenancy->facilities;

                $dueDay = ! empty($validated['due_date_day']) ? (int) $validated['due_date_day'] : ($tenancy->due_day ?? 1);

                $tenancyUpdate = [
                    'status' => in_array($tenancy->status, ['INVITED', 'ONBOARDING_IN_PROGRESS']) ? 'AGREEMENT_PENDING' : $tenancy->status,
                    'move_in_date' => $validated['move_in_date'] ?? $tenancy->move_in_date,
                    'due_day' => $dueDay,
                    'facilities' => $cleanFacilities,
                    'usaha' => $validated['usaha'] ?? $tenancy->usaha,
                    'denda_per_day' => isset($validated['denda_per_day']) ? (float) $validated['denda_per_day'] : $tenancy->denda_per_day,
                    'water_allowance' => isset($validated['water_allowance']) ? (int) $validated['water_allowance'] : $tenancy->water_allowance,
                ];
                if (isset($validated['agreed_price']) && $validated['agreed_price'] !== '') {
                    $tenancyUpdate['agreed_price'] = (float) $validated['agreed_price'];
                }

                $tenancy->update($tenancyUpdate);

                // Sync property facilities if provided by admin so future documents can reuse them
                if (is_array($cleanFacilities) && count($cleanFacilities) > 0 && $tenancy->property) {
                    $tenancy->property->update(['facilities' => $cleanFacilities]);
                }

                // Sync prorata & initial payment if initial_paid_until is provided
                if (array_key_exists('initial_paid_until', $validated) && ! empty($validated['initial_paid_until'])) {
                    ProrataBillingService::syncTenancyProrata($tenancy, [
                        'agreed_price' => $tenancy->agreed_price,
                        'move_in_date' => $tenancy->move_in_date,
                        'due_day' => $dueDay,
                        'initial_paid_until' => $validated['initial_paid_until'],
                        'initial_payment_status' => $validated['initial_payment_status'] ?? 'PAID',
                        'prorata_basis_mode' => $validated['prorata_basis_mode'] ?? 'ACTUAL',
                        'prorata_end_date' => $validated['prorata_end_date'] ?? null,
                        'prorata_status' => $validated['prorata_status'] ?? 'PENDING_PAYMENT',
                    ]);
                }

                $tenancy->refresh();
                $docHtml = AgreementStatementService::injectOrUpdatePaymentTermsBlock($validated['document_html'], $tenancy);

                $existing = Agreement::where('tenancy_id', $tenancy->id)->first();
                if ($existing && $existing->status === 'SIGNED') {
                    // Track revision if already signed
                    AgreementStatementService::recordTermsRevisionIfNeeded(
                        $tenancy,
                        $previousTerms,
                        Auth::id(),
                        'Pembaruan data onboarding & ketentuan pembayaran oleh Admin.'
                    );
                    $existing->update([
                        'meteran_start' => $validated['meteran_air'] ?? $existing->meteran_start,
                        'notes' => $validated['notes'] ?? $existing->notes,
                    ]);
                } else {
                    Agreement::updateOrCreate(
                        ['tenancy_id' => $tenancy->id],
                        [
                            'document_html' => $docHtml,
                            'meteran_start' => $validated['meteran_air'] ?? null,
                            'notes' => $validated['notes'] ?? null,
                            'status' => 'DRAFT',
                        ]
                    );
                }

                // Update user name from KTP 1 if user still has placeholder name
                $profile = TenantProfile::where('user_id', $tenancy->user_id)->first();
                if ($profile && filled($profile->ktp_1_name) && $tenancy->user && in_array($tenancy->user->name, ['Invited Tenant', ''], true)) {
                    $tenancy->user->update(['name' => $profile->ktp_1_name]);
                }
            });

            return redirect()->route('admin.tenants.show', $tenancy->id)
                ->with('success', 'Data awal dan Surat Pernyataan berhasil disimpan. Tenant dapat login untuk membaca, memberi paraf, dan menandatangani surat.');
        }

        // If admin context also sent prorata fields during direct sign-and-activate
        if ($isAdminContext && ! empty($validated['initial_paid_until'])) {
            ProrataBillingService::syncTenancyProrata($tenancy, [
                'agreed_price' => $validated['agreed_price'] ?? $tenancy->agreed_price,
                'move_in_date' => $validated['move_in_date'] ?? $tenancy->move_in_date,
                'due_day' => ! empty($validated['due_date_day']) ? (int) $validated['due_date_day'] : ($tenancy->due_day ?? 1),
                'initial_paid_until' => $validated['initial_paid_until'],
                'initial_payment_status' => $validated['initial_payment_status'] ?? 'PAID',
                'prorata_basis_mode' => $validated['prorata_basis_mode'] ?? 'ACTUAL',
                'prorata_end_date' => $validated['prorata_end_date'] ?? null,
                'prorata_status' => $validated['prorata_status'] ?? 'PENDING_PAYMENT',
            ]);
            $tenancy->refresh();
        }

        $finalHtml = $isAdminContext
            ? AgreementStatementService::injectOrUpdatePaymentTermsBlock($validated['document_html'], $tenancy)
            : $validated['document_html'];

        $agreement = Agreement::updateOrCreate(
            ['tenancy_id' => $tenancy->id],
            [
                'document_html' => $finalHtml,
                'meteran_start' => $isPreparedByAdmin
                    ? ($existingAgreement->meteran_start ?? $validated['meteran_air'] ?? null)
                    : ($validated['meteran_air'] ?? null),
                'notes' => $isPreparedByAdmin
                    ? ($existingAgreement->notes ?? $validated['notes'] ?? null)
                    : ($validated['notes'] ?? null),
                'status' => 'SIGNED',
                'signed_at' => now(),
            ]
        );

        // Save Occupant 1 Signature
        AgreementSignature::updateOrCreate(
            ['agreement_id' => $agreement->id, 'occupant_type' => 'OCCUPANT_1'],
            [
                'signature_image' => $validated['signature_1'],
                'paraf_image' => $validated['paraf_1'],
            ]
        );

        // Save Occupant 2 Signature if provided
        if (! empty($validated['signature_2']) && ! empty($validated['paraf_2'])) {
            AgreementSignature::updateOrCreate(
                ['agreement_id' => $agreement->id, 'occupant_type' => 'OCCUPANT_2'],
                [
                    'signature_image' => $validated['signature_2'],
                    'paraf_image' => $validated['paraf_2'],
                ]
            );
        }

        // Admin-driven onboarding: the admin has already reviewed & verified the
        // data, so the tenancy is activated immediately (no further approval step).
        if ($isAdminContext) {
            DB::transaction(function () use ($tenancy, $validated) {
                $tenancyUpdate = [
                    'status' => 'ACTIVE',
                    'approval_status' => 'APPROVED',
                    'approved_at' => now(),
                    'approved_by' => Auth::id(),
                    'rejection_reason' => null,
                    'move_in_date' => $validated['move_in_date'],
                ];
                if (! empty($validated['due_date_day'])) {
                    $tenancyUpdate['due_day'] = $validated['due_date_day'];
                }

                $tenancy->update($tenancyUpdate);

                // Jika ada water allowance khusus (misal 3m³ untuk harian/transit) dan ada water period yang masih aktif
                if (isset($validated['water_allowance'])) {
                    $openPeriod = $tenancy->openWaterPeriod();
                    if ($openPeriod) {
                        $openPeriod->update(['allowance' => (int) $validated['water_allowance']]);
                    }
                }

                $property = Property::find($tenancy->property_id);
                if ($property && $property->status !== 'OCCUPIED') {
                    $property->update(['status' => 'OCCUPIED']);
                }
            });

            return redirect()->route('admin.tenants')->with('success', 'Data penghuni berhasil disimpan dan tenant diaktifkan.');
        }

        // Tenant context: if admin prepared the DRAFT statement, do NOT let the tenant
        // overwrite move_in_date or due_day (keep admin's values as single source of truth).
        $tenantUpdate = [
            'status' => 'PENDING_ADMIN_APPROVAL',
        ];
        if (! $isPreparedByAdmin && ! empty($validated['move_in_date'])) {
            $tenantUpdate['move_in_date'] = $validated['move_in_date'];
        }
        if (! $isPreparedByAdmin && ! empty($validated['due_date_day'])) {
            $tenantUpdate['due_day'] = $validated['due_date_day'];
        }
        $tenancy->update($tenantUpdate);

        return redirect()->route('tenant.onboarding')->with('success', 'Agreement submitted successfully.');
    }
}
