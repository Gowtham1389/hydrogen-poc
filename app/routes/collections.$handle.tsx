import {redirect, useLoaderData, useSearchParams} from 'react-router';
import { useState, useEffect } from 'react';
import type {Route} from './+types/collections.$handle';
import {getPaginationVariables, Analytics} from '@shopify/hydrogen';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {ProductItem} from '~/components/ProductItem';
import type {ProductItemFragment} from 'storefrontapi.generated';
import { CollectionBanner } from '~/components/CollectionBanner';
import {FilterCheckbox} from '~/components/Filters';
import type {ProductFilter, ProductCollectionSortKeys} from '@shopify/hydrogen/storefront-api-types';

export const meta: Route.MetaFunction = ({data}) => {
  return [{title: `Hydrogen | ${data?.collection.title ?? ''} Collection`}];
};

export async function loader(args: Route.LoaderArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return {...deferredData, ...criticalData};
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({context, params, request}: Route.LoaderArgs) {
  const {handle} = params;
  const {storefront} = context;
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 8,
  });

  const searchParams = new URL(request.url).searchParams;

  // Multi select (important: use getAll instead of split)
  const colors = searchParams.getAll('color');
  const sizes = searchParams.getAll('size');
  const vendors = searchParams.getAll('vendor');
  const types = searchParams.getAll('type');

  const filters: ProductFilter[] = [
    ...colors.map((c) => ({
      variantOption: {name: 'Color', value: c},
    })),
    ...sizes.map((s) => ({
      variantOption: {name: 'Size', value: s},
    })),
    ...vendors.map((v) => ({
      productVendor: v,
    })),
    ...types.map((t) => ({
      productType: t,
    })),
  ];

  // Sorting
  const sortParam = searchParams.get('sort');

 const sortMap: Record<
    string,
    {sortKey: ProductCollectionSortKeys; reverse?: boolean}
  > = {
    'price-asc': {sortKey: 'PRICE', reverse: false},
    'price-desc': {sortKey: 'PRICE', reverse: true},
    best: {sortKey: 'BEST_SELLING'},
    newest: {sortKey: 'CREATED'},
  };

  const sortConfig = sortParam ? sortMap[sortParam] : undefined;

  const sortKey = sortConfig?.sortKey;
  const reverse = sortConfig?.reverse;

  const min = searchParams.get('min');
  const max = searchParams.get('max');

  if (min || max) {
    filters.push({
      price: {
        min: min && !isNaN(Number(min)) ? parseFloat(min) : undefined,
        max: max && !isNaN(Number(max)) ? parseFloat(max) : undefined,
      },
    });
  }

  if (!handle) {
    throw redirect('/collections');
  }

  const [{collection}, bannerData] = await Promise.all([
    storefront.query(COLLECTION_QUERY, {
      variables: {
        handle,
        ...paginationVariables,
        filters,
        sortKey,
        reverse,
      },
      // Add other queries here, so that they are loaded in parallel
    }),
    storefront.query(COLLECTION_BANNER_QUERY, { variables: {handle}, }),
  ]);

  if (!collection) {
    throw new Response(`Collection ${handle} not found`, {
      status: 404,
    });
  }

  // The API handle might be localized, so redirect to the localized handle
  redirectIfHandleIsLocalized(request, {handle, data: collection});

  let banner = null;
  if (bannerData?.metaobject?.fields) {
    const fields = bannerData.metaobject.fields.reduce((acc: any, field: any) => {
      acc[field.key] = field;
      return acc;
    }, {});

    banner = {
      title: fields.title?.value || '',
      subtitle: fields.subtitle?.value || '',
      image: fields.image?.reference?.image || null,
    };
  }

  return {
    collection,
    banner,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: Route.LoaderArgs) {
  return {};
}

type ShopifyFilterInput = {
  productVendor?: string;
  productType?: string;
  variantOption?: {
    name: string;
    value: string;
  };
};

function SortDropdown() {
  const [searchParams, setSearchParams] = useSearchParams();
  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor="sort-dropdown">Sort By:</label>
      <select
        value={searchParams.get('sort') || ''}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams);
          params.set('sort', e.target.value);
          setSearchParams(params);
        }}
        id="sort-dropdown"
      >
        <option value="">Featured</option>
        <option value="best">Best Selling</option>
        <option value="newest">Newest</option>
        <option value="price-asc">Price low to high</option>
        <option value="price-desc">Price high to low</option>
      </select>
    </div>
  );
}

