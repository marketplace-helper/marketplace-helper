
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import ort from "onnxruntime-node";

import { config } from "../../config/env.js";

const BASE_URL = config.classifier.modelBaseUrl;
const CACHE_DIR = path.resolve(config.classifier.cacheDir);
const POLL_MS = config.classifier.pollMs;

const UNKNOWN = "desconhecida";

let current = null;
let refreshing = null;
let timer = null;

// ==========================================
// HTTP
// ==========================================

async function fetchOk(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} em ${url}`);
  }

  return response;
}

async function fetchJson(url) {
  return (await fetchOk(url)).json();
}

async function fetchBuffer(url) {
  const response = await fetchOk(url);
  return Buffer.from(await response.arrayBuffer());
}

function sha256(buffer) {
  return crypto
    .createHash("sha256")
    .update(buffer)
    .digest("hex");
}

// ==========================================
// VALIDAÇÃO DOS METADADOS
// ==========================================

function validateMetadata(meta) {
  if (!meta || typeof meta !== "object") {
    throw new Error("Metadados do modelo inválidos.");
  }

  if (
    !meta.version ||
    !meta.file ||
    !meta.sha256 ||
    !Array.isArray(meta.classes) ||
    !meta.features?.numeric ||
    !meta.features?.categorical
  ) {
    throw new Error("Metadados incompletos.");
  }

  if (
    !Array.isArray(meta.features.numeric) ||
    !Array.isArray(meta.features.categorical)
  ) {
    throw new Error("Esquema de features inválido.");
  }

  if (meta.classes.length < 2) {
    throw new Error("O modelo precisa ter pelo menos duas classes.");
  }
}

// ==========================================
// PREPARAÇÃO DAS ENTRADAS ONNX
// ==========================================

function buildFeeds(meta, row) {
  const feeds = {};

  for (const name of meta.features.numeric) {
    const value = row[name];

    const number =
      value === null || value === undefined || value === ""
        ? NaN
        : Number(value);

    feeds[name] = new ort.Tensor(
      "float32",
      Float32Array.of(
        Number.isFinite(number) ? number : NaN
      ),
      [1, 1]
    );
  }

  for (const name of meta.features.categorical) {
    const value = row[name];

    const text =
      value === null || value === undefined || value === ""
        ? UNKNOWN
        : String(value);

    feeds[name] = new ort.Tensor(
      "string",
      [text],
      [1, 1]
    );
  }

  return feeds;
}

// ==========================================
// INFERÊNCIA
// ==========================================

async function runSession(model, row) {
  const output = await model.session.run(
    buildFeeds(model.meta, row)
  );

  if (!output.probabilities) {
    throw new Error(
      "Saída probabilities não encontrada no modelo ONNX."
    );
  }

  const probabilities = Array.from(
    output.probabilities.data
  );

  if (probabilities.length !== model.meta.classes.length) {
    throw new Error(
      "Quantidade de probabilidades incompatível com as classes."
    );
  }

  let best = 0;

  probabilities.forEach((probability, index) => {
    if (probability > probabilities[best]) {
      best = index;
    }
  });

  return {
    classe: model.meta.classes[best],

    probabilidades: Object.fromEntries(
      model.meta.classes.map((classe, index) => [
        classe,
        Math.round(probabilities[index] * 10000) / 10000,
      ])
    ),

    versao: model.meta.version,
  };
}

export async function classify(row) {
  if (!current) {
    throw Object.assign(
      new Error("Modelo indisponível."),
      { status: 503 }
    );
  }

  // Mantém a referência do modelo durante a inferência.
  return runSession(current, row || {});
}

// ==========================================
// CARREGAMENTO DO MODELO
// ==========================================

async function createCandidate(buffer, meta) {
  validateMetadata(meta);

  const session = await ort.InferenceSession.create(buffer);

  const candidate = {
    session,
    meta,
  };

  // Inferência de teste antes da ativação.
  await runSession(candidate, {});

  return candidate;
}

// ==========================================
// CACHE LOCAL
// ==========================================

async function saveCache(buffer, meta) {
  await fs.mkdir(CACHE_DIR, { recursive: true });

  const modelPath = path.join(CACHE_DIR, "model.onnx");
  const metaPath = path.join(CACHE_DIR, "latest.json");

  await fs.writeFile(`${modelPath}.tmp`, buffer);
  await fs.writeFile(`${metaPath}.tmp`, JSON.stringify(meta));

  await fs.rename(`${modelPath}.tmp`, modelPath);
  await fs.rename(`${metaPath}.tmp`, metaPath);
}

async function loadFromCache() {
  const meta = JSON.parse(
    await fs.readFile(
      path.join(CACHE_DIR, "latest.json"),
      "utf8"
    )
  );

  const buffer = await fs.readFile(
    path.join(CACHE_DIR, "model.onnx")
  );

  if (sha256(buffer) !== meta.sha256) {
    throw new Error("SHA-256 do cache não confere.");
  }

  current = await createCandidate(buffer, meta);

  console.log(
    `[ml] modelo ${meta.version} carregado do cache`
  );
}

// ==========================================
// ATUALIZAÇÃO REMOTA
// ==========================================

export function refresh() {
  if (!BASE_URL) {
    return Promise.reject(
      new Error("MODEL_BASE_URL não configurada.")
    );
  }

  if (refreshing) return refreshing;

  refreshing = (async () => {
    try {
      const meta = await fetchJson(
        `${BASE_URL}/latest.json?t=${Date.now()}`
      );

      validateMetadata(meta);

      if (
        current &&
        current.meta.version === meta.version
      ) {
        return {
          updated: false,
          version: meta.version,
        };
      }

      const buffer = await fetchBuffer(
        `${BASE_URL}/${meta.file}`
      );

      if (sha256(buffer) !== meta.sha256) {
        throw new Error("SHA-256 do modelo não confere.");
      }

      const candidate = await createCandidate(
        buffer,
        meta
      );

      // Troca atômica: o modelo antigo continua válido
      // até que o novo passe em todas as validações.
      current = candidate;

      await saveCache(buffer, meta).catch((error) => {
        console.warn(
          "[ml] falha ao salvar cache:",
          error.message
        );
      });

      console.log(
        `[ml] modelo ${meta.version} carregado.`
      );

      return {
        updated: true,
        version: meta.version,
      };
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================

export async function init() {
  try {
    await refresh();
  } catch (error) {
    console.warn(
      "[ml] falha ao carregar modelo remoto:",
      error.message
    );

    if (!current) {
      await loadFromCache().catch((cacheError) => {
        console.warn(
          "[ml] modelo não disponível no cache:",
          cacheError.message
        );
      });
    }
  }

  if (!timer) {
    timer = setInterval(() => {
      refresh().catch((error) => {
        console.warn(
          "[ml] atualização automática falhou:",
          error.message
        );
      });
    }, POLL_MS);

    timer.unref();
  }
}

// ==========================================
// INFORMAÇÕES DO MODELO
// ==========================================

export function info() {
  if (!current) return null;

  const { meta } = current;

  return {
    versao: meta.version,
    classes: meta.classes,
    treinado_em: meta.trained_at,
    metricas: meta.metrics,
    linhas: meta.n_rows,
  };
}

export default {
  init,
  refresh,
  classify,
  info,
};
