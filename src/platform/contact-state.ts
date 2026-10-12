/** Rechecked by native writes: a request admitted before erasure cannot put
 * identity or stale metadata back after the erasure fence. */
export const contactWritable="coalesce(json_extract(metadata_json,'$.is_erasing'),0)!=1 AND coalesce(json_extract(metadata_json,'$.is_erased'),0)!=1"
