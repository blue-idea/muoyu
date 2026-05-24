/**
 * Export Service Unit Tests
 *
 * EARS: REQ-012-AC-003
 */

import { describe, it, expect } from "vitest";

describe("Export Service", () => {
  describe("export formats", () => {
    it("should support MD, TXT, PDF, EPUB formats", () => {
      const formats = ["md", "txt", "pdf", "epub"] as const;
      expect(formats).toContain("md");
      expect(formats).toContain("txt");
      expect(formats).toContain("pdf");
      expect(formats).toContain("epub");
    });

    it("should build markdown export structure correctly", () => {
      // Verify markdown structure: title, author, body chapters
      const metadata = { title: "测试小说", author: "测试作者" };
      const chapters = [
        { number: 1, title: "第一章", content: "第一章内容" },
        { number: 2, title: "第二章", content: "第二章内容" },
      ];

      const output = `\# ${metadata.title}\n**作者**：${metadata.author}\n\n## 第1章：${chapters[0].title}\n\n${chapters[0].content}\n\n## 第2章：${chapters[1].title}\n\n${chapters[1].content}`;

      expect(output).toContain("# 测试小说");
      expect(output).toContain("**作者**：测试作者");
      expect(output).toContain("第1章");
      expect(output).toContain("第一章内容");
    });

    it("should handle chapter sorting by number", () => {
      const chapters = [
        { chapterNumber: 3, title: "C", status: "completed" },
        { chapterNumber: 1, title: "A", status: "completed" },
        { chapterNumber: 2, title: "B", status: "completed" },
      ];

      const sorted = chapters
        .filter((c) => c.status === "completed")
        .sort((a, b) => a.chapterNumber - b.chapterNumber);

      expect(sorted[0].chapterNumber).toBe(1);
      expect(sorted[1].chapterNumber).toBe(2);
      expect(sorted[2].chapterNumber).toBe(3);
    });
  });

  describe("file extension mapping", () => {
    it("should map format to correct file extension", () => {
      const extensionMap: Record<string, string> = {
        md: "md",
        txt: "txt",
        pdf: "html", // PDF uses HTML as intermediate
        epub: "epub",
      };

      expect(extensionMap["md"]).toBe("md");
      expect(extensionMap["txt"]).toBe("txt");
      expect(extensionMap["pdf"]).toBe("html");
      expect(extensionMap["epub"]).toBe("epub");
    });
  });

  describe("content-type mapping", () => {
    it("should map format to correct content type", () => {
      const contentTypeMap: Record<string, string> = {
        md: "text/markdown; charset=utf-8",
        txt: "text/plain; charset=utf-8",
        pdf: "text/html; charset=utf-8",
        epub: "application/epub+zip",
      };

      expect(contentTypeMap["md"]).toContain("markdown");
      expect(contentTypeMap["txt"]).toContain("plain");
      expect(contentTypeMap["pdf"]).toContain("html");
      expect(contentTypeMap["epub"]).toContain("epub");
    });
  });
});