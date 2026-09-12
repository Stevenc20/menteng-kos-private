export interface ResponsiveImageSet {
    avif: string;
    webp: string;
    jpg: string;
    fallback: string;
    width: number;
    height: number;
}

const srcsetFor = (kind: string, widths: number[]) => ({
    avif: widths.map((w) => `/img/opt/${kind}-${w}.avif ${w}w`).join(', '),
    webp: widths.map((w) => `/img/opt/${kind}-${w}.webp ${w}w`).join(', '),
    jpg: widths.map((w) => `/img/opt/${kind}-${w}.jpg ${w}w`).join(', '),
});

export const HERO_IMAGE: ResponsiveImageSet = {
    ...srcsetFor('hero', [640, 1024, 1600]),
    fallback: '/img/opt/hero-1600.jpg',
    width: 1907,
    height: 825,
};

export const KAMAR_IMAGE: ResponsiveImageSet = {
    ...srcsetFor('kamar', [640, 1024, 1400]),
    fallback: '/img/opt/kamar-1024.jpg',
    width: 3024,
    height: 4032,
};

export const PROPERTI_1_IMAGE: ResponsiveImageSet = {
    ...srcsetFor('p1', [384, 640, 1024]),
    fallback: '/img/opt/p1-640.jpg',
    width: 4032,
    height: 3024,
};

export const PROPERTI_2_IMAGE: ResponsiveImageSet = {
    ...srcsetFor('p2', [384, 640, 1024]),
    fallback: '/img/opt/p2-640.jpg',
    width: 4032,
    height: 3024,
};