import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

// Kanvas tanda tangan/paraf berbasis Pointer Events menggantikan
// react-signature-canvas (signature_pad) yang crash di layar sentuh
// ("Cannot read properties of undefined (reading 'push')") saat
// sentuhan melewati kanvas yang belum memulai coretan sendiri.

export interface SignaturePadHandle {
    clear(): void;
    isEmpty(): boolean;
    getImage(): string;
}

interface SignaturePadProps {
    className?: string;
    onEnd?: (dataUrl: string) => void;
}

function cropDataUrl(canvas: HTMLCanvasElement): string {
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas.toDataURL('image/png');
    const w = canvas.width;
    const h = canvas.height;
    const { data } = ctx.getImageData(0, 0, w, h);
    let top = h, bottom = 0, left = w, right = 0;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (data[(y * w + x) * 4 + 3] > 0) {
                if (x < left) left = x;
                if (x > right) right = x;
                if (y < top) top = y;
                if (y > bottom) bottom = y;
            }
        }
    }
    if (right < left || bottom < top) return canvas.toDataURL('image/png');
    const pad = 4;
    const sx = Math.max(0, left - pad);
    const sy = Math.max(0, top - pad);
    const sw = Math.min(w - sx, right - left + 1 + pad * 2);
    const sh = Math.min(h - sy, bottom - top + 1 + pad * 2);
    const out = document.createElement('canvas');
    out.width = sw;
    out.height = sh;
    out.getContext('2d')?.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    return out.toDataURL('image/png');
}

const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(({ className, onEnd }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawingRef = useRef(false);
    const lastRef = useRef<{ x: number; y: number } | null>(null);
    const emptyRef = useRef(true);
    const onEndRef = useRef(onEnd);
    onEndRef.current = onEnd;

    useEffect(() => {
        const c = canvasRef.current;
        if (!c) return;
        c.style.touchAction = 'none';
        const rect = c.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const dpr = window.devicePixelRatio || 1;
        c.width = Math.max(1, Math.round(rect.width * dpr));
        c.height = Math.max(1, Math.round(rect.height * dpr));
    }, []);

    const getCurrentImage = () => {
        const c = canvasRef.current;
        return c ? cropDataUrl(c) : '';
    };

    useImperativeHandle(ref, () => ({
        clear() {
            const c = canvasRef.current;
            if (!c) return;
            c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
            emptyRef.current = true;
            lastRef.current = null;
        },
        isEmpty() {
            return emptyRef.current;
        },
        getImage() {
            return getCurrentImage();
        },
    }), []);

    const getPos = (e: ReactPointerEvent<HTMLCanvasElement>) => {
        const c = canvasRef.current;
        if (!c) return { x: 0, y: 0 };
        const rect = c.getBoundingClientRect();
        const scaleX = c.width / (rect.width || 1);
        const scaleY = c.height / (rect.height || 1);
        return {
            x: Math.max(0, Math.min(c.width, (e.clientX - rect.left) * scaleX)),
            y: Math.max(0, Math.min(c.height, (e.clientY - rect.top) * scaleY)),
        };
    };

    const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
        const c = canvasRef.current;
        if (!c) return;
        e.preventDefault();
        try {
            c.setPointerCapture(e.pointerId);
        } catch {
            // pointer capture tidak tersedia di beberapa browser; lanjut saja
        }
        const ctx = c.getContext('2d');
        if (!ctx) return;
        drawingRef.current = true;
        emptyRef.current = false;
        const { x, y } = getPos(e);
        lastRef.current = { x, y };
        ctx.strokeStyle = '#111827';
        ctx.fillStyle = '#111827';
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
    };

    const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
        if (!drawingRef.current) return;
        const c = canvasRef.current;
        if (!c) return;
        const ctx = c.getContext('2d');
        if (!ctx) return;
        const { x, y } = getPos(e);
        const last = lastRef.current;
        if (!last) {
            lastRef.current = { x, y };
            return;
        }
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        lastRef.current = { x, y };
    };

    const finishStroke = () => {
        if (!drawingRef.current) return;
        drawingRef.current = false;
        lastRef.current = null;
        onEndRef.current?.(getCurrentImage());
    };

    return (
        <canvas
            ref={canvasRef}
            className={className}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={finishStroke}
            onPointerCancel={finishStroke}
            onPointerLeave={(e) => {
                if (drawingRef.current && e.pointerType !== 'touch') {
                    finishStroke();
                }
            }}
        />
    );
});

SignaturePad.displayName = 'SignaturePad';

export default SignaturePad;