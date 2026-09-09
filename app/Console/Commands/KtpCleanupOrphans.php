<?php

namespace App\Console\Commands;

use App\Models\TenantProfile;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class KtpCleanupOrphans extends Command
{
    protected $signature = 'ktp:cleanup-orphans
        {--force : Actually delete files (default is a dry run)}
        {--older-than=7 : Only consider files older than this many days}';

    protected $description = 'Find KTP files on the local disk that no tenant_profiles row references.';

    public function handle(): int
    {
        $disk = Storage::disk('local');
        $olderThan = max(1, (int) $this->option('older-than'));
        $force = (bool) $this->option('force');

        $referenced = collect();

        TenantProfile::query()
            ->whereNotNull('ktp_1_photo')
            ->orWhereNotNull('ktp_2_photo')
            ->each(function (TenantProfile $profile) use (&$referenced) {
                if ($profile->ktp_1_photo) $referenced->push($profile->ktp_1_photo);
                if ($profile->ktp_2_photo) $referenced->push($profile->ktp_2_photo);
            });

        $referenced = $referenced->unique()->flip();

        $allFiles = $disk->allFiles();

        $orphans = collect();

        foreach ($allFiles as $file) {
            if (! str_contains($file, '/ktp/') && ! str_contains($file, '/private/ktp/')) {
                continue;
            }

            if ($referenced->has($file)) {
                continue;
            }

            $modified = $disk->lastModified($file);

            if ($modified !== false && $modified < now()->subDays($olderThan)->getTimestamp()) {
                $size = $disk->size($file);
                $orphans->push(['path' => $file, 'size' => $size ?: 0]);
            }
        }

        $count = $orphans->count();
        $total = $orphans->sum('size');

        $this->info(sprintf(
            'Ditemukan %d file KTP orphan (total %s), referensi DB %d.',
            $count,
            $this->humanBytes($total),
            $referenced->count(),
        ));

        if (! $force) {
            $this->warn('Dry-run: tidak ada file yang dihapus. Gunakan --force untuk menghapus.');
            foreach ($orphans as $o) {
                $this->line(sprintf('  [orphan] %s (%s)', $o['path'], $this->humanBytes($o['size'])));
            }

            return self::SUCCESS;
        }

        $deleted = 0;
        foreach ($orphans as $o) {
            if (! $disk->delete($o['path'])) {
                $this->error('  Gagal hapus: '.$o['path']);
                continue;
            }
            $deleted++;
            $this->line('  Dihapus: '.$o['path']);
        }

        $this->info("Selesai: {$deleted} file KTP orphan dihapus.");

        return self::SUCCESS;
    }

    private function humanBytes(int $bytes): string
    {
        if ($bytes >= 1048576) return round($bytes / 1048576, 1).' MB';
        if ($bytes >= 1024) return round($bytes / 1024, 1).' KB';
        return $bytes.' B';
    }
}