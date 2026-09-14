import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
export default defineConfig({plugins:[preact()],server:{proxy:{'/api':'http://127.0.0.1:19000','/health':'http://127.0.0.1:19000'}},build:{sourcemap:true}});
