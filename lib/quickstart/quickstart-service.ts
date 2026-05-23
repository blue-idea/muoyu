/**
 * QuickStart Service
 *
 * 提供快捷开写的核心逻辑：
 * 1. extract(description) - 从用户输入提取结构化字段
 * 2. choosePath(extractedResult) - 用户选择"进入完整向导"或"跳过至规划"
 *
 * EARS-1: REQ-003-AC-003 提取描述生成结构化字段
 * EARS-3: REQ-003-AC-004 提取结果页二选一
 * EARS-4: REQ-003-AC-006 跳过至规划时若无 novelName 先 L3
 * EARS-5: REQ-003-AC-007 提取全空仅完整向导
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtractedFields {
  genre: string;
  premise: string;
  protagonistType: string;
  protagonistProfession: string;
  coreConflictType: string;
}

export interface ExtractResult {
  /** 原始描述 */
  rawDescription: string;
  /** 提取的结构化字段 */
  fields: ExtractedFields;
  /** 是否提取成功（有任意非空字段即算成功） */
  success: boolean;
}

export type QuickStartPath = "full-wizard" | "skip-to-planning";

export interface PathChoice {
  path: QuickStartPath;
  /** 用户确认的提取字段（可能已编辑） */
  confirmedFields: ExtractedFields;
}

// ---------------------------------------------------------------------------
// QuickStart Service
// ---------------------------------------------------------------------------

export class QuickStartService {
  /**
   * 从用户输入描述中提取结构化字段
   *
   * EARS-1: REQ-003-AC-003
   * - 调用 LLM 提取：题材、主角类型、职业、核心冲突
   * - 不做"充足创作要素"自动判定
   *
   * @param description 用户输入的创作描述（建议最少 20 字）
   * @returns 提取结果
   */
  async extract(description: string): Promise<ExtractResult> {
    // 空描述视为提取失败
    if (!description || description.trim().length === 0) {
      return {
        rawDescription: description,
        fields: {
          genre: "",
          premise: "",
          protagonistType: "",
          protagonistProfession: "",
          coreConflictType: "",
        },
        success: false,
      };
    }

    try {
      // 调用 AI 提取（通过 LlmRouter，这里先构造 prompt）
      const fields = await this.callExtractLlm(description);

      const hasAnyField = Boolean(
        fields.genre ||
          fields.premise ||
          fields.protagonistType ||
          fields.protagonistProfession ||
          fields.coreConflictType,
      );

      return {
        rawDescription: description,
        fields,
        success: hasAnyField,
      };
    } catch {
      // 提取失败时返回空字段
      return {
        rawDescription: description,
        fields: {
          genre: "",
          premise: "",
          protagonistType: "",
          protagonistProfession: "",
          coreConflictType: "",
        },
        success: false,
      };
    }
  }

  /**
   * 用户在提取结果页选择路径
   *
   * EARS-3: REQ-003-AC-004
   * - "进入完整向导" → 预填 L1 字段，从 L1 开始逐步向导
   * - "跳过至规划" → 持久化提取结果；若无 novelName 先 L3 再 L4
   *
   * @param result 原始提取结果
   * @param editedFields 用户编辑后的字段（允许修改提取结果）
   * @param selectedPath 用户选择的路径
   * @returns 路径选择结果
   */
  choosePath(
    result: ExtractResult,
    editedFields: ExtractedFields,
    selectedPath: QuickStartPath,
  ): PathChoice {
    return {
      path: selectedPath,
      confirmedFields: editedFields,
    };
  }

