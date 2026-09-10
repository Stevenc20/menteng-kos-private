<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TenantProfile extends Model
{
    protected $fillable = [
        'user_id',
        'whatsapp',
        'ktp_1_photo', 'ktp_1_name', 'ktp_1_nik', 'ktp_1_birth_place', 'ktp_1_birth_date', 'ktp_1_job', 'ktp_1_address',
        'ktp_2_photo', 'ktp_2_name', 'ktp_2_nik', 'ktp_2_birth_place', 'ktp_2_birth_date', 'ktp_2_job', 'ktp_2_address',
    ];
}
