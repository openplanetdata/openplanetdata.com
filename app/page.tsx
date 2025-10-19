"use client";

import Image from "next/image";
import React, { useEffect, useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Copy as CopyIcon, Loader2, AlertTriangle, Download as DownloadIcon } from "lucide-react";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

interface FileItem {
    created: number;
    deprecated?: boolean;
    deprecation_reason?: string;
    filename: string;
    kind: string;
    size: number;
    sha256?: string;
    url: string;
    version?: string;
}

interface PlanetMetadata {
    created: number;
    deprecated: boolean;
    deprecation_reason: string;
    format: string;
    remote_filename: string;
    remote_path: string;
    remote_version: string;
    size: string | number;
    tags: string[];
}

const humanFileSize = (bytes: number) => {
    const thresh = 1024;
    if (Math.abs(bytes) < thresh) return `${bytes} B`;
    const units = ["KiB", "MiB", "GiB", "TiB", "PiB", "EiB"];
    let u = -1;
    do {
        bytes /= thresh;
        ++u;
    } while (Math.abs(bytes) >= thresh && u < units.length - 1);
    return `${bytes.toFixed(1)} ${units[u]}`;
};

const truncateHash = (hash?: string) =>
    hash && hash.length > 16 ? `${hash.slice(0, 8)}…${hash.slice(-8)}` : hash;

