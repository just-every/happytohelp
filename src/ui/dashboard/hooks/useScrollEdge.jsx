import { useCallback, useEffect, useRef, useState } from 'react';

// Tracks content hidden beyond either edge of a scrollable section.
export default function useScrollEdge(enabled = true) {
    const elementRef = useRef(null);
    const cleanupRef = useRef(() => {});
    const [ edges, setEdges ] = useState({ isScrolled: false, hasHiddenBelow: false });

    const measure = useCallback(() => {
        const element = elementRef.current;
        const isScrollable = Boolean(enabled && element && element.scrollHeight > element.clientHeight + 1);
        const isScrolled = Boolean(isScrollable && element.scrollTop > 1);
        const hasHiddenBelow = Boolean(isScrollable && element.scrollHeight - element.clientHeight - element.scrollTop > 1);
        setEdges(previous => previous.isScrolled === isScrolled && previous.hasHiddenBelow === hasHiddenBelow
            ? previous
            : { isScrolled, hasHiddenBelow });
    }, [ enabled ]);

    const ref = useCallback(element => {
        cleanupRef.current();
        elementRef.current = element;

        if (!element) {
            cleanupRef.current = () => {};
            return;
        }

        const onScroll = () => measure();
        const resizeObserver = typeof ResizeObserver === 'undefined'
            ? null
            : new ResizeObserver(onScroll);
        const mutationObserver = typeof MutationObserver === 'undefined'
            ? null
            : new MutationObserver(onScroll);

        element.addEventListener('scroll', onScroll, { passive: true });
        resizeObserver?.observe(element);
        mutationObserver?.observe(element, { childList: true, subtree: true, characterData: true });
        const frame = requestAnimationFrame(onScroll);

        cleanupRef.current = () => {
            cancelAnimationFrame(frame);
            element.removeEventListener('scroll', onScroll);
            resizeObserver?.disconnect();
            mutationObserver?.disconnect();
        };
    }, [ measure ]);

    useEffect(() => {
        measure();
    }, [ measure ]);

    useEffect(() => () => cleanupRef.current(), []);

    return { ref, ...edges };
}
