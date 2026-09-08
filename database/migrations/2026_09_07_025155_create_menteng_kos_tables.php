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
        Schema::create('properties', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->enum('type', ['ROOM', 'KIOSK'])->default('ROOM');
            $table->decimal('normal_price', 12, 2);
            $table->enum('status', ['AVAILABLE', 'OCCUPIED', 'UPCOMING_AVAILABLE', 'MOVE_OUT_INSPECTION', 'MAINTENANCE'])->default('AVAILABLE');
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('tenant_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('whatsapp')->nullable();
            
            // Occupant 01
            $table->string('ktp_1_photo')->nullable();
            $table->string('ktp_1_name')->nullable();
            $table->string('ktp_1_nik')->nullable();
            $table->string('ktp_1_birth_place')->nullable();
            $table->date('ktp_1_birth_date')->nullable();
            $table->string('ktp_1_job')->nullable();
            $table->text('ktp_1_address')->nullable();
            
            // Occupant 02 (Optional)
            $table->string('ktp_2_photo')->nullable();
            $table->string('ktp_2_name')->nullable();
            $table->string('ktp_2_nik')->nullable();
            $table->string('ktp_2_birth_place')->nullable();
            $table->date('ktp_2_birth_date')->nullable();
            $table->string('ktp_2_job')->nullable();
            $table->text('ktp_2_address')->nullable();
            
            $table->timestamps();
        });

        Schema::create('tenancies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('property_id')->constrained('properties');
            $table->decimal('agreed_price', 12, 2);
            $table->date('move_in_date');
            $table->date('expected_move_out_date')->nullable();
            $table->enum('status', [
                'INVITED', 'ONBOARDING_IN_PROGRESS', 'AGREEMENT_PENDING', 'AGREEMENT_SUBMITTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_MOVE_IN_DOCUMENTATION', 'PENDING_WATER_METER', 'ACTIVE', 'SUSPENDED', 'NOT_CONTINUE', 'INACTIVE', 'ARCHIVED'
            ])->default('INVITED');
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('agreements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenancy_id')->constrained('tenancies')->onDelete('cascade');
            $table->longText('document_html')->nullable();
            $table->enum('status', ['DRAFT', 'SIGNED'])->default('DRAFT');
            $table->timestamp('signed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('agreement_signatures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agreement_id')->constrained('agreements')->onDelete('cascade');
            $table->enum('occupant_type', ['OCCUPANT_1', 'OCCUPANT_2']);
            $table->string('signature_image');
            $table->string('paraf_image');
            $table->timestamps();
        });

        Schema::create('billings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenancy_id')->constrained('tenancies')->onDelete('cascade');
            $table->enum('billing_type', ['RENT', 'WATER', 'PENALTY']);
            $table->decimal('amount', 12, 2);
            $table->decimal('excess_water_charge', 12, 2)->default(0);
            $table->date('due_date');
            $table->enum('status', [
                'UPCOMING', 'REMINDER_SENT', 'PENDING_PAYMENT', 'PENDING_VERIFICATION', 'PAID', 'OVERDUE', 'REJECTED'
            ])->default('UPCOMING');
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('payment_proofs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('billing_id')->constrained('billings')->onDelete('cascade');
            $table->foreignId('uploaded_by')->constrained('users');
            $table->decimal('amount_claimed', 12, 2);
            $table->string('receipt_image');
            $table->enum('status', ['PENDING', 'VERIFIED', 'REJECTED'])->default('PENDING');
            $table->timestamps();
        });

        Schema::create('income_proofs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('billing_id')->constrained('billings')->onDelete('cascade');
            $table->foreignId('uploaded_by_admin')->constrained('users');
            $table->decimal('amount_received', 12, 2);
            $table->string('evidence_image');
            $table->string('payment_source')->nullable(); // e.g. "BCA", "Mandiri"
            $table->text('admin_note')->nullable();
            $table->timestamps();
        });

        Schema::create('water_meters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenancy_id')->constrained('tenancies')->onDelete('cascade');
            $table->integer('period_month');
            $table->integer('period_year');
            $table->integer('previous_meter');
            $table->integer('current_meter');
            $table->string('photo');
            $table->decimal('excess_usage_charge', 12, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('maintenance_issues', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenancy_id')->constrained('tenancies')->onDelete('cascade');
            $table->string('category');
            $table->text('description');
            $table->string('photo')->nullable();
            $table->enum('status', ['OPEN', 'IN_PROGRESS', 'RESOLVED'])->default('OPEN');
            $table->timestamps();
        });

        Schema::create('continuation_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenancy_id')->constrained('tenancies')->onDelete('cascade');
            $table->date('period_start');
            $table->enum('response', ['YES', 'NO']);
            $table->timestamp('responded_at');
            $table->timestamps();
        });

        Schema::create('room_documentations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('property_id')->constrained('properties')->onDelete('cascade');
            $table->foreignId('tenancy_id')->constrained('tenancies')->onDelete('cascade');
            $table->enum('documentation_type', ['MOVE_IN', 'MOVE_OUT']);
            $table->date('documentation_date');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();
        });

        Schema::create('room_documentation_media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('documentation_id')->constrained('room_documentations')->onDelete('cascade');
            $table->enum('file_type', ['IMAGE', 'VIDEO']);
            $table->string('file_path');
            $table->string('original_name')->nullable();
            $table->integer('file_size')->nullable();
            $table->string('mime_type')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('room_documentation_media');
        Schema::dropIfExists('room_documentations');
        Schema::dropIfExists('continuation_logs');
        Schema::dropIfExists('maintenance_issues');
        Schema::dropIfExists('water_meters');
        Schema::dropIfExists('income_proofs');
        Schema::dropIfExists('payment_proofs');
        Schema::dropIfExists('billings');
        Schema::dropIfExists('agreement_signatures');
        Schema::dropIfExists('agreements');
        Schema::dropIfExists('tenancies');
        Schema::dropIfExists('tenant_profiles');
        Schema::dropIfExists('properties');
    }
};
