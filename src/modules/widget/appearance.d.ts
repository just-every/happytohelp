export type PublicAppearance = {name:string;color:string;logo_url:string;avatar_url:string;brand_image_url:string;greeting:string};
export function publicAppearance(settings?:Record<string,unknown>,projectName?:string):PublicAppearance;
export function contrastInk(color:string):string;
export function readableAccentOnWhite(color:string):string;
export function widgetAppearance(brand?:Partial<PublicAppearance>,settings?:Record<string,any>):Record<string,any>;
