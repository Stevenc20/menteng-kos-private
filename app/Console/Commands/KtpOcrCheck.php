<?php

namespace App\Console\Commands;

use App\Models\TenantProfile;
use App\Services\KtpOcrService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class KtpOcrCheck extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'ktp:ocr-check {--user= : Filter by user ID} {--occupant=1 : Which KTP to test (1 or 2)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Re-run OCR on a stored KTP photo and show raw text + parsed result for diagnosis.';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $occupant = $this->option('occupant');
        $photoCol = $occupant === '2' ? 'ktp_2_photo' : 'ktp_1_photo';
        $prefix = $occupant === '2' ? 'ktp_2' : 'ktp_1';

        $profiles = TenantProfile::whereNotNull($photoCol)->orderBy('updated_at', 'desc')->get();

        if ($this->option('user')) {
            $profiles = $profiles->where('user_id', (int) $this->option('user'))->values();
        }

        if ($profiles->isEmpty()) {
            $this->error("No stored KTP photo found (occupant {$occupant}). Upload one first.");
            return 1;
        }

        $profile = $profiles->first();
        $path = $profile->{$photoCol};
        $absolutePath = Storage::disk('local')->path($path);

        $this->info("Profile user_id={$profile->user_id}");
        $this->info("Stored path: {$path}");
        $this->info("Absolute path: {$absolutePath}");
        $this->info('File exists: ' . (file_exists($absolutePath) ? 'yes' : 'NO'));

        if (!file_exists($absolutePath)) {
            $this->error('File missing on disk.');
            return 1;
        }

        try {
            $service = new KtpOcrService();
            $result = $service->extract($absolutePath);

            $this->info('');
            $this->info('=== RAW OCR TEXT ===');
            $this->line($result['raw']);
            $this->info('');
            $this->info('=== PARSED RESULT ===');
            $this->line(json_encode(
                array_diff_key($result, ['raw' => true]),
                JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE
            ));

            return 0;
        } catch (\Throwable $e) {
            $this->error('OCR failed: ' . $e->getMessage());
            return 1;
        }
    }
}