<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GoogleVisionKtpOcrService
{
    private string $apiKey;

    public function __construct(?string $apiKey = null)
    {
        $this->apiKey = $apiKey ?? (string) config('services.vision.api_key', '');
    }

    public function available(): bool
    {
        return $this->apiKey !== '';
    }

    /**
     * Extract full visible text from an image via Google Cloud Vision
     * DOCUMENT_TEXT_DETECTION. Returns '' when nothing was recognized.
     *
     * @throws \RuntimeException on network/API failure
     */
    public function extractText(string $absolutePath): string
    {
        $content = @file_get_contents($absolutePath);
        if ($content === false || $content === '') {
            throw new \RuntimeException('Unable to read image file for Google Vision OCR');
        }

        $response = Http::withHeaders(['x-goog-api-key' => $this->apiKey])
            ->acceptJson()
            ->timeout(30)
            ->post('https://vision.googleapis.com/v1/images:annotate', [
                'requests' => [[
                    'image' => ['content' => base64_encode($content)],
                    'features' => [['type' => 'DOCUMENT_TEXT_DETECTION']],
                ]],
            ]);

        if ($response->failed()) {
            $err = $response->json('error.message') ?? $response->body();
            Log::error('Google Vision OCR request failed', ['error' => $err, 'status' => $response->status()]);

            throw new \RuntimeException('Google Vision OCR request failed: ' . $err);
        }

        $text = (string) data_get($response->json(), 'responses.0.fullTextAnnotation.text', '');

        if (trim($text) === '') {
            Log::warning('Google Vision OCR returned no text', ['status' => $response->status()]);
        }

        return $text;
    }
}