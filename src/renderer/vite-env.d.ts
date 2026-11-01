/// <reference types="vite/client" />
import type { JarvisApi } from '../shared/types';
declare global { interface Window { jarvis: JarvisApi; } }
export {};
