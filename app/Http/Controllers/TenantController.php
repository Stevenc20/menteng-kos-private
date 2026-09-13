<?php

namespace App\Http\Controllers;

use App\Models\Agreement;
use App\Models\AgreementSignature;
use App\Models\Billing;
use App\Models\RoomDocumentation;
use App\Models\Tenancy;
use App\Models\WaterPeriod;
use App\Services\AgreementStatementService;
use App\Services\DueDateService;
use App\Services\WaterBillingService;
use App\Services\WaterPeriodService;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

/**
 * Tenant-facing portal: Dashboard, Payments, Water Usage and Agreement.
 *
 * Every page is scoped strictly to the logged-in user's own tenancy. Business
 * rules (water allowance/rate, due dates, agreement injection) reuse the same
 * services as the Admin side so tenant and admin always see identical numbers.
 */
class TenantController extends Controller
{
    /** Human-readable Indonesian labels for tenancy lifecycle states. */
    private const TENANCY_STATUS_LABELS = [
        'INVITED' => 'Diundang',
        'ONBOARDING_IN_PROGRESS' => 'Mengisi Data',
        'AGREEMENT_PENDING' => 'Menunggu Surat Pernyataan',
        'AGREEMENT_SUBMITTED' => 'Surat Pernyataan Terkirim',
        'PENDING_ADMIN_APPROVAL' => 'Menunggu Persetujuan Admin',
        'PENDING_MOVE_IN_DOCUMENTATION' => 'Menunggu Dokumentasi Kamar',
        'PENDING_WATER_METER' => 'Menunggu Pencatatan Meter Air',
        'ACTIVE' => 'Aktif',
        'SUSPENDED' => 'Ditangguhkan',
        'NOT_CONTINUE' => 'Tidak Lanjut',
        'INACTIVE' => 'Nonaktif',
        'ARCHIVED' => 'Keluar (Diarsipkan)',
    ];

    private const BILLING_STATUS_LABELS = [
        'UPCOMING' => 'Akan Jatuh Tempo',
        'REMINDER_SENT' => 'Pengingat Terkirim',
        'PENDING_PAYMENT' => 'Menunggu Pembayaran',
        'PENDING_VERIFICATION' => 'Menunggu Verifikasi',
        'PAID' => 'Lunas',
        'OVERDUE' => 'Terlambat',
        'REJECTED' => 'Ditolak',
    ];

    private const WATER_STATUS_LABELS = [
        WaterPeriod::STATUS_METER_DUE => 'Perlu Update Meter',
        WaterPeriod::STATUS_WAITING_PAYMENT => 'Menunggu Pembayaran',
        WaterPeriod::STATUS_PAID => 'Lunas',
    ];

    private const MONTH_NAMES = [
        1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April', 5 => 'Mei',
        6 => 'Juni', 7 => 'Juli', 8 => 'Agustus', 9 => 'September', 10 => 'Oktober',
        11 => 'November', 12 => 'Desember',
    ];

    /**
     * [TENANT] Dashboard for the logged-in tenant.
     */
    public function dashboard()
    {
        $tenancy = $this->currentTenancy();

        if (! $tenancy) {
            return redirect()->route('tenant.onboarding');
        }

        $nextBilling = Billing::where('tenancy_id', $tenancy->id)
            ->where('billing_type', 'RENT')
            ->orderBy('due_date', 'asc')
            ->get()
            ->reject(fn ($b) => $b->status === 'PAID')
            ->first();

        return Inertia::render('Tenant/Dashboard', [
            'tenancy' => $tenancy->load('property'),
            'statusLabel' => self::label($tenancy->status, self::TENANCY_STATUS_LABELS),
            'dueDayLabel' => $this->dueDayLabel($tenancy),
            'nextDueDate' => $this->nextDueDate($tenancy),
            'nextBilling' => $nextBilling ? $this->billingPayload($nextBilling) : null,
            'waterRule' => $this->waterRulePayload($tenancy),
            'hasAgreement' => Agreement::where('tenancy_id', $tenancy->id)->where(function ($q) {
                $q->whereNotNull('document_html')->where('document_html', '!=', '')
                    ->orWhereNotNull('uploaded_document_path');
            })->exists(),
        ]);
    }

