import { encode } from 'uqr';

/** The authenticator setup address as a QR code an authenticator app scans; drawn as SVG cells, no network. */
export default function QrCode({ value, label }: { value: string; label: string }) {
    const { data, size } = encode(value, { ecc: 'M', border: 4 }), cells: string[] = [];
    data.forEach((row, y) => row.forEach((dark, x) => { if (dark) cells.push(`M${x} ${y}h1v1h-1z`); }));
    return <svg className="tf-qr" role="img" aria-label={label} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges">
        <rect width={size} height={size} fill="#fff" />
        <path d={cells.join('')} fill="#000" />
    </svg>;
}
