import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { del, get, head, list, put } from '@vercel/blob';
import { promises as fs } from 'node:fs';
import { createReadStream } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { Readable } from 'node:stream';
import type { UploadedTaskFile } from '../task-upload.types';

type TaskStorageDriver = 'local' | 'vercel-blob';
type BlobAccessMode = 'public' | 'private';

@Injectable()
export class TaskFileStorageService {
  private readonly rootDir = path.resolve(
    process.cwd(),
    '.runtime',
    'task-uploads',
  );

  constructor(private readonly configService: ConfigService) {}

  private get driver(): TaskStorageDriver {
    return this.configService.get<TaskStorageDriver>('FILE_STORAGE_DRIVER') ===
      'vercel-blob'
      ? 'vercel-blob'
      : 'local';
  }

  private get blobToken(): string | undefined {
    return this.configService.get<string>('BLOB_READ_WRITE_TOKEN');
  }

  private get blobAccess(): BlobAccessMode {
    return this.configService.get<BlobAccessMode>('BLOB_ACCESS') === 'private'
      ? 'private'
      : 'public';
  }

  private buildBlobPath(groupId: string, taskId: string, storedName: string) {
    return path.posix.join('task-uploads', groupId, taskId, storedName);
  }

  private async listAllBlobPathnames(prefix: string): Promise<string[]> {
    const blobs: string[] = [];
    let cursor: string | undefined = undefined;

    do {
      const page = await list({
        prefix,
        cursor,
        token: this.blobToken,
      });
      page.blobs.forEach((blob) => blobs.push(blob.pathname));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);

    return blobs;
  }

  async saveFile(groupId: string, taskId: string, file: UploadedTaskFile) {
    const ext = path.extname(file.originalname).toLowerCase();
    const storedName = `${Date.now()}-${randomUUID()}${ext}`;
    const relativePath =
      this.driver === 'vercel-blob'
        ? this.buildBlobPath(groupId, taskId, storedName)
        : path.join(groupId, taskId, storedName);

    if (this.driver === 'vercel-blob') {
      await put(relativePath, file.buffer, {
        access: this.blobAccess,
        addRandomSuffix: false,
        contentType: file.mimetype,
        token: this.blobToken,
      });

      return {
        storedName,
        absolutePath: relativePath,
        relativePath,
      };
    }

    const taskDir = path.join(this.rootDir, groupId, taskId);
    await fs.mkdir(taskDir, { recursive: true });

    const absolutePath = path.join(taskDir, storedName);
    await fs.writeFile(absolutePath, file.buffer);

    return {
      storedName,
      absolutePath,
      relativePath,
    };
  }

  async deleteFile(relativePath: string | null | undefined): Promise<void> {
    if (!relativePath) {
      return;
    }

    if (this.driver === 'vercel-blob') {
      try {
        await del(relativePath, { token: this.blobToken });
      } catch (error) {
        const blobError = error as Error & { name?: string };
        if (blobError.name !== 'BlobNotFoundError') {
          throw error;
        }
      }
      return;
    }

    const absolutePath = path.join(this.rootDir, relativePath);

    try {
      await fs.unlink(absolutePath);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async deleteTaskDirectory(groupId: string, taskId: string): Promise<void> {
    if (this.driver === 'vercel-blob') {
      const prefix = path.posix.join('task-uploads', groupId, taskId) + '/';
      const pathnames = await this.listAllBlobPathnames(prefix);
      if (pathnames.length > 0) {
        await del(pathnames, { token: this.blobToken });
      }
      return;
    }

    const taskDir = path.join(this.rootDir, groupId, taskId);
    await fs.rm(taskDir, { recursive: true, force: true });
  }

  async deleteGroupDirectory(groupId: string): Promise<void> {
    if (this.driver === 'vercel-blob') {
      const prefix = path.posix.join('task-uploads', groupId) + '/';
      const pathnames = await this.listAllBlobPathnames(prefix);
      if (pathnames.length > 0) {
        await del(pathnames, { token: this.blobToken });
      }
      return;
    }

    const groupDir = path.join(this.rootDir, groupId);
    await fs.rm(groupDir, { recursive: true, force: true });
  }

  async createFileReadStream(relativePath: string): Promise<Readable> {
    if (this.driver === 'vercel-blob') {
      const blob = await get(relativePath, {
        access: this.blobAccess,
        token: this.blobToken,
        useCache: false,
      });

      if (!blob || !blob.stream) {
        throw new Error(`Blob not found: ${relativePath}`);
      }

      return Readable.fromWeb(blob.stream as globalThis.ReadableStream);
    }

    return createReadStream(path.join(this.rootDir, relativePath));
  }

  async readFileBuffer(relativePath: string): Promise<Buffer> {
    if (this.driver === 'vercel-blob') {
      const stream = await this.createFileReadStream(relativePath);
      const chunks: Buffer[] = [];

      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      return Buffer.concat(chunks);
    }

    return fs.readFile(path.join(this.rootDir, relativePath));
  }

  async getPublicFileUrl(relativePath: string): Promise<string | null> {
    if (this.driver !== 'vercel-blob' || this.blobAccess !== 'public') {
      return null;
    }

    const blob = await head(relativePath, {
      token: this.blobToken,
    });

    return blob.url;
  }
}
