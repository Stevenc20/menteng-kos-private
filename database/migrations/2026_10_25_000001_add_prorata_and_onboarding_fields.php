<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Additive, backward-compatible migration for:
     * 1. Initial payment & prorata adjustment fields on `tenancies`
     * 2. Period & prorata metadata on `billings`
     * 3. Versioning & revision tracking on `agreements` + `agreement_revisions`
     */
    public function up(): void
    {
        Schema::table('tenancies', function (Blueprint $table) {
            if (! Schema::hasColumn('tenancies', 'initial_paid_until')) {
                $table->date('initial_paid_until')->nullable()->after('due_day');
            }
            if (! Schema::hasColumn('tenancies', 'initial_payment_status')) {
                $table->string('initial_payment_status', 32)->nullable()->default('UNPAID')->after('initial_paid_until');
            }
            if (! Schema::hasColumn('tenancies', 'prorata_start_date')) {
                $table->date('prorata_start_date')->nullable()->after('initial_payment_status');
            }
            if (! Schema::hasColumn('tenancies', 'prorata_end_date')) {
                $table->date('prorata_end_date')->nullable()->after('prorata_start_date');
            }
            if (! Schema::hasColumn('tenancies', 'prorata_days')) {
                $table->integer('prorata_days')->nullable()->after('prorata_end_date');
            }
            if (! Schema::hasColumn('tenancies', 'prorata_basis_mode')) {
                $table->string('prorata_basis_mode', 20)->nullable()->default('ACTUAL')->after('prorata_days');
            }
            if (! Schema::hasColumn('tenancies', 'prorata_basis_days')) {
                $table->integer('prorata_basis_days')->nullable()->after('prorata_basis_mode');
            }
            if (! Schema::hasColumn('tenancies', 'prorata_daily_rate')) {
                $table->decimal('prorata_daily_rate', 12, 2)->nullable()->after('prorata_basis_days');
            }
            if (! Schema::hasColumn('tenancies', 'prorata_amount')) {
                $table->decimal('prorata_amount', 12, 2)->nullable()->after('prorata_daily_rate');
            }
            if (! Schema::hasColumn('tenancies', 'prorata_status')) {
                $table->string('prorata_status', 32)->nullable()->default('UNPAID')->after('prorata_amount');
            }
            if (! Schema::hasColumn('tenancies', 'normal_period_start_date')) {
                $table->date('normal_period_start_date')->nullable()->after('prorata_status');
            }
            if (! Schema::hasColumn('tenancies', 'facilities')) {
                $table->json('facilities')->nullable()->after('normal_period_start_date');
            }
            if (! Schema::hasColumn('tenancies', 'usaha')) {
                $table->string('usaha')->nullable()->after('facilities');
            }
            if (! Schema::hasColumn('tenancies', 'denda_per_day')) {
                $table->decimal('denda_per_day', 12, 2)->nullable()->after('usaha');
            }
            if (! Schema::hasColumn('tenancies', 'water_allowance')) {
                $table->unsignedTinyInteger('water_allowance')->nullable()->after('denda_per_day');
            }
        });

        Schema::table('billings', function (Blueprint $table) {
            if (! Schema::hasColumn('billings', 'period_type')) {
                $table->string('period_type', 24)->nullable()->default('MONTHLY')->after('billing_type');
            }
            if (! Schema::hasColumn('billings', 'period_start')) {
                $table->date('period_start')->nullable()->after('period_type');
            }
            if (! Schema::hasColumn('billings', 'period_end')) {
                $table->date('period_end')->nullable()->after('period_start');
            }
            if (! Schema::hasColumn('billings', 'days_count')) {
                $table->integer('days_count')->nullable()->after('period_end');
            }
            if (! Schema::hasColumn('billings', 'daily_rate')) {
                $table->decimal('daily_rate', 12, 2)->nullable()->after('days_count');
            }
            if (! Schema::hasColumn('billings', 'description')) {
                $table->string('description')->nullable()->after('daily_rate');
            }
        });

        Schema::table('agreements', function (Blueprint $table) {
            if (! Schema::hasColumn('agreements', 'version')) {
                $table->unsignedInteger('version')->default(1)->after('status');
            }
            if (! Schema::hasColumn('agreements', 'revision_notes')) {
                $table->text('revision_notes')->nullable()->after('version');
            }
            if (! Schema::hasColumn('agreements', 'revised_at')) {
                $table->timestamp('revised_at')->nullable()->after('revision_notes');
            }
            if (! Schema::hasColumn('agreements', 'revised_by')) {
                $table->foreignId('revised_by')->nullable()->after('revised_at')->constrained('users')->nullOnDelete();
            }
        });

        if (! Schema::hasTable('agreement_revisions')) {
            Schema::create('agreement_revisions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('agreement_id')->constrained('agreements')->onDelete('cascade');
                $table->foreignId('tenancy_id')->constrained('tenancies')->onDelete('cascade');
                $table->unsignedInteger('version');
                $table->longText('previous_document_html')->nullable();
                $table->longText('new_document_html')->nullable();
                $table->json('previous_terms_snapshot')->nullable();
                $table->json('new_terms_snapshot')->nullable();
                $table->text('revision_reason')->nullable();
                $table->foreignId('revised_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('agreement_revisions');

        Schema::table('agreements', function (Blueprint $table) {
            if (Schema::hasColumn('agreements', 'revised_by')) {
                $table->dropConstrainedForeignId('revised_by');
            }
            $cols = array_filter(['version', 'revision_notes', 'revised_at'], fn ($c) => Schema::hasColumn('agreements', $c));
            if ($cols) {
                $table->dropColumn($cols);
            }
        });

        Schema::table('billings', function (Blueprint $table) {
            $cols = array_filter(['period_type', 'period_start', 'period_end', 'days_count', 'daily_rate', 'description'], fn ($c) => Schema::hasColumn('billings', $c));
            if ($cols) {
                $table->dropColumn($cols);
            }
        });

        Schema::table('tenancies', function (Blueprint $table) {
            $cols = array_filter([
                'initial_paid_until', 'initial_payment_status', 'prorata_start_date', 'prorata_end_date',
                'prorata_days', 'prorata_basis_mode', 'prorata_basis_days', 'prorata_daily_rate',
                'prorata_amount', 'prorata_status', 'normal_period_start_date', 'facilities',
                'usaha', 'denda_per_day', 'water_allowance',
            ], fn ($c) => Schema::hasColumn('tenancies', $c));
            if ($cols) {
                $table->dropColumn($cols);
            }
        });
    }
};
