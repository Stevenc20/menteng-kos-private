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
