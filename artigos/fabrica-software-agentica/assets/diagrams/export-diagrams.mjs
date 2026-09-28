import { spawn } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = mkdtempSync(join(tmpdir(), "excalidraw-export-"));
const CHROME = process.env.CHROME_BIN || "/usr/bin/google-chrome";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class CdpClient {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.socket = new WebSocket(url);
  }

  async ready() {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function waitForPort() {
  const activePort = join(PROFILE, "DevToolsActivePort");
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const [port] = readFileSync(activePort, "utf8").trim().split("\n");
      return Number(port);
    } catch {
      await sleep(100);
    }
  }
  throw new Error("Chrome did not expose a DevTools port");
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || "Browser evaluation failed");
  }
  return result.result.value;
}

async function waitFor(client, expression, label) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await evaluate(client, expression)) return;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--hide-scrollbars",
    "--remote-debugging-port=0",
    `--user-data-dir=${PROFILE}`,
    "--window-size=1280,720",
    "https://excalidraw.com/",
  ],
  { stdio: "ignore" },
);

let client;

try {
  const port = await waitForPort();
  let target;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
    target = targets.find((item) => item.type === "page");
    if (target) break;
    await sleep(100);
  }
  if (!target) throw new Error("Excalidraw page target not found");

  client = new CdpClient(target.webSocketDebuggerUrl);
  await client.ready();
  await client.send("Runtime.enable");
  await waitFor(
    client,
    "Boolean(document.querySelector('canvas.excalidraw__canvas.interactive'))",
    "the Excalidraw canvas",
  );

  const sources = readdirSync(HERE)
    .filter((name) => /^\d{2}-.+\.excalidraw$/.test(name))
    .sort();

  for (const sourceName of sources) {
    const sourcePath = join(HERE, sourceName);
    const svgName = sourceName.replace(/\.excalidraw$/, ".svg");
    const scene = readFileSync(sourcePath, "utf8");

    await evaluate(
      client,
      `(async () => {
        const scene = ${JSON.stringify(scene)};
        const file = new File([scene], ${JSON.stringify(sourceName)}, { type: 'application/json' });
        const transfer = new DataTransfer();
        transfer.items.add(file);
        const canvas = document.querySelector('canvas.excalidraw__canvas.interactive');
        canvas.dispatchEvent(new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
        }));
        await new Promise((resolve) => setTimeout(resolve, 700));
        return true;
      })()`,
    );

    await evaluate(
      client,
      `(async () => {
        document.querySelector('[data-testid="main-menu-trigger"]').click();
        await new Promise((resolve) => setTimeout(resolve, 100));
        document.querySelector('[data-testid="image-export-button"]').click();
        await new Promise((resolve) => setTimeout(resolve, 200));
        window.__capturedExcalidrawSvg = null;
        window.showSaveFilePicker = async () => ({
          kind: 'file',
          name: ${JSON.stringify(svgName)},
          createWritable: async () => ({
            write: async (data) => {
              if (data instanceof Blob) window.__capturedExcalidrawSvg = await data.text();
              else if (typeof data === 'string') window.__capturedExcalidrawSvg = data;
              else if (data && data.data instanceof Blob) window.__capturedExcalidrawSvg = await data.data.text();
            },
            close: async () => {},
            abort: async () => {},
          }),
        });
        document.querySelector('button[aria-label="Export to SVG"]').click();
        return true;
      })()`,
    );

    await waitFor(
      client,
      "typeof window.__capturedExcalidrawSvg === 'string' && window.__capturedExcalidrawSvg.includes('<svg')",
      `SVG export for ${sourceName}`,
    );
    const svg = await evaluate(client, "window.__capturedExcalidrawSvg");
    writeFileSync(join(HERE, svgName), svg);

    await evaluate(
      client,
      `(() => {
        document.querySelector('.Modal__background')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return true;
      })()`,
    );
    await sleep(150);
    console.log(`Exported ${svgName}`);
  }
} finally {
  client?.close();
  chrome.kill("SIGTERM");
  await sleep(150);
  rmSync(PROFILE, { recursive: true, force: true });
}
