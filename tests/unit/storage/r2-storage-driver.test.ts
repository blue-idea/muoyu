import { beforeEach, describe, expect, test, vi } from "vitest";

const sentCommands: object[] = [];
const sendMock = vi.fn<(command: object) => Promise<object>>();

class MockS3Client {
  public constructor() {}

  public async send(command: object): Promise<object> {
    sentCommands.push(command);
    return sendMock(command);
  }
}

class PutObjectCommand {
  public constructor(
    public readonly input: {
      Bucket: string;
      Key: string;
      Body: string | Uint8Array;
      ContentType: string;
    },
  ) {}
}

class GetObjectCommand {
  public constructor(
    public readonly input: {
      Bucket: string;
      Key: string;
    },
  ) {}
}

class HeadObjectCommand {
  public constructor(
    public readonly input: {
      Bucket: string;
      Key: string;
    },
  ) {}
}

class ListObjectsV2Command {
  public constructor(
    public readonly input: {
      Bucket: string;
      Prefix: string;
      ContinuationToken?: string;
    },
  ) {}
}

class DeleteObjectsCommand {
  public constructor(
    public readonly input: {
      Bucket: string;
      Delete: {
        Objects: Array<{ Key: string }>;
      };
    },
  ) {}
}

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: MockS3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
}));

function createDriverConfig() {
  return {
    accountId: "account-id",
    accessKeyId: "access-key",
    secretAccessKey: "secret-key",
    bucket: "bucket-name",
    endpoint: "https://account-id.r2.cloudflarestorage.com",
    region: "auto",
  };
}

function assertPutObjectCommand(command: object): asserts command is PutObjectCommand {
  expect(command).toBeInstanceOf(PutObjectCommand);
}

function assertGetObjectCommand(command: object): asserts command is GetObjectCommand {
  expect(command).toBeInstanceOf(GetObjectCommand);
}

function assertHeadObjectCommand(command: object): asserts command is HeadObjectCommand {
  expect(command).toBeInstanceOf(HeadObjectCommand);
}

function assertListObjectsV2Command(
  command: object,
): asserts command is ListObjectsV2Command {
  expect(command).toBeInstanceOf(ListObjectsV2Command);
}

function assertDeleteObjectsCommand(
  command: object,
): asserts command is DeleteObjectsCommand {
  expect(command).toBeInstanceOf(DeleteObjectsCommand);
}

