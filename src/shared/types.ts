export interface FileEntry { path: string; name: string; size: number; mtimeMs: number }
export interface FolderEntry { path: string; name: string }
export interface ScanResult { folders: FolderEntry[]; files: FileEntry[] }
export interface Metadata { schemaVersion: 1; tags: string[]; notes: string; linkedImage?: string; updatedAt: string }
export interface ModelStats { triCount: number; vertCount: number; bbox: { x: number; y: number; z: number } }
