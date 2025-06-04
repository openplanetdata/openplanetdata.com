"use client";

import Image from "next/image";
import React, { useEffect, useState } from "react";
import {
    Table,
    TableHeader,
    TableRow,
    TableHead,
    TableBody,
    TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Copy as CopyIcon, Check } from "lucide-react";
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
    if (Math.abs(bytes) < thresh) return bytes + " B";
    const units = ["KiB", "MiB", "GiB", "TiB", "PiB", "EiB"];
    let u = -1;
    do {
        bytes /= thresh;
        ++u;
    } while (Math.abs(bytes) >= thresh && u < units.length - 1);
    return bytes.toFixed(1) + " " + units[u];
};

const truncateHash = (hash?: string) =>
    hash && hash.length > 16 ? `${hash.slice(0, 8)}…${hash.slice(-8)}` : hash;

export default function Page() {
    const [files, setFiles] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(
                    "https://download.openplanetdata.com/osm/metadata.json"
                );
                const data = await res.json();
                const items: FileItem[] = [];
                Object.entries(data).forEach(([kind, arr]) => {
                    (arr as any[]).forEach((item) => {
                        const filename = (item.url as string).split("/").pop() || "";
                        items.push({ ...(item as any), kind, filename });
                    });
                });
                const withHash = await Promise.all(
                    items.map(async (item) => {
                        try {
                            const text = await fetch(item.url + ".sha256").then((r) =>
                                r.text()
                            );
                            return { ...item, sha256: text.split(" ")[0].trim() };
                        } catch {
                            return { ...item, sha256: "N/A" };
                        }
                    })
                );
                setFiles(withHash);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    return (
        <div className="flex flex-col min-h-screen">
            <main className="flex-grow w-full">
                <div className="max-w-7xl mx-auto px-8 md:px-8 pt-12">
                    <Image
                        src="/logo+mark.png"
                        alt="Open Planet Data logo"
                        className="mb-10"
                        width={192}
                        height={192}
                        priority
                    />

                    <p className="mb-4 text-gray-700">
                        Open Planet Data is an open initiative dedicated to making open data
                        related to our beautiful planet Earth more accessible and efficient
                        to use.
                    </p>
                    <p className="mb-4 text-gray-700">
                        Our first project offers daily snapshots of OpenStreetMap in{" "}
                        <strong>PBF</strong> and <strong>GOL</strong> formats.
                    </p>
                    <p className="mb-4 text-gray-700">
                        Snapshots are proudly hosted on{" "}
                        <a
                            href="https://developers.cloudflare.com/r2/"
                            target="_blank"
                            rel="noopener"
                            className="underline hover:text-neutral-800"
                        >
                            Cloudflare R2
                        </a>
                        , a storage service optimized for fast, global scalable access to
                        large datasets. Files in GOL format are indexed variants of PBF
                        versions using{" "}
                        <a
                            href="https://geodesk.com"
                            target="_blank"
                            rel="noopener"
                            className="underline hover:text-neutral-800"
                        >
                            Geodesk
                        </a>{" "}
                        to enable lightning-fast spatial queries.
                    </p>
                    <p className="mb-8">
                        Questions or feedback? <a href="mailto:hello@openplanetdata.com" className="underline hover:text-neutral-800">Contact us</a>.
                    </p>
                    <h2 className="text-2xl font-bold mb-6">OpenStreetMap Snapshots</h2>

                    <Card>
                        <CardContent className="p-4 overflow-x-auto">
                            <Table className="w-full text-sm">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="uppercase font-bold">Filename</TableHead>
                                        <TableHead className="uppercase font-bold">Format</TableHead>
                                        <TableHead className="uppercase font-bold">Created</TableHead>
                                        <TableHead className="uppercase font-bold">Size</TableHead>
                                        <TableHead className="uppercase hidden sm:table-cell font-bold">
                                            Sha256
                                        </TableHead>
                                        <TableHead className="text-right uppercase font-bold"></TableHead>
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={6}>
                                                <div className="flex items-center justify-center py-8">
                                                    <Loader2 className="animate-spin mr-2" /> Loading…
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        files.map((f) => <HashRow key={f.url} file={f} />)
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </main>

            <footer className="w-full bg-neutral-50 text-sm text-gray-500">
                <div className="max-w-7xl mx-auto px-8 md:px-8 py-12 space-y-2">
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
                            Code for snapshots generation
                        </a>{" "}
                        released under the MIT License.
                    </p>
                    <p>
                        We are not affiliated with OpenStreetMap, Geodesk, or Cloudflare.
                        All trademarks are the property of their respective owners.
                    </p>
                </div>
            </footer>
        </div>
    );
}

function HashRow({ file }: { file: FileItem }) {
    const [copied, setCopied] = useState(false);

    const copyHash = async () => {
        if (!file.sha256 || file.sha256 === "N/A") return;
        await navigator.clipboard.writeText(file.sha256);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <TableRow>
            <TableCell className="font-mono break-all whitespace-pre-wrap">
                {file.filename}
            </TableCell>
            <TableCell>{file.kind.toUpperCase()}</TableCell>
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
                <Button asChild>
                    <a href={file.url} target="_blank" rel="noopener">
                        Download
                    </a>
                </Button>
            </TableCell>
        </TableRow>
    );
}
