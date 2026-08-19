/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly [key: string]: string | undefined;
	readonly NEXT_PUBLIC_FIREBASE_DATABASE_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

declare module '*.jpg' {
	const src: string;
	export default src;
}

declare module '*.jpeg' {
	const src: string;
	export default src;
}

declare module '*.png' {
	const src: string;
	export default src;
}

declare module '*.webp' {
	const src: string;
	export default src;
}

declare module '*.gif' {
	const src: string;
	export default src;
}

declare module '*.svg' {
	const src: string;
	export default src;
}
