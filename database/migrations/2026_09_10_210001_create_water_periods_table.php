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
        Schema::create('water_periods', function (Blueprint $table) {
            $table->id();
            // History is owned by the UNIT (property), not the tenancy, so it
            // survives a tenant change. These links are snapshots of the period.
            $table->foreignId('property_id')->constrained('properties')->nullOnDelete();
            $table->foreignId('tenancy_id')->nullable()->constrained('tenancies')->nullOnDelete();
            $table->foreignId('tenant_id')->nullable()->constrained('users')->nullOnDelete();

            $table->smallInteger('period_year');
            $table->tinyInteger('period_month');
            $table->enum('status', ['METER_DUE', 'WAITING_PAYMENT', 'PAID'])->default('METER_DUE');
            $table->enum('payment_status', ['NOT_APPLICABLE', 'UNPAID', 'PAID'])->default('NOT_APPLICABLE');

            $table->unsignedInteger('meter_start')->nullable();
            $table->string('meter_start_photo')->nullable();
            $table->timestamp('meter_start_recorded_at')->nullable();

            $table->unsignedInteger('meter_end')->nullable();
            $table->string('meter_end_photo')->nullable();
            $table->timestamp('meter_end_recorded_at')->nullable();

            $table->unsignedInteger('usage')->nullable();
            $table->unsignedInteger('billable_usage')->nullable();
            $table->decimal('water_rate', 12, 2)->nullable();
            $table->decimal('total_amount', 12, 2)->nullable();

            $table->date('due_date')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->foreignId('confirmed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('note')->nullable();

            $table->timestamps();

            $table->index(['property_id', 'status']);
            $table->index(['property_id', 'period_year', 'period_month']);
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('water_periods');
    }
};