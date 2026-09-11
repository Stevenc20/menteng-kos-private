with open('resources/js/components/KtpCaptureFlow.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_ui = """                             <div className="absolute top-4 left-0 w-full text-center text-white/90 font-medium text-sm drop-shadow-md px-2">
                                LETAKKAN KTP DI DALAM KOTAK
                             </div>
                             <div className="absolute bottom-4 left-0 w-full text-center text-white/70 text-xs drop-shadow-md px-2">
                                Pastikan teks terbaca jelas dan tidak blur
                             </div>"""

new_ui = """                             <div className="absolute top-6 left-0 w-full text-center text-white/90 font-bold text-lg drop-shadow-md px-2">
                                LETAKKAN KTP DI SINI
                             </div>
                             <div className="absolute inset-0 flex flex-col items-center justify-end pb-4 text-center text-white/90 text-xs drop-shadow-md px-2 gap-1 font-medium bg-gradient-to-t from-black/60 to-transparent">
                                <p>Pastikan seluruh KTP masuk frame (hanya panduan)</p>
                                <p>Pastikan tulisan terlihat jelas</p>
                                <p>Jangan menggunakan flash jika memantul</p>
                                <p>Pegang kamera stabil</p>
                             </div>"""

content = content.replace(old_ui, new_ui)

with open('resources/js/components/KtpCaptureFlow.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
