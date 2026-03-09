import {Link} from 'react-router';
import {Image, Money} from '@shopify/hydrogen';
import {useState} from 'react';
import type {
  ProductItemFragment,
  CollectionItemFragment,
  RecommendedProductFragment,
} from 'storefrontapi.generated';
import {useVariantUrl} from '~/lib/variants';

export function ProductItem({
  product,
  loading,
}: {
  product:
    | CollectionItemFragment
    | ProductItemFragment
    | RecommendedProductFragment;
  loading?: 'eager' | 'lazy';
}) {
  const variantUrl = useVariantUrl(product.handle);
  const colorOption =
    'options' in product
      ? product.options?.find(
          (option) => option.name.toLowerCase() === 'color',
        )
      : undefined;
  const [image, setImage] = useState(product.featuredImage);

  return (
    <div className="product-item-wrapper flex flex-col gap-y-1.25">
      <Link
        className="product-item flex flex-col gap-y-1.25"
        key={product.id}
        prefetch="intent"
        to={variantUrl}
      >
        {image && (
          <Image
            alt={image.altText || product.title}
            aspectRatio="1/1"
            data={image}
            loading={loading}
            sizes="(min-width: 45em) 400px, 100vw"
          />
        )}
        <h2 className="product-item-title text-base! md:text-lg! font-semibold! leading-snug! my-0!">{product.title}</h2>
        <small>
          <Money data={product.priceRange.minVariantPrice} />
        </small>
      </Link>
      {colorOption && (
        <div className="product-item-swatches flex flex-wrap gap-2.5">
          {colorOption.optionValues.map((value) => {
            const variant = value.firstSelectableVariant;
            const bgColor = value.swatch?.color ?? '';
              return (
                <button
                  key={value.name}
                  className={`swatch w-7.5 h-7.5 rounded-full border-2 border-solid border-[#ccc] cursor-pointer transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 focus:border-black focus:outline-none hover:border-black hover:outline-none ${!variant ? 'disabled:opacity-50 disabled:cursor-not-allowed' : ''} ${bgColor?'':'no-bg w-auto! px-1.25 rounded-none!'}`}
                  aria-label={`Select ${value.name} color variant`}
                  style={{ backgroundColor: bgColor }}
                  onClick={() => {
                    if (variant?.image) {
                      setImage(variant.image);
                    }
                  }}
                >
                  <span className={`${bgColor ? 'sr-only' : ''}`}>{value.name}</span>
                </button>
              );
            })
          }
        </div>
      )}
    </div>
  );
}
