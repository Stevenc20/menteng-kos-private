export const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener('load', () => resolve(image));
        image.addEventListener('error', (error) => reject(error));
        image.setAttribute('crossOrigin', 'anonymous');
        image.src = url;
    });

export default async function getCroppedImg(
    imageSrc: string,
    pixelCrop: { x: number; y: number; width: number; height: number },
    fileName: string = 'ktp-crop.jpeg'
): Promise<File> {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('No 2d context');
    }

    // Set canvas dimensions to the crop size
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    // Draw the cropped image onto the canvas
    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
    );

    // As a Blob
    return new Promise((resolve, reject) => {
        canvas.toBlob((file) => {
            if (file) {
                // Return a File object
                resolve(new File([file], fileName, { type: 'image/jpeg' }));
            } else {
                reject(new Error('Canvas is empty'));
            }
        }, 'image/jpeg', 0.95);
    });
}
