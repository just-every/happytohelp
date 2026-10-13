import { useLocation } from '@tanstack/react-router';

// The router's own location, which already names the page a click chose while that page's loader is still running.
// The dashboard's loaded location (useDashboardLocation) trails it until the loader finishes, so anything that links
// to or navigates from "here" reads this instead. `q` is always a string here: the raw search parses "123" as a number.
export default function useLiveInboxLocation() {
    const pathname = useLocation({ select: location => location.pathname });
    const search = useLocation({ select: location => location.search });
    return { pathname, search: search.q == null ? search : { ...search, q: String(search.q) } };
}
