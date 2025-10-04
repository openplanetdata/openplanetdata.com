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
import { Check, Copy as CopyIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface FileItem {
    url: string;
    size: number;
    created: number;
    sha256?: string;
    kind: string;
    filename: string;
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
                    "https://download.openplanetdata.com/osm/metadata.json"
                );
                const data = await res.json();

                const items: FileItem[] = [];
                Object.entries(data).forEach(([kind, arr]) => {
                    (arr as any[]).forEach(item => {
                        const filename = (item.url as string).split("/").pop() || "";
                        items.push({ ...(item as any), kind, filename });
                    });
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
                    "https://download.openplanetdata.com/tz/planet/geoparquet/planet-latest.tz.parquet";
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
                    url: baseUrl,
                    size: meta.size,
                    created: meta.created,
                    sha256: sha,
                    kind: "geoparquet",
                    filename: baseUrl.split("/").pop() || "",
                });
            } finally {
                setTzLoading(false);
            }
        })();
    }, []);

    return (
        <div className="flex flex-col min-h-screen">
            <main className="flex-grow max-w-10/12 mx-auto">
                <div className="max-w-7xl mx-auto px-8 pt-12">
                    <Image
                        src="/logo+mark.png"
                        alt="Open Planet Data logo"
                        className="mb-10"
                        width={192}
                        height={192}
                        priority
                    />

                    <p className="mb-3 text-gray-700 mt-10">
                        Open Planet Data is an open and free initiative dedicated to making open
                        data related to our beautiful planet <em>Earth</em> more accessible and
                        efficient to use.
                    </p>

                    <p className="mb-3 text-gray-700">
                        Snapshots are proudly hosted on{" "}
                        <a
                            href="https://developers.cloudflare.com/r2/"
                            target="_blank"
                            rel="noopener"
                            className="underline hover:text-neutral-800"
                        >
                            Cloudflare R2
                        </a>
                        , a storage service optimized for fast ⚡ global access to large datasets.
                    </p>

                    <p className="mb-10 text-gray-700">
                        Questions or feedback?{" "}
                        <a
                            href="mailto:hello@openplanetdata.com"
                            className="underline hover:text-neutral-800"
                        >
                            Contact us
                        </a>
                        .
                    </p>

                    {/* ---------- OSM section ---------- */}
                    <h2 className="text-2xl font-bold mb-6">📍 OpenStreetMap Snapshots</h2>

                    <p className="mb-8 text-gray-700">
                        Daily snapshots in <strong>GEOPARQUET</strong>, <strong>GOL</strong> and <strong>PBF</strong> format. GOL files are PBF variants indexed with{" "}
                        <a
                            href="https://geodesk.com"
                            target="_blank"
                            rel="noopener"
                            className="underline hover:text-neutral-800"
                        >
                            Geodesk
                        </a>{" "}
                        for lightning-fast spatial queries.
                    </p>

                    <Card>
                        <CardContent className="p-4 overflow-x-auto">
                            <Table className="w-full text-sm">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="uppercase font-bold">Filename</TableHead>
                                        <TableHead className="uppercase font-bold">Created</TableHead>
                                        <TableHead className="uppercase font-bold">Size</TableHead>
                                        <TableHead className="uppercase hidden sm:table-cell font-bold">
                                            Sha256
                                        </TableHead>
                                        <TableHead className="text-right uppercase font-bold" />
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
                    <h2 className="text-2xl font-bold my-6 mt-8">🕑 Time Zone Snapshots</h2>

                    <p className="mb-8 text-gray-700">
                        Global time-zone polygons extracted daily from the latest{" "}
                        <a
                            href="https://github.com/evansiroky/timezone-boundary-builder/releases/"
                            target="_blank"
                            rel="noopener"
                            className="underline hover:text-neutral-800"
                        >
                            timezone-boundary-builder
                        </a>{" "}
                        release (<em>timezones-with-oceans.geojson.zip</em>) and converted from
                        GeoJSON to GeoParquet, a compact columnar format that speeds spatial queries.
                    </p>

                    <Card>
                        <CardContent className="p-4 overflow-x-auto">
                            <Table className="w-full text-sm">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="uppercase font-bold">Filename</TableHead>
                                        <TableHead className="uppercase font-bold">Created</TableHead>
                                        <TableHead className="uppercase font-bold">Size</TableHead>
                                        <TableHead className="uppercase hidden sm:table-cell font-bold">
                                            Sha256
                                        </TableHead>
                                        <TableHead className="text-right uppercase font-bold" />
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

            <footer className="w-full max-w-10/12 mx-auto bg-neutral-50 text-sm text-gray-500 text-center">
                <div className="max-w-7xl mx-auto px-8 py-12 space-y-2">
                    <p>
                        OpenStreetMap data © OpenStreetMap contributors, licensed under the{" "}
                        <a
                            href="https://opendatacommons.org/licenses/odbl/1-0/"
                            target="_blank"
                            rel="noopener"
                            className="underline hover:text-neutral-800"
                        >
                            Open Database License (ODbL) 1.0
                        </a>
                        .
                    </p>
                    <p>
                        Generated GOL files are distributed under the same ODbL terms.{" "}
                        <a
                            href="https://github.com/openplanetdata/osm/tree/main/.github/workflows"
                            target="_blank"
                            rel="noopener"
                            className="underline hover:text-neutral-800"
                        >
                            Code for snapshot generation
                        </a>{" "}
                        released under the MIT License.
                    </p>
                    <p>
                        We are not affiliated with OpenStreetMap, Geodesk or Cloudflare. All
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

    const path = file.url.replace("https://download.openplanetdata.com/", "");
    const rcloneCmd = [
        "rclone copy \\",
        "    --http-url https://download.openplanetdata.com \\",
        "    :http:" + path + " . \\",
        "    --multi-thread-cutoff 0 \\",
        "    --multi-thread-streams 64 \\",
        "    --multi-thread-chunk-size 512M \\",
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

    return (
        <>
            <TableRow>
                <TableCell className="font-mono break-all whitespace-pre-wrap">
                    {file.filename}
                </TableCell>
                <TableCell>
                    {format(new Date(file.created * 1000), "yyyy-MM-dd HH:mm")}
                </TableCell>
                <TableCell>{humanFileSize(file.size)}</TableCell>
                <TableCell className="font-mono break-all hidden sm:table-cell">
                    <div className="flex items-center gap-2">
                        <span title={file.sha256}>{truncateHash(file.sha256)}</span>
                        {file.sha256 && file.sha256 !== "N/A" && (
                            <button
                                onClick={copyHash}
                                className="p-1 hover:bg-neutral-200 rounded"
                                title={copied ? "Copied!" : "Copy"}
                            >
                                {copied ? <Check size={14} /> : <CopyIcon size={14} />}
                            </button>
                        )}
                    </div>
                </TableCell>
                <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                        <Button onClick={() => setRcloneOpen(true)} variant="outline" title="Show rclone command">
                            Rclone
                        </Button>
                        <Button asChild>
                            <a href={file.url} target="_blank" rel="noopener">
                                Download
                            </a>
                        </Button>
                    </div>
                </TableCell>
            </TableRow>
            {rcloneOpen && (
                <tr>
                    <td colSpan={5} style={{ padding: 0, border: 0 }}>
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                            <div className="bg-white rounded-lg shadow-lg w-full max-w-xl">
                                <div className="p-6 space-y-4">
                                    <p>Use this rclone command to download multiple chunks in parallel. Tweak the option <code>--multi-thread-streams</code> to suit your bandwidth (128 maxes out an 8 Gbit/s link):</p>
                                    <pre className="bg-neutral-100 rounded p-2 text-xs overflow-x-auto whitespace-pre-wrap">
{rcloneCmd}
                                    </pre>
                                </div>
                                <div className="flex justify-end gap-2 border-t p-4">
                                    <Button onClick={copyRclone}>{rcloneCopied ? "Copied!" : "Copy"}</Button>
                                    <Button variant="outline" onClick={() => setRcloneOpen(false)}>Close</Button>
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}
