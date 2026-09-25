import { useEffect, useRef, useState } from 'react';
import useWindowSize from './useWindowSize';
import useInterval from './useInterval';

const WINDOW = 'window';
const PARENT = 'parent';

export const INFINITE_SCROLL_DIRECTIONS = {
  toBottom: 'to-bottom',
  toTop: 'to-top',
};

function useInfiniteScroll({
  loading,
  hasNextPage,
  onLoadMore,
  threshold = 150,
  checkInterval = 200,
  scrollContainer = WINDOW,
  direction = INFINITE_SCROLL_DIRECTIONS.toBottom,
}) {
  const ref = useRef(null);
  const { height: windowHeight, width: windowWidth } = useWindowSize();

  // Normally we could use the "loading" prop, but when you set "checkInterval" to a very small
  // number (like 10 etc.), some request components can't set its loading state
  // immediately (I had this problem with react-apollo's Query component. In some cases, it runs
  // "updateQuery" twice). Thus we set our own "listen" state which immeadiately turns to "false" on
  // calling "onLoadMore".
  const [listen, setListen] = useState(true);

  useEffect(() => {
    if (!loading) {
      setListen(true);
      if (direction === INFINITE_SCROLL_DIRECTIONS.toTop) {
        if (scrollContainer === WINDOW) {
          if (!window.scrollY) {
            // This doesn't work like the solution below.
            window.scrollTo({ top: 1 });
          }
        } else {
          // This is some hacky solution to handling scroll position
          // when "scrollTop" is "0".
          if (ref.current && ref.current.parentNode) {
            const parentNode = ref.current.parentNode;
            if (!parentNode.scrollTop) {
              ref.current.parentNode.scrollTop = 1;
            }
          }
        }
      }
    }
  }, [direction, loading, scrollContainer]);

  function getParentRect() {
    const parentNode = ref.current.parentNode;
    const parentRect = parentNode.getBoundingClientRect();
    return parentRect;
  }

  function getBoundingClientRect() {
    const rect = ref.current.getBoundingClientRect();
    return rect;
  }

  function getBottomOffset() {
    const rect = getBoundingClientRect();

    const bottom = rect.bottom;
    let bottomOffset = bottom - windowHeight;

    if (scrollContainer === PARENT) {
      const { bottom: parentBottom } = getParentRect();
      // Distance between bottom of list and its parent
      bottomOffset = bottom - parentBottom;
    }

    return bottomOffset;
  }

  function getTopOffset() {
    const rect = getBoundingClientRect();

    const top = rect.top;
    let topOffset = 0 - top;

    if (scrollContainer === PARENT) {
      const { top: parentTop } = getParentRect();
      // Distance between top of list and its parent
      topOffset = parentTop - top;
    }

    return topOffset;
  }

  function isParentInView() {
    const parent = ref.current ? ref.current.parentNode : null;

    if (parent) {
      const { left, right, top, bottom } = getParentRect();
      if (left > windowWidth) {
        return false;
      } else if (right < 0) {
        return false;
      } else if (top > windowHeight) {
        return false;
      } else if (bottom < 0) {
        return false;
      }
    }

    return true;
  }

  function listenOffset() {
    if (listen && !loading && hasNextPage) {
      if (ref.current) {
        if (scrollContainer === PARENT) {
          if (!isParentInView()) {
            // Do nothing if the parent is out of screen
            return;
          }
        }

        let validOffset = false;

        switch (direction) {
          case INFINITE_SCROLL_DIRECTIONS.toTop:
            const topOffset = getTopOffset();
            validOffset = topOffset < threshold;
            break;
          default:
            // Check if the distance between bottom of the container and bottom of the window or parent
            // is less than "threshold"
            const bottomOffset = getBottomOffset();
            validOffset = bottomOffset < threshold;
        }

        if (validOffset) {
          setListen(false);
          onLoadMore();
        }
      }
    }
  }

  useInterval(
    () => {
      listenOffset();
    },
    // Stop interval when there is no next page.
    hasNextPage ? checkInterval : 0,
  );

  return ref;
}

export default useInfiniteScroll;
