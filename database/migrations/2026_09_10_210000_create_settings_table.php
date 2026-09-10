<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->text('value')->nullable();
            $table->timestamps();
        });

        $defaults = [
            'water.to_admin_whatsapp' => '081291903483',
            'water.rate_per_m3' => '14000',
            'water.reminder_days' => '4',
            'water.email_enabled' => '1',
            'water.whatsapp_enabled' => '0',
            'water.whatsapp_provider' => '',
        ];

        DB::table('settings')->insert(
            array_map(fn ($value, $key) => [
                'key' => $key,
                'value' => $value,
                'created_at' => now(),
                'updated_at' => now(),
            ], $defaults, array_keys($defaults))
        );
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};