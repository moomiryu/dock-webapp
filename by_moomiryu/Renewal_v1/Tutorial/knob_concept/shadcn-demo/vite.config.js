import {defineConfig} from 'vite';
import tailwindcss from '@tailwindcss/vite';
import {fileURLToPath} from 'node:url';
export default defineConfig({plugins:[tailwindcss()],publicDir:fileURLToPath(new URL('../../../../../public',import.meta.url)),resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},server:{fs:{allow:[fileURLToPath(new URL('../../../../../',import.meta.url))]}}});