function PriceFilter() {
  const [searchParams, setSearchParams] = useSearchParams();

  const min = searchParams.get('min') || '';
  const max = searchParams.get('max') || '';

  function update(key: 'min' | 'max', value: string) {
    const params = new URLSearchParams(searchParams);

    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    setSearchParams(params);
  }

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="min-price"
          className="block text-sm font-medium text-(--color-text-primary) cursor-pointer">
          Minimum Price
        </label>
        <input
          type="number"
          value={min}
          min={0}
          max={3000}
          id="min-price"
          className="w-full m-0!"
          onChange={(e) => update('min', e.target.value)}
        />
      </div>
      <span className="text-sm leading-normal text-(--color-text-secondary) font-normal">Minimum price must be 0 or greater.</span>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="max-price"
          className="block mb-1.5 text-sm font-medium text-(--color-text-primary) cursor-pointer">
          Maximum Price
        </label>
        <input
          type="number"
          value={max}
          min={0}
          max={3000}
          id="max-price"
          className="w-full m-0!"
          onChange={(e) => update('max', e.target.value)}
        />
      </div>
      <span className="text-sm leading-normal text-(--color-text-secondary) font-normal">Maximum price cannot exceed 3000.</span>
    </div>
  );
}

function AppliedFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const entries = Array.from(searchParams.entries()).filter(
    ([key]) => key !== 'sort'
  );

  const hasFilters = entries.length > 0;

  function remove(key: string, value: string) {
    const params = new URLSearchParams(searchParams);

    const values = params.getAll(key).filter((v) => v !== value);

    params.delete(key);
    values.forEach((v) => params.append(key, v));

    setSearchParams(params);
  }
  
  if (hasFilters) return (
    <div className="applied-filters mb-3">
      <h4 className="text-base! font-semibold leading-snug! mb-2 text-gray-900 md:text-lg! md:font-bold">Applied filters</h4>
      <div className="flex flex-wrap gap-2">
        {entries.map(([key, value]) => (
          <button key={`${key}-${value}`} onClick={() => remove(key, value)} className="group flex items-center gap-2 cursor-pointer px-4 py-1.5 rounded-full bg-white border border-gray-300 shadow-sm text-sm text-gray-700 hover:bg-gray-50
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition">
            <span className="capitalize">
              {key}: {value}
            </span>
            <span aria-hidden="true" className="w-5 h-5 flex items-center justify-center rounded-full bg-gray-300 group-hover:bg-gray-400 text-gray-800 text-xs transition">&times;</span>
          </button>
        ))}
        <button onClick={() => setSearchParams({})} className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
          <span className="leading-normal font-medium text-sm text-gray-700 underline hover:text-gray-900 transition">Clear All</span>
        </button>
      </div>
    </div>
  );

  if (!hasFilters) return null;
}