    /**
     * [TENANT] Payments page: rent billings + PAM water charges.
     */
    public function payments()
    {
        $tenancy = $this->currentTenancyOrRedirect();

        if (! $tenancy instanceof Tenancy) {
            return $tenancy;
        }

        $billings = Billing::where('tenancy_id', $tenancy->id)
            ->orderBy('due_date', 'desc')
            ->orderBy('id', 'desc')
            ->get();

        $waterCharges = WaterPeriod::where('property_id', $tenancy->property_id)
            ->whereNotNull('total_amount')
            ->orderByDesc('period_year')
            ->orderByDesc('period_month')
            ->orderByDesc('id')
            ->get();

        return Inertia::render('Tenant/Payments', [
            'tenancy' => $tenancy->load('property'),
            'waterRule' => $this->waterRulePayload($tenancy),
            'billings' => $billings->map(fn ($b) => $this->billingPayload($b))->values(),
            'waterCharges' => $waterCharges->map(fn ($p) => $this->waterChargePayload($p))->values(),
        ]);
    }

    /**
     * [TENANT] Water usage page: every period for the unit + the applicable rules.
     */
    public function waterUsage()
    {
        $tenancy = $this->currentTenancyOrRedirect();

        if (! $tenancy instanceof Tenancy) {
            return $tenancy;
        }

        $periods = WaterPeriod::where('property_id', $tenancy->property_id)
            ->orderByDesc('period_year')
            ->orderByDesc('period_month')
            ->orderByDesc('id')
            ->get();

        return Inertia::render('Tenant/WaterUsage', [
            'tenancy' => $tenancy->load('property'),
            'waterRule' => $this->waterRulePayload($tenancy),
            'periods' => $periods->map(fn ($p) => $this->waterPeriodPayload($p))->values(),
        ]);
    }

    /**
     * [TENANT] Agreement page: signed statement, signatures, move-in documentation.
     */
    public function agreement()
    {
        $tenancy = $this->currentTenancyOrRedirect();

        if (! $tenancy instanceof Tenancy) {
            return $tenancy;
        }

        $agreement = Agreement::where('tenancy_id', $tenancy->id)->first();
        $moveInDoc = RoomDocumentation::with('media')
            ->where('tenancy_id', $tenancy->id)
            ->where('documentation_type', 'MOVE_IN')
            ->first();

        if ($agreement && filled($agreement->document_html)) {
            $agreement->document_html = AgreementStatementService::injectDocumentationPhotos(
                $agreement->document_html,
                $moveInDoc
            );
        }

        return Inertia::render('Tenant/Agreement', [
            'tenancy' => $tenancy->load('property'),
            'agreement' => $agreement ? [
                'id' => $agreement->id,
                'status' => $agreement->status,
                'status_label' => $agreement->status === 'SIGNED' ? 'Ditandatangani' : 'Draft',
                'signed_at' => $agreement->signed_at,
                'document_html' => $agreement->document_html,
                'has_uploaded' => (bool) $agreement->uploaded_document_path,
                'uploaded_type' => $agreement->uploaded_document_type,
                'download_url' => $agreement->uploaded_document_path
                    ? route('tenant.agreement.download')
                    : null,
            ] : null,
            'signatures' => AgreementSignature::where('agreement_id', $agreement?->id)
                ->orderBy('occupant_type')
                ->get()
                ->map(fn ($s) => [
                    'occupant_type' => $s->occupant_type,
                    'signature_image' => $s->signature_image,
                    'paraf_image' => $s->paraf_image,
                ]),
            'moveInPhotoUrls' => $moveInDoc?->media->map(fn ($m) => $m->url)->values() ?? collect(),
        ]);
    }

