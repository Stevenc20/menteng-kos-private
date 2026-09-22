import { useEffect, useRef, useState, type Ref, type RefObject } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import SignaturePad, { type SignaturePadHandle } from './SignaturePad';

// Modal tanda tangan / paraf: kanvas besar full-screen di HP,
// dialog biasa di desktop. Simpan = onConfirm(dataUrl), plus Bersihkan/Batal.

interface SignatureModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    padRef: RefObject<SignaturePadHandle | null>;
    padKey?: string | number;
    initialImage?: string;
    onConfirm: (dataUrl: string) => void;
}

export default function SignatureModal({ open, onClose, title, subtitle, padRef, padKey, initialImage, onConfirm }: SignatureModalProps) {
    const [hasContent, setHasContent] = useState(false);
    const confirmedRef = useRef(false);

    useEffect(() => {
        if (open) {
            confirmedRef.current = false;
            setHasContent(Boolean(initialImage));
            padRef.current?.clear();
            if (initialImage) {
                // Tunggu kanvas selesai diukur, lalu prefill gambar lama.
                let alive = true;
                const t = window.setTimeout(() => {
                    if (!alive) return;
                    padRef.current?.loadImage(initialImage);
                }, 0);
                return () => {
                    alive = false;
                    window.clearTimeout(t);
                };
            }
        }
    }, [open, initialImage, padRef]);

    const handleConfirm = () => {
        if (confirmedRef.current) return;
        const url = padRef.current?.getImage?.() ?? '';
        if (!url) return;
        confirmedRef.current = true;
        onConfirm(url);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="bg-white text-neutral-900 w-full max-w-none sm:max-w-xl h-[100dvh] sm:h-auto min-h-0 max-h-[100dvh] overflow-hidden rounded-none sm:rounded-2xl border-neutral-200 p-0 sm:p-6 gap-0 sm:gap-4 flex flex-col">
                <DialogHeader className="px-4 pt-4 sm:px-0 sm:pt-0">
                    <DialogTitle className="text-base sm:text-lg">{title}</DialogTitle>
                    <DialogDescription>
                        {subtitle ?? 'Tulis dengan jari atau stylus di area di bawah ini.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 min-h-0 px-4 pt-2 sm:px-0 sm:pt-0 pb-3">
                    <div className="border-2 border-dashed border-neutral-300 rounded-lg bg-white overflow-hidden h-full w-full">
                        <SignaturePad
                            key={padKey}
                            ref={padRef as Ref<SignaturePadHandle>}
                            className="w-full h-full min-h-[240px]"
                            onEnd={() => setHasContent(true)}
                        />
                    </div>
                </div>

                <div className="px-4 pb-4 sm:px-0 sm:pb-0 grid grid-cols-2 gap-2 sm:flex sm:justify-end sm:gap-3">
                    <button
                        type="button"
                        onClick={() => {
                            padRef.current?.clear();
                            setHasContent(false);
                        }}
                        className="px-4 py-3 rounded-lg font-medium text-neutral-600 border border-neutral-200 hover:bg-neutral-100 transition-colors"
                    >
                        Bersihkan
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-3 rounded-lg font-medium bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-colors"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!hasContent}
                        className="px-4 py-3 rounded-lg font-bold bg-neutral-900 text-white hover:bg-neutral-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed col-span-2 sm:col-span-1"
                    >
                        Simpan
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}