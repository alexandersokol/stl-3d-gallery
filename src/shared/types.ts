export interface FileEntry { path: string; name: string; size: number; mtimeMs: number }
export interface FolderEntry { path: string; name: string }
export interface ScanResult { folders: FolderEntry[]; files: FileEntry[] }
export interface Metadata { schemaVersion: 1; tags: string[]; notes: string; linkedImage?: string; updatedAt: string }
export interface ModelStats { triCount: number; vertCount: number; bbox: { x: number; y: number; z: number } }

export interface Api {
  openFolderDialog(): Promise<string | null>
  scanFolder(dir: string): Promise<ScanResult>
  scanTree(dir: string): Promise<FileEntry[]>
  readFileBytes(p: string): Promise<ArrayBuffer>
  readMetadata(model: string): Promise<Metadata | null>
  readMetadataBatch(paths: string[]): Promise<Record<string, Metadata>>
  writeMetadata(model: string, data: Partial<Metadata>): Promise<Metadata>
  readThumbnail(model: string): Promise<ArrayBuffer | null>
  writeThumbnail(model: string, png: ArrayBuffer): Promise<void>
  readLinkedImage(model: string): Promise<{ bytes: ArrayBuffer; name: string } | null>
  writeLinkedImage(model: string, bytes: ArrayBuffer, ext: string): Promise<string>
  removeLinkedImage(model: string): Promise<void>
  getLastFolder(): Promise<string | null>
  setLastFolder(dir: string): Promise<void>
  onOpenFile(cb: (path: string) => void): void
  getStartupFolder(): Promise<string | null>
}
