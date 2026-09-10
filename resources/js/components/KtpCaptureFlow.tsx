import React, { useState, useRef, useEffect, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../utils/cropImage';

interface KtpCaptureFlowProps {
    onCapture: (file: File) => void;
    onCancel: () => void;
}

const KTP_ASPECT_RATIO = 1.586; // 85.6 / 53.98

export default function KtpCaptureFlow({ onCapture, onCancel }: KtpCaptureFlowProps) {
    const [mode, setMode] = useState<'selection' | 'camera' | 'gallery_crop' | 'preview'>('selection');
    
    // Camera state
    const videoRef = useRef<HTMLVideoElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [cameraError, setCameraError] = useState<string>('');
    
    // Image state for cropper/preview
    const [imageSrc, setImageSrc] = useState<string>('');
    const [croppedFile, setCroppedFile] = useState<File | null>(null);

    // React-easy-crop state
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

    // Cleanup stream on unmount
    useEffect(() => {
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [stream]);

    // Ensure video gets the stream once it's rendered
    useEffect(() => {
        if (mode === 'camera' && videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [mode, stream]);

    const startCamera = async () => {
        try {
            setCameraError('');
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            });
            setStream(newStream);
            if (videoRef.current) {
                videoRef.current.srcObject = newStream;
            }
            setMode('camera');
        } catch (err) {
            console.error('Camera access error:', err);
            setCameraError('Gagal mengakses kamera. Pastikan izin kamera diberikan.');
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    const captureCamera = () => {
        if (!videoRef.current) return;
        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // CROP berdasarkan frame yang ada di layar.
        // Asumsi: Frame KTP berada di tengah dengan lebar 90% dari lebar video (jika portrait, mungkin lebih kecil).
        // Kita simulasikan ukuran frame KTP di atas video.
        
        // Lebar frame overlay = 90% dari lebar container, atau 90% dari tinggi container jika lebih muat.
        // Mari hitung crop area berdasarkan aspect ratio KTP di tengah canvas.
        let frameW = canvas.width * 0.9;
        let frameH = frameW / KTP_ASPECT_RATIO;
        
        if (frameH > canvas.height * 0.9) {
            frameH = canvas.height * 0.9;
            frameW = frameH * KTP_ASPECT_RATIO;
        }

        const cropX = (canvas.width - frameW) / 2;
        const cropY = (canvas.height - frameH) / 2;

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = frameW;
        cropCanvas.height = frameH;
        const cropCtx = cropCanvas.getContext('2d');
        if (!cropCtx) return;

        cropCtx.drawImage(
            canvas,
            cropX, cropY, frameW, frameH,
            0, 0, frameW, frameH
        );

        const imageData = cropCtx.getImageData(0, 0, frameW, frameH);
        const data = imageData.data;
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) {
            sum += (data[i] + data[i+1] + data[i+2]) / 3;
        }
        const avgBrightness = sum / (frameW * frameH);
        
        let isTooSmall = frameW < 400 || frameH < 250;
        let isTooDark = avgBrightness < 40;
        
        // FRAME HANYA PANDUAN. Jangan menolak foto.
        // User want to proceed anyway even if it's considered too dark or small.
        if (isTooDark) {
            console.warn('Foto terdeteksi sedikit gelap, tapi tetap dilanjutkan.');
        }

        cropCanvas.toBlob((blob) => {
            if (blob) {
                const file = new File([blob], 'ktp-camera-crop.jpg', { type: 'image/jpeg' });
                setCroppedFile(file);
                setImageSrc(URL.createObjectURL(blob));
                stopCamera();
                setMode('preview');
                
                console.log('1. RAW CAMERA IMAGE DIMENSION:', canvas.width, 'x', canvas.height);
                console.log('2. CROP FRAME DIMENSION:', frameW, 'x', frameH);
                console.log('3. FINAL CROPPED IMAGE DIMENSION:', cropCanvas.width, 'x', cropCanvas.height);
            }
        }, 'image/jpeg', 0.95);
    };

    const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            setImageSrc(URL.createObjectURL(file));
            setMode('gallery_crop');
        }
    };

    const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const confirmGalleryCrop = async () => {
        try {
            const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
            setCroppedFile(croppedImage);
            setImageSrc(URL.createObjectURL(croppedImage));
            setMode('preview');
        } catch (e) {
            console.error(e);
        }
    };

    const submitPhoto = () => {
        if (croppedFile) {
            onCapture(croppedFile);
        }
    };

    if (mode === 'selection') {
        return (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-6">
                    <div>
                        <h3 className="text-xl font-bold">Ambil Foto KTP</h3>
                        <p className="text-neutral-500 text-sm mt-1">Pilih sumber foto identitas Anda.</p>
                    </div>
                    {cameraError && <p className="text-red-500 text-sm font-medium">{cameraError}</p>}
                    <div className="space-y-3">
                        <button onClick={startCamera} className="w-full p-4 rounded-xl border-2 border-neutral-200 bg-neutral-50 hover:border-neutral-900 transition-colors flex items-center gap-4 text-left">
                            <span className="text-3xl">📷</span>
                            <div>
                                <div className="font-semibold text-neutral-900">Gunakan Kamera</div>
                                <div className="text-xs text-neutral-500">Ambil foto KTP secara langsung</div>
                            </div>
                        </button>
                        <div className="relative">
                            <input type="file" accept="image/*" className="hidden" id="ktp-gallery" onChange={handleGalleryUpload} />
                            <label htmlFor="ktp-gallery" className="w-full p-4 rounded-xl border-2 border-neutral-200 bg-neutral-50 hover:border-neutral-900 transition-colors flex items-center gap-4 text-left cursor-pointer">
                                <span className="text-3xl">🖼️</span>
                                <div>
                                    <div className="font-semibold text-neutral-900">Pilih dari Galeri</div>
                                    <div className="text-xs text-neutral-500">Gunakan foto yang sudah ada</div>
                                </div>
                            </label>
                        </div>
                    </div>
                    <button onClick={onCancel} className="w-full py-3 font-medium text-neutral-500 hover:text-neutral-900">Batal</button>
                </div>
            </div>
        );
    }

    if (mode === 'camera') {
        return (
            <div className="fixed inset-0 z-50 bg-black flex flex-col">
                <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black">
                    <video 
                        ref={videoRef}
                        autoPlay 
                        playsInline
                        muted
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                    
                    {/* Overlay Frame KTP */}
                    <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
                        <div className="relative border-2 border-white/80 rounded-lg overflow-hidden shadow-[0_0_0_9999px_rgba(0,0,0,0.7)]" 
                             style={{ 
                                width: '90%', 
                                aspectRatio: KTP_ASPECT_RATIO,
                                maxWidth: '600px'
                             }}>
                             <div className="absolute top-6 left-0 w-full text-center text-white/90 font-bold text-lg drop-shadow-md px-2">
                                LETAKKAN KTP DI SINI
                             </div>
                             <div className="absolute inset-0 flex flex-col items-center justify-end pb-4 text-center text-white/90 text-xs drop-shadow-md px-2 gap-1 font-medium bg-gradient-to-t from-black/60 to-transparent">
                                <p>Pastikan seluruh KTP masuk frame (hanya panduan)</p>
                                <p>Pastikan tulisan terlihat jelas</p>
                                <p>Jangan menggunakan flash jika memantul</p>
                                <p>Pegang kamera stabil</p>
                             </div>
                        </div>
                    </div>
                </div>
                
                <div className="h-32 bg-black flex items-center justify-between px-8 z-20">
                    <button onClick={() => { stopCamera(); setMode('selection'); }} className="text-white font-medium p-2">Batal</button>
                    <button onClick={captureCamera} className="w-16 h-16 rounded-full bg-white border-4 border-neutral-300 active:scale-95 transition-transform flex items-center justify-center" aria-label="Ambil Foto"></button>
                    <div className="w-12"></div> {/* Spacer for center alignment */}
                </div>
            </div>
        );
    }

    if (mode === 'gallery_crop') {
        return (
            <div className="fixed inset-0 z-50 bg-black flex flex-col">
                <div className="p-4 bg-black text-white text-center text-sm">
                    Geser dan zoom agar KTP pas dengan bingkai
                </div>
                <div className="flex-1 relative">
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={KTP_ASPECT_RATIO}
                        onCropChange={setCrop}
                        onCropComplete={onCropComplete}
                        onZoomChange={setZoom}
                    />
                </div>
                <div className="p-6 bg-black flex gap-4">
                    <button onClick={() => setMode('selection')} className="flex-1 py-3 rounded-lg bg-neutral-800 text-white font-medium">Batal</button>
                    <button onClick={confirmGalleryCrop} className="flex-1 py-3 rounded-lg bg-white text-black font-medium">Pilih & Potong</button>
                </div>
            </div>
        );
    }

    if (mode === 'preview') {
        return (
            <div className="fixed inset-0 z-50 bg-black flex flex-col">
                <div className="p-4 bg-black text-white text-center font-medium">
                    Pratinjau Hasil
                </div>
                <div className="flex-1 p-4 flex items-center justify-center">
                    <img src={imageSrc} alt="Preview KTP" className="max-w-full max-h-full rounded-lg border border-neutral-700" />
                </div>
                <div className="p-6 bg-black space-y-4 text-center">
                    <p className="text-white/80 text-sm">Pastikan KTP terlihat jelas dan tulisan dapat dibaca.</p>
                    <div className="flex gap-4">
                        <button onClick={() => setMode('selection')} className="flex-1 py-3 rounded-lg bg-neutral-800 text-white font-medium">Ulangi</button>
                        <button onClick={submitPhoto} className="flex-1 py-3 rounded-lg bg-white text-black font-medium">Gunakan Foto Ini</button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}
