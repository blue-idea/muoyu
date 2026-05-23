/**
 * Wizard Store - Zustand 状态管理
 *
 * EARS-1: L1/L2 提交时静默更新偏好存储（无需显式保存）
 * EARS-2: 打开向导时预填偏好字段，可视化标记偏好选项
 * EARS-3: 重置偏好恢复默认值
 *
 * 保存 L1/L2/L3 向导数据；通过 getWizardData() 统一获取已保存数据
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** L1 核心层数据结构 */
export interface Layer1Data {
  genre: string;
  premise: string;
  protagonistType: string;
  protagonistProfession: string;
  protagonistCorePersonality: string;
  protagonistKeySupportingCast: string;
  coreConflictType: string;
  coreConflictDriver: string;
}

/** L2 深度定制层数据结构 */
export interface Layer2Data {
  worldBackground: string;
  worldUniqueRules: string;
  narrativePerspective: string;
  overallTone: string;
  coreTheme: string;
  targetAudience: string;
  styleReferences: string;
  specialRequirements: string;
  chapterCount: number;
}

/** L3 标题层数据结构 */
export interface Layer3Data {
  selectedTitle: string;
  candidates: string[];
}

/** 向导完整数据（用于创建项目时合并） */
export interface WizardAllData {
  layer1: Layer1Data;
  layer2: Layer2Data;
  layer3: Layer3Data;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_LAYER_1: Layer1Data = {
  genre: "",
  premise: "",
  protagonistType: "",
  protagonistProfession: "",
  protagonistCorePersonality: "",
  protagonistKeySupportingCast: "",
  coreConflictType: "",
  coreConflictDriver: "",
};

const DEFAULT_LAYER_2: Layer2Data = {
  worldBackground: "",
  worldUniqueRules: "",
  narrativePerspective: "",
  overallTone: "",
  coreTheme: "",
  targetAudience: "",
  styleReferences: "",
  specialRequirements: "",
  chapterCount: 20,
};

const DEFAULT_LAYER_3: Layer3Data = {
  selectedTitle: "",
  candidates: [],
};

// ---------------------------------------------------------------------------
// Store Interface
// ---------------------------------------------------------------------------

export interface WizardStore {
  // 三个 Layer 的数据
  layer1: Layer1Data;
  layer2: Layer2Data;
  layer3: Layer3Data;

  // 当前所在步骤（1, 2, 3）
  currentStep: number;

  // 是否已从远端加载过数据（用于判断预填）
  loadedFromRemote: boolean;

  // 操作：保存各层
  saveLayer1: (data: Partial<Layer1Data>) => void;
  saveLayer2: (data: Partial<Layer2Data>) => void;
  saveLayer3: (data: Partial<Layer3Data>) => void;

  // 操作：设置当前步骤
  setCurrentStep: (step: number) => void;

  // 操作：重置所有数据
  resetWizard: () => void;

  // 操作：从远端数据填充（EARS-2）
  hydrateFromRemote: (data: WizardAllData) => void;

  // 获取完整数据（供 Server Action 使用）
  getWizardData: () => WizardAllData;
}

// ---------------------------------------------------------------------------
// Initial State
// ---------------------------------------------------------------------------

function getInitialState() {
  return {
    layer1: { ...DEFAULT_LAYER_1 },
    layer2: { ...DEFAULT_LAYER_2 },
    layer3: { ...DEFAULT_LAYER_3 },
    currentStep: 1,
    loadedFromRemote: false,
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useWizardStore = create<WizardStore>()(
  devtools(
    (set, get) => ({
      ...getInitialState(),

      saveLayer1: (data) => {
        set(
          (state) => ({
            layer1: { ...state.layer1, ...data },
          }),
          false,
          "wizard/saveLayer1",
        );
      },

      saveLayer2: (data) => {
        set(
          (state) => ({
            layer2: { ...state.layer2, ...data },
          }),
          false,
          "wizard/saveLayer2",
        );
      },

      saveLayer3: (data) => {
        set(
          (state) => ({
            layer3: { ...state.layer3, ...data },
          }),
          false,
          "wizard/saveLayer3",
        );
      },

      setCurrentStep: (step) => {
        set({ currentStep: step }, false, "wizard/setCurrentStep");
      },

      resetWizard: () => {
        set(getInitialState(), false, "wizard/reset");
      },

      hydrateFromRemote: (data) => {
        set(
          {
            layer1: { ...DEFAULT_LAYER_1, ...data.layer1 },
            layer2: { ...DEFAULT_LAYER_2, ...data.layer2 },
            layer3: { ...DEFAULT_LAYER_3, ...data.layer3 },
            loadedFromRemote: true,
          },
          false,
          "wizard/hydrate",
        );
      },

      getWizardData: () => {
        const state = get();
        return {
          layer1: state.layer1,
          layer2: state.layer2,
          layer3: state.layer3,
        };
      },
    }),
    { name: "wizard-store" },
  ),
);