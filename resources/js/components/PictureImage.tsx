import type { ResponsiveImageSet } from '@/lib/images';

interface PictureImageProps {
    set: ResponsiveImageSet;
    alt: string;
    className?: string;
    sizes?: string;
    loading?: 'lazy' | 'eager';
    decoding?: 'async' | 'sync';
    fetchPriority?: 'high' | 'low' | 'auto';
    draggable?: boolean;
    width?: number;
    height?: number;
}

export default function PictureImage({
    set,
    alt,
    className,
    sizes = '100vw',
    loading,
    decoding = 'async',
    fetchPriority,
    draggable,
    width,
    height,
}: PictureImageProps) {
    return (
        <picture>
            <source type="image/avif" srcSet={set.avif} sizes={sizes} />
            <source type="image/webp" srcSet={set.webp} sizes={sizes} />
            <img
                src={set.fallback}
                srcSet={set.jpg}
                sizes={sizes}
                alt={alt}
                width={width ?? set.width}
                height={height ?? set.height}
                loading={loading}
                decoding={decoding}
                fetchPriority={fetchPriority}
                draggable={draggable}
                className={className}
            />
        </picture>
    );
}