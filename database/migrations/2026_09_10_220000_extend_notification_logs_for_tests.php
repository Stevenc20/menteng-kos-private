<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Extend notification_logs for the Test Notification feature:
     *  - new trigger WATER_TEST
     *  - purpose (REMINDER vs TEST)
     *  - sent_at
     *
     * Strictly additive: existing reminder rows are untouched.
     */
    public function up(): void
    {
        Schema::table('notification_logs', function (Blueprint $table) {
            $table->enum('trigger', ['WATER_H4_METER', 'WATER_PAYMENT_DUE', 'WATER_NEW_PERIOD', 'WATER_TEST'])->change();
            $table->enum('purpose', ['REMINDER', 'TEST'])->default('REMINDER');
        });

        Schema::table('notification_logs', function (Blueprint $table) {
            $table->timestamp('sent_at')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('notification_logs', function (Blueprint $table) {
            $table->dropColumn(['purpose', 'sent_at']);
            $table->enum('trigger', ['WATER_H4_METER', 'WATER_PAYMENT_DUE', 'WATER_NEW_PERIOD'])->change();
        });
    }
};