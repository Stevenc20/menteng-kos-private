<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AdminUserController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ContinuationController;
use App\Http\Controllers\MoveOutController;
use App\Http\Controllers\OnboardingController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\WaterMeterController;
use App\Http\Controllers\WaterPeriodController;
use App\Models\Billing;
use App\Models\Property;
use App\Models\Tenancy;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    $properties = Property::with(['media' => function ($q) {
        $q->orderBy('sort_order');
    }])
        ->whereIn('status', ['AVAILABLE', 'UPCOMING_AVAILABLE', 'OCCUPIED'])
        ->get();

    return Inertia::render('welcome', [
        'properties' => $properties,
    ]);
})->name('home');

Route::get('/kamar/{id}', function ($id) {
    $property = Property::with(['media' => function ($q) {
        $q->orderBy('sort_order');
    }])->findOrFail($id);

    return Inertia::render('Public/PropertyDetail', [
        'property' => $property,
    ]);
})->name('property.show');

// Auth Routes (Google OAuth)
Route::get('/auth/google', [AuthController::class, 'redirectToGoogle'])->name('auth.google');
Route::get('/auth/google/callback', [AuthController::class, 'handleGoogleCallback']);
Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

Route::get('/dashboard', function () {
    $user = Auth::user();
    if ($user && $user->role === 'ADMIN') {
        return redirect()->route('admin.dashboard');
    }

    return redirect()->route('tenant.dashboard');
})->middleware('auth')->name('dashboard');

// Admin Routes
Route::middleware(['auth', 'admin'])->prefix('admin')->group(function () {
    Route::get('/dashboard', [AdminController::class, 'dashboard'])->name('admin.dashboard');

    // Properties
    Route::get('/properties', [AdminController::class, 'properties'])->name('admin.properties');
    Route::post('/properties', [AdminController::class, 'storeProperty'])->name('admin.properties.store');
    Route::put('/properties/{id}', [AdminController::class, 'updateProperty'])->name('admin.properties.update');
    Route::delete('/properties/{id}', [AdminController::class, 'destroyProperty'])->name('admin.properties.destroy');

    // Property Media
    Route::post('/properties/{id}/media', [AdminController::class, 'storeMedia'])->name('admin.properties.media.store');
    Route::post('/properties/{id}/media/{mediaId}/cover', [AdminController::class, 'setCoverMedia'])->name('admin.properties.media.cover');
    Route::delete('/properties/{id}/media/{mediaId}', [AdminController::class, 'deleteMedia'])->name('admin.properties.media.destroy');
    Route::post('/properties/{id}/media/reorder', [AdminController::class, 'reorderMedia'])->name('admin.properties.media.reorder');

    // Tenants & Invitations
    Route::get('/tenants', [AdminController::class, 'tenants'])->name('admin.tenants');
    Route::post('/tenants/invite', [AdminController::class, 'inviteTenant'])->name('admin.tenants.invite');

    // Admin Approval Workflow
    Route::get('/tenants/{id}', [AdminController::class, 'showApproval'])->name('admin.tenants.show');
    Route::post('/tenants/{id}/approve', [AdminController::class, 'approveTenant'])->name('admin.tenants.approve');
    Route::post('/tenants/{id}/reject', [AdminController::class, 'rejectTenant'])->name('admin.tenants.reject');
    Route::post('/tenants/{id}/reopen', [AdminController::class, 'reopenApproval'])->name('admin.tenants.reopen');
    Route::put('/tenants/{id}/profile', [AdminController::class, 'updateTenantProfile'])->name('admin.tenants.profile.update');
    Route::put('/tenants/{id}/details', [AdminController::class, 'updateTenancyDetails'])->name('admin.tenants.details.update');
    Route::delete('/tenants/{id}', [AdminController::class, 'destroyTenant'])->name('admin.tenants.destroy');
    Route::get('/tenants/{id}/ktp/{kind}', [AdminController::class, 'getTenantKtpPhoto'])->name('admin.tenants.ktp');
    Route::get('/tenants/{id}/ktp/{kind}/download', [AdminController::class, 'downloadTenantKtpPhoto'])->name('admin.tenants.ktp.download');

    // Tenant Documentations & Agreements
    Route::post('/tenants/{id}/agreements/upload', [AdminController::class, 'uploadAgreementDocument'])->name('admin.tenants.agreements.upload');
    Route::get('/tenants/{id}/agreements/download', [AdminController::class, 'downloadAgreementDocument'])->name('admin.tenants.agreements.download');
    Route::post('/tenants/{id}/agreements/finalize-uploaded', [AdminController::class, 'finalizeUploadedAgreement'])->name('admin.tenants.agreements.finalizeUploaded');
    Route::post('/tenants/{id}/documentations', [AdminController::class, 'storeRoomDocumentation'])->name('admin.tenants.documentations.store');
    Route::delete('/tenants/documentations/media/{mediaId}', [AdminController::class, 'deleteDocumentationMedia'])->name('admin.tenants.documentations.media.destroy');

    // Admin-driven Onboarding Wizard (admin fills tenant onboarding using the same Wizard)
    Route::get('/tenants/{tenancy}/onboarding', [OnboardingController::class, 'show'])->name('admin.tenants.onboarding');
    Route::get('/tenants/{tenancy}/onboarding/profile', [OnboardingController::class, 'getProfile'])->name('admin.tenants.onboarding.profile');
    Route::post('/tenants/{tenancy}/onboarding/info', [OnboardingController::class, 'storeInfo'])->name('admin.tenants.onboarding.info');
    Route::post('/tenants/{tenancy}/onboarding/ktp', [OnboardingController::class, 'uploadKtp'])->name('admin.tenants.onboarding.ktp');
    Route::get('/tenants/{tenancy}/onboarding/ktp/{kind}', [OnboardingController::class, 'getKtpPhoto'])->name('admin.tenants.onboarding.ktp.photo');
    Route::post('/tenants/{tenancy}/onboarding/agreement', [OnboardingController::class, 'submitAgreement'])->name('admin.tenants.onboarding.agreement');

    // Tenant Approvals & Onboarding (Phase 5 - legacy multi-step)
    Route::get('/approvals/{id}', [AdminController::class, 'showApproval'])->name('admin.approvals.show');
    Route::post('/approvals/{id}/approve', [AdminController::class, 'approveData'])->name('admin.approvals.approve');
    Route::post('/approvals/{id}/move-in-doc', [AdminController::class, 'storeMoveInDoc'])->name('admin.approvals.moveInDoc');
    Route::post('/approvals/{id}/water-meter', [AdminController::class, 'storeStartWaterMeter'])->name('admin.approvals.waterMeter');

    // Admin Operations (Phase 6)
    Route::post('/payments/{billingId}/verify', [PaymentController::class, 'verifyPayment'])->name('admin.payments.verify');
    Route::post('/tenants/{tenancyId}/water-meter', [WaterMeterController::class, 'store'])->name('admin.waterMeter.store');

    // Water Meter Monitoring & Billing (Meter Air)
    Route::get('/water', [WaterPeriodController::class, 'index'])->name('admin.water');
    Route::get('/water/{property}', [WaterPeriodController::class, 'show'])->name('admin.water.show');
    Route::post('/water/{property}/start', [WaterPeriodController::class, 'startPeriod'])->name('admin.water.start');
    Route::post('/water/periods/{period}/record', [WaterPeriodController::class, 'recordEnd'])->name('admin.water.record');
    Route::post('/water/periods/{period}/confirm', [WaterPeriodController::class, 'confirmPayment'])->name('admin.water.confirm');
    Route::get('/water/periods/{period}/photo/{kind}', [WaterPeriodController::class, 'getPhoto'])->name('admin.water.photo');
    Route::post('/water/settings', [WaterPeriodController::class, 'updateSettings'])->name('admin.water.settings');
    Route::post('/water/notification/test-email', [WaterPeriodController::class, 'testEmail'])->name('admin.water.testEmail');
    Route::post('/water/notification/test-whatsapp', [WaterPeriodController::class, 'testWhatsApp'])->name('admin.water.testWhatsApp');

    // Move Out & Archiving
    Route::get('/move-out/{tenancyId}', [MoveOutController::class, 'show'])->name('admin.moveOut.show');
    Route::post('/move-out/{tenancyId}/doc', [MoveOutController::class, 'storeDocumentation'])->name('admin.moveOut.storeDoc');
    Route::post('/move-out/{tenancyId}/finalize', [MoveOutController::class, 'finalize'])->name('admin.moveOut.finalize');

    // Admin Users Management
    Route::get('/users', [AdminUserController::class, 'index'])->name('admin.users');
    Route::post('/users', [AdminUserController::class, 'store'])->name('admin.users.store');
    Route::put('/users/{user}', [AdminUserController::class, 'update'])->name('admin.users.update');
    Route::delete('/users/{user}', [AdminUserController::class, 'destroy'])->name('admin.users.destroy');
});

