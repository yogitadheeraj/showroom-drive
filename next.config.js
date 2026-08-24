/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	typescript: {
		tsconfigPath: './tsconfig.next.json',
	},
	eslint: {
		ignoreDuringBuilds: true,
	},
	async redirects() {
		return [
			{
				source: '/privacy-policy.html',
				destination: '/privacy-policy',
				permanent: true,
			},
			{
				source: '/terms-and-conditions.html',
				destination: '/terms-and-conditions',
				permanent: true,
			},
			{
				source: '/sitemap.html',
				destination: '/sitemap',
				permanent: true,
			},
			{
				source: '/unsubscribe/',
				destination: '/auth',
				permanent: true,
			},
		];
	},
};

export default nextConfig;
