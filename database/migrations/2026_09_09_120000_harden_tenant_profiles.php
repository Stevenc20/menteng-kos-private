<?php

use App\Models\TenantProfile;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

return new class extends Migration
{
    public function up(): void
    {
        $duplicates = DB::table('tenant_profiles')
            ->select('user_id')
            ->groupBy('user_id')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        foreach ($duplicates as $group) {
            $rows = TenantProfile::where('user_id', $group->user_id)
                ->orderByDesc('id')
                ->get();

            $keep = $rows->shift();

            foreach ($rows as $duplicate) {
                foreach (['ktp_1_photo', 'ktp_2_photo'] as $photoCol) {
                    if ($photo = $duplicate->{$photoCol}) {
                        \Illuminate\Support\Facades\Storage::disk('local')->delete($photo);
                    }
                }
                $duplicate->delete();
            }
        }

        Schema::table('tenant_profiles', function (Blueprint $table) {
            $table->unique('user_id');
        });
    }

    public function down(): void
    {
        Schema::table('tenant_profiles', function (Blueprint $table) {
            $table->dropUnique(['user_id']);
        });
    }
};