// Tenant Routes
Route::middleware(['auth'])->prefix('tenant')->group(function () {
    // Onboarding Wizard
    Route::get('/onboarding', [OnboardingController::class, 'show'])->name('tenant.onboarding');
    Route::get('/onboarding/profile', [OnboardingController::class, 'getProfile'])->name('tenant.onboarding.profile');
    Route::post('/onboarding/info', [OnboardingController::class, 'storeInfo'])->name('tenant.onboarding.info');
    Route::post('/onboarding/ktp', [OnboardingController::class, 'uploadKtp'])->name('tenant.onboarding.ktp');
    Route::get('/onboarding/ktp/{kind}', [OnboardingController::class, 'getKtpPhoto'])->name('tenant.onboarding.ktp.photo');
    Route::post('/onboarding/agreement', [OnboardingController::class, 'submitAgreement'])->name('tenant.onboarding.agreement');
    Route::post('/onboarding/revise', [OnboardingController::class, 'revise'])->name('tenant.onboarding.revise');

    // Tenant Dashboard
    Route::get('/dashboard', function () {
        $user = Auth::user();
        $tenancy = Tenancy::with('property')->where('user_id', $user->id)->first();

        if (! $tenancy) {
            return redirect('/tenant/onboarding'); // No tenancy at all
        }

        // Onboarding data is now filled by the admin; the tenant lands straight on
        // the dashboard for every status (INVITED → ACTIVE).
        $nextBilling = Billing::where('tenancy_id', $tenancy->id)
            ->where('billing_type', 'RENT')
            ->orderBy('due_date', 'asc')
            ->first();

        return Inertia::render('Tenant/Dashboard', [
            'tenancy' => $tenancy,
            'nextBilling' => $nextBilling,
        ]);
    })->name('tenant.dashboard');

    // Continuation Logic (H-3)
    Route::post('/continuation', [ContinuationController::class, 'submitDecision'])->name('tenant.continuation.submit');

    // Tenant Payment Proof Submission (Phase 6)
    Route::post('/payments/{billingId}/proof', [PaymentController::class, 'submitProof'])->name('tenant.payments.proof');
});

require __DIR__.'/settings.php';