export default function Page() {
    const [files, setFiles] = useState<FileItem[]>([]);
    const [osmLoading, setOsmLoading] = useState(true);
    const [tzFile, setTzFile] = useState<FileItem | null>(null);
    const [tzLoading, setTzLoading] = useState(true);

    /* ---------- OpenStreetMap snapshots ---------- */
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(
                    "https://download.openplanetdata.com/osm/planet.metadata"
                );
                const data: PlanetMetadata[] = await res.json();

                const items: FileItem[] = data.map(item => {
                    const url = `https://download.openplanetdata.com/${item.remote_path}/v${item.remote_version}/${item.remote_filename}`;
                    const filename = item.remote_filename;
                    // Map format to kind (uppercase for consistency)
                    const kind = item.format.toUpperCase();
                    // Parse size as number if it's a string
                    const size = typeof item.size === 'string' ? parseInt(item.size, 10) : item.size;

                    return {
                        url,
                        size,
                        created: item.created,
                        kind,
                        filename,
                        deprecated: item.deprecated,
                        deprecation_reason: item.deprecation_reason,
                        version: item.remote_version,
                    };
                });

                const withHash = await Promise.all(
                    items.map(async item => {
                        try {
                            const text = await fetch(`${item.url}.sha256`).then(r => r.text());
                            return { ...item, sha256: text.split(" ")[0].trim() };
                        } catch {
                            return { ...item, sha256: "N/A" };
                        }
                    })
                );

                // Sort by file extension
                const sorted = withHash.sort((a, b) => {
                    const extA = a.filename.split('.').pop() || '';
                    const extB = b.filename.split('.').pop() || '';
                    return extA.localeCompare(extB);
                });

                setFiles(sorted);
            } finally {
                setOsmLoading(false);
            }
        })();
    }, []);

    /* ---------- Time-zone snapshots ---------- */
    useEffect(() => {
        (async () => {
            try {
                const baseUrl =
                    "https://download.openplanetdata.com/tz/planet/geoparquet/v1/planet-latest.tz.parquet";
                const meta = await fetch(`${baseUrl}.metadata`).then(r => r.json());

                let sha = "N/A";
                try {
                    sha = (
                        await fetch(`${baseUrl}.sha256`).then(r => r.text())
                    )
                        .split(" ")[0]
                        .trim();
                } catch {
                    sha = "N/A";
                }

                setTzFile({
                    created: meta.created,
                    filename: baseUrl.split("/").pop() || "",
                    kind: "PARQUET",
                    size: meta.size,
                    sha256: sha,
                    url: baseUrl,
                });
            } finally {
                setTzLoading(false);
            }
        })();
    }, []);

    return (
        <div className="flex flex-col min-h-screen">
            <main className="flex-grow max-w-screen mx-auto">
                <div className="max-w-7xl mx-auto px-8 pt-12">
                    <Image
                        src="/logo+mark.png"
                        alt="Open Planet Data logo"
                        className="mb-10"
                        width={192}
                        height={192}
                        priority
                    />

                    <div className="mb-12 mt-10 space-y-2">
                        <p className="text-gray-700 leading-relaxed">
                            Open Planet Data is an open and free initiative dedicated to making open
                            data related to our beautiful planet <em className="font-medium">Earth</em> more accessible and
                            efficient to use.
                        </p>

                        <p className="text-gray-700 leading-relaxed">
                            Snapshots are proudly hosted on{" "}
                            <a
                                href="https://developers.cloudflare.com/r2/"
                                target="_blank"
                                rel="noopener"
                                className="text-blue-700 hover:text-blue-800 underline font-medium"
                            >
                                Cloudflare R2
                            </a>
                            , a storage service optimized for fast <span className="text-yellow-500">⚡</span> global access to large datasets.
                        </p>

                        <p className="text-gray-600">
                            Questions or feedback?{" "}
                            <a
                                href="mailto:hello@openplanetdata.com"
                                className="text-blue-700 hover:text-blue-800 underline font-medium"
                            >
                                Contact us
                            </a>
                            .
                        </p>
                    </div>

                    {/* ---------- OSM section ---------- */}
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold mb-6 text-gray-900 flex items-center gap-3">
                            <span className="text-3xl">📍</span>
                            OpenStreetMap Snapshots
                        </h2>
                        <p className="text-gray-600 leading-relaxed">
                            Daily OpenStreetMap snapshots in different formats. GOB and GOL files are PBF variants indexed with{" "}
                            <a
                                href="https://geodesk.com"
                                target="_blank"
                                rel="noopener"
                                className="text-blue-700 hover:text-blue-800 underline font-medium"
                            >
                                GeoDesk
                            </a>{" "}
                            for lightning-fast spatial queries.
                        </p>
                    </div>

                    <Card className="border-2 shadow-sm py-0 rounded-lg">
                        <CardContent className="p-0 overflow-x-auto">
                            <Table className="w-full">
                                <TableHeader>
                                    <TableRow className="border-b-2">
                                        <TableHead className="uppercase text-sm font-bold text-gray-700 py-4 px-4">File</TableHead>
                                        <TableHead className="uppercase text-sm font-bold text-gray-700 py-4 px-4">Created</TableHead>
                                        <TableHead className="uppercase text-sm font-bold text-gray-700 py-4 px-4">Size</TableHead>
                                        <TableHead className="uppercase text-sm font-bold text-gray-700 py-4 px-4 hidden lg:table-cell">
                                            Checksum
                                        </TableHead>
                                        <TableHead className="text-right uppercase text-xs font-bold text-gray-700 py-4 px-4" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {osmLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={5}>
                                                <div className="flex items-center justify-center py-8">
                                                    <Loader2 className="animate-spin mr-2" /> Loading…
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        files.map(f => <HashRow key={f.url} file={f} />)
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* ---------- Time-zone section ---------- */}
                    <div className="mb-8 mt-12">
                        <h2 className="text-2xl font-bold mb-6 text-gray-900 flex items-center gap-3">
                            <span className="text-3xl">🕑</span>
                            Time Zone Snapshots
                        </h2>
                        <p className="text-gray-600 leading-relaxed">
                            Global time-zone polygons extracted daily from the latest{" "}
                            <a
                                href="https://github.com/evansiroky/timezone-boundary-builder/releases/"
                                target="_blank"
                                rel="noopener"
                                className="text-blue-700 hover:text-blue-800 underline font-medium"
                            >
                                timezone-boundary-builder
                            </a>{" "}
                            release (<em className="text-gray-700">timezones-with-oceans.geojson.zip</em>) and converted from
                            GeoJSON to GeoParquet, a compact columnar format that speeds spatial queries.
                        </p>
                    </div>

                    <Card className="border-2 shadow-sm py-0 rounded-lg">
                        <CardContent className="p-0 overflow-x-auto">
                            <Table className="w-full">
                                <TableHeader>
                                    <TableRow className="border-b-2">
                                        <TableHead className="uppercase text-sm font-bold text-gray-700 py-4 px-4">File</TableHead>
                                        <TableHead className="uppercase text-sm font-bold text-gray-700 py-4 px-4">Created</TableHead>
                                        <TableHead className="uppercase text-sm font-bold text-gray-700 py-4 px-4">Size</TableHead>
                                        <TableHead className="uppercase text-sm font-bold text-gray-700 py-4 px-4 hidden lg:table-cell">
                                            Checksum
                                        </TableHead>
                                        <TableHead className="text-right uppercase text-xs font-bold text-gray-700 py-4 px-4" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {tzLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={5}>
                                                <div className="flex items-center justify-center py-8">
                                                    <Loader2 className="animate-spin mr-2" /> Loading…
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : tzFile ? (
                                        <HashRow file={tzFile} />
                                    ) : null}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </main>

            <footer className="w-full mx-auto bg-gradient-to-b from-white to-gray-50 border-t border-gray-200 mt-16">
                <div className="max-w-7xl mx-auto px-8 py-12 space-y-3 text-center">
                    <p className="text-sm text-gray-600">
                        OpenStreetMap data © OpenStreetMap contributors, licensed under the{" "}
                        <a
                            href="https://opendatacommons.org/licenses/odbl/1-0/"
                            target="_blank"
                            rel="noopener"
                            className="text-blue-700 hover:text-blue-800 underline font-medium"
                        >
                            Open Database License (ODbL) 1.0
                        </a>
                        .
                    </p>
                    <p className="text-sm text-gray-600">
                        Generated GOL files are distributed under the same ODbL terms.{" "}
                        <a
                            href="https://github.com/openplanetdata/osm/tree/main/.github/workflows"
                            target="_blank"
                            rel="noopener"
                            className="text-blue-700 hover:text-blue-800 underline font-medium"
                        >
                            Code for snapshot generation
                        </a>{" "}
                        released under the MIT License.
                    </p>
                    <p className="text-xs text-gray-500 pt-2">
                        We are not affiliated with OpenStreetMap, GeoDesk or Cloudflare. All
                        trademarks are the property of their respective owners.
                    </p>
                </div>
            </footer>
        </div>
    );
}

