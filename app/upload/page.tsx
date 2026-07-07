"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
  X,
  FileText,
  Trash2,
  ImageIcon,
  FileArchiveIcon,
  FileCodeIcon,
  FileSpreadsheetIcon,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Brain,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import { toast } from "sonner";

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "application/json",
  "application/zip",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
] as const;

const ACCEPT_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": ".jpeg,.jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "text/plain": ".txt",
  "text/csv": ".csv",
  "application/json": ".json",
  "application/zip": ".zip",
  "application/x-rar-compressed": ".rar",
  "application/x-7z-compressed": ".7z",
};

const MAX_SIZE = 10 * 1024 * 1024;

type Item = {
  id: string;
  name: string;
  size: number;
  type: string;
  preview?: string;
  progress: number;
  state: "uploading" | "done" | "error";
  error?: string;
};

type SavedAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  createdAt: string;
  parseStatus?: string | null;
  parsedText?: string | null;
  parsedMarkdown?: string | null;
  parseError?: string | null;
  chunks?: string[] | null;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function typeLabel(mime: string) {
  if (mime.startsWith("image/")) return "图片";
  if (mime === "application/pdf") return "PDF";
  if (mime.includes("word")) return "Word";
  if (mime.includes("excel") || mime.includes("spreadsheet")) return "Excel";
  if (mime === "text/plain") return "文本";
  if (mime === "text/csv") return "CSV";
  if (mime === "application/json") return "JSON";
  if (mime.includes("zip") || mime.includes("rar") || mime.includes("7z"))
    return "压缩包";
  return "文件";
}

function fileIcon(mime: string) {
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime.includes("zip") || mime.includes("rar") || mime.includes("7z"))
    return FileArchiveIcon;
  if (mime.includes("javascript") || mime.includes("json") || mime.includes("html"))
    return FileCodeIcon;
  if (mime.includes("excel") || mime.includes("spreadsheet") || mime === "text/csv")
    return FileSpreadsheetIcon;
  return FileText;
}

function uploadFile(
  file: File,
  onProgress: (pct: number) => void
): Promise<SavedAttachment> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/attachments");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText) as SavedAttachment);
      } else {
        const msg =
          xhr.status === 413
            ? "文件超过 10 MB 限制"
            : `上传失败 (${xhr.status})`;
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("网络错误,请检查连接"));
    xhr.send(form);
  });
}

