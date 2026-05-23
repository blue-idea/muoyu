import {
  DeleteObjectsCommand,
  GetObjectCommand,
  type GetObjectCommandOutput,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import type { R2StorageConfig } from "@/config/storage";
import type { StorageDriver, StorageObjectList } from "@/lib/storage/types";

const MAX_DELETE_BATCH_SIZE = 1000;
const DEFAULT_TEXT_CONTENT_TYPE = "text/plain; charset=utf-8";
const DEFAULT_BINARY_CONTENT_TYPE = "application/octet-stream";
const MARKDOWN_CONTENT_TYPE = "text/markdown; charset=utf-8";
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

type ObjectBody = GetObjectCommandOutput["Body"];

interface TransformToStringBody {
  transformToString(encoding?: string): Promise<string>;
}

interface TransformToByteArrayBody {
  transformToByteArray(): Promise<Uint8Array>;
}

function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

function extractObjectBody(output: GetObjectCommandOutput): ObjectBody {
  if (output.Body === undefined) {
    throw new Error("R2 object body is empty");
  }

  return output.Body;
}

function getTransformToString(body: ObjectBody): TransformToStringBody["transformToString"] | null {
  if (typeof body !== "object" || body === null || !("transformToString" in body)) {
    return null;
  }

  const candidate = Reflect.get(body, "transformToString");
  if (typeof candidate !== "function") {
    return null;
  }

  return async (encoding?: string) =>
    Promise.resolve(Reflect.apply(candidate, body, [encoding])).then((value) =>
      typeof value === "string" ? value : String(value),
    );
}

function getTransformToByteArray(
  body: ObjectBody,
): TransformToByteArrayBody["transformToByteArray"] | null {
  if (typeof body !== "object" || body === null || !("transformToByteArray" in body)) {
    return null;
  }

  const candidate = Reflect.get(body, "transformToByteArray");
  if (typeof candidate !== "function") {
    return null;
  }

  return async () => {
    const value = await Promise.resolve(Reflect.apply(candidate, body, []));
    if (value instanceof Uint8Array) {
      return value;
    }

    if (typeof value === "string") {
      return new TextEncoder().encode(value);
    }

    if (Array.isArray(value)) {
      return Uint8Array.from(value);
    }

    throw new Error("R2 object body transformToByteArray returned invalid value");
  };
}

async function readBodyAsText(body: ObjectBody): Promise<string> {
  if (typeof body === "string") {
    return body;
  }

  if (body instanceof Uint8Array) {
    return new TextDecoder().decode(body);
  }

  const transformToString = getTransformToString(body);
  if (transformToString !== null) {
    return transformToString("utf-8");
  }

  const transformToByteArray = getTransformToByteArray(body);
  if (transformToByteArray !== null) {
    const bytes = await transformToByteArray();
    return new TextDecoder().decode(bytes);
  }

  throw new Error("R2 object body cannot be decoded as text");
}

async function readBodyAsBytes(body: ObjectBody): Promise<Uint8Array> {
  if (body instanceof Uint8Array) {
    return body;
  }

  if (typeof body === "string") {
    return new TextEncoder().encode(body);
  }

  const transformToByteArray = getTransformToByteArray(body);
  if (transformToByteArray !== null) {
    return transformToByteArray();
  }

  const transformToString = getTransformToString(body);
  if (transformToString !== null) {
    const text = await transformToString("utf-8");
    return new TextEncoder().encode(text);
  }

  throw new Error("R2 object body cannot be decoded as bytes");
}

function resolveTextContentType(key: string): string {
  if (key.endsWith(".md")) {
    return MARKDOWN_CONTENT_TYPE;
  }

  if (key.endsWith(".json")) {
    return JSON_CONTENT_TYPE;
  }

  return DEFAULT_TEXT_CONTENT_TYPE;
}

export class R2StorageDriver implements StorageDriver {
  private readonly bucket: string;
  private readonly client: S3Client;

  public constructor(config: R2StorageConfig) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  public async readText(key: string): Promise<string> {
    const output = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    return readBodyAsText(extractObjectBody(output));
  }

  public async writeText(key: string, body: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: resolveTextContentType(key),
      }),
    );
  }

  public async readBytes(key: string): Promise<Uint8Array> {
    const output = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    return readBodyAsBytes(extractObjectBody(output));
  }

  public async writeBytes(
    key: string,
    body: Uint8Array,
    contentType = DEFAULT_BINARY_CONTENT_TYPE,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  public async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );

      return true;
    } catch (error) {
      if (error instanceof Error && error.name === "NotFound") {
        return false;
      }

      throw error;
    }
  }

  public async list(prefix: string): Promise<StorageObjectList> {
    const keys: StorageObjectList = [];
    let continuationToken: string | undefined;
    let shouldContinue = true;

    while (shouldContinue) {
      const output = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );

      const pageKeys = (output.Contents ?? [])
        .map((item) => item.Key)
        .filter(isNonEmptyString)
        .map((key) => (key.startsWith(prefix) ? key.slice(prefix.length) : key));
      keys.push(...pageKeys);

      shouldContinue = output.IsTruncated === true;
      continuationToken = output.NextContinuationToken;
    }

    return keys;
  }

  public async deletePrefix(prefix: string): Promise<void> {
    let continuationToken: string | undefined;
    let shouldContinue = true;

    while (shouldContinue) {
      const output = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );

      const keys = (output.Contents ?? [])
        .map((item) => item.Key)
        .filter(isNonEmptyString);

      for (let start = 0; start < keys.length; start += MAX_DELETE_BATCH_SIZE) {
        const currentBatch = keys.slice(start, start + MAX_DELETE_BATCH_SIZE);
        await this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: {
              Objects: currentBatch.map((key) => ({ Key: key })),
            },
          }),
        );
      }

      shouldContinue = output.IsTruncated === true;
      continuationToken = output.NextContinuationToken;
    }
  }
}
