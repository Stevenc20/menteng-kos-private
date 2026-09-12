<?php

namespace App\Console\Commands;

use App\Models\Agreement;
use App\Models\Tenancy;
use App\Services\WaterBillingService;
use Illuminate\Console\Command;

/**
 * Backfill existing KIOSK agreement statements so the water PAM clause
 * reflects the "separate water" rule (kios pays PAM usage in full, no
 * included 5m³ allowance).
 *
 * `document_html` is a point-in-time HTML snapshot generated at sign-time, so
 * already-issued statements do NOT change automatically when the template is
 * updated. This command surgically rewrites the water bullet inside those
 * snapshots (preserving signatures and all other personalized content).
 *
 * Usage:
 *   php artisan kiosk:fix-statement-water                # dry-run (no changes)
 *   php artisan kiosk:fix-statement-water --force        # apply changes
 *   php artisan kiosk:fix-statement-water --dry --verbose
 */
class KioskFixStatementWater extends Command
{
    protected $signature = 'kiosk:fix-statement-water
                            {--dry : Only show what would change (default is dry-run)}
                            {--force : Actually persist the changes}';

    protected $description = 'Rewrite the water PAM clause in existing KIOSK statements (separate-water rule, no 5m³ allowance).';

    /** Regex capturing the old "5m3 included" water bullet rendered by the KIOSK template. */
    private const OLD_KIOSK_WATER_BULLET = '/<li style="margin:4px 0;">Uang air sebanyak\s*<strong>5m³<\/strong>.*?sesuai pemakaiaan\.<\/li>/s';

    /** Regex capturing the old bare "Uang sewa kios Rp X" rent bullet (no extra note). */
    private const OLD_KIOSK_RENT_BULLET = '/(<li style="margin:4px 0;">Uang sewa kios\s*<strong>Rp [\d.]+<\/strong>)<\/li>/';

    public function handle()
    {
        $apply   = (bool) $this->option('force');
        $dryRun  = $apply ? false : true;
        $verbose = (bool) $this->option('verbose') || ! $apply;

        // Only tenancies that actually have a separate-water situation.
        $tenancies = Tenancy::with('property')
            ->whereHas('property', fn ($q) => $q->where('type', 'KIOSK'))
            ->get()
            ->filter(fn (Tenancy $t) => WaterBillingService::chargesWaterSeparately($t));

        $this->info('Menemukan ' . $tenancies->count() . ' tenancy KIOSK dengan air ditagih terpisah.');
        if ($dryRun) {
            $this->warn('MODE DRY-RUN: tidak ada perubahan. Pakai --force untuk menerapkan.');
        }

        $updated  = 0;
        $skipped  = 0;

        foreach ($tenancies as $tenancy) {
            $agreements = Agreement::where('tenancy_id', $tenancy->id)
                ->whereNotNull('document_html')
                ->get();

            foreach ($agreements as $agreement) {
                $html = $agreement->document_html;

                if (! preg_match(self::OLD_KIOSK_WATER_BULLET, $html)) {
                    $skipped++;
                    if ($verbose) {
                        $this->line("  [tenancy {$tenancy->id}/agreement {$agreement->id}] tidak ada klausul air lama -> lewati.");
                    }
                    continue;
                }

                // Rewrite to match the canonical separate-water template:
                //  1. rent bullet gains "TIDAK termasuk biaya pemakaian air PAM"
                //  2. old 5m3 bullet replaced with the separate PAM bullet
                $html = preg_replace(
                    self::OLD_KIOSK_RENT_BULLET,
                    '$1 &mdash; harga ini <strong>TIDAK termasuk</strong> biaya pemakaian air PAM.</li>',
                    $html,
                    1
                );
                $html = preg_replace(self::OLD_KIOSK_WATER_BULLET, $this->newWaterBullet($tenancy), $html, 1);

                // The old START METERAN box shows a range (e.g. "50m³ - 55m³").
                // For separate-water KIOSKs we keep only the start meter number
                // because usage accumulates over each due-date cycle.
                $html = preg_replace(
                    '/<div style="margin-top:2px;letter-spacing:2px;font-weight:bold;font-size:12px;white-space:nowrap;">(\d+)m³ - \d+m³<\/div>/',
                    '<div style="margin-top:2px;letter-spacing:2px;font-weight:bold;font-size:12px;white-space:nowrap;">$1m³</div><div style="font-style:italic;font-size:9px;color:#666;white-space:nowrap;">Pemakaian diakumulasi s/d tiap tanggal jatuh tempo</div>',
                    $html,
                    1
                );

                if ($dryRun) {
                    $updated++;
                    if ($verbose) {
                        $this->line("  [tenancy {$tenancy->id}/agreement {$agreement->id}] akan diubah (dry-run).");
                    }
                    continue;
                }

                $agreement->update(['document_html' => $html]);
                $updated++;
                if ($verbose) {
                    $this->line("  [tenancy {$tenancy->id}/agreement {$agreement->id}] diubah.");
                }
            }
        }

        $this->info("Selesai. Ditandai/terubah: {$updated} agreement, dilewati: {$skipped}.");
        if ($dryRun) {
            $this->warn('Ini masih dry-run. Jalankan dengan --force untuk menulis ke database.');
        }
    }

    private function newWaterBullet(Tenancy $tenancy): string
    {
        $rate = WaterBillingService::WATER_RATE_PER_M3;
        $rateText = number_format($rate, 0, ',', '.');

        return '<li style="margin:4px 0;">Biaya pemakaian air <strong>PAM</strong> dibayar <strong>terpisah</strong>, dihitung berdasarkan <strong>akumulasi pemakaian aktual</strong> dari <strong>start meteran</strong> sampai pembacaan pada <strong>setiap tanggal jatuh tempo</strong> sesuai <strong>meter air</strong> dengan tarif <strong>Rp ' . $rateText . '/m³</strong>. Biaya pemakaian air PAM akan <strong>ditambahkan pada tagihan pembayaran bulanan</strong>. Rumus: <em>pemakaian air (m³) × Rp ' . $rateText . '</em>.</li>';
    }
}
