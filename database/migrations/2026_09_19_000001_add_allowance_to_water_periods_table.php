<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Per-period allowance override (m³).
     *
     * Only the FIRST period after a tenant moves rooms mid-cycle carries the
     * remaining allowance (jatah sisa, e.g. 5 − 3 = 2 m³) so the tenant's 5 m³
     * monthly quota is not doubled while switching rooms. Later periods keep the
     * override NULL (falling back to the normal type-based 5 m³ for KAMAR, 0 for
     * KIOSK).
     */
    public function up(): void
    {
        Schema::table('water_periods', function (Blueprint $table) {
            $table->unsignedTinyInteger('allowance')->nullable()->after('billable_usage');
        });
    }

    public function down(): void
    {
        Schema::table('water_periods', function (Blueprint $table) {
            $table->dropColumn('allowance');
        });
    }
};
