// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://docs.openplanetdata.com',
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
				baseUrl: 'https://github.com/openplanetdata/openplanetdata-website/edit/main/',
			},
			customCss: [
				'./src/styles/custom.css',
			],
			components: {
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
					],
				},
				{
					label: 'Datasets',
					items: [
						{
							label: 'Boundaries',
							items: [
								{ label: 'Countries', slug: 'datasets/boundaries/countries' },
								{ label: 'Regions', slug: 'datasets/boundaries/regions' },
								{ label: 'Cities', slug: 'datasets/boundaries/cities' },
								{ label: 'Postals', slug: 'datasets/boundaries/postals' },
							],
						},
						{ label: 'OpenStreetMap', slug: 'datasets/openstreetmap-snapshots' },
						{ label: 'Time Zone', slug: 'datasets/timezone-snapshots' },
					],
				},
				{
					label: 'Data Pipeline',
					items: [
						{ label: 'How We Build Datasets', slug: 'pipeline/how-we-build' },
						{ label: 'Data Sources', slug: 'pipeline/data-sources' },
						{ label: 'Quality Assurance', slug: 'pipeline/quality-assurance' },
					],
				},
				{
					label: 'Reference',
					autogenerate: { directory: 'reference' },
				},
			],
			head: [
				{
					tag: 'meta',
					attrs: {
						property: 'og:image',
						content: 'https://docs.openplanetdata.com/og-image.png',
					},
				},
			],
		}),
	],
});
