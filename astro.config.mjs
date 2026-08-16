// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';

// Pages that exist but are hidden for now: not in the sidebar, not in the
// sitemap, and marked noindex in their own frontmatter. Keep this in step with
// the commented-out sidebar entries below.
const HIDDEN_PAGES = [
	'/datasets/openstreetmap/continents/',
	'/datasets/openstreetmap/countries/',
	'/datasets/openstreetmap/regions/',
];

// https://astro.build/config
export default defineConfig({
	site: 'https://openplanetdata.com',
	integrations: [
		starlight({
			expressiveCode: {
				themes: ['github-dark'],
				styleOverrides: {
					borderRadius: '12px',
				},
			},
			title: 'OpenPlanetData',
			description: 'Open datasets about our planet, built with transparency and precision.',
			logo: {
				light: './src/assets/logo-light.svg',
				dark: './src/assets/logo-dark.svg',
				replacesTitle: false,
			},
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/openplanetdata' },
			],
			editLink: {
				baseUrl: 'https://github.com/openplanetdata/openplanetdata.com/edit/main/',
			},
			customCss: [
				'./src/styles/custom.css',
			],
			components: {
				Head: './src/components/Head.astro',
				PageTitle: './src/components/PageTitle.astro',
				TableOfContents: './src/components/TableOfContents.astro',
				ThemeSelect: './src/components/ThemeSelect.astro',
				SocialIcons: './src/components/SocialIcons.astro',
				EditLink: './src/components/EditLink.astro',
				Footer: './src/components/Footer.astro',
			},
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Introduction', slug: 'getting-started/introduction' },
						{ label: 'Data Formats', slug: 'getting-started/data-formats' },
						{ label: 'Download', slug: 'getting-started/download' },
					],
				},
				{
					label: 'Datasets',
					items: [
						{
							label: 'Boundaries',
							collapsed: false,
							items: [
								{ label: 'Continents', slug: 'datasets/boundaries/continents' },
								{ label: 'Countries', slug: 'datasets/boundaries/countries' },
								{ label: 'Regions', slug: 'datasets/boundaries/regions' },
							],
						},
						{
							label: 'OpenStreetMap',
							collapsed: false,
							items: [
								{ label: 'Planet', slug: 'datasets/openstreetmap/planet' },
								// The continent, country and region extracts are hidden while their
								// datasets are being fixed. The pages still exist; restore the entries
								// below once the data is published again.
								// { label: 'Continents', slug: 'datasets/openstreetmap/continents' },
								// { label: 'Countries', slug: 'datasets/openstreetmap/countries' },
								// { label: 'Regions', slug: 'datasets/openstreetmap/regions' },
							],
						},
						{ label: 'Time Zone', slug: 'datasets/time-zones' },
					],
				},
				{
					label: 'Statistics',
					link: '/statistics/',
				},
			],
			head: [
				// Several scrapers (LinkedIn in particular) will not render a large
				// card unless the dimensions are declared up front, and some never
				// fetch the file to measure it themselves. Keep these in step with
				// scripts/build-og-image.mjs.
				{
					tag: 'meta',
					attrs: {
						property: 'og:image',
						content: 'https://openplanetdata.com/og-image.png',
					},
				},
				{
					tag: 'meta',
					attrs: {
						property: 'og:image:secure_url',
						content: 'https://openplanetdata.com/og-image.png',
					},
				},
				{ tag: 'meta', attrs: { property: 'og:image:type', content: 'image/png' } },
				{ tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
				{ tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
				{
					tag: 'meta',
					attrs: {
						property: 'og:image:alt',
						content: 'OpenPlanetData — open data about planet Earth, in GeoParquet, GeoJSON, GeoPackage and PBF.',
					},
				},
				// X falls back to og:image, but naming it explicitly avoids relying on
				// that, and other tools read only the twitter:* namespace.
				{
					tag: 'meta',
					attrs: {
						name: 'twitter:image',
						content: 'https://openplanetdata.com/og-image.png',
					},
				},
				{
					tag: 'meta',
					attrs: {
						name: 'twitter:image:alt',
						content: 'OpenPlanetData — open data about planet Earth.',
					},
				},
			],
		}),
		// Starlight registers its own sitemap only when none is configured, so
		// declaring it here is what lets the hidden pages be filtered out.
		sitemap({
			filter: (page) => !HIDDEN_PAGES.some((path) => new URL(page).pathname === path),
		}),
	],
});
