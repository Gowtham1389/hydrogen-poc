/**
 * CollectionBanner Component
 */

import {Image} from '@shopify/hydrogen';

interface CollectionBannerProps {
  title: string;
  subtitle?: string;
  image?: {
    url: string;
    altText?: string;
    width?: number;
    height?: number;
  } | null;
}

export function CollectionBanner({
  title,
  subtitle,
  image,
}: CollectionBannerProps) {
  return (
    <section
      className="collection-banner relative w-full h-[40vh] min-h-75 max-h-125 flex items-center justify-center overflow-hidden lg:z-0 bg-gray-100"
      aria-label="Collection banner"
    >
      {image?.url && (
        <>
          <div className="absolute inset-0 z-0">
            <Image
              data={image}
              sizes="100vw"
              className="w-full h-full object-cover object-center"
              loading="eager"
            />
          </div>
          <div className="absolute inset-0 z-10 bg-black/50" />
        </>
      )}
      <div className="relative z-20 text-center px-4 py-8 max-w-4xl mx-auto">
        {title && (
          <h1 className="font-bold leading-tight! mt-0! mb-4! text-white drop-shadow-lg text-4xl! md:text-5xl! lg:text-6xl!">
            {title}
          </h1>
        )}
        {subtitle && (
          <p className="leading-normal font-normal! text-lg! md:text-xl! lg:text-2xl! text-white/95 max-w-2xl mx-auto drop-shadow-md whitespace-pre-line">
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
