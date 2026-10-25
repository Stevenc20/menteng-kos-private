<?php

namespace App\Services;

use App\Models\Agreement;
use App\Models\AgreementRevision;
use App\Models\RoomDocumentation;
use App\Models\Tenancy;
use Illuminate\Support\Collection;

/**
 * Injects the tenant's BEFORE (MOVE_IN) documentation photos into the
 * Surat Pernyataan HTML so the "Dokumentasi kios saat diserahkan" section
 * always reflects the latest persisted photos from the database, and manages
 * trackable revisions when payment/prorata terms change on a signed statement.
 */
class AgreementStatementService
{
    /** The exact placeholder box emitted by the KIOSK statement template. */
    private const DOCUMENTATION_PLACEHOLDER = '<div style="border:1.5px dashed #999;height:110px;margin:4px 0 14px;"></div>';

    /** Heading of the documentation section in the KIOSK statement. */
    private const DOCUMENTATION_HEADING = 'Dokumentasi kios saat diserahkan';

    /** Marker wrapping the live START METERAN value emitted by the template. */
    private const METERAN_VALUE_MARKER = 'data-meteran-value="1"';

    /** Marker wrapping the Catatan line emitted by the template. */
    private const METERAN_NOTES_MARKER = 'data-meteran-notes="1"';

    /** Marker wrapping the Prorata & Payment Terms summary block. */
    private const PAYMENT_TERMS_MARKER = 'data-payment-terms-block="1"';

    /**
     * Build the HTML summary block for confirmed initial payment, prorata adjustment,
     * and monthly due date (tanggal 1) to be displayed in the Surat Pernyataan.
     */
    public static function buildPaymentTermsBlockHtml(Tenancy $tenancy): string
    {
        if (! $tenancy->initial_paid_until && $tenancy->prorata_days === null) {
            return '';
        }

        $rentFormatted = number_format((float) $tenancy->agreed_price, 0, ',', '.');
        $moveIn = $tenancy->move_in_date ?: '-';
        $paidUntil = $tenancy->initial_paid_until ?: '-';
        $dueDay = $tenancy->due_day !== null ? (int) $tenancy->due_day : 1;
        $dueDayText = $dueDay === 0 ? 'akhir bulan' : 'tanggal '.$dueDay.' setiap bulan';

        $rows = [
            '<li>Harga sewa bulanan: <strong>Rp '.$rentFormatted.' / bulan</strong></li>',
            '<li>Tanggal masuk: <strong>'.e($moveIn).'</strong> · Periode pembayaran awal dibayar s/d: <strong>'.e($paidUntil).'</strong></li>',
        ];

        if ((int) $tenancy->prorata_days > 0 && (float) $tenancy->prorata_amount > 0) {
            $prorataStart = e((string) $tenancy->prorata_start_date);
            $prorataEnd = e((string) $tenancy->prorata_end_date);
            $days = (int) $tenancy->prorata_days;
            $dailyRate = number_format((float) $tenancy->prorata_daily_rate, 0, ',', '.');
            $prorataTotal = number_format((float) $tenancy->prorata_amount, 0, ',', '.');

            $rows[] = '<li>Ketentuan biaya prorata (penyesuaian jatuh tempo): periode <strong>'.$prorataStart.' s/d '.$prorataEnd.'</strong> (<strong>'.$days.' hari</strong> × tarif harian <strong>Rp '.$dailyRate.'</strong>) = <strong>Rp '.$prorataTotal.'</strong></li>';
        } else {
            $rows[] = '<li>Ketentuan biaya prorata: <strong>Tidak ada biaya prorata tambahan (Rp 0)</strong></li>';
        }

        if ($tenancy->normal_period_start_date) {
            $rows[] = '<li>Periode sewa bulanan normal dimulai: <strong>'.e((string) $tenancy->normal_period_start_date).'</strong></li>';
        }

        $rows[] = '<li>Tanggal jatuh tempo sewa bulanan: <strong>'.e($dueDayText).'</strong></li>';

        return '<div data-payment-terms-block="1" style="border:1px solid #d4d4d0;background:#fafaf8;padding:8px 12px;margin:8px 0;font-size:12px;line-height:1.5;">'
            .'<div style="font-weight:bold;margin-bottom:4px;">Rincian Ketentuan Pembayaran Awal &amp; Penyesuaian Jatuh Tempo:</div>'
            .'<ul style="padding-left:18px;margin:0;">'.implode('', $rows).'</ul>'
            .'</div>';
    }

