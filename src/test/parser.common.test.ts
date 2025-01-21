import type { MapWithNode } from "../model/yaml";

export function cursorOverMap<T>(map: MapWithNode<T> | undefined) {
    let index = -1;
    const entries = Object.entries(map?.entries ?? {});
    return {
        next() { return entries[++index][1]; },
        get current() { return entries[index][1]; },
        get currentKey() { return entries[index][0]; }
    };
}