  /**
   * 判断提取结果是否足以支持"跳过至规划"
   *
   * EARS-4: REQ-003-AC-007
   * - 题材、主角、冲突均为空 → 仅展示"进入完整向导"
   */
  canSkipToPlanning(result: ExtractResult): boolean {
    const { fields } = result;
    return Boolean(fields.genre || fields.protagonistType || fields.coreConflictType);
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /**
   * 调用 LLM 提取结构化字段
   * TODO: 接入 LlmRouter，使用 AI 模型提取
   */
  private async callExtractLlm(description: string): Promise<ExtractedFields> {
    // TODO: 接入 lib/ai/LlmRouter
    // 当前返回基于描述的启发式提取（占位实现）
    // 后续替换为真实 AI 调用
    return this.heuristicExtract(description);
  }

  /**
   * 启发式提取（简化实现）
   * 识别常见题材、角色类型、冲突关键词
   */
  private heuristicExtract(description: string): ExtractedFields {
    const text = description.toLowerCase();
    const fields: ExtractedFields = {
      genre: "",
      premise: "",
      protagonistType: "",
      protagonistProfession: "",
      coreConflictType: "",
    };

    // 题材识别
    if (text.includes("都市") || text.includes("城市") || text.includes("现代")) {
      fields.genre = "urban";
    } else if (text.includes("玄幻") || text.includes("仙侠") || text.includes("修真")) {
      fields.genre = "xianxia";
    } else if (text.includes("穿越") || text.includes("异世") || text.includes("异世界")) {
      fields.genre = "isekai";
    } else if (text.includes("科幻") || text.includes("星际") || text.includes("太空")) {
      fields.genre = "scifi";
    } else if (text.includes("悬疑") || text.includes("推理") || text.includes("侦探")) {
      fields.genre = "mystery";
    } else if (text.includes("言情") || text.includes("恋爱") || text.includes("爱情")) {
      fields.genre = "romance";
    } else if (text.includes("历史") || text.includes("古代") || text.includes("王朝")) {
      fields.genre = "historical";
    }

    // 主角类型识别
    if (text.includes("学生") || text.includes("校园")) {
      fields.protagonistType = "student";
    } else if (text.includes("医生") || text.includes("医疗")) {
      fields.protagonistType = "doctor";
    } else if (text.includes("警察") || text.includes("刑警") || text.includes("侦探")) {
      fields.protagonistType = "police";
    } else if (text.includes("商人") || text.includes("商业") || text.includes("总裁")) {
      fields.protagonistType = "business";
    } else if (text.includes("杀手") || text.includes("刺客") || text.includes("特工")) {
      fields.protagonistType = "assassin";
    } else if (text.includes("士兵") || text.includes("军官") || text.includes("军队")) {
      fields.protagonistType = "soldier";
    } else if (text.includes("明星") || text.includes("偶像") || text.includes("演员")) {
      fields.protagonistType = "celebrity";
    }

    // 职业识别（与主角类型部分重叠时取更具体的）
    if (text.includes("医生") && !text.includes("主角是医生")) {
      fields.protagonistProfession = "doctor";
    } else if (text.includes("律师")) {
      fields.protagonistProfession = "lawyer";
    } else if (text.includes("教师") || text.includes("老师")) {
      fields.protagonistProfession = "teacher";
    } else if (text.includes("程序员") || text.includes("工程师") || text.includes("黑客")) {
      fields.protagonistProfession = "engineer";
    } else if (text.includes("农民") || text.includes("农夫")) {
      fields.protagonistProfession = "farmer";
    }

    // 冲突类型识别
    if (text.includes("复仇") || text.includes("报仇")) {
      fields.coreConflictType = "revenge";
    } else if (text.includes("升级") || text.includes("修炼") || text.includes("成长")) {
      fields.coreConflictType = "growth";
    } else if (text.includes("爱情") || text.includes("恋爱") || text.includes("追求")) {
      fields.coreConflictType = "romance";
    } else if (text.includes("探案") || text.includes("推理") || text.includes("解谜")) {
      fields.coreConflictType = "mystery";
    } else if (text.includes("战争") || text.includes("争斗") || text.includes("争夺")) {
      fields.coreConflictType = "war";
    } else if (text.includes("生存") || text.includes("危机") || text.includes("逃亡")) {
      fields.coreConflictType = "survival";
    } else if (text.includes("阴谋") || text.includes("阴谋论") || text.includes("秘密")) {
      fields.coreConflictType = "conspiracy";
    }

    // 背景/前提（取前 100 字作为 premise）
    fields.premise = description.slice(0, 100);

    return fields;
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

let _instance: QuickStartService | null = null;

export function getQuickStartService(): QuickStartService {
  if (_instance === null) {
    _instance = new QuickStartService();
  }
  return _instance;
}