    /**
     * Inject or update the payment terms block in a statement HTML string.
     */
    public static function injectOrUpdatePaymentTermsBlock(string $html, Tenancy $tenancy): string
    {
        if ($html === '') {
            return $html;
        }

        $blockHtml = self::buildPaymentTermsBlockHtml($tenancy);

        if (str_contains($html, self::PAYMENT_TERMS_MARKER)) {
            $pos = strpos($html, '<div '.self::PAYMENT_TERMS_MARKER);
            if ($pos !== false) {
                $endPos = strpos($html, '</div></div>', $pos);
                if ($endPos !== false) {
                    return substr($html, 0, $pos).$blockHtml.substr($html, $endPos + strlen('</div></div>'));
                }
            }
        }

        if ($blockHtml === '') {
            return $html;
        }

        // Insert right before "5. Keterlambatan Pembayaran" (Room) or "3. Kepatuhan Terhadap Pembayaran" (Kiosk)
        foreach (['<p style="font-weight:bold;">5. Keterlambatan Pembayaran</p>', '<p style="font-weight:bold;">3. Kepatuhan Terhadap Pembayaran</p>'] as $anchor) {
            $anchorPos = strpos($html, $anchor);
            if ($anchorPos !== false) {
                return substr($html, 0, $anchorPos).$blockHtml.substr($html, $anchorPos);
            }
        }

        return $html.$blockHtml;
    }

    /**
     * Snapshot payment terms of a tenancy for audit / revision tracking.
     */
    public static function snapshotTerms(Tenancy $tenancy): array
    {
        return [
            'agreed_price' => (float) $tenancy->agreed_price,
            'move_in_date' => $tenancy->move_in_date,
            'due_day' => $tenancy->due_day,
            'initial_paid_until' => $tenancy->initial_paid_until,
            'initial_payment_status' => $tenancy->initial_payment_status,
            'prorata_start_date' => $tenancy->prorata_start_date,
            'prorata_end_date' => $tenancy->prorata_end_date,
            'prorata_days' => $tenancy->prorata_days,
            'prorata_basis_mode' => $tenancy->prorata_basis_mode,
            'prorata_basis_days' => $tenancy->prorata_basis_days,
            'prorata_daily_rate' => $tenancy->prorata_daily_rate !== null ? (float) $tenancy->prorata_daily_rate : null,
            'prorata_amount' => $tenancy->prorata_amount !== null ? (float) $tenancy->prorata_amount : null,
            'prorata_status' => $tenancy->prorata_status,
            'normal_period_start_date' => $tenancy->normal_period_start_date,
        ];
    }

    /**
     * Record a trackable revision when payment terms change on an existing Agreement.
     * If the agreement was already SIGNED, this preserves the previous document HTML
     * and terms snapshot in `agreement_revisions`, increments `version`, and optionally
     * resets status to `DRAFT` if re-signature is required (`$requireResign = true`).
     */
    public static function recordTermsRevisionIfNeeded(
        Tenancy $tenancy,
        array $previousTerms,
        ?int $adminUserId = null,
        ?string $reason = null,
        bool $requireResign = false
    ): ?AgreementRevision {
        $agreement = Agreement::where('tenancy_id', $tenancy->id)->first();
        if (! $agreement) {
            return null;
        }

        $newTerms = self::snapshotTerms($tenancy);
        if ($previousTerms == $newTerms) {
            return null;
        }

        $previousHtml = $agreement->document_html;
        $updatedHtml = $previousHtml
            ? self::injectOrUpdatePaymentTermsBlock($previousHtml, $tenancy)
            : $previousHtml;

        // If the agreement is still DRAFT, simply update its document_html in place
        if ($agreement->status !== 'SIGNED') {
            $agreement->update([
                'document_html' => $updatedHtml,
            ]);

            return null;
        }

        $nextVersion = ((int) ($agreement->version ?: 1)) + 1;
        $revisionReason = $reason ?: 'Pembaruan rincian pembayaran awal / penyesuaian jatuh tempo (prorata) oleh Admin.';

        $revision = AgreementRevision::create([
            'agreement_id' => $agreement->id,
            'tenancy_id' => $tenancy->id,
            'version' => $nextVersion,
            'previous_document_html' => $previousHtml,
            'new_document_html' => $updatedHtml,
            'previous_terms_snapshot' => $previousTerms,
            'new_terms_snapshot' => $newTerms,
            'revision_reason' => $revisionReason,
            'revised_by' => $adminUserId,
        ]);

        $updatePayload = [
            'document_html' => $updatedHtml,
            'version' => $nextVersion,
            'revision_notes' => $revisionReason,
            'revised_at' => now(),
            'revised_by' => $adminUserId,
        ];

        if ($requireResign) {
            $updatePayload['status'] = 'DRAFT';
            $updatePayload['signed_at'] = null;
        }

        $agreement->update($updatePayload);

        return $revision;
    }

    /**
     * Surgically patch an existing Surat Pernyataan `document_html` snapshot's
     * START METERAN and Catatan values. We never regenerate the snapshot (it is
     * point-in-time, signed by the tenant); instead we replace the element
     * bodies between the two stable template markers, so a signed statement
     * updated by admin keeps its original layout and signatures.
     */
    public static function updateMeteranAndNotes(string $html, ?string $meteran, ?string $notes): string
    {
        if ($html === '') {
            return $html;
        }

        $separate = str_contains($html, 'Pemakaian diakumulasi');
        $meteranVal = trim((string) $meteran);
        $notesVal = trim((string) $notes);

        $html = self::replaceMarkedElementBody($html, self::METERAN_VALUE_MARKER,
            self::meteranValueInnerHtml($meteranVal, $separate));

        $html = self::replaceMarkedElementBody($html, self::METERAN_NOTES_MARKER, self::notesLineHtml($notesVal, $separate));

        return $html;
    }

    /**
     * The inner HTML placed inside the value element.
     */
    private static function meteranValueInnerHtml(string $meteran, bool $separate): string
    {
        if ($meteran === '') {
            return '..................';
        }

        if ($separate) {
            return $meteran.'m³'
                .'<br style="letter-spacing:0;font-weight:normal;" />'
                .'<span style="letter-spacing:0;font-weight:normal;">Pemakaian diakumulasi s/d tiap tanggal jatuh tempo</span>';
        }

        return $meteran.'m³ - '.(is_numeric($meteran) ? (int) $meteran + 5 : $meteran.'m³').'m³';
    }

    /**
     * The Catatan block (or nothing when notes are empty). A blank note keeps
     * the box present in kiosk snapshots but with the italic placeholder removed.
     */
    private static function notesLineHtml(string $notes, bool $separate): string
    {
        if ($notes === '') {
            return '<div data-meteran-notes="1" style="margin-top:3px;font-style:italic;font-size:9px;color:#555;text-align:left;white-space:normal;">&nbsp;</div>';
        }

        return '<div data-meteran-notes="1" style="margin-top:3px;font-style:italic;font-size:9px;color:#555;text-align:left;white-space:normal;'
            .($separate ? 'border-top:1px dashed #ccc;padding-top:2px;' : '')
            .'">'.e($notes).'</div>';
    }

    /**
     * Replace the whole element body of the first element carrying $markerAttr
     * (an element like <div data-meteran-value="1" ...>...</div>) with $body,
     * preserving its opening tag. Returns $html unchanged when the marker is
     * missing (e.g. legacy kiosk snapshot for the notes line).
     */
    private static function replaceMarkedElementBody(string $html, string $markerAttr, string $body): string
    {
        $pos = strpos($html, $markerAttr);
        if ($pos === false) {
            return $html;
        }

        // Find the end of the opening tag, then the matching closing </div>.
        $tagEnd = strpos($html, '>', $pos);
        if ($tagEnd === false) {
            return $html;
        }

        $closeTag = '</div>';
        $closePos = strpos($html, $closeTag, $tagEnd);
        if ($closePos === false) {
            return $html;
        }

        return substr($html, 0, $tagEnd + 1).$body.substr($html, $closePos);
    }

    public static function injectDocumentationPhotos(string $html, ?RoomDocumentation $moveIn): string
    {
        if ($html === '' || ! $moveIn || $moveIn->media->isEmpty()) {
            return $html;
        }

        $grid = self::mediaGridHtml($moveIn->media);

        // 1) Replace the template placeholder box (current template).
        if (str_contains($html, self::DOCUMENTATION_PLACEHOLDER)) {
            return str_replace(self::DOCUMENTATION_PLACEHOLDER, $grid, $html);
        }

        // 2) Fallback: an older snapshot that keeps the heading but has no
        //    placeholder (or a slightly different one) — insert right after it.
        if (str_contains($html, self::DOCUMENTATION_HEADING)) {
            $headingTag = '<p style="font-weight:bold;">'.self::DOCUMENTATION_HEADING.'</p>';
            $insertPos = strpos($html, $headingTag);

            if ($insertPos !== false) {
                return substr($html, 0, $insertPos + strlen($headingTag))
                    .$grid
                    .substr($html, $insertPos + strlen($headingTag));
            }

            // Heading exists but with different styling — anchor on the text itself.
            $textPos = strpos($html, self::DOCUMENTATION_HEADING);

            return substr($html, 0, $textPos)
                .self::DOCUMENTATION_HEADING
                .$grid
                .substr($html, $textPos + strlen(self::DOCUMENTATION_HEADING));
        }

        return $html;
    }

    /**
     * Build a clean, professional 2-column photo grid that degrades gracefully
     * for odd photo counts and continues naturally onto the next printed page
     * when there are many photos.
     */
    private static function mediaGridHtml(Collection $media): string
    {
        $cells = $media->map(function ($m) {
            $src = e($m->url ?? '');

            return '<div style="border:1px solid #ddd;border-radius:4px;overflow:hidden;background:#fafafa;">'
                .'<img src="'.$src.'" alt="Dokumentasi" '
                .'style="width:100%;height:150px;object-fit:cover;display:block;" />'
                .'</div>';
        })->join('');

        return '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin:8px 0 16px;">'
            .$cells
            .'</div>';
    }
}