function FilterContent({
  filteredList,
  openFilters,
  toggleFilter,
}: any) {
  return (
    <>
      <AppliedFilters />
      <h2 className="text-2xl! md:text-3xl! font-bold! leading-tight! text-(--color-text-primary) mb-4 mt-2 hidden md:block">Filters</h2>
      <div className="filter-items flex flex-col gap-4">
        {filteredList.map((filter: any) => {
          const isOpen = openFilters.includes(filter.label);

          return (
            <div key={filter.id} className="filter-item border border-solid border-[#a3a3a3] rounded-lg overflow-hidden">
              <h3>
                <button
                  className="filter-header cursor-pointer w-full px-4 py-3 flex items-center justify-between text-left font-semibold text-base text-(--color-text-primary)
                  focus-visible:outline-none transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed capitalize"
                  onClick={() => toggleFilter(filter.label)}
                  id={`filter-${filter.label.toLowerCase().replace(/\s+/g, '')}-header`}
                  aria-controls={`filter-${filter.label.toLowerCase().replace(/\s+/g, '')}-panel`}
                  aria-expanded={isOpen}
                >
                  {filter.label}
                  <span aria-hidden="true" className={`ml-2 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                  </span>
                </button>
              </h3>
              {isOpen && (
                <div className="filter-content border-t border-solid border-[#a3a3a3] bg-[#fafafa] py-3 px-4"
                  id={`filter-${filter.label.toLowerCase().replace(/\s+/g, '')}-panel`}
                  role="region" aria-labelledby={`filter-${filter.label.toLowerCase().replace(/\s+/g, '')}-header`}>
                  {filter.values.map((value: any) => {
                    const input = JSON.parse(value.input as string) as ShopifyFilterInput;

                    let param = '';
                    let val = '';

                    if (input.productVendor) {
                      param = 'vendor';
                      val = input.productVendor;
                    } else if (input.productType) {
                      param = 'type';
                      val = input.productType;
                    } else if (input.variantOption) {
                      param = input.variantOption.name.toLowerCase();
                      val = input.variantOption.value;
                    }

                    return (
                      <FilterCheckbox
                        key={value.id}
                        param={param}
                        value={val}
                        label={value.label}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        <div className="filter-item border border-solid border-[#a3a3a3] rounded-lg overflow-hidden">
          <button
            className="filter-header cursor-pointer w-full px-4 py-3 flex items-center justify-between text-left font-semibold text-base text-(--color-text-primary)
            focus-visible:outline-none transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => toggleFilter('Price')}
            id="filter-price-header"
            aria-controls="filter-price-panel"
            aria-expanded={openFilters.includes('Price')}
          >
            Price
            <span aria-hidden="true" className={`ml-2 transform transition-transform duration-200 ${openFilters.includes('Price') ? 'rotate-180' : 'rotate-0'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </span>
          </button>

          {openFilters.includes('Price') && (
            <div className="filter-content border-t border-solid border-[#a3a3a3] bg-[#fafafa] py-3 px-4"
              id="filter-price-panel" role="region" aria-labelledby="filter-price-header">
              <PriceFilter />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function Collection() {
  const {collection, banner} = useLoaderData<typeof loader>();
  const [showFilters, setShowFilters] = useState(true);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const FILTER_ORDER = ['Vendor', 'Product type', 'Size', 'Color'];
  const filteredList = collection.products.filters
  .filter((f) => FILTER_ORDER.includes(f.label))
  .sort(
    (a, b) =>
      FILTER_ORDER.indexOf(a.label) - FILTER_ORDER.indexOf(b.label)
  );
  const [openFilters, setOpenFilters] = useState<string[]>([
    'Vendor',
    'Product type',
  ]);
  function toggleFilter(label: string) {
    setOpenFilters((prev) =>
      prev.includes(label)
        ? prev.filter((f) => f !== label)
        : [...prev, label]
    );
  }

  useEffect(() => {
  function handleResize() {
    if (window.innerWidth >= 768) {
      setIsMobileFilterOpen(false);
    }
  }

  window.addEventListener('resize', handleResize);

  return () => {
    window.removeEventListener('resize', handleResize);
  };

}, []);

  return (
    <div className="collection">
      {banner && (
        <CollectionBanner
          title={banner.title}
          subtitle={banner.subtitle}
          image={banner.image}
        />
      )}
      {!banner?.title && (
        <h1>{collection.title}</h1>
      )}
      
      <p className="collection-description empty:mb-0!">{collection.description}</p>
      <div className="collection-filter-nav flex items-center justify-between bg-white py-2 px-1 mb-6 sticky top-16 z-5 md:static">
        <button className="py-1 px-3 gap-2 inline-flex items-center justify-center
        font-semibold border border-transparent bg-neutral-200 hover:bg-neutral-300 transition-all duration-200 focus-visible:outline-none
        disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none shadow-none rounded-md
        cursor-pointer uppercase text-(--color-text-primary) focus-visible:ring-(--color-primary-500)"
        aria-expanded={showFilters}
        onClick={() => {
          if (window.innerWidth < 768) {
            setIsMobileFilterOpen(true);
          } else {
            setShowFilters(!showFilters);
          }
        }}
        id="filters-header"
        aria-controls="filters-panel">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="transparent"
            stroke="currentColor"
            aria-hidden="true"
            className="w-5 h-5"
          >
            <title>Filters</title>
            <circle cx="4.5" cy="6.5" r="2"></circle>
            <line x1="6" y1="6.5" x2="14" y2="6.5"></line>
            <line x1="0" y1="6.5" x2="3" y2="6.5"></line>
            <line x1="0" y1="13.5" x2="8" y2="13.5"></line>
            <line x1="11" y1="13.5" x2="14" y2="13.5"></line>
            <circle cx="9.5" cy="13.5" r="2"></circle>
          </svg>
          <span className="sr-only">Toggle Filters</span>
        </button>
        <SortDropdown />
      </div>
      <div className="collection-main flex">
        <div aria-labelledby="filters-header" id="filters-panel"
          className={`filters hidden md:block shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out md:sticky md:top-16 ${showFilters ? 'md:w-64' : 'md:w-0'}`}>
          <div className={`md:pt-4 md:px-4 md:pb-6 overflow-y-auto flex flex-col h-full md:w-64 transform transition-transform duration-300 ease-in-out ${showFilters ? 'md:translate-x-0' : 'md:-translate-x-full'}`}>
            <FilterContent
              filteredList={filteredList}
              openFilters={openFilters}
              toggleFilter={toggleFilter}
            />
          </div>
        </div>
        <div className="flex-1 ml-0 md:ml-6 relative">
          <PaginatedResourceSection<ProductItemFragment>
            connection={collection.products}
            resourcesClassName="products-grid"
          >
            {({node: product, index}) => (
              <ProductItem
                key={product.id}
                product={product}
                loading={index < 8 ? 'eager' : undefined}
              />
            )}
          </PaginatedResourceSection>
        </div>
      </div>
      <Analytics.CollectionView
        data={{
          collection: {
            id: collection.id,
            handle: collection.handle,
          },
        }}
      />
      <div className={`filter-modal fixed inset-0 z-50 flex md:hidden ${isMobileFilterOpen ? 'visible' : 'invisible'}`} role="dialog">
        <button
          className={`overlay  close-outside ${isMobileFilterOpen ? 'expanded' : ''}`}
          onClick={() => setIsMobileFilterOpen(false)}
        ></button>

        <div className={`cart-aside absolute top-0 right-0 z-20 max-w-lg w-screen h-screen overflow-y-auto overscroll-contain transform transition-transform duration-300 bg-white ease-in-out ${isMobileFilterOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          
          <div className="flex items-center px-6 pt-3.5 pb-3.5 sm:px-8 md:px-12 justify-between border-b border-solid mb-4 sticky top-0 bg-white z-1">
            <h2 className="text-lg! font-bold mb-0!">Filters</h2>
            <button
              onClick={() => setIsMobileFilterOpen(false)}
              className="pl-1.5 pr-1.5 text-2xl cursor-pointer"
              aria-label="Close Filters"
            >
              &times;
            </button>
          </div>
          <div className="h-full flex flex-col px-4 pt-4 pb-6 overflow-y-auto">
            {isMobileFilterOpen && (
              <FilterContent
                filteredList={filteredList}
                openFilters={openFilters}
                toggleFilter={toggleFilter}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const PRODUCT_ITEM_FRAGMENT = `#graphql
  fragment MoneyProductItem on MoneyV2 {
    amount
    currencyCode
  }
  fragment ProductItem on Product {
    id
    handle
    title
    featuredImage {
      id
      altText
      url
      width
      height
    }
    priceRange {
      minVariantPrice {
        ...MoneyProductItem
      }
      maxVariantPrice {
        ...MoneyProductItem
      }
    }
    options {
      name
      optionValues {
        name
        swatch {
          color
          image {
            previewImage {
              url
            }
          }
        }
        firstSelectableVariant {
          id
          image {
            url
            altText
          }
        }
      }
    }
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/2022-04/objects/collection
const COLLECTION_QUERY = `#graphql
  ${PRODUCT_ITEM_FRAGMENT}
  query Collection(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
    $filters: [ProductFilter!]
    $sortKey: ProductCollectionSortKeys
    $reverse: Boolean
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      products(
        first: $first,
        last: $last,
        before: $startCursor,
        after: $endCursor
        filters: $filters
        sortKey: $sortKey
        reverse: $reverse
      ) {
        nodes {
          ...ProductItem
        }
        filters {
          id
          label
          type
          values {
            id
            label
            count
            input
          }
        }
        pageInfo {
          hasPreviousPage
          hasNextPage
          endCursor
          startCursor
        }
      }
    }
  }
` as const;

export const COLLECTION_BANNER_FRAGMENT = `#graphql
  fragment CollectionBannerFields on Metaobject {
    id
    handle
    type
    fields {
      key
      value
      type
      reference {
        ... on MediaImage {
          id
          image {
            url
            altText
            width
            height
          }
        }
      }
    }
  }
` as const;

export const COLLECTION_BANNER_QUERY = `#graphql
  ${COLLECTION_BANNER_FRAGMENT}
  query CollectionBanner($handle: String!) {
    metaobject(handle: {type: "collectionbanner_poc_gowtham", handle: $handle}) {
      ...CollectionBannerFields
    }
  }
` as const;