    /**
     * [TENANT] Download the uploaded (scanned/physical) Surat Pernyataan.
     * Ownership is enforced: only the tenancy owner may download it.
     */
    public function agreementDownload()
    {
        $tenancy = $this->currentTenancy();

        if (! $tenancy) {
            abort(404);
        }

        $agreement = Agreement::where('tenancy_id', $tenancy->id)->firstOrFail();

        if (! $agreement->uploaded_document_path || ! Storage::disk('local')->exists($agreement->uploaded_document_path)) {
            abort(404);
        }

        return Storage::disk('local')->download(
            $agreement->uploaded_document_path,
            'Surat_Pernyataan_'.($tenancy->user?->name ?? 'Tenant').'.'.pathinfo($agreement->uploaded_document_path, PATHINFO_EXTENSION)
        );
    }

    /**
     * [TENANT] Serve a water meter photo from private storage.
     * Ownership is enforced: only the tenancy owner may view it.
     */
    public function waterPeriodPhoto($periodId, $kind)
    {
        $period = WaterPeriod::findOrFail($periodId);

        // Ownership is scoped by the UNIT (property), the same link the Admin
        // uses — a period may exist before/without a tenancy snapshot.
        if ($period->property_id !== $this->currentTenancy()?->property_id) {
            abort(403);
        }

        $path = $kind === 'end' ? $period->meter_end_photo : $period->meter_start_photo;

        if (! $path || ! Storage::disk('local')->exists($path)) {
            abort(404);
        }

        return Storage::disk('local')->response($path);
    }

    private function currentTenancy(): ?Tenancy
    {
        return Tenancy::where('user_id', Auth::id())->first();
    }

    /**
     * Redirect to onboarding when the user has no tenancy yet (same behaviour
     * as the original dashboard closure).
     */
    private function currentTenancyOrRedirect(): Tenancy|RedirectResponse
    {
        $tenancy = $this->currentTenancy();

        if (! $tenancy) {
            return redirect()->route('tenant.onboarding');
        }

        return $tenancy;
    }

    private function billingPayload(Billing $billing): array
    {
        $latestProof = $billing->paymentProofs()->latest('id')->first();

        return [
            'id' => $billing->id,
            'billing_type' => $billing->billing_type,
            'amount' => (float) $billing->amount,
            'excess_water_charge' => (float) $billing->excess_water_charge,
            'total' => round((float) $billing->amount + (float) $billing->excess_water_charge),
            'due_date' => $billing->due_date,
            'status' => $billing->status,
            'status_label' => self::label($billing->status, self::BILLING_STATUS_LABELS),
            'period_label' => $this->periodLabelFromDueDate($billing->due_date),
            'is_payable' => in_array($billing->status, ['UPCOMING', 'REMINDER_SENT', 'PENDING_PAYMENT', 'OVERDUE', 'REJECTED'], true),
            'has_pending_proof' => $latestProof?->status === 'PENDING',
            'latest_proof_status' => $latestProof?->status,
        ];
    }

    private function waterPeriodPayload(WaterPeriod $period): array
    {
        $effectiveStatus = WaterPeriodService::effectiveStatus($period);
        $allowance = $period->usage !== null && $period->billable_usage !== null
            ? max(0, (int) $period->usage - (int) $period->billable_usage)
            : WaterBillingService::allowanceForType($period->property?->type);
        $hasEnd = $period->meter_end !== null;

        return [
            'id' => $period->id,
            'status' => $effectiveStatus,
            // Tenant-facing: an open period without a recorded end is simply
            // "Menunggu Pencatatan", never an empty-state.
            'status_label' => $hasEnd
                ? self::label($effectiveStatus, self::WATER_STATUS_LABELS)
                : 'Menunggu Pencatatan',
            'period_label' => $this->periodLabel($period),
            'meter_start' => $period->meter_start,
            // Visual allowance boundary (meter_start + jatah), NOT a real reading.
            // Only meaningful when the unit has an allowance (KAMAR), kiosk stays null.
            'allowance_end' => $period->meter_start !== null && $allowance > 0
                ? (int) $period->meter_start + $allowance
                : null,
            'meter_start_recorded_at' => $period->meter_start_recorded_at?->toDateTimeString(),
            'has_start_photo' => (bool) $period->meter_start_photo,
            'start_photo_url' => $period->meter_start_photo
                ? route('tenant.water.period.photo', [$period->id, 'start'])
                : null,
            'meter_end' => $period->meter_end,
            'has_end' => $hasEnd,
            'meter_end_recorded_at' => $period->meter_end_recorded_at?->toDateTimeString(),
            'has_end_photo' => (bool) $period->meter_end_photo,
            'end_photo_url' => $period->meter_end_photo
                ? route('tenant.water.period.photo', [$period->id, 'end'])
                : null,
            'usage' => $period->usage,
            'billable_usage' => $period->billable_usage,
            'allowance' => $allowance,
            'billing_note' => $allowance > 0 ? "{$allowance} m³ pertama termasuk sewa" : 'Air ditagih terpisah',
            'water_rate' => $period->water_rate !== null ? (float) $period->water_rate : null,
            'total_amount' => $period->total_amount !== null ? (float) $period->total_amount : null,
            'due_date' => $period->due_date?->toDateString(),
            'paid_at' => $period->paid_at?->toDateTimeString(),
        ];
    }

