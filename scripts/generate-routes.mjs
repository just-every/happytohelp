import {Generator,getConfig} from '@tanstack/router-generator';
const root=new URL('..',import.meta.url).pathname;
await new Generator({root,config:getConfig({target:'react',routesDirectory:'./src/routes',generatedRouteTree:'./src/routeTree.gen.ts',routeFileIgnorePattern:'^api/'},root)}).run();
