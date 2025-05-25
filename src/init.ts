import init, { initConsolePanicHook } from "spectre-wasm";

const boot = async () => {
  await init();

  initConsolePanicHook();

  await (await import("./index")).startApplicationRendering();
};

boot();
