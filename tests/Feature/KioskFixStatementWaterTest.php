<?php

use App\Console\Commands\KioskFixStatementWater;
use App\Models\Agreement;
use App\Models\Property;
use App\Models\Tenancy;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;

uses(RefreshDatabase::class);

/** Renders the OLD kiosk "5m3 included" payment block (what was stored at sign-time). */
function oldKioskPaymentBlock(string $meter = '100'): string
{
    return '<div style="border:1.5px solid #666;padding:5px 12px;text-align:center;font-size:11px;">'
        . '<div style="font-weight:bold;white-space:nowrap;">START METERAN:</div>'
        . '<div style="margin-top:2px;letter-spacing:2px;font-weight:bold;font-size:12px;white-space:nowrap;">'
        . $meter . 'm³ - ' . ($meter + 5) . 'm³</div></div>'
        . '<ul style="padding-left:24px;margin:4px 0;">'
        . '<li style="margin:4px 0;">Uang sewa kios <strong>Rp 1.700.000</strong></li>'
        . '<li style="margin:4px 0;">Uang air sebanyak <strong>5m³</strong> dengan meteran dari <strong>'
        . $meter . 'm³ - ' . ($meter + 5) . 'm³</strong>, lewat dari itu saya akan membayar air per 1m³ kena '
        . '<strong>Rp 14.000</strong>, sesuai pemakaiaan.</li>'
        . '</ul>';
}

function kioskTenancy(float $agreed): Tenancy
{
    $property = Property::create(['name' => 'Kios', 'type' => 'KIOSK', 'normal_price' => 2000000, 'status' => 'OCCUPIED']);
    return Tenancy::create([
        'user_id' => User::factory()->create()->id,
        'property_id' => $property->id,
        'agreed_price' => $agreed,
        'move_in_date' => now()->format('Y-m-d'),
        'status' => 'ACTIVE',
        'approval_status' => 'APPROVED',
    ]);
}

test('dry-run does not modify any statement', function () {
    $tenancy = kioskTenancy(1700000); // deal < standard => separate water
    $agreement = Agreement::create([
        'tenancy_id' => $tenancy->id,
        'document_html' => oldKioskPaymentBlock(),
        'status' => 'SIGNED',
    ]);

    Artisan::call(KioskFixStatementWater::class);

    expect($agreement->fresh()->document_html)->toBe(oldKioskPaymentBlock());
});

test('force rewrites the water clause for a KIOSK with deal below standard', function () {
    $tenancy = kioskTenancy(1700000);
    $agreement = Agreement::create([
        'tenancy_id' => $tenancy->id,
        'document_html' => oldKioskPaymentBlock(),
        'status' => 'SIGNED',
    ]);

    Artisan::call(KioskFixStatementWater::class, ['--force' => true]);

    $html = $agreement->fresh()->document_html;
    expect($html)->not->toContain('Uang air sebanyak');
    expect($html)->toContain('TIDAK termasuk');
    expect($html)->toContain('dibayar <strong>terpisah</strong>');
    expect($html)->toContain('tarif <strong>Rp 14.000/m³</strong>');
    expect($html)->toContain('akumulasi pemakaian aktual');
    expect($html)->toContain('ditambahkan pada tagihan pembayaran bulanan');
    expect($html)->toContain('100m³</div><div style="font-style:italic;font-size:9px;color:#666;white-space:nowrap;">Pemakaian diakumulasi s/d tiap tanggal jatuh tempo</div>');
    expect($html)->not->toContain('100m³ - 105m³');
});

test('leaves KIOSK statements untouched when deal price is not below standard', function () {
    $tenancy = kioskTenancy(2000000); // deal == standard => no separate water
    $agreement = Agreement::create([
        'tenancy_id' => $tenancy->id,
        'document_html' => oldKioskPaymentBlock(),
        'status' => 'SIGNED',
    ]);

    Artisan::call(KioskFixStatementWater::class, ['--force' => true]);

    expect($agreement->fresh()->document_html)->toBe(oldKioskPaymentBlock());
});
