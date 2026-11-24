<?php

namespace App\Console\Commands;

use App\Models\Agreement;
use App\Models\Billing;
use App\Models\Tenancy;
use App\Services\AgreementStatementService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('kos:clean-kamar2-prorata {--all-unwanted : Also clean other tenancies that have accidental prorata}')]
#[Description('Hapus data prorata dari database dan hilangkan box prorata dari dokumen Surat Pernyataan Kamar 2')]
class CleanKamar2Prorata extends Command
{
    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Mencari data Kamar 2...');

        $tenancies = Tenancy::with(['property', 'statementAgreement'])
            ->whereHas('property', function ($q) {
                $q->where('name', 'like', '%2%');
            })
            ->latest()
            ->get();

        if ($tenancies->isEmpty()) {
            $this->warn('Tidak ditemukan tenancy dengan kamar bernama "2". Menampilkan 5 tenancy terbaru:');
            $tenancies = Tenancy::with(['property', 'statementAgreement'])->latest()->take(5)->get();
        }

        foreach ($tenancies as $tenancy) {
            $roomName = $tenancy->property?->name ?? 'N/A';
            $this->info("Memproses Tenancy ID {$tenancy->id} ({$roomName})...");

            // 1. Hapus billing prorata jika ada
            $deletedBills = Billing::where('tenancy_id', $tenancy->id)
                ->where(function ($q) {
                    $q->where('type', 'PRORATA')
                        ->orWhere('description', 'like', '%prorata%')
                        ->orWhere('description', 'like', '%Prorata%');
                })
                ->delete();
            if ($deletedBills > 0) {
                $this->info("- Berhasil menghapus {$deletedBills} tagihan billing prorata.");
            }

            // 2. Reset kolom prorata di tabel tenancies
            $tenancy->update([
                'initial_paid_until' => null,
                'prorata_start_date' => null,
                'prorata_end_date' => null,
                'prorata_days' => null,
                'prorata_daily_rate' => null,
                'prorata_amount' => null,
                'prorata_status' => 'NOT_APPLICABLE',
                'normal_period_start_date' => null,
                // Pastikan due_day kembali alami jika move_in_date ada
                'due_day' => $tenancy->move_in_date 
                    ? max(1, (int) date('j', strtotime((string) $tenancy->move_in_date)) - 1)
                    : $tenancy->due_day,
            ]);
            $this->info("- Field prorata di tabel tenancy berhasil di-reset (due_day = {$tenancy->due_day}).");

            // 3. Bersihkan dokumen surat pernyataan dari box prorata
            $agreement = Agreement::where('tenancy_id', $tenancy->id)->first();
            if ($agreement && filled($agreement->document_html)) {
                $cleanedHtml = AgreementStatementService::injectOrUpdatePaymentTermsBlock($agreement->document_html, $tenancy);
                
                // Extra regex guarantee: buang box bertuliskan Rincian Ketentuan Pembayaran Awal jika masih ada
                $cleanedHtml = preg_replace(
                    '/<div\s+[^>]*data-payment-terms-block="1"[^>]*>.*?<\/div>\s*<\/div>/is',
                    '',
                    $cleanedHtml
                );
                $cleanedHtml = preg_replace(
                    '/<div\s+style="[^"]*border:[^"]*"[^>]*>\s*<div[^>]*>Rincian Ketentuan Pembayaran Awal[^<]*<\/div>.*?<\/div>/is',
                    '',
                    $cleanedHtml
                );

                $agreement->update([
                    'document_html' => $cleanedHtml,
                ]);
                $this->info("- Dokumen Surat Pernyataan berhasil dibersihkan dari box prorata!");
            }
        }

        $this->info('Selesai! Data prorata Kamar 2 telah dibersihkan secara tuntas.');
        return Command::SUCCESS;
    }
}

