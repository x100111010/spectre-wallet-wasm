import { create } from "zustand";
import { SpectreClient } from "./service/spectre-client";

interface SpectreState {
  spectreClientInstance: SpectreClient;
  isConnected: boolean;
  init: () => Promise<void>;
  clear: () => Promise<void>;
}

export const useSpectreStore = create<SpectreState>((set, g) => {
  const spectreClientInstance = new SpectreClient("devnet");

  return {
    spectreClientInstance,
    isConnected: false,
    async init() {
      await g().spectreClientInstance.connect();

      set({ isConnected: true });
    },
    async clear() {
      await g().spectreClientInstance.disconnect();
    },
  };
});
