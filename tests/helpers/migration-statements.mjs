// Keep trigger bodies intact in partial-schema tests that apply additive migrations.
export function migrationStatements(source){return [...source.replace(/^\s*--[^\n]*$/gm,'').matchAll(/\s*(CREATE TRIGGER[\s\S]*?END;|[^;]+;)/g)].map(match=>match[1])}
