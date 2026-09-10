<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('notification_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('period_id')->nullable()->constrained('water_periods')->nullOnDelete();
            $table->enum('trigger', ['WATER_H4_METER', 'WATER_PAYMENT_DUE', 'WATER_NEW_PERIOD']);
            $table->enum('channel', ['EMAIL', 'WHATSAPP']);
            $table->string('recipient');
            $table->string('subject');
            $table->text('body');
            $table->enum('status', ['SENT', 'FAILED', 'SKIPPED'])->default('SENT');
            $table->text('error')->nullable();
            $table->date('reminder_date')->nullable();
            $table->timestamps();

            // Dedupe: never send the same reminder for the same period/channel
            // more than once per day.
            $table->unique(['period_id', 'trigger', 'channel', 'reminder_date'], 'notification_logs_dedupe_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notification_logs');
    }
};