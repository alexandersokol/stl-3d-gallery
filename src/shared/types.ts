export interface FileEntry { path: string; name: string; size: number; mtimeMs: number }
export interface FolderEntry { path: string; name: string }
export interface ScanResult { folders: FolderEntry[]; files: FileEntry[] }
export interface Metadata { schemaVersion: 1; tags: string[]; notes: string; linkedImage?: string; updatedAt: string }
export interface ModelStats { triCount: number; vertCount: number; bbox: { x: number; y: number; z: number } }

// Result of a rename/copy/move that produced a model at a new path. `path` is
// the model's new absolute path.
export interface FileOpResult { path: string }

export interface Api {
  openFolderDialog(): Promise<string | null>
  scanFolder(dir: string): Promise<ScanResult>
  scanTree(dir: string): Promise<FileEntry[]>
  readFileBytes(p: string): Promise<ArrayBuffer>
  readMetadata(model: string): Promise<Metadata | null>
  readMetadataBatch(paths: string[]): Promise<Record<string, Metadata>>
  writeMetadata(model: string, data: Partial<Metadata>): Promise<Metadata>
  readThumbnail(model: string, preset: string): Promise<ArrayBuffer | null>
  writeThumbnail(model: string, preset: string, png: ArrayBuffer): Promise<void>
  readLinkedImage(model: string): Promise<{ bytes: ArrayBuffer; name: string } | null>
  writeLinkedImage(model: string, bytes: ArrayBuffer, ext: string): Promise<string>
  removeLinkedImage(model: string): Promise<void>
  // File operations. Each also carries the model's sidecars (metadata,
  // thumbnails, linked image). rename/copy take a new bare filename (validated
  // against shared/filename); move opens a native folder picker and resolves
  // to null if the user cancels; delete moves everything to the OS trash.
  renameModel(model: string, newName: string): Promise<FileOpResult>
  copyModel(model: string, newName: string): Promise<FileOpResult>
  moveModel(model: string): Promise<FileOpResult | null>
  deleteModel(model: string): Promise<void>
  getLastFolder(): Promise<string | null>
  setLastFolder(dir: string): Promise<void>
  onOpenFile(cb: (path: string) => void): void
  getStartupFolder(): Promise<string | null>
}