export default function UploadPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [saved, setSaved] = useState<SavedAttachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [parsingIds, setParsingIds] = useState<Set<string>>(new Set());
  const [expandedText, setExpandedText] = useState<Set<string>>(new Set());

  const fetchList = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/attachments");
      if (!res.ok) throw new Error("加载失败");
      setSaved(await res.json());
    } catch {
      setLoadError("无法获取已上传的文件列表");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const addFiles = (files: FileList | null) => {
    if (!files) return;

    const rejected: { name: string; reason: string }[] = [];

    Array.from(files).forEach((file) => {
      if (file.size > MAX_SIZE) {
        rejected.push({
          name: file.name,
          reason: `超过 10 MB 限制 (${formatSize(file.size)})`,
        });
        return;
      }

      const isAccepted = ACCEPTED_TYPES.some((t) => {
        if (t === file.type) return true;
        if (t.endsWith("/*")) {
          return file.type.startsWith(t.replace("/*", "/"));
        }
        return false;
      });

      if (!isAccepted) {
        rejected.push({
          name: file.name,
          reason: `不支持的文件类型 (${file.type || "未知"})`,
        });
        return;
      }

      const id = `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`;
      const item: Item = {
        id,
        name: file.name,
        size: file.size,
        type: file.type,
        preview: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : undefined,
        progress: 0,
        state: "uploading",
      };
      setItems((prev) => [...prev, item]);

      uploadFile(file, (pct) => {
        setItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, progress: pct } : it))
        );
      })
        .then(() => {
          setItems((prev) =>
            prev.map((it) =>
              it.id === id ? { ...it, state: "done", progress: 100 } : it
            )
          );
          toast.success(`${file.name} 上传成功`);
          fetchList();
        })
        .catch((err: Error) => {
          setItems((prev) =>
            prev.map((it) =>
              it.id === id
                ? { ...it, state: "error", error: err.message }
                : it
            )
          );
          toast.error(`${file.name}: ${err.message}`);
        });
    });

    if (rejected.length > 0) {
      const msg =
        rejected.length === 1
          ? `${rejected[0].name}: ${rejected[0].reason}`
          : `${rejected.length} 个文件不符合要求`;
      toast.warning(msg);
    }
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const parsePdf = async (id: string) => {
    setParsingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/attachments/${id}`, { method: "POST" });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        setSaved((prev) =>
          prev.map((it) =>
            it.id === id
              ? { ...it, parseStatus: "failed", parseError: errData.error ?? `HTTP ${res.status}` }
              : it
          )
        );
        toast.error(errData.error ?? "解析失败");
        return;
      }
      const data = await res.json();
      setSaved((prev) =>
        prev.map((it) => (it.id === id ? { ...it, ...data } : it))
      );
      toast.success(`${data.name} 解析完成`);
    } catch {
      setSaved((prev) =>
        prev.map((it) =>
          it.id === id
            ? { ...it, parseStatus: "failed", parseError: "网络请求失败" }
            : it
        )
      );
      toast.error("解析请求失败");
    } finally {
      setParsingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const toggleParsedText = (id: string) => {
    setExpandedText((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const removeSaved = async (id: string) => {
    const item = saved.find((it) => it.id === id);
    try {
      await fetch(`/api/attachments/${id}`, { method: "DELETE" });
      setSaved((prev) => prev.filter((it) => it.id !== id));
      toast.success(`${item?.name ?? "附件"} 已删除`);
    } catch {
      toast.error("删除失败,请重试");
    }
  };

  const acceptValue = Object.values(ACCEPT_EXTENSION_MAP).join(",");

  const hasUploading = items.some((i) => i.state === "uploading");
  const hasErrors = items.some((i) => i.state === "error");
  const doneCount = items.filter((i) => i.state === "done").length;

  return (
    <div className="flex min-h-svh w-full flex-col items-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">上传附件</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          支持图片、文档、表格、文本及压缩包,单文件上限 10 MB
        </p>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">拖拽或点击上传</CardTitle>
          </CardHeader>
          <CardContent>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={acceptValue}
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                addFiles(e.dataTransfer.files);
              }}
              className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
                dragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              }`}
            >
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Upload className="size-5 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  点击选择文件,或拖拽到此处
                </p>
                <p className="text-xs text-muted-foreground">
                  单个文件最大 {formatSize(MAX_SIZE)}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {[
                { label: "图片", mime: "image/" },
                { label: "PDF", mime: "application/pdf" },
                { label: "文档", mime: "msword" },
                { label: "表格", mime: "spreadsheet" },
                { label: "文本", mime: "text/plain" },
                { label: "压缩包", mime: "zip" },
              ].map((t) => (
                <Badge key={t.label} variant="secondary" className="text-[10px]">
                  {t.label}
                </Badge>
              ))}
              <span className="ml-1 self-center text-[10px] text-muted-foreground">
                等
              </span>
            </div>
          </CardContent>
        </Card>

        {hasErrors && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="size-4" />
            <AlertTitle>上传出错</AlertTitle>
            <AlertDescription>
              {items
                .filter((i) => i.state === "error")
                .map((i) => (
                  <span key={i.id} className="block">
                    {i.name}: {i.error ?? "未知错误"}
                  </span>
                ))}
            </AlertDescription>
          </Alert>
        )}

        {items.length > 0 && (
          <div className="mb-8 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">
                {hasUploading
                  ? `上传中 (${items.length})`
                  : `上传完成 (${doneCount}/${items.length})`}
              </h2>
              {!hasUploading && doneCount > 0 && (
                <CheckCircle2 className="size-4 text-green-500" />
              )}
            </div>
            <AttachmentGroup className="flex-col gap-3 overflow-visible">
              {items.map((item) => (
                <Attachment
                  key={item.id}
                  state={item.state}
                  orientation="horizontal"
                  className="w-full max-w-full"
                >
                  <AttachmentMedia
                    variant={item.preview ? "image" : "icon"}
                  >
                    {item.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.preview} alt={item.name} />
                    ) : (
                      (() => {
                        const Icon = fileIcon(item.type);
                        return <Icon className="size-5" />;
                      })()
                    )}
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle>{item.name}</AttachmentTitle>
                    <AttachmentDescription>
                      {item.state === "uploading" && (
                        <span className="flex items-center gap-1.5">
                          上传中 {item.progress}%
                        </span>
                      )}
                      {item.state === "error" && (
                        <span className="text-destructive">
                          {item.error ?? "上传失败"}
                        </span>
                      )}
                      {item.state === "done" && (
                        <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                          <CheckCircle2 className="size-3" />
                          {formatSize(item.size)}
                        </span>
                      )}
                    </AttachmentDescription>
                    {item.state === "uploading" && (
                      <Progress value={item.progress} className="mt-1 h-1" />
                    )}
                  </AttachmentContent>
                  <AttachmentActions>
                    <AttachmentAction
                      aria-label={`移除 ${item.name}`}
                      onClick={() => removeItem(item.id)}
                    >
                      <X className="size-4" />
                    </AttachmentAction>
                  </AttachmentActions>
                </Attachment>
              ))}
            </AttachmentGroup>
          </div>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              已上传{saved.length > 0 ? ` (${saved.length})` : ""}
            </CardTitle>
            {!isLoading && saved.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => fetchList()}
              >
                <Loader2 className="size-3" />
                刷新
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner />
                <span className="ml-2 text-sm text-muted-foreground">
                  加载中...
                </span>
              </div>
            ) : loadError ? (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>加载失败</AlertTitle>
                <AlertDescription className="flex items-center gap-2">
                  {loadError}
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                    onClick={() => fetchList()}
                  >
                    重试
                  </Button>
                </AlertDescription>
              </Alert>
            ) : saved.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                  <FileText className="size-4 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  暂无已上传的文件
                </p>
              </div>
            ) : (
              <AttachmentGroup className="flex-col gap-3 overflow-visible">
                {saved.map((att) => {
                  const Icon = fileIcon(att.type);
                  const isPdf = att.type === "application/pdf";
                  const isParsing = parsingIds.has(att.id);
                  const isExpanded = expandedText.has(att.id);
                  const parsedContent = att.parsedText || att.parsedMarkdown;

                  return (
                    <div key={att.id}>
                      <Attachment
                        state={
                          att.parseStatus === "failed"
                            ? "error"
                            : "done"
                        }
                        orientation="horizontal"
                        className="w-full max-w-full"
                      >
                        <AttachmentMedia
                          variant={
                            att.type.startsWith("image/") ? "image" : "icon"
                          }
                        >
                          {att.type.startsWith("image/") ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={att.url} alt={att.name} />
                          ) : (
                            <Icon className="size-5" />
                          )}
                        </AttachmentMedia>
                        <AttachmentContent>
                          <AttachmentTitle className="flex items-center gap-2">
                            {att.name}
                            {att.parseStatus === "completed" && (
                              <CheckCircle2 className="size-3 text-green-500" />
                            )}
                            {att.parseStatus === "failed" && (
                              <AlertCircle className="size-3 text-destructive" />
                            )}
                          </AttachmentTitle>
                          <AttachmentDescription>
                            <span className="flex flex-wrap items-center gap-1.5">
                              {formatSize(att.size)}
                              <Badge
                                variant="secondary"
                                className="text-[10px]"
                              >
                                {typeLabel(att.type)}
                              </Badge>
                               {att.parseStatus === "completed" && (
                                <Badge
                                  className="bg-green-100 text-[10px] text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                >
                                  已解析{att.chunks ? ` (${att.chunks.length} chunks)` : ""}
                                </Badge>
                              )}
                              {att.parseStatus === "running" && (
                                <Badge className="text-[10px]">
                                  <Loader2 className="mr-1 size-2.5 animate-spin" />
                                  解析中
                                </Badge>
                              )}
                              {att.parseStatus === "failed" && (
                                <Badge
                                  variant="destructive"
                                  className="text-[10px]"
                                >
                                  解析失败
                                </Badge>
                              )}
                            </span>
                            {att.parseError && att.parseStatus === "failed" && (
                              <p className="mt-1 text-xs text-destructive">
                                {att.parseError}
                              </p>
                            )}
                          </AttachmentDescription>
                        </AttachmentContent>
                        <AttachmentActions>
                          {isPdf &&
                            att.parseStatus !== "completed" &&
                            att.parseStatus !== "running" && (
                              <AttachmentAction
                                variant="ghost"
                                aria-label={`解析 ${att.name}`}
                                disabled={isParsing}
                                onClick={() => parsePdf(att.id)}
                              >
                                {isParsing ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <Brain className="size-4" />
                                )}
                              </AttachmentAction>
                            )}
                          {parsedContent && (
                            <AttachmentAction
                              variant="ghost"
                              aria-label={
                                isExpanded ? "收起解析内容" : "查看解析内容"
                              }
                              onClick={() => toggleParsedText(att.id)}
                            >
                              {isExpanded ? (
                                <EyeOff className="size-4" />
                              ) : (
                                <Eye className="size-4" />
                              )}
                            </AttachmentAction>
                          )}
                          <AttachmentAction
                            variant="ghost"
                            aria-label={`删除 ${att.name}`}
                            onClick={() => removeSaved(att.id)}
                          >
                            <Trash2 className="size-4" />
                          </AttachmentAction>
                        </AttachmentActions>
                      </Attachment>
                      {isExpanded && parsedContent && (
                        <div className="mx-3 mb-2 mt-1 rounded-lg border bg-muted/30 p-3">
                          <pre className="max-h-96 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                            {parsedContent}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </AttachmentGroup>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