describe("R2StorageDriver", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sentCommands.length = 0;
  });

  test("should write text by put object command", async () => {
    sendMock.mockResolvedValueOnce({});
    const r2StorageModule = await import("../../../lib/storage/r2-storage-driver");
    const driver = new r2StorageModule.R2StorageDriver(createDriverConfig());

    await driver.writeText("project/01-outline.md", "# title");

    expect(sentCommands).toHaveLength(1);
    const command = sentCommands[0];
    assertPutObjectCommand(command);
    expect(command.input).toEqual({
      Bucket: "bucket-name",
      Key: "project/01-outline.md",
      Body: "# title",
      ContentType: "text/markdown; charset=utf-8",
    });
  });

  test("should write json text with json content type", async () => {
    sendMock.mockResolvedValueOnce({});
    const r2StorageModule = await import("../../../lib/storage/r2-storage-driver");
    const driver = new r2StorageModule.R2StorageDriver(createDriverConfig());

    await driver.writeText("project/02-writing-plan.json", "{\"chapters\":[]}");

    expect(sentCommands).toHaveLength(1);
    const command = sentCommands[0];
    assertPutObjectCommand(command);
    expect(command.input).toEqual({
      Bucket: "bucket-name",
      Key: "project/02-writing-plan.json",
      Body: "{\"chapters\":[]}",
      ContentType: "application/json; charset=utf-8",
    });
  });

  test("should read text by get object command", async () => {
    sendMock.mockResolvedValueOnce({
      Body: {
        transformToString: async () => "outline content",
      },
    });
    const r2StorageModule = await import("../../../lib/storage/r2-storage-driver");
    const driver = new r2StorageModule.R2StorageDriver(createDriverConfig());

    const text = await driver.readText("project/01-outline.md");

    expect(text).toBe("outline content");
    const command = sentCommands[0];
    assertGetObjectCommand(command);
    expect(command.input).toEqual({
      Bucket: "bucket-name",
      Key: "project/01-outline.md",
    });
  });

  test("should write bytes by put object command", async () => {
    sendMock.mockResolvedValueOnce({});
    const r2StorageModule = await import("../../../lib/storage/r2-storage-driver");
    const driver = new r2StorageModule.R2StorageDriver(createDriverConfig());

    await driver.writeBytes("project/export.pdf", new Uint8Array([1, 2, 3]));

    const command = sentCommands[0];
    assertPutObjectCommand(command);
    expect(command.input).toEqual({
      Bucket: "bucket-name",
      Key: "project/export.pdf",
      Body: new Uint8Array([1, 2, 3]),
      ContentType: "application/octet-stream",
    });
  });

  test("should read bytes by get object command", async () => {
    sendMock.mockResolvedValueOnce({
      Body: {
        transformToByteArray: async () => new Uint8Array([4, 5, 6]),
      },
    });
    const r2StorageModule = await import("../../../lib/storage/r2-storage-driver");
    const driver = new r2StorageModule.R2StorageDriver(createDriverConfig());

    const bytes = await driver.readBytes("project/export.pdf");

    expect(bytes).toEqual(new Uint8Array([4, 5, 6]));
    const command = sentCommands[0];
    assertGetObjectCommand(command);
    expect(command.input).toEqual({
      Bucket: "bucket-name",
      Key: "project/export.pdf",
    });
  });

  test("should return true when object exists", async () => {
    sendMock.mockResolvedValueOnce({});
    const r2StorageModule = await import("../../../lib/storage/r2-storage-driver");
    const driver = new r2StorageModule.R2StorageDriver(createDriverConfig());

    const existed = await driver.exists("project/chapter-1.md");

    expect(existed).toBe(true);
    const command = sentCommands[0];
    assertHeadObjectCommand(command);
    expect(command.input).toEqual({
      Bucket: "bucket-name",
      Key: "project/chapter-1.md",
    });
  });

  test("should return false when object does not exist", async () => {
    const notFoundError = new Error("Not found");
    Object.defineProperty(notFoundError, "name", { value: "NotFound" });
    sendMock.mockRejectedValueOnce(notFoundError);

    const r2StorageModule = await import("../../../lib/storage/r2-storage-driver");
    const driver = new r2StorageModule.R2StorageDriver(createDriverConfig());

    const existed = await driver.exists("project/missing.md");

    expect(existed).toBe(false);
  });

  test("should list object keys relative to prefix", async () => {
    sendMock.mockResolvedValueOnce({
      Contents: [
        { Key: "project/chapter-1.md" },
        { Key: "project/chapter-2.md" },
      ],
      IsTruncated: false,
    });
    const r2StorageModule = await import("../../../lib/storage/r2-storage-driver");
    const driver = new r2StorageModule.R2StorageDriver(createDriverConfig());

    const keys = await driver.list("project/");

    expect(keys).toEqual(["chapter-1.md", "chapter-2.md"]);
    const command = sentCommands[0];
    assertListObjectsV2Command(command);
    expect(command.input).toEqual({
      Bucket: "bucket-name",
      Prefix: "project/",
    });
  });

  test("should delete all objects by prefix with pagination", async () => {
    sendMock
      .mockResolvedValueOnce({
        Contents: [{ Key: "project/chapter-1.md" }, { Key: "project/chapter-2.md" }],
        IsTruncated: true,
        NextContinuationToken: "token-2",
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        Contents: [{ Key: "project/chapter-3.md" }],
        IsTruncated: false,
      })
      .mockResolvedValueOnce({});

    const r2StorageModule = await import("../../../lib/storage/r2-storage-driver");
    const driver = new r2StorageModule.R2StorageDriver(createDriverConfig());

    await driver.deletePrefix("project/");

    expect(sentCommands).toHaveLength(4);

    const firstList = sentCommands[0];
    assertListObjectsV2Command(firstList);
    expect(firstList.input).toEqual({
      Bucket: "bucket-name",
      Prefix: "project/",
    });

    const firstDelete = sentCommands[1];
    assertDeleteObjectsCommand(firstDelete);
    expect(firstDelete.input).toEqual({
      Bucket: "bucket-name",
      Delete: {
        Objects: [{ Key: "project/chapter-1.md" }, { Key: "project/chapter-2.md" }],
      },
    });

    const secondList = sentCommands[2];
    assertListObjectsV2Command(secondList);
    expect(secondList.input).toEqual({
      Bucket: "bucket-name",
      Prefix: "project/",
      ContinuationToken: "token-2",
    });

    const secondDelete = sentCommands[3];
    assertDeleteObjectsCommand(secondDelete);
    expect(secondDelete.input).toEqual({
      Bucket: "bucket-name",
      Delete: {
        Objects: [{ Key: "project/chapter-3.md" }],
      },
    });
  });

  test("should delete objects in batches of 1000", async () => {
    const firstPage = Array.from({ length: 1001 }, (_, index) => ({
      Key: `project/chapter-${index + 1}.md`,
    }));

    sendMock
      .mockResolvedValueOnce({
        Contents: firstPage,
        IsTruncated: false,
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    const r2StorageModule = await import("../../../lib/storage/r2-storage-driver");
    const driver = new r2StorageModule.R2StorageDriver(createDriverConfig());

    await driver.deletePrefix("project/");

    expect(sentCommands).toHaveLength(3);
    const firstDelete = sentCommands[1];
    assertDeleteObjectsCommand(firstDelete);
    expect(firstDelete.input.Delete.Objects).toHaveLength(1000);
    const secondDelete = sentCommands[2];
    assertDeleteObjectsCommand(secondDelete);
    expect(secondDelete.input.Delete.Objects).toHaveLength(1);
  });
});

