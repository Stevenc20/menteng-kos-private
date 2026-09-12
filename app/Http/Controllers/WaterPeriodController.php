<?php

namespace App\Http\Controllers;

use App\Models\NotificationLog;
use App\Models\Property;
use App\Models\Setting;
use App\Models\Tenancy;
use App\Models\TenantProfile;
use App\Models\WaterPeriod;
use App\Services\WaterBillingService;
use App\Services\WaterNotificationService;
use App\Services\WaterPeriodService;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class WaterPeriodController extends Controller
{
    public function __construct(
        protected WaterPeriodService $periodService,
        protected WaterNotificationService $notificationService,
    ) {}

    /**
     * [ADMIN] Water (Air) monitoring page: every unit + its current period.
     */
    public function index(Request $request)
    {
        $filter = $request->query('filter', 'all');

        $properties = Property::query()->orderBy('name')->get();
        $propertyIds = $properties->pluck('id');

        $activeTenancies = Tenancy::with('user')
            ->where('status', 'ACTIVE')
            ->latest('id')
            ->get()
            ->keyBy('property_id');

        $openPeriods = WaterPeriod::query()
            ->whereIn('property_id', $propertyIds)
            ->whereIn('status', [WaterPeriod::STATUS_METER_DUE, WaterPeriod::STATUS_WAITING_PAYMENT])
            ->with(['tenancy', 'property'])
            ->get()
            ->keyBy('property_id');

        $paidCounts = WaterPeriod::query()
            ->whereIn('property_id', $propertyIds)
            ->where('status', WaterPeriod::STATUS_PAID)
            ->selectRaw('property_id, count(*) as c')
            ->groupBy('property_id')
            ->pluck('c', 'property_id');

        $rows = [];
        $stats = [
            'total' => $properties->count(),
            'perlu_update_meter' => 0,
            'menunggu_pembayaran' => 0,
            'jatuh_tempo_hari_ini' => 0,
            'lunas' => 0,
        ];

        foreach ($properties as $property) {
            $open = $openPeriods->get($property->id);
            $hasPaid = isset($paidCounts[$property->id]) && $paidCounts[$property->id] > 0;
            $tenant = $activeTenancies->get($property->id);

            if ($open) {
                if ($open->status === WaterPeriod::STATUS_METER_DUE) {
                    $stats['perlu_update_meter']++;
                }
                if ($open->status === WaterPeriod::STATUS_WAITING_PAYMENT) {
                    $stats['menunggu_pembayaran']++;
                    if ($open->due_date && $open->due_date->lte(today())) {
                        $stats['jatuh_tempo_hari_ini']++;
                    }
                }
            } elseif ($hasPaid) {
                $stats['lunas']++;
            }

            $rows[] = [
                'id' => $property->id,
                'name' => $property->name,
                'type' => $property->type,
                'status' => $property->status,
                'tenant' => $tenant ? ['id' => $tenant->user_id, 'name' => $tenant->user?->name] : null,
                'has_paid' => $hasPaid,
                'billing_note' => $tenant
                    ? $this->billingNote(WaterBillingService::allowanceM3($tenant))
                    : ($property->type === 'KIOSK'
                        ? 'Air ditagih terpisah'
                        : WaterBillingService::WATER_ALLOWANCE_M3.' m³ pertama termasuk sewa'),
                'water' => $open ? $this->periodPayload($open) : null,
            ];
        }

        $rows = collect($rows)->filter(function ($row) use ($filter) {
            return match ($filter) {
                'meter-due' => $row['water'] && $row['water']['status'] === WaterPeriod::STATUS_METER_DUE,
                'waiting-payment' => $row['water'] && $row['water']['status'] === WaterPeriod::STATUS_WAITING_PAYMENT,
                'paid' => ! $row['water'] && $row['has_paid'],
                default => true,
            };
        })->values()->all();

        return Inertia::render('Admin/Air', [
            'properties' => $rows,
            'stats' => $stats,
            'activeFilter' => $filter,
            'settings' => $this->settingsPayload(),
            'logs' => NotificationLog::with('period.property')
                ->latest()
                ->limit(30)
                ->get()
                ->map(function (NotificationLog $log) {
                    return [
                        'id' => $log->id,
                        'trigger' => $log->trigger,
                        'channel' => $log->channel,
                        'status' => $log->status,
                        'recipient' => $log->recipient,
                        'error' => $log->error,
                        'reminder_date' => $log->reminder_date,
                        'created_at' => $log->created_at?->toDateTimeString(),
                        'unit' => $log->period?->property?->name,
                    ];
                }),
        ]);
    }

    /**
     * [ADMIN] Detail page for a single unit: full period history.
     */
    public function show(Request $request, $propertyId)
    {
        $property = Property::findOrFail($propertyId);

        $tenancy = Tenancy::with('user')
            ->where('property_id', $property->id)
            ->where('status', 'ACTIVE')
            ->latest('id')
            ->first();

        $periods = WaterPeriod::query()
            ->where('property_id', $property->id)
            ->with(['tenant', 'tenancy', 'property'])
            ->orderByDesc('period_year')
            ->orderByDesc('period_month')
            ->orderByDesc('id')
            ->get();

        $allowance = $tenancy
            ? WaterBillingService::allowanceM3($tenancy)
            : WaterBillingService::allowanceForType($property->type);

        return Inertia::render('Admin/WaterDetail', [
            'property' => [
                'id' => $property->id,
                'name' => $property->name,
                'type' => $property->type,
                'status' => $property->status,
                'water_rate' => $property->water_rate !== null ? (float) $property->water_rate : null,
                'allowance' => $allowance,
                'billing_note' => $this->billingNote($allowance),
            ],
            'tenant' => $tenancy?->user
                ? [
                    'id' => $tenancy->user_id,
                    'name' => $tenancy->user->name,
                    'whatsapp' => TenantProfile::where('user_id', $tenancy->user_id)->value('whatsapp'),
                ]
                : null,
            'periods' => $periods->map(fn (WaterPeriod $period) => $this->periodPayload($period)),
            'settings' => $this->settingsPayload(),
        ]);
    }

    /**
     * [ADMIN] Start a new water period for a unit (meter-start + photo).
     */
    public function startPeriod(Request $request, $propertyId)
    {
        $property = Property::findOrFail($propertyId);

        if ($property->openWaterPeriod()) {
            return redirect()->back()->withErrors(['meter_start' => 'Unit ini masih memiliki periode air yang aktif. Konfirmasi pembayaran atau tutup periode sebelumnya terlebih dahulu.']);
        }

        $validated = $request->validate([
            'meter_start' => 'required|integer|min:0',
            'photo' => 'required|image|max:20480',
            'note' => 'nullable|string|max:255',
        ]);

        $photoPath = null;

        try {
            $photoPath = $this->storeMeterPhoto($request->file('photo'), $property->id);

            $period = $this->periodService->startPeriod($property, (int) $validated['meter_start'], $photoPath, $validated['note'] ?? null);
        } catch (ValidationException $e) {
            if ($photoPath) {
                Storage::disk('local')->delete($photoPath);
            }

            throw $e;
        } catch (\Throwable $e) {
            if ($photoPath) {
                Storage::disk('local')->delete($photoPath);
            }

            return redirect()->back()->withErrors(['meter_start' => $e->getMessage()]);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => "Periode air {$property->name} dimulai. Meter awal: ".number_format($period->meter_start).'. Tunggu pembacaan meter akhir.']);

        return redirect()->back();
    }

    /**
     * [ADMIN] Record the meter-end reading + photo; computes usage & amount.
     */
    public function recordEnd(Request $request, $periodId)
    {
        $period = WaterPeriod::with('property', 'tenancy')->findOrFail($periodId);

        if ($period->status !== WaterPeriod::STATUS_METER_DUE) {
            return redirect()->back()->withErrors(['meter_end' => 'Periode ini tidak sedang menunggu meter akhir.']);
        }

        $validated = $request->validate([
            'meter_end' => 'required|integer|min:0',
            'photo' => 'required|image|max:20480',
        ]);

        $photoPath = null;

        try {
            $photoPath = $this->storeMeterPhoto($request->file('photo'), $period->property_id);

            $this->periodService->recordEnd($period, (int) $validated['meter_end'], $photoPath);
        } catch (ValidationException $e) {
            if ($photoPath) {
                Storage::disk('local')->delete($photoPath);
            }

            return redirect()->back()->withErrors($e->errors());
        } catch (\Throwable $e) {
            if ($photoPath) {
                Storage::disk('local')->delete($photoPath);
            }

            return redirect()->back()->withErrors(['meter_end' => $e->getMessage()]);
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Meter akhir tercatat. Pemakaian: '.number_format((int) $period->usage).' m³ · Tagihan: Rp '.number_format((float) $period->total_amount, 0, ',', '.'),
        ]);

        return redirect()->back();
    }

    /**
     * [ADMIN] Confirm the period payment; auto-opens the next period.
     */
    public function confirmPayment(Request $request, $periodId)
    {
        $period = WaterPeriod::findOrFail($periodId);

        if ($period->status !== WaterPeriod::STATUS_WAITING_PAYMENT) {
            return redirect()->back()->withErrors(['payment' => 'Periode tidak dalam status menunggu pembayaran.']);
        }

        try {
            $this->periodService->confirmPayment($period, $request->user()->id);
        } catch (ValidationException $e) {
            return redirect()->back()->withErrors($e->errors());
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Pembayaran air terkonfirmasi. Periode berikutnya telah dibuka (meter akhir menjadi meter awal).',
        ]);

        return redirect()->back();
    }

    /**
     * Store a meter photo, surfacing silent storage failures as validation errors.
     */
    private function storeMeterPhoto(?UploadedFile $photo, int $propertyId): string
    {
        if (! $photo) {
            throw ValidationException::withMessages(['photo' => 'Foto meter tidak terkirim. Coba pilih ulang foto.']);
        }

        try {
            Storage::disk('local')->makeDirectory("water_periods/{$propertyId}");

            $path = $photo->storeAs(
                "water_periods/{$propertyId}",
                Str::uuid().'.'.$photo->getClientOriginalExtension(),
                'local'
            );
        } catch (\Throwable $e) {
            throw ValidationException::withMessages(['photo' => 'Gagal menyimpan foto meter: '.$e->getMessage()]);
        }

        if (! $path) {
            throw ValidationException::withMessages(['photo' => 'Gagal menyimpan foto meter. Periksa izin folder storage dan kapasitas disk.']);
        }

        return $path;
    }

    /**
     * [ADMIN] Serve a meter photo from private storage.
     */
    public function getPhoto(Request $request, $periodId, $kind)
    {
        $period = WaterPeriod::findOrFail($periodId);

        $path = $kind === 'end' ? $period->meter_end_photo : $period->meter_start_photo;

        if (! $path || ! Storage::disk('local')->exists($path)) {
            abort(404);
        }

        return Storage::disk('local')->response($path);
    }

    /**
     * [ADMIN] Update water notification/billing settings.
     */
    public function updateSettings(Request $request)
    {
        $validated = $request->validate([
            'to_admin_whatsapp' => 'required|string|max:30',
            'to_admin_email' => 'nullable|email|max:190',
            'rate_per_m3' => 'required|numeric|min:0',
            'reminder_days' => 'required|integer|min:1|max:30',
            'whatsapp_provider' => 'nullable|string|max:100',
        ]);

        Setting::set('water.to_admin_whatsapp', $validated['to_admin_whatsapp']);
        Setting::set('water.to_admin_email', $validated['to_admin_email'] ?? '');
        Setting::set('water.rate_per_m3', $validated['rate_per_m3']);
        Setting::set('water.reminder_days', $validated['reminder_days']);
        Setting::set('water.email_enabled', $request->boolean('email_enabled') ? '1' : '0');
        Setting::set('water.whatsapp_enabled', $request->boolean('whatsapp_enabled') ? '1' : '0');
        Setting::set('water.whatsapp_provider', $validated['whatsapp_provider'] ?? '');

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Pengaturan air berhasil disimpan.']);

        return redirect()->back();
    }

    /**
     * [ADMIN] Send a manual test email from the Air console.
     *
     * Honest reporting: with MAIL_MAILER=log the response says the message was
     * NOT delivered to an inbox, so the admin never mistakes accepted-for-log
     * as accepted-for-delivery. Returns JSON for the modal in the UI.
     */
    public function testEmail(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|email|max:190',
        ]);

        $result = $this->notificationService->sendTestEmail($validated['email']);
        $result['status'] = $result['status'] === 'SENT' ? 'sent' : 'failed';

        return response()->json($result);
    }

    /**
     * [ADMIN] Send a manual test WhatsApp from the Air console.
     *
     * Never pretends success: without a configured provider+driver this returns
     * FAILED with a clear message telling the admin to connect a WhatsApp API.
     */
    public function testWhatsApp(Request $request)
    {
        $validated = $request->validate([
            'number' => 'required|string|max:30',
        ]);

        $result = $this->notificationService->sendTestWhatsApp($validated['number']);
        $result['status'] = $result['status'] === 'SENT' ? 'sent' : 'failed';

        return response()->json($result);
    }

    protected function periodPayload(WaterPeriod $period): array
    {
        // Included m³ for THIS period: use stored data when the period ended
        // (included = usage - billable_usage is the ground truth), otherwise the
        // allowance rule that recordEnd would apply for this unit.
        $allowance = null;
        if ($period->usage !== null && $period->billable_usage !== null) {
            $allowance = max(0, (int) $period->usage - (int) $period->billable_usage);
        } elseif ($period->tenancy) {
            $allowance = WaterBillingService::allowanceM3($period->tenancy);
        } else {
            $allowance = WaterBillingService::allowanceForType($period->property?->type);
        }

        return [
            'id' => $period->id,
            'status' => $period->status,
            'payment_status' => $period->payment_status,
            'period_month' => $period->period_month,
            'period_year' => $period->period_year,
            'meter_start' => $period->meter_start,
            'meter_start_recorded_at' => $period->meter_start_recorded_at?->toDateTimeString(),
            'has_start_photo' => (bool) $period->meter_start_photo,
            'meter_end' => $period->meter_end,
            'meter_end_recorded_at' => $period->meter_end_recorded_at?->toDateTimeString(),
            'has_end_photo' => (bool) $period->meter_end_photo,
            'usage' => $period->usage,
            'billable_usage' => $period->billable_usage,
            'allowance' => $allowance,
            'billing_note' => $this->billingNote($allowance),
            'water_rate' => $period->water_rate !== null ? (float) $period->water_rate : null,
            'total_amount' => $period->total_amount !== null ? (float) $period->total_amount : null,
            'due_date' => $period->due_date?->toDateString(),
            'paid_at' => $period->paid_at?->toDateTimeString(),
            'note' => $period->note,
            'tenant_name' => $period->tenant?->name,
        ];
    }

    protected function billingNote(int $allowance): string
    {
        return $allowance > 0
            ? "{$allowance} m³ pertama termasuk sewa"
            : 'Air ditagih terpisah';
    }

    protected function settingsPayload(): array
    {
        return [
            'to_admin_whatsapp' => (string) Setting::get('water.to_admin_whatsapp', config('mail.water_whatsapp', '081291903483')),
            'rate_per_m3' => (float) Setting::get('water.rate_per_m3', 14000),
            'reminder_days' => (int) Setting::get('water.reminder_days', 4),
            'email_enabled' => filter_var(Setting::get('water.email_enabled', '1'), FILTER_VALIDATE_BOOLEAN),
            'whatsapp_enabled' => filter_var(Setting::get('water.whatsapp_enabled', '0'), FILTER_VALIDATE_BOOLEAN),
            'whatsapp_provider' => (string) Setting::get('water.whatsapp_provider', ''),
            'mail_mailer' => (string) config('mail.default'),
            'email_configured' => $this->notificationService->emailConfigured(),
            'whatsapp_configured' => $this->notificationService->whatsappConfigured(),
            'to_admin_email' => (string) Setting::get('water.to_admin_email', (string) env('WATER_ADMIN_EMAIL', '')),
            'email_reminder_active' => $this->notificationService->emailConfigured(),
            'scheduler_active' => (bool) config('water.scheduler_enabled'),
            'last_reminder' => $this->lastReminder(),
        ];
    }

    /**
     * When the last automatic reminder was delivered/attempted.
     */
    protected function lastReminder(): ?string
    {
        $log = NotificationLog::query()
            ->where('purpose', 'REMINDER')
            ->orderByDesc('sent_at')
            ->orderByDesc('created_at')
            ->first();

        return $log?->sent_at?->toDateTimeString()
            ?? $log?->created_at?->toDateTimeString();
    }
}