    private function waterChargePayload(WaterPeriod $period): array
    {
        $payload = $this->waterPeriodPayload($period);

        return array_intersect_key($payload, array_flip([
            'id', 'status', 'status_label', 'period_label', 'usage', 'billable_usage',
            'allowance', 'billing_note', 'water_rate', 'total_amount', 'due_date', 'paid_at',
        ]));
    }

    private function waterRulePayload(Tenancy $tenancy): array
    {
        $allowance = WaterBillingService::allowanceM3($tenancy);

        return [
            'allowance_m3' => $allowance,
            'rate_per_m3' => (float) WaterBillingService::ratePerM3($tenancy->property),
            'charges_separately' => $allowance === 0,
            'unit_type' => $tenancy->property?->type,
            'note' => $allowance > 0
                ? "{$allowance} m³ pertama sudah termasuk sewa. Pemakaian lebih dari itu ditagih Rp ".
                    number_format(WaterBillingService::ratePerM3($tenancy->property), 0, ',', '.').'/m³.'
                : 'Air PAM ditagih terpisah dari sewa (tanpa jatah gratis), dihitung dari pemakaian aktual meteran.',
        ];
    }

    private function dueDayLabel(Tenancy $tenancy): string
    {
        $displayMoveIn = DueDateService::effectiveMoveInDate($tenancy)?->toDateString()
            ?? $tenancy->move_in_date;

        if (! $displayMoveIn && $tenancy->due_day === null) {
            return 'Akhir bulan';
        }

        $dueDay = DueDateService::dueDay($this->moveInDayOf($tenancy), $tenancy->due_day);

        return $dueDay === 0 ? 'Akhir bulan' : (string) $dueDay;
    }

    private function nextDueDate(Tenancy $tenancy): ?string
    {
        $effectiveMoveIn = DueDateService::effectiveMoveInDate($tenancy);
        $displayMoveIn = $effectiveMoveIn?->toDateString() ?? $tenancy->move_in_date;

        if (! $displayMoveIn) {
            return null;
        }

        return DueDateService::nextDueDate($displayMoveIn, $this->moveInDayOf($tenancy), $tenancy->due_day)
            ?->toDateString();
    }

    private function moveInDayOf(Tenancy $tenancy): int
    {
        $effectiveMoveIn = DueDateService::effectiveMoveInDate($tenancy);
        $displayMoveIn = $effectiveMoveIn?->toDateString() ?? $tenancy->move_in_date;

        if ($effectiveMoveIn) {
            return (int) $effectiveMoveIn->day;
        }

        return $displayMoveIn ? (int) Carbon::parse($displayMoveIn)->day : 1;
    }

    private function periodLabel(WaterPeriod $period): string
    {
        $month = (int) $period->period_month;

        return (self::MONTH_NAMES[$month] ?? $month).' '.$period->period_year;
    }

    private function periodLabelFromDueDate(?string $dueDate): ?string
    {
        if (! $dueDate) {
            return null;
        }

        $d = \Carbon\Carbon::parse($dueDate);

        return (self::MONTH_NAMES[(int) $d->month] ?? $d->month).' '.$d->year;
    }

    private static function label(string $value, array $map): string
    {
        return $map[$value] ?? $value;
    }
}