<?php

namespace App\Services;

use App\Models\RoomDocumentation;
use Illuminate\Support\Collection;

/**
 * Injects the tenant's BEFORE (MOVE_IN) documentation photos into the
 * Surat Pernyataan HTML so the "Dokumentasi kios saat diserahkan" section
 * always reflects the latest persisted photos from the database.
 *
 * `document_html` is a point-in-time snapshot signed by the tenant; we never
 * rewrite the stored snapshot. Instead the admin review page receives the
 * snapshot with the placeholder box replaced by a live photo grid, so viewing
 * and printing (window.print → "Save as PDF") always show the CURRENT photos.
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