/* ---------- Table row ---------- */
function HashRow({ file }: { file: FileItem }) {
    const [copied, setCopied] = useState(false);
    const [rcloneOpen, setRcloneOpen] = useState(false);
    const [rcloneCopied, setRcloneCopied] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const path = file.url.replace("https://download.openplanetdata.com/", "");
    const rcloneCmd = [
        "rclone copy \\",
        "    --http-url https://download.openplanetdata.com \\",
        "    :http:" + path + " . \\",
        "    --multi-thread-cutoff 0 \\",
        "    --multi-thread-streams 768 \\",
        "    --multi-thread-chunk-size 120M \\",
        "    --transfers 1 --progress",
    ].join("\n");

    const copyHash = async () => {
        if (!file.sha256 || file.sha256 === "N/A") return;
        await navigator.clipboard.writeText(file.sha256);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const copyRclone = async () => {
        await navigator.clipboard.writeText(rcloneCmd);
        setRcloneCopied(true);
        setTimeout(() => setRcloneCopied(false), 1500);
    };

    const formatBadgeColor = (kind: string) => {
        switch (kind) {
            case "GOB":
            case "GOL":
                return "bg-blue-100 text-blue-700 border-blue-200";
            case "PARQUET":
                return "bg-purple-100 text-purple-700 border-purple-200";
            case "PBF":
                return "bg-green-100 text-green-700 border-green-200";
            default:
                return "bg-gray-100 text-gray-700 border-gray-200";
        }
    };

    return (
        <>
            <TableRow
                className={`transition-colors ${isHovered ? "bg-gray-50" : ""} ${file.deprecated ? "bg-amber-50/50" : ""} ${file.deprecated && file.deprecation_reason ? "!border-b-0" : ""}`}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <TableCell className={`py-5 px-4 ${file.deprecated && file.deprecation_reason ? "border-b-0" : ""}`}>
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold border ${formatBadgeColor(file.kind)}`}>
                                {file.kind}
                            </span>
                            {(file.kind === "GOB" || file.kind === "GOL") && file.version && (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                                    v{file.version}
                                </span>
                            )}
                        </div>
                        <div className="font-mono text-sm text-gray-900 break-all">
                            {file.filename}
                        </div>
                        {(file.kind === "GOB" || file.kind === "GOL") && file.version && (
                            <div className="text-sm text-gray-500">
                                for use with GeoDesk v{file.version}
                            </div>
                        )}
                    </div>
                </TableCell>
                <TableCell className={`py-5 px-4 text-sm text-gray-700 whitespace-nowrap ${file.deprecated && file.deprecation_reason ? "border-b-0" : ""}`}>
                    <div className="font-medium">{formatInTimeZone(new Date(file.created * 1000), "UTC", "MMM d, yyyy")}</div>
                    <div className="font-medium text-gray-500 mt-0.5">{formatInTimeZone(new Date(file.created * 1000), "UTC", "HH:mm")} UTC</div>
                </TableCell>
                <TableCell className={`py-5 px-4 text-sm font-semibold text-gray-900 whitespace-nowrap ${file.deprecated && file.deprecation_reason ? "border-b-0" : ""}`}>
                    {humanFileSize(file.size)}
                </TableCell>
                <TableCell className={`py-5 px-4 hidden lg:table-cell ${file.deprecated && file.deprecation_reason ? "border-b-0" : ""}`}>
                    <div className="flex items-center gap-2">
                        <code className="text-sm bg-gray-100 px-2.5 py-1.5 rounded border border-gray-200 font-mono" title={file.sha256}>
                            {truncateHash(file.sha256)}
                        </code>
                        {file.sha256 && file.sha256 !== "N/A" && (
                            <button
                                onClick={copyHash}
                                className="p-2 hover:bg-gray-200 rounded-md transition-colors cursor-pointer"
                                title={copied ? "Copied!" : "Copy full hash"}
                            >
                                {copied ? <Check size={16} className="text-green-600" /> : <CopyIcon size={16} className="text-gray-500" />}
                            </button>
                        )}
                    </div>
                </TableCell>
                <TableCell className={`py-5 px-4 text-right ${file.deprecated && file.deprecation_reason ? "border-b-0" : ""}`}>
                    <div className="flex gap-2 justify-end flex-wrap">
                        <Button onClick={() => setRcloneOpen(true)} variant="outline" size="sm" className="uppercase px-4 py-2 cursor-pointer text-xs">
                            Rclone
                        </Button>
                        <Button asChild size="sm" className="uppercase px-4 py-2 cursor-pointer text-xs">
                            <a href={file.url} target="_blank" rel="noopener" className="flex items-center gap-1.5">
                                <DownloadIcon size={16} />
                                Download
                            </a>
                        </Button>
                    </div>
                </TableCell>
            </TableRow>
            {file.deprecated && file.deprecation_reason && (
                <TableRow
                    className={`transition-colors ${isHovered ? "bg-gray-50" : ""} bg-amber-50/50 !border-t-0`}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    <TableCell colSpan={5} className="py-3 px-4">
                        <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 p-3 rounded-lg">
                            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                            <span><strong className="font-semibold">Deprecated:</strong> {file.deprecation_reason}</span>
                        </div>
                    </TableCell>
                </TableRow>
            )}
            {rcloneOpen && (
                <tr>
                    <td colSpan={5} style={{ padding: 0, border: 0 }}>
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl border border-gray-200">
                                <div className="p-6 space-y-4">
                                    <h3 className="text-lg font-semibold text-gray-900">Download with Rclone</h3>
                                    <p className="text-sm text-gray-600">
                                        Use this Rclone command to download multiple chunks in parallel.
                                        Adjust <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">--multi-thread-streams</code> to match your bandwidth (128 maxes out an 8 Gbit/s link).
                                    </p>
                                    <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto border border-gray-700">
{rcloneCmd}
                                    </pre>
                                </div>
                                <div className="flex justify-end gap-2 border-t border-gray-200 p-4 bg-gray-50 rounded-b-xl">
                                    <Button variant="outline" onClick={() => setRcloneOpen(false)} className="cursor-pointer">Close</Button>
                                    <Button onClick={copyRclone} className="flex items-center gap-1.5 cursor-pointer">
                                        {rcloneCopied ? (
                                            <>
                                                <Check size={14} />
                                                Copied!
                                            </>
                                        ) : (
                                            <>
                                                <CopyIcon size={14} />
                                                Copy Command
